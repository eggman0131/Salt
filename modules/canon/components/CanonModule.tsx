import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ItemsManagement } from './ItemsManagement';
import { UnitsManagement } from './UnitsManagement';
import { AislesManagement } from './AislesManagement';

interface CanonModuleProps {
  onRefresh?: () => void;
}

export const CanonModule: React.FC<CanonModuleProps> = ({ onRefresh }) => {
  const [activeTab, setActiveTab] = useState('items');

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="animate-in fade-in duration-500 h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
          <TabsTrigger 
            value="items"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Items
          </TabsTrigger>
          <TabsTrigger 
            value="units"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Units
          </TabsTrigger>
          <TabsTrigger 
            value="aisles"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Aisles
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="items" className="mt-0">
            <ItemsManagement onRefresh={handleRefresh} />
          </TabsContent>
          <TabsContent value="units" className="mt-0">
            <UnitsManagement onRefresh={handleRefresh} />
          </TabsContent>
          <TabsContent value="aisles" className="mt-0">
            <AislesManagement onRefresh={handleRefresh} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
