import React, { useState } from 'react';
import { X, Settings as SettingsIcon, Layout, Cpu, User } from 'lucide-react';
import SystemTab from './settings/SystemTab';
import ConnectionTab from './settings/ConnectionTab';
import PersonaTab from './settings/PersonaTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Props are now handled via Store in child tabs, but we keep shell props for compatibility if needed
  // or simply remove them if we strictly use Store.
  // For this refactor, let's keep it minimal.
  settings?: any;
  setSettings?: any;
  vocabulary?: any;
  setVocabulary?: any;
  sessions?: any;
  setSessions?: any;
}

type SettingsTab = 'system' | 'ai' | 'persona';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('system');

  if (!isOpen) return null;

  const renderSidebar = () => (
      <div className="w-full md:w-48 flex md:flex-col gap-2 p-3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 overflow-x-auto shrink-0">
          <button 
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'system' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
              <Layout size={18} /> 系统与数据
          </button>
          <button 
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ai' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
              <Cpu size={18} /> AI 与语音
          </button>
          <button 
              onClick={() => setActiveTab('persona')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'persona' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
              <User size={18} /> 人设与记忆
          </button>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[95%] sm:w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white shrink-0">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <SettingsIcon size={20} /> 设置
          </h2>
          <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Area - Split View */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {renderSidebar()}
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                {activeTab === 'system' && <SystemTab />}
                {activeTab === 'ai' && <ConnectionTab />}
                {activeTab === 'persona' && <PersonaTab />}
            </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end shrink-0 bg-white">
            <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                完成
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;