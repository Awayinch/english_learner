import React, { useState, useRef } from 'react';
import { FileText, Play, CheckCircle, XCircle, RefreshCw, BookOpen, AlertCircle, ChevronRight, Upload, X, File, Image as ImageIcon } from 'lucide-react';
import { QuizQuestion, Settings } from '../types';
import { parseQuizFromText } from '../services/geminiService';

interface QuizModeProps {
  settings: Settings;
}

interface AttachedFile {
  name: string;
  type: string;
  data: string; // base64 string without prefix for API
  previewUrl?: string; // for displaying images
}

const QuizMode: React.FC<QuizModeProps> = ({ settings }) => {
  const [step, setStep] = useState<'import' | 'taking' | 'review'>('import');
  const [rawText, setRawText] = useState('');
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [score, setScore] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // split "data:application/pdf;base64,....."
      const base64Data = result.split(',')[1]; 
      
      setAttachedFile({
        name: file.name,
        type: file.type,
        data: base64Data,
        previewUrl: file.type.startsWith('image/') ? result : undefined
      });
    };
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!rawText.trim() && !attachedFile) return;
    
    setIsProcessing(true);
    try {
        const parsed = await parseQuizFromText(
            rawText, 
            attachedFile ? { data: attachedFile.data, mimeType: attachedFile.type } : null,
            settings
        );
        setQuestions(parsed);
        if (parsed.length > 0) setStep('taking');
        else alert("AI 无法从该内容生成问题。请尝试更清晰的文本或不同的文件。");
    } catch (e: any) {
        alert(e.message || "生成测验失败。如果上传了文件，请确保文件小于 20MB。");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSelectOption = (qId: string, optIndex: number) => {
    setQuestions(questions.map(q => 
        q.id === qId ? { ...q, userSelectedIndex: optIndex } : q
    ));
  };

  const handleSubmit = () => {
    let correctCount = 0;
    questions.forEach(q => {
        if (q.userSelectedIndex === q.correctAnswerIndex) correctCount++;
    });
    setScore(correctCount);
    setStep('review');
  };

  const reset = () => {
      setStep('import');
      setQuestions([]);
      setRawText('');
      setAttachedFile(null);
      setScore(0);
  };

  if (step === 'import') {
    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4 text-indigo-700">
                    <div className="p-2 bg-indigo-100 rounded-lg"><FileText size={24} /></div>
                    <h2 className="text-xl font-bold">导入测验材料</h2>
                </div>
                <p className="text-slate-500 text-sm mb-4">
                    粘贴文本或上传文档（PDF、图片、文本）。AI 将分析内容并生成评分测试。
                </p>
                
                {/* Text Input */}
                <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full h-32 p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none mb-4 text-sm"
                    placeholder="输入主题，粘贴文章文本，或留空直接上传文件..."
                />

                {/* File Upload Area */}
                <div className="mb-6">
                    {!attachedFile ? (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all group"
                        >
                            <div className="p-3 bg-slate-100 rounded-full text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 mb-2 transition-colors">
                                <Upload size={24} />
                            </div>
                            <p className="text-sm font-medium text-slate-600">点击上传文件</p>
                            <p className="text-xs text-slate-400 mt-1">支持 PDF, JPG, PNG, TXT (最大 20MB)</p>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                className="hidden"
                                accept=".pdf,image/*,.txt" 
                                onChange={handleFileChange}
                            />
                        </div>
                    ) : (
                        <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 overflow-hidden">
                                {attachedFile.previewUrl ? (
                                    <img src={attachedFile.previewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-indigo-200" />
                                ) : (
                                    <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center text-indigo-600">
                                        <File size={20} />
                                    </div>
                                )}
                                <div className="truncate">
                                    <p className="text-sm font-semibold text-indigo-900 truncate max-w-[200px]">{attachedFile.name}</p>
                                    <p className="text-xs text-indigo-600 uppercase">{attachedFile.type.split('/')[1] || 'FILE'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={clearFile}
                                className="p-2 text-indigo-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isProcessing || (!rawText.trim() && !attachedFile)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md flex justify-center items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? <RefreshCw className="animate-spin" /> : <Play size={20} />}
                    {isProcessing ? 'AI 正在分析...' : '生成测验'}
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-20">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="text-indigo-600"/> 
                {step === 'review' ? '测验结果' : '测验模式'}
            </h2>
            {step === 'review' && (
                <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg font-bold">
                    得分: {score} / {questions.length}
                </div>
            )}
        </div>

        <div className="space-y-6">
            {questions.map((q, qIdx) => {
                const isCorrect = q.userSelectedIndex === q.correctAnswerIndex;
                const showResults = step === 'review';
                
                return (
                    <div key={q.id} className={`bg-white rounded-2xl p-6 shadow-sm border-l-4 transition-all ${
                        showResults 
                            ? (isCorrect ? 'border-l-green-500' : 'border-l-red-500') 
                            : 'border-l-indigo-500'
                    }`}>
                        <div className="flex justify-between items-start mb-4">
                             <h3 className="font-semibold text-lg text-slate-800">
                                <span className="text-slate-400 mr-2">#{qIdx + 1}</span>
                                {q.question}
                            </h3>
                            {showResults && (
                                isCorrect 
                                    ? <CheckCircle className="text-green-500 shrink-0" size={24} />
                                    : <XCircle className="text-red-500 shrink-0" size={24} />
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {q.options.map((opt, oIdx) => {
                                let btnClass = "border-slate-200 hover:bg-slate-50 text-slate-700";
                                
                                if (showResults) {
                                    if (oIdx === q.correctAnswerIndex) {
                                        btnClass = "bg-green-100 border-green-300 text-green-800 font-medium";
                                    } else if (oIdx === q.userSelectedIndex && oIdx !== q.correctAnswerIndex) {
                                        btnClass = "bg-red-50 border-red-200 text-red-700";
                                    } else {
                                        btnClass = "opacity-60 border-slate-100";
                                    }
                                } else {
                                    if (q.userSelectedIndex === oIdx) {
                                        btnClass = "bg-indigo-50 border-indigo-400 text-indigo-700 ring-1 ring-indigo-400";
                                    }
                                }

                                return (
                                    <button
                                        key={oIdx}
                                        disabled={showResults}
                                        onClick={() => handleSelectOption(q.id, oIdx)}
                                        className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${btnClass}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs flex-shrink-0 ${
                                            showResults && oIdx === q.correctAnswerIndex 
                                                ? 'bg-green-500 text-white border-green-500' 
                                                : 'bg-white border-slate-300'
                                        }`}>
                                            {String.fromCharCode(65 + oIdx)}
                                        </div>
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>

                        {showResults && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                                <div className="flex items-center gap-2 font-semibold text-indigo-700 mb-1">
                                    <AlertCircle size={16} /> 解析 (Explanation)
                                </div>
                                <p className="text-slate-600 leading-relaxed">{q.explanation}</p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        <div className="mt-8 flex justify-end pb-10">
            {step === 'taking' ? (
                <button
                    onClick={handleSubmit}
                    disabled={questions.some(q => q.userSelectedIndex === undefined)}
                    className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    提交答案 <ChevronRight size={20} />
                </button>
            ) : (
                <button
                    onClick={reset}
                    className="w-full sm:w-auto px-8 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold shadow-sm"
                >
                    开始新测验
                </button>
            )}
        </div>
    </div>
  );
};

export default QuizMode;