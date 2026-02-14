import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';
import { ShoppingList, ShoppingListItem, Recipe } from '../types/contract';

interface ShoppingListModuleProps {
  recipes: Recipe[];
  onRefresh?: () => void;
}

export const ShoppingListModule: React.FC<ShoppingListModuleProps> = ({ recipes, onRefresh }) => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterStoreCupboard, setFilterStoreCupboard] = useState(false);
  const [aisleSuggestions, setAisleSuggestions] = useState<string[]>([]);
  const [unitSuggestions, setUnitSuggestions] = useState<string[]>([]);

  useEffect(() => {
    loadLists();
    loadSuggestions();
  }, []);

  const loadLists = async () => {
    try {
      setIsLoading(true);
      const allLists = await saltBackend.getShoppingLists();
      setLists(allLists);
      if (allLists.length > 0 && !activeListId) {
        const defaultList = allLists.find(l => l.isDefault) || allLists[0];
        setActiveListId(defaultList.id);
      }
    } catch (err) {
      console.error('Failed to load shopping lists:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      const [aisles, units] = await Promise.all([
        saltBackend.getUniqueAisleNames(),
        saltBackend.getUniqueUnitTypes(),
      ]);
      setAisleSuggestions(aisles);
      setUnitSuggestions(units);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  const activeList = lists.find(l => l.id === activeListId);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await saltBackend.createShoppingList(newListName);
      setNewListName('');
      setIsCreatingList(false);
      await loadLists();
    } catch (err) {
      console.error('Failed to create list:', err);
      alert('Failed to create shopping list');
    }
  };

  const handleSetDefault = async (listId: string) => {
    try {
      await saltBackend.setDefaultShoppingList(listId);
      await loadLists();
    } catch (err) {
      console.error('Failed to set default list:', err);
      alert('Failed to set default list');
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Delete this shopping list?')) return;
    try {
      await saltBackend.deleteShoppingList(listId);
      if (activeListId === listId) {
        setActiveListId(null);
      }
      await loadLists();
    } catch (err) {
      console.error('Failed to delete list:', err);
      alert('Failed to delete list');
    }
  };

  const handleAddRecipe = async () => {
    if (!selectedRecipeId || !activeListId) return;
    try {
      await saltBackend.addRecipeToShoppingList(selectedRecipeId, activeListId);
      setIsAddingRecipe(false);
      setSelectedRecipeId('');
      await loadLists();
    } catch (err) {
      console.error('Failed to add recipe:', err);
      alert('Failed to add recipe to shopping list');
    }
  };

  const handleToggleItem = async (itemId: string, checked: boolean) => {
    if (!activeListId) return;
    try {
      await saltBackend.toggleShoppingListItem(activeListId, itemId, checked);
      await loadLists();
    } catch (err) {
      console.error('Failed to toggle item:', err);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!activeListId) return;
    try {
      await saltBackend.removeShoppingListItem(activeListId, itemId);
      await loadLists();
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const handleClearChecked = async () => {
    if (!activeListId || !confirm('Clear all checked items?')) return;
    try {
      await saltBackend.clearCheckedItems(activeListId);
      await loadLists();
    } catch (err) {
      console.error('Failed to clear checked items:', err);
      alert('Failed to clear checked items');
    }
  };

  // Group items by aisle
  const groupedItems = activeList?.items.reduce((acc, item) => {
    if (filterStoreCupboard && item.isStoreCupboard) {
      return acc;
    }
    const aisle = item.aileName || 'Other';
    if (!acc[aisle]) {
      acc[aisle] = [];
    }
    acc[aisle].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>) || {};

  if (isLoading) {
    return (
      <div className="p-8">
        <Card>
          <div className="p-8 text-center text-gray-500">Loading shopping lists...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-light">Shopping Lists</h1>
        <Button onClick={() => setIsCreatingList(true)}>Create New List</Button>
      </div>

      {/* List Selector */}
      {lists.length > 0 && (
        <Card className="mb-6">
          <div className="flex gap-2 flex-wrap p-4">
            {lists.map(list => (
              <div key={list.id} className="flex items-center gap-2">
                <Button
                  onClick={() => setActiveListId(list.id)}
                  variant={activeListId === list.id ? 'primary' : 'secondary'}
                >
                  {list.name} {list.isDefault && '(Default)'}
                </Button>
                <Button
                  onClick={() => handleSetDefault(list.id)}
                  variant="secondary"
                  
                  disabled={list.isDefault}
                >
                  Set Default
                </Button>
                <Button
                  onClick={() => handleDeleteList(list.id)}
                  variant="secondary"
                  
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create List Modal */}
      {isCreatingList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-2xl font-light mb-4">Create Shopping List</h2>
              <Label>List Name</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Tesco, Farmers Market"
              />
              <div className="flex gap-2 mt-4">
                <Button onClick={handleCreateList} disabled={!newListName.trim()}>
                  Create
                </Button>
                <Button onClick={() => setIsCreatingList(false)} variant="secondary">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Active List View */}
      {activeList && (
        <>
          {/* Controls */}
          <Card className="mb-6">
            <div className="p-4 flex gap-4 items-center flex-wrap">
              <Button onClick={() => setIsAddingRecipe(true)}>Add Recipe</Button>
              <Button onClick={handleClearChecked} variant="secondary">
                Clear Checked Items
              </Button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterStoreCupboard}
                  onChange={(e) => setFilterStoreCupboard(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Hide Store Cupboard Items</span>
              </label>
            </div>
          </Card>

          {/* Items Grouped by Aisle */}
          {Object.keys(groupedItems).length === 0 ? (
            <Card>
              <div className="p-8 text-center text-gray-500">
                No items in this list. Add a recipe to get started.
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([aisle, items]) => (
                  <Card key={aisle}>
                    <div className="p-4">
                      <h3 className="text-xl font-light mb-4 border-b pb-2">{aisle}</h3>
                      <div className="space-y-2">
                        {items.map(item => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-4 p-3 rounded ${
                              item.isCheckedOff ? 'bg-gray-100 opacity-60' : 'bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.isCheckedOff}
                              onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                              className="w-5 h-5"
                            />
                            <div className="flex-1">
                              <div className={`font-medium ${item.isCheckedOff ? 'line-through' : ''}`}>
                                {item.ingredientName}
                              </div>
                              <div className="text-sm text-gray-600">
                                {item.quantity} {item.unit}
                                {item.isStoreCupboard && (
                                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    Store Cupboard
                                  </span>
                                )}
                              </div>
                              {item.notes && (
                                <div className="text-sm text-gray-500 italic">{item.notes}</div>
                              )}
                            </div>
                            <Button
                              onClick={() => handleRemoveItem(item.id)}
                              variant="secondary"
                              
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </>
      )}

      {/* Add Recipe Modal */}
      {isAddingRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-light mb-4">Add Recipe to List</h2>
              <Label>Select Recipe</Label>
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded mb-4"
              >
                <option value="">Select a recipe...</option>
                {recipes.map(recipe => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.title}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button onClick={handleAddRecipe} disabled={!selectedRecipeId}>
                  Add to List
                </Button>
                <Button onClick={() => setIsAddingRecipe(false)} variant="secondary">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {lists.length === 0 && !isCreatingList && (
        <Card>
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No shopping lists yet.</p>
            <Button onClick={() => setIsCreatingList(true)}>Create Your First List</Button>
          </div>
        </Card>
      )}
    </div>
  );
};
