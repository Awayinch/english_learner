
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Send, Sparkles, MessageSquare, Settings as SettingsIcon, AlertCircle, BookOpen, GraduationCap, Server, BookPlus, Loader2, Volume2, X } from 'lucide-react';
import { DEFAULT_VOCABULARY, ChatMessage as ChatMessageType, EnglishLevel, VocabularyItem, Settings } from './types';
import VocabularyPanel from './components/VocabularyPanel';
import ChatMessage from './components/ChatMessage';
import SettingsModal from './components/SettingsModal';
import QuizMode from './components/QuizMode';
import TextSelectionTooltip from './components/TextSelectionTooltip';
import { generateChatResponse, defineSelection } from './services/geminiService';
import { speakText, stopSpeaking } from './utils/ttsUtils';

function App() {
  // Load Settings (Existing logic)
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('lingoleap_settings');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse settings", e);
        }
    }
    return {
        level: EnglishLevel.B1,
        voiceName: '', 
        systemPersona: "You are an engaging, helpful English language tutor. You explain things clearly and are patient.",
        userPersona: "",
        longTermMemory: "", 
        baseUrl: "",
        apiKey: "", 
        selectedModel: "gemini-3-flash-preview",
        initialGreeting: "Hello! I'm your English tutor. I've updated my Worldbook. What would you like to talk about today?"
    };
  });

  // Load Vocabulary with persistence
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(() => {
      const saved = localStorage.getItem('lingoleap_vocabulary');
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {
              console.error("Failed to parse vocabulary", e);
          }
      }
      return DEFAULT_VOCABULARY;
  });

  // Load Messages with persistence
  const [messages, setMessages] = useState<ChatMessageType[]>(() => {
      const saved = localStorage.getItem('lingoleap_messages');
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {
              console.error("Failed to parse messages", e);
          }
      }
      // Default initial state if nothing saved
      return [{
        id: 'welcome',
        role: 'model',
        text: settings.initialGreeting,
        usedVocabulary: []
      }];
  });

  // --- PERSISTENCE EFFECTS ---
  
  // Save Settings (Existing)
  useEffect(() => {
      localStorage.setItem('lingoleap_settings', JSON.stringify(settings));
  }, [settings]);

  // Save Vocabulary (New)
  useEffect(() => {
      localStorage.setItem('lingoleap_vocabulary', JSON.stringify(vocabulary));
  }, [vocabulary]);

  // Save Messages (New)
  useEffect(() => {
      localStorage.setItem('lingoleap_messages', JSON.stringify(messages));
  }, [messages]);


  const [mode, setMode] = useState<'chat' | 'quiz'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Tap-to-Define State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isDefining, setIsDefining] = useState(false);
  
  // Update welcome message if settings change (only if it's the only message)
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
  };

  const handleUpdateSettings = (newSettings: Settings | ((prev: Settings) => Settings)) => {
      setSettings(newSettings);
  };

  // --- Mobile/Desktop Tap-to-Define Logic ---
  const handleWordSelect = (word: string) => {
      setSelectedWord(word);
  };

  const handleConfirmDefinition = async () => {
      if (!selectedWord) return;
      setIsDefining(true);
      try {
          const item = await defineSelection(selectedWord, settings);
          if (item) {
              handleAddGlobalVocab(item);
              setSelectedWord(null); // Close modal on success
          } else {
              showError("Could not define word.");
          }
      } catch (e) {
          showError("Definition failed. Check settings.");
      } finally {
          setIsDefining(false);
      }
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
      
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          text: `⚠️ Error: ${error.message || 'Connection interrupted'}. Please check your API Key/Proxy settings.`
      }]);
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

  const hasApiKey = !!settings.apiKey || !!process.env.API_KEY;

  return (
    <div className="flex h-full relative bg-slate-50 overflow-hidden">
      
      {/* Global Text Selection Tooltip (Desktop Mouse Selection) */}
      <TextSelectionTooltip settings={settings} onAddVocabulary={handleAddGlobalVocab} />

      {/* Tap-to-Define Bottom Sheet/Modal (Mobile/Tablet Friendly) */}
      {selectedWord && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/20 pointer-events-auto transition-opacity"
                onClick={() => setSelectedWord(null)}
              ></div>
              
              {/* Card */}
              <div className="bg-white w-full sm:w-96 p-5 rounded-t-2xl sm:rounded-2xl shadow-2xl transform transition-transform animate-in slide-in-from-bottom-4 pointer-events-auto mb-0 sm:mb-10 mx-4 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Define Word</p>
                          <h3 className="text-2xl font-bold text-slate-800 break-all">"{selectedWord}"</h3>
                      </div>
                      <button 
                        onClick={() => setSelectedWord(null)}
                        className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
                      >
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="flex gap-3 mt-2">
                      <button 
                          onClick={() => speakText(selectedWord, settings.voiceName)}
                          className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                          <Volume2 size={18} /> Read
                      </button>
                      <button 
                          onClick={handleConfirmDefinition}
                          disabled={isDefining}
                          className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-70"
                      >
                          {isDefining ? <Loader2 size={18} className="animate-spin" /> : <BookPlus size={18} />}
                          Add to Worldbook
                      </button>
                  </div>
              </div>
          </div>
      )}

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
        setLevel={(l) => handleUpdateSettings(prev => ({...prev, level: l}))}
        settings={settings}
        setSettings={handleUpdateSettings} // Pass setter to update memory
        messages={messages} // Pass messages for sync summary
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={handleUpdateSettings}
        // Pass full state control for backup/restore
        vocabulary={vocabulary}
        setVocabulary={setVocabulary}
        messages={messages}
        setMessages={setMessages}
      />

      {/* Main Area */}
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
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${hasApiKey ? 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600' : 'bg-red-100 text-red-600 animate-pulse'}`}
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
                        onWordSelect={handleWordSelect}
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
                    Highlight (Desktop) or Tap (Mobile) any text to add to Worldbook.
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
