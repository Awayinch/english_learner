import React from 'react';
import { Brain } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { EnglishLevel } from '../../types';

const PersonaTab: React.FC = () => {
    const { settings, setSettings } = useStore();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
           {/* Greeting */}
           <div className="space-y-1">
                <label className="block text-xs font-bold text-indigo-700">初始问候语</label>
                <textarea className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-20 resize-none shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="例如: Hello! How are you today?" value={settings.initialGreeting} onChange={(e) => setSettings(p => ({...p, initialGreeting: e.target.value}))} />
            </div>

            {/* Persona */}
            <div className="space-y-1">
                <label className="block text-xs font-bold text-indigo-700">系统人设 (Prompt)</label>
                <textarea className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-32 resize-none shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="定义 AI 的性格、角色..." value={settings.systemPersona} onChange={(e) => setSettings(p => ({...p, systemPersona: e.target.value}))} />
            </div>

            {/* Long Term Memory */}
            <div className="space-y-1">
                 <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-indigo-700 flex items-center gap-1">
                        <Brain size={12} /> 长期记忆/用户背景
                    </label>
                    <span className="text-[10px] text-slate-400">注入到 Prompt 中</span>
                 </div>
                 <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 mb-1 text-[10px] text-amber-800">
                     在此记录你的职业、兴趣或学习目标，AI 会记住并用于对话中。
                 </div>
                <textarea className="w-full p-3 rounded-lg border border-slate-300 outline-none text-sm h-32 resize-none shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="例如: 我是程序员，想学习商务英语..." value={settings.longTermMemory || ''} onChange={(e) => setSettings(p => ({...p, longTermMemory: e.target.value}))} />
            </div>
            
            <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 mb-1">难度等级</label>
                <select value={settings.level} onChange={(e) => setSettings(p => ({...p, level: e.target.value as EnglishLevel}))} className="w-full p-2 rounded border border-slate-300 text-sm">
                    {Object.values(EnglishLevel).map((lvl) => (
                        <option key={lvl as string} value={lvl as string}>{lvl as string}</option>
                    ))}
                </select>
            </div>
      </div>
    );
};

export default PersonaTab;