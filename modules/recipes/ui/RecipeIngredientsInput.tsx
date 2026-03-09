import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { X, AlertCircle } from 'lucide-react';
import type { RecipeIngredient, Unit } from '@/types/contract';

interface RecipeIngredientsInputProps {
  ingredients: RecipeIngredient[];
  units: Unit[];
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onChangeQuantity: (index: number, quantity: string) => void;
  onChangeUnit: (index: number, unit: string) => void;
  onChangeIngredientName: (index: number, name: string) => void;
  onChangeQualifiers: (index: number, qualifiers: string) => void;
  onChangePreparation: (index: number, prep: string) => void;
}

export function RecipeIngredientsInput({
  ingredients,
  units,
  onAddIngredient,
  onRemoveIngredient,
  onChangeQuantity,
  onChangeUnit,
  onChangeIngredientName,
  onChangeQualifiers,
  onChangePreparation,
}: RecipeIngredientsInputProps) {
  const unitOptions = units.map(u => ({ label: u.name, value: u.name }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Ingredients *</Label>
        <AddButton
          type="button"
          onClick={onAddIngredient}
          label="Add Ingredient"
        />
      </div>
      <div className="space-y-3">
        {ingredients.length === 0 && (
          <p className="text-sm text-muted-foreground">No ingredients added</p>
        )}
        {ingredients.map((ingredient, index) => {
          const hasReviewFlags = ingredient.parseReviewFlags && ingredient.parseReviewFlags.length > 0;

          return (
            <div key={ingredient.id} className="space-y-4 rounded-md border p-4 bg-card">
              {hasReviewFlags && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950 p-2 text-xs text-amber-900 dark:text-amber-100 mb-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {ingredient.parseReviewFlags!.map((flag, i) => (
                      <p key={i}>{flag}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-4">
                  {/* Primary Row: Quantity, Unit, Name */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor={`ingredient-${index}-quantity`} className="text-xs text-muted-foreground">
                        Qty
                      </Label>
                      <Input
                        id={`ingredient-${index}-quantity`}
                        type="number"
                        step="any"
                        value={ingredient.quantity || ''}
                        onChange={(e) => onChangeQuantity(index, e.target.value)}
                        placeholder="0"
                        className="w-full"
                      />
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <Label htmlFor={`ingredient-${index}-unit`} className="text-xs text-muted-foreground">
                        Unit
                      </Label>
                      <Combobox
                        options={unitOptions}
                        value={ingredient.unit}
                        onValueChange={(value) => onChangeUnit(index, value)}
                        placeholder="Unit"
                        searchPlaceholder="Search units..."
                        emptyMessage="No unit found"
                        className="w-full"
                      />
                    </div>
                    <div className="md:col-span-7 flex flex-col gap-1.5">
                      <Label htmlFor={`ingredient-${index}-name`} className="text-xs text-muted-foreground">
                        Ingredient Name *
                      </Label>
                      <Input
                        id={`ingredient-${index}-name`}
                        value={ingredient.ingredientName}
                        onChange={(e) => onChangeIngredientName(index, e.target.value)}
                        placeholder="e.g., chicken breast"
                        required
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Secondary Row: Qualifiers, Preparation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pl-0 md:pl-3 border-l-2 border-muted/50">
                    <div className="space-y-1.5">
                      <Label htmlFor={`ingredient-${index}-qualifiers`} className="text-xs text-muted-foreground">
                        Qualifiers
                      </Label>
                      <Input
                        id={`ingredient-${index}-qualifiers`}
                        value={ingredient.qualifiers || ''}
                        onChange={(e) => onChangeQualifiers(index, e.target.value)}
                        placeholder="e.g., fresh, organic"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`ingredient-${index}-preparation`} className="text-xs text-muted-foreground">
                        Preparation
                      </Label>
                      <Input
                        id={`ingredient-${index}-preparation`}
                        value={ingredient.preparation || ''}
                        onChange={(e) => onChangePreparation(index, e.target.value)}
                        placeholder="e.g., diced, sliced"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0 mt-6 md:mt-6"
                  onClick={() => onRemoveIngredient(ingredient.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
