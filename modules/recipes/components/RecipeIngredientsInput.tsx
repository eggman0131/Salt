import React from 'react';
import { RecipeIngredient } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Combobox } from '../../../components/ui/combobox';
import { Badge } from '../../../components/ui/badge';
import { X, AlertTriangle } from 'lucide-react';

interface RecipeIngredientsInputProps {
  ingredients: RecipeIngredient[];
  units: any[];
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onChangeQuantity: (index: number, quantity: string | null) => void;
  onChangeUnit: (index: number, unit: string | null) => void;
  onChangeIngredientName: (index: number, name: string) => void;
  onChangeQualifiers: (index: number, qualifiers: string[]) => void;
  onChangePreparation: (index: number, prep: string) => void;
}

/**
 * Format parse review flags human-readable descriptions
 */
function formatReviewFlag(flag: string): string {
  const descriptions: Record<string, string> = {
    'invalid-aisle-id-repaired': 'Aisle ID was invalid and repaired',
    'invalid-unit-id-repaired': 'Unit ID was invalid and repaired',
    'missing-aisle-suggestion': 'No aisle suggestion provided',
    'index-mismatch': 'Index mismatch detected',
    'index-duplicate': 'Duplicate index found',
    'data-repaired': 'Data structure was repaired',
  };
  return descriptions[flag] || flag;
}

export const RecipeIngredientsInput: React.FC<RecipeIngredientsInputProps> = ({
  ingredients,
  units,
  onAddIngredient,
  onRemoveIngredient,
  onChangeQuantity,
  onChangeUnit,
  onChangeIngredientName,
  onChangeQualifiers,
  onChangePreparation,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Ingredients *</Label>
        <AddButton type="button" onClick={onAddIngredient} label="Add" />
      </div>
      <div className="space-y-2">
        {ingredients.map((ingredient, index) => {
          const hasReviewFlags = ingredient.parseReviewFlags && ingredient.parseReviewFlags.length > 0;
          
          return (
            <div key={ingredient.id} className="space-y-1">
              <div className="flex gap-2 items-start w-full group">
                <div className="flex gap-1 flex-1 min-w-0">
                  <Input
                    placeholder="Qty"
                    value={ingredient.quantity || ''}
                    onChange={(e) => onChangeQuantity(index, e.target.value || null)}
                    className="shrink-0 w-14 md:w-16 text-sm h-9"
                    type="number"
                    step="any"
                  />
                  <Combobox
                    options={units.map(u => ({ value: u.name, label: u.name }))}
                    value={ingredient.unit || ''}
                    onValueChange={(value) => onChangeUnit(index, value || null)}
                    placeholder="Unit"
                    searchPlaceholder="Search units..."
                    emptyMessage="No unit found."
                    allowClear={true}
                    className="shrink-0 w-18 md:w-24"
                  />
                  <Input
                    placeholder="Ingredient"
                    value={ingredient.ingredientName || ''}
                    onChange={(e) => onChangeIngredientName(index, e.target.value)}
                    className="flex-1 min-w-0 text-sm h-9"
                  />
                  <Input
                    placeholder="Qualifiers"
                    value={ingredient.qualifiers?.join(', ') || ''}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      const qualifiers = value ? value.split(',').map(q => q.trim()).filter(q => q) : [];
                      onChangeQualifiers(index, qualifiers);
                    }}
                    className="shrink-0 w-24 md:w-32 text-sm h-9"
                    title="e.g., fresh, organic, red (comma-separated)"
                  />
                  <Input
                    placeholder="Prep"
                    value={ingredient.preparation || ''}
                    onChange={(e) => onChangePreparation(index, e.target.value)}
                    className="shrink-0 w-20 md:w-28 text-sm h-9"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveIngredient(ingredient.id)}
                  className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* PR7: Display parse review warnings */}
              {hasReviewFlags && (
                <div className="flex items-start gap-1 ml-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {ingredient.parseReviewFlags!.map((flag, i) => (
                      <Badge 
                        key={i} 
                        variant="outline" 
                        className="text-xs py-0 px-1.5 h-auto border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
                        title={formatReviewFlag(flag)}
                      >
                        {formatReviewFlag(flag)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
