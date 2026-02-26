import React, { useState, useEffect } from 'react';
import { Stack } from '@/shared/components/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { List, MapPin, Ruler, Tags } from 'lucide-react';
import { kitchenDataBackend } from '../backend';
import { UnitsManagement, AislesManagement, ItemsManagement } from '../../canon';
import { CategoriesManagement } from './CategoriesManagement.js';

interface KitchenDataModuleProps {
  onRefresh?: () => void;
  onSuggestionsChanged?: () => void;
}

export const KitchenDataModule: React.FC<KitchenDataModuleProps> = ({ 
  onRefresh: externalRefresh,
  onSuggestionsChanged 
}) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadPendingCount();
  }, [refreshTrigger]);

  const loadPendingCount = async () => {
    try {
      const pending = await kitchenDataBackend.getPendingCategories();
      setPendingCount(pending.length);
      onSuggestionsChanged?.();
    } catch (err) {
      console.error('Failed to load pending categories', err);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    externalRefresh?.();
  };

  return (
    <Stack spacing="gap-6" className="animate-in fade-in duration-500 h-full flex-col">
      <Tabs defaultValue="categories" className="w-full flex flex-col flex-1 min-h-0">
        <TabsList className="w-full flex md:w-auto md:inline-flex h-11 bg-muted/50 p-1 border shadow-sm transition-all">
          <TabsTrigger 
            value="categories" 
            className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
          >
            <Tags className="w-4 h-4" />
            <span className="hidden md:inline">Categories</span>
            {pendingCount > 0 && (
              <Badge className="h-5 min-w-5 px-1 tabular-nums flex items-center justify-center">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="items" 
            className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
          >
            <List className="w-4 h-4" />
            <span className="hidden md:inline">Items</span>
          </TabsTrigger>
          <TabsTrigger 
            value="units" 
            className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
          >
            <Ruler className="w-4 h-4" />
            <span className="hidden md:inline">Units</span>
          </TabsTrigger>
          <TabsTrigger 
            value="aisles" 
            className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden md:inline">Aisles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="h-full flex flex-col flex-1 min-h-0">
          <CategoriesManagement onRefresh={handleRefresh} onPendingChange={loadPendingCount} />
        </TabsContent>

        <TabsContent value="items" className="h-full flex flex-col flex-1 min-h-0">
          <ItemsManagement onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="units" className="h-full flex flex-col flex-1 min-h-0">
          <UnitsManagement onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="aisles" className="h-full flex flex-col flex-1 min-h-0">
          <AislesManagement onRefresh={handleRefresh} />
        </TabsContent>
      </Tabs>
    </Stack>
  );
};
