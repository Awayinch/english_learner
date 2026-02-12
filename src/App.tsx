import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

// Components
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import VocabularyPanel from './components/VocabularyPanel';
import SettingsModal from './components/SettingsModal';
import QuizMode from './components/QuizMode';
import TextSelectionTooltip from './components/TextSelectionTooltip';
import DefinitionModal from './components/DefinitionModal';

// Store & Utils
import { useStore } from './store/useStore';

function App() {
  // Global Store State
  const { 
    settings, 
    isSidebarOpen,
    setSidebarOpen,
    isSettingsOpen,
    setSettingsOpen,
    mode,
    pendingWords,
    setPendingWords,
    addVocabularyItem,
    _hasHydrated
  } = useStore();

  // Local UI State (Modals/Toasts)
  const [errorMsg] = useState<string | null>(null); 
  const [queueNotification, setQueueNotification] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

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

  const handleWordSelect = (word: string) => {
      setSelectedWord(word);
  };

  // --- Hydration Loading Screen ---
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
          <DefinitionModal 
            selectedWord={selectedWord} 
            onClose={() => setSelectedWord(null)}
            onAddToQueue={handleAddToQueue}
          />
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
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
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