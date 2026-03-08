import type { Recipe } from '../../types/contract';

/**
 * Progress events for long-running recipe save/update/repair operations.
 */
export interface RecipeSaveProgress {
  stage: string;
  current?: number;
  total?: number;
  percentage?: number;
}

/**
 * Shared chat turn format used by recipe AI workflows.
 */
export interface RecipeConversationTurn {
  role: 'user' | 'ai';
  text: string;
}

/**
 * Canonical input for creating a recipe via the Recipes API.
 */
export type CreateRecipeInput = Omit<
  Recipe,
  'id' | 'createdAt' | 'createdBy' | 'imagePath'
>;

/**
 * Canonical input for recipe updates via the Recipes API.
 */
export type UpdateRecipeInput = Partial<Recipe>;

/**
 * Options for recipe repair workflow.
 */
export interface RepairRecipeOptions {
  categorize?: boolean;
  relinkIngredients?: boolean;
}

/**
 * AI recipe generation context.
 */
export interface RecipeGenerationContext {
  currentRecipe?: Recipe;
  history?: RecipeConversationTurn[];
}
