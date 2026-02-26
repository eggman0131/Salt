import React, { useState, useEffect } from 'react';
import { ShoppingList, ShoppingListItem, CanonicalItem, Unit, Aisle } from '../../../types/contract';
import { shoppingBackend } from '../backend';
import { canonBackend } from '../../canon';
import { Toaster } from '@/components/ui/sonner';
import { softToast } from '@/lib/soft-toast';
import { Loader2 } from 'lucide-react';
import { ShoppingListsView } from './ShoppingListsView.tsx';
import { ShoppingListDetailView } from './ShoppingListDetailView.tsx';

interface ShoppingListModuleProps {
  onRefresh?: () => void;
}

export const ShoppingListModule: React.FC<ShoppingListModuleProps> = ({ onRefresh }) => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [canonicalItems, setCanonicalItems] = useState<CanonicalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const refreshLists = async () => {
    const data = await shoppingBackend.getShoppingLists();
    const sorted = data.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setLists(sorted);
    return sorted;
  };

  const loadItemsForList = async (listId: string) => {
    setIsLoadingItems(true);
    try {
      const data = await shoppingBackend.getShoppingListItems(listId);
      setItems(data);
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [listsData, aislesData, unitsData, canonicalData] = await Promise.all([
          shoppingBackend.getShoppingLists(),
          canonBackend.getAisles(),
          canonBackend.getUnits(),
          canonBackend.getCanonicalItems(),
        ]);

        const sorted = listsData.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setLists(sorted);
        setAisles(aislesData);
        setUnits(unitsData);
        setCanonicalItems(canonicalData.sort((a, b) => a.name.localeCompare(b.name)));

        // Auto-select default list
        const defaultList = sorted.find(l => l.isDefault);
        if (defaultList) {
          setSelectedListId(defaultList.id);
          const itemsData = await shoppingBackend.getShoppingListItems(defaultList.id);
          setItems(itemsData);
        }
      } catch (err) {
        console.error('Failed to load shopping data:', err);
        softToast.error('Could not load shopping lists');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleSelectList = async (id: string) => {
    setSelectedListId(id);
    await loadItemsForList(id);
  };

  const handleBack = () => {
    setSelectedListId(null);
    setItems([]);
  };

  const handleCreateList = async (name: string) => {
    try {
      const newList = await shoppingBackend.createShoppingList({ name, recipeIds: [] });
      softToast.success('List created', { description: name });
      await refreshLists();
      setSelectedListId(newList.id);
      setItems([]);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to create list:', err);
      softToast.error('Could not create list');
      throw err;
    }
  };

  const handleDeleteList = async (id: string) => {
    const list = lists.find(l => l.id === id);
    try {
      await shoppingBackend.deleteShoppingList(id);
      softToast.success('List deleted', { description: list?.name });
      if (selectedListId === id) {
        setSelectedListId(null);
        setItems([]);
      }
      await refreshLists();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete list:', err);
      softToast.error('Could not delete list');
      throw err;
    }
  };

  const handleUpdateList = async (id: string, updates: Partial<ShoppingList>) => {
    try {
      await shoppingBackend.updateShoppingList(id, updates);
      await refreshLists();
    } catch (err) {
      console.error('Failed to update list:', err);
      softToast.error('Could not update list');
      throw err;
    }
  };

  const handleAddItem = async (name: string, quantity: number, unit: string, aisle?: string) => {
    if (!selectedListId) return;
    try {
      await shoppingBackend.addManualItemToShoppingList(selectedListId, name, quantity, unit, aisle);
      softToast.success('Item added', { description: name });
      // Refresh canonical items in case a new one was created
      const [newItems, newCanonical] = await Promise.all([
        shoppingBackend.getShoppingListItems(selectedListId),
        kitchenDataBackend.getCanonicalItems(),
      ]);
      setItems(newItems);
      setCanonicalItems(newCanonical.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Failed to add item:', err);
      softToast.error('Could not add item');
      throw err;
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<ShoppingListItem>) => {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    try {
      await shoppingBackend.updateShoppingListItem(id, updates);
    } catch (err) {
      console.error('Failed to update item:', err);
      softToast.error('Could not update item');
      // Revert
      if (selectedListId) await loadItemsForList(selectedListId);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    // Optimistic remove
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await shoppingBackend.deleteShoppingListItem(id);
      softToast.success('Item removed', { description: item?.name });
    } catch (err) {
      console.error('Failed to delete item:', err);
      softToast.error('Could not remove item');
      // Revert
      if (selectedListId) await loadItemsForList(selectedListId);
    }
  };

  const handleRemoveChecked = async () => {
    const checked = items.filter(i => i.checked);
    if (!checked.length) return;
    // Optimistic remove
    setItems(prev => prev.filter(i => !i.checked));
    try {
      await Promise.all(checked.map(i => shoppingBackend.deleteShoppingListItem(i.id)));
      softToast.success(
        `${checked.length} item${checked.length !== 1 ? 's' : ''} removed`,
        { description: 'Checked items cleared' }
      );
    } catch (err) {
      console.error('Failed to remove checked items:', err);
      softToast.error('Could not remove items');
      if (selectedListId) await loadItemsForList(selectedListId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedList = lists.find(l => l.id === selectedListId) ?? null;

  return (
    <>
      {selectedList ? (
        <ShoppingListDetailView
          list={selectedList}
          items={items}
          allLists={lists}
          aisles={aisles}
          units={units}
          canonicalItems={canonicalItems}
          isLoadingItems={isLoadingItems}
          onBack={handleBack}
          onSwitchList={handleSelectList}
          onAddItem={handleAddItem}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onRemoveChecked={handleRemoveChecked}
          onUpdateList={handleUpdateList}
          onDeleteList={handleDeleteList}
        />
      ) : (
        <ShoppingListsView
          lists={lists}
          onSelectList={handleSelectList}
          onCreateList={handleCreateList}
          onDeleteList={handleDeleteList}
          onUpdateList={handleUpdateList}
        />
      )}
      <Toaster position="top-right" />
    </>
  );
};
