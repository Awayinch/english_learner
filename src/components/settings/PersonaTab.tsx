import React, { useState, useRef, useEffect } from 'react';
import { Brain, User, Plus, Edit2, Trash2, Check, X, Upload, MessageSquare, Mic } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Character, EnglishLevel } from '../../types';
import { loadVoices, AppVoice } from '../../utils/ttsUtils';

// Helper for Base64 image
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const PersonaTab: React.FC = () => {
    const { 
        settings, 
        setSettings, 
        characters, 
        addCharacter, 
        updateCharacter, 
        deleteCharacter 
    } = useStore();

    const [view, setView] = useState<'list' | 'edit'>('list');
    const [editingChar, setEditingChar] = useState<Character | null>(null);
    const [voiceList, setVoiceList] = useState<AppVoice[]>([]);
    
    // Form States
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadVoices(settings.useEdgeTTS).then(setVoiceList);
    }, [settings.useEdgeTTS]);

    const handleCreateNew = () => {
        const newChar: Character = {
            id: Date.now().toString(),
            name: 'New Character',
            description: 'A new chat partner',
            systemPersona: 'You are a helpful assistant.',
            initialGreeting: 'Hello! How can I help you?',
            voiceName: ''
        };
        setEditingChar(newChar);
        setView('edit');
    };

    const handleEdit = (char: Character) => {
        setEditingChar({ ...char });
        setView('edit');
    };

    const handleSave = () => {
        if (editingChar) {
            if (characters.find(c => c.id === editingChar.id)) {
                updateCharacter(editingChar);
            } else {
                addCharacter(editingChar);
            }
            setView('list');
            setEditingChar(null);
        }
    };

    const handleDelete = (id: string) => {
        if (characters.length <= 1) {
            alert("At least one character is required.");
            return;
        }
        if (confirm("Are you sure you want to delete this character?")) {
            deleteCharacter(id);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingChar) {
            try {
                // Resize image to max 200x200 to save space
                const base64 = await fileToBase64(file);
                
                // Simple canvas resize logic could go here to optimize storage, 
                // for now we trust user or just save raw base64 (assuming small avatars)
                setEditingChar({ ...editingChar, avatar: base64 });
            } catch (err) {
                console.error("Avatar upload failed", err);
            }
        }
    };

    if (view === 'edit' && editingChar) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setView('list')} className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                         ← 返回列表
                    </button>
                    <h3 className="font-bold text-slate-800">编辑角色</h3>
                </div>

                {/* Avatar & Basic Info */}
                <div className="flex gap-4 items-start">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-2xl bg-slate-200 flex-shrink-0 cursor-pointer overflow-hidden border-2 border-slate-300 hover:border-indigo-500 transition-colors relative group"
                    >
                        {editingChar.avatar ? (
                            <img src={editingChar.avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <User size={32} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload size={20} className="text-white"/>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload}/>
                    </div>
                    
                    <div className="flex-1 space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">角色名称</label>
                            <input 
                                className="w-full p-2 rounded border border-slate-300 text-sm font-bold"
                                value={editingChar.name}
                                onChange={(e) => setEditingChar({...editingChar, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">简短描述</label>
                            <input 
                                className="w-full p-2 rounded border border-slate-300 text-xs"
                                value={editingChar.description}
                                placeholder="例如: 严厉的维多利亚时代教师"
                                onChange={(e) => setEditingChar({...editingChar, description: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* Voice Override */}
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                     <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <Mic size={12}/> 绑定语音 (可选)
                     </label>
                     <select 
                        value={editingChar.voiceName || ""} 
                        onChange={(e) => setEditingChar({...editingChar, voiceName: e.target.value})} 
                        className="w-full p-2 rounded border border-slate-300 text-xs"
                    >
                        <option value="">跟随全局设置</option>
                        {voiceList.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>

                {/* Greeting */}
                <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">初始问候语</label>
                    <textarea 
                        className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-20 resize-none"
                        value={editingChar.initialGreeting}
                        onChange={(e) => setEditingChar({...editingChar, initialGreeting: e.target.value})}
                    />
                </div>

                {/* Prompt */}
                <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">系统人设 (Prompt)</label>
                    <textarea 
                        className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-40 resize-none font-mono text-xs"
                        value={editingChar.systemPersona}
                        onChange={(e) => setEditingChar({...editingChar, systemPersona: e.target.value})}
                    />
                </div>

                <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow hover:bg-indigo-700">
                        保存角色
                    </button>
                    {editingChar.id && (
                        <button onClick={() => handleDelete(editingChar.id)} className="px-4 py-2 bg-white border border-red-200 text-red-500 rounded-lg text-sm font-bold hover:bg-red-50">
                            删除
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             {/* Header */}
             <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <User size={18} /> 角色列表
                </h3>
                <button 
                    onClick={handleCreateNew}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 flex items-center gap-1"
                >
                    <Plus size={14} /> 新建角色
                </button>
             </div>

             {/* Grid */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {characters.map(char => (
                     <div key={char.id} className="bg-white border border-slate-200 rounded-xl p-3 flex gap-3 hover:border-indigo-300 transition-colors shadow-sm relative group">
                         <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden">
                             {char.avatar ? (
                                 <img src={char.avatar} alt={char.name} className="w-full h-full object-cover"/>
                             ) : (
                                 <div className="w-full h-full flex items-center justify-center text-slate-400">
                                     <User size={20} />
                                 </div>
                             )}
                         </div>
                         <div className="min-w-0 flex-1">
                             <h4 className="font-bold text-sm text-slate-800 truncate">{char.name}</h4>
                             <p className="text-xs text-slate-500 truncate">{char.description || "No description"}</p>
                             <button 
                                onClick={() => handleEdit(char)}
                                className="mt-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600"
                            >
                                编辑详情
                             </button>
                         </div>
                     </div>
                 ))}
             </div>

            {/* Global Context Settings (Long Term Memory & Level) */}
            <div className="border-t border-slate-200 pt-4 mt-6">
                <div className="flex items-center gap-2 mb-3">
                    <Brain size={16} className="text-slate-400"/>
                    <h3 className="text-xs font-bold text-slate-500 uppercase">全局上下文 (适用于所有角色)</h3>
                </div>
                
                <div className="space-y-3">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">长期记忆/用户背景</label>
                        <textarea className="w-full p-2 rounded-lg border border-slate-300 outline-none text-sm h-20 resize-none" placeholder="例如: 我是程序员，想学习商务英语..." value={settings.longTermMemory || ''} onChange={(e) => setSettings(p => ({...p, longTermMemory: e.target.value}))} />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">难度等级</label>
                        <select value={settings.level} onChange={(e) => setSettings(p => ({...p, level: e.target.value as EnglishLevel}))} className="w-full p-2 rounded border border-slate-300 text-sm">
                            {Object.values(EnglishLevel).map((lvl) => (
                                <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
      </div>
    );
};

export default PersonaTab;