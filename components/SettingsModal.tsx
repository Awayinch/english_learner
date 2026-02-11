
import React, { useEffect, useState } from 'react';
import { Settings, EnglishLevel, VocabularyItem, ChatMessage } from '../types';
import { X, UserCog, Settings as SettingsIcon, Server, Mic, CheckCircle, AlertCircle, RefreshCw, MessageSquare, Cloud, Sparkles, UploadCloud, DownloadCloud, Loader2, Brain, History, BookOpen, FileJson, CheckSquare, Square, Smartphone, Github, ExternalLink } from 'lucide-react';
import { loadVoices } from '../utils/ttsUtils';
import { getAvailableModels } from '../services/geminiService';
import { syncToGithub, loadFromGithub } from '../services/githubService';

// We import metadata for the local version
// In a real build, this might be imported differently, but this works for this structure.
// Assuming metadata.json is fetchable or we hardcode the check logic.
const APP_VERSION = "1.0.0"; // Must match metadata.json

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  
  vocabulary?: VocabularyItem[];
  setVocabulary?: React.Dispatch<React.SetStateAction<VocabularyItem[]>>;
  messages?: ChatMessage[];
  setMessages?: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

interface BackupData {
    version: number;
    date: string;
    settings: Settings;
    vocabulary: VocabularyItem[];
    messages: ChatMessage[];
}

