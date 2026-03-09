import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { softToast } from '@/lib/soft-toast';
import { syncPlannerToList } from '../../api';
import type { SyncResult } from '../../types';

interface PlannerSyncPanelProps {
  listId: string;
  weekStartDate: string;
  onSynced: () => void;
}

export const PlannerSyncPanel: React.FC<PlannerSyncPanelProps> = ({
  listId,
  weekStartDate,
  onSynced,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncPlannerToList(weekStartDate, listId);
      setLastResult(result);

      if (result.added === 0 && result.skipped > 0 && result.needsReview === 0) {
        softToast.info("This week's recipes are already on the list");
      } else {
        const parts: string[] = [];
        if (result.added > 0) parts.push(`${result.added} items added`);
        if (result.needsReview > 0) parts.push(`${result.needsReview} to review`);
        if (result.skipped > 0) parts.push(`${result.skipped} recipes already synced`);
        softToast.success(parts.join(', ') || 'List synced');
      }

      onSynced();
    } catch {
      softToast.error('Failed to sync from planner');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm font-medium">Sync from planner</p>
          <p className="text-xs text-muted-foreground">
            Add this week's planned recipes to the list
          </p>
          {lastResult && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last sync: {lastResult.added} added
              {lastResult.needsReview > 0 && `, ${lastResult.needsReview} to review`}
              {lastResult.skipped > 0 && `, ${lastResult.skipped} skipped`}
            </p>
          )}
        </div>
        <Button onClick={handleSync} disabled={isSyncing} className="shrink-0">
          {isSyncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {isSyncing ? 'Syncing...' : 'Sync'}
        </Button>
      </CardContent>
    </Card>
  );
};
