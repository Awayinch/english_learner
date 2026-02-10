import React, { useEffect, useState } from 'react';
import { BookPlus, Loader2 } from 'lucide-react';
import { Settings, VocabularyItem } from '../types';
import { defineSelection } from '../services/geminiService';

interface TextSelectionTooltipProps {
  settings: Settings;
  onAddVocabulary: (item: VocabularyItem) => void;
}

const TextSelectionTooltip: React.FC<TextSelectionTooltipProps> = ({ settings, onAddVocabulary }) => {
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null);
        return;
      }

      const text = sel.toString().trim();
      if (text.length > 50) return; // Ignore long selections

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelection({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const handleAddToVocab = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selection) return;

    setIsLoading(true);
    try {
        const item = await defineSelection(selection.text, settings);
        if (item) {
            onAddVocabulary(item);
            setSelection(null); // Close tooltip
            window.getSelection()?.removeAllRanges(); // Clear selection
        }
    } catch (error) {
        console.error("Failed to add vocab", error);
        alert("Could not define word. Check connection.");
    } finally {
        setIsLoading(false);
    }
  };

  if (!selection) return null;

  return (
    <div
      className="fixed z-[100] transform -translate-x-1/2 -translate-y-full bg-slate-800 text-white rounded-lg shadow-xl px-3 py-2 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200"
      style={{ left: selection.x, top: selection.y }}
      onMouseDown={(e) => e.preventDefault()} // Prevent clearing selection on click
    >
      <span className="text-sm font-semibold max-w-[150px] truncate border-r border-slate-600 pr-2 mr-1">
        {selection.text}
      </span>
      <button
        onClick={handleAddToVocab}
        disabled={isLoading}
        className="flex items-center gap-1 hover:text-indigo-300 text-xs font-medium transition-colors whitespace-nowrap"
      >
        {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
        ) : (
            <BookPlus size={14} />
        )}
        Add to Worldbook
      </button>
      
      {/* Arrow */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800"></div>
    </div>
  );
};

export default TextSelectionTooltip;