interface RestoreSelection {
    connection: boolean; // ApiKey, BaseUrl, Model
    history: boolean;    // Chat Messages
    vocabulary: boolean; // Words
    memory: boolean;     // Long Term Memory
    persona: boolean;    // System/User Persona + Greeting
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  vocabulary,
  setVocabulary,
  messages,
  setMessages
}) => {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'none' | 'success' | 'error'>('none');
  const [testMessage, setTestMessage] = useState('');
  
  // Sync States
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cloudMsg, setCloudMsg] = useState('');
  
  // Update Check State
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate' | 'error'>('idle');
  const [remoteVersion, setRemoteVersion] = useState('');

  // Restore / Preview State
  const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
  const [restoreSelection, setRestoreSelection] = useState<RestoreSelection>({
      connection: true,
      history: true,
      vocabulary: true,
      memory: true,
      persona: true
  });

  const [showSummarySettings, setShowSummarySettings] = useState(
      !!settings.summaryApiKey || !!settings.summaryBaseUrl || !!settings.summaryModel
  );

  useEffect(() => {
    if (isOpen) {
        loadVoices().then(voices => {
            const enVoices = voices.filter(v => v.lang.startsWith('en'));
            setBrowserVoices(enVoices.length > 0 ? enVoices : voices);
        });
        if (settings.selectedModel) {
            setAvailableModels(prev => prev.includes(settings.selectedModel) ? prev : [...prev, settings.selectedModel]);
        }
    }
  }, [isOpen, settings.selectedModel]);

  // Clear preview when closing or successfully restoring
  useEffect(() => {
      if (!isOpen) {
          setBackupPreview(null);
          setCloudStatus('idle');
          setUpdateStatus('idle');
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = async () => {
      setIsTesting(true);
      setTestStatus('none');
      setTestMessage('Connecting...');
      
      try {
          const models = await getAvailableModels(settings);
          setAvailableModels(models);
          setTestStatus('success');
          
          const source = settings.baseUrl ? "Proxy/Custom URL" : "Google Direct";
          const maskedKey = settings.apiKey ? `...${settings.apiKey.slice(-4)}` : "None";
          setTestMessage(`Success! Found ${models.length} models via ${source}. (Key: ${maskedKey})`);
          
          if (!settings.selectedModel || !models.includes(settings.selectedModel)) {
             const preferred = models.find(m => m.includes('gemini-2.0-flash')) || 
                               models.find(m => m.includes('gemini-1.5-flash')) || 
                               models[0];
             if (preferred) {
                 handleChange('selectedModel', preferred);
             }
          }
      } catch (error: any) {
          setTestStatus('error');
          setTestMessage(error.message || "Connection failed. Check Proxy/API Key.");
          setAvailableModels([]);
      } finally {
          setIsTesting(false);
      }
  };

  // --- Update Checker ---
  const handleCheckForUpdates = async () => {
      setUpdateStatus('checking');
      try {
          // Fetch the package.json from the main repository
          const res = await fetch('https://raw.githubusercontent.com/awayinch/LingoLeap/main/metadata.json?t=' + Date.now());
          if (!res.ok) throw new Error("Could not reach update server.");
          
          const remoteMeta = await res.json();
          const rVersion = remoteMeta.version;
          setRemoteVersion(rVersion);

          if (compareVersions(rVersion, APP_VERSION) > 0) {
              setUpdateStatus('available');
          } else {
              setUpdateStatus('uptodate');
          }
      } catch (e) {
          console.error(e);
          setUpdateStatus('error');
      }
  };

  // Simple semver comparison: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
  const compareVersions = (v1: string, v2: string) => {
      const parts1 = v1.split('.').map(Number);
      const parts2 = v2.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 > p2) return 1;
          if (p1 < p2) return -1;
      }
      return 0;
  };

  // --- Cloud Logic ---

  const handleFetchBackup = async () => {
      if (!settings.githubToken || !settings.githubRepo) {
          setCloudStatus('error');
          setCloudMsg('Please configure GitHub Token & Repo first.');
          return;
      }
      
      setIsCloudLoading(true);
      setCloudStatus('idle');
      setBackupPreview(null);

      try {
          const jsonStr = await loadFromGithub(settings, 'lingoleap_backup.json');
          if (!jsonStr) throw new Error("File 'lingoleap_backup.json' not found in repo.");
          
          let data: BackupData;
          try {
              data = JSON.parse(jsonStr);
          } catch (e) {
              throw new Error("Failed to parse backup JSON. File might be corrupted.");
          }

          // Basic validation
          if (!data.settings && !data.vocabulary) {
              throw new Error("Invalid backup format: Missing settings or vocabulary.");
          }

          setBackupPreview(data);
          setCloudStatus('success');
          setCloudMsg('Backup found! Review content below.');
      } catch (e: any) {
          setCloudStatus('error');
          setCloudMsg(e.message || 'Fetch failed.');
      } finally {
          setIsCloudLoading(false);
      }
  };

  const handleConfirmRestore = () => {
      if (!backupPreview) return;
      
      const { connection, history, vocabulary: restoreVocab, memory, persona } = restoreSelection;
      const bSettings = backupPreview.settings;

      // 1. Update Settings selectively
      setSettings(prev => {
          let next = { ...prev };
          
          if (connection) {
              next.apiKey = bSettings.apiKey || next.apiKey;
              next.baseUrl = bSettings.baseUrl || next.baseUrl;
              next.selectedModel = bSettings.selectedModel || next.selectedModel;
              next.summaryApiKey = bSettings.summaryApiKey || next.summaryApiKey;
              next.summaryBaseUrl = bSettings.summaryBaseUrl || next.summaryBaseUrl;
              next.summaryModel = bSettings.summaryModel || next.summaryModel;
          }
          
          if (memory) {
              next.longTermMemory = bSettings.longTermMemory || "";
          }

          if (persona) {
              next.systemPersona = bSettings.systemPersona || next.systemPersona;
              next.userPersona = bSettings.userPersona || next.userPersona;
              next.initialGreeting = bSettings.initialGreeting || next.initialGreeting;
              next.voiceName = bSettings.voiceName || next.voiceName;
              next.level = bSettings.level || next.level;
          }

          return next;
      });

      // 2. Update Data
      if (restoreVocab && setVocabulary && backupPreview.vocabulary) {
          setVocabulary(backupPreview.vocabulary);
      }
      
      if (history && setMessages && backupPreview.messages) {
          setMessages(backupPreview.messages);
      }

      setCloudStatus('success');
      setCloudMsg('Import Successful!');
      setTimeout(() => {
          setBackupPreview(null); // Clear preview mode
      }, 1500);
  };

  const handleCloudUpload = async () => {
      if (!settings.githubToken || !settings.githubRepo) {
          setCloudStatus('error');
          setCloudMsg('Config GitHub below first.');
          return;
      }
      setIsCloudLoading(true);
      setCloudStatus('idle');
      try {
          const backupData: BackupData = {
              version: 1,
              date: new Date().toISOString(),
              settings: settings,
              vocabulary: vocabulary || [],
              messages: messages || []
          };
          
          await syncToGithub(settings, 'lingoleap_backup.json', JSON.stringify(backupData, null, 2));
          
          setCloudStatus('success');
          setCloudMsg('Upload Complete! Saved to GitHub.');
      } catch (e: any) {
          setCloudStatus('error');
          setCloudMsg(e.message || 'Upload failed.');
      } finally {
          setIsCloudLoading(false);
      }
  };

  const toggleSelection = (key: keyof RestoreSelection) => {
      setRestoreSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = (v: boolean) => {
      setRestoreSelection({
          connection: v,
          history: v,
          vocabulary: v,
          memory: v,
          persona: v
      });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[95%] sm:w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white rounded-t-2xl shrink-0">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <SettingsIcon size={20} />
            Configuration
          </h2>
          <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

            {/* App Info & Update Section */}
            <div className="bg-slate-800 text-slate-200 p-4 rounded-xl shadow-lg border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 font-bold text-white">
                        <Smartphone size={20} />
                        <h3>App Info</h3>
                    </div>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600">v{APP_VERSION}</span>
                </div>
                
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    To install as a mobile app: Tap your browser menu (Chrome/Safari) and select <strong>"Add to Home Screen"</strong>.
                </p>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleCheckForUpdates}
                        disabled={updateStatus === 'checking'}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {updateStatus === 'checking' ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
                        {updateStatus === 'checking' ? 'Checking...' : 'Check GitHub Updates'}
                    </button>
                    
                    <a href="https://github.com/awayinch/LingoLeap" target="_blank" rel="noreferrer" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
                        <ExternalLink size={16} />
                    </a>
                </div>

                {updateStatus === 'available' && (
                    <div className="mt-3 p-3 bg-indigo-900/50 border border-indigo-500/50 rounded-lg animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2 text-green-400 text-sm font-bold mb-1">
                            <Sparkles size={14} /> New Version Available: v{remoteVersion}
                        </div>
                        <div className="text-xs text-slate-300 space-y-2">
                            <p>If running on Termux/Local, run:</p>
                            <code className="block bg-black/50 p-2 rounded font-mono text-green-300 select-all cursor-pointer" onClick={(e) => {
                                const target = e.target as HTMLElement;
                                navigator.clipboard.writeText(target.innerText);
                                alert("Command copied!");
                            }}>
                                git pull && npm run build
                            </code>
                            <p>If running on Web/Vercel: Just refresh the page.</p>
                        </div>
                    </div>
                )}

                {updateStatus === 'uptodate' && (
                    <div className="mt-3 text-xs text-green-400 flex items-center gap-2">
                        <CheckCircle size={12} /> You are on the latest version.
                    </div>
                )}
                 {updateStatus === 'error' && (
                    <div className="mt-3 text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle size={12} /> Could not fetch update info.
                    </div>
                )}
            </div>

           {/* Cloud Sync Section */}
           <div className="space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between text-indigo-700 font-medium">
                    <div className="flex items-center gap-2">
                        <Cloud size={18} />
                        <h3>Data Sync (GitHub)</h3>
                    </div>
                </div>
                
                {/* GitHub Config Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">GitHub Token</label>
                        <input
                            type="password"
                            placeholder="ghp_xxxxxxxxxxxx"
                            value={settings.githubToken || ''}
                            onChange={(e) => handleChange('githubToken', e.target.value)}
                            className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                            <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Repo</label>
                            <input
                                type="text"
                                placeholder="user/repo"
                                value={settings.githubRepo || ''}
                                onChange={(e) => handleChange('githubRepo', e.target.value)}
                                className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Path</label>
                            <input
                                type="text"
                                placeholder="Backup/"
                                value={settings.githubPath || ''}
                                onChange={(e) => handleChange('githubPath', e.target.value)}
                                className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Status Message */}
                {cloudStatus !== 'idle' && (
                    <div className={`text-xs px-3 py-2 rounded flex items-center gap-2 font-medium ${cloudStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {cloudStatus === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                        {cloudMsg}
                    </div>
                )}

                {/* Action Buttons (Hidden if Previewing) */}
                {!backupPreview && (
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button 
                            onClick={handleCloudUpload}
                            disabled={isCloudLoading || !settings.githubToken}
                            className="flex-1 py-2 px-3 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isCloudLoading ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16} />}
                            Backup Current Data
                        </button>
                        <button 
                            onClick={handleFetchBackup}
                            disabled={isCloudLoading || !settings.githubToken}
                            className="flex-1 py-2 px-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isCloudLoading ? <Loader2 size={16} className="animate-spin"/> : <DownloadCloud size={16} />}
                            Fetch Backup & Preview
                        </button>
                    </div>
                )}

                {/* --- RESTORE PREVIEW UI --- */}
                {backupPreview && (
                    <div className="mt-4 bg-white rounded-lg border border-indigo-100 p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                <FileJson size={16} /> Backup Content
                            </h4>
                            <span className="text-xs text-slate-400">
                                {new Date(backupPreview.date).toLocaleDateString()} {new Date(backupPreview.date).toLocaleTimeString()}
                            </span>
                        </div>

                        <div className="space-y-2 mb-4">
                            {/* Connection */}
                            <div 
                                onClick={() => toggleSelection('connection')}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer border ${restoreSelection.connection ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                            >
                                <div className="flex items-center gap-3">
                                    {restoreSelection.connection ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-400" size={18}/>}
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1"><Server size={12}/> AI Connection</span>
                                        <span className="text-xs text-slate-500">
                                            {backupPreview.settings.apiKey ? "API Key Present" : "No Key"} • {backupPreview.settings.selectedModel || "Default Model"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Memory */}
                            <div 
                                onClick={() => toggleSelection('memory')}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer border ${restoreSelection.memory ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                            >
                                <div className="flex items-center gap-3">
                                    {restoreSelection.memory ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-400" size={18}/>}
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1"><Brain size={12}/> Long Term Memory</span>
                                        <span className="text-xs text-slate-500 truncate max-w-[200px]">
                                            {backupPreview.settings.longTermMemory ? `"${backupPreview.settings.longTermMemory.substring(0, 30)}..."` : "Empty"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Worldbook */}
                            <div 
                                onClick={() => toggleSelection('vocabulary')}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer border ${restoreSelection.vocabulary ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                            >
                                <div className="flex items-center gap-3">
                                    {restoreSelection.vocabulary ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-400" size={18}/>}
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1"><BookOpen size={12}/> Worldbook</span>
                                        <span className="text-xs text-slate-500">
                                            {backupPreview.vocabulary?.length || 0} Words found
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* History */}
                            <div 
                                onClick={() => toggleSelection('history')}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer border ${restoreSelection.history ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                            >
                                <div className="flex items-center gap-3">
                                    {restoreSelection.history ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-400" size={18}/>}
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1"><History size={12}/> Chat History</span>
                                        <span className="text-xs text-slate-500">
                                            {backupPreview.messages?.length || 0} Messages found
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Persona */}
                            <div 
                                onClick={() => toggleSelection('persona')}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer border ${restoreSelection.persona ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                            >
                                <div className="flex items-center gap-3">
                                    {restoreSelection.persona ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-400" size={18}/>}
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1"><UserCog size={12}/> Persona & Greeting</span>
                                        <span className="text-xs text-slate-500">
                                            System Prompt, Voice, Greeting
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-500 mb-4 px-1">
                            <div className="flex gap-2">
                                <button onClick={() => selectAll(true)} className="hover:text-indigo-600 underline">Select All</button>
                                <button onClick={() => selectAll(false)} className="hover:text-indigo-600 underline">None</button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => setBackupPreview(null)}
                                className="flex-1 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmRestore}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex justify-center items-center gap-2"
                            >
                                <DownloadCloud size={16} /> Import Selected
                            </button>
                        </div>
                    </div>
                )}
           </div>

           {/* Main API Settings (Only show if not previewing restore to save space, or keep visible) */}
           <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-indigo-700 font-medium">
                    <div className="flex items-center gap-2">
                        <Server size={18} />
                        <h3>Chat AI Connection</h3>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">API Key (Required for Proxy)</label>
                        <input
                            type="password"
                            placeholder="Enter your Gemini API Key"
                            value={settings.apiKey || ''}
                            onChange={(e) => handleChange('apiKey', e.target.value)}
                            className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Base URL (Reverse Proxy)</label>
                        <input
                            type="text"
                            placeholder="https://generativelanguage.googleapis.com"
                            value={settings.baseUrl}
                            onChange={(e) => handleChange('baseUrl', e.target.value)}
                            className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    
                    {/* Test Button & Status */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <button 
                            onClick={handleTestConnection}
                            disabled={isTesting || !settings.apiKey}
                            className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50 text-xs font-medium flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
                        >
                            {isTesting ? <RefreshCw size={14} className="animate-spin"/> : <Server size={14} />}
                            Test Connection & Fetch Models
                        </button>
                        
                        {testStatus === 'success' && (
                            <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                                <CheckCircle size={14} /> {testMessage}
                            </span>
                        )}
                         {testStatus === 'error' && (
                            <span className="text-xs text-red-600 flex items-center gap-1 font-medium">
                                <AlertCircle size={14} /> {testMessage}
                            </span>
                        )}
                    </div>

                    {/* Model Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Chat Model</label>
                        <div className="relative">
                            <select
                                value={settings.selectedModel}
                                onChange={(e) => handleChange('selectedModel', e.target.value)}
                                className="w-full p-2 rounded border border-slate-300 text-sm bg-white"
                            >
                                <option value="gemini-3-flash-preview">gemini-3-flash-preview (Default)</option>
                                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                                {availableModels.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

           {/* Summary AI Config Toggle */}
           <div className="space-y-3">
                <div className="pt-2 border-t border-slate-200">
                    <button 
                        className="text-xs font-medium text-indigo-600 flex items-center gap-1 hover:text-indigo-800"
                        onClick={() => setShowSummarySettings(!showSummarySettings)}
                    >
                        <SettingsIcon size={12} />
                        {showSummarySettings ? "Hide Advanced AI Config" : "Configure Separate Summary AI"}
                    </button>

                    {showSummarySettings && (
                        <div className="mt-3 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={14} className="text-amber-500" />
                                    <span className="text-xs font-bold text-slate-600 uppercase">Summary AI Override</span>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Summary API Key (Optional)</label>
                                <input
                                    type="password"
                                    placeholder="Use different key for summary..."
                                    value={settings.summaryApiKey || ''}
                                    onChange={(e) => handleChange('summaryApiKey', e.target.value)}
                                    className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Summary Base URL (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Override Base URL for summary..."
                                    value={settings.summaryBaseUrl || ''}
                                    onChange={(e) => handleChange('summaryBaseUrl', e.target.value)}
                                    className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Summary Model</label>
                                <select
                                    value={settings.summaryModel || settings.selectedModel}
                                    onChange={(e) => handleChange('summaryModel', e.target.value)}
                                    className="w-full p-2 rounded border border-slate-300 text-sm bg-white"
                                >
                                    <option value="">Same as Chat Model</option>
                                    {availableModels.map(m => (
                                        <option key={`sum-${m}`} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
           </div>

           {/* Custom Greeting */}
           <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-medium">
                    <MessageSquare size={18} />
                    <h3>Custom Initial Greeting</h3>
                </div>
                <textarea
                    className="w-full p-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm h-20 resize-y"
                    placeholder="Hello! I'm your English tutor..."
                    value={settings.initialGreeting}
                    onChange={(e) => handleChange('initialGreeting', e.target.value)}
                />
            </div>
          
          {/* Persona Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-700 font-medium">
              <UserCog size={18} />
              <h3>Character Persona (System Prompt)</h3>
            </div>
            <textarea
              className="w-full p-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm h-24 resize-y"
              placeholder="e.g., You are a strict Victorian teacher who hates slang..."
              value={settings.systemPersona}
              onChange={(e) => handleChange('systemPersona', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Voice Settings */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-medium">
                <Mic size={18} />
                <h3>Voice & Level</h3>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Browser Voice (Free)</label>
                    <select
                        value={settings.voiceName}
                        onChange={(e) => handleChange('voiceName', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 text-sm"
                    >
                        <option value="">Default Browser Voice</option>
                        {browserVoices.map(v => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name} ({v.lang})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Difficulty Level</label>
                     <select 
                        value={settings.level} 
                        onChange={(e) => handleChange('level', e.target.value as EnglishLevel)}
                        className="w-full p-2 rounded border border-slate-300 text-sm"
                    >
                        {Object.values(EnglishLevel).map((lvl) => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                    </select>
                </div>
            </div>
          </div>

        </div>
        
        <div className="p-4 border-t border-slate-200 flex justify-end shrink-0">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium w-full sm:w-auto"
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
