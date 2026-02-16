import React, { useEffect, useState, useMemo } from 'react';
import { ShoppingList, ShoppingListItem, CanonicalItem, Unit, Aisle } from '../types/contract';
import { Card } from './UI';
import { kitchenDataBackend } from '../modules/kitchen-data';
import { shoppingBackend } from '../modules/shopping';
import { ShoppingListDesktopView } from '../modules/shopping/components/DesktopView';
import { ShoppingListMobileView } from '../modules/shopping/components/MobileView';
import { ShoppingListModals } from '../modules/shopping/components/modals/ShoppingListModals';
import {
  ensureUnitExists,
  ensureAisleExists,
  groupItemsByAisle,
  filterCanonicalItems,
  calculateProgress,
} from '../modules/shopping/utils';

interface ShoppingListModuleProps {
  onRefresh?: () => void;
}

export const ShoppingListModule: React.FC<ShoppingListModuleProps> = ({ onRefresh }) => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [canonicalItems, setCanonicalItems] = useState<CanonicalItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeleteItemConfirm, setShowDeleteItemConfirm] = useState(false);
  const [showRemoveCheckedConfirm, setShowRemoveCheckedConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ShoppingListItem | null>(null);
  const [editingItems, setEditingItems] = useState<Record<string, { name: string; quantity: string; unit: string; aisle: string }>>({});
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [removingChecked, setRemovingChecked] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ [itemId: string]: string }>({});
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('');
  const [manualItemUnit, setManualItemUnit] = useState('items');
  const [manualItemAisle, setManualItemAisle] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [selectedCanonicalItem, setSelectedCanonicalItem] = useState<CanonicalItem | null>(null);
  const [showListSelector, setShowListSelector] = useState(false);
  const [showCheckedItems, setShowCheckedItems] = useState(true);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });

  const loadLists = async () => {
    try {
      const data = await shoppingBackend.getShoppingLists();
      setLists(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      
      // Auto-select default list if no list is selected
      if (!selectedList) {
        const defaultList = data.find(l => l.isDefault);
        if (defaultList) {
          setSelectedList(defaultList);
        } else if (data.length > 0) {
          setSelectedList(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load lists:', err);
      alert('Failed to load shopping lists');
    }
  };

  const loadCanonicalItems = async () => {
    try {
      const data = await kitchenDataBackend.getCanonicalItems();
      setCanonicalItems(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Failed to load canonical items:', err);
    }
  };

  const loadUnitsAndAisles = async () => {
    try {
      const [unitsData, aislesData] = await Promise.all([
        kitchenDataBackend.getUnits(),
        kitchenDataBackend.getAisles()
      ]);
      setUnits(unitsData);
      setAisles(aislesData);
      
      // Set default unit and aisle if empty
      if (unitsData.length > 0 && !manualItemUnit) {
        setManualItemUnit(unitsData[0].name || '');
      }
      if (aislesData.length > 0 && !manualItemAisle) {
        setManualItemAisle(aislesData[0].name);
      }
    } catch (err) {
      console.error('Failed to load units and aisles:', err);
    }
  };



  const loadItems = async (listId: string) => {
    try {
      const data = await shoppingBackend.getShoppingListItems(listId);
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
      alert('Failed to load items');
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadLists(), loadCanonicalItems(), loadUnitsAndAisles()]);
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedList) {
      loadItems(selectedList.id);
    }
  }, [selectedList]);

  const handleToggleChecked = async (item: ShoppingListItem) => {
    try {
      await shoppingBackend.updateShoppingListItem(item.id, { checked: !item.checked });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleUpdateNotes = async (itemId: string) => {
    const note = editingNotes[itemId];
    try {
      await shoppingBackend.updateShoppingListItem(itemId, { note });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, note } : i));
      const newEditingNotes = { ...editingNotes };
      delete newEditingNotes[itemId];
      setEditingNotes(newEditingNotes);
    } catch (err) {
      console.error('Update note failed:', err);
    }
  };

  const startEditItem = (item: ShoppingListItem) => {
    setEditingItems(prev => ({
      ...prev,
      [item.id]: {
        name: item.name,
        quantity: String(item.quantity),
        unit: item.unit,
        aisle: item.aisle || ''
      }
    }));
  };

  const cancelEditItem = (itemId: string) => {
    setEditingItems(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleEnsureUnitExists = async (unitName: string): Promise<Unit> => {
    return await ensureUnitExists(unitName, units, async (name) => {
      const newUnit = await kitchenDataBackend.createUnit({
        name,
        sortOrder: units.length
      });
      await loadUnitsAndAisles();
      return newUnit;
    });
  };

  const handleEnsureAisleExists = async (aisleName: string): Promise<Aisle> => {
    return await ensureAisleExists(aisleName, aisles, async (name, sortOrder) => {
      const newAisle = await kitchenDataBackend.createAisle({
        name,
        sortOrder: sortOrder ?? aisles.length
      });
      await loadUnitsAndAisles();
      return newAisle;
    });
  };

  const handleSaveItemEdit = async (itemId: string) => {
    const draft = editingItems[itemId];
    if (!draft) return;

    const quantity = parseFloat(draft.quantity);
    if (!draft.name.trim() || isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid name and quantity');
      return;
    }

    const unitToUse = draft.unit.trim();
    const aisleToUse = draft.aisle.trim();

    setUpdatingItemId(itemId);
    try {
      await handleEnsureUnitExists(unitToUse);
      await handleEnsureAisleExists(aisleToUse);

      const updated = await shoppingBackend.updateShoppingListItem(itemId, {
        name: draft.name.trim(),
        quantity,
        unit: unitToUse,
        aisle: aisleToUse || undefined
      });

      setItems(prev => prev.map(i => i.id === itemId ? updated : i));
      cancelEditItem(itemId);
      await loadUnitsAndAisles();
      onRefresh?.();
    } catch (err) {
      console.error('Update item failed:', err);
      alert('Failed to update item');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleConfirmDeleteItem = (item: ShoppingListItem) => {
    setItemToDelete(item);
    setShowDeleteItemConfirm(true);
  };

  const handleDeleteItemDirect = async (item: ShoppingListItem) => {
    setUpdatingItemId(item.id);
    try {
      await shoppingBackend.deleteShoppingListItem(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setSwipedItemId(null);
      onRefresh?.();
    } catch (err) {
      console.error('Delete item failed:', err);
      alert('Failed to delete item');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setUpdatingItemId(itemToDelete.id);
    try {
      await shoppingBackend.deleteShoppingListItem(itemToDelete.id);
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      setShowDeleteItemConfirm(false);
      setItemToDelete(null);
      onRefresh?.();
    } catch (err) {
      console.error('Delete item failed:', err);
      alert('Failed to delete item');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveCheckedItems = async () => {
    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length === 0) return;

    setRemovingChecked(true);
    try {
      await Promise.all(checkedItems.map(item => shoppingBackend.deleteShoppingListItem(item.id)));
      setItems(prev => prev.filter(item => !item.checked));
      setShowRemoveCheckedConfirm(false);
      onRefresh?.();
    } catch (err) {
      console.error('Remove checked items failed:', err);
      alert('Failed to remove checked items');
    } finally {
      setRemovingChecked(false);
    }
  };

  const handleDeleteList = async () => {
    if (!selectedList) return;
    try {
      await shoppingBackend.deleteShoppingList(selectedList.id);
      setShowDeleteConfirmModal(false);
      setSelectedList(null);
      setItems([]);
      await loadLists();
      onRefresh?.();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Delete failed');
    }
  };

  const itemsByAisle = useMemo(() => {
    return groupItemsByAisle(items, aisles);
  }, [items, aisles]);

  const { checkedCount, totalCount, percentage: completionPercent } = useMemo(() => {
    return calculateProgress(items);
  }, [items]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    
    setIsCreatingList(true);
    try {
      const newList = await shoppingBackend.createShoppingList({
        name: newListName.trim(),
        recipeIds: []
      });
      setShowNewListModal(false);
      setNewListName('');
      await loadLists();
      setSelectedList(newList);
      onRefresh?.();
    } catch (err) {
      console.error('Create list failed:', err);
      alert('Failed to create list');
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedList || !manualItemName.trim() || !manualItemQuantity) return;
    
    const quantity = parseFloat(manualItemQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    setIsAddingItem(true);
    setAddSuccess(false);
    
    try {
      const trimmedName = manualItemName.trim();
      const normalizedName = trimmedName.toLowerCase();
      const matchedItem = selectedCanonicalItem || canonicalItems.find(item =>
        item.normalisedName === normalizedName || item.name.toLowerCase() === normalizedName
      );
      const unitInput = manualItemUnit.trim();
      const aisleInput = manualItemAisle.trim();
      const unitToUse = unitInput || matchedItem?.preferredUnit || 'items';
      const aisleToUse = matchedItem ? (matchedItem.aisle || '') : aisleInput;

      await handleEnsureUnitExists(unitToUse);
      if (!matchedItem && aisleToUse) {
        await handleEnsureAisleExists(aisleToUse);
      }
      
      // Add item to shopping list (will create canonical item if needed)
      await shoppingBackend.addManualItemToShoppingList(
        selectedList.id,
        trimmedName,
        quantity,
        unitToUse,
        aisleToUse || undefined
      );

      // Refresh data
      await Promise.all([
        loadItems(selectedList.id),
        loadCanonicalItems(),
        loadUnitsAndAisles()
      ]);
      
      // Clear form and show success
      setManualItemName('');
      setManualItemQuantity('');
      setManualItemUnit(units.length > 0 ? units[0].name : '');
      setManualItemAisle(aisles.length > 0 ? aisles[0].name : '');
      setSelectedCanonicalItem(null);
      setAddSuccess(true);
      
      // Hide success message after 2 seconds
      setTimeout(() => setAddSuccess(false), 2000);
      
      onRefresh?.();
    } catch (err) {
      console.error('Add item failed:', err);
      alert('Failed to add item');
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleSelectCanonicalItem = (item: CanonicalItem) => {
    setManualItemName(item.name);
    setManualItemUnit(item.preferredUnit || (units.length > 0 ? units[0].name : ''));
    setManualItemAisle(item.aisle || (aisles.length > 0 ? aisles[0].name : ''));
    setSelectedCanonicalItem(item);
    // Set default quantity if empty
    if (!manualItemQuantity) {
      setManualItemQuantity('1');
    }
  };

  const filteredIngredients = useMemo(() => {
    return filterCanonicalItems(canonicalItems, selectedCanonicalItem ? '' : manualItemName);
  }, [manualItemName, canonicalItems, selectedCanonicalItem]);



  // Aisle collapsibility state
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});

  // Determine if we're on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      <ShoppingListModals
        showListSelector={showListSelector}
        lists={lists}
        selectedList={selectedList}
        onSelectList={setSelectedList}
        onCloseListSelector={() => setShowListSelector(false)}
        showNewListModal={showNewListModal}
        newListName={newListName}
        isCreatingList={isCreatingList}
        onNewListNameChange={setNewListName}
        onCreateList={handleCreateList}
        onCloseNewListModal={() => {
          setShowNewListModal(false);
          setNewListName('');
        }}
        showAddItemsModal={showAddItemsModal}
        manualItemName={manualItemName}
        manualItemQuantity={manualItemQuantity}
        manualItemUnit={manualItemUnit}
        manualItemAisle={manualItemAisle}
        isAddingItem={isAddingItem}
        addSuccess={addSuccess}
        selectedCanonicalItem={selectedCanonicalItem}
        filteredIngredients={filteredIngredients}
        units={units}
        aisles={aisles}
        onManualItemNameChange={(name) => {
          setManualItemName(name);
          const normalized = name.trim().toLowerCase();
          const exactMatch = canonicalItems.find(item =>
            item.normalisedName === normalized || item.name.toLowerCase() === normalized
          );
          if (exactMatch) {
            setSelectedCanonicalItem(exactMatch);
            setManualItemUnit(exactMatch.preferredUnit || (units.length > 0 ? units[0].name : 'items'));
            setManualItemAisle(exactMatch.aisle || (aisles.length > 0 ? aisles[0].name : ''));
            if (!manualItemQuantity) {
              setManualItemQuantity('1');
            }
          } else {
            setSelectedCanonicalItem(null);
          }
        }}
        onManualItemQuantityChange={setManualItemQuantity}
        onManualItemUnitChange={setManualItemUnit}
        onManualItemAisleChange={setManualItemAisle}
        onSelectCanonicalItem={handleSelectCanonicalItem}
        onAddItem={handleAddItem}
        onCloseAddItemsModal={() => {
          setShowAddItemsModal(false);
          setManualItemName('');
          setManualItemQuantity('');
          setManualItemUnit(units.length > 0 ? units[0].name : '');
          setManualItemAisle(aisles.length > 0 ? aisles[0].name : '');
          setSelectedCanonicalItem(null);
          setAddSuccess(false);
        }}
        showDeleteConfirmModal={showDeleteConfirmModal}
        showDeleteItemConfirm={showDeleteItemConfirm}
        showRemoveCheckedConfirm={showRemoveCheckedConfirm}
        itemToDelete={itemToDelete}
        checkedCount={checkedCount}
        removingChecked={removingChecked}
        onDeleteList={handleDeleteList}
        onDeleteItem={handleDeleteItem}
        onRemoveCheckedItems={handleRemoveCheckedItems}
        onCloseDeleteConfirm={() => setShowDeleteConfirmModal(false)}
        onCloseDeleteItemConfirm={() => {
          setShowDeleteItemConfirm(false);
          setItemToDelete(null);
        }}
        onCloseRemoveCheckedConfirm={() => setShowRemoveCheckedConfirm(false)}
      />

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedList ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">No shopping lists yet</p>
          <button
            onClick={() => setShowNewListModal(true)}
            className="text-orange-600 hover:text-orange-700 font-semibold"
          >
            Create your first list →
          </button>
        </Card>
      ) : isMobile ? (
        <ShoppingListMobileView
          selectedList={selectedList}
          items={items}
          itemsByAisle={itemsByAisle}
          completionPercent={completionPercent}
          checkedCount={checkedCount}
          showCheckedItems={showCheckedItems}
          editingNotes={editingNotes}
          updatingItemId={updatingItemId}
          units={units}
          aisles={aisles}
          onToggleChecked={handleToggleChecked}
          onUpdateNotes={handleUpdateNotes}
          onDeleteItem={handleDeleteItemDirect}
          onShowListSelector={() => setShowListSelector(true)}
          onShowAddItemsModal={() => setShowAddItemsModal(true)}
          onShowRemoveCheckedConfirm={() => setShowRemoveCheckedConfirm(true)}
          onToggleShowChecked={() => setShowCheckedItems(!showCheckedItems)}
          setEditingNotes={setEditingNotes}
        />
      ) : (
        <ShoppingListDesktopView
          selectedList={selectedList}
          items={items}
          itemsByAisle={itemsByAisle}
          completionPercent={completionPercent}
          checkedCount={checkedCount}
          editingNotes={editingNotes}
          updatingItemId={updatingItemId}
          removingChecked={removingChecked}
          units={units}
          aisles={aisles}
          onToggleChecked={handleToggleChecked}
          onUpdateNotes={handleUpdateNotes}
          onSaveItemEdit={handleSaveItemEdit}
          onDeleteItem={handleConfirmDeleteItem}
          onShowAddItemsModal={() => setShowAddItemsModal(true)}
          onShowRemoveCheckedConfirm={() => setShowRemoveCheckedConfirm(true)}
          onShowDeleteConfirmModal={() => setShowDeleteConfirmModal(true)}
          setEditingNotes={setEditingNotes}
        />
      )}
    </div>
  );
};
