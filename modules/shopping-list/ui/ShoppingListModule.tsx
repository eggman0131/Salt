import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';
import { getDefaultShoppingList, getShoppingLists, getItemsForList } from '../api';
import type { ShoppingList, ShoppingListItem } from '../../../types/contract';
import { ManagementView } from './management/ManagementView';
import { MobileShoppingView } from './mobile/MobileShoppingView';

export const ShoppingListModule: React.FC = () => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);

  // Mobile view: full-screen, no chrome — switch automatically on small viewports
  // Users can also toggle manually via the "Shopping view" button
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    setIsMobileView(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const loadData = useCallback(async (listId?: string) => {
    setIsLoading(true);
    try {
      const [allLists, defaultList] = await Promise.all([
        getShoppingLists(),
        getDefaultShoppingList(),
      ]);
      setLists(allLists.length > 0 ? allLists : [defaultList]);

      const targetId = listId ?? defaultList.id;
      const target = allLists.find((l) => l.id === targetId) ?? defaultList;
      setActiveList(target);

      const listItems = await getItemsForList(target.id);
      setItems(listItems);
    } catch {
      softToast.error('Failed to load shopping list');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectList = useCallback(
    async (id: string) => {
      await loadData(id);
    },
    [loadData]
  );

  if (isLoading && !activeList) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeList) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ShoppingCart className="h-8 w-8 opacity-40" />
        <p className="text-sm">Could not load shopping list.</p>
      </div>
    );
  }

  if (isMobileView) {
    return (
      <MobileShoppingView
        list={activeList}
        items={items}
        onRefresh={() => loadData(activeList.id)}
        onExitMobile={() => setIsMobileView(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Shopping</h1>
      </div>

      <ManagementView
        list={activeList}
        lists={lists}
        items={items}
        isLoading={isLoading}
        onRefresh={() => loadData(activeList.id)}
        onSelectList={handleSelectList}
        onSwitchToMobile={() => setIsMobileView(true)}
      />
    </div>
  );
};
