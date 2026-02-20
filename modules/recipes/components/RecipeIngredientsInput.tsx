import React from 'react';
import { RecipeIngredient, CanonicalItem } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface RecipeIngredientsInputProps {
  ingredients: RecipeIngredient[];
  ingredientSearchQueries: { [key: number]: string | undefined };
  availableIngredients: CanonicalItem[];
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onChangeQuantity: (index: number, quantity: string | null) => void;
  onChangeUnit: (index: number, unit: string | null) => void;
  onChangeIngredientName: (index: number, name: string) => void;
  onChangePreparation: (index: number, prep: string) => void;
  onChangeSearchQuery: (index: number, query: string | undefined) => void;
}

export const RecipeIngredientsInput: React.FC<RecipeIngredientsInputProps> = ({
  ingredients,
  ingredientSearchQueries,
  availableIngredients,
  onAddIngredient,
  onRemoveIngredient,
  onChangeQuantity,
  onChangeUnit,
  onChangeIngredientName,
  onChangePreparation,
  onChangeSearchQuery,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Ingredients *</Label>
        <AddButton type="button" onClick={onAddIngredient} label="Add" />
      </div>
      <div className="space-y-2">
        {ingredients.map((ingredient, index) => {
          const query = ingredientSearchQueries[index];
          const showSuggestions = query && query.length > 0 && !availableIngredients.find(item => item.name === query);
          const getFilteredIngredients = () => {
            if (!showSuggestions) return [];
            return availableIngredients
              .filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
              .map(item => item.name)
              .sort();
          };
          const filtered = getFilteredIngredients();

          return (
            <div key={ingredient.id} className="flex gap-1 items-start w-full">
              <Input
                placeholder="Qty"
                value={ingredient.quantity || ''}
                onChange={(e) => onChangeQuantity(index, e.target.value || null)}
                className="shrink-0 w-13 md:w-16 text-sm"
                type="number"
                step="any"
              />
              <Input
                placeholder="Unit"
                value={ingredient.unit || ''}
                onChange={(e) => onChangeUnit(index, e.target.value || null)}
                className="shrink-0 w-17 md:w-32 text-sm"
                list={`units-${index}`}
              />
              <datalist id={`units-${index}`}>
                <option>ml</option>
                <option>l</option>
                <option>g</option>
                <option>kg</option>
              </datalist>
              <div className="w-40 md:flex-1 relative min-w-0">
                <Input
                  placeholder="Ingredient *"
                  value={ingredient.ingredientName}
                  onChange={(e) => onChangeIngredientName(index, e.target.value)}
                  onFocus={() => onChangeSearchQuery(index, ingredient.ingredientName || '')}
                  onBlur={() => onChangeSearchQuery(index, undefined)}
                  className="w-full text-sm"
                />
                {filtered.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-gray-950 border rounded-md shadow-lg mt-1">
                    {filtered.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          onChangeIngredientName(index, name);
                          onChangeSearchQuery(index, undefined);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                placeholder="Prep"
                value={ingredient.preparation || ''}
                onChange={(e) => onChangePreparation(index, e.target.value)}
                className="shrink-0 w-18 md:w-24 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveIngredient(ingredient.id)}
                className="shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
