import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { kitchenDataBackend } from '../backend';
import { UnitsManagement } from './UnitsManagement.js';
import { AislesManagement } from './AislesManagement.js';
import { ItemsManagement } from './ItemsManagement.js';
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
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <Tabs defaultValue="categories" className="w-full flex flex-col flex-1 min-h-0">
        <TabsList className="w-full flex">
          <TabsTrigger value="categories" className="flex-1 flex items-center justify-center gap-1.5">
            Categories
            {pendingCount > 0 && (
              <Badge className="h-5 min-w-5 px-1 tabular-nums flex items-center justify-center">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="items" className="flex-1">
            Items
          </TabsTrigger>
          <TabsTrigger value="units" className="flex-1">
            Units
          </TabsTrigger>
          <TabsTrigger value="aisles" className="flex-1">
            Aisles
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
    </div>
  );
};
