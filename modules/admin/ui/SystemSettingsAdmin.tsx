/**
 * Admin Module — System Settings Tool
 *
 * Manages kitchen directives (global AI rules) and debug mode toggle.
 * Self-contained: fetches and saves its own data via the planner API.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getKitchenSettings, updateKitchenSettings } from '../../planner/api';
import { debugLogger } from '@/shared/backend/debug-logger';
import type { KitchenSettings } from '@/types/contract';

export const SystemSettingsAdmin: React.FC = () => {
  const [settings, setSettings] = useState<KitchenSettings | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    getKitchenSettings().then(s => {
      setSettings(s);
      debugLogger.setEnabled(s.debugEnabled ?? false);
    });
  }, []);

  const save = async (updated: KitchenSettings) => {
    setSaveStatus('saving');
    try {
      await updateKitchenSettings(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  const handleDirectivesChange = (val: string) => {
    if (!settings) return;
    const updated = { ...settings, directives: val };
    setSettings(updated);
    setSaveStatus('saving');
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => save(updated), 1200);
  };

  const handleDebugToggle = (enabled: boolean) => {
    if (!settings) return;
    const updated = { ...settings, debugEnabled: enabled };
    setSettings(updated);
    debugLogger.setEnabled(enabled);
    save(updated);
  };

  if (!settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Kitchen Directives */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Global AI Rules</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              House rules applied to every Chef and Assist response
            </p>
          </div>
          {saveStatus !== 'idle' && (
            <Badge variant={saveStatus === 'saving' ? 'secondary' : 'default'} className="text-xs shrink-0">
              {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
            </Badge>
          )}
        </div>
        <Textarea
          id="directives"
          className="min-h-48 resize-y font-mono text-sm"
          placeholder={"- Prefer Anova over Rangemaster\n- No mushrooms\n- Always suggest metric substitutes"}
          value={settings.directives}
          onChange={e => handleDirectivesChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          One rule per line. These are injected into every AI system prompt.
        </p>
      </div>

      <Separator />

      {/* Debug Mode */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="debug-mode" className="text-sm font-medium">Debug Mode</Label>
          <p className="text-xs text-muted-foreground">
            {settings.debugEnabled ? 'Verbose logs visible in browser console' : 'Logs suppressed'}
          </p>
        </div>
        <Switch
          id="debug-mode"
          checked={settings.debugEnabled ?? false}
          onCheckedChange={handleDebugToggle}
        />
      </div>
    </div>
  );
};
