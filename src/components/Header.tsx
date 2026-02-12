import React from 'react';
import { Menu, Sparkles, Server, MessageSquare, GraduationCap, BookOpen, Settings as SettingsIcon } from 'lucide-react';
import { useStore } from '../store/useStore';

const Header: React.FC = () => {
    const { 
        settings, 
        vocabulary, 
        mode, 
        setMode, 
        isSidebarOpen, 
        setSidebarOpen, 
        setSettingsOpen,
        pendingWords
    } = useStore();

    const hasApiKey = !!settings.apiKey || !!process.env.API_KEY;

    return (
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
            <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                <button 
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors relative"
                >
                    <Menu size={20} />
                    {pendingWords.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-white"></span>
                    )}
                </button>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shrink-0">
                        <Sparkles size={16} />
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                        <h1 className="font-bold text-slate-800 leading-tight truncate">LingoLeap</h1>
                        <div className="flex items-center gap-2 text-xs text-slate-500 hidden sm:flex">
                            <div className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                <Server size={10} />
                                <span className="truncate max-w-[150px]" title={settings.selectedModel}>{settings.selectedModel}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Mode Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-lg ml-2 md:ml-4 shrink-0">
                    <button 
                        onClick={() => setMode('chat')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                            mode === 'chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <MessageSquare size={14} /> <span className="hidden sm:inline">对话</span>
                    </button>
                    <button 
                        onClick={() => setMode('quiz')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                            mode === 'quiz' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <GraduationCap size={14} /> <span className="hidden sm:inline">测验</span>
                    </button>
                </div>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2 text-sm text-slate-500 shrink-0">
                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="hidden lg:flex items-center gap-1 mr-2 hover:text-indigo-600 transition-colors"
                >
                    <BookOpen size={14} /> 
                    {vocabulary.length} <span className="hidden xl:inline">词</span>
                </button>
                <button 
                    onClick={() => setSettingsOpen(true)}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${hasApiKey ? 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600' : 'bg-red-100 text-red-600 animate-pulse'}`}
                    title="Settings"
                >
                    <SettingsIcon size={18} />
                </button>
            </div>
        </header>
    );
};

export default Header;