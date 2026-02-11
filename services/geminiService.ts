
import { GoogleGenAI, Type } from "@google/genai";
import { VocabularyItem, EnglishLevel, Settings, QuizQuestion } from "../types";

// --- Helper: Initialize Google SDK (Only for direct official use) ---
const createClient = (apiKey: string | undefined, baseUrl: string | undefined) => {
  const finalApiKey = apiKey || process.env.API_KEY;
  if (!finalApiKey) {
    throw new Error("API Key is missing. Please check your settings.");
  }
  return new GoogleGenAI({ apiKey: finalApiKey }); // SDK usually ignores custom BaseURL unless specific config, we assume official endpoint if no BaseURL provided in settings logic below
};

// --- Helper: Robust JSON Extractor ---
const extractJson = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try { return JSON.parse(match[1]); } catch (e2) { /* continue */ }
    }
    const firstOpen = text.indexOf('{');
    const firstArray = text.indexOf('[');
    let start = -1;
    let end = -1;
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

// --- CORE: OpenAI Compatible Proxy Logic (Strict 3rd Party) ---
const generateContentOpenAICompat = async (
    settings: Settings,
    modelName: string,
    messages: { role: string; content: string }[],
    jsonMode: boolean = true,
    overrideBaseUrl?: string,
    overrideApiKey?: string,
    signal?: AbortSignal
) => {
    const apiKey = overrideApiKey || settings.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing for Proxy.");

    let baseUrl = overrideBaseUrl || settings.baseUrl;
    if (!baseUrl) throw new Error("Base URL required for Proxy Mode.");
    baseUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

    const url = `${baseUrl}/v1/chat/completions`;

    const payload: any = {
        model: modelName,
        messages: messages,
        temperature: 0.7,
    };

    // Only add response_format if jsonMode is requested (some models/proxies might error if unsupported, but standard OpenAI supports it)
    if (jsonMode) {
        payload.response_format = { type: "json_object" };
    }

    console.log(`[Proxy] POST ${url} (Model: ${modelName})`);

    const response = await fetch(url, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: signal
    });

    if (!response.ok) {
        let errText = await response.text();
        try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.message) errText = errJson.error.message;
        } catch(e) {}
        throw new Error(`Proxy Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from Proxy API");
    return text;
};

// --- Model Fetching ---
export const getAvailableModels = async (settings: Settings): Promise<string[]> => {
  const apiKey = settings.apiKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is required to fetch models.");

  let baseUrl = settings.baseUrl;
  if (baseUrl) {
      // STRICT: Proxy Mode
      baseUrl = baseUrl.trim().replace(/\/+$/, "");
      if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
      console.log(`[Models] Fetching via Proxy: ${baseUrl}`);
      
      try {
          const resp = await fetch(`${baseUrl}/v1/models`, {
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}` 
              }
          });
          if (resp.ok) {
              const data = await resp.json();
              const list = data.data || data.models || data.items || data.list || [];
              const models = new Set<string>();
              if (Array.isArray(list)) {
                  list.forEach((item: any) => {
                      const id = item.id || item.name;
                      if (id) models.add(id.replace(/^models\//, ''));
                  });
              }
              return Array.from(models).sort();
          } else {
              throw new Error(`Proxy Status ${resp.status}`);
          }
      } catch (e: any) {
          throw new Error(`Proxy Fetch Error: ${e.message}`);
      }
  } else {
      // STRICT: Official SDK Mode
      console.log(`[Models] Fetching via Google SDK`);
      try {
          const ai = createClient(apiKey, undefined);
          const response = await ai.models.list();
          const models = new Set<string>();
          if (response?.models) {
              response.models.forEach((m: any) => {
                  const name = m.name?.replace(/^models\//, '') || m.id;
                  if (name) models.add(name);
              });
          }
          if (models.size === 0) return ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-3-flash-preview"];
          return Array.from(models).sort();
      } catch (e: any) {
          // Fallback list if SDK fails but no proxy
           return ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-3-flash-preview"];
      }
  }
};

export interface ChatResponseItem {
  text: string;
  usedVocabulary: { word: string; translation: string }[];
}

