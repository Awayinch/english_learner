
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

// New Character Interface
export interface Character {
  id: string;
  name: string;
  avatar?: string; // Base64 image string
  description: string; // Short bio
  systemPersona: string; // The prompt
  initialGreeting: string;
  voiceName?: string; // Specific voice for this character
}

export interface ChatSession {
  id: string;
  title: string;
  characterId?: string; // Link to a character
  messages: ChatMessage[];
  createdAt: number;
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
  useEdgeTTS: boolean;
  
  // TTS Fine-tuning
  ttsRate: number; // 0 is default (range -50 to +50 usually, represented as relative percent)
  ttsPitch: number; // 0 is default
  
  // Legacy / Default Fallbacks (used if no character selected)
  systemPersona: string;
  userPersona: string;
  longTermMemory?: string; 
  initialGreeting: string; 
  
  baseUrl: string;
  apiKey: string; 
  selectedModel: string; 
  vocabularyModel: string; 
  
  // GitHub Sync Settings
  githubToken?: string;
  githubRepo?: string; 
  githubPath?: string; 
  
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