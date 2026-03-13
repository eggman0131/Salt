/**
 * Recipes Module Public API
 *
 * Phase B goal: stabilise a canonical API surface for recipe workflows,
 * including recipe-focused AI orchestration, under `modules/recipes`.
 */

import type { Recipe } from '../../types/contract';
import {
  chatAboutRecipe,
  chatForRecipeDraft,
  createRecipeInStore,
  deleteRecipeFromStore,
  fetchRecipeById,
  fetchRecipes,
  generateRecipeFromPromptDraft,
  generateRecipeImageData,
  importRecipeDraftFromUrl,
  notifyCanonItemsDeleted,
  repairStoredRecipe,
  resolveRecipeImagePath,
  summarizeRecipeAgreement,
  updateRecipeInStore,
} from './data/recipes-provider';
import type {
  CreateRecipeInput,
  RecipeConversationTurn,
  RecipeGenerationContext,
  RecipeSaveProgress,
  RepairRecipeOptions,
  UpdateRecipeInput,
} from './types';

// ==================== RECIPE CRUD ====================

export async function getRecipes(): Promise<Recipe[]> {
  return fetchRecipes();
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  return fetchRecipeById(id);
}

export async function createRecipe(
  recipe: CreateRecipeInput,
  imageData?: string,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  return createRecipeInStore(recipe, imageData, onProgress);
}

export async function updateRecipe(
  id: string,
  updates: UpdateRecipeInput,
  imageData?: string,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  return updateRecipeInStore(id, updates, imageData, onProgress);
}

export async function deleteRecipe(id: string): Promise<void> {
  return deleteRecipeFromStore(id);
}

export async function resolveImagePath(path: string): Promise<string> {
  return resolveRecipeImagePath(path);
}

// ==================== REPAIR / NOTIFICATIONS ====================

export async function repairRecipe(
  recipeId: string,
  options: RepairRecipeOptions,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  return repairStoredRecipe(recipeId, options, onProgress);
}

export async function onCanonItemsDeleted(ids: string[]): Promise<void> {
  return notifyCanonItemsDeleted(ids);
}

// ==================== RECIPE AI WORKFLOWS ====================

export async function generateRecipeFromPrompt(
  prompt: string,
  context?: RecipeGenerationContext
): Promise<Partial<Recipe>> {
  return generateRecipeFromPromptDraft(prompt, context);
}

export async function chatWithRecipe(
  recipe: Recipe,
  message: string,
  history: RecipeConversationTurn[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  return chatAboutRecipe(recipe, message, history, onChunk);
}

export async function summarizeAgreedRecipe(
  history: RecipeConversationTurn[],
  currentRecipe?: Recipe
): Promise<string> {
  return summarizeRecipeAgreement(history, currentRecipe);
}

export async function chatForDraft(
  history: RecipeConversationTurn[]
): Promise<string> {
  return chatForRecipeDraft(history);
}

export async function generateRecipeImage(
  recipeTitle: string,
  description?: string
): Promise<string> {
  return generateRecipeImageData(recipeTitle, description);
}

export async function importRecipeFromUrl(url: string): Promise<Partial<Recipe>> {
  return importRecipeDraftFromUrl(url);
}

export const recipesApi = {
  getRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  resolveImagePath,
  repairRecipe,
  onCanonItemsDeleted,
  generateRecipeFromPrompt,
  chatWithRecipe,
  summarizeAgreedRecipe,
  chatForDraft,
  generateRecipeImage,
  importRecipeFromUrl,
};

export { buildManualEditSummary, createHistoryEntry } from './logic/recipe-updates';

export { cleanupOrphanedRecipeImages } from './data/storage-cleanup';
export type { CleanupStats } from './data/storage-cleanup';

export type {
  CreateRecipeInput,
  RecipeConversationTurn,
  RecipeGenerationContext,
  RecipeSaveProgress,
  RepairRecipeOptions,
  UpdateRecipeInput,
};
