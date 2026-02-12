import React, { useState, useRef } from 'react';
import { VocabularyItem, EnglishLevel, Settings, ChatMessage, ChatSession } from '../types';
import { BookOpen, Plus, Trash2, X, Upload, Sparkles, Download, StopCircle, Cloud, Loader2, CheckCircle, AlertCircle, Search, Server, ListPlus, Play, MessageSquare, MessageSquarePlus, ChevronDown, ChevronRight, History, Edit2, Check, CheckSquare, Square, ListChecks } from 'lucide-react';
import { processVocabularyFromText, generateObsidianSummary, defineVocabularyBatch } from '../services/geminiService';
import { syncToGithub } from '../services/githubService';

interface VocabularyPanelProps {
  vocabulary: VocabularyItem[];
  setVocabulary: React.Dispatch<React.SetStateAction<VocabularyItem[]>>;
  level: EnglishLevel;
  setLevel: (level: EnglishLevel) => void;
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  messages: ChatMessage[]; 
  className?: string;
  pendingWords: string[];
  setPendingWords: React.Dispatch<React.SetStateAction<string[]>>;
  
  // New Session Props
  sessions: ChatSession[];
  currentSessionId: string;
  onSwitchSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onDeleteSessions: (ids: string[]) => void;
  onClearSessions: () => void;
}

