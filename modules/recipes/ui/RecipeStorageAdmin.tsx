/**
 * Recipes Admin — Storage Cleanup Tool
 *
 * Scans for and removes orphaned recipe images in Firebase Storage.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, ScanSearch } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';
import { cleanupOrphanedRecipeImages, type CleanupStats } from '../api';

export const RecipeStorageAdmin: React.FC = () => {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleScan = async () => {
    setIsLoading(true);
    try {
      const result = await cleanupOrphanedRecipeImages(true);
      setStats(result);
      if (result.errors.length > 0) {
        softToast.error('Scan completed with errors');
      } else if (result.orphanedFiles.length > 0) {
        softToast.info(`Found ${result.orphanedFiles.length} orphaned image${result.orphanedFiles.length === 1 ? '' : 's'}`);
      } else {
        softToast.success(`All ${result.totalFiles} images are in use`);
      }
    } catch {
      softToast.error('Scan failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!stats?.orphanedFiles.length) return;
    setIsLoading(true);
    try {
      const result = await cleanupOrphanedRecipeImages(false);
      setStats(result);
      if (result.errors.length > 0) {
        softToast.error(`Deleted ${result.deletedCount} files, ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`);
      } else {
        softToast.success(`Deleted ${result.deletedCount} orphaned image${result.deletedCount === 1 ? '' : 's'}`);
      }
    } catch {
      softToast.error('Deletion failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Orphaned images accumulate when recipes are deleted or replaced with a new image. Scan to find them, then delete to free up storage.
      </p>

      {stats && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total files</span>
            <span className="font-medium">{stats.totalFiles}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">In use</span>
            <span className="font-medium text-green-600 dark:text-green-400">{stats.referencedFiles.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Orphaned</span>
            <span className={`font-medium ${stats.orphanedFiles.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {stats.orphanedFiles.length}
            </span>
          </div>
          {stats.deletedCount > 0 && (
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Deleted</span>
              <span className="font-medium text-green-600 dark:text-green-400">{stats.deletedCount}</span>
            </div>
          )}
          {stats.errors.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {stats.errors.slice(0, 3).map((e, i) => <li key={i}>• {e}</li>)}
              {stats.errors.length > 3 && <li>• …and {stats.errors.length - 3} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={handleScan} disabled={isLoading} className="gap-2 flex-1">
          <ScanSearch className="h-4 w-4" />
          {isLoading && !stats ? 'Scanning…' : 'Scan'}
        </Button>
        {stats && stats.orphanedFiles.length > 0 && (
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading} className="gap-2 flex-1">
            <Trash2 className="h-4 w-4" />
            {isLoading ? 'Deleting…' : `Delete (${stats.orphanedFiles.length})`}
          </Button>
        )}
      </div>
    </div>
  );
};
