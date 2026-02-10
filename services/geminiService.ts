import { GoogleGenAI, Type } from "@google/genai";
import { VocabularyItem, EnglishLevel, Settings, QuizQuestion } from "../types";

// Initialize the client dynamically based on settings
const getAiClient = (settings: Settings) => {
  const apiKey = settings.apiKey || process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in Settings.");
  }
  
  const options: any = { apiKey: apiKey };
  
  if (settings.baseUrl && settings.baseUrl.trim().length > 0) {
    let url = settings.baseUrl.trim();
    while (url.endsWith('/')) url = url.slice(0, -1);
    if (!url.startsWith('http')) url = `https://${url}`;
    options.baseUrl = url;
  }

  return new GoogleGenAI(options);
};

// --- Helper: Robust JSON Extractor ---
const extractJson = (text: string): any => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try extracting from markdown code blocks ```json ... ```
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try { return JSON.parse(match[1]); } catch (e2) { /* continue */ }
    }

    // 3. Try finding the first '[' or '{' and last ']' or '}'
    const firstOpen = text.indexOf('{');
    const firstArray = text.indexOf('[');
    
    let start = -1;
    let end = -1;

    // Determine if we are looking for an object or array
    if (firstOpen !== -1 && (firstArray === -1 || firstOpen < firstArray)) {
       start = firstOpen;
       end = text.lastIndexOf('}');
    } else if (firstArray !== -1) {
       start = firstArray;
       end = text.lastIndexOf(']');
    }

    if (start !== -1 && end !== -1) {
      const jsonStr = text.substring(start, end + 1);
      try { return JSON.parse(jsonStr); } catch (e3) { /* continue */ }
    }
    
    throw new Error("Could not parse JSON response from model.");
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust Model Fetching
export const getAvailableModels = async (settings: Settings): Promise<string[]> => {
  const apiKey = settings.apiKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is required to fetch models.");

  const models: Set<string> = new Set();
  const errors: string[] = [];

  // 1. Direct Fetch Strategy
  if (settings.baseUrl) {
    let baseUrl = settings.baseUrl.trim();
    while (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    const proxyUrl = `${baseUrl}/v1/models`;
    
    try {
      const resp = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}` 
        }
      });

      if (resp.ok) {
        const data = await resp.json();
        const items = data.data || data.models || data.items || data.list || [];
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const id = item.id || item.name || item.displayName;
            if (id) models.add(id.replace('models/', ''));
          });
        }
      } else {
        errors.push(`Proxy fetch failed: ${resp.status}`);
      }
    } catch (e: any) {
      errors.push(`Proxy error: ${e.message}`);
    }
  }

  // 2. SDK Strategy
  if (models.size === 0) {
    try {
      const ai = getAiClient(settings);
      const response = await ai.models.list();
      if (response && response.models && Array.isArray(response.models)) {
        response.models.forEach((m: any) => {
            const name = m.name?.replace('models/', '') || m.id;
            if (name) models.add(name);
        });
      }
    } catch (error: any) {
      errors.push(`SDK error: ${error.message}`);
    }
  }

  // 3. Google REST Fallback
  if (models.size === 0 && !settings.baseUrl) {
     try {
         const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
         const resp = await fetch(url);
         if (resp.ok) {
             const data = await resp.json();
             if (data.models && Array.isArray(data.models)) {
                 data.models.forEach((m: any) => models.add(m.name.replace('models/', '')));
             }
         }
     } catch (e) { /* Ignore */ }
  }

  const modelList = Array.from(models).sort();
  if (modelList.length === 0) throw new Error(errors.join(" | ") || "No models found.");

  return modelList.filter((name) => 
      ['gemini', 'flash', 'pro', 'learnlm', 'gpt'].some(k => name.toLowerCase().includes(k))
  );
};

export interface ChatResponseItem {
  text: string;
  usedVocabulary: string[];
}

// Updated to return an Array of responses (Multi-bubble) with Retry Logic
export const generateChatResponse = async (
  userMessage: string,
  history: { role: string; parts: { text: string }[] }[],
  vocabulary: VocabularyItem[],
  settings: Settings
): Promise<ChatResponseItem[]> => {
  const ai = getAiClient(settings);
  
  const vocabListString = vocabulary.map((v) => `${v.word} (${v.definition})`).join(", ");

  const systemInstructionText = `
    ${settings.systemPersona || "You are an engaging, helpful English language tutor."}
    
    Target Proficiency Level: ${settings.level}
    
    USER INFORMATION:
    ${settings.userPersona || "The user is an English learner."}
    
    VOCABULARY WORLDBOOK (Shared Memory):
    You have access to specific vocabulary words: [${vocabListString}].
    
    INSTRUCTIONS:
    1. Converse naturally.
    2. You may split your response into multiple "bubbles" (messages) if appropriate (e.g., one for reaction, one for explanation).
    3. Incorporate Worldbook words if contextually appropriate.
    4. **CRITICAL**: You must output valid JSON. Do not output markdown code blocks.
    
    OUTPUT SCHEMA:
    Return an Array of objects: [{ "text": "...", "usedVocabulary": ["word1"] }]
  `;

  const validHistory = history.filter(h => h.parts.some(p => p.text && p.text.trim().length > 0));

  const contents = [
    ...validHistory.map(h => ({
      role: h.role,
      parts: h.parts.map(p => ({ text: p.text }))
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }]
    }
  ];

  const modelName = settings.selectedModel || "gemini-3-flash-preview";
  let lastError: any;
  const maxRetries = 3; 

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstructionText, 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    usedVocabulary: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING } 
                    }
                },
                required: ["text", "usedVocabulary"]
            }
          }
        },
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Empty response");
      
      const parsed = extractJson(jsonText);
      return Array.isArray(parsed) ? parsed : [parsed];

    } catch (error: any) {
      console.error(`Gemini Chat Attempt ${attempt + 1} Error:`, error);
      lastError = error;
      
      const errStr = JSON.stringify(error) + (error.message || "");
      const isRateLimit = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
      const isTransient = errStr.includes("503") || errStr.includes("fetch failed");

      if (attempt < maxRetries && (isRateLimit || isTransient)) {
          const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
          console.warn(`Retrying in ${delay}ms...`);
          await wait(delay);
      } else {
          break;
      }
    }
  }

  // Fallback for 429 or persistent errors
  const errStr = JSON.stringify(lastError) + (lastError?.message || "");
  const isQuota = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED");
  
  const msg = isQuota 
      ? "⚠️ Usage limit reached (429). Please wait a moment or check your API quota." 
      : "Connection error. Please check your settings.";
  return [{ text: msg, usedVocabulary: [] }];
};

// Quiz Parser with Retry
export const parseQuizFromText = async (
    rawText: string, 
    fileData: { data: string, mimeType: string } | null,
    settings: Settings
): Promise<QuizQuestion[]> => {
    const ai = getAiClient(settings);
    const modelName = settings.selectedModel || "gemini-3-flash-preview";

    const prompt = `
    Analyze the provided content. Generate a Quiz for a ${settings.level} English learner.
    Output JSON: Array of {question, options[4], correctAnswerIndex(0-3), explanation(in Simplified Chinese)}.
    
    Context:
    "${rawText.substring(0, 1500)}"
    `;

    const parts: any[] = [{ text: prompt }];
    if (fileData) {
        parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.data } });
    }

    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: parts }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswerIndex: { type: Type.INTEGER },
                                explanation: { type: Type.STRING }
                            }
                        }
                    }
                }
            });
            
            const parsed = extractJson(response.text || "[]");
            return parsed.map((item: any) => ({
                ...item,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            }));
        } catch (e: any) {
            lastError = e;
            console.error(`Quiz Parse Attempt ${attempt + 1} Failed:`, e);
            
            const errStr = JSON.stringify(e) + (e.message || "");
            const isRetryable = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("503");
            
            if (attempt < maxRetries && isRetryable) {
                const delay = 2000 * Math.pow(2, attempt);
                await wait(delay);
            } else {
                break;
            }
        }
    }
    throw lastError;
};

// Define Selection with Retry - Strict Chinese Definition
export const defineSelection = async (text: string, settings: Settings): Promise<VocabularyItem | null> => {
    const ai = getAiClient(settings);
    const modelName = settings.selectedModel || "gemini-3-flash-preview";
    
    // Explicitly ask for Simplified Chinese definition
    const prompt = `Define the word or phrase: "${text}". 
    Output JSON: {
        "word": "${text}", 
        "definition": "Concise definition in Simplified Chinese (简体中文)", 
        "partOfSpeech": "noun/verb/adj..."
    }`;
    
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            });
            
            const res = extractJson(response.text || "{}");
            if(res.word) {
                return {
                    id: Date.now().toString(),
                    word: res.word,
                    definition: res.definition,
                    partOfSpeech: res.partOfSpeech
                };
            }
            return null;
        } catch (e: any) {
             const errStr = JSON.stringify(e) + (e.message || "");
             const isRetryable = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("503");
             if (attempt < maxRetries && isRetryable) {
                 await wait(1500 * (attempt + 1));
             } else {
                 console.warn("Define selection failed", e);
                 return null;
             }
        }
    }
    return null;
}

// Vocab processing with AbortSignal and Retry - Strict Chinese Definition
export const processVocabularyFromText = async (
    rawText: string, 
    settings: Settings,
    signal?: AbortSignal
): Promise<VocabularyItem[]> => {
    if (!rawText.trim()) return [];
    
    if (signal?.aborted) throw new Error("Aborted");

    const ai = getAiClient(settings);
    const modelName = settings.selectedModel || "gemini-3-flash-preview";
    
    // Explicitly ask for Simplified Chinese definition
    const prompt = `Extract difficult vocabulary from this text. 
    Output JSON Array: [{
        "word": "english word", 
        "definition": "Concise definition in Simplified Chinese (简体中文)", 
        "partOfSpeech": "..."
    }]. 
    Text: "${rawText.substring(0, 5000)}"`;

    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) throw new Error("Aborted");
        
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            });

            if (signal?.aborted) throw new Error("Aborted");
            
            const items = extractJson(response.text || "[]");
            return Array.isArray(items) ? items.map((item: any) => ({
                ...item,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            })) : [];

        } catch (error: any) {
            if (signal?.aborted || error.message === "Aborted") {
                throw new Error("Process cancelled by user.");
            }
            
            const errStr = JSON.stringify(error) + (error.message || "");
            const isRetryable = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("503");
            
            if (attempt < maxRetries && isRetryable) {
                 console.warn(`Retry batch attempt ${attempt + 1} due to 429/503...`);
                 const delay = 2000 * Math.pow(2, attempt);
                 await wait(delay);
                 // Double check abort after wait
                 if (signal?.aborted) throw new Error("Aborted");
            } else {
                throw new Error("Failed to process text due to API error.");
            }
        }
    }
    return [];
}