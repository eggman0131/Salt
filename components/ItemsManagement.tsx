import React, { useState, useEffect } from 'react';
import { CanonicalItem, Unit, Aisle, Recipe } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';

interface ItemsManagementProps {
  onRefresh?: () => void;
}

export const ItemsManagement: React.FC<ItemsManagementProps> = ({ onRefresh }) => {
  const [items, setItems] = useState<CanonicalItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<CanonicalItem | null>(null);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CanonicalItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipesUsingItem, setRecipesUsingItem] = useState<Recipe[]>([]);
  const [isLoadingDeleteRecipes, setIsLoadingDeleteRecipes] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formAisle, setFormAisle] = useState('');
  const [formIsStaple, setFormIsStaple] = useState(false);
  const [formSynonyms, setFormSynonyms] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [itemsData, unitsData, aislesData] = await Promise.all([
        saltBackend.getCanonicalItems(),
        saltBackend.getUnits(),
        saltBackend.getAisles()
      ]);
      setItems(itemsData.sort((a, b) => a.name.localeCompare(b.name)));
      setUnits(unitsData);
      setAisles(aislesData);
    } catch (err) {
      console.error('Failed to load data:', err);
      alert('Failed to load items');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewItemModal = () => {
    setFormName('');
    setFormUnit(units.length > 0 ? units[0].name : '_item');
    setFormAisle(aisles.length > 0 ? aisles[0].name : '');
    setFormIsStaple(false);
    setFormSynonyms('');
    setEditingItem(null);
    setShowNewItemModal(true);
  };

  const openEditModal = (item: CanonicalItem) => {
    setFormName(item.name);
    setFormUnit(item.preferredUnit);
    setFormAisle(item.aisle);
    setFormIsStaple(item.isStaple);
    setFormSynonyms(item.synonyms?.join(', ') || '');
    setEditingItem(item);
    setShowNewItemModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      alert('Item name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const synonymsArray = formSynonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const itemData = {
        name: formName.trim(),
        normalisedName: formName.trim().toLowerCase(),
        preferredUnit: formUnit,
        aisle: formAisle,
        isStaple: formIsStaple,
        synonyms: synonymsArray.length > 0 ? synonymsArray : undefined
      };

      if (editingItem) {
        await saltBackend.updateCanonicalItem(editingItem.id, itemData);
      } else {
        await saltBackend.createCanonicalItem(itemData);
      }

      setShowNewItemModal(false);
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save item:', err);
      alert('Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async (item: CanonicalItem) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
    setRecipesUsingItem([]);
    setIsLoadingDeleteRecipes(true);
    try {
      const recipes = await saltBackend.getRecipes();
      const matched = recipes.filter(recipe =>
        recipe.ingredients?.some(ing => ing.canonicalItemId === item.id)
      );
      setRecipesUsingItem(matched);
    } catch (err) {
      console.error('Failed to load recipes for item delete:', err);
    } finally {
      setIsLoadingDeleteRecipes(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    setIsSubmitting(true);
    try {
      await saltBackend.deleteCanonicalItem(itemToDelete.id);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('Failed to delete item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.normalisedName.includes(query) ||
      item.synonyms?.some(s => s.toLowerCase().includes(query))
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading items...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={openNewItemModal}>Add Item</Button>
      </div>

      {/* Items List */}
      <div className="grid gap-3">
        {filteredItems.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            {searchQuery ? 'No items match your search' : 'No items yet'}
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.isStaple && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        Staple
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-600 space-y-1">
                    <div>Unit: <span className="font-medium">{item.preferredUnit}</span></div>
                    {item.aisle && <div>Aisle: <span className="font-medium">{item.aisle}</span></div>}
                    {item.synonyms && item.synonyms.length > 0 && (
                      <div>Synonyms: <span className="text-gray-500">{item.synonyms.join(', ')}</span></div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => openEditModal(item)} className="text-sm">
                    Edit
                  </Button>
                  <Button onClick={() => confirmDelete(item)} className="text-sm bg-red-600 hover:bg-red-700">
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* New/Edit Item Modal */}
      {showNewItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Edit Item' : 'New Item'}
              </h2>

              <div>
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Onion"
                  required
                />
              </div>

              <div>
                <Label htmlFor="unit">Preferred Unit</Label>
                <select
                  id="unit"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="_item">Item (natural count)</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.name}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="aisle">Aisle</Label>
                <select
                  id="aisle"
                  value={formAisle}
                  onChange={(e) => setFormAisle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No aisle</option>
                  {aisles.map((aisle) => (
                    <option key={aisle.id} value={aisle.name}>
                      {aisle.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="staple"
                  type="checkbox"
                  checked={formIsStaple}
                  onChange={(e) => setFormIsStaple(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <Label htmlFor="staple" className="mb-0">Mark as staple item</Label>
              </div>

              <div>
                <Label htmlFor="synonyms">Synonyms (comma-separated)</Label>
                <Input
                  id="synonyms"
                  type="text"
                  value={formSynonyms}
                  onChange={(e) => setFormSynonyms(e.target.value)}
                  placeholder="e.g., Red onion, Brown onion"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  disabled={isSubmitting}
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && itemToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Confirm Delete</h2>
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{itemToDelete.name}</strong>?
              This cannot be undone.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Recipes using this item
              </p>
              {isLoadingDeleteRecipes ? (
                <p className="text-sm text-gray-600">Loading recipes...</p>
              ) : recipesUsingItem.length > 0 ? (
                <ul className="space-y-1 max-h-40 overflow-y-auto text-sm text-gray-700">
                  {recipesUsingItem.map(recipe => (
                    <li key={recipe.id} className="truncate">{recipe.title}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">None</p>
              )}
              {recipesUsingItem.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  This will remove the item from those recipes.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
                className="bg-gray-500 hover:bg-gray-600"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
