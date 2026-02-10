import React, { useEffect, useState } from 'react';
import { Settings, EnglishLevel } from '../types';
import { X, UserCog, Settings as SettingsIcon, Server, Mic, CheckCircle, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { loadVoices } from '../utils/ttsUtils';
import { getAvailableModels } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
}) => {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'none' | 'success' | 'error'>('none');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
        loadVoices().then(voices => {
            const enVoices = voices.filter(v => v.lang.startsWith('en'));
            setBrowserVoices(enVoices.length > 0 ? enVoices : voices);
        });
        // Pre-populate models if we have them in state (optional, or just rely on fetch)
        if (settings.selectedModel) {
            setAvailableModels(prev => prev.includes(settings.selectedModel) ? prev : [...prev, settings.selectedModel]);
        }
    }
  }, [isOpen, settings.selectedModel]);

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
          setTestMessage(`Connected! Found ${models.length} models.`);
          
          // If current model is invalid or empty, default to a preferred model
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

           {/* API Settings */}
           <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-indigo-700 font-medium">
                    <div className="flex items-center gap-2">
                        <Server size={18} />
                        <h3>API Connection & Model</h3>
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
                        <p className="text-[10px] text-slate-400 mt-1">If using a proxy (e.g., OneAPI), enter the root URL (e.g. https://api.openai.com). We will auto-detect /v1/models.</p>
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
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Select Model</label>
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
                            <p className="text-xs text-slate-400 mt-1">If your model isn't listed, use 'Test Connection' to fetch the latest list.</p>
                        </div>
                    </div>
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