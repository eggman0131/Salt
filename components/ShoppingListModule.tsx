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
  const [editingNotes, setEditingNotes] = useState<{ [itemId: string]: string }>({});
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('');
  const [manualItemUnit, setManualItemUnit] = useState('pieces');
  const [showCustomUnitInput, setShowCustomUnitInput] = useState(false);
  const [customUnit, setCustomUnit] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

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
      
      // Set default unit if empty
      if (unitsData.length > 0 && !manualItemUnit) {
        setManualItemUnit(unitsData[0].name);
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

  const handleAddManualItem = async () => {
    if (!selectedList || !manualItemName.trim() || !manualItemQuantity) return;
    
    const quantity = parseFloat(manualItemQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    // Determine which unit to use
    let unitToUse = manualItemUnit;
    if (showCustomUnitInput && customUnit.trim()) {
      unitToUse = customUnit.trim();
    }
    
    setIsAddingItem(true);
    try {
      await saltBackend.addManualItemToShoppingList(
        selectedList.id,
        manualItemName.trim(),
        quantity,
        unitToUse
      );
      setManualItemName('');
      setManualItemQuantity('');
      setManualItemUnit(units.length > 0 ? units[0].name : '');
      setShowCustomUnitInput(false);
      setCustomUnit('');
      setSearchQuery('');
      await loadItems(selectedList.id);
      await loadCanonicalItems(); // Refresh in case new item was created
      await loadUnitsAndAisles(); // Refresh units in case custom unit was added
      onRefresh?.();
    } catch (err) {
      console.error('Add item failed:', err);
      alert('Failed to add item');
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleAddExistingIngredient = async (ingredient: CanonicalItem) => {
    if (!selectedList) return;
    
    setIsAddingItem(true);
    try {
      await saltBackend.addManualItemToShoppingList(
        selectedList.id,
        ingredient.name,
        1,
        ingredient.preferredUnit
      );
      setSearchQuery('');
      await loadItems(selectedList.id);
      onRefresh?.();
    } catch (err) {
      console.error('Add item failed:', err);
      alert('Failed to add item');
    } finally {
      setIsAddingItem(false);
    }
  };

  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return canonicalItems.filter(
      ing => ing.name.toLowerCase().includes(query) || 
             ing.normalisedName.includes(query) ||
             ing.synonyms?.some(s => s.toLowerCase().includes(query))
    ).slice(0, 10);
  }, [searchQuery, canonicalItems]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with dropdown and new list button */}
      <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-6 sticky top-16 md:top-20 z-20">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <select
              value={selectedList?.id || ''}
              onChange={(e) => {
                const list = lists.find(l => l.id === e.target.value);
                if (list) setSelectedList(list);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-base font-medium"
              disabled={lists.length === 0}
            >
              {lists.length === 0 ? (
                <option value="">No lists yet</option>
              ) : (
                lists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name} {list.isDefault ? '(Default)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            onClick={() => setShowNewListModal(true)}
            className="bg-orange-600 text-white rounded-lg h-11 px-5 font-semibold hover:bg-orange-700 transition shadow-sm flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add List
          </button>
        </div>
      </div>

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
              <h3 className="text-xl font-bold text-gray-900">Add Items</h3>
              <p className="text-sm text-gray-600 mt-1">Search existing items or add new ones</p>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Search existing items */}
              <div>
                <Label htmlFor="search">Search existing items</Label>
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search..."
                  autoFocus
                />
                {filteredIngredients.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {filteredIngredients.map(ing => (
                      <button
                        key={ing.id}
                        onClick={() => handleAddExistingIngredient(ing)}
                        disabled={isAddingItem}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between disabled:opacity-50"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{ing.name}</p>
                          <p className="text-xs text-gray-500">{ing.aisle}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or add manually</span>
                </div>
              </div>

              {/* Manual entry */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="manual-name">Item name</Label>
                  <Input
                    id="manual-name"
                    type="text"
                    value={manualItemName}
                    onChange={(e) => setManualItemName(e.target.value)}
                    placeholder="e.g. Kitchen roll, Dishwasher tablets, Milk"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="manual-quantity">Quantity</Label>
                    <Input
                      id="manual-quantity"
                      type="number"
                      step="0.1"
                      min="0"
                      value={manualItemQuantity}
                      onChange={(e) => setManualItemQuantity(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-unit">Unit</Label>
                    {showCustomUnitInput ? (
                      <div className="flex gap-2">
                        <Input
                          id="custom-unit"
                          type="text"
                          value={customUnit}
                          onChange={(e) => setCustomUnit(e.target.value)}
                          placeholder="e.g. bunch, tin"
                          autoFocus
                          className="flex-1"
                        />
                        <button
                          onClick={() => {
                            setShowCustomUnitInput(false);
                            setCustomUnit('');
                          }}
                          className="px-2 text-gray-500 hover:text-gray-700"
                          title="Cancel"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          id="manual-unit"
                          value={manualItemUnit}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setShowCustomUnitInput(true);
                            } else {
                              setManualItemUnit(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          {units.map(unit => (
                            <option key={unit.id} value={unit.name}>{unit.name}</option>
                          ))}
                          <option value="__custom__">+ Add custom unit</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAddItemsModal(false);
                  setSearchQuery('');
                  setManualItemName('');
                  setManualItemQuantity('');
                  setManualItemUnit(units.length > 0 ? units[0].name : '');
                  setShowCustomUnitInput(false);
                  setCustomUnit('');
                }}
                disabled={isAddingItem}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={handleAddManualItem}
                disabled={isAddingItem || !manualItemName.trim() || !manualItemQuantity || (showCustomUnitInput && !customUnit.trim())}
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingItem ? 'Adding...' : 'Add to List'}
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
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900">{selectedList.name}</h2>
                <p className="text-sm text-gray-500 mt-2">
                  {items.length} item{items.length !== 1 ? 's' : ''} • {items.filter(i => !i.checked).length} remaining
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddItemsModal(true)}
                  className="bg-orange-600 text-white rounded-lg px-5 py-2.5 font-semibold hover:bg-orange-700 transition shadow-sm flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Add Items
                </button>
                <button
                  onClick={() => setShowDeleteConfirmModal(true)}
                  className="text-red-600 hover:text-red-800 rounded-lg px-3 hover:bg-red-50 transition"
                  title="Delete List"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {items.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm font-semibold text-orange-700">{completionPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-orange-600 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
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
            <div className="space-y-6">
              {aisles.filter(aisle => itemsByAisle[aisle.name]?.length > 0).map(aisle => (
                <div key={aisle.id}>
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                    {aisle.name}
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                      {itemsByAisle[aisle.name].length}
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {itemsByAisle[aisle.name].map(item => (
                      <Card
                        key={item.id}
                        className={`p-4 transition-all ${
                          item.checked ? 'bg-gray-50 opacity-60' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleChecked(item)}
                            className="w-5 h-5 mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className={`font-semibold text-gray-900 ${item.checked ? 'line-through' : ''}`}>
                                  {item.name}
                                </h5>
                                <p className="text-sm text-gray-600 mt-1">
                                  {item.quantity} {item.unit}
                                </p>
                                {item.isStaple && (
                                  <span className="inline-block text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wide font-bold mt-2">
                                    Staple
                                  </span>
                                )}
                              </div>
                            </div>
                            {item.note && !editingNotes[item.id] && (
                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-sm text-gray-700 flex items-start justify-between gap-2">
                                <span>{item.note}</span>
                                <button
                                  onClick={() => setEditingNotes({ ...editingNotes, [item.id]: item.note || '' })}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                                  </svg>
                                </button>
                              </div>
                            )}
                            {editingNotes[item.id] !== undefined ? (
                              <div className="mt-2 flex gap-2">
                                <Input
                                  value={editingNotes[item.id]}
                                  onChange={(e) => setEditingNotes({ ...editingNotes, [item.id]: e.target.value })}
                                  placeholder="Add a note..."
                                  className="flex-1"
                                />
                                <Button onClick={() => handleUpdateNotes(item.id)} className="px-3">
                                  Save
                                </Button>
                                <Button
                                  onClick={() => {
                                    const newNotes = { ...editingNotes };
                                    delete newNotes[item.id];
                                    setEditingNotes(newNotes);
                                  }}
                                  className="px-3 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : !item.note && (
                              <button
                                onClick={() => setEditingNotes({ ...editingNotes, [item.id]: '' })}
                                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                              >
                                + Add note
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
