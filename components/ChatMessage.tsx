import React, { useMemo } from 'react';
import { ChatMessage as ChatMessageType, VocabularyItem } from '../types';
import { StopCircle, Volume2, Bot, User, Trash2 } from 'lucide-react';
import { speakText } from '../utils/ttsUtils';

interface ChatMessageProps {
  message: ChatMessageType;
  vocabulary: VocabularyItem[];
  onPlayFullAudio: (text: string, messageId: string) => void;
  onStopAudio: () => void;
  onDelete: (id: string) => void;
  onWordSelect: (word: string) => void; // New prop for tap-to-define
  playingMessageId: string | null;
  voiceName: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  vocabulary,
  onPlayFullAudio,
  onStopAudio,
  onDelete,
  onWordSelect,
  playingMessageId,
  voiceName,
}) => {
  const isUser = message.role === 'user';
  const isPlaying = playingMessageId === message.id;

  const handleKnownWordClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    speakText(word, voiceName);
  };

  const handleRegularWordClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    // Only allow clicking model words for definition to avoid misclicks on user input
    if (!isUser) {
        onWordSelect(word);
    }
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
        onStopAudio();
    } else {
        onPlayFullAudio(message.text, message.id);
    }
  };

  const renderText = useMemo(() => {
    // Split by spaces and punctuation, keeping delimiters to preserve formatting
    const words = message.text.split(/(\s+|[.,!?;:()""''])/);
    
    return (
      <p className={`whitespace-pre-wrap ${isUser ? 'text-base' : 'text-lg leading-[2.5rem]'}`}>
        {words.map((part, index) => {
          const cleanPart = part.toLowerCase().replace(/[^a-z]/g, '');
          
          // 1. If purely punctuation or space, just render
          if (!cleanPart) return <span key={index}>{part}</span>;

          // 2. Check if it's a "Known Vocabulary" (AI explicitly taught this)
          // Find the word in the message's contextual vocabulary list
          const vocabMatch = message.usedVocabulary?.find(v => 
            v.word.toLowerCase() === cleanPart || 
            (cleanPart.length > 3 && v.word.toLowerCase().startsWith(cleanPart.substring(0, cleanPart.length - 1)))
          );
          
          // Double check it exists in global list to ensure it's a "tracked" word
          const fullVocabData = vocabMatch 
              ? vocabulary.find(v => v.word.toLowerCase() === vocabMatch.word.toLowerCase()) 
              : null;

          if (vocabMatch && fullVocabData) {
            return (
              <span 
                key={index}
                className="inline-flex flex-col items-center align-middle mx-1 relative -bottom-1.5 group cursor-pointer"
                onClick={(e) => handleKnownWordClick(e, part)}
              >
                <span className="text-indigo-700 font-bold border-b-2 border-indigo-300 hover:border-indigo-600 transition-colors">
                    {part}
                </span>
                {/* Display the concise contextual translation from the message metadata */}
                <span className="text-[9px] text-slate-400 font-medium leading-none mt-0.5 select-none whitespace-nowrap">
                    {vocabMatch.translation}
                </span>
              </span>
            );
          }

          // 3. Regular Word (Clickable for Definition)
          // We wrap standard words in a span that handles click
          return (
            <span 
                key={index} 
                onClick={(e) => handleRegularWordClick(e, cleanPart)}
                className={!isUser ? "hover:bg-indigo-50 active:bg-indigo-100 rounded px-0.5 cursor-pointer transition-colors select-text" : ""}
            >
                {part}
            </span>
          );
        })}
      </p>
    );
  }, [message.text, message.usedVocabulary, vocabulary, voiceName, isUser, onWordSelect]);

  return (
    <div className={`flex w-full mb-6 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[75%] gap-2 md:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          
          {/* Avatar */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
          isUser ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'
          }`}>
          {isUser ? <User size={18} /> : <Bot size={18} />}
          </div>

          {/* Bubble */}
          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} relative min-w-0`}>
              <div className={`p-4 md:p-5 rounded-2xl shadow-sm relative break-words ${
              isUser 
                  ? 'bg-slate-800 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
              }`}>
                  {renderText}
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                  <button 
                      onClick={() => onDelete(message.id)}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-red-500 rounded"
                      title="删除消息"
                  >
                      <Trash2 size={14} />
                  </button>

                  {!isUser && (
                      <div className="flex gap-2 ml-1">
                          <button 
                              onClick={handlePlayToggle}
                              className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${
                                  isPlaying 
                                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-indigo-600'
                              }`}
                          >
                              {isPlaying ? <StopCircle size={14} /> : <Volume2 size={14} />}
                              <span className="font-medium">{isPlaying ? '停止' : '朗读'}</span>
                          </button>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default ChatMessage;