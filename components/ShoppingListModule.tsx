import React, { useEffect, useState, useMemo } from 'react';
import { ShoppingList, ShoppingListItem, CanonicalItem, Unit, Aisle } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';

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
      const data = await saltBackend.getShoppingLists();
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
      const data = await saltBackend.getCanonicalItems();
      setCanonicalItems(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Failed to load canonical items:', err);
    }
  };

  const loadUnitsAndAisles = async () => {
    try {
      const [unitsData, aislesData] = await Promise.all([
        saltBackend.getUnits(),
        saltBackend.getAisles()
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
      const data = await saltBackend.getShoppingListItems(listId);
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
      await saltBackend.updateShoppingListItem(item.id, { checked: !item.checked });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleUpdateNotes = async (itemId: string) => {
    const note = editingNotes[itemId];
    try {
      await saltBackend.updateShoppingListItem(itemId, { note });
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

  const ensureUnitExists = async (unitName: string) => {
    if (!unitName.trim()) return;
    const existingUnit = units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
    if (!existingUnit) {
      await saltBackend.createUnit({
        name: unitName,
        sortOrder: units.length
      });
    }
  };

  const ensureAisleExists = async (aisleName: string) => {
    if (!aisleName.trim()) return;
    const existingAisle = aisles.find(a => a.name.toLowerCase() === aisleName.toLowerCase());
    if (!existingAisle) {
      await saltBackend.createAisle({
        name: aisleName,
        sortOrder: aisles.length
      });
    }
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
      await ensureUnitExists(unitToUse);
      await ensureAisleExists(aisleToUse);

      const updated = await saltBackend.updateShoppingListItem(itemId, {
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
      await saltBackend.deleteShoppingListItem(item.id);
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
      await saltBackend.deleteShoppingListItem(itemToDelete.id);
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
      await Promise.all(checkedItems.map(item => saltBackend.deleteShoppingListItem(item.id)));
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
      await saltBackend.deleteShoppingList(selectedList.id);
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
    const groups: Record<string, ShoppingListItem[]> = {};
    items.forEach(item => {
      const aisle = item.aisle || 'Miscellaneous';
      if (!groups[aisle]) {
        groups[aisle] = [];
      }
      groups[aisle].push(item);
    });
    return groups;
  }, [items]);

  const completionPercent = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round((items.filter(i => i.checked).length / items.length) * 100);
  }, [items]);

  const checkedCount = useMemo(() => items.filter(item => item.checked).length, [items]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    
    setIsCreatingList(true);
    try {
      const newList = await saltBackend.createShoppingList({
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

      await ensureUnitExists(unitToUse);
      if (!matchedItem && aisleToUse) {
        await ensureAisleExists(aisleToUse);
      }
      
      // Add item to shopping list (will create canonical item if needed)
      await saltBackend.addManualItemToShoppingList(
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
    if (!manualItemName.trim() || selectedCanonicalItem) return [];
    const query = manualItemName.toLowerCase();
    return canonicalItems.filter(
      ing => ing.name.toLowerCase().includes(query) || 
             ing.normalisedName.includes(query) ||
             ing.synonyms?.some(s => s.toLowerCase().includes(query))
    ).slice(0, 10);
  }, [manualItemName, canonicalItems, selectedCanonicalItem]);



  // Aisle collapsibility state
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">

      {/* List Selector Modal */}
      {showListSelector && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4" onClick={() => setShowListSelector(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Select List</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lists.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No lists yet</p>
              ) : (
                lists.map(list => (
                  <button
                    key={list.id}
                    onClick={() => {
                      setSelectedList(list);
                      setShowListSelector(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                      selectedList?.id === list.id
                        ? 'bg-orange-100 text-orange-900 border-2 border-orange-600'
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{list.name}</span>
                      {list.isDefault && <span className="text-xs font-bold text-orange-600">DEFAULT</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowListSelector(false)}
              className="mt-4 w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* New List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4" onClick={() => setShowNewListModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create Shopping List</h3>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name (e.g. Weekly Shop)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewListModal(false);
                  setNewListName('');
                }}
                disabled={isCreatingList}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                disabled={isCreatingList || !newListName.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingList ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Items Modal */}
      {showAddItemsModal && selectedList && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4" onClick={() => setShowAddItemsModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Add Item</h3>
              <p className="text-sm text-gray-600 mt-1">Search for an existing item or create a new one</p>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Success message */}
              {addSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="font-medium">Item added to list</span>
                </div>
              )}
              
              {/* Item name with search suggestions */}
              <div className="relative">
                <Label htmlFor="item-name">Item name</Label>
                <Input
                  id="item-name"
                  type="text"
                  value={manualItemName}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setManualItemName(nextName);
                    const normalized = nextName.trim().toLowerCase();
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
                  placeholder="Type to search or enter new item..."
                  autoFocus
                  className={selectedCanonicalItem ? 'border-green-500 bg-green-50' : ''}
                />
                {selectedCanonicalItem && (
                  <div className="mt-1 text-xs text-green-700 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Existing item selected
                  </div>
                )}
                {filteredIngredients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border border-gray-200 rounded-lg bg-white shadow-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {filteredIngredients.map(ing => (
                      <button
                        key={ing.id}
                        onClick={() => handleSelectCanonicalItem(ing)}
                        className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{ing.name}</p>
                          <p className="text-xs text-gray-500">{ing.preferredUnit} • {ing.aisle}</p>
                        </div>
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualItemQuantity}
                    onChange={(e) => setManualItemQuantity(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    type="text"
                    value={manualItemUnit}
                    onChange={(e) => setManualItemUnit(e.target.value)}
                    placeholder="e.g. g, kg, ml, l, item"
                    list="unit-options"
                  />
                  <datalist id="unit-options">
                    {units.map(unit => (
                      <option key={unit.id} value={unit.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Aisle */}
              <div>
                <Label htmlFor="aisle">Aisle {!selectedCanonicalItem && <span className="text-gray-400 font-normal">(optional for new items)</span>}</Label>
                <Input
                  id="aisle"
                  type="text"
                  value={manualItemAisle}
                  onChange={(e) => setManualItemAisle(e.target.value)}
                  placeholder="e.g. Bakery, Frozen"
                  list="aisle-options"
                />
                <datalist id="aisle-options">
                  {aisles.map(aisle => (
                    <option key={aisle.id} value={aisle.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAddItemsModal(false);
                  setManualItemName('');
                  setManualItemQuantity('');
                  setManualItemUnit(units.length > 0 ? units[0].name : '');
                  setManualItemAisle(aisles.length > 0 ? aisles[0].name : '');
                  setSelectedCanonicalItem(null);
                  setAddSuccess(false);
                }}
                disabled={isAddingItem}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={handleAddItem}
                disabled={isAddingItem || !manualItemName.trim() || !manualItemQuantity}
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAddingItem ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add to List'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && selectedList && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirmModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete List?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedList.name}</strong>? This will also remove all items in the list.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteList}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {showDeleteItemConfirm && itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4" onClick={() => setShowDeleteItemConfirm(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Remove Item?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <strong>{itemToDelete.name}</strong> from this list?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteItemConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Checked Items Confirmation Modal */}
      {showRemoveCheckedConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4" onClick={() => setShowRemoveCheckedConfirm(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Remove Ticked Items?</h3>
            <p className="text-gray-600 mb-6">
              Remove {checkedCount} ticked item{checkedCount !== 1 ? 's' : ''} from this list?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveCheckedConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveCheckedItems}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                {removingChecked ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

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
      ) : (
        <div className="space-y-6">
          {/* List header */}
          <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 cursor-pointer md:cursor-default" onClick={() => setShowListSelector(true)}>
                  <h2 className="text-xl md:text-3xl font-bold text-gray-900 hover:text-orange-600 md:hover:text-gray-900 transition-colors">
                    {selectedList.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    {items.length} item{items.length !== 1 ? 's' : ''} • {items.filter(i => !i.checked).length} remaining
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCheckedItems(!showCheckedItems)}
                    className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    title={showCheckedItems ? 'Hide checked' : 'Show checked'}
                  >
                    {showCheckedItems ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAddItemsModal(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    title="Add item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowRemoveCheckedConfirm(true)}
                    disabled={checkedCount === 0 || removingChecked}
                    className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={removingChecked ? 'Removing ticked items' : `Remove ticked items (${checkedCount})`}
                  >
                    {removingChecked ? (
                      <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirmModal(true)}
                    className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                    title="Delete list"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            
            {items.length > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-orange-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            )}
          </Card>

          {items.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-gray-500 mb-4">No items yet</p>
              <button
                onClick={() => setShowAddItemsModal(true)}
                className="text-orange-600 hover:text-orange-700 font-semibold"
              >
                Add your first item →
              </button>
            </Card>
          ) : (
            <div className="space-y-2 md:space-y-6">
              {Object.keys(itemsByAisle)
                .sort()
                .filter(aisleName => showCheckedItems || itemsByAisle[aisleName].some(item => !item.checked))
                .map(aisleName => (
                <div key={aisleName} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Aisle header - clickable to toggle */}
                  <button
                    onClick={() => setCollapsedAisles(prev => ({
                      ...prev,
                      [aisleName]: !prev[aisleName]
                    }))}
                    className="w-full bg-white hover:bg-gray-50 transition-colors px-4 py-3 md:px-4 md:py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 md:flex-none">
                        {/* Chevron icon - rotates when collapsed */}
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                            collapsedAisles[aisleName] ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 8.755l-9 5.196-9-5.196" />
                        </svg>
                        <h4 className="text-xs md:text-sm font-black uppercase tracking-widest text-gray-400 text-left">
                          {aisleName}
                        </h4>
                      </div>
                      {/* Orange count badge */}
                      {itemsByAisle[aisleName].some(item => !item.checked) && (
                        <span className="bg-orange-600 text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-fit ml-auto md:ml-2 flex-shrink-0">
                          {itemsByAisle[aisleName].filter(item => !item.checked).length}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Aisle items - collapsible */}
                  {!collapsedAisles[aisleName] && (
                    <div className="space-y-2 px-1.5 py-4 md:p-4 md:pt-3 border-t border-gray-100 md:border-t-0 md:space-y-2">
                      {itemsByAisle[aisleName]
                        .filter(item => showCheckedItems || !item.checked)
                        .map(item => (
                        <Card
                          key={item.id}
                          onTouchStart={(e) => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
                          onTouchEnd={(e) => {
                            const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
                            const diffX = touchStart.x - touchEnd.x;
                            const diffY = Math.abs(touchStart.y - touchEnd.y);
                            // Swipe left (diffX > 0) with minimal vertical movement
                            if (diffX > 100 && diffY < 50) {
                              setSwipedItemId(item.id);
                            } else if (diffX < -50) {
                              // Swipe right to cancel
                              setSwipedItemId(null);
                            }
                          }}
                          className={`p-4 transition-all relative ${
                            item.checked ? 'bg-gray-50 opacity-60' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => handleToggleChecked(item)}
                              className="w-5 h-5 mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  {editingItems[item.id] ? (
                                    <div className="space-y-3">
                                      <div>
                                        <Label htmlFor={`edit-name-${item.id}`}>Item name</Label>
                                        <Input
                                          id={`edit-name-${item.id}`}
                                          value={editingItems[item.id].name}
                                          onChange={(e) =>
                                            setEditingItems(prev => ({
                                              ...prev,
                                              [item.id]: {
                                                ...prev[item.id],
                                                name: e.target.value
                                              }
                                            }))
                                          }
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label htmlFor={`edit-quantity-${item.id}`}>Quantity</Label>
                                          <Input
                                            id={`edit-quantity-${item.id}`}
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            value={editingItems[item.id].quantity}
                                            onChange={(e) =>
                                              setEditingItems(prev => ({
                                                ...prev,
                                                [item.id]: {
                                                  ...prev[item.id],
                                                  quantity: e.target.value
                                                }
                                              }))
                                            }
                                            className="text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor={`edit-unit-${item.id}`}>Unit</Label>
                                          <Input
                                            id={`edit-unit-${item.id}`}
                                            value={editingItems[item.id].unit}
                                            onChange={(e) =>
                                              setEditingItems(prev => ({
                                                ...prev,
                                                [item.id]: {
                                                  ...prev[item.id],
                                                  unit: e.target.value
                                                }
                                              }))
                                            }
                                            list={`unit-options-${item.id}`}
                                            className="text-sm"
                                          />
                                          <datalist id={`unit-options-${item.id}`}>
                                            {editingItems[item.id].name.trim() && (
                                              <option value={editingItems[item.id].name.trim()} />
                                            )}
                                            {units.map(unit => (
                                              <option key={unit.id} value={unit.name} />
                                            ))}
                                          </datalist>
                                        </div>
                                      </div>
                                      <div>
                                        <Label htmlFor={`edit-aisle-${item.id}`}>Aisle</Label>
                                        <Input
                                          id={`edit-aisle-${item.id}`}
                                          value={editingItems[item.id].aisle}
                                          onChange={(e) =>
                                            setEditingItems(prev => ({
                                              ...prev,
                                              [item.id]: {
                                                ...prev[item.id],
                                                aisle: e.target.value
                                              }
                                            }))
                                          }
                                          list={`aisle-options-${item.id}`}
                                          className="text-sm"
                                        />
                                        <datalist id={`aisle-options-${item.id}`}>
                                          {aisles.map(aisle => (
                                            <option key={aisle.id} value={aisle.name} />
                                          ))}
                                        </datalist>
                                      </div>
                                      <div className="flex gap-2 md:hidden">
                                        <Button
                                          onClick={() => handleSaveItemEdit(item.id)}
                                          disabled={updatingItemId === item.id}
                                          className="flex-1"
                                        >
                                          {updatingItemId === item.id ? 'Saving...' : 'Save'}
                                        </Button>
                                        <Button
                                          onClick={() => cancelEditItem(item.id)}
                                          className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      {/* Top row: Title, Quantity, Unit - clickable on mobile to edit */}
                                      <div
                                        onClick={() => {
                                          if (window.innerWidth < 768) {
                                            startEditItem(item);
                                          }
                                        }}
                                        className="flex items-baseline gap-2 md:cursor-default cursor-pointer"
                                      >
                                        <h5 className={`font-semibold text-gray-900 break-words flex-1 ${item.checked ? 'line-through' : ''}`}>
                                          {item.name}
                                        </h5>
                                        <span className="text-sm text-gray-600 whitespace-nowrap flex-shrink-0">
                                          {item.quantity}
                                        </span>
                                        <span className="text-sm text-gray-600 whitespace-nowrap flex-shrink-0">
                                          {item.unit}
                                        </span>
                                      </div>
                                      {item.isStaple && (
                                        <span className="inline-block text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wide font-bold mt-2">
                                          Staple
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="hidden md:flex items-start gap-2 flex-shrink-0">
                                  {editingItems[item.id] ? (
                                    <>
                                      <Button
                                        onClick={() => handleSaveItemEdit(item.id)}
                                        disabled={updatingItemId === item.id}
                                        className="px-3"
                                      >
                                        {updatingItemId === item.id ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        onClick={() => cancelEditItem(item.id)}
                                        className="px-3 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                      >
                                        Cancel
                                      </Button>
                                      <button
                                        onClick={() => handleConfirmDeleteItem(item)}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                        title="Remove item"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
                                        </svg>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEditItem(item)}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                        title="Edit item"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleConfirmDeleteItem(item)}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                        title="Remove item"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {!editingItems[item.id] && item.note && !editingNotes[item.id] && (
                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-sm text-gray-700 flex items-start justify-between gap-2">
                                  <span>{item.note}</span>
                                  <button
                                    onClick={() => setEditingNotes({ ...editingNotes, [item.id]: item.note || '' })}
                                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                                    </svg>
                                  </button>
                                </div>
                              )}
                              {!editingItems[item.id] && editingNotes[item.id] !== undefined ? (
                                <div className="mt-2 flex gap-2">
                                  <Input
                                    value={editingNotes[item.id]}
                                    onChange={(e) => setEditingNotes({ ...editingNotes, [item.id]: e.target.value })}
                                    placeholder="Add a note..."
                                    className="flex-1"
                                  />
                                  <button
                                    onClick={() => handleUpdateNotes(item.id)}
                                    className="hidden md:block px-3 flex-shrink-0 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newNotes = { ...editingNotes };
                                      delete newNotes[item.id];
                                      setEditingNotes(newNotes);
                                    }}
                                    className="hidden md:block px-3 flex-shrink-0 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleUpdateNotes(item.id)}
                                    className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
                                    title="Save note"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newNotes = { ...editingNotes };
                                      delete newNotes[item.id];
                                      setEditingNotes(newNotes);
                                    }}
                                    className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
                                    title="Cancel"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                  </button>
                                </div>
                              ) : !editingItems[item.id] && !item.note && (
                                <button
                                  onClick={() => setEditingNotes({ ...editingNotes, [item.id]: '' })}
                                  className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  + Add note
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Swipe-to-delete overlay (mobile only) */}
                          {swipedItemId === item.id && (
                            <div className="absolute inset-0 bg-red-600 rounded-lg flex items-center justify-between px-4 md:hidden">
                              <span className="text-white font-semibold">Delete this item?</span>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleDeleteItemDirect(item)}
                                  className="bg-white !text-red-700 hover:bg-red-50 hover:!text-red-800 px-3"
                                >
                                  Delete
                                </Button>
                                <Button
                                  onClick={() => setSwipedItemId(null)}
                                  className="bg-red-700 text-white hover:bg-red-800 px-3"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
