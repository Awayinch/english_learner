import React, { useState } from 'react';
import { AlertCircle, Volume2, X, ListPlus, CheckCircle, Loader2 } from 'lucide-react';

// Components
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import VocabularyPanel from './components/VocabularyPanel';
import SettingsModal from './components/SettingsModal';
import QuizMode from './components/QuizMode';
import TextSelectionTooltip from './components/TextSelectionTooltip';

// Store & Utils
import { useStore } from './store/useStore';
import { speakText } from './utils/ttsUtils';

function App() {
  // Global Store State
  const { 
    settings, 
    setSettings, 
    vocabulary, 
    setVocabulary,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    isSidebarOpen,
    setSidebarOpen,
    isSettingsOpen,
    setSettingsOpen,
    mode,
    pendingWords,
    setPendingWords,
    addVocabularyItem,
    createNewSession,
    deleteSession,
    _hasHydrated // New Hydration Check
  } = useStore();

  // Local UI State (Modals/Toasts)
  const [errorMsg, setErrorMsg] = useState<string | null>(null); 
  const [queueNotification, setQueueNotification] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // --- Derived State ---
  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  // --- Handlers ---
  const showQueueToast = (msg: string) => {
      setQueueNotification(msg);
      setTimeout(() => setQueueNotification(null), 2000);
  }

  const handleAddToQueue = (word: string) => {
      if (!word) return;
      if (pendingWords.includes(word)) {
          showQueueToast("已在队列中");
          return;
      }
      setPendingWords(prev => [...prev, word]);
      showQueueToast("已加入待查队列");
  }

  const handleConfirmAddToQueue = () => {
      if (!selectedWord) return;
      handleAddToQueue(selectedWord);
      setSelectedWord(null);
  };

  const handleWordSelect = (word: string) => {
      setSelectedWord(word);
  };

  // --- Session Action Wrappers ---
  const handleDeleteSessions = (ids: string[]) => {
      ids.forEach(id => deleteSession(id, settings.initialGreeting));
  };
  
  const handleClearSessions = () => {
      deleteSession('all', settings.initialGreeting); 
  };
  
  const handleRenameSession = (id: string, newTitle: string) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle.trim() || '未命名' } : s));
  };

  // --- Hydration Loading Screen ---
  // Vital for Async Storage: Prevents the UI from rendering empty/default state before DB is read
  if (!_hasHydrated) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-4">
              <Loader2 size={40} className="animate-spin text-indigo-600" />
              <p className="text-sm font-medium animate-pulse">Initializing Database...</p>
          </div>
      );
  }

  return (
    <div className="flex h-full relative bg-slate-50 overflow-hidden">
      
      {/* Global Text Selection Tooltip (Desktop Mouse Selection) */}
      <TextSelectionTooltip 
        settings={settings} 
        onAddVocabulary={addVocabularyItem} 
        onAddToQueue={handleAddToQueue}
      />

      {/* Tap-to-Define Bottom Sheet/Modal */}
      {selectedWord && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
              <div 
                className="absolute inset-0 bg-black/20 pointer-events-auto transition-opacity"
                onClick={() => setSelectedWord(null)}
              ></div>
              
              <div className="bg-white w-full sm:w-96 p-5 rounded-t-2xl sm:rounded-2xl shadow-2xl transform transition-transform animate-in slide-in-from-bottom-4 pointer-events-auto mb-0 sm:mb-10 mx-4 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">选中单词</p>
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
                          <Volume2 size={18} /> 朗读
                      </button>
                      <button 
                          onClick={handleConfirmAddToQueue}
                          className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
                      >
                          <ListPlus size={18} />
                          加入待查队列
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
      
      {queueNotification && (
         <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-xl z-50 flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in-95">
            <CheckCircle size={16} className="text-green-400"/> {queueNotification}
         </div>
      )}

      {/* Mobile Backdrop for Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Vocabulary / Navigation Panel */}
      <VocabularyPanel 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        vocabulary={vocabulary}
        setVocabulary={setVocabulary}
        level={settings.level}
        setLevel={(l) => setSettings(prev => ({...prev, level: l}))}
        settings={settings}
        messages={messages} 
        pendingWords={pendingWords}
        setPendingWords={setPendingWords}
        
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSwitchSession={setCurrentSessionId}
        onRenameSession={handleRenameSession}
        onNewChat={() => createNewSession(settings.initialGreeting)}
        onDeleteSession={(id) => deleteSession(id, settings.initialGreeting)}
        onDeleteSessions={handleDeleteSessions}
        onClearSessions={handleClearSessions}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        vocabulary={vocabulary}
        setVocabulary={setVocabulary}
        sessions={sessions}
        setSessions={setSessions}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isSidebarOpen ? 'md:ml-80' : ''}`}>
        <Header />

        {mode === 'chat' ? (
            <ChatInterface onWordSelect={handleWordSelect} />
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