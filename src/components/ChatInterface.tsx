import React, { useEffect, useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { useStore } from '../store/useStore';
import { useChatLogic } from '../hooks/useChatLogic';
import { speakText, stopSpeaking } from '../utils/ttsUtils';

interface ChatInterfaceProps {
  onWordSelect: (word: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onWordSelect }) => {
    const { 
        sessions, 
        currentSessionId, 
        vocabulary, 
        settings, 
        updateCurrentSessionMessages,
        characters // New
    } = useStore();
    
    const { 
        input, 
        setInput, 
        isLoading, 
        handleSend, 
        handleStopGeneration 
    } = useChatLogic();

    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const messages = currentSession?.messages || [];
    
    // Resolve Voice: Use character voice if set, otherwise global setting
    const activeChar = characters.find(c => c.id === currentSession?.characterId);
    const activeVoice = activeChar?.voiceName || settings.voiceName;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, currentSessionId]);

    const handleDeleteMessage = (id: string) => {
        updateCurrentSessionMessages(prev => prev.filter(m => m.id !== id));
    };

    const handlePlayFullAudio = async (text: string, messageId: string) => {
        stopSpeaking();
        setPlayingMessageId(messageId);
        try {
            // Pass Rate/Pitch from global settings for now
            await speakText(text, activeVoice, { rate: settings.ttsRate, pitch: settings.ttsPitch });
            setPlayingMessageId(null);
        } catch (e) {
            console.error("Playback failed", e);
            setPlayingMessageId(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading) {
                handleSend();
            }
        }
    };

    return (
        <>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 w-full">
                <div className="max-w-3xl mx-auto">
                    {messages.map((msg) => (
                        <ChatMessage 
                            key={msg.id} 
                            message={msg} 
                            vocabulary={vocabulary}
                            onPlayFullAudio={handlePlayFullAudio}
                            onStopAudio={stopSpeaking}
                            onDelete={handleDeleteMessage}
                            onWordSelect={onWordSelect}
                            playingMessageId={playingMessageId}
                            voiceName={activeVoice}
                        />
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-6">
                            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            <div className="p-3 md:p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="max-w-3xl mx-auto relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isLoading ? "AI 正在思考..." : "输入消息..."}
                        className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none bg-slate-50 max-h-32 min-h-[50px] text-base"
                        rows={1}
                        style={{ minHeight: '52px' }}
                        disabled={isLoading && false}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!isLoading && !input.trim()}
                        className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all ${
                            isLoading 
                            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                        title={isLoading ? "停止生成" : "发送消息"}
                    >
                        {isLoading ? <Square size={18} fill="currentColor" /> : <Send size={18} />}
                    </button>
                </div>
                <p className="text-center text-[10px] md:text-xs text-slate-400 mt-2 hidden sm:block">
                    在电脑上划词或手机上点击单词可添加到生词本。
                </p>
            </div>
        </>
    );
};

export default ChatInterface;