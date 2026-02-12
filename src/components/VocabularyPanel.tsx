import React, { useState } from 'react';
import { BookOpen, X, Cloud, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight, History } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateObsidianSummary } from '../services/geminiService';
import { syncToGithub } from '../services/githubService';

// Import Modular Components
import SessionList from './sidebar/SessionList';
import WordList from './sidebar/WordList';
import ImportTools from './sidebar/ImportTools';

interface VocabularyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const VocabularyPanel: React.FC<VocabularyPanelProps> = ({
  isOpen,
  onClose,
  className = "",
}) => {
  const { 
    settings, 
    vocabulary, 
    sessions,
    currentSessionId
  } = useStore();

  // Sidebar Layout State
  const [activeSection, setActiveSection] = useState<'chats' | 'vocab'>('chats');
  const [isImportMode, setIsImportMode] = useState(false);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');

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
        // Derive messages from current session in store
        const currentSession = sessions.find(s => s.id === currentSessionId);
        const messages = currentSession?.messages || [];
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

      {/* SECTION 1: CHAT HISTORY */}
      <div className="border-b border-slate-200 flex-shrink-0 flex flex-col max-h-[50vh]">
          <button 
            onClick={() => setActiveSection(activeSection === 'chats' ? 'vocab' : 'chats')}
            className={`w-full flex items-center justify-between p-4 font-bold text-sm shrink-0 ${activeSection === 'chats' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
              <div className="flex items-center gap-2">
                  <History size={18} /> 历史对话
              </div>
              {activeSection === 'chats' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {activeSection === 'chats' && (
              <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-top-2 overflow-hidden">
                  <SessionList />
              </div>
          )}
      </div>

      {/* SECTION 2: VOCABULARY / IMPORT */}
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
            isImportMode ? (
                <ImportTools onBack={() => setIsImportMode(false)} />
            ) : (
                <WordList onOpenImport={() => setIsImportMode(true)} />
            )
        )}
      </div>
    </div>
  );
};

export default VocabularyPanel;