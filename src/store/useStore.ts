import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Settings, VocabularyItem, ChatSession, EnglishLevel, DEFAULT_VOCABULARY, ChatMessage } from '../types';
import { indexedDBStorage } from '../services/storageAdapter';

interface AppState {
  // Data
  settings: Settings;
  vocabulary: VocabularyItem[];
  sessions: ChatSession[];
  currentSessionId: string;
  
  // UI State
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  mode: 'chat' | 'quiz';
  pendingWords: string[];
  
  // Hydration State (New: Tracks if data is loaded from DB)
  _hasHydrated: boolean;

  // Actions
  setSettings: (settings: Settings | ((prev: Settings) => Settings)) => void;
  setVocabulary: (vocabulary: VocabularyItem[] | ((prev: VocabularyItem[]) => VocabularyItem[])) => void;
  setSessions: (sessions: ChatSession[] | ((prev: ChatSession[]) => ChatSession[])) => void;
  setCurrentSessionId: (id: string) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setMode: (mode: 'chat' | 'quiz') => void;
  setPendingWords: (words: string[] | ((prev: string[]) => string[])) => void;
  setHasHydrated: (state: boolean) => void;

  // Helper Actions
  addVocabularyItem: (item: VocabularyItem) => void;
  updateCurrentSessionMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  createNewSession: (initialGreeting: string) => void;
  deleteSession: (id: string, initialGreeting: string) => void;
}

const defaultSettings: Settings = {
    level: EnglishLevel.B1,
    voiceName: '', 
    useEdgeTTS: true,
    systemPersona: "You are an engaging, helpful English language tutor. You explain things clearly and are patient.",
    userPersona: "",
    longTermMemory: "", 
    baseUrl: "",
    apiKey: "", 
    selectedModel: "gemini-3-flash-preview",
    vocabularyModel: "gemini-1.5-flash",
    initialGreeting: "Hello! I'm your English tutor. I've updated my Worldbook. What would you like to talk about today?"
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Initial Data ---
      settings: defaultSettings,
      vocabulary: DEFAULT_VOCABULARY,
      sessions: [{
          id: 'init',
          title: '新对话',
          messages: [{
            id: 'welcome',
            role: 'model',
            text: defaultSettings.initialGreeting,
            usedVocabulary: []
          }],
          createdAt: Date.now()
      }],
      currentSessionId: 'init',
      
      // --- Initial UI State ---
      isSidebarOpen: false,
      isSettingsOpen: false,
      mode: 'chat',
      pendingWords: [],
      _hasHydrated: false,

      // --- Actions ---
      setSettings: (updater) => set((state) => ({
        settings: typeof updater === 'function' ? updater(state.settings) : updater
      })),
      
      setVocabulary: (updater) => set((state) => ({
        vocabulary: typeof updater === 'function' ? updater(state.vocabulary) : updater
      })),
      
      setSessions: (updater) => set((state) => ({
        sessions: typeof updater === 'function' ? updater(state.sessions) : updater
      })),
      
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setMode: (mode) => set({ mode }),
      setPendingWords: (updater) => set((state) => ({
        pendingWords: typeof updater === 'function' ? updater(state.pendingWords) : updater
      })),
      setHasHydrated: (status) => set({ _hasHydrated: status }),

      // --- Helper Actions ---
      addVocabularyItem: (item) => set((state) => ({
        vocabulary: [item, ...state.vocabulary]
      })),

      updateCurrentSessionMessages: (updater) => set((state) => {
        const { sessions, currentSessionId } = state;
        const currentSession = sessions.find(s => s.id === currentSessionId);
        
        if (!currentSession) return {};

        const newMessages = typeof updater === 'function' 
            ? updater(currentSession.messages)
            : updater;
        
        const updatedSessions = sessions.map(s => 
            s.id === currentSessionId ? { ...s, messages: newMessages } : s
        );

        return { sessions: updatedSessions };
      }),

      createNewSession: (initialGreeting) => set((state) => {
         const newSession: ChatSession = {
            id: Date.now().toString(),
            title: '新对话',
            messages: [{
                id: 'welcome',
                role: 'model',
                text: initialGreeting || state.settings.initialGreeting,
                usedVocabulary: []
            }],
            createdAt: Date.now()
        };
        return {
            sessions: [newSession, ...state.sessions],
            currentSessionId: newSession.id,
            isSidebarOpen: false
        };
      }),

      deleteSession: (id, initialGreeting) => set((state) => {
          const newSessions = state.sessions.filter(s => s.id !== id);
          if (newSessions.length === 0) {
               // Ensure always one session
               const freshSession: ChatSession = {
                  id: Date.now().toString(),
                  title: '新对话',
                  messages: [{
                    id: 'welcome',
                    role: 'model',
                    text: initialGreeting,
                    usedVocabulary: []
                  }],
                  createdAt: Date.now()
              };
              return { sessions: [freshSession], currentSessionId: freshSession.id };
          }
          // If we deleted the current session, switch to the first available
          const nextId = state.currentSessionId === id ? newSessions[0].id : state.currentSessionId;
          return { sessions: newSessions, currentSessionId: nextId };
      })

    }),
    {
      name: 'lingoleap-storage', 
      // Switch from localStorage to our custom IndexedDB adapter
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({ 
          settings: state.settings,
          vocabulary: state.vocabulary,
          sessions: state.sessions,
          currentSessionId: state.currentSessionId
      }),
      onRehydrateStorage: () => (state) => {
         // This callback runs when hydration finishes
         state?.setHasHydrated(true);
      }
    }
  )
);