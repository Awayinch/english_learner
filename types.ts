
export interface VocabularyItem {
  id: string;
  word: string;
  definition: string;
  partOfSpeech: string;
  example?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  // Updated to store the contextual translation provided by AI
  usedVocabulary?: { word: string; translation: string }[]; 
  isPlaying?: boolean; 
}

export enum EnglishLevel {
  A1 = 'A1 (Beginner)',
  A2 = 'A2 (Elementary)',
  B1 = 'B1 (Intermediate)',
  B2 = 'B2 (Upper Intermediate)',
  C1 = 'C1 (Advanced)',
  C2 = 'C2 (Proficiency)',
}

export interface Settings {
  level: EnglishLevel;
  voiceName: string; 
  useEdgeTTS: boolean; // New: Toggle for High Quality Online TTS
  systemPersona: string;
  userPersona: string;
  longTermMemory?: string; // New: Persistent memory notes
  baseUrl: string;
  apiKey: string; 
  selectedModel: string; 
  initialGreeting: string; 
  
  // GitHub Sync Settings
  githubToken?: string;
  githubRepo?: string; // e.g., "username/my-obsidian-vault"
  githubPath?: string; // e.g., "English/" or ""
  
  // Summary Specific AI Settings (Optional)
  summaryApiKey?: string;
  summaryBaseUrl?: string;
  summaryModel?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
  explanation: string;
  userSelectedIndex?: number;
}

export const DEFAULT_VOCABULARY: VocabularyItem[] = [
  { id: '1', word: 'ephemeral', definition: '短暂的；朝生暮死的', partOfSpeech: 'adj' },
  { id: '2', word: 'serendipity', definition: '意外发现珍奇事物的本领；机缘凑巧', partOfSpeech: 'noun' },
  { id: '3', word: 'eloquent', definition: '雄辩的；有口才的；动人的', partOfSpeech: 'adj' },
  { id: '4', word: 'resilient', definition: '迅速恢复的；有适应力的', partOfSpeech: 'adj' },
  { id: '5', word: 'pragmatic', definition: '务实的；实事求是的', partOfSpeech: 'adj' },
];
