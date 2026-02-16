
import React, { useState, useEffect, useRef } from 'react';
import { UsersModule } from '../../../components/UsersModule';
import { Card, Button, Label } from '../../../components/UI';
import { User, KitchenSettings } from '../../../types/contract';
import { getActiveBackendMode } from '../../../backend/api';
import { plannerBackend } from '../../planner';
import { debugLogger } from '../../../backend/debug-logger';

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
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = useRef<number | null>(null);

  // Re-fetch whenever lastSync changes (e.g. after import)
  useEffect(() => {
    plannerBackend.getKitchenSettings().then(s => {
      setDirectives(s.directives);
      setDebugEnabled(s.debugEnabled || false);
      debugLogger.setEnabled(s.debugEnabled || false);
    });
  }, [lastSync]);

  const handleUpdateDirectives = (val: string) => {
    setDirectives(val);
    setSaveStatus('saving');
    
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        await plannerBackend.updateKitchenSettings({ directives: val, debugEnabled });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error(err);
      }
    }, 1200);
  };

  const handleToggleDebug = async (enabled: boolean) => {
    setDebugEnabled(enabled);
    debugLogger.setEnabled(enabled);
    setSaveStatus('saving');
    
    try {
      await plannerBackend.updateKitchenSettings({ directives, debugEnabled: enabled });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-160px)] flex flex-col gap-6 animate-in fade-in duration-500 overflow-auto">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto min-h-0">
        {/* Left Column: Infrastructure & Directives */}
        <div className="flex flex-col gap-6 overflow-hidden min-h-0">
          {/* System Controls */}
          <Card className="p-6 md:p-8 border-l-4 border-l-orange-600 bg-white shadow-md shadow-orange-500/10 flex flex-col">
            <div className="space-y-6 flex-1 flex flex-col">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Infrastructure</p>
                <h4 className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">System State</h4>
                <div className="pt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Environment:</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      mode === 'firebase' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {mode}
                    </span>
                  </div>
                  {lastSync && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Last Synced:</span>
                      <span className="text-[10px] font-medium text-gray-600">{new Date(lastSync).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 pt-6 border-t border-gray-100 mt-auto">
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
                  className="flex-1 inline-flex items-center justify-center rounded-md bg-orange-600 text-white px-4 py-2.5 font-semibold hover:bg-orange-700 transition shadow-sm disabled:opacity-30 gap-2 text-sm"
                  title="Restore from Backup"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  Restore
                </button>
                <button 
                  onClick={onExport}
                  className="flex-1 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-700 px-4 py-2.5 font-semibold hover:bg-gray-50 transition shadow-sm gap-2 text-sm"
                  title="Create Backup"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Backup
                </button>
              </div>
            </div>
          </Card>

          {/* Debug Logger Controls */}
          <Card className="p-6 md:p-8 border-l-4 border-l-orange-600 bg-white shadow-md shadow-orange-500/10 flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Developer Tools</p>
                <h4 className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">Debug Logging</h4>
                <p className="text-xs text-gray-500 italic pt-2">
                  Control backend console logging for development and troubleshooting.
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-700">Debug Mode</span>
                  <span className="text-xs text-gray-500">
                    {debugEnabled ? 'Logs are visible in console' : 'Logs are suppressed'}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleDebug(!debugEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    debugEnabled ? 'bg-orange-600' : 'bg-gray-200'
                  }`}
                  aria-pressed={debugEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      debugEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* AI Directives */}
          <Card className="flex-1 p-6 md:p-8 border-l-4 border-l-orange-600 bg-white shadow-md shadow-orange-500/10 flex flex-col min-h-0">
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Configuration</p>
                <h4 className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">Kitchen Directives</h4>
              </div>
              {saveStatus !== 'idle' && (
                <span className={`text-[10px] font-bold uppercase tracking-wider ${saveStatus === 'saving' ? 'text-orange-600 animate-pulse' : 'text-green-600'}`}>
                  {saveStatus === 'saving' ? 'Syncing...' : 'Saved'}
                </span>
              )}
            </div>
            
            <div className="flex-1 flex flex-col space-y-3 min-h-0">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Global AI Rules</Label>
              <textarea 
                className="flex-1 w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans leading-relaxed focus:border-orange-500 focus:ring-orange-50 outline-none transition-all resize-none placeholder:text-gray-300"
                placeholder="- Prefer Anova over Rangemaster&#10;- No mushrooms&#10;- Always suggest metric substitutes"
                value={directives}
                onChange={e => handleUpdateDirectives(e.target.value)}
              />
              <p className="text-xs text-gray-500 italic mt-2 shrink-0">These house rules ensure the Chef's recommendations align with your setup.</p>
            </div>
          </Card>
        </div>

        {/* Right Column: User Management */}
        <Card className="flex flex-col border-l-4 border-l-orange-600 bg-white shadow-md shadow-orange-500/10 min-h-0 overflow-auto">
          <UsersModule users={users} onRefresh={onRefresh} />
        </Card>
      </div>


    </div>
  );
};
