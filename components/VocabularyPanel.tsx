import React, { useState, useRef } from 'react';
import { VocabularyItem, EnglishLevel, Settings } from '../types';
import { BookOpen, Plus, Trash2, X, Upload, Sparkles, Download, StopCircle, CheckCircle } from 'lucide-react';
import { processVocabularyFromText } from '../services/geminiService';

interface VocabularyPanelProps {
  vocabulary: VocabularyItem[];
  setVocabulary: React.Dispatch<React.SetStateAction<VocabularyItem[]>>;
  level: EnglishLevel;
  setLevel: (level: EnglishLevel) => void;
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  className?: string; // Allow passing extra classes
}

const VocabularyPanel: React.FC<VocabularyPanelProps> = ({
  vocabulary,
  setVocabulary,
  level,
  setLevel,
  isOpen,
  onClose,
  settings,
  className = ""
}) => {
  const [newWord, setNewWord] = useState('');
  const [newDef, setNewDef] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // AI Import State
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImportMode, setIsImportMode] = useState(false);
  
  // Progress State
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAddWord = () => {
    if (newWord && newDef) {
      const newItem: VocabularyItem = {
        id: Date.now().toString(),
        word: newWord.trim(),
        definition: newDef.trim(),
        partOfSpeech: 'custom'
      };
      setVocabulary([...vocabulary, newItem]);
      setNewWord('');
      setNewDef('');
      setIsAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    setVocabulary(vocabulary.filter(v => v.id !== id));
  };

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setStatusLog(prev => [...prev, "🛑 Operation cancelled by user."]);
        setIsProcessing(false);
    }
  };

  const handleAiProcess = async () => {
    if (!importText.trim()) return;
    
    if (!settings.apiKey && !process.env.API_KEY) {
        alert("Please configure your API Key in Settings first.");
        return;
    }

    setIsProcessing(true);
    setStatusLog(["🚀 Starting batch processing..."]);
    
    // Create chunks based on newlines or approx words (simple split by newline for now)
    const lines = importText.split('\n').filter(l => l.trim().length > 0);
    const BATCH_SIZE = 15; // Process 15 lines/sentences at a time to avoid context limits
    const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
    
    setProgress({ current: 0, total: totalBatches });
    abortControllerRef.current = new AbortController();

    try {
        let addedCount = 0;
        
        for (let i = 0; i < lines.length; i += BATCH_SIZE) {
            const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
            const chunk = lines.slice(i, i + BATCH_SIZE).join('\n');
            
            setStatusLog(prev => [...prev, `⏳ Processing batch ${batchIndex}/${totalBatches}...`]);
            
            try {
                const items = await processVocabularyFromText(chunk, settings, abortControllerRef.current.signal);
                if (items.length > 0) {
                    setVocabulary(prev => [...prev, ...items]);
                    addedCount += items.length;
                    setStatusLog(prev => [...prev, `✅ Batch ${batchIndex}: Found ${items.length} words.`]);
                } else {
                     setStatusLog(prev => [...prev, `⚠️ Batch ${batchIndex}: No words found.`]);
                }
            } catch (err: any) {
                if (err.message.includes('cancelled') || err.message.includes('Aborted')) {
                    throw err; // Re-throw to exit main loop
                }
                setStatusLog(prev => [...prev, `❌ Batch ${batchIndex} Error: ${err.message}`]);
            }
            
            setProgress({ current: batchIndex, total: totalBatches });
        }
        
        setStatusLog(prev => [...prev, `🎉 Done! Added ${addedCount} total words.`]);
        setImportText('');
    } catch (e: any) {
        if (e.message.includes('cancelled') || e.message.includes('Aborted')) {
             // Already logged
        } else {
             setStatusLog(prev => [...prev, `❌ System Error: ${e.message}`]);
        }
    } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
    }
  };

  const handleExport = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vocabulary, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "vocabulary_lingoleap.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col w-[85vw] sm:w-80 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${className}`}
    >
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <BookOpen size={20} />
          Worldbook
        </h2>
        <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Target Level
        </label>
        <select 
            value={level} 
            onChange={(e) => setLevel(e.target.value as EnglishLevel)}
            className="w-full p-2 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
            {Object.values(EnglishLevel).map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
            ))}
        </select>
      </div>

      {isImportMode ? (
        <div className="flex-1 p-4 flex flex-col gap-3 bg-slate-50">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600"/> 
                    AI Smart Import
                </h3>
                <button 
                    onClick={() => setIsImportMode(false)}
                    disabled={isProcessing}
                    className="text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50"
                >
                    Back to List
                </button>
            </div>
            
            {isProcessing ? (
                <div className="flex-1 flex flex-col gap-4">
                     <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                            <span>Progress</span>
                            <span>{progress.current} / {progress.total} batches</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                            <div 
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                            ></div>
                        </div>
                        <button 
                            onClick={handleStopProcessing}
                            className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center justify-center gap-2"
                        >
                            <StopCircle size={16} /> Stop Import
                        </button>
                     </div>
                     <div className="flex-1 bg-black/80 rounded-lg p-3 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
                        {statusLog.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                        <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                     </div>
                </div>
            ) : (
                <>
                    <p className="text-xs text-slate-500">Paste any text. We'll split it into batches and extract vocab.</p>
                    <textarea
                        className="flex-1 w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-200 outline-none text-sm resize-none"
                        placeholder="e.g. Paste a full article here..."
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button 
                            onClick={handleAiProcess}
                            disabled={!importText.trim()}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex justify-center items-center gap-2"
                        >
                            <Sparkles size={16} /> Start Processing
                        </button>
                    </div>
                </>
            )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-slate-700">Vocabulary List</h3>
                <div className="flex gap-1">
                    <button onClick={() => setIsImportMode(true)} title="AI Import" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        <Upload size={16} />
                    </button>
                    <button onClick={handleExport} title="Export JSON" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        <Download size={16} />
                    </button>
                </div>
            </div>
            
            {vocabulary.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                    No words yet. Try AI Import!
                </div>
            )}

            {vocabulary.map((item) => (
            <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 group hover:border-indigo-300 transition-colors relative">
                <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-slate-800">{item.word}</p>
                    <p className="text-xs text-slate-500 italic">{item.partOfSpeech}</p>
                </div>
                <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-300 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                >
                    <Trash2 size={16} />
                </button>
                </div>
                <p className="text-sm text-slate-600 mt-1">{item.definition}</p>
            </div>
            ))}

            {isAdding ? (
            <div className="bg-white p-3 rounded-lg border-2 border-indigo-100 animate-in fade-in slide-in-from-bottom-2">
                <input
                autoFocus
                className="w-full mb-2 p-1 border-b border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium"
                placeholder="Word"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                />
                <input
                className="w-full mb-2 p-1 border-b border-slate-200 focus:border-indigo-500 outline-none text-sm"
                placeholder="Definition"
                value={newDef}
                onChange={(e) => setNewDef(e.target.value)}
                />
                <div className="flex gap-2 justify-end mt-2">
                    <button 
                        onClick={() => setIsAdding(false)}
                        className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleAddWord}
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                        Add
                    </button>
                </div>
            </div>
            ) : (
                <button 
                    onClick={() => setIsAdding(true)}
                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-2 text-sm transition-all"
                >
                    <Plus size={16} /> Add Manually
                </button>
            )}
        </div>
      )}
    </div>
  );
};

export default VocabularyPanel;