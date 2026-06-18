import React, { useState, useRef } from 'react';
import { VocabularyItem, EnglishLevel, Settings, ChatMessage, ChatSession } from '../types';
import { BookOpen, Plus, Trash2, X, Upload, Sparkles, Download, StopCircle, Cloud, Loader2, CheckCircle, AlertCircle, Search, Server, ListPlus, Play, MessageSquare, MessageSquarePlus, ChevronDown, ChevronRight, History, Edit2, Check, CheckSquare, Square, ListChecks } from 'lucide-react';
import { processVocabularyFromText, generateObsidianSummary, defineVocabularyBatch } from '../services/geminiService';
import { syncToGithub } from '../services/githubService';

interface VocabularyPanelProps {
  vocabulary: VocabularyItem[];
  setVocabulary: React.Dispatch<React.SetStateAction<VocabularyItem[]>>;
  level: EnglishLevel;
  setLevel: (level: EnglishLevel) => void;
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  messages: ChatMessage[]; 
  className?: string;
  pendingWords: string[];
  setPendingWords: React.Dispatch<React.SetStateAction<string[]>>;
  
  // New Session Props
  sessions: ChatSession[];
  currentSessionId: string;
  onSwitchSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onDeleteSessions: (ids: string[]) => void;
  onClearSessions: () => void;
}

const LOCAL_SYNONYM_MAP: Record<string, string[]> = {
  ephemeral: ['short-lived', 'temporary', 'fleeting'],
  serendipity: ['fortunate accident', 'chance discovery', 'happy coincidence'],
  eloquent: ['fluent', 'persuasive', 'expressive'],
  resilient: ['adaptable', 'tough', 'recovering quickly'],
  pragmatic: ['practical', 'realistic', 'sensible'],
  significant: ['important', 'notable', 'meaningful'],
  crucial: ['essential', 'critical', 'vital'],
  demonstrate: ['show', 'illustrate', 'prove'],
  indicate: ['show', 'suggest', 'signal'],
  improve: ['enhance', 'strengthen', 'upgrade'],
  decline: ['decrease', 'drop', 'deteriorate'],
  impact: ['effect', 'influence', 'consequence'],
  benefit: ['advantage', 'gain', 'value'],
  challenge: ['difficulty', 'obstacle', 'problem'],
  sustainable: ['long-term', 'durable', 'environmentally sound'],
  efficient: ['productive', 'effective', 'well-organized'],
  evidence: ['proof', 'support', 'indication'],
  factor: ['element', 'driver', 'cause'],
  policy: ['rule', 'strategy', 'guideline'],
  acquire: ['gain', 'obtain', 'learn']
};

const MORPHEME_HINTS = [
  { pattern: /^un/i, hint: 'un-: 否定或相反含义前缀' },
  { pattern: /^re/i, hint: 're-: 再次、返回或重复' },
  { pattern: /^pre/i, hint: 'pre-: 之前、预先' },
  { pattern: /^inter/i, hint: 'inter-: 之间、相互' },
  { pattern: /^trans/i, hint: 'trans-: 跨越、转化' },
  { pattern: /tion$/i, hint: '-tion: 行为、过程或状态名词后缀' },
  { pattern: /ment$/i, hint: '-ment: 行为结果或状态名词后缀' },
  { pattern: /ity$/i, hint: '-ity: 性质或状态名词后缀' },
  { pattern: /ive$/i, hint: '-ive: 具有某种倾向或性质的形容词后缀' },
  { pattern: /ous$/i, hint: '-ous: 具有某种特征的形容词后缀' },
  { pattern: /able$/i, hint: '-able: 能够被、具有某种能力' },
  { pattern: /ly$/i, hint: '-ly: 常见副词后缀' }
];

const inferWordFamily = (word: string, partOfSpeech: string) => {
  const lowerPart = partOfSpeech.toLowerCase();
  if (lowerPart.includes('verb') || lowerPart === 'v') {
      return [`${word}ing`, `${word}ed`, `${word}s`];
  }
  if (lowerPart.includes('adj')) {
      return [`${word}ly（副词候选）`, `${word}ness（名词候选）`];
  }
  if (lowerPart.includes('noun') || lowerPart === 'n') {
      return [`${word}s（复数候选）`, `${word}-based（复合修饰语候选）`];
  }
  return ['待结合词典继续补全词族'];
};

const buildGeneratedExample = (item: VocabularyItem) => {
  return `In an IELTS task, a learner can use "${item.word}" to discuss ${item.definition}.`;
};

