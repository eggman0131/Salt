import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { RefreshContext } from '@/shared/providers';
import { CanonItems } from './CanonItems';
import { CanonAisles } from './CanonAisles';
import { CanonUnits } from './CanonUnits';

/**
 * Dedicated Canon workspace for day-to-day canon catalogue management.
 * Operational tooling (seeding/import/mappings/embeddings) stays in Admin.
 */
export const CanonItemsWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState('items');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const requestRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    requestRefresh();
    setIsRefreshing(false);
  };

  const refreshContextValue = useMemo(
    () => ({ refreshTrigger, requestRefresh }),
    [refreshTrigger]
  );

  return (
    <RefreshContext.Provider value={refreshContextValue}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Canon Items</h1>
            <p className="text-muted-foreground">
              Manage items, aisles, and units in one workspace.
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="aisles">Aisles</TabsTrigger>
            <TabsTrigger value="units">Units</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-6">
            <CanonItems />
          </TabsContent>

          <TabsContent value="aisles" className="mt-6">
            <CanonAisles />
          </TabsContent>

          <TabsContent value="units" className="mt-6">
            <CanonUnits />
          </TabsContent>
        </Tabs>
      </div>
    </RefreshContext.Provider>
  );
};
