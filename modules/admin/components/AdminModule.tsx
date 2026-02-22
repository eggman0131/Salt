import React, { useState, useEffect, useRef } from 'react';
import { UsersModule } from './UsersModule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddButton } from '@/components/ui/add-button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Upload, Download } from 'lucide-react';
import { User, KitchenSettings } from '../../../types/contract';
import { getActiveBackendMode } from '../../../shared/backend/system-backend';
import { plannerBackend } from '../../planner';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { softToast } from '@/lib/soft-toast';

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
  const [userOrder, setUserOrder] = useState<string[] | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = useRef<number | null>(null);

  const kitchenSettings: KitchenSettings = {
    directives,
    debugEnabled,
    userOrder,
  };

  // Fetch settings when lastSync changes (e.g. after import)
  useEffect(() => {
    plannerBackend.getKitchenSettings().then(s => {
      setDirectives(s.directives);
      setDebugEnabled(s.debugEnabled || false);
      setUserOrder(s.userOrder);
      debugLogger.setEnabled(s.debugEnabled || false);
    });
  }, [lastSync]);

  const handleSettingsChange = (settings: KitchenSettings) => {
    setDirectives(settings.directives);
    setDebugEnabled(settings.debugEnabled || false);
    setUserOrder(settings.userOrder);
  };

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
    <div className="min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-160px)] flex flex-col gap-4 md:gap-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Left Column: Infrastructure & Directives */}
        <div className="space-y-6">
          {/* System State Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="space-y-1">
                <CardTitle className="text-xl md:text-2xl">System State</CardTitle>
                <p className="text-sm text-muted-foreground">Current environment and sync status</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Environment:
                  </span>
                  <Badge 
                    variant={mode === 'firebase' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {mode}
                  </Badge>
                </div>
                {lastSync && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Synced:
                    </span>
                    <span className="text-xs text-foreground">
                      {new Date(lastSync).toLocaleString('en-GB', { 
                        dateStyle: 'medium', 
                        timeStyle: 'short' 
                      })}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-2">
                <input 
                  type="file" 
                  id="admin-import" 
                  className="hidden" 
                  accept=".json" 
                  onChange={onImport} 
                />
                <Button
                  onClick={() => document.getElementById('admin-import')?.click()}
                  disabled={isImporting}
                  className="flex-1"
                  variant="default"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Restore
                </Button>
                <Button
                  onClick={onExport}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Backup
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Development Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="space-y-1">
                <CardTitle className="text-xl md:text-2xl">Development</CardTitle>
                <p className="text-sm text-muted-foreground">Tools for diagnostics and interface checks</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="debug-mode" className="text-sm font-semibold">
                    Debug Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {debugEnabled ? 'Logs are visible in console' : 'Logs are suppressed'}
                  </p>
                </div>
                <Switch
                  id="debug-mode"
                  checked={debugEnabled}
                  onCheckedChange={handleToggleDebug}
                />
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-semibold">Toast Preview</p>
                <p className="text-xs text-muted-foreground">
                  Trigger the soft toast styles with sample messages.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      softToast.info('Inventory tip', {
                        description: 'Drag items to reorder the list.',
                      })
                    }
                  >
                    Info
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      softToast.success('Backup complete', {
                        description: 'Salt saved the latest kitchen state.',
                      })
                    }
                  >
                    Success
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      softToast.warning('Service warning', {
                        description: 'Check the hob settings before service.',
                      })
                    }
                  >
                    Warning
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      softToast.error('Import failed', {
                        description: 'The file could not be read.',
                      })
                    }
                  >
                    Destructive
                  </Button>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-semibold">Add Button</p>
                <p className="text-xs text-muted-foreground">
                  Standard extra-small add action.
                </p>
                <AddButton type="button" />
              </div>
            </CardContent>
          </Card>

          {/* Kitchen Directives Card */}
          <Card className="flex-1 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-xl md:text-2xl">Kitchen Directives</CardTitle>
                  <p className="text-sm text-muted-foreground">System prompts and kitchen guidelines</p>
                </div>
                {saveStatus !== 'idle' && (
                  <Badge 
                    variant={saveStatus === 'saving' ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {saveStatus === 'saving' ? 'Syncing...' : 'Saved'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-6">
              <Label htmlFor="directives" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Global AI Rules
              </Label>
              <Textarea
                id="directives"
                className="min-h-50 resize-none"
                placeholder="- Prefer Anova over Rangemaster&#10;- No mushrooms&#10;- Always suggest metric substitutes"
                value={directives}
                onChange={(e) => handleUpdateDirectives(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                These house rules ensure the Chef's recommendations align with your setup.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: User Management */}
        <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <UsersModule 
            users={users} 
            kitchenSettings={kitchenSettings}
            onRefresh={onRefresh}
            onSettingsChange={handleSettingsChange}
          />
        </Card>
      </div>
    </div>
  );
};