const VocabularyPanel: React.FC<VocabularyPanelProps> = ({
  vocabulary,
  setVocabulary,
  level,
  setLevel,
  isOpen,
  onClose,
  settings,
  messages,
  className = "",
  pendingWords,
  setPendingWords,
  sessions,
  currentSessionId,
  onSwitchSession,
  onRenameSession,
  onNewChat,
  onDeleteSession,
  onDeleteSessions,
  onClearSessions
}) => {
  // Accordion State
  const [activeSection, setActiveSection] = useState<'chats' | 'vocab'>('chats');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const [newWord, setNewWord] = useState('');
  const [newDef, setNewDef] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Session Editing State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  // Batch Selection State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  
  // AI Import State
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImportMode, setIsImportMode] = useState(false);
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  
  // Progress State
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter Logic
  const filteredVocabulary = vocabulary.filter(item => 
    item.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddWord = () => {
    if (newWord && newDef) {
      const newItem: VocabularyItem = {
        id: Date.now().toString(),
        word: newWord.trim(),
        definition: newDef.trim(),
        partOfSpeech: 'custom'
      };
      // Prepend to show at top
      setVocabulary([newItem, ...vocabulary]);
      setNewWord('');
      setNewDef('');
      setIsAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    setVocabulary(vocabulary.filter(v => v.id !== id));
  };
  
  const handleClearVocabulary = () => {
    if (confirm("确定要清空所有单词本吗？此操作无法撤销。")) {
        setVocabulary([]);
    }
  };

  const handleRemovePending = (word: string) => {
      setPendingWords(prev => prev.filter(w => w !== word));
  }

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setStatusLog(prev => [...prev, "🛑 用户取消操作。"]);
        setIsProcessing(false);
    }
  };
  
  const startEditingSession = (session: ChatSession) => {
      setEditingSessionId(session.id);
      setEditTitle(session.title);
  };
  
  const saveEditingSession = () => {
      if (editingSessionId) {
          onRenameSession(editingSessionId, editTitle);
          setEditingSessionId(null);
          setEditTitle('');
      }
  };
  
  const cancelEditingSession = () => {
      setEditingSessionId(null);
      setEditTitle('');
  };
  
  // Batch Mode Handlers
  const toggleSessionSelection = (id: string) => {
      const newSet = new Set(selectedSessionIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedSessionIds(newSet);
  };
  
  const toggleSelectAll = () => {
    if (selectedSessionIds.size === sessions.length) {
        setSelectedSessionIds(new Set());
    } else {
        setSelectedSessionIds(new Set(sessions.map(s => s.id)));
    }
  };
  
  const executeBatchDelete = () => {
      if (selectedSessionIds.size === 0) return;
      if (confirm(`确定删除选中的 ${selectedSessionIds.size} 个对话吗？`)) {
          onDeleteSessions(Array.from(selectedSessionIds));
          setSelectedSessionIds(new Set());
          setIsBatchMode(false);
      }
  };

  const handleSyncToGithub = async () => {
    if (!settings.githubToken || !settings.githubRepo) {
        setSyncStatus('error');
        setSyncMsg("请先在设置中配置 GitHub。");
        setTimeout(() => setSyncStatus('idle'), 3000);
        return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    try {
        const history = messages.map(m => ({ role: m.role, text: m.text }));
        const markdown = await generateObsidianSummary(history, vocabulary, settings);
        
        const dateStr = new Date().toISOString().split('T')[0];
        const contentWithHeader = `\n---\n## Session: ${new Date().toLocaleTimeString()}\n\n${markdown}\n`;
        
        const filename = `${dateStr}.md`; 
        await syncToGithub(settings, filename, contentWithHeader);

        setSyncStatus('success');
        setSyncMsg("已同步至 Obsidian!");
    } catch (e: any) {
        setSyncStatus('error');
        setSyncMsg(e.message || "同步失败");
    } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // --- Process Pending Queue ---
  const handleProcessPending = async () => {
      if (pendingWords.length === 0) return;
      if (!settings.apiKey && !process.env.API_KEY) {
        alert("请先在设置中配置 API Key。");
        return;
      }

      setIsProcessing(true);
      setStatusLog(["🚀 正在处理待查队列...", `📡 使用通道: ${settings.baseUrl ? '代理' : '官方 API'}`]);
      
      abortControllerRef.current = new AbortController();
      
      try {
          // Batch processing
          const items = await defineVocabularyBatch(pendingWords, settings, abortControllerRef.current.signal);
          if (items.length > 0) {
              setVocabulary(prev => [...prev, ...items]);
              setStatusLog(prev => [...prev, `✅ 已添加 ${items.length} 个单词。`]);
              setPendingWords([]); // Clear queue on success
          } else {
              setStatusLog(prev => [...prev, `⚠️ 未找到有效定义。`]);
          }
      } catch (err: any) {
          if (!err.message.includes('Aborted')) {
             setStatusLog(prev => [...prev, `❌ 错误: ${err.message}`]);
          }
      } finally {
          setIsProcessing(false);
          abortControllerRef.current = null;
          setTimeout(() => setStatusLog([]), 4000);
      }
  };

  // --- Process Text Block Import ---
  const handleAiProcess = async () => {
    if (!importText.trim()) return;
    
    if (!settings.apiKey && !process.env.API_KEY) {
        alert("请先在设置中配置 API Key。");
        return;
    }

    setIsProcessing(true);
    setStatusLog(["🚀 开始批量处理...", `📡 使用通道: ${settings.baseUrl ? '代理/自定义 URL' : '官方 Google API'}`]);
    
    const lines = importText.split('\n').filter(l => l.trim().length > 0);
    const BATCH_SIZE = 15; 
    const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
    
    setProgress({ current: 0, total: totalBatches });
    abortControllerRef.current = new AbortController();

    try {
        let addedCount = 0;
        
        for (let i = 0; i < lines.length; i += BATCH_SIZE) {
            const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
            const chunk = lines.slice(i, i + BATCH_SIZE).join('\n');
            
            setStatusLog(prev => [...prev, `⏳ 正在处理第 ${batchIndex}/${totalBatches} 批...`]);
            
            try {
                // This function respects settings.baseUrl (Proxy) internally
                const items = await processVocabularyFromText(chunk, settings, abortControllerRef.current.signal);
                if (items.length > 0) {
                    setVocabulary(prev => [...prev, ...items]);
                    addedCount += items.length;
                    setStatusLog(prev => [...prev, `✅ 第 ${batchIndex} 批: 发现 ${items.length} 个单词。`]);
                } else {
                     setStatusLog(prev => [...prev, `⚠️ 第 ${batchIndex} 批: 未发现生词。`]);
                }
            } catch (err: any) {
                if (err.message.includes('cancelled') || err.message.includes('Aborted')) {
                    throw err; 
                }
                setStatusLog(prev => [...prev, `❌ 第 ${batchIndex} 批错误: ${err.message}`]);
            }
            
            setProgress({ current: batchIndex, total: totalBatches });
        }
        
        setStatusLog(prev => [...prev, `🎉 完成! 共添加 ${addedCount} 个单词。`]);
        setImportText('');
    } catch (e: any) {
        if (e.message.includes('cancelled') || e.message.includes('Aborted')) {
        } else {
             setStatusLog(prev => [...prev, `❌ 系统错误: ${e.message}`]);
        }
    } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
    }
  };

  const handleExport = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vocabulary, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "vocabulary_lingoleap.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col w-[85vw] sm:w-80 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${className}`}
    >
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white shrink-0">
        <h2 className="font-semibold text-lg flex items-center gap-2">
           LingoLeap
        </h2>
        <div className="flex gap-2">
            <button 
                onClick={handleSyncToGithub} 
                className={`p-1 rounded hover:bg-indigo-500 transition-colors relative ${!settings.githubToken ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="同步到 Obsidian (GitHub)"
                disabled={isSyncing || !settings.githubToken}
            >
                {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Cloud size={20} />}
            </button>
            <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded">
                <X size={20} />
            </button>
        </div>
      </div>

      {syncStatus !== 'idle' && (
          <div className={`text-xs px-4 py-2 font-medium flex items-center gap-2 ${syncStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {syncStatus === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
              {syncMsg}
          </div>
      )}

      {/* ACCORDION: CHAT HISTORY */}
      <div className="border-b border-slate-200 flex-shrink-0">
          <button 
            onClick={() => setActiveSection(activeSection === 'chats' ? 'vocab' : 'chats')}
            className={`w-full flex items-center justify-between p-4 font-bold text-sm ${activeSection === 'chats' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
              <div className="flex items-center gap-2">
                  <History size={18} /> 历史对话
              </div>
              {activeSection === 'chats' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {activeSection === 'chats' && (
              <div className="bg-slate-50 pb-2 max-h-[40vh] overflow-y-auto animate-in slide-in-from-top-2">
                  <div className="p-2 space-y-2 sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                    <div className="flex gap-2">
                        <button 
                            onClick={onNewChat}
                            disabled={isBatchMode}
                            className={`flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-sm ${isBatchMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                        >
                            <MessageSquarePlus size={16} /> 新开对话
                        </button>
                         <button 
                            onClick={() => {
                                setIsBatchMode(!isBatchMode);
                                setSelectedSessionIds(new Set());
                            }}
                            className={`px-3 rounded-lg border flex items-center justify-center transition-colors ${isBatchMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600'}`}
                            title="批量管理"
                        >
                            <ListChecks size={18} />
                        </button>
                    </div>
                     {isBatchMode && (
                         <div className="flex justify-between items-center px-1 text-xs text-slate-500 animate-in slide-in-from-top-1">
                            <span>已选: {selectedSessionIds.size}</span>
                            <button onClick={toggleSelectAll} className="text-indigo-600 hover:underline">
                                {selectedSessionIds.size === sessions.length ? '取消全选' : '全选'}
                            </button>
                         </div>
                    )}
                  </div>
                  
                  <div className="px-2 space-y-1 mt-1">
                      {sessions.map(session => (
                        <div key={session.id}>
                          {editingSessionId === session.id ? (
                                <div className="p-2 flex items-center gap-2 bg-white rounded-lg border border-indigo-300 shadow-sm mx-1">
                                    <input
                                        autoFocus
                                        className="flex-1 min-w-0 text-sm outline-none text-indigo-700 bg-transparent"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEditingSession();
                                            if (e.key === 'Escape') cancelEditingSession();
                                            e.stopPropagation();
                                        }}
                                    />
                                    <button onClick={(e) => { e.stopPropagation(); saveEditingSession(); }} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={14}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); cancelEditingSession(); }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded"><X size={14}/></button>
                                </div>
                          ) : (
                            <div 
                                className={`group flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer border transition-all ${
                                    currentSessionId === session.id && !isBatchMode
                                    ? 'bg-white border-indigo-200 shadow-sm text-indigo-700 font-medium' 
                                    : 'bg-transparent border-transparent hover:bg-slate-200 text-slate-600'
                                }`}
                                onClick={() => {
                                    if (isBatchMode) {
                                        toggleSessionSelection(session.id);
                                    } else {
                                        onSwitchSession(session.id);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 overflow-hidden w-full">
                                    {isBatchMode ? (
                                        <div className={`shrink-0 ${selectedSessionIds.has(session.id) ? 'text-indigo-600' : 'text-slate-300'}`}>
                                            {selectedSessionIds.has(session.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </div>
                                    ) : (
                                        <MessageSquare size={14} className="flex-shrink-0 opacity-70"/>
                                    )}
                                    <span className={`truncate ${isBatchMode && selectedSessionIds.has(session.id) ? 'text-indigo-700 font-medium' : ''}`}>{session.title}</span>
                                </div>
                                {!isBatchMode && (
                                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startEditingSession(session); }}
                                            className="text-slate-400 hover:text-indigo-500 p-1"
                                            title="重命名"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                            className="text-slate-400 hover:text-red-500 p-1"
                                            title="删除"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {isBatchMode ? (
                    <div className="px-2 mt-4 pt-2 border-t border-slate-200 flex gap-2">
                        <button 
                            onClick={() => setIsBatchMode(false)}
                            className="flex-1 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50"
                        >
                            取消
                        </button>
                        <button 
                            onClick={executeBatchDelete}
                            disabled={selectedSessionIds.size === 0}
                            className="flex-[2] py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            <Trash2 size={12} /> 删除 ({selectedSessionIds.size})
                        </button>
                    </div>
                ) : (
                    sessions.length > 0 && (
                        <div className="px-2 mt-4 pt-2 border-t border-slate-200">
                             <button 
                                onClick={() => { if(confirm('确定删除所有历史记录吗？')) onClearSessions(); }}
                                className="w-full py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <Trash2 size={12} /> 清空所有对话
                            </button>
                        </div>
                    )
                  )}
              </div>
          )}
      </div>

      {/* ACCORDION: VOCABULARY */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
          <button 
            onClick={() => setActiveSection(activeSection === 'vocab' ? 'chats' : 'vocab')}
            className={`w-full flex items-center justify-between p-4 font-bold text-sm flex-shrink-0 border-b border-slate-200 ${activeSection === 'vocab' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
              <div className="flex items-center gap-2">
                  <BookOpen size={18} /> 生词本 ({vocabulary.length})
              </div>
              {activeSection === 'vocab' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        
        {activeSection === 'vocab' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-top-2">
            {/* Level Selector */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    当前难度
                </label>
                <select 
                    value={level} 
                    onChange={(e) => setLevel(e.target.value as EnglishLevel)}
                    className="w-full p-2 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    {Object.values(EnglishLevel).map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                </select>
            </div>

            {/* PENDING QUEUE SECTION */}
            {pendingWords.length > 0 && !isImportMode && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 shrink-0">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-2 uppercase tracking-wide">
                            <ListPlus size={14} /> 待查询队列 ({pendingWords.length})
                        </h3>
                        {isProcessing && <Loader2 size={14} className="animate-spin text-indigo-600"/>}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto">
                        {pendingWords.map(word => (
                            <span key={word} className="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                                {word}
                                <button onClick={() => handleRemovePending(word)} className="text-indigo-300 hover:text-red-500"><X size={12}/></button>
                            </span>
                        ))}
                    </div>
                    
                    {isProcessing && (
                            <div className="w-full bg-indigo-200 rounded-full h-1.5 mb-2 overflow-hidden">
                            <div className="bg-indigo-600 h-full w-full animate-pulse"></div>
                        </div>
                    )}

                    <div className="flex gap-2">
                            <button 
                            onClick={() => setPendingWords([])}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded text-xs font-medium hover:text-red-600 hover:border-red-200"
                            disabled={isProcessing}
                        >
                            清空
                        </button>
                        <button 
                            onClick={handleProcessPending}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2"
                            disabled={isProcessing}
                        >
                            {isProcessing ? '处理中...' : '开始批量查询'} <Play size={10} fill="currentColor"/>
                        </button>
                    </div>
                    {statusLog.length > 0 && isProcessing && (
                            <div className="mt-2 text-[10px] text-indigo-600 font-mono">
                            {statusLog[statusLog.length - 1]}
                            </div>
                    )}
                </div>
            )}

            {isImportMode ? (
                <div className="flex-1 p-4 flex flex-col gap-3 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Sparkles size={16} className="text-indigo-600"/> 
                            AI 智能导入
                        </h3>
                        <button 
                            onClick={() => setIsImportMode(false)}
                            disabled={isProcessing}
                            className="text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50"
                        >
                            返回列表
                        </button>
                    </div>
                    
                    {isProcessing ? (
                        <div className="flex-1 flex flex-col gap-4">
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                                <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                                    <span>进度</span>
                                    <span>{progress.current} / {progress.total} 批</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                                    <div 
                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                                    ></div>
                                </div>
                                <button 
                                    onClick={handleStopProcessing}
                                    className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center justify-center gap-2"
                                >
                                    <StopCircle size={16} /> 停止导入
                                </button>
                            </div>
                            <div className="flex-1 bg-black/80 rounded-lg p-3 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
                                {statusLog.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                                <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-xs text-slate-500 space-y-1">
                                <p>粘贴任意文本。我们会分批提取生词。</p>
                                <p className="text-indigo-600 flex items-center gap-1">
                                    <Server size={10} /> 
                                    使用: {settings.baseUrl ? '自定义代理 (Configured)' : '官方 Google API'}
                                </p>
                            </div>
                            <textarea
                                className="flex-1 w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-200 outline-none text-sm resize-none"
                                placeholder="例如: 在这里粘贴一整篇文章..."
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleAiProcess}
                                    disabled={!importText.trim()}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex justify-center items-center gap-2"
                                >
                                    <Sparkles size={16} /> 开始处理
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-0">
                    <div className="sticky top-0 bg-slate-50 pt-4 pb-2 z-10">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-semibold text-slate-700">词汇列表</h3>
                            <div className="flex gap-1">
                                <button onClick={() => setIsImportMode(true)} title="AI 智能导入" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                    <Upload size={16} />
                                </button>
                                <button onClick={handleExport} title="导出 JSON" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Search Input (Sticky Context) */}
                        <div className="relative shadow-sm rounded-lg">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={14} className="text-slate-400" />
                            </div>
                            <input 
                                type="text"
                                placeholder="搜索单词..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white transition-colors"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Manual Add Button/Form - Moved Here */}
                    {isAdding ? (
                    <div className="bg-white p-3 rounded-lg border-2 border-indigo-100 animate-in fade-in slide-in-from-top-2">
                        <input
                        autoFocus
                        className="w-full mb-2 p-1 border-b border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium"
                        placeholder="单词"
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        />
                        <input
                        className="w-full mb-2 p-1 border-b border-slate-200 focus:border-indigo-500 outline-none text-sm"
                        placeholder="定义"
                        value={newDef}
                        onChange={(e) => setNewDef(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end mt-2">
                            <button 
                                onClick={() => setIsAdding(false)}
                                className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleAddWord}
                                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                                添加
                            </button>
                        </div>
                    </div>
                    ) : (
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-2 text-sm transition-all"
                        >
                            <Plus size={16} /> 手动添加
                        </button>
                    )}
                    
                    {vocabulary.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            暂无单词。试试 AI 导入!
                        </div>
                    )}
                    
                    {vocabulary.length > 0 && filteredVocabulary.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            未找到匹配的单词。
                        </div>
                    )}

                    {filteredVocabulary.map((item) => (
                    <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 group hover:border-indigo-300 transition-colors relative">
                        <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-slate-800">{item.word}</p>
                            <p className="text-xs text-slate-500 italic">{item.partOfSpeech}</p>
                        </div>
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="text-slate-300 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{item.definition}</p>
                    </div>
                    ))}
                    
                    {vocabulary.length > 0 && (
                        <div className="pt-4 border-t border-slate-200">
                             <button 
                                onClick={handleClearVocabulary}
                                className="w-full py-2 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <Trash2 size={12} /> 清空所有单词
                            </button>
                        </div>
                    )}
                </div>
            )}
            </div>
          )}
      </div>
    </div>
  );
};

export default VocabularyPanel;