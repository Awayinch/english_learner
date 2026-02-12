import React, { useState, useRef } from 'react';
import { Sparkles, Server, StopCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { processVocabularyFromText } from '../../services/geminiService';

interface ImportToolsProps {
  onBack: () => void;
}

const ImportTools: React.FC<ImportToolsProps> = ({ onBack }) => {
    const { settings, setVocabulary } = useStore();
    const [importText, setImportText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStopProcessing = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setStatusLog(prev => [...prev, "🛑 用户取消操作。"]);
            setIsProcessing(false);
        }
    };

    const handleAiProcess = async () => {
        if (!importText.trim()) return;
        
        if (!settings.apiKey && !process.env.API_KEY) {
            alert("请先在设置中配置 API Key。");
            return;
        }

        setIsProcessing(true);
        setStatusLog(["🚀 开始批量处理...", `📡 使用通道: ${settings.baseUrl ? '代理/自定义 URL' : '官方 Google API'}`]);
        
        const lines = importText.split('\n').filter(l => l.trim().length > 0);
        const BATCH_SIZE = 15; 
        const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
        
        setProgress({ current: 0, total: totalBatches });
        abortControllerRef.current = new AbortController();

        try {
            let addedCount = 0;
            
            for (let i = 0; i < lines.length; i += BATCH_SIZE) {
                const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
                const chunk = lines.slice(i, i + BATCH_SIZE).join('\n');
                
                setStatusLog(prev => [...prev, `⏳ 正在处理第 ${batchIndex}/${totalBatches} 批...`]);
                
                try {
                    const items = await processVocabularyFromText(chunk, settings, abortControllerRef.current.signal);
                    if (items.length > 0) {
                        setVocabulary(prev => [...prev, ...items]);
                        addedCount += items.length;
                        setStatusLog(prev => [...prev, `✅ 第 ${batchIndex} 批: 发现 ${items.length} 个单词。`]);
                    } else {
                        setStatusLog(prev => [...prev, `⚠️ 第 ${batchIndex} 批: 未发现生词。`]);
                    }
                } catch (err: any) {
                    if (err.message.includes('cancelled') || err.message.includes('Aborted')) {
                        throw err; 
                    }
                    setStatusLog(prev => [...prev, `❌ 第 ${batchIndex} 批错误: ${err.message}`]);
                }
                
                setProgress({ current: batchIndex, total: totalBatches });
            }
            
            setStatusLog(prev => [...prev, `🎉 完成! 共添加 ${addedCount} 个单词。`]);
            setImportText('');
        } catch (e: any) {
            if (e.message.includes('cancelled') || e.message.includes('Aborted')) {
                // handled by stop button log
            } else {
                setStatusLog(prev => [...prev, `❌ 系统错误: ${e.message}`]);
            }
        } finally {
            setIsProcessing(false);
            abortControllerRef.current = null;
        }
    };

    return (
        <div className="flex-1 p-4 flex flex-col gap-3 bg-slate-50 min-h-0">
            <div className="flex justify-between items-center shrink-0">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600"/> 
                    AI 智能导入
                </h3>
                <button 
                    onClick={onBack}
                    disabled={isProcessing}
                    className="text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50"
                >
                    返回列表
                </button>
            </div>
            
            {isProcessing ? (
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm shrink-0">
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                            <span>进度</span>
                            <span>{progress.current} / {progress.total} 批</span>
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
                            <StopCircle size={16} /> 停止导入
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
                    <div className="text-xs text-slate-500 space-y-1 shrink-0">
                        <p>粘贴任意文本。我们会分批提取生词。</p>
                        <p className="text-indigo-600 flex items-center gap-1">
                            <Server size={10} /> 
                            使用: {settings.baseUrl ? '自定义代理 (Configured)' : '官方 Google API'}
                        </p>
                    </div>
                    <textarea
                        className="flex-1 w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-200 outline-none text-sm resize-none"
                        placeholder="例如: 在这里粘贴一整篇文章..."
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                    />
                    <div className="flex gap-2 shrink-0">
                        <button 
                            onClick={handleAiProcess}
                            disabled={!importText.trim()}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex justify-center items-center gap-2"
                        >
                            <Sparkles size={16} /> 开始处理
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default ImportTools;