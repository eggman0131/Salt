import React, { useEffect, useState, useMemo } from 'react';
import { Recipe } from '../types/contract';
import { Button, Card, Input } from './UI';
import { recipesBackend } from '../modules/recipes';
import { shoppingBackend } from '../modules/shopping';

interface ShoppingListGeneratorProps {
  onListCreated?: () => void;
}

export const ShoppingListGenerator: React.FC<ShoppingListGeneratorProps> = ({ onListCreated }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [listName, setListName] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      const data = await recipesBackend.getRecipes();
      setRecipes(data.sort((a, b) => a.title.localeCompare(b.title)));
    } catch (err) {
      console.error('Failed to load recipes:', err);
      alert('Failed to load recipes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const handleToggleRecipe = (recipeId: string) => {
    setSelectedRecipeIds(prev =>
      prev.includes(recipeId)
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  const handleGenerate = async () => {
    if (selectedRecipeIds.length === 0) {
      alert('Please select at least one recipe');
      return;
    }
    if (!listName.trim()) {
      alert('Please enter a list name');
      return;
    }

    setIsGenerating(true);
    try {
      await shoppingBackend.generateShoppingList(selectedRecipeIds, listName.trim());
      alert(`Shopping list "${listName}" created successfully!`);
      setSelectedRecipeIds([]);
      setListName('');
      onListCreated?.();
    } catch (err) {
      console.error('Failed to generate list:', err);
      alert('Failed to generate shopping list');
    } finally {
      setIsGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return recipes.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  }, [recipes, search]);

  const selectedRecipes = useMemo(() => {
    return recipes.filter(r => selectedRecipeIds.includes(r.id));
  }, [recipes, selectedRecipeIds]);

  const autoListName = useMemo(() => {
    if (selectedRecipes.length === 0) return '';
    if (selectedRecipes.length === 1) return `${selectedRecipes[0].title} - Shopping`;
    if (selectedRecipes.length === 2) return `${selectedRecipes[0].title} & ${selectedRecipes[1].title}`;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return `Week of ${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }, [selectedRecipes]);

  useEffect(() => {
    if (selectedRecipes.length > 0 && !listName) {
      setListName(autoListName);
    }
  }, [autoListName, selectedRecipes.length, listName]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-6 sticky top-16 md:top-20 z-20">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Create Shopping List</h2>
            <p className="text-sm text-gray-500">Select recipes to generate a combined shopping list</p>
          </div>

          <div className="relative">
            <Input
              placeholder="Search recipes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-12 font-sans h-12 text-base shadow-sm border border-gray-200 bg-gray-50 focus:border-orange-500 focus:ring-orange-50 rounded-md"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              {selectedRecipeIds.length} recipe{selectedRecipeIds.length !== 1 ? 's' : ''} selected
            </span>
            {selectedRecipeIds.length > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <button
                  onClick={() => setSelectedRecipeIds([])}
                  className="text-orange-700 hover:text-orange-800 font-medium"
                >
                  Clear selection
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recipe Selection */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Available Recipes</h3>
            {filtered.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-gray-500 italic">No recipes found</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(recipe => {
                  const isSelected = selectedRecipeIds.includes(recipe.id);
                  return (
                    <Card
                      key={recipe.id}
                      className={`p-4 cursor-pointer transition-all border-l-4 ${
                        isSelected
                          ? 'border-l-orange-600 bg-orange-50'
                          : 'border-l-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleToggleRecipe(recipe.id)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRecipe(recipe.id)}
                          className="w-5 h-5 mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-1">{recipe.title}</h4>
                          {recipe.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Generation Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-44 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Generate List</h3>
              
              <Card className="p-6 border-l-4 border-l-orange-600">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                      List Name
                    </label>
                    <Input
                      value={listName}
                      onChange={e => setListName(e.target.value)}
                      placeholder="e.g. Weekly Shop"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                      Selected Recipes
                    </label>
                    {selectedRecipes.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No recipes selected</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRecipes.map(recipe => (
                          <div
                            key={recipe.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                              {recipe.title}
                            </span>
                            <button
                              onClick={() => handleToggleRecipe(recipe.id)}
                              className="text-gray-400 hover:text-red-600 ml-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || selectedRecipeIds.length === 0 || !listName.trim()}
                    className="w-full h-12 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                        </svg>
                        Generate Shopping List
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Salt will combine ingredients from all selected recipes
                  </p>
                </div>
              </Card>

              {selectedRecipes.length > 0 && (
                <Card className="p-4 bg-orange-50 border-orange-100">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-orange-700 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div className="text-xs text-gray-700 space-y-1">
                      <p className="font-semibold">Shopping list will:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Combine matching ingredients</li>
                        <li>Convert to preferred units</li>
                        <li>Group by supermarket aisle</li>
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