// --- Chat Generation ---
export const generateChatResponse = async (
  userMessage: string,
  history: { role: string; parts: { text: string }[] }[],
  vocabulary: VocabularyItem[],
  settings: Settings,
  signal?: AbortSignal
): Promise<ChatResponseItem[]> => {
  
  const vocabListString = vocabulary.map((v) => `${v.word} (${v.definition})`).join(", ");
  
  // Inject Long Term Memory into System Prompt
  const memoryContext = settings.longTermMemory && settings.longTermMemory.trim().length > 0 
    ? `\n[LONG TERM MEMORY / USER NOTES]:\n${settings.longTermMemory}\n(Use these notes to maintain context and personalize the conversation.)\n`
    : "";

  const systemInstructionText = `
    ${settings.systemPersona || "You are an engaging, helpful English language tutor."}
    Target Proficiency Level: ${settings.level}
    
    ${memoryContext}
    
    VOCABULARY WORLDBOOK (Shared Memory): [${vocabListString}].
    INSTRUCTIONS:
    1. Converse naturally.
    2. Incorporate Worldbook words if contextually appropriate.
    3. **CRITICAL**: Output valid JSON.
    OUTPUT SCHEMA: Array of [{ "text": "...", "usedVocabulary": [{ "word": "...", "translation": "..." }] }]
  `;

  const modelName = settings.selectedModel || "gemini-3-flash-preview";

  // STRICT ROUTING
  if (settings.baseUrl) {
      // --- PROXY MODE (OpenAI Compatible) ---
      const messages = [
          { role: 'system', content: systemInstructionText },
          ...history.map(h => ({
              role: h.role === 'model' ? 'assistant' : 'user',
              content: h.parts.map(p => p.text).join('\n')
          })),
          { role: 'user', content: userMessage }
      ];
      
      const textResult = await generateContentOpenAICompat(settings, modelName, messages, true, undefined, undefined, signal);
      const parsed = extractJson(textResult);
      return Array.isArray(parsed) ? parsed : [parsed];

  } else {
      // --- OFFICIAL SDK MODE ---
      if (signal?.aborted) throw new Error("Aborted");
      
      const ai = createClient(settings.apiKey, undefined);
      const contents = [
        ...history.map(h => ({
          role: h.role,
          parts: h.parts.map(p => ({ text: p.text }))
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const schemaObj = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING },
                usedVocabulary: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT,
                        properties: { word: { type: Type.STRING }, translation: { type: Type.STRING } },
                        required: ["word", "translation"]
                    } 
                }
            },
            required: ["text", "usedVocabulary"]
        }
      };
      
      // Check cancel before request
      if (signal?.aborted) throw new Error("Aborted");
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
            systemInstruction: systemInstructionText, 
            responseMimeType: "application/json",
            responseSchema: schemaObj
        },
      });
      
      if (signal?.aborted) throw new Error("Aborted");
      
      const parsed = extractJson(response.text || "[]");
      return Array.isArray(parsed) ? parsed : [parsed];
  }
};

// --- Quiz Generation ---
export const parseQuizFromText = async (
    rawText: string, 
    fileData: { data: string, mimeType: string } | null,
    settings: Settings
): Promise<QuizQuestion[]> => {
    // Note: Quiz also uses the selected chat model usually, or we can use the vocab model. 
    // Let's stick to selectedModel for Quiz as it requires reasoning.
    const modelName = settings.selectedModel || "gemini-3-flash-preview";
    const prompt = `Analyze content. Generate Quiz for ${settings.level}. Output JSON: Array of {question, options[4], correctAnswerIndex(0-3), explanation(zh-CN)}. Context: "${rawText.substring(0, 1500)}"`;

    if (settings.baseUrl) {
        // PROXY MODE (Text only for now, ignoring fileData to ensure compatibility with most text-based proxies)
        // If user provided a file, we might be limited by the proxy's vision capabilities.
        // For robustness, we send the prompt text.
        const messages = [{ role: 'user', content: prompt }];
        const textResult = await generateContentOpenAICompat(settings, modelName, messages, true);
        const parsed = extractJson(textResult);
        return parsed.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) }));
    } else {
        // OFFICIAL SDK MODE
        const ai = createClient(settings.apiKey, undefined);
        const parts: any[] = [{ text: prompt }];
        if (fileData) parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.data } });
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: parts }],
            config: { responseMimeType: "application/json" }
        });
        const parsed = extractJson(response.text || "[]");
        return parsed.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) }));
    }
};

