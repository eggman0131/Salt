import type { RecipeConversationTurn, RecipeGenerationContext, RepairRecipeOptions } from '../types';

/**
 * Pure input-normalisation helpers for Recipes AI orchestration.
 */

export function normalizeConversationTurns(
  history: RecipeConversationTurn[] | undefined
): RecipeConversationTurn[] {
  if (!history) return [];

  return history.filter(turn => {
    if (!turn) return false;
    if ((turn.role !== 'user' && turn.role !== 'ai') || typeof turn.text !== 'string') {
      return false;
    }
    return turn.text.trim().length > 0;
  });
}

export function normalizeGenerationContext(
  context?: RecipeGenerationContext
): RecipeGenerationContext | undefined {
  if (!context) return undefined;

  return {
    currentRecipe: context.currentRecipe,
    history: normalizeConversationTurns(context.history),
  };
}

export function normalizeRepairOptions(options: RepairRecipeOptions): RepairRecipeOptions {
  return {
    categorize: Boolean(options.categorize),
    relinkIngredients: Boolean(options.relinkIngredients),
  };
}