const VocabularyPanel: React.FC<VocabularyPanelProps> = ({
  vocabulary,
  setVocabulary,
  level,
  setLevel,
  isOpen,
  onClose,
  settings,
  messages,
  className = "",
  pendingWords,
  setPendingWords,
  sessions,
  currentSessionId,
  onSwitchSession,
  onRenameSession,
  onNewChat,
  onDeleteSession,
  onDeleteSessions,
  onClearSessions
}) => {
  // Accordion State
  const [activeSection, setActiveSection] = useState<'chats' | 'assets' | 'vocab'>('assets');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const [newWord, setNewWord] = useState('');
  const [newDef, setNewDef] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Session Editing State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  // Batch Selection State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  
  // AI Import State
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImportMode, setIsImportMode] = useState(false);
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  
  // Progress State
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter Logic
  const filteredVocabulary = vocabulary.filter(item => 
    item.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);
  const allMessages = sessions.flatMap(session => session.messages);
  const userMessages = allMessages.filter(message => message.role === 'user');
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordEvidence = vocabulary.map(item => {
      const wordPattern = new RegExp(`\\b${escapeRegex(item.word.toLowerCase())}\\b`, 'i');
      const sourceMessage = allMessages.find(message => wordPattern.test(message.text.toLowerCase()));
      const exposureCount = allMessages.filter(message => wordPattern.test(message.text.toLowerCase())).length;
      const activeUseCount = userMessages.filter(message => wordPattern.test(message.text.toLowerCase())).length;
      const hasCoreFields = Boolean(item.word && item.definition && item.partOfSpeech);
      const hasContext = Boolean(item.example || item.generatedExample || item.sourceContext || sourceMessage);
      return {
          item,
          exposureCount,
          activeUseCount,
          sourceContext: item.sourceContext || sourceMessage?.text || '',
          isComplete: hasCoreFields && hasContext
      };
  });
  const completeCards = wordEvidence.filter(entry => entry.isComplete).length;
  const contextualizedWords = wordEvidence.filter(entry => entry.exposureCount > 0 || entry.item.example).length;
  const activelyUsedWords = wordEvidence.filter(entry => entry.activeUseCount > 0).length;
  const observedExposureEvents = wordEvidence.reduce((sum, entry) => sum + entry.exposureCount, 0);
  const activeUseEvents = wordEvidence.reduce((sum, entry) => sum + entry.activeUseCount, 0);
  const enhancedCards = vocabulary.filter(item => item.enhancedAt || item.generatedExample || item.sourceContext || item.roots?.length || item.synonyms?.length).length;
  const weakNodes = pendingWords.length + wordEvidence.filter(entry => !entry.isComplete).length;
  const completionRate = vocabulary.length === 0 ? 0 : Math.round((completeCards / vocabulary.length) * 100);
  const contextualizationRate = vocabulary.length === 0 ? 0 : Math.round((contextualizedWords / vocabulary.length) * 100);
  const activeUseRate = vocabulary.length === 0 ? 0 : Math.round((activelyUsedWords / vocabulary.length) * 100);
  const averageSessionDepth = sessions.length === 0 ? 0 : Math.round(totalMessages / sessions.length);
  const missingContextWords = wordEvidence.filter(entry => !entry.isComplete).map(entry => entry.item).slice(0, 4);
  const reinforcementNodes = [
      ...pendingWords.slice(0, 4).map(word => ({ label: word, reason: '待查询释义' })),
      ...missingContextWords.map(item => ({ label: item.word, reason: '待补充语境' }))
  ].slice(0, 4);
  const partOfSpeechCounts = vocabulary.reduce<Record<string, number>>((acc, item) => {
      const key = item.partOfSpeech || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
  }, {});
  const topCategories = Object.entries(partOfSpeechCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  const assetStats = [
      { label: '词汇卡片', value: vocabulary.length, source: '存储记录', tone: 'text-indigo-700 bg-indigo-50' },
      { label: '语境暴露', value: observedExposureEvents, source: '聊天文本命中', tone: 'text-sky-700 bg-sky-50' },
      { label: '主动使用', value: activeUseEvents, source: '用户消息命中', tone: 'text-emerald-700 bg-emerald-50' },
      { label: '深加工卡片', value: enhancedCards, source: '语境增强记录', tone: 'text-violet-700 bg-violet-50' }
  ];
  const measuredIndicators = [
      { label: '卡片完整率', value: `${completionRate}%`, detail: `${completeCards}/${vocabulary.length}`, theory: '词汇知识: form-meaning-use' },
      { label: '语境化率', value: `${contextualizationRate}%`, detail: `${contextualizedWords}/${vocabulary.length}`, theory: 'Nation: varied meetings' },
      { label: '输出迁移率', value: `${activeUseRate}%`, detail: `${activelyUsedWords}/${vocabulary.length}`, theory: 'meaning-focused output' },
      { label: '平均会话深度', value: averageSessionDepth, detail: `${totalMessages} 条消息`, theory: 'learning analytics trace' }
  ];
  const missingIndicators = [
      { label: '主动回忆成功率', theory: 'retrieval practice', requirement: '需要测验答题日志' },
      { label: '间隔复习逾期数', theory: 'spacing effect', requirement: '需要 nextReviewAt' },
      { label: '情绪/认知负荷', theory: 'SRL / cognitive load', requirement: '需要用户自评' }
  ];
  const enhancementRate = vocabulary.length === 0 ? 0 : Math.round((enhancedCards / vocabulary.length) * 100);
  const cardsNeedingEnhancement = Math.max(vocabulary.length - enhancedCards, 0);

  const findSourceContext = (word: string) => {
      const wordPattern = new RegExp(`\\b${escapeRegex(word.toLowerCase())}\\b`, 'i');
      const sourceMessage = allMessages.find(message => wordPattern.test(message.text.toLowerCase()));
      if (!sourceMessage) return '';
      return sourceMessage.text.length > 180 ? `${sourceMessage.text.slice(0, 180)}...` : sourceMessage.text;
  };

  const buildVocabularyEnhancement = (item: VocabularyItem): VocabularyItem => {
      const lowerWord = item.word.toLowerCase();
      const roots = item.roots?.length
          ? item.roots
          : MORPHEME_HINTS.filter(rule => rule.pattern.test(item.word)).map(rule => rule.hint);

      return {
          ...item,
          synonyms: item.synonyms?.length ? item.synonyms : (LOCAL_SYNONYM_MAP[lowerWord] || []),
          roots: roots.length > 0 ? roots : ['待词典确认词根/词缀'],
          wordFamily: item.wordFamily?.length ? item.wordFamily : inferWordFamily(item.word, item.partOfSpeech),
          generatedExample: item.generatedExample || item.example || buildGeneratedExample(item),
          sourceContext: item.sourceContext || findSourceContext(item.word),
          enhancedAt: Date.now(),
          enhancementMethod: '本地规则匹配 + 历史语境检索'
      };
  };

  const handleEnhanceAllCards = () => {
      if (vocabulary.length === 0) return;
      setVocabulary(prev => prev.map(item => buildVocabularyEnhancement(item)));
  };

  const handleEnhanceSingleCard = (id: string) => {
      setVocabulary(prev => prev.map(item => item.id === id ? buildVocabularyEnhancement(item) : item));
  };

  const escapeYaml = (value: string) => value.replace(/"/g, '\\"');

  const buildPkmMarkdown = () => {
      const now = new Date();
      const iso = now.toISOString();
      const dateStr = iso.split('T')[0];
      const formatList = (values?: string[]) => values?.length ? values.join('、') : '待补充';
      const vocabCards = vocabulary.map(item => {
          const evidence = wordEvidence.find(entry => entry.item.id === item.id);
          return `### [[词汇/雅思/${item.word}]]

- **词性**: ${item.partOfSpeech || 'unknown'}
- **释义**: ${item.definition}
- **原始例句**: ${item.example || '待补充'}
- **自动例句**: ${item.generatedExample || '待增强生成'}
- **同义表达**: ${formatList(item.synonyms)}
- **词根/构词提示**: ${formatList(item.roots)}
- **词族候选**: ${formatList(item.wordFamily)}
- **来源语境**: ${item.sourceContext || evidence?.sourceContext || '暂无历史语境命中'}
- **增强方式**: ${item.enhancementMethod || '待增强'}
- **标签**: #词汇/雅思 #个人知识管理/语言学习
- **复习状态**: ${evidence?.isComplete ? '已具备语境证据' : '待补充语境或复习记录'}
`;
      }).join('\n');

      const recentSessions = sessions.slice(0, 8).map(session => (
          `- [[学习会话/${session.title || '未命名会话'}]] - ${session.messages.length} 条消息`
      )).join('\n');

      return `---
title: "LingoLeap 雅思个人知识库导出 ${dateStr}"
created: "${iso}"
type: "个人语言知识管理"
target: "雅思备考"
level: "${escapeYaml(String(settings.level))}"
vocabulary_count: ${vocabulary.length}
session_count: ${sessions.length}
message_count: ${totalMessages}
tags:
  - 词汇/雅思
  - 个人知识管理/语言学习
  - 知识管理/SECI
---

# LingoLeap 雅思个人知识库

## 知识资产看板

| 指标 | 数值 | 说明 |
| --- | ---: | --- |
| 词汇卡片 | ${vocabulary.length} | 已外化保存的显性词汇节点 |
| 学习会话 | ${sessions.length} | 已保存的学习场景 |
| 消息痕迹 | ${totalMessages} | 可观测的学习过程数据 |
| 语境暴露事件 | ${observedExposureEvents} | 目标词在历史对话中出现的次数 |
| 主动使用事件 | ${activeUseEvents} | 目标词在学习者输出中出现的次数 |
| 完整卡片 | ${completeCards} | 具备词形、释义、词性与语境证据的卡片 |
| 深加工卡片 | ${enhancedCards} | 已补充同义词、构词或例句的卡片 |
| 待强化节点 | ${weakNodes} | 缺少定义、语境或复习记录的项目 |

## 指标口径说明

- **卡片完整率**: 依据词汇知识的 form、meaning、use 框架，检查词形、释义、词性与语境证据。
- **语境暴露**: 从历史对话日志中匹配目标词，不手动估计。
- **主动使用**: 只统计目标词出现在学习者消息中的次数。
- **待采集指标**: 主动回忆成功率、间隔复习逾期数、认知负荷等需要测验日志、复习日期或用户自评，当前不做伪推断。

## DIKW 映射

- **Data 数据**: 原始单词、聊天片段、阅读文本。
- **Information 信息**: 词性、释义、例句、来源语境。
- **Knowledge 知识**: 带标签、双链、语境暴露和主动使用痕迹的词汇卡片。
- **Wisdom 智慧**: 基于真实日志识别待强化节点，并规划复习。

## SECI 映射

- **Socialization 社会化**: 阅读与 AI 对话产生隐性语言输入。
- **Externalization 外化**: 生词记录把“不认识”转为显性卡片。
- **Combination 组合化**: 同义词、词根、例句、语境与 Markdown 双链形成知识网络。
- **Internalization 内化**: 复习、测验和再次使用推动知识转为语言能力。

## 近期学习会话

${recentSessions || '- 暂无学习会话。'}

## 词汇知识卡片

${vocabCards || '> 暂无词汇卡片。'}
`;
  };

  const handleExportPkmMarkdown = () => {
      const markdown = buildPkmMarkdown();
      const dateStr = new Date().toISOString().split('T')[0];
      const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `LingoLeap-雅思个人知识库-${dateStr}.md`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleAddWord = () => {
    if (newWord && newDef) {
      const newItem: VocabularyItem = {
        id: Date.now().toString(),
        word: newWord.trim(),
        definition: newDef.trim(),
        partOfSpeech: 'custom'
      };
      // Prepend to show at top
      setVocabulary([newItem, ...vocabulary]);
      setNewWord('');
      setNewDef('');
      setIsAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    setVocabulary(vocabulary.filter(v => v.id !== id));
  };
  
  const handleClearVocabulary = () => {
    if (confirm("确定要清空所有单词本吗？此操作无法撤销。")) {
        setVocabulary([]);
    }
  };

  const handleRemovePending = (word: string) => {
      setPendingWords(prev => prev.filter(w => w !== word));
  }

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setStatusLog(prev => [...prev, "🛑 用户取消操作。"]);
        setIsProcessing(false);
    }
  };
  
  const startEditingSession = (session: ChatSession) => {
      setEditingSessionId(session.id);
      setEditTitle(session.title);
  };
  
  const saveEditingSession = () => {
      if (editingSessionId) {
          onRenameSession(editingSessionId, editTitle);
          setEditingSessionId(null);
          setEditTitle('');
      }
  };
  
  const cancelEditingSession = () => {
      setEditingSessionId(null);
      setEditTitle('');
  };
  
  // Batch Mode Handlers
  const toggleSessionSelection = (id: string) => {
      const newSet = new Set(selectedSessionIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedSessionIds(newSet);
  };
  
  const toggleSelectAll = () => {
    if (selectedSessionIds.size === sessions.length) {
        setSelectedSessionIds(new Set());
    } else {
        setSelectedSessionIds(new Set(sessions.map(s => s.id)));
    }
  };
  
  const executeBatchDelete = () => {
      if (selectedSessionIds.size === 0) return;
      if (confirm(`确定删除选中的 ${selectedSessionIds.size} 个对话吗？`)) {
          onDeleteSessions(Array.from(selectedSessionIds));
          setSelectedSessionIds(new Set());
          setIsBatchMode(false);
      }
  };

  const handleSyncToGithub = async () => {
    if (!settings.githubToken || !settings.githubRepo) {
        setSyncStatus('error');
        setSyncMsg("请先在设置中配置 GitHub。");
        setTimeout(() => setSyncStatus('idle'), 3000);
        return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    try {
        const history = messages.map(m => ({ role: m.role, text: m.text }));
        const markdown = await generateObsidianSummary(history, vocabulary, settings);
        
        const dateStr = new Date().toISOString().split('T')[0];
        const contentWithHeader = `\n---\n## Session: ${new Date().toLocaleTimeString()}\n\n${markdown}\n`;
        
        const filename = `${dateStr}.md`; 
        await syncToGithub(settings, filename, contentWithHeader);

        setSyncStatus('success');
        setSyncMsg("已同步至 Obsidian!");
    } catch (e: any) {
        setSyncStatus('error');
        setSyncMsg(e.message || "同步失败");
    } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // --- Process Pending Queue ---
  const handleProcessPending = async () => {
      if (pendingWords.length === 0) return;
      if (!settings.apiKey && !process.env.API_KEY) {
        alert("请先在设置中配置 API Key。");
        return;
      }

      setIsProcessing(true);
      setStatusLog(["🚀 正在处理待查队列...", `📡 使用通道: ${settings.baseUrl ? '代理' : '官方 API'}`]);
      
      abortControllerRef.current = new AbortController();
      
      try {
          // Batch processing
          const items = await defineVocabularyBatch(pendingWords, settings, abortControllerRef.current.signal);
          if (items.length > 0) {
              setVocabulary(prev => [...prev, ...items]);
              setStatusLog(prev => [...prev, `✅ 已添加 ${items.length} 个单词。`]);
              setPendingWords([]); // Clear queue on success
          } else {
              setStatusLog(prev => [...prev, `⚠️ 未找到有效定义。`]);
          }
      } catch (err: any) {
          if (!err.message.includes('Aborted')) {
             setStatusLog(prev => [...prev, `❌ 错误: ${err.message}`]);
          }
      } finally {
          setIsProcessing(false);
          abortControllerRef.current = null;
          setTimeout(() => setStatusLog([]), 4000);
      }
  };

  // --- Process Text Block Import ---
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
                // This function respects settings.baseUrl (Proxy) internally
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
        } else {
             setStatusLog(prev => [...prev, `❌ 系统错误: ${e.message}`]);
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
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white shrink-0">
        <h2 className="font-semibold text-lg flex items-center gap-2">
           LingoLeap
        </h2>
        <div className="flex gap-2">
            <button 
                onClick={handleSyncToGithub} 
                className={`p-1 rounded hover:bg-indigo-500 transition-colors relative ${!settings.githubToken ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="同步到 Obsidian (GitHub)"
                disabled={isSyncing || !settings.githubToken}
            >
                {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Cloud size={20} />}
            </button>
            <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded">
                <X size={20} />
            </button>
        </div>
      </div>

      {syncStatus !== 'idle' && (
          <div className={`text-xs px-4 py-2 font-medium flex items-center gap-2 ${syncStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {syncStatus === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
              {syncMsg}
          </div>
      )}

      {/* ACCORDION: CHAT HISTORY */}
      <div className="border-b border-slate-200 flex-shrink-0">
          <button 
            onClick={() => setActiveSection(activeSection === 'chats' ? 'vocab' : 'chats')}
            className={`w-full flex items-center justify-between p-4 font-bold text-sm ${activeSection === 'chats' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
              <div className="flex items-center gap-2">
                  <History size={18} /> 历史对话
              </div>
              {activeSection === 'chats' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {activeSection === 'chats' && (
              <div className="bg-slate-50 pb-2 max-h-[40vh] overflow-y-auto animate-in slide-in-from-top-2">
                  <div className="p-2 space-y-2 sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                    <div className="flex gap-2">
                        <button 
                            onClick={onNewChat}
                            disabled={isBatchMode}
                            className={`flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-sm ${isBatchMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                        >
                            <MessageSquarePlus size={16} /> 新开对话
                        </button>
                         <button 
                            onClick={() => {
                                setIsBatchMode(!isBatchMode);
                                setSelectedSessionIds(new Set());
                            }}
                            className={`px-3 rounded-lg border flex items-center justify-center transition-colors ${isBatchMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600'}`}
                            title="批量管理"
                        >
                            <ListChecks size={18} />
                        </button>
                    </div>
                     {isBatchMode && (
                         <div className="flex justify-between items-center px-1 text-xs text-slate-500 animate-in slide-in-from-top-1">
                            <span>已选: {selectedSessionIds.size}</span>
                            <button onClick={toggleSelectAll} className="text-indigo-600 hover:underline">
                                {selectedSessionIds.size === sessions.length ? '取消全选' : '全选'}
                            </button>
                         </div>
                    )}
                  </div>
                  
                  <div className="px-2 space-y-1 mt-1">
                      {sessions.map(session => (
                        <div key={session.id}>
                          {editingSessionId === session.id ? (
                                <div className="p-2 flex items-center gap-2 bg-white rounded-lg border border-indigo-300 shadow-sm mx-1">
                                    <input
                                        autoFocus
                                        className="flex-1 min-w-0 text-sm outline-none text-indigo-700 bg-transparent"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEditingSession();
                                            if (e.key === 'Escape') cancelEditingSession();
                                            e.stopPropagation();
                                        }}
                                    />
                                    <button onClick={(e) => { e.stopPropagation(); saveEditingSession(); }} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={14}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); cancelEditingSession(); }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded"><X size={14}/></button>
                                </div>
                          ) : (
                            <div 
                                className={`group flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer border transition-all ${
                                    currentSessionId === session.id && !isBatchMode
                                    ? 'bg-white border-indigo-200 shadow-sm text-indigo-700 font-medium' 
                                    : 'bg-transparent border-transparent hover:bg-slate-200 text-slate-600'
                                }`}
                                onClick={() => {
                                    if (isBatchMode) {
                                        toggleSessionSelection(session.id);
                                    } else {
                                        onSwitchSession(session.id);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 overflow-hidden w-full">
                                    {isBatchMode ? (
                                        <div className={`shrink-0 ${selectedSessionIds.has(session.id) ? 'text-indigo-600' : 'text-slate-300'}`}>
                                            {selectedSessionIds.has(session.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </div>
                                    ) : (
                                        <MessageSquare size={14} className="flex-shrink-0 opacity-70"/>
                                    )}
                                    <span className={`truncate ${isBatchMode && selectedSessionIds.has(session.id) ? 'text-indigo-700 font-medium' : ''}`}>{session.title}</span>
                                </div>
                                {!isBatchMode && (
                                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startEditingSession(session); }}
                                            className="text-slate-400 hover:text-indigo-500 p-1"
                                            title="重命名"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                            className="text-slate-400 hover:text-red-500 p-1"
                                            title="删除"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {isBatchMode ? (
                    <div className="px-2 mt-4 pt-2 border-t border-slate-200 flex gap-2">
                        <button 
                            onClick={() => setIsBatchMode(false)}
                            className="flex-1 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50"
                        >
                            取消
                        </button>
                        <button 
                            onClick={executeBatchDelete}
                            disabled={selectedSessionIds.size === 0}
                            className="flex-[2] py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            <Trash2 size={12} /> 删除 ({selectedSessionIds.size})
                        </button>
                    </div>
                ) : (
                    sessions.length > 0 && (
                        <div className="px-2 mt-4 pt-2 border-t border-slate-200">
                             <button 
                                onClick={() => { if(confirm('确定删除所有历史记录吗？')) onClearSessions(); }}
                                className="w-full py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <Trash2 size={12} /> 清空所有对话
                            </button>
                        </div>
                    )
                  )}
              </div>
          )}
      </div>

      {/* ACCORDION: KNOWLEDGE ASSETS */}
      <div className="border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setActiveSection(activeSection === 'assets' ? 'vocab' : 'assets')}
            className={`w-full flex items-center justify-between p-4 font-bold text-sm ${activeSection === 'assets' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
              <div className="flex items-center gap-2">
                  <ListChecks size={18} /> 知识资产看板
              </div>
              {activeSection === 'assets' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {activeSection === 'assets' && (
              <div className="bg-slate-50 p-3 max-h-[58vh] overflow-y-auto animate-in slide-in-from-top-2 space-y-3">
                  <div className="rounded-lg bg-white border border-indigo-100 p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                          <div>
                              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">IELTS PKM Dashboard</p>
                              <h3 className="text-sm font-semibold text-slate-800">个人语言知识资产</h3>
                              <p className="mt-0.5 text-[10px] text-slate-400">基于本地词库、对话日志和用户输出计算</p>
                          </div>
                          <button
                              onClick={handleExportPkmMarkdown}
                              className="shrink-0 px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1"
                              title="导出 Obsidian Markdown"
                          >
                              <Download size={13} /> PKM
                          </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3">
                          {assetStats.map(stat => (
                              <div key={stat.label} className={`rounded-md p-2 ${stat.tone}`}>
                                  <p className="text-[10px] opacity-80">{stat.label}</p>
                                  <p className="text-lg font-bold leading-tight">{stat.value}</p>
                                  <p className="text-[9px] opacity-70 mt-0.5">{stat.source}</p>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm">
                      <p className="font-semibold text-slate-700">方法口径</p>
                      <p className="mt-1 leading-relaxed">
                          本看板只统计可观测学习痕迹：词卡字段、历史对话命中、用户主动使用。测验正确率、间隔复习和心理负荷需要后续日志，当前标为待采集。
                      </p>
                  </div>

                  <div className="rounded-lg border border-violet-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                          <div>
                              <p className="text-xs font-semibold text-slate-700">语境自动化增强</p>
                              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                                  自动匹配同义表达、词根/构词提示、词族候选和 IELTS 场景例句。
                              </p>
                          </div>
                          <button
                              onClick={handleEnhanceAllCards}
                              disabled={vocabulary.length === 0}
                              className="shrink-0 px-2.5 py-1.5 bg-violet-600 text-white rounded text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                              title="批量生成完整知识卡片"
                          >
                              <Sparkles size={13} /> 增强
                          </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                          <div className="rounded bg-violet-50 p-2 text-violet-700">
                              <p className="text-[10px] opacity-80">已深加工</p>
                              <p className="text-base font-bold">{enhancedCards}</p>
                          </div>
                          <div className="rounded bg-slate-50 p-2 text-slate-700">
                              <p className="text-[10px] opacity-80">待增强</p>
                              <p className="text-base font-bold">{cardsNeedingEnhancement}</p>
                          </div>
                          <div className="rounded bg-emerald-50 p-2 text-emerald-700">
                              <p className="text-[10px] opacity-80">增强率</p>
                              <p className="text-base font-bold">{enhancementRate}%</p>
                          </div>
                      </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-700">已观测指标</p>
                          <span className="text-[10px] text-slate-400">基于本地学习日志</span>
                      </div>
                      <div className="space-y-2">
                          {measuredIndicators.map(indicator => (
                              <div key={indicator.label} className="rounded-md bg-slate-50 p-2">
                                  <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                          <p className="text-xs font-medium text-slate-700">{indicator.label}</p>
                                          <p className="text-[10px] text-slate-400 truncate">{indicator.theory}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                          <p className="text-sm font-bold text-slate-800">{indicator.value}</p>
                                          <p className="text-[10px] text-slate-400">{indicator.detail}</p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="rounded-lg bg-white border border-amber-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-700">待采集指标</p>
                          <span className="text-[10px] text-amber-600">不做伪推断</span>
                      </div>
                      <div className="space-y-1.5">
                          {missingIndicators.map(indicator => (
                              <div key={indicator.label} className="rounded bg-amber-50 px-2 py-1.5 text-xs">
                                  <div className="flex justify-between gap-2">
                                      <span className="font-medium text-amber-800">{indicator.label}</span>
                                      <span className="shrink-0 text-amber-600">待采集</span>
                                  </div>
                                  <p className="text-[10px] text-amber-700">{indicator.theory} · {indicator.requirement}</p>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                      <p className="text-xs font-semibold text-slate-700 mb-2">DIKW 知识流转</p>
                      <div className="grid grid-cols-4 gap-1 text-center">
                          {[
                              ['Data', totalMessages],
                              ['Info', completeCards],
                              ['Know', contextualizedWords],
                              ['Use', activeUseEvents]
                          ].map(([label, value]) => (
                              <div key={label} className="rounded bg-slate-50 p-1.5">
                                  <p className="text-[10px] text-slate-400">{label}</p>
                                  <p className="text-sm font-bold text-slate-700">{value}</p>
                              </div>
                          ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>采集</span>
                          <span>加工</span>
                          <span>沉淀</span>
                          <span>内化</span>
                      </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-semibold text-slate-700">待强化节点</p>
                          <span className="text-[10px] text-slate-400">{weakNodes} 项</span>
                      </div>
                      <div className="space-y-1.5">
                          {reinforcementNodes.length > 0 ? reinforcementNodes.map(node => (
                              <div key={`${node.label}-${node.reason}`} className="flex items-center justify-between gap-2 rounded bg-rose-50 px-2 py-1.5 text-xs">
                                  <span className="truncate font-medium text-rose-700">{node.label}</span>
                                  <span className="shrink-0 text-rose-400">{node.reason}</span>
                              </div>
                          )) : (
                              <div className="rounded bg-emerald-50 px-2 py-2 text-xs text-emerald-700">
                                  当前没有明显薄弱节点
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                      <p className="text-xs font-semibold text-slate-700 mb-2">知识类别分布</p>
                      <div className="space-y-2">
                          {topCategories.length > 0 ? topCategories.map(([label, count]) => {
                              const width = Math.round((count / Math.max(vocabulary.length, 1)) * 100);
                              return (
                                  <div key={label}>
                                      <div className="flex justify-between text-[11px] mb-1">
                                          <span className="text-slate-600 truncate">{label}</span>
                                          <span className="text-slate-400">{count}</span>
                                      </div>
                                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${width}%` }} />
                                      </div>
                                  </div>
                              );
                          }) : (
                              <p className="text-xs text-slate-400">暂无词汇类别数据</p>
                          )}
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* ACCORDION: VOCABULARY */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
          <button 
            onClick={() => setActiveSection(activeSection === 'vocab' ? 'chats' : 'vocab')}
            className={`w-full flex items-center justify-between p-4 font-bold text-sm flex-shrink-0 border-b border-slate-200 ${activeSection === 'vocab' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
              <div className="flex items-center gap-2">
                  <BookOpen size={18} /> 生词本 ({vocabulary.length})
              </div>
              {activeSection === 'vocab' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        
        {activeSection === 'vocab' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-top-2">
            {/* Level Selector */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    当前难度
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

            {/* PENDING QUEUE SECTION */}
            {pendingWords.length > 0 && !isImportMode && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 shrink-0">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-2 uppercase tracking-wide">
                            <ListPlus size={14} /> 待查询队列 ({pendingWords.length})
                        </h3>
                        {isProcessing && <Loader2 size={14} className="animate-spin text-indigo-600"/>}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto">
                        {pendingWords.map(word => (
                            <span key={word} className="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                                {word}
                                <button onClick={() => handleRemovePending(word)} className="text-indigo-300 hover:text-red-500"><X size={12}/></button>
                            </span>
                        ))}
                    </div>
                    
                    {isProcessing && (
                            <div className="w-full bg-indigo-200 rounded-full h-1.5 mb-2 overflow-hidden">
                            <div className="bg-indigo-600 h-full w-full animate-pulse"></div>
                        </div>
                    )}

                    <div className="flex gap-2">
                            <button
                            onClick={() => setPendingWords([])}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded text-xs font-medium hover:text-red-600 hover:border-red-200"
                            disabled={isProcessing}
                        >
                            清空
                        </button>
                        <button 
                            onClick={handleProcessPending}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2"
                            disabled={isProcessing}
                        >
                            {isProcessing ? '处理中...' : '开始批量查询'} <Play size={10} fill="currentColor"/>
                        </button>
                    </div>
                    {statusLog.length > 0 && isProcessing && (
                            <div className="mt-2 text-[10px] text-indigo-600 font-mono">
                            {statusLog[statusLog.length - 1]}
                            </div>
                    )}
                </div>
            )}

            {isImportMode ? (
                <div className="flex-1 p-4 flex flex-col gap-3 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Sparkles size={16} className="text-indigo-600"/> 
                            AI 智能导入
                        </h3>
                        <button 
                            onClick={() => setIsImportMode(false)}
                            disabled={isProcessing}
                            className="text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50"
                        >
                            返回列表
                        </button>
                    </div>
                    
                    {isProcessing ? (
                        <div className="flex-1 flex flex-col gap-4">
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
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
                            <div className="text-xs text-slate-500 space-y-1">
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
                            <div className="flex gap-2">
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
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-0">
                    <div className="sticky top-0 bg-slate-50 pt-4 pb-2 z-10">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-semibold text-slate-700">词汇列表</h3>
                            <div className="flex gap-1">
                                <button onClick={handleExportPkmMarkdown} title="导出中文 Obsidian Markdown" className="px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded flex items-center gap-1">
                                    <Download size={14} /> PKM
                                </button>
                                <button onClick={handleEnhanceAllCards} title="语境自动化增强" className="px-2 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 rounded flex items-center gap-1">
                                    <Sparkles size={14} /> 增强
                                </button>
                                <button onClick={() => setIsImportMode(true)} title="AI 智能导入" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                    <Upload size={16} />
                                </button>
                                <button onClick={handleExport} title="导出 JSON" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Search Input (Sticky Context) */}
                        <div className="relative shadow-sm rounded-lg">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={14} className="text-slate-400" />
                            </div>
                            <input 
                                type="text"
                                placeholder="搜索单词..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white transition-colors"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Manual Add Button/Form - Moved Here */}
                    {isAdding ? (
                    <div className="bg-white p-3 rounded-lg border-2 border-indigo-100 animate-in fade-in slide-in-from-top-2">
                        <input
                        autoFocus
                        className="w-full mb-2 p-1 border-b border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium"
                        placeholder="单词"
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        />
                        <input
                        className="w-full mb-2 p-1 border-b border-slate-200 focus:border-indigo-500 outline-none text-sm"
                        placeholder="定义"
                        value={newDef}
                        onChange={(e) => setNewDef(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end mt-2">
                            <button 
                                onClick={() => setIsAdding(false)}
                                className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleAddWord}
                                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                                添加
                            </button>
                        </div>
                    </div>
                    ) : (
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-2 text-sm transition-all"
                        >
                            <Plus size={16} /> 手动添加
                        </button>
                    )}
                    
                    {vocabulary.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            暂无单词。试试 AI 导入!
                        </div>
                    )}
                    
                    {vocabulary.length > 0 && filteredVocabulary.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            未找到匹配的单词。
                        </div>
                    )}

                    {filteredVocabulary.map((item) => (
                    <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 group hover:border-indigo-300 transition-colors relative">
                        <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-slate-800">{item.word}</p>
                            <p className="text-xs text-slate-500 italic">{item.partOfSpeech}</p>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => handleEnhanceSingleCard(item.id)}
                                className="text-slate-300 hover:text-violet-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                                title="增强知识卡片"
                            >
                                <Sparkles size={15} />
                            </button>
                            <button
                                onClick={() => handleDelete(item.id)}
                                className="text-slate-300 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{item.definition}</p>
                        {(item.generatedExample || item.synonyms?.length || item.roots?.length || item.sourceContext) && (
                            <div className="mt-2 rounded-md bg-white border border-violet-100 p-2 text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-violet-700">语境增强卡片</span>
                                    <span className="text-[10px] text-slate-400">{item.enhancementMethod || '本地增强'}</span>
                                </div>
                                {item.synonyms?.length ? (
                                    <p className="text-slate-600"><span className="text-slate-400">同义:</span> {item.synonyms.join('、')}</p>
                                ) : (
                                    <p className="text-slate-400">同义: 待词典确认</p>
                                )}
                                {item.roots?.length && (
                                    <p className="text-slate-600"><span className="text-slate-400">构词:</span> {item.roots.slice(0, 2).join('；')}</p>
                                )}
                                {item.wordFamily?.length && (
                                    <p className="text-slate-600"><span className="text-slate-400">词族:</span> {item.wordFamily.join('、')}</p>
                                )}
                                {item.generatedExample && (
                                    <p className="text-slate-600"><span className="text-slate-400">例句:</span> {item.generatedExample}</p>
                                )}
                                {item.sourceContext && (
                                    <p className="text-slate-500 max-h-10 overflow-hidden"><span className="text-slate-400">来源:</span> {item.sourceContext}</p>
                                )}
                            </div>
                        )}
                    </div>
                    ))}
                    
                    {vocabulary.length > 0 && (
                        <div className="pt-4 border-t border-slate-200">
                             <button 
                                onClick={handleClearVocabulary}
                                className="w-full py-2 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <Trash2 size={12} /> 清空所有单词
                            </button>
                        </div>
                    )}
                </div>
            )}
            </div>
          )}
      </div>
    </div>
  );
};

export default VocabularyPanel;
