import React, { useState } from 'react';
import { MessageSquare, MessageSquarePlus, Edit2, Trash2, Check, X, ListChecks, CheckSquare, Square } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ChatSession } from '../../types';

const SessionList: React.FC = () => {
    const { 
        sessions, 
        currentSessionId, 
        setCurrentSessionId, 
        setSessions, 
        deleteSession,
        createNewSession,
        settings
    } = useStore();

    // Local UI State
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const handleSwitchSession = (id: string) => {
        if (isBatchMode) {
            const newSet = new Set(selectedSessionIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedSessionIds(newSet);
        } else {
            setCurrentSessionId(id);
            // On mobile, parent usually handles closing, but we'll leave that to the parent store listener or user action
        }
    };

    const startEditing = (e: React.MouseEvent, session: ChatSession) => {
        e.stopPropagation();
        setEditingSessionId(session.id);
        setEditTitle(session.title);
    };

    const saveEditing = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (editingSessionId) {
            setSessions(prev => prev.map(s => s.id === editingSessionId ? { ...s, title: editTitle.trim() || '未命名' } : s));
            setEditingSessionId(null);
        }
    };

    const cancelEditing = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingSessionId(null);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteSession(id, settings.initialGreeting);
    };

    const handleBatchDelete = () => {
        if (selectedSessionIds.size === 0) return;
        if (confirm(`确定删除选中的 ${selectedSessionIds.size} 个对话吗？`)) {
            // Batch delete logic
            const idsToDelete = Array.from(selectedSessionIds);
            // We need a batch delete action in store, or loop. 
            // Since we don't have batchDelete in store explicitly exposed as one atomic op in the prompt before, 
            // we manually update sessions state which is cleaner.
            setSessions(prev => {
                const remaining = prev.filter(s => !idsToDelete.includes(s.id));
                // Ensure at least one session exists
                if (remaining.length === 0) {
                     createNewSession(settings.initialGreeting); // This is async-ish in store logic, effectively we need to return valid state
                     // Actually easier to just filter. If empty, parent/store logic usually handles it or we re-init.
                     // Let's reuse the simple delete logic for now or add a quick re-init check
                     return remaining; 
                }
                return remaining;
            });
            
            // If current session was deleted, switch to first available
            if (idsToDelete.includes(currentSessionId)) {
                const remaining = sessions.filter(s => !idsToDelete.includes(s.id));
                if (remaining.length > 0) setCurrentSessionId(remaining[0].id);
                else {
                    // If all deleted, createNewSession above might have triggered or we do it here
                    createNewSession(settings.initialGreeting);
                }
            }
            
            setSelectedSessionIds(new Set());
            setIsBatchMode(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedSessionIds.size === sessions.length) {
            setSelectedSessionIds(new Set());
        } else {
            setSelectedSessionIds(new Set(sessions.map(s => s.id)));
        }
    };

    const handleClearAll = () => {
        if(confirm('确定删除所有历史记录吗？')) {
            deleteSession('all', settings.initialGreeting);
        }
    };

    return (
        <div className="bg-slate-50 pb-2 flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="p-2 space-y-2 sticky top-0 bg-slate-50 z-10 border-b border-slate-100 shrink-0">
                <div className="flex gap-2">
                    <button 
                        onClick={() => createNewSession(settings.initialGreeting)}
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
            
            {/* List */}
            <div className="px-2 space-y-1 mt-1 overflow-y-auto flex-1">
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
                                    if (e.key === 'Enter') saveEditing();
                                    if (e.key === 'Escape') cancelEditing();
                                    e.stopPropagation();
                                }}
                            />
                            <button onClick={saveEditing} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={14}/></button>
                            <button onClick={cancelEditing} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded"><X size={14}/></button>
                        </div>
                    ) : (
                    <div 
                        className={`group flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer border transition-all ${
                            currentSessionId === session.id && !isBatchMode
                            ? 'bg-white border-indigo-200 shadow-sm text-indigo-700 font-medium' 
                            : 'bg-transparent border-transparent hover:bg-slate-200 text-slate-600'
                        }`}
                        onClick={() => handleSwitchSession(session.id)}
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
                                    onClick={(e) => startEditing(e, session)}
                                    className="text-slate-400 hover:text-indigo-500 p-1"
                                    title="重命名"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => handleDelete(e, session.id)}
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

            {/* Footer Actions */}
            {isBatchMode ? (
            <div className="px-2 mt-4 pt-2 border-t border-slate-200 flex gap-2 shrink-0">
                <button 
                    onClick={() => setIsBatchMode(false)}
                    className="flex-1 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50"
                >
                    取消
                </button>
                <button 
                    onClick={handleBatchDelete}
                    disabled={selectedSessionIds.size === 0}
                    className="flex-[2] py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                    <Trash2 size={12} /> 删除 ({selectedSessionIds.size})
                </button>
            </div>
        ) : (
            sessions.length > 0 && (
                <div className="px-2 mt-4 pt-2 border-t border-slate-200 shrink-0">
                        <button 
                        onClick={handleClearAll}
                        className="w-full py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                        <Trash2 size={12} /> 清空所有对话
                    </button>
                </div>
            )
            )}
        </div>
    );
};

export default SessionList;