import React, { useState, useRef } from 'react';
import { Search, X, Upload, Download, Plus, Trash2, ListPlus, Loader2, Play } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { EnglishLevel, VocabularyItem } from '../../types';
import { defineVocabularyBatch } from '../../services/geminiService';

interface WordListProps {
  onOpenImport: () => void;
}

const WordList: React.FC<WordListProps> = ({ onOpenImport }) => {
    const { 
        vocabulary, 
        setVocabulary, 
        pendingWords, 
        setPendingWords, 
        settings, 
        setSettings,
        addVocabularyItem
    } = useStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [newWord, setNewWord] = useState('');
    const [newDef, setNewDef] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    
    // Pending Queue State
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    const [queueLog, setQueueLog] = useState<string[]>([]);
    const abortQueueRef = useRef<AbortController | null>(null);

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
            addVocabularyItem(newItem);
            setNewWord('');
            setNewDef('');
            setIsAdding(false);
        }
    };

    const handleDelete = (id: string) => {
        setVocabulary(prev => prev.filter(v => v.id !== id));
    };

    const handleClearVocabulary = () => {
        if (confirm("确定要清空所有单词本吗？此操作无法撤销。")) {
            setVocabulary([]);
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

    // --- Queue Logic ---
    const handleRemovePending = (word: string) => {
        setPendingWords(prev => prev.filter(w => w !== word));
    };

    const handleProcessPending = async () => {
        if (pendingWords.length === 0) return;
        if (!settings.apiKey && !process.env.API_KEY) {
            alert("请先在设置中配置 API Key。");
            return;
        }

        setIsProcessingQueue(true);
        setQueueLog(["🚀 正在处理待查队列...", `📡 使用通道: ${settings.baseUrl ? '代理' : '官方 API'}`]);
        
        abortQueueRef.current = new AbortController();
        
        try {
            const items = await defineVocabularyBatch(pendingWords, settings, abortQueueRef.current.signal);
            if (items.length > 0) {
                setVocabulary(prev => [...prev, ...items]);
                setQueueLog(prev => [...prev, `✅ 已添加 ${items.length} 个单词。`]);
                setPendingWords([]); 
            } else {
                setQueueLog(prev => [...prev, `⚠️ 未找到有效定义。`]);
            }
        } catch (err: any) {
            if (!err.message.includes('Aborted')) {
                setQueueLog(prev => [...prev, `❌ 错误: ${err.message}`]);
            }
        } finally {
            setIsProcessingQueue(false);
            abortQueueRef.current = null;
            setTimeout(() => setQueueLog([]), 4000);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-top-2">
            {/* Level Selector */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    当前难度
                </label>
                <select 
                    value={settings.level} 
                    onChange={(e) => setSettings(prev => ({...prev, level: e.target.value as EnglishLevel}))}
                    className="w-full p-2 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    {Object.values(EnglishLevel).map((lvl) => (
                        <option key={lvl as string} value={lvl as string}>{lvl as string}</option>
                    ))}
                </select>
            </div>

            {/* PENDING QUEUE SECTION */}
            {pendingWords.length > 0 && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 shrink-0">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-2 uppercase tracking-wide">
                            <ListPlus size={14} /> 待查询队列 ({pendingWords.length})
                        </h3>
                        {isProcessingQueue && <Loader2 size={14} className="animate-spin text-indigo-600"/>}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto">
                        {pendingWords.map(word => (
                            <span key={word} className="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                                {word}
                                <button onClick={() => handleRemovePending(word)} className="text-indigo-300 hover:text-red-500"><X size={12}/></button>
                            </span>
                        ))}
                    </div>
                    
                    {isProcessingQueue && (
                            <div className="w-full bg-indigo-200 rounded-full h-1.5 mb-2 overflow-hidden">
                            <div className="bg-indigo-600 h-full w-full animate-pulse"></div>
                        </div>
                    )}

                    <div className="flex gap-2">
                            <button 
                            onClick={() => setPendingWords([])}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded text-xs font-medium hover:text-red-600 hover:border-red-200"
                            disabled={isProcessingQueue}
                        >
                            清空
                        </button>
                        <button 
                            onClick={handleProcessPending}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2"
                            disabled={isProcessingQueue}
                        >
                            {isProcessingQueue ? '处理中...' : '开始批量查询'} <Play size={10} fill="currentColor"/>
                        </button>
                    </div>
                    {queueLog.length > 0 && isProcessingQueue && (
                            <div className="mt-2 text-[10px] text-indigo-600 font-mono">
                            {queueLog[queueLog.length - 1]}
                            </div>
                    )}
                </div>
            )}

            {/* MAIN LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-0">
                <div className="sticky top-0 bg-slate-50 pt-4 pb-2 z-10">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-slate-700">词汇列表</h3>
                        <div className="flex gap-1">
                            <button onClick={onOpenImport} title="AI 智能导入" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                <Upload size={16} />
                            </button>
                            <button onClick={handleExport} title="导出 JSON" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                <Download size={16} />
                            </button>
                        </div>
                    </div>
                    
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

                {/* Manual Add Button/Form */}
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
        </div>
    );
};

export default WordList;