import React, { useEffect, useState, useRef } from 'react';
import { Settings, EnglishLevel, VocabularyItem, ChatMessage, ChatSession } from '../types';
import { X, Settings as SettingsIcon, Server, Mic, CheckCircle, AlertCircle, RefreshCw, MessageSquare, Cloud, Sparkles, UploadCloud, DownloadCloud, Loader2, FileJson, CheckSquare, Square, Smartphone, Github, ExternalLink, Save, FolderOpen, HardDrive, Wifi, WifiOff, Terminal, Copy, Trash2, Layout, Cpu, User, Brain, PenTool, Wrench } from 'lucide-react';
import { loadVoices, AppVoice } from '../utils/ttsUtils';
import { getAvailableModels } from '../services/geminiService';
import { syncToGithub, loadFromGithub } from '../services/githubService';

// We import metadata for the local version
const APP_VERSION = "1.0.13"; // Must match metadata.json

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  
  vocabulary?: VocabularyItem[];
  setVocabulary?: React.Dispatch<React.SetStateAction<VocabularyItem[]>>;
  sessions?: ChatSession[];
  setSessions?: React.Dispatch<React.SetStateAction<ChatSession[]>>;
}

interface BackupData {
    version: number;
    date: string;
    settings: Settings;
    vocabulary: VocabularyItem[];
    // Supporting multiple sessions now
    sessions?: ChatSession[];
    // Legacy support
    messages?: ChatMessage[];
}

interface RestoreSelection {
    connection: boolean; // ApiKey, BaseUrl, Model
    history: boolean;    // Chat Messages
    vocabulary: boolean; // Words
    memory: boolean;     // Long Term Memory
    persona: boolean;    // System/User Persona + Greeting
}