// --- Definition ---
export const defineSelection = async (text: string, settings: Settings): Promise<VocabularyItem | null> => {
    // OPTIMIZATION: Use the user-configured Vocabulary Model (defaulting to gemini-2.0-flash)
    const TOOL_MODEL = settings.vocabularyModel || "gemini-2.0-flash"; 
    
    // Short, precise prompt to save tokens and time
    const prompt = `Define "${text}". JSON: { "word": "${text}", "definition": "Concise CN def", "partOfSpeech": "noun/verb..." }`;

    try {
        let resText = "";
        if (settings.baseUrl) {
            // PROXY
            resText = await generateContentOpenAICompat(settings, TOOL_MODEL, [{ role: 'user', content: prompt }], true);
        } else {
            // SDK
            const ai = createClient(settings.apiKey, undefined);
            const response = await ai.models.generateContent({
                model: TOOL_MODEL,
                contents: [{ parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            });
            resText = response.text || "{}";
        }
        
        const res = extractJson(resText);
        if(res.word) return { id: Date.now().toString(), word: res.word, definition: res.definition, partOfSpeech: res.partOfSpeech };
        return null;
    } catch (e) {
         console.warn("Define failed", e);
         return null;
    }
}

// --- Vocabulary Extraction ---
export const processVocabularyFromText = async (
    rawText: string, 
    settings: Settings,
    signal?: AbortSignal
): Promise<VocabularyItem[]> => {
    // Use Vocabulary Model for Import as well to be faster
    const modelName = settings.vocabularyModel || "gemini-2.0-flash";
    const prompt = `Extract difficult vocab. Output JSON Array: [{ "word": "...", "definition": "CN def", "partOfSpeech": "..." }]. Text: "${rawText.substring(0, 4000)}"`;

    if (settings.baseUrl) {
        // PROXY
        if (signal?.aborted) throw new Error("Aborted");
        const resText = await generateContentOpenAICompat(settings, modelName, [{ role: 'user', content: prompt }], true, undefined, undefined, signal);
        const items = extractJson(resText);
        return Array.isArray(items) ? items.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) })) : [];
    } else {
        // SDK
        const ai = createClient(settings.apiKey, undefined);
        if (signal?.aborted) throw new Error("Aborted");
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        const items = extractJson(response.text || "[]");
        return Array.isArray(items) ? items.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) })) : [];
    }
}

// --- Obsidian Summary (Cloud Upload) ---
export const generateObsidianSummary = async (
  history: { role: string; text: string }[],
  vocabulary: VocabularyItem[],
  settings: Settings
): Promise<string> => {
  // Determine effective config
  const effectiveApiKey = settings.summaryApiKey || settings.apiKey;
  const effectiveBaseUrl = settings.summaryBaseUrl || settings.baseUrl;
  const effectiveModel = settings.summaryModel || settings.selectedModel || "gemini-3-flash-preview";

  const vocabText = vocabulary.map(v => `${v.word}: ${v.definition}`).join("\n");
  const conversationText = history
    .filter(h => h.text && h.text.trim())
    .map(h => `${h.role === 'user' ? 'User' : 'Tutor'}: ${h.text}`)
    .join("\n\n");

  const prompt = `
  Task: Summarize English learning session for Obsidian Daily Note (Markdown).
  Reqs: 
  1. Wrap key topics in [[WikiLinks]].
  2. Link vocabulary like [[Vocabulary/Word]].
  3. Sections: ## Summary, ## Vocabulary.
  4. Tags: #english/learning.
  
  [Vocabulary]
  ${vocabText}
  
  [History]
  ${conversationText}
  
  Output raw Markdown only.
  `;

  // STRICT ROUTING FOR SUMMARY
  if (effectiveBaseUrl) {
      // PROXY MODE
      console.log(`[Summary] Using Proxy: ${effectiveBaseUrl}`);
      // Note: We pass jsonMode=false because we want Markdown
      const messages = [{ role: 'user', content: prompt }];
      return await generateContentOpenAICompat(
          settings, 
          effectiveModel, 
          messages, 
          false, // Not JSON mode
          effectiveBaseUrl,
          effectiveApiKey
      );
  } else {
      // OFFICIAL SDK MODE
      console.log(`[Summary] Using Google SDK`);
      const ai = createClient(effectiveApiKey, undefined); // Ignore baseurl in SDK
      try {
          const response = await ai.models.generateContent({
            model: effectiveModel,
            contents: [{ parts: [{ text: prompt }] }],
          });
          return response.text || "";
      } catch (e: any) {
          throw new Error(`Summary SDK Error: ${e.message}`);
      }
  }
};
