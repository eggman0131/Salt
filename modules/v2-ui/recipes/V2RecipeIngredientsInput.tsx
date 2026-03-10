import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../design-system/components/Button';
import { Input } from '../design-system/components/Input';
import { Label } from '../design-system/components/Label';
import { Combobox } from '../../../components/ui/combobox';
import { X, AlertCircle } from 'lucide-react';
import type { RecipeIngredient, Unit } from '../../../types/contract';
import type { CanonItem } from '../../../modules/canon/api';

interface V2RecipeIngredientsInputProps {
  ingredients: RecipeIngredient[];
  units: Unit[];
  canonItems: CanonItem[];
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onChangeQuantity: (index: number, quantity: string) => void;
  onChangeUnit: (index: number, unit: string) => void;
  onChangeIngredientName: (index: number, name: string) => void;
  onChangeQualifiers: (index: number, qualifiers: string) => void;
  onChangePreparation: (index: number, prep: string) => void;
  onChangeRaw: (index: number, raw: string) => void;
  onChangeCanonItem: (index: number, canonicalItemId: string | null) => void;
}

export function V2RecipeIngredientsInput({
  ingredients,
  units,
  canonItems,
  onAddIngredient,
  onRemoveIngredient,
  onChangeQuantity,
  onChangeUnit,
  onChangeIngredientName,
  onChangeQualifiers,
  onChangePreparation,
  onChangeRaw,
  onChangeCanonItem,
}: V2RecipeIngredientsInputProps) {
  const unitOptions = units.map(u => ({ label: u.name, value: u.name }));
  const canonOptions = canonItems.map(c => ({ label: c.name, value: c.id }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xl font-black tracking-tight text-[var(--color-v2-foreground)]">Ingredients *</Label>
        <AddButton
          type="button"
          onClick={onAddIngredient}
          label="Add Ingredient"
          className="bg-[var(--color-v2-primary)] text-white hover:bg-[var(--color-v2-primary)]/90 border-0"
        />
      </div>
      
      <div className="space-y-4">
        {ingredients.length === 0 && (
          <p className="text-sm text-[var(--color-v2-muted-foreground)] italic p-4 text-center border overflow-hidden border-dashed border-[var(--color-v2-border)] rounded-2xl">
            No ingredients added
          </p>
        )}
        
        {ingredients.map((ingredient, index) => {
          const hasReviewFlags = ingredient.parseReviewFlags && ingredient.parseReviewFlags.length > 0;

          return (
            <div key={ingredient.id} className="relative group space-y-4 border border-[var(--color-v2-border)] bg-[var(--color-v2-card)]/50 p-5 rounded-2xl transition-all hover:bg-[var(--color-v2-card)] focus-within:ring-2 focus-within:ring-[var(--color-v2-primary)]/20 shadow-sm">
              {hasReviewFlags && (
                <div className="flex items-start gap-2 rounded-xl bg-orange-500/10 p-3 text-xs text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {ingredient.parseReviewFlags!.map((flag, i) => (
                      <p key={i}>{flag}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold uppercase tracking-wider text-[var(--color-v2-primary)]">
                  Ingredient {index + 1}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--color-v2-muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-full"
                  onClick={() => onRemoveIngredient(ingredient.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor={`v2-ingredient-${index}-raw`} className="text-xs text-[var(--color-v2-muted-foreground)] mb-1.5 block font-bold">
                    Original Ingredient String (Raw)
                  </Label>
                  <Input
                    id={`v2-ingredient-${index}-raw`}
                    value={ingredient.raw || ''}
                    onChange={(e) => onChangeRaw(index, e.target.value)}
                    placeholder="e.g., 2 cups free-range chicken breast, diced"
                    className="h-11 bg-[var(--color-v2-primary)]/5 border-dashed border-[var(--color-v2-primary)]/30 focus-visible:border-solid text-[var(--color-v2-foreground)] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 pt-2">
                <div className="col-span-12 md:col-span-2">
                  <Label htmlFor={`v2-ingredient-${index}-quantity`} className="text-xs text-[var(--color-v2-muted-foreground)] mb-1.5 block">
                    Qty
                  </Label>
                  <Input
                    id={`v2-ingredient-${index}-quantity`}
                    type="number"
                    step="any"
                    value={ingredient.quantity || ''}
                    onChange={(e) => onChangeQuantity(index, e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                </div>
                
                <div className="col-span-12 md:col-span-3">
                  <Label htmlFor={`v2-ingredient-${index}-unit`} className="text-xs text-[var(--color-v2-muted-foreground)] mb-1.5 block">
                    Unit
                  </Label>
                  <Combobox
                    options={unitOptions}
                    value={ingredient.unit}
                    onValueChange={(value) => onChangeUnit(index, value)}
                    placeholder="Auto..."
                    searchPlaceholder="Search units..."
                    emptyMessage="No unit found"
                    className="h-11 w-full bg-[var(--color-v2-background)]"
                  />
                </div>

                <div className="col-span-12 md:col-span-7">
                  <Label htmlFor={`v2-ingredient-${index}-name`} className="text-xs text-[var(--color-v2-muted-foreground)] mb-1.5 block">
                    Name *
                  </Label>
                  <Input
                    id={`v2-ingredient-${index}-name`}
                    value={ingredient.ingredientName}
                    onChange={(e) => onChangeIngredientName(index, e.target.value)}
                    placeholder="e.g., free-range chicken breast"
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`v2-ingredient-${index}-qualifiers`} className="text-xs text-[var(--color-v2-muted-foreground)] mb-1.5 block">
                    Qualifiers
                  </Label>
                  <Input
                    id={`v2-ingredient-${index}-qualifiers`}
                    value={ingredient.qualifiers || ''}
                    onChange={(e) => onChangeQualifiers(index, e.target.value)}
                    placeholder="e.g., fresh, organic"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor={`v2-ingredient-${index}-preparation`} className="text-xs text-[var(--color-v2-muted-foreground)] mb-1.5 block">
                    Preparation
                  </Label>
                  <Input
                    id={`v2-ingredient-${index}-preparation`}
                    value={ingredient.preparation || ''}
                    onChange={(e) => onChangePreparation(index, e.target.value)}
                    placeholder="e.g., diced, finely sliced"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor={`v2-ingredient-${index}-canon`} className="text-xs text-[var(--color-v2-primary)] font-bold mb-1.5 block">
                    Canon Match
                  </Label>
                  <Combobox
                    options={canonOptions}
                    value={ingredient.canonicalItemId || ''}
                    onValueChange={(value) => onChangeCanonItem(index, value || null)}
                    placeholder="Link to Canon..."
                    searchPlaceholder="Search canon items..."
                    emptyMessage="No match found"
                    className="h-11 w-full bg-[var(--color-v2-primary)]/5 border-[var(--color-v2-primary)]/20"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
