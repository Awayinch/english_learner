import React from 'react';
import { Volume2, X, ListPlus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { speakText } from '../utils/ttsUtils';

interface DefinitionModalProps {
  selectedWord: string;
  onClose: () => void;
  onAddToQueue: (word: string) => void; // Pass this to keep queue notification logic in App or move it later
}

const DefinitionModal: React.FC<DefinitionModalProps> = ({ selectedWord, onClose, onAddToQueue }) => {
    const { settings } = useStore();

    const handleConfirmAddToQueue = () => {
        onAddToQueue(selectedWord);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/20 pointer-events-auto transition-opacity"
              onClick={onClose}
            ></div>
            
            {/* Card */}
            <div className="bg-white w-full sm:w-96 p-5 rounded-t-2xl sm:rounded-2xl shadow-2xl transform transition-transform animate-in slide-in-from-bottom-4 pointer-events-auto mb-0 sm:mb-10 mx-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">选中单词</p>
                        <h3 className="text-2xl font-bold text-slate-800 break-all">"{selectedWord}"</h3>
                    </div>
                    <button 
                      onClick={onClose}
                      className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex gap-3 mt-2">
                    <button 
                        onClick={() => speakText(selectedWord, settings.voiceName)}
                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <Volume2 size={18} /> 朗读
                    </button>
                    <button 
                        onClick={handleConfirmAddToQueue}
                        className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
                    >
                        <ListPlus size={18} />
                        加入待查队列
                    </button>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400">
                      将加入队列进行批量 AI 查询。
                  </p>
                </div>
            </div>
        </div>
    );
};

export default DefinitionModal;