type SettingsTab = 'system' | 'ai' | 'persona';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  vocabulary,
  setVocabulary,
  sessions,
  setSessions
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('system');
  const [voiceList, setVoiceList] = useState<AppVoice[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'none' | 'success' | 'error'>('none');
  const [testMessage, setTestMessage] = useState('');
  
  // Sync States
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cloudMsg, setCloudMsg] = useState('');
  
  // Local File States
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update Check State
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate' | 'error'>('idle');
  const [remoteVersion, setRemoteVersion] = useState('');
  const [checkedRepo, setCheckedRepo] = useState('');

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

  // Load voices when modal opens or when TTS setting changes
  useEffect(() => {
    if (isOpen) {
        loadVoices(settings.useEdgeTTS).then(voices => {
            setVoiceList(voices);
            if (settings.voiceName && !voices.some(v => v.id === settings.voiceName)) {
                 const defaultVoice = voices.find(v => v.id.includes("Guy") || v.lang === 'en-US');
                 if (defaultVoice) handleChange('voiceName', defaultVoice.id);
                 else if (voices.length > 0) handleChange('voiceName', voices[0].id);
            }
        });

        if (settings.selectedModel) {
            setAvailableModels(prev => prev.includes(settings.selectedModel) ? prev : [...prev, settings.selectedModel]);
        }
    }
  }, [isOpen, settings.useEdgeTTS, settings.selectedModel]);

  useEffect(() => {
      if (!isOpen) {
          setBackupPreview(null);
          setCloudStatus('idle');
          setUpdateStatus('idle');
          setActiveTab('system'); // Reset tab
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Settings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = async () => {
      setIsTesting(true);
      setTestStatus('none');
      setTestMessage('连接中...');
      
      try {
          const models = await getAvailableModels(settings);
          setAvailableModels(models);
          setTestStatus('success');
          
          const source = settings.baseUrl ? "代理/自定义 URL" : "Google 直连";
          const maskedKey = settings.apiKey ? `...${settings.apiKey.slice(-4)}` : "None";
          setTestMessage(`成功! 发现 ${models.length} 个模型`);
          
          if (!settings.selectedModel || !models.includes(settings.selectedModel)) {
             const preferred = models.find(m => m.includes('gemini-1.5-flash')) || 
                               models.find(m => m.includes('gemini-3-flash')) || 
                               models[0];
             if (preferred) {
                 handleChange('selectedModel', preferred);
             }
          }
      } catch (error: any) {
          setTestStatus('error');
          setTestMessage(error.message || "连接失败，请检查设置。");
          setAvailableModels([]);
      } finally {
          setIsTesting(false);
      }
  };

  // --- Update Checker (Robust Mobile Fix) ---
  // --- 🚀 终极防缓存版 (直连源站 + 强制刷新) ---
  const handleCheckForUpdates = async () => {
      setUpdateStatus('checking');
      
      const officialRepo = "Awayinch/english_learner";
      let targetRepo = officialRepo;
      
      // 校验 Repo
      if (settings.githubRepo && typeof settings.githubRepo === 'string' && settings.githubRepo.includes("/")) {
          targetRepo = settings.githubRepo;
      }

      // 🛠️ 定义 fetch 选项：这是强制手机不读缓存的关键！
      const noCacheOptions: RequestInit = {
          cache: 'no-store', // 告诉浏览器：绝对不要存，也绝对不要读缓存
          headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
          }
      };

      try {
          // ⚠️ 策略变更：只用 Raw GitHub，不用 CDN。
          // 因为 CDN (jsDelivr) 有同步延迟，不适合用来检测刚发布的版本。
          const timestamp = Date.now();
          const url = `https://raw.githubusercontent.com/${targetRepo}/main/metadata.json?t=${timestamp}`;

          console.log("正在检查更新 (强制直连):", url);

          // 设置 10秒超时，防止 GitHub 在国内偶尔抽风卡死
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const res = await fetch(url, { 
              ...noCacheOptions, 
              signal: controller.signal 
          });
          
          clearTimeout(timeoutId);

          if (!res.ok) {
              // 如果直连失败，再尝试一下官方仓库（作为保底）
              if (targetRepo !== officialRepo) {
                   console.log("自定义仓库连接失败，尝试官方仓库...");
                   const fallbackUrl = `https://raw.githubusercontent.com/${officialRepo}/main/metadata.json?t=${timestamp}`;
                   const fallbackRes = await fetch(fallbackUrl, { ...noCacheOptions });
                   
                   if (fallbackRes.ok) {
                       const text = await fallbackRes.text();
                       const data = JSON.parse(text);
                       if (data && data.version) {
                           processUpdateData(data, officialRepo);
                           return;
                       }
                   }
              }
              throw new Error(`网络请求失败: ${res.status}`);
          }

          // 防白屏：先取文本再解析
          const text = await res.text();
          let remoteMeta;
          try {
              remoteMeta = JSON.parse(text);
          } catch (e) {
              throw new Error("返回数据格式错误 (非 JSON)");
          }

          // 处理数据
          processUpdateData(remoteMeta, targetRepo);

      } catch (e: any) {
          console.error("更新检查失败:", e);
          setUpdateStatus('error');
          // 调试模式下可以把错误打出来，或者仅提示网络错误
          // alert(`无法连接更新服务器: ${e.message}`); 
      }
  };

  const processUpdateData = (remoteMeta: any, repoName: string) => {
      if (!remoteMeta || !remoteMeta.version) {
          setUpdateStatus('error');
          return;
      }
      const rVersion = remoteMeta.version;
      setRemoteVersion(rVersion);
      setCheckedRepo(repoName);

      if (compareVersions(rVersion, APP_VERSION) > 0) {
          setUpdateStatus('available');
      } else {
          setUpdateStatus('uptodate');
      }
  };

  const compareVersions = (v1: string, v2: string) => {
      if (!v1 || !v2) return 0;
      const parts1 = String(v1).split('.').map(Number);
      const parts2 = String(v2).split('.').map(Number);
      for (let i = 0; i < 3; i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 > p2) return 1;
          if (p1 < p2) return -1;
      }
      return 0;
  };

  const copyCommand = (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          alert("命令已复制!\n\n请切换到 Termux 窗口:\n1. 停止当前服务 (CTRL + C)。\n2. 长按粘贴并运行。");
      });
  };

  // --- Local File Export/Import ---
  const handleExportLocal = () => {
      const backupData: BackupData = {
          version: 2,
          date: new Date().toISOString(),
          settings: settings,
          vocabulary: vocabulary || [],
          sessions: sessions || []
      };
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `lingoleap_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const jsonStr = event.target?.result as string;
              const data = JSON.parse(jsonStr);
              if (!data.settings && !data.vocabulary) throw new Error("无效文件。");
              setBackupPreview(data);
              setCloudStatus('success');
              setCloudMsg('文件已加载，请预览。');
          } catch (err) {
              setCloudStatus('error');
              setCloudMsg('解析失败。');
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  // --- Cloud Logic ---

  const handleFetchBackup = async () => {
      if (!settings.githubToken || !settings.githubRepo) {
          setCloudStatus('error');
          setCloudMsg('请先配置 GitHub。');
          return;
      }
      setIsCloudLoading(true);
      setCloudStatus('idle');
      setBackupPreview(null);
      try {
          const jsonStr = await loadFromGithub(settings, 'lingoleap_backup.json');
          if (!jsonStr) throw new Error("未找到备份文件。");
          let data: BackupData;
          try { data = JSON.parse(jsonStr); } catch (e) { throw new Error("解析失败，文件可能损坏。"); }
          if (!data.settings && !data.vocabulary) throw new Error("无效备份格式。");
          setBackupPreview(data);
          setCloudStatus('success');
          setCloudMsg('备份已找到。');
      } catch (e: any) {
          setCloudStatus('error');
          setCloudMsg(e.message || '获取失败。');
      } finally {
          setIsCloudLoading(false);
      }
  };

  const handleConfirmRestore = () => {
      if (!backupPreview) return;
      const { connection, history, vocabulary: restoreVocab, memory, persona } = restoreSelection;
      const bSettings = backupPreview.settings;

      setSettings(prev => {
          let next = { ...prev };
          if (connection) {
              next.apiKey = bSettings.apiKey || next.apiKey;
              next.baseUrl = bSettings.baseUrl || next.baseUrl;
              next.selectedModel = bSettings.selectedModel || next.selectedModel;
              next.vocabularyModel = bSettings.vocabularyModel || next.vocabularyModel || "gemini-1.5-flash";
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
              next.useEdgeTTS = bSettings.useEdgeTTS ?? next.useEdgeTTS;
          }
          return next;
      });

      if (restoreVocab && setVocabulary && backupPreview.vocabulary) setVocabulary(backupPreview.vocabulary);
      
      if (history && setSessions) {
          if (backupPreview.sessions) {
              // Restore full sessions
              setSessions(backupPreview.sessions);
          } else if (backupPreview.messages) {
              // Restore legacy single chat as a session
              setSessions([{
                  id: Date.now().toString(),
                  title: 'Restored Chat',
                  messages: backupPreview.messages,
                  createdAt: Date.now()
              }]);
          }
      }

      setCloudStatus('success');
      setCloudMsg('导入成功!');
      setTimeout(() => setBackupPreview(null), 1500);
  };

  const handleCloudUpload = async () => {
      if (!settings.githubToken || !settings.githubRepo) {
          setCloudStatus('error');
          setCloudMsg('请配置 GitHub。');
          return;
      }
      setIsCloudLoading(true);
      setCloudStatus('idle');
      try {
          const backupData: BackupData = {
              version: 2,
              date: new Date().toISOString(),
              settings: settings,
              vocabulary: vocabulary || [],
              sessions: sessions || []
          };
          await syncToGithub(settings, 'lingoleap_backup.json', JSON.stringify(backupData, null, 2));
          setCloudStatus('success');
          setCloudMsg('上传完成!');
      } catch (e: any) {
          setCloudStatus('error');
          setCloudMsg(e.message || '上传失败。');
      } finally {
          setIsCloudLoading(false);
      }
  };

  const toggleSelection = (key: keyof RestoreSelection) => {
      setRestoreSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Render Sections ---

  const renderSidebar = () => (
      <div className="w-full md:w-48 flex md:flex-col gap-2 p-3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 overflow-x-auto shrink-0">
          <button 
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'system' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
              <Layout size={18} /> 系统与数据
          </button>
          <button 
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ai' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
              <Cpu size={18} /> AI 与语音
          </button>
          <button 
              onClick={() => setActiveTab('persona')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'persona' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
              <User size={18} /> 人设与记忆
          </button>
      </div>
  );

  const renderSystemTab = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            {/* App Info & Update */}
            <div className="bg-slate-800 text-slate-200 p-4 rounded-xl shadow-lg border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 font-bold text-white">
                        <Smartphone size={20} />
                        <h3>应用信息 v{APP_VERSION}</h3>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleCheckForUpdates}
                        disabled={updateStatus === 'checking'}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {updateStatus === 'checking' ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
                        {updateStatus === 'checking' ? '检查中...' : '检查更新'}
                    </button>
                    <a href="https://github.com/Awayinch/english_learner" target="_blank" rel="noreferrer" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
                        <ExternalLink size={16} />
                    </a>
                </div>

                {updateStatus === 'available' && (
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                        <div className="flex items-center gap-2 text-green-400 text-sm font-bold mb-2">
                            <Sparkles size={14} /> 发现新版本 v{remoteVersion}
                        </div>
                        <button 
                            onClick={() => copyCommand("git pull && npm run build")}
                            className="w-full flex items-center justify-between bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded transition-colors"
                        >
                            <span className="flex items-center gap-2"><Terminal size={12}/> 复制更新命令</span>
                            <Copy size={12} />
                        </button>
                    </div>
                )}
                
                {updateStatus === 'uptodate' && (
                    <div className="mt-3 p-2 bg-slate-700/30 rounded-lg border border-slate-600 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium animate-in fade-in">
                        <CheckCircle size={14} className="text-green-500" /> 当前已是最新版本
                    </div>
                )}
            </div>

           {/* Data Management */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-700 font-medium mb-3">
                    <HardDrive size={18} />
                    <h3>备份与同步</h3>
                </div>

                <div className="space-y-3">
                    <div className="flex gap-2">
                         <button onClick={handleExportLocal} className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border border-slate-300">
                            <Save size={14} /> 导出文件
                        </button>
                        <div className="flex-1 relative">
                            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportLocal} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border border-slate-300">
                                <FolderOpen size={14} /> 导入文件
                            </button>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-3">
                        <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                             <Cloud size={12}/> GitHub 同步配置
                        </div>
                        <div className="grid gap-2 mb-2">
                            <input type="password" placeholder="Token (ghp_...)" value={settings.githubToken || ''} onChange={(e) => handleChange('githubToken', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none" />
                            <div className="flex gap-2">
                                <input type="text" placeholder="user/repo" value={settings.githubRepo || ''} onChange={(e) => handleChange('githubRepo', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none flex-1" />
                                <input type="text" placeholder="Path/" value={settings.githubPath || ''} onChange={(e) => handleChange('githubPath', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none flex-1" />
                            </div>
                        </div>

                        {!backupPreview ? (
                            <div className="flex gap-2">
                                <button onClick={handleCloudUpload} disabled={isCloudLoading || !settings.githubToken} className="flex-1 py-2 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isCloudLoading ? <Loader2 size={14} className="animate-spin"/> : <UploadCloud size={14} />}
                                    上传云端
                                </button>
                                <button onClick={handleFetchBackup} disabled={isCloudLoading || !settings.githubToken} className="flex-1 py-2 px-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isCloudLoading ? <Loader2 size={14} className="animate-spin"/> : <DownloadCloud size={14} />}
                                    下载云端
                                </button>
                            </div>
                        ) : (
                            // Restore Preview UI
                            <div className="bg-slate-50 rounded-lg border border-indigo-100 p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-700">导入预览 ({new Date(backupPreview.date).toLocaleDateString()})</span>
                                    <button onClick={() => setBackupPreview(null)} className="text-xs text-slate-400 underline">取消</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {['connection', 'memory', 'vocabulary', 'history', 'persona'].map((key) => {
                                        const k = key as keyof RestoreSelection;
                                        return (
                                        <div key={k} onClick={() => toggleSelection(k)} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer border ${restoreSelection[k] ? 'bg-indigo-100 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                            {restoreSelection[k] ? <CheckSquare size={14} className="text-indigo-600"/> : <Square size={14} className="text-slate-400"/>}
                                            <span className="text-xs font-medium capitalize">{key === 'connection' ? '设置' : key === 'history' ? '聊天' : key === 'vocabulary' ? '生词' : key === 'memory' ? '记忆' : '人设'}</span>
                                        </div>
                                        )
                                    })}
                                </div>
                                <button onClick={handleConfirmRestore} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium flex justify-center items-center gap-2"><DownloadCloud size={14} /> 确认导入</button>
                            </div>
                        )}
                        
                         {cloudStatus !== 'idle' && (
                            <div className={`mt-2 text-xs px-2 py-1 rounded flex items-center gap-2 font-medium ${cloudStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {cloudStatus === 'success' ? <CheckCircle size={12}/> : <AlertCircle size={12}/>}
                                {cloudMsg}
                            </div>
                        )}
                    </div>
                </div>
           </div>

           {/* Termux Toolbox */}
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
               <div className="flex items-center gap-2 text-slate-700 font-medium mb-3">
                   <Wrench size={18} />
                   <h3>Termux 维护工具箱</h3>
               </div>

               <div className="space-y-3">
                   {/* Uninstall */}
                   <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                       <div className="flex items-center gap-2 text-red-800 text-xs font-bold mb-1">
                           <Trash2 size={12} /> 彻底卸载/重置
                       </div>
                       <button 
                            onClick={() => copyCommand('cd ~ && rm -rf english_learner && echo "✅ 卸载完成"')}
                            className="w-full flex items-center justify-between bg-white border border-red-200 hover:bg-red-100 text-red-600 text-xs px-3 py-2 rounded transition-colors"
                        >
                            <span className="flex items-center gap-2">一键删除程序</span>
                            <Copy size={12} />
                        </button>
                   </div>
               </div>
           </div>
      </div>
  );

  const renderAITab = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
           {/* API Connection */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-indigo-700 font-medium mb-3">
                    <div className="flex items-center gap-2">
                        <Server size={18} />
                        <h3>AI 连接配置</h3>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">API 密钥</label>
                        <input type="password" placeholder="sk-..." value={settings.apiKey || ''} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">代理地址</label>
                        <input type="text" placeholder="https://..." value={settings.baseUrl} onChange={(e) => handleChange('baseUrl', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button onClick={handleTestConnection} disabled={isTesting || !settings.apiKey} className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-slate-200 disabled:opacity-50 text-xs font-medium flex items-center gap-2 transition-colors">
                            {isTesting ? <RefreshCw size={14} className="animate-spin"/> : <Server size={14} />}
                            测试连接
                        </button>
                        {testStatus !== 'none' && (
                            <span className={`text-xs flex items-center gap-1 font-medium ${testStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {testStatus === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {testStatus === 'success' ? '连接成功' : '失败'}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">对话模型</label>
                            <select value={settings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs bg-white">
                                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">工具模型</label>
                            <select value={settings.vocabularyModel || "gemini-1.5-flash"} onChange={(e) => handleChange('vocabularyModel', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs bg-white">
                                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                                {availableModels.map(m => <option key={`vocab-${m}`} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Voice Settings */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-700 font-medium mb-3">
                    <Mic size={18} />
                    <h3>语音设置</h3>
                </div>
                
                <div 
                    onClick={() => handleChange('useEdgeTTS', !settings.useEdgeTTS)}
                    className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors mb-3 ${settings.useEdgeTTS ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}
                >
                    <div className={`w-8 h-5 rounded-full p-0.5 transition-colors mr-3 flex-shrink-0 ${settings.useEdgeTTS ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.useEdgeTTS ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                             微软 Edge 语音
                             {settings.useEdgeTTS ? <Wifi size={12} className="text-green-500"/> : <WifiOff size={12} className="text-slate-400"/>}
                        </span>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">选择语音</label>
                    <select value={settings.voiceName} onChange={(e) => handleChange('voiceName', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-sm">
                        <option value="">-- 默认 --</option>
                        {voiceList.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary AI */}
            <div className="pt-2">
                <button className="text-xs font-medium text-slate-500 flex items-center gap-1 hover:text-indigo-600" onClick={() => setShowSummarySettings(!showSummarySettings)}>
                    <SettingsIcon size={12} /> {showSummarySettings ? "隐藏独立摘要 AI" : "配置独立摘要 AI"}
                </button>

                {showSummarySettings && (
                    <div className="mt-2 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">摘要 API Key</label>
                            <input type="password" value={settings.summaryApiKey || ''} onChange={(e) => handleChange('summaryApiKey', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none" />
                        </div>
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">摘要 Base URL</label>
                            <input type="text" value={settings.summaryBaseUrl || ''} onChange={(e) => handleChange('summaryBaseUrl', e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none" />
                        </div>
                    </div>
                )}
            </div>
      </div>
  );

  const renderPersonaTab = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
           {/* Greeting */}
           <div className="space-y-1">
                <label className="block text-xs font-bold text-indigo-700">初始问候语</label>
                <textarea className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-20 resize-none shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="例如: Hello! How are you today?" value={settings.initialGreeting} onChange={(e) => handleChange('initialGreeting', e.target.value)} />
            </div>

            {/* Persona */}
            <div className="space-y-1">
                <label className="block text-xs font-bold text-indigo-700">系统人设 (Prompt)</label>
                <textarea className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-32 resize-none shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="定义 AI 的性格、角色..." value={settings.systemPersona} onChange={(e) => handleChange('systemPersona', e.target.value)} />
            </div>

            {/* Long Term Memory */}
            <div className="space-y-1">
                 <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-indigo-700 flex items-center gap-1">
                        <Brain size={12} /> 长期记忆/用户背景
                    </label>
                    <span className="text-[10px] text-slate-400">注入到 Prompt 中</span>
                 </div>
                 <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 mb-1 text-[10px] text-amber-800">
                     在此记录你的职业、兴趣或学习目标，AI 会记住并用于对话中。
                 </div>
                <textarea className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-32 resize-none shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="例如: 我是程序员，想学习商务英语..." value={settings.longTermMemory || ''} onChange={(e) => handleChange('longTermMemory', e.target.value)} />
            </div>
            
            <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 mb-1">难度等级</label>
                <select value={settings.level} onChange={(e) => handleChange('level', e.target.value as EnglishLevel)} className="w-full p-2 rounded border border-slate-300 text-sm">
                    {Object.values(EnglishLevel).map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                </select>
            </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[95%] sm:w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white shrink-0">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <SettingsIcon size={20} /> 设置
          </h2>
          <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Area - Split View */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {renderSidebar()}
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                {activeTab === 'system' && renderSystemTab()}
                {activeTab === 'ai' && renderAITab()}
                {activeTab === 'persona' && renderPersonaTab()}
            </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end shrink-0 bg-white">
            <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                完成
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;