/**
 * Admin Module — Dashboard UI
 *
 * Dynamically loads and displays admin tools from domain modules.
 * Follows the manifest pattern defined in salt-architecture.md.
 */

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { loadAllManifests, type AdminManifest, type AdminTool } from '../api';
import { RefreshContext } from '@/shared/providers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Main admin dashboard component.
 * Loads manifests from all domain modules and renders them dynamically.
 */
export const AdminDashboard: React.FC = () => {
  const [manifests, setManifests] = useState<AdminManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const requestRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    loadAllManifests()
      .then(setManifests)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load admin tools'))
      .finally(() => setIsLoading(false));
  }, []);

  // Auto-refresh all tools when component mounts (tab becomes visible)
  useEffect(() => {
    // Trigger refresh on mount to ensure fresh data when navigating to admin
    if (!isLoading && manifests.length > 0) {
      const timer = setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, manifests.length]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay to show visual feedback
    setRefreshTrigger(prev => prev + 1);
    setIsRefreshing(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Admin Load Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (manifests.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>No Admin Tools Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No domain modules have exposed admin tools yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const defaultModule = manifests[0]?.module || '';

  return (
    <RefreshContext.Provider value={{ refreshTrigger, requestRefresh }}>
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage domain data and system configuration
            </p>
          </div>
          <Button
            onClick={handleRefreshAll}
            variant="outline"
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>

      <Tabs defaultValue={defaultModule} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${manifests.length}, minmax(0, 1fr))` }}>
          {manifests.map(manifest => (
            <TabsTrigger key={manifest.module} value={manifest.module} className="capitalize">
              {manifest.module}
              <Badge variant="secondary" className="ml-2">{manifest.tools.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {manifests.map(manifest => (
          <TabsContent key={manifest.module} value={manifest.module} className="space-y-6">
            {manifest.tools.map(tool => (
              <DynamicToolRenderer key={tool.id} tool={tool} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </RefreshContext.Provider>
  );
};

/**
 * Dynamically renders a single admin tool component.
 */
const DynamicToolRenderer: React.FC<{ tool: AdminTool }> = ({ tool }) => {
  const [LoadedComponent, setLoadedComponent] = useState<React.ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    tool
      .component()
      .then(module => setLoadedComponent(() => module.default))
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load component'));
  }, [tool]);

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {tool.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!LoadedComponent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tool.label}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle>{tool.label}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </CardContent>
        </Card>
      }
    >
      <LoadedComponent />
    </Suspense>
  );
};
