import React, { useState, useEffect, useRef } from 'react';
import { Menu, Send, Sparkles, MessageSquare, Settings as SettingsIcon, AlertCircle, BookOpen, GraduationCap, Server } from 'lucide-react';
import { DEFAULT_VOCABULARY, ChatMessage as ChatMessageType, EnglishLevel, VocabularyItem, Settings } from './types';
import VocabularyPanel from './components/VocabularyPanel';
import ChatMessage from './components/ChatMessage';
import SettingsModal from './components/SettingsModal';
import QuizMode from './components/QuizMode';
import TextSelectionTooltip from './components/TextSelectionTooltip';
import { generateChatResponse } from './services/geminiService';
import { speakText, stopSpeaking } from './utils/ttsUtils';

function App() {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(DEFAULT_VOCABULARY);
  const [settings, setSettings] = useState<Settings>({
    level: EnglishLevel.B1,
    voiceName: '', 
    systemPersona: "You are an engaging, helpful English language tutor. You explain things clearly and are patient.",
    userPersona: "",
    baseUrl: "",
    apiKey: "", 
    selectedModel: "gemini-3-flash-preview",
    initialGreeting: "Hello! I'm your English tutor. I've updated my Worldbook. What would you like to talk about today?"
  });

  const [mode, setMode] = useState<'chat' | 'quiz'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: 'welcome',
      role: 'model',
      text: settings.initialGreeting,
      usedVocabulary: []
    }
  ]);

  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome' && messages[0].text !== settings.initialGreeting) {
        setMessages([{
            ...messages[0],
            text: settings.initialGreeting
        }]);
    }
  }, [settings.initialGreeting, messages.length]);
  
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, mode]);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  const handleDeleteMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleAddGlobalVocab = (item: VocabularyItem) => {
      setVocabulary(prev => [...prev, item]);
      // Show mini toast or visual feedback could go here
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!settings.apiKey && !process.env.API_KEY) {
        setIsSettingsOpen(true);
        showError("Please configure your API Key in Settings first.");
        return;
    }

    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    try {
      // API returns an Array of bubbles (multi-bubble response)
      const responseItems = await generateChatResponse(userMsg.text, history, vocabulary, settings);
      
      const newMessages = responseItems.map((item, index) => ({
        id: (Date.now() + index + 1).toString(),
        role: 'model' as const,
        text: item.text,
        usedVocabulary: item.usedVocabulary
      }));

      setMessages(prev => [...prev, ...newMessages]);
    } catch (error: any) {
      console.error("Failed to generate response", error);
      showError(error.message || "Failed to generate response. Check your settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePlayFullAudio = async (text: string, messageId: string) => {
    stopSpeaking();
    setPlayingMessageId(messageId);
    try {
        await speakText(text, settings.voiceName);
        setPlayingMessageId(null);
    } catch (e) {
        console.error("Playback failed", e);
        setPlayingMessageId(null);
    }
  };

  return (
    <div className="flex h-full relative bg-slate-50 overflow-hidden">
      
      {/* Global Text Selection Tooltip */}
      <TextSelectionTooltip settings={settings} onAddVocabulary={handleAddGlobalVocab} />

      {errorMsg && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-3 rounded-lg shadow-xl z-50 flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2 w-[90%] md:w-auto text-center justify-center">
            <AlertCircle size={18} className="shrink-0" />
            {errorMsg}
        </div>
      )}

      {/* Mobile Backdrop for Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <VocabularyPanel 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        vocabulary={vocabulary}
        setVocabulary={setVocabulary}
        level={settings.level}
        setLevel={(l) => setSettings(prev => ({...prev, level: l}))}
        settings={settings}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
      />

      {/* Main Area */}
      {/* On desktop (md), push content with margin. On mobile, content stays full width underneath overlay. */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isSidebarOpen ? 'md:ml-80' : ''}`}>
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
                <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shrink-0">
                    <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                    <h1 className="font-bold text-slate-800 leading-tight truncate">LingoLeap</h1>
                    <div className="flex items-center gap-2 text-xs text-slate-500 hidden sm:flex">
                        <span>{mode === 'chat' ? 'Chat Mode' : 'Quiz Mode'}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                             <Server size={10} />
                             <span className="truncate max-w-[80px] md:max-w-[120px]" title={settings.selectedModel}>{settings.selectedModel}</span>
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
                    <MessageSquare size={14} /> <span className="hidden sm:inline">Chat</span>
                </button>
                <button 
                    onClick={() => setMode('quiz')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                        mode === 'quiz' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <GraduationCap size={14} /> <span className="hidden sm:inline">Quiz</span>
                </button>
            </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2 text-sm text-slate-500 shrink-0">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="hidden lg:flex items-center gap-1 mr-2 hover:text-indigo-600 transition-colors"
             >
                <BookOpen size={14} /> 
                {vocabulary.length} <span className="hidden xl:inline">Words</span>
             </button>
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-2"
                title="Settings"
             >
                <SettingsIcon size={18} />
             </button>
          </div>
        </header>

        {/* Content Body */}
        {mode === 'chat' ? (
            <>
                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 w-full">
                <div className="max-w-3xl mx-auto">
                    {messages.map((msg) => (
                    <ChatMessage 
                        key={msg.id} 
                        message={msg} 
                        vocabulary={vocabulary}
                        onPlayFullAudio={handlePlayFullAudio}
                        onStopAudio={stopSpeaking}
                        onDelete={handleDeleteMessage}
                        playingMessageId={playingMessageId}
                        voiceName={settings.voiceName}
                    />
                    ))}
                    {isLoading && (
                    <div className="flex justify-start mb-6">
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                </main>

                <div className="p-3 md:p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="max-w-3xl mx-auto relative">
                    <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none bg-slate-50 max-h-32 min-h-[50px] text-base"
                    rows={1}
                    style={{ minHeight: '52px' }}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <p className="text-center text-[10px] md:text-xs text-slate-400 mt-2 hidden sm:block">
                    Highlight any text to add to Worldbook.
                </p>
                </div>
            </>
        ) : (
            <div className="flex-1 overflow-y-auto bg-slate-50">
                <QuizMode settings={settings} />
            </div>
        )}
      </div>
    </div>
  );
}

export default App;