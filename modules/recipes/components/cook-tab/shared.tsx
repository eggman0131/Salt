import React from 'react';
import { Recipe, RecipeInstruction } from '../../../../types/contract';
import { Badge } from '../../../../components/ui/badge';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Progress } from '../../../../components/ui/progress';
import { Separator } from '../../../../components/ui/separator';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export const MiseEnPlaceContent: React.FC<{
  recipe: Recipe;
  miseEnPlaceChecked: Set<string>;
  handleMiseEnPlaceToggle: (ingredientId: string) => void;
  handleMiseEnPlaceToggleAll: () => void;
  miseEnPlaceProgress: number;
}> = ({
  recipe,
  miseEnPlaceChecked,
  handleMiseEnPlaceToggle,
  handleMiseEnPlaceToggleAll,
  miseEnPlaceProgress,
}) => (
  <div className="space-y-6">
    {/* Header */}
    <div className="text-center space-y-2">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Mise en Place</h2>
      <p className="text-sm text-muted-foreground">Prepare and gather all ingredients</p>
    </div>

    {/* Progress */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preparation Progress</span>
        <span className="text-sm font-bold text-primary">{miseEnPlaceChecked.size} / {recipe.ingredients.length}</span>
      </div>
      <Progress value={miseEnPlaceProgress} className="h-2" />
    </div>

    <Separator />

    {/* Ingredients Checklist */}
    <div className="space-y-3">
      {/* Tick All */}
      <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
        <Checkbox
          checked={miseEnPlaceChecked.size === recipe.ingredients.length}
          onCheckedChange={handleMiseEnPlaceToggleAll}
          id="tick-all"
        />
        <label
          htmlFor="tick-all"
          className="flex-1 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer"
        >
          Tick All
        </label>
      </div>

      {/* Ingredient Items */}
      <ul className="space-y-2">
        {recipe.ingredients.map((ingredient) => (
          <li key={ingredient.id} className="flex items-start gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
            <Checkbox
              checked={miseEnPlaceChecked.has(ingredient.id)}
              onCheckedChange={() => handleMiseEnPlaceToggle(ingredient.id)}
              id={`ingredient-${ingredient.id}`}
              className="mt-1"
            />
            <label
              htmlFor={`ingredient-${ingredient.id}`}
              className="flex-1 cursor-pointer"
            >
              <div className="font-medium text-gray-900 dark:text-white">
                {ingredient.quantity && ingredient.unit && (
                  <span className="font-bold">{ingredient.quantity} {ingredient.unit} </span>
                )}
                {ingredient.ingredientName}
              </div>
              {ingredient.preparation && (
                <div className="text-xs text-muted-foreground mt-1">{ingredient.preparation}</div>
              )}
            </label>
            {miseEnPlaceChecked.has(ingredient.id) && (
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-1" />
            )}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export const CookingStepContent = ({
  recipe,
  stepIndex,
}: {
  recipe: Recipe;
  stepIndex: number;
}): {
  instruction: string;
  hasWarning: boolean;
  nextInstruction: string | null;
  renderWarnings: () => React.ReactNode;
  renderIngredients: () => React.ReactNode;
} => {
  const instr = recipe.instructions[stepIndex] as RecipeInstruction;
  const nextInstr = stepIndex < recipe.instructions.length - 1 
    ? (recipe.instructions[stepIndex + 1] as RecipeInstruction) 
    : null;

  return {
    instruction: instr.text,
    hasWarning: instr.technicalWarnings && instr.technicalWarnings.length > 0,
    nextInstruction: nextInstr?.text || null,
    renderWarnings: () => (
      instr.technicalWarnings && instr.technicalWarnings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-warning">⚠ Warnings</h3>
          <div className="p-3 rounded-md bg-[color-mix(in_oklab,var(--warning)_10%,var(--background))] border border-warning/30">
            <ul className="space-y-2">
              {instr.technicalWarnings.map((warning, idx) => (
                <li key={idx} className="flex gap-2 text-sm text-warning-foreground">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    ),
    renderIngredients: () => (
      instr.ingredients && instr.ingredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {instr.ingredients.map((ingredient) => (
            <Badge key={ingredient.id} variant="secondary" className="text-xs py-0.5 px-2">
              {ingredient.quantity && ingredient.unit
                ? `${ingredient.quantity} ${ingredient.unit} ${ingredient.ingredientName}`
                : ingredient.ingredientName}
            </Badge>
          ))}
        </div>
      )
    ),
  };
};
