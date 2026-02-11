
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
          if (models.size === 0) return ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-3-flash-preview"];
          return Array.from(models).sort();
      } catch (e: any) {
          // Fallback list
           return ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-3-flash-preview"];
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
  
  const memoryContext = settings.longTermMemory && settings.longTermMemory.trim().length > 0 
    ? `\n[长期记忆/用户笔记]:\n${settings.longTermMemory}\n(使用这些笔记来保持上下文并个性化对话。)\n`
    : "";

  const systemInstructionText = `
    ${settings.systemPersona || "你是一位引人入胜、乐于助人的英语导师。"}
    目标英语水平: ${settings.level}
    
    ${memoryContext}
    
    单词本 (共享记忆): [${vocabListString}].
    指令:
    1. 自然地进行对话。
    2. 如果语境合适，请结合单词本中的单词。
    3. **关键**: 输出有效的 JSON。
    输出格式: Array of [{ "text": "...", "usedVocabulary": [{ "word": "...", "translation": "..." }] }]
  `;

  const modelName = settings.selectedModel || "gemini-3-flash-preview";

  if (settings.baseUrl) {
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
    const modelName = settings.selectedModel || "gemini-3-flash-preview";
    const prompt = `分析内容。为 ${settings.level} 生成测验。输出 JSON：Array of {question, options[4], correctAnswerIndex(0-3), explanation(zh-CN)}。上下文: "${rawText.substring(0, 1500)}"`;

    if (settings.baseUrl) {
        const messages = [{ role: 'user', content: prompt }];
        const textResult = await generateContentOpenAICompat(settings, modelName, messages, true);
        const parsed = extractJson(textResult);
        return parsed.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) }));
    } else {
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

// --- Single Definition (Keep for manual use if needed) ---
export const defineSelection = async (text: string, settings: Settings): Promise<VocabularyItem | null> => {
    const TOOL_MODEL = settings.vocabularyModel || "gemini-1.5-flash"; 
    const prompt = `定义 "${text}"。JSON格式: { "word": "${text}", "definition": "简明的中文定义", "partOfSpeech": "noun/verb..." }`;

    try {
        let resText = "";
        if (settings.baseUrl) {
            resText = await generateContentOpenAICompat(settings, TOOL_MODEL, [{ role: 'user', content: prompt }], true);
        } else {
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

// --- Batch Definition (New for Queue) ---
export const defineVocabularyBatch = async (
    words: string[],
    settings: Settings,
    signal?: AbortSignal
): Promise<VocabularyItem[]> => {
    if (words.length === 0) return [];
    
    // Use Vocabulary Model (defaulting to 1.5 flash now)
    const modelName = settings.vocabularyModel || "gemini-1.5-flash";
    const prompt = `严格定义这些单词。输出 JSON 数组: [{ "word": "...", "definition": "简明的中文定义", "partOfSpeech": "..." }]. 单词: ${words.join(", ")}`;

    if (settings.baseUrl) {
        // PROXY
        const resText = await generateContentOpenAICompat(settings, modelName, [{ role: 'user', content: prompt }], true, undefined, undefined, signal);
        const items = extractJson(resText);
        return Array.isArray(items) ? items.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) })) : [];
    } else {
        // SDK
        const ai = createClient(settings.apiKey, undefined);
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        const items = extractJson(response.text || "[]");
        return Array.isArray(items) ? items.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) })) : [];
    }
};

// --- Vocabulary Extraction (From Text Block) ---
export const processVocabularyFromText = async (
    rawText: string, 
    settings: Settings,
    signal?: AbortSignal
): Promise<VocabularyItem[]> => {
    const modelName = settings.vocabularyModel || "gemini-1.5-flash";
    const prompt = `提取生僻词汇。输出 JSON 数组: [{ "word": "...", "definition": "中文定义", "partOfSpeech": "..." }]. 文本: "${rawText.substring(0, 4000)}"`;

    if (settings.baseUrl) {
        if (signal?.aborted) throw new Error("Aborted");
        const resText = await generateContentOpenAICompat(settings, modelName, [{ role: 'user', content: prompt }], true, undefined, undefined, signal);
        const items = extractJson(resText);
        return Array.isArray(items) ? items.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString().substr(2, 5) })) : [];
    } else {
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
  const effectiveApiKey = settings.summaryApiKey || settings.apiKey;
  const effectiveBaseUrl = settings.summaryBaseUrl || settings.baseUrl;
  const effectiveModel = settings.summaryModel || settings.selectedModel || "gemini-3-flash-preview";

  const vocabText = vocabulary.map(v => `${v.word}: ${v.definition}`).join("\n");
  const conversationText = history
    .filter(h => h.text && h.text.trim())
    .map(h => `${h.role === 'user' ? 'User' : 'Tutor'}: ${h.text}`)
    .join("\n\n");

  const prompt = `
  任务：为 Obsidian Daily Note (Markdown) 总结英语学习会话。
  要求: 
  1. 将关键主题包裹在 [[WikiLinks]] 中。
  2. 链接词汇，如 [[Vocabulary/Word]]。
  3. 章节: ## Summary, ## Vocabulary.
  4. 标签: #english/learning.
  
  [词汇]
  ${vocabText}
  
  [历史记录]
  ${conversationText}
  
  仅输出原始 Markdown。
  `;

  if (effectiveBaseUrl) {
      console.log(`[Summary] Using Proxy: ${effectiveBaseUrl}`);
      const messages = [{ role: 'user', content: prompt }];
      return await generateContentOpenAICompat(
          settings, 
          effectiveModel, 
          messages, 
          false, 
          effectiveBaseUrl,
          effectiveApiKey
      );
  } else {
      console.log(`[Summary] Using Google SDK`);
      const ai = createClient(effectiveApiKey, undefined); 
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
