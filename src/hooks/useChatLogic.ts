import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { generateChatResponse } from '../services/geminiService';
import { ChatMessage } from '../types';

export const useChatLogic = () => {
    const { 
        settings, 
        vocabulary, 
        sessions, 
        currentSessionId, 
        updateCurrentSessionMessages,
        setSessions,
        setSettingsOpen
    } = useStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Get current messages safely
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const messages = currentSession?.messages || [];

    const showError = (msg: string) => {
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(null), 4000);
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (isLoading) {
            handleStopGeneration();
            return;
        }

        if (!input.trim()) return;

        if (!settings.apiKey && !process.env.API_KEY) {
            setSettingsOpen(true);
            showError("请先在设置中配置 API Key");
            return;
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input
        };

        // Auto-update title logic
        if (messages.length === 1 && currentSession?.title === '新对话') {
            const newTitle = input.length > 15 ? input.substring(0, 15) + '...' : input;
            setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: newTitle } : s));
        }

        // Optimistic update
        updateCurrentSessionMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        try {
            const responseItems = await generateChatResponse(
                userMsg.text,
                history,
                vocabulary,
                settings,
                controller.signal
            );

            const newMessages = responseItems.map((item, index) => ({
                id: (Date.now() + index + 1).toString(),
                role: 'model' as const,
                text: item.text,
                usedVocabulary: item.usedVocabulary
            }));

            updateCurrentSessionMessages(prev => [...prev, ...newMessages]);

        } catch (error: any) {
            if (error.message === "Aborted" || error.name === "AbortError") {
                console.log("Generation stopped by user.");
            } else {
                console.error("Failed to generate response", error);
                showError(error.message || "生成失败，请检查设置。");
                
                updateCurrentSessionMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'model',
                    text: `⚠️ 错误: ${error.message || '连接中断'}。请检查 API Key 或代理设置。`
                }]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    return {
        input,
        setInput,
        isLoading,
        errorMsg,
        handleSend,
        handleStopGeneration
    };
};