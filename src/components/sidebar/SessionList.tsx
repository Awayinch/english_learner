import React, { useState } from 'react';
import { MessageSquare, MessageSquarePlus, Edit2, Trash2, Check, X, ListChecks, CheckSquare, Square, User } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ChatSession, Character } from '../../types';

const SessionList: React.FC = () => {
    const { 
        sessions, 
        currentSessionId, 
        setCurrentSessionId, 
        setSessions, 
        deleteSession,
        createNewSession,
        characters // New: to display avatars/names
    } = useStore();

    // Local UI State
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    
    // New: Character Picker Modal state for creating new chat
    const [isPickingChar, setIsPickingChar] = useState(false);

    const handleSwitchSession = (id: string) => {
        if (isBatchMode) {
            const newSet = new Set(selectedSessionIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedSessionIds(newSet);
        } else {
            setCurrentSessionId(id);
        }
    };

    const handleCreateNewChat = (charId: string) => {
        createNewSession(charId);
        setIsPickingChar(false);
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
        deleteSession(id);
    };

    const handleBatchDelete = () => {
        if (selectedSessionIds.size === 0) return;
        if (confirm(`确定删除选中的 ${selectedSessionIds.size} 个对话吗？`)) {
            const idsToDelete = Array.from(selectedSessionIds);
            setSessions(prev => {
                const remaining = prev.filter(s => !idsToDelete.includes(s.id));
                // Store handles the empty case fallback logic usually, but let's be safe
                if (remaining.length === 0) {
                     // Trigger a re-init via store logic or just let the store's deleteSession handle single deletion logic repeatedly
                     // Ideally we call a batchDelete action. For now, manual:
                     const defaultChar = characters[0];
                     return [{
                        id: Date.now().toString(),
                        title: '新对话',
                        characterId: defaultChar?.id || 'default',
                        messages: [{
                          id: 'welcome',
                          role: 'model',
                          text: defaultChar?.initialGreeting || "Hello!",
                          usedVocabulary: []
                        }],
                        createdAt: Date.now()
                     }];
                }
                return remaining;
            });
            
            if (idsToDelete.includes(currentSessionId)) {
                const remaining = sessions.filter(s => !idsToDelete.includes(s.id));
                if (remaining.length > 0) setCurrentSessionId(remaining[0].id);
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
            // Simply delete all one by one or reset state. 
            // Since we don't have a clearAll action exposed, we simulate via batch delete all
            const allIds = sessions.map(s => s.id);
            // Re-using logic above would be cleaner but let's just use the store reset pattern
            setSessions([]); 
            // Store hydration will fix the empty array issue on next render or we can force it
            setTimeout(() => {
                // Force a fresh session
                createNewSession(characters[0]?.id || 'default');
            }, 50);
        }
    };

    // Helper to get character avatar/name for a session
    const getSessionChar = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session || !session.characterId) return null;
        return characters.find(c => c.id === session.characterId);
    };

    return (
        <div className="bg-slate-50 pb-2 flex-1 flex flex-col min-h-0 relative">
            {/* Toolbar */}
            <div className="p-2 space-y-2 sticky top-0 bg-slate-50 z-10 border-b border-slate-100 shrink-0">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsPickingChar(true)}
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
                {sessions.map(session => {
                    const char = getSessionChar(session.id);
                    return (
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
                                    // Character Avatar Icon
                                    <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                                        {char?.avatar ? (
                                            <img src={char.avatar} alt="c" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={12} className="text-slate-400" />
                                        )}
                                    </div>
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
                )})}
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

            {/* Character Picker Modal */}
            {isPickingChar && (
                <div className="absolute inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-bottom-5">
                    <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm">选择对话角色</h3>
                        <button onClick={() => setIsPickingChar(false)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X size={18}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {characters.map(char => (
                            <div 
                                key={char.id}
                                onClick={() => handleCreateNewChat(char.id)}
                                className="bg-white border border-slate-200 p-3 rounded-xl flex items-center gap-3 hover:border-indigo-400 cursor-pointer shadow-sm"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                    {char.avatar ? <img src={char.avatar} className="w-full h-full object-cover"/> : <User size={20} className="m-2 text-slate-400"/>}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-800">{char.name}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{char.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionList;