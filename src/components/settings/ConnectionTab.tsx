import React, { useState, useEffect } from 'react';
import { Server, RefreshCw, CheckCircle, AlertCircle, Mic, Wifi, WifiOff, Settings as SettingsIcon, Gauge } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getAvailableModels } from '../../services/geminiService';
import { loadVoices, AppVoice } from '../../utils/ttsUtils';

const ConnectionTab: React.FC = () => {
    const { settings, setSettings } = useStore();
    
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'none' | 'success' | 'error'>('none');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [voiceList, setVoiceList] = useState<AppVoice[]>([]);
    const [showSummarySettings, setShowSummarySettings] = useState(
        !!settings.summaryApiKey || !!settings.summaryBaseUrl || !!settings.summaryModel
    );

    // Initial Data Load
    useEffect(() => {
        // Load Voices
        loadVoices(settings.useEdgeTTS).then(voices => {
            setVoiceList(voices);
            if (settings.voiceName && !voices.some(v => v.id === settings.voiceName)) {
                 const defaultVoice = voices.find(v => v.id.includes("Guy") || v.lang === 'en-US');
                 if (defaultVoice) setSettings(p => ({...p, voiceName: defaultVoice.id}));
                 else if (voices.length > 0) setSettings(p => ({...p, voiceName: voices[0].id}));
            }
        });

        // Pre-fill model list if already selected
        if (settings.selectedModel) {
            setAvailableModels(prev => prev.includes(settings.selectedModel) ? prev : [...prev, settings.selectedModel]);
        }
    }, [settings.useEdgeTTS, settings.selectedModel, setSettings]);

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestStatus('none');
        
        try {
            const models = await getAvailableModels(settings);
            setAvailableModels(models);
            setTestStatus('success');
            
            if (!settings.selectedModel || !models.includes(settings.selectedModel)) {
               const preferred = models.find(m => m.includes('gemini-1.5-flash')) || 
                                 models.find(m => m.includes('gemini-3-flash')) || 
                                 models[0];
               if (preferred) {
                   setSettings(p => ({...p, selectedModel: preferred}));
               }
            }
        } catch (error: any) {
            setTestStatus('error');
            setAvailableModels([]);
        } finally {
            setIsTesting(false);
        }
    };

    return (
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
                        <input type="password" placeholder="sk-..." value={settings.apiKey || ''} onChange={(e) => setSettings(p => ({...p, apiKey: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">代理地址</label>
                        <input type="text" placeholder="https://..." value={settings.baseUrl} onChange={(e) => setSettings(p => ({...p, baseUrl: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
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
                            <select value={settings.selectedModel} onChange={(e) => setSettings(p => ({...p, selectedModel: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-xs bg-white">
                                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">工具模型</label>
                            <select value={settings.vocabularyModel || "gemini-1.5-flash"} onChange={(e) => setSettings(p => ({...p, vocabularyModel: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-xs bg-white">
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
                    onClick={() => setSettings(p => ({...p, useEdgeTTS: !p.useEdgeTTS}))}
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

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">选择语音 (全局默认)</label>
                        <select value={settings.voiceName} onChange={(e) => setSettings(p => ({...p, voiceName: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-sm">
                            <option value="">-- 默认 --</option>
                            {voiceList.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Rate and Pitch Sliders */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Gauge size={12}/> 语速</label>
                                <span className="text-xs text-indigo-600 font-mono">{settings.ttsRate > 0 ? `+${settings.ttsRate}%` : `${settings.ttsRate || 0}%`}</span>
                             </div>
                             <input 
                                type="range" 
                                min="-50" 
                                max="50" 
                                step="5"
                                value={settings.ttsRate || 0} 
                                onChange={(e) => setSettings(p => ({...p, ttsRate: parseInt(e.target.value)}))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                             />
                        </div>
                        <div>
                             <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Gauge size={12}/> 语调</label>
                                <span className="text-xs text-indigo-600 font-mono">{settings.ttsPitch > 0 ? `+${settings.ttsPitch}Hz` : `${settings.ttsPitch || 0}Hz`}</span>
                             </div>
                             <input 
                                type="range" 
                                min="-20" 
                                max="20" 
                                step="2"
                                value={settings.ttsPitch || 0} 
                                onChange={(e) => setSettings(p => ({...p, ttsPitch: parseInt(e.target.value)}))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                             />
                        </div>
                    </div>
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
                            <input type="password" value={settings.summaryApiKey || ''} onChange={(e) => setSettings(p => ({...p, summaryApiKey: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none" />
                        </div>
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">摘要 Base URL</label>
                            <input type="text" value={settings.summaryBaseUrl || ''} onChange={(e) => setSettings(p => ({...p, summaryBaseUrl: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionTab;