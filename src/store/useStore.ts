import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Settings, VocabularyItem, ChatSession, EnglishLevel, DEFAULT_VOCABULARY, ChatMessage, Character } from '../types';
import { indexedDBStorage } from '../services/storageAdapter';

interface AppState {
  // Data
  settings: Settings;
  vocabulary: VocabularyItem[];
  sessions: ChatSession[];
  characters: Character[]; // New
  currentSessionId: string;
  
  // UI State
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  mode: 'chat' | 'quiz';
  pendingWords: string[];
  
  // Hydration State
  _hasHydrated: boolean;

  // Actions
  setSettings: (settings: Settings | ((prev: Settings) => Settings)) => void;
  setVocabulary: (vocabulary: VocabularyItem[] | ((prev: VocabularyItem[]) => VocabularyItem[])) => void;
  setSessions: (sessions: ChatSession[] | ((prev: ChatSession[]) => ChatSession[])) => void;
  setCharacters: (characters: Character[] | ((prev: Character[]) => Character[])) => void; // New
  setCurrentSessionId: (id: string) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setMode: (mode: 'chat' | 'quiz') => void;
  setPendingWords: (words: string[] | ((prev: string[]) => string[])) => void;
  setHasHydrated: (status: boolean) => void;

  // Helper Actions
  addVocabularyItem: (item: VocabularyItem) => void;
  updateCurrentSessionMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  createNewSession: (characterId: string) => void; // Updated signature
  deleteSession: (id: string) => void;
  
  // Character Actions
  addCharacter: (char: Character) => void;
  updateCharacter: (char: Character) => void;
  deleteCharacter: (id: string) => void;
}

const defaultSettings: Settings = {
    level: EnglishLevel.B1,
    voiceName: '', 
    useEdgeTTS: true,
    ttsRate: 0,
    ttsPitch: 0,
    systemPersona: "You are an engaging, helpful English language tutor. You explain things clearly and are patient.",
    userPersona: "",
    longTermMemory: "", 
    baseUrl: "",
    apiKey: "", 
    selectedModel: "gemini-3-flash-preview",
    vocabularyModel: "gemini-1.5-flash",
    initialGreeting: "Hello! I'm your English tutor. I've updated my Worldbook. What would you like to talk about today?"
};

const DEFAULT_CHARACTER_ID = 'default_tutor';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Initial Data ---
      settings: defaultSettings,
      vocabulary: DEFAULT_VOCABULARY,
      characters: [], // Will be populated on hydration/init if empty
      sessions: [{
          id: 'init',
          title: '新对话',
          characterId: DEFAULT_CHARACTER_ID,
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

      setCharacters: (updater) => set((state) => ({
        characters: typeof updater === 'function' ? updater(state.characters) : updater
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

      createNewSession: (characterId) => set((state) => {
         const char = state.characters.find(c => c.id === characterId) 
             || state.characters[0] 
             || { id: 'default', initialGreeting: state.settings.initialGreeting };
             
         const newSession: ChatSession = {
            id: Date.now().toString(),
            title: '新对话',
            characterId: char.id,
            messages: [{
                id: 'welcome',
                role: 'model',
                text: char.initialGreeting,
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

      deleteSession: (id) => set((state) => {
          const newSessions = state.sessions.filter(s => s.id !== id);
          if (newSessions.length === 0) {
               // Ensure always one session (using first available character or default)
               const defaultChar = state.characters[0];
               const freshSession: ChatSession = {
                  id: Date.now().toString(),
                  title: '新对话',
                  characterId: defaultChar?.id || DEFAULT_CHARACTER_ID,
                  messages: [{
                    id: 'welcome',
                    role: 'model',
                    text: defaultChar?.initialGreeting || state.settings.initialGreeting,
                    usedVocabulary: []
                  }],
                  createdAt: Date.now()
              };
              return { sessions: [freshSession], currentSessionId: freshSession.id };
          }
          const nextId = state.currentSessionId === id ? newSessions[0].id : state.currentSessionId;
          return { sessions: newSessions, currentSessionId: nextId };
      }),

      addCharacter: (char) => set(state => ({ characters: [...state.characters, char] })),
      updateCharacter: (char) => set(state => ({ characters: state.characters.map(c => c.id === char.id ? char : c) })),
      deleteCharacter: (id) => set(state => ({ characters: state.characters.filter(c => c.id !== id) }))

    }),
    {
      name: 'lingoleap-storage', 
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({ 
          settings: state.settings,
          vocabulary: state.vocabulary,
          sessions: state.sessions,
          characters: state.characters, // Persist characters
          currentSessionId: state.currentSessionId
      }),
      onRehydrateStorage: () => (state) => {
         state?.setHasHydrated(true);
         
         // Migration: Ensure at least one default character exists based on legacy settings
         if (state && state.characters && state.characters.length === 0) {
             console.log("Migrating legacy persona to Character...");
             const defaultChar: Character = {
                 id: DEFAULT_CHARACTER_ID,
                 name: 'English Tutor',
                 description: 'Your default AI language partner.',
                 systemPersona: state.settings.systemPersona || defaultSettings.systemPersona,
                 initialGreeting: state.settings.initialGreeting || defaultSettings.initialGreeting,
                 voiceName: state.settings.voiceName
             };
             state.setCharacters([defaultChar]);
         }
      }
    }
  )
);