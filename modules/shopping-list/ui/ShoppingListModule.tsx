import React, { useState, useEffect, useMemo } from 'react';
import { Stack } from '@/shared/components/primitives';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

import { 
  getDefaultShoppingList, 
  getShoppingListItems, 
  removeRecipeFromShoppingList, 
  updateManualQuantity, 
  toggleItemChecked, 
  createManualItem 
} from '../api';
import { getRecipes } from '../../recipes/api';
import type { ShoppingList, ShoppingListItem, Recipe } from '../../../types/contract';

export const ShoppingListModule: React.FC = () => {
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [fetchedList, fetchedRecipes] = await Promise.all([
        getDefaultShoppingList(),
        getRecipes()
      ]);
      setList(fetchedList);
      setRecipes(fetchedRecipes);
      
      const fetchedItems = await getShoppingListItems(fetchedList.id);
      setItems(fetchedItems);
    } catch (err) {
      console.error(err);
      softToast.error('Failed to load shopping list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleChecked = async (item: ShoppingListItem) => {
    const newChecked = !item.checked;
    setItems(items.map(i => i.id === item.id ? { ...i, checked: newChecked } : i));
    try {
      if (list) await toggleItemChecked(item.id, newChecked, list.id);
    } catch (err) {
      setItems(items.map(i => i.id === item.id ? { ...i, checked: item.checked } : i));
    }
  };

  const handleUpdateManualQuantity = async (item: ShoppingListItem, delta: number) => {
    const newManualQuantity = Math.max(0, (item.manualQuantity || 0) + delta);
    setItems(items.map(i => i.id === item.id ? { ...i, manualQuantity: newManualQuantity } : i));
    try {
      if (list) {
        await updateManualQuantity(item.id, newManualQuantity, list.id);
        if (newManualQuantity === 0 && (item.recipeQuantity || 0) === 0 && !item.isStaple) {
          // If total quantity becomes 0, reload to remove it from the list
          loadData();
        }
      }
    } catch (err) {
      setItems(items.map(i => i.id === item.id ? { ...i, manualQuantity: item.manualQuantity } : i));
    }
  };

  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !list) return;

    try {
      await createManualItem(newItemName.trim(), 'Uncategorized', list.id);
      setNewItemName('');
      loadData();
    } catch (err) {
      softToast.error('Failed to add item');
    }
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    if (!list) return;
    try {
      await removeRecipeFromShoppingList(recipeId, list.id);
      softToast.success('Removed recipe from list');
      loadData();
    } catch (err) {
      softToast.error('Failed to remove recipe');
    }
  };

  const itemsByAisle = useMemo(() => {
    const grouped: Record<string, ShoppingListItem[]> = {};
    items.forEach(item => {
      const aisle = item.aisle || 'Other';
      if (!grouped[aisle]) grouped[aisle] = [];
      grouped[aisle].push(item);
    });
    return grouped;
  }, [items]);

  const listRecipes = useMemo(() => {
    if (!list || !list.recipeIds) return [];
    return list.recipeIds
      .map(id => recipes.find(r => r.id === id))
      .filter(Boolean) as Recipe[];
  }, [list, recipes]);

  if (isLoading && !list) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Stack spacing="gap-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Shopping List</h1>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="items">Items ({items.filter(i => !i.checked).length})</TabsTrigger>
          <TabsTrigger value="recipes">Recipes ({listRecipes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-6 space-y-6">
          <form onSubmit={handleAddManualItem} className="flex gap-2">
            <Input 
              placeholder="Add item..." 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Add</Button>
          </form>

          {Object.entries(itemsByAisle).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              Your shopping list is empty. Add a recipe or items manually.
            </div>
          ) : (
            <Stack spacing="gap-6">
              {Object.entries(itemsByAisle).sort(([a], [b]) => a.localeCompare(b)).map(([aisle, aisleItems]) => (
                <div key={aisle} className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-1">{aisle}</h3>
                  <div className="space-y-2">
                    {aisleItems.map(item => {
                      const totalQuantity = (item.recipeQuantity || 0) + (item.manualQuantity || 0);
                      
                      return (
                        <Card key={item.id} className={`transition-opacity ${item.checked ? 'opacity-50' : ''}`}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <button onClick={() => handleToggleChecked(item)} className="text-muted-foreground hover:text-foreground shrink-0">
                              {item.checked ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5" />}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${item.checked ? 'line-through' : ''}`}>
                                {item.name}
                              </p>
                              {item.sourceRecipeIds && item.sourceRecipeIds.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  From {item.sourceRecipeIds.length} recipe{item.sourceRecipeIds.length > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div className="text-sm font-medium">
                                {Number.isInteger(totalQuantity) ? totalQuantity : totalQuantity.toFixed(2)} {item.unit !== 'whole' ? item.unit : ''}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6" 
                                  onClick={() => handleUpdateManualQuantity(item, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-xs w-4 text-center">{item.manualQuantity || 0}</span>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6" 
                                  onClick={() => handleUpdateManualQuantity(item, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Stack>
          )}
        </TabsContent>

        <TabsContent value="recipes" className="mt-6">
          {listRecipes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              No recipes have been added to this list.
            </div>
          ) : (
            <Stack spacing="gap-3">
              {listRecipes.map(recipe => (
                <Card key={recipe.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {recipe.imagePath ? (
                        <img src={`/images/${recipe.imagePath}`} alt={recipe.title} className="w-12 h-12 object-cover rounded-md" />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">No img</div>
                      )}
                      <div>
                        <h4 className="font-semibold">{recipe.title}</h4>
                        <p className="text-sm text-muted-foreground">{recipe.ingredients.length} ingredients</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRemoveRecipe(recipe.id)} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </TabsContent>
      </Tabs>
    </Stack>
  );
};
