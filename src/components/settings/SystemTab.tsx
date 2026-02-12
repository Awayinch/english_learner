import React, { useState, useRef, useEffect } from 'react';
import { Smartphone, Github, Loader2, Sparkles, Terminal, Copy, CheckCircle, Save, FolderOpen, Cloud, UploadCloud, DownloadCloud, AlertCircle, CheckSquare, Square, Wrench, Trash2, ExternalLink, Download } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Settings, VocabularyItem, ChatMessage, ChatSession, Character } from '../../types';
import { syncToGithub, loadFromGithub } from '../../services/githubService';

// We import metadata for the local version
const APP_VERSION = "1.0.13"; 

interface BackupData {
    version: number;
    date: string;
    settings: Settings;
    vocabulary: VocabularyItem[];
    sessions?: ChatSession[];
    characters?: Character[]; // Updated backup structure
}

interface RestoreSelection {
    connection: boolean;
    history: boolean;
    vocabulary: boolean;
    memory: boolean;
    persona: boolean;
}

const SystemTab: React.FC = () => {
    const { 
        settings, 
        setSettings, 
        vocabulary, 
        setVocabulary, 
        sessions, 
        setSessions,
        characters,
        setCharacters
    } = useStore();

    // Update Check State
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate' | 'error'>('idle');
    const [remoteVersion, setRemoteVersion] = useState('');
    const [checkedRepo, setCheckedRepo] = useState('');

    // Cloud/Local File State
    const [isCloudLoading, setIsCloudLoading] = useState(false);
    const [cloudStatus, setCloudStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [cloudMsg, setCloudMsg] = useState('');
    const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    
    const [restoreSelection, setRestoreSelection] = useState<RestoreSelection>({
        connection: true,
        history: true,
        vocabulary: true,
        memory: true,
        persona: true
    });

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    // --- Update Checker ---
    const handleCheckForUpdates = async () => {
        setUpdateStatus('checking');
        const officialRepo = "Awayinch/english_learner";
        let targetRepo = officialRepo;
        if (settings.githubRepo && typeof settings.githubRepo === 'string' && settings.githubRepo.includes("/")) {
            targetRepo = settings.githubRepo;
        }
        setCheckedRepo(targetRepo);

        const tryFetchMetadata = async (repo: string) => {
            const timestamp = Date.now();
            const fetchOptions = { cache: 'no-store' as RequestCache };
            try {
                const cdnUrl = `https://cdn.jsdelivr.net/gh/${repo}@main/metadata.json?t=${timestamp}`;
                const res = await fetch(cdnUrl, fetchOptions);
                if (res.ok) return await res.json();
            } catch (e) {}
            try {
                const rawUrl = `https://raw.githubusercontent.com/${repo}/main/metadata.json?t=${timestamp}`;
                const res = await fetch(rawUrl, fetchOptions);
                if (res.ok) return await res.json();
            } catch (e) {}
            return null;
        };

        try {
            let remoteMeta = await tryFetchMetadata(targetRepo);
            if (!remoteMeta && targetRepo !== officialRepo) {
                remoteMeta = await tryFetchMetadata(officialRepo);
                if (remoteMeta) setCheckedRepo(officialRepo); 
            }

            if (remoteMeta && remoteMeta.version) {
                setRemoteVersion(remoteMeta.version);
                if (compareVersions(remoteMeta.version, APP_VERSION) > 0) {
                    setUpdateStatus('available');
                } else {
                    setUpdateStatus('uptodate');
                }
            } else {
                throw new Error("无法获取版本信息");
            }
        } catch (e) {
            setUpdateStatus('error');
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

    // --- Backup & Restore Logic ---
    const handleExportLocal = () => {
        const backupData: BackupData = {
            version: 3,
            date: new Date().toISOString(),
            settings: settings,
            vocabulary: vocabulary || [],
            sessions: sessions || [],
            characters: characters || []
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
                const data = JSON.parse(event.target?.result as string);
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
        e.target.value = '';
    };

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
            const data = JSON.parse(jsonStr);
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
                version: 3,
                date: new Date().toISOString(),
                settings: settings,
                vocabulary: vocabulary || [],
                sessions: sessions || [],
                characters: characters || []
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
                next.vocabularyModel = bSettings.vocabularyModel || next.vocabularyModel;
                next.summaryApiKey = bSettings.summaryApiKey || next.summaryApiKey;
                next.summaryBaseUrl = bSettings.summaryBaseUrl || next.summaryBaseUrl;
                next.summaryModel = bSettings.summaryModel || next.summaryModel;
            }
            if (memory) next.longTermMemory = bSettings.longTermMemory || "";
            // Legacy persona restore logic if characters array doesn't exist
            if (persona && !backupPreview.characters) {
                next.systemPersona = bSettings.systemPersona || next.systemPersona;
                next.initialGreeting = bSettings.initialGreeting || next.initialGreeting;
                next.voiceName = bSettings.voiceName || next.voiceName;
            }
            if (persona) {
                next.level = bSettings.level || next.level;
                next.useEdgeTTS = bSettings.useEdgeTTS ?? next.useEdgeTTS;
            }
            return next;
        });

        if (restoreVocab && backupPreview.vocabulary) setVocabulary(backupPreview.vocabulary);
        
        if (persona && backupPreview.characters) {
            setCharacters(backupPreview.characters);
        }

        if (history) {
            if (backupPreview.sessions) {
                setSessions(backupPreview.sessions);
            }
        }

        setCloudStatus('success');
        setCloudMsg('导入成功!');
        setTimeout(() => setBackupPreview(null), 1500);
    };

    const toggleSelection = (key: keyof RestoreSelection) => {
        setRestoreSelection(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
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

                {deferredPrompt && (
                    <button 
                        onClick={handleInstallClick}
                        className="w-full mt-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse"
                    >
                        <Download size={14} /> 安装到桌面 (PWA)
                    </button>
                )}

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
                    <Save size={18} />
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
                            <input type="password" placeholder="Token (ghp_...)" value={settings.githubToken || ''} onChange={(e) => setSettings(p => ({...p, githubToken: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none" />
                            <div className="flex gap-2">
                                <input type="text" placeholder="user/repo" value={settings.githubRepo || ''} onChange={(e) => setSettings(p => ({...p, githubRepo: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none flex-1" />
                                <input type="text" placeholder="Path/" value={settings.githubPath || ''} onChange={(e) => setSettings(p => ({...p, githubPath: e.target.value}))} className="w-full p-2 rounded border border-slate-300 text-xs font-mono outline-none flex-1" />
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
};

export default SystemTab;