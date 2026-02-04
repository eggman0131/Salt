
import React, { useState, useEffect, useRef } from 'react';
import { UsersModule } from './UsersModule';
import { Card, Button, Label } from './UI';
import { User, KitchenSettings } from '../types/contract';
import { getActiveBackendMode, saltBackend } from '../backend/api';

interface AdminModuleProps {
  users: User[];
  onRefresh: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  isImporting: boolean;
  lastSync?: string | null;
}

export const AdminModule: React.FC<AdminModuleProps> = ({ 
  users, 
  onRefresh, 
  onImport, 
  onExport, 
  isImporting,
  lastSync
}) => {
  const mode = getActiveBackendMode();
  const [directives, setDirectives] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = useRef<number | null>(null);

  // Re-fetch whenever lastSync changes (e.g. after import)
  useEffect(() => {
    saltBackend.getKitchenSettings().then(s => setDirectives(s.directives));
  }, [lastSync]);

  const handleUpdateDirectives = (val: string) => {
    setDirectives(val);
    setSaveStatus('saving');
    
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        await saltBackend.updateKitchenSettings({ directives: val });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error(err);
      }
    }, 1200);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* System Controls */}
        <Card className="p-8 border-l-4 border-l-[#2563eb] bg-white shadow-xl shadow-blue-500/5 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-gray-900">App Storage</h4>
              <div className="pt-2 flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Mode:</span>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                  mode === 'firebase' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {mode}
                </span>
              </div>
            </div>
            
            <div className="flex gap-4">
              <input 
                type="file" 
                id="admin-import" 
                className="hidden" 
                accept=".json" 
                onChange={onImport} 
              />
              <button 
                onClick={() => document.getElementById('admin-import')?.click()}
                disabled={isImporting}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-30"
                title="Import Kitchen State"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              </button>
              <button 
                onClick={onExport}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm active:scale-95 transition-all"
                title="Export Kitchen State"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              </button>
            </div>
          </div>
        </Card>

        {/* AI Directives */}
        <Card className="p-8 border-l-4 border-l-indigo-500 bg-white shadow-xl shadow-indigo-500/5">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-gray-900">Kitchen Directives</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">AI Global Preferences</p>
            </div>
            {saveStatus !== 'idle' && (
              <span className={`text-[8px] font-black uppercase tracking-tighter ${saveStatus === 'saving' ? 'text-blue-500 animate-pulse' : 'text-green-500'}`}>
                {saveStatus === 'saving' ? 'Syncing...' : 'Saved'}
              </span>
            )}
          </div>
          
          <div className="space-y-2">
            <Label className="text-[9px]">House Rules (Apply to all recipes)</Label>
            <textarea 
              className="w-full h-40 p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono leading-relaxed focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none placeholder:text-gray-300"
              placeholder="- Prefer Anova over Rangemaster&#10;- No mushrooms&#10;- Always suggest metric substitutes"
              value={directives}
              onChange={e => handleUpdateDirectives(e.target.value)}
            />
            <p className="text-[9px] text-gray-400 italic">These rules are fed to the Sous-Chef to ensure suggestions match your kitchen's logic.</p>
          </div>
        </Card>
      </div>

      <UsersModule users={users} onRefresh={onRefresh} />
    </div>
  );
};
