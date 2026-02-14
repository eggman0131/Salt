import React, { useState, useEffect } from 'react';
import { CategoryManagement } from './CategoryManagement';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';
import { IngredientKnowledgebase } from '../types/contract';

interface KitchenDataModuleProps {
  onRefresh: () => void;
  onSuggestionsChanged?: () => void;
}

export const KitchenDataModule: React.FC<KitchenDataModuleProps> = ({ onRefresh, onSuggestionsChanged }) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'ingredients'>('categories');
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [ingredients, setIngredients] = useState<IngredientKnowledgebase[]>([]);
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientKnowledgebase | null>(null);
  const [aisleSuggestions, setAisleSuggestions] = useState<string[]>([]);
  const [unitSuggestions, setUnitSuggestions] = useState<string[]>([]);

  useEffect(() => {
    loadSuggestionsCount();
  }, []);

  useEffect(() => {
    if (activeTab === 'ingredients') {
      loadIngredients();
      loadSuggestions();
    }
  }, [activeTab]);

  const loadSuggestionsCount = async () => {
    try {
      const pending = await saltBackend.getPendingCategories();
      setSuggestionsCount(pending.length);
    } catch (err) {
      console.error('Failed to load suggestions count:', err);
    }
  };

  const loadIngredients = async () => {
    try {
      setIsLoadingIngredients(true);
      const kb = await saltBackend.getIngredientKnowledgebase();
      setIngredients(kb);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    } finally {
      setIsLoadingIngredients(false);
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

  const handleRefresh = () => {
    loadSuggestionsCount();
    onRefresh();
  };

  const handleSuggestionsChanged = () => {
    loadSuggestionsCount();
    if (onSuggestionsChanged) {
      onSuggestionsChanged();
    }
  };

  const handleEditIngredient = (ingredient: IngredientKnowledgebase) => {
    setEditingIngredient({ ...ingredient });
  };

  const handleSaveIngredient = async () => {
    if (!editingIngredient) return;
    try {
      await saltBackend.updateIngredientMapping(editingIngredient.id, {
        ingredientName: editingIngredient.ingredientName,
        aileName: editingIngredient.aileName,
        unitType: editingIngredient.unitType,
        isStoreCupboard: editingIngredient.isStoreCupboard,
        aliases: editingIngredient.aliases,
      });
      setEditingIngredient(null);
      await loadIngredients();
    } catch (err) {
      console.error('Failed to update ingredient:', err);
      alert('Failed to update ingredient');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 box-border animate-in fade-in duration-500 overflow-hidden">
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 md:py-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900">Kitchen Data</h1>
          {suggestionsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
              <span className="text-sm font-semibold text-red-700">{suggestionsCount} to approve</span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">Manage categories, ingredients and recipe organization</p>
        
        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => setActiveTab('categories')}
            variant={activeTab === 'categories' ? 'primary' : 'secondary'}
          >
            Recipe Categories
          </Button>
          <Button
            onClick={() => setActiveTab('ingredients')}
            variant={activeTab === 'ingredients' ? 'primary' : 'secondary'}
          >
            Ingredient Knowledgebase
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 space-y-6">
          {activeTab === 'categories' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recipe Categories</h2>
              <CategoryManagement onRefresh={handleRefresh} onSuggestionsChanged={handleSuggestionsChanged} />
            </div>
          )}

          {activeTab === 'ingredients' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Ingredient Knowledgebase</h2>
              <p className="text-sm text-gray-600 mb-4">
                Review and edit ingredient classifications for shopping lists. 
                AI-suggested items with low confidence scores may need manual review.
              </p>

              {isLoadingIngredients ? (
                <Card>
                  <div className="p-8 text-center text-gray-500">Loading ingredients...</div>
                </Card>
              ) : ingredients.length === 0 ? (
                <Card>
                  <div className="p-8 text-center text-gray-500">
                    No ingredients classified yet. Add recipes to your shopping list to start building the knowledgebase.
                  </div>
                </Card>
              ) : (
                <div className="space-y-2">
                  {ingredients
                    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName))
                    .map(ingredient => (
                      <Card key={ingredient.id}>
                        <div className="p-4 flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{ingredient.ingredientName}</h3>
                              {ingredient.aiSuggested && ingredient.confidenceScore < 0.8 && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  Low Confidence
                                </span>
                              )}
                              {ingredient.isStoreCupboard && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Store Cupboard
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Aisle:</span> {ingredient.aileName}
                              {' • '}
                              <span className="font-medium">Unit:</span> {ingredient.unitType}
                              {' • '}
                              <span className="font-medium">Confidence:</span> {(ingredient.confidenceScore * 100).toFixed(0)}%
                            </div>
                            {ingredient.aliases && ingredient.aliases.length > 0 && (
                              <div className="text-sm text-gray-500 mt-1">
                                <span className="font-medium">Aliases:</span> {ingredient.aliases.join(', ')}
                              </div>
                            )}
                          </div>
                          <Button
                            onClick={() => handleEditIngredient(ingredient)}
                            variant="secondary"
                            
                          >
                            Edit
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Ingredient Modal */}
      {editingIngredient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-light mb-4">Edit Ingredient</h2>
              
              <div className="space-y-4">
                <div>
                  <Label>Canonical Name</Label>
                  <Input
                    value={editingIngredient.ingredientName}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, ingredientName: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Aisle</Label>
                  <Input
                    list="aisle-suggestions"
                    value={editingIngredient.aileName}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, aileName: e.target.value })}
                  />
                  <datalist id="aisle-suggestions">
                    {aisleSuggestions.map(aisle => (
                      <option key={aisle} value={aisle} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <Label>Unit Type</Label>
                  <Input
                    list="unit-suggestions"
                    value={editingIngredient.unitType}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, unitType: e.target.value })}
                  />
                  <datalist id="unit-suggestions">
                    {unitSuggestions.map(unit => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <Label>Aliases (comma-separated)</Label>
                  <Input
                    value={editingIngredient.aliases?.join(', ') || ''}
                    onChange={(e) => setEditingIngredient({ 
                      ...editingIngredient, 
                      aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingIngredient.isStoreCupboard}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, isStoreCupboard: e.target.checked })}
                    className="w-4 h-4"
                    id="store-cupboard-check"
                  />
                  <label htmlFor="store-cupboard-check" className="text-sm cursor-pointer">
                    Store Cupboard Item
                  </label>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button onClick={handleSaveIngredient}>Save</Button>
                <Button onClick={() => setEditingIngredient(null)} variant="secondary">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
