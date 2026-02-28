import React, { useState, useEffect, useRef } from 'react';
import { Stack } from '@/shared/components/primitives';
import { UsersModule } from './UsersModule';
import { AssistModeGuidesList } from './AssistModeGuidesList';
import { CollectionSelector } from './CollectionSelector';
import { CoFIDImport } from './CoFIDImport';
import { ImportCoFIDGroupMappings } from './ImportCoFIDGroupMappings';
import { FirestoreBrowser } from './FirestoreBrowser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddButton } from '@/components/ui/add-button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Trash2 } from 'lucide-react';
import { User, KitchenSettings, CollectionName } from '../../../types/contract';
import { getActiveBackendMode } from '../../../shared/backend/system-backend';
import { plannerBackend } from '../../planner';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { softToast } from '@/lib/soft-toast';
import { cleanupOrphanedRecipeImages, CleanupStats } from '../../admin/backend';

interface AdminModuleProps {
  users: User[];
  onRefresh: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>, selectedCollections: Set<CollectionName>) => void;
  onExport: (selectedCollections: Set<CollectionName>) => void;
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
  const [selectedCollections, setSelectedCollections] = useState<Set<CollectionName>>(new Set());
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [cleanupStats, setCleanupStats] = useState<CleanupStats | null>(null);
  const [isCleanupLoading, setIsCleanupLoading] = useState(false);
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

  const handleExportClick = () => {
    // If no collections selected, select all by default
    if (selectedCollections.size === 0) {
      setShowCollectionSelector(true);
    } else {
      onExport(selectedCollections);
    }
  };

  const handleImportClick = () => {
    // If no collections selected, select all by default
    if (selectedCollections.size === 0) {
      setShowCollectionSelector(true);
    } else {
      document.getElementById('admin-import')?.click();
    }
  };

  const handleScanOrphanedFiles = async () => {
    setIsCleanupLoading(true);
    try {
      const stats = await cleanupOrphanedRecipeImages(true);
      setCleanupStats(stats);
      
      if (stats.errors.length > 0) {
        softToast.error('Scan complete with errors', {
          description: `${stats.orphanedFiles.length} orphaned files found`,
        });
      } else if (stats.orphanedFiles.length > 0) {
        softToast.success('Scan complete', {
          description: `Found ${stats.orphanedFiles.length} orphaned recipe images`,
        });
      } else {
        softToast.info('No orphaned files', {
          description: `All ${stats.totalFiles} recipe images are in use`,
        });
      }
    } catch (error) {
      softToast.error('Scan failed', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsCleanupLoading(false);
    }
  };

  const handleDeleteOrphanedFiles = async () => {
    if (!cleanupStats || cleanupStats.orphanedFiles.length === 0) return;
    
    setIsCleanupLoading(true);
    try {
      const stats = await cleanupOrphanedRecipeImages(false);
      setCleanupStats(stats);
      
      if (stats.errors.length > 0) {
        softToast.error('Deletion complete with errors', {
          description: `Deleted ${stats.deletedCount} files, ${stats.errors.length} errors occurred`,
        });
      } else {
        softToast.success('Cleanup complete', {
          description: `Successfully deleted ${stats.deletedCount} orphaned image files`,
        });
      }
    } catch (error) {
      softToast.error('Deletion failed', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsCleanupLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Left Column: Infrastructure & Directives */}
        <Stack spacing="gap-6">
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

              {showCollectionSelector && (
                <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                  <CollectionSelector 
                    selectedCollections={selectedCollections}
                    onSelectionChange={setSelectedCollections}
                    isLoading={isImporting}
                  />
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCollectionSelector(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (selectedCollections.size > 0) {
                          onExport(selectedCollections);
                          setShowCollectionSelector(false);
                        }
                      }}
                      disabled={selectedCollections.size === 0}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Backup Selected
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <input 
                  type="file" 
                  id="admin-import" 
                  className="hidden" 
                  accept=".json" 
                  onChange={(e) => onImport(e, selectedCollections)} 
                />
                <Button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="flex-1"
                  variant="default"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Restore
                </Button>
                <Button
                  onClick={handleExportClick}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Backup
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Storage Cleanup Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="space-y-1">
                <CardTitle className="text-xl md:text-2xl">Storage Cleanup</CardTitle>
                <p className="text-sm text-muted-foreground">Remove unused recipe images from storage</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              <p className="text-sm text-muted-foreground">
                Orphaned recipe images are removed when recipes are deleted or replaced. Scan and delete them to free up storage space.
              </p>
              
              {cleanupStats && (
                <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total files:</span>
                      <span className="font-semibold">{cleanupStats.totalFiles}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">In use:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{cleanupStats.referencedFiles.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Orphaned:</span>
                      <span className={`font-semibold ${cleanupStats.orphanedFiles.length > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                        {cleanupStats.orphanedFiles.length}
                      </span>
                    </div>
                    {cleanupStats.deletedCount > 0 && (
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Deleted:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{cleanupStats.deletedCount}</span>
                      </div>
                    )}
                  </div>
                  
                  {cleanupStats.errors.length > 0 && (
                    <div className="rounded-md bg-destructive/10 p-2">
                      <p className="text-xs font-semibold text-destructive mb-1">Errors:</p>
                      <ul className="text-xs text-destructive/80 space-y-1">
                        {cleanupStats.errors.slice(0, 3).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                        {cleanupStats.errors.length > 3 && (
                          <li>• ... and {cleanupStats.errors.length - 3} more error(s)</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={handleScanOrphanedFiles}
                  disabled={isCleanupLoading}
                  variant="outline"
                  className="flex-1"
                >
                  {isCleanupLoading ? 'Scanning...' : 'Scan'}
                </Button>
                {cleanupStats && cleanupStats.orphanedFiles.length > 0 && (
                  <Button
                    onClick={handleDeleteOrphanedFiles}
                    disabled={isCleanupLoading}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isCleanupLoading ? 'Deleting...' : `Delete (${cleanupStats.orphanedFiles.length})`}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CoFID Import Card */}
          <CoFIDImport />

          {/* CoFID Group Mappings Import Card */}
          <ImportCoFIDGroupMappings />

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
              <textarea
                id="directives"
                className="flex min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder="- Prefer Anova over Rangemaster&#10;- No mushrooms&#10;- Always suggest metric substitutes"
                value={directives}
                onChange={(e) => handleUpdateDirectives(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                These house rules ensure the Chef's recommendations align with your setup.
              </p>
            </CardContent>
          </Card>
        </Stack>

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

      {/* Assist Mode Guides Management */}
      <AssistModeGuidesList onRefresh={onRefresh} />

      {/* Firestore Browser */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="p-4 md:p-6 border-b">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Firestore Browser</CardTitle>
            <p className="text-sm text-muted-foreground">Browse collections and export documents as JSON</p>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <FirestoreBrowser />
        </CardContent>
      </Card>
    </div>
  );
};
