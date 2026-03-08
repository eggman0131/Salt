import type { Recipe } from '../../../types/contract';
import type {
  CreateRecipeInput,
  RecipeConversationTurn,
  RecipeGenerationContext,
  RecipeSaveProgress,
  RepairRecipeOptions,
  UpdateRecipeInput,
} from '../types';
import {
  createRecipeInStore as createRecipeInCrud,
  deleteRecipeFromStore as deleteRecipeInCrud,
  fetchRecipeById as fetchRecipeInCrud,
  fetchRecipes as fetchRecipesInCrud,
  repairStoredRecipe as repairRecipeInCrud,
  resolveRecipeImagePath as resolveImagePathInCrud,
  updateRecipeInStore as updateRecipeInCrud,
} from './crud-provider';
import {
  chatAboutRecipe as chatAboutRecipeWithAi,
  chatForRecipeDraft as chatForDraftWithAi,
  generateRecipeFromPromptDraft as generateFromPromptWithAi,
  generateRecipeImageData as generateImageWithAi,
  importRecipeDraftFromUrl as importFromUrlWithAi,
  summarizeRecipeAgreement as summarizeAgreementWithAi,
} from './ai-provider';
import { notifyCanonItemsDeleted as notifyCanonItemsDeletedInProvider } from './notifications-provider';
import {
  normalizeConversationTurns,
  normalizeGenerationContext,
  normalizeRepairOptions,
} from '../logic/ai-inputs';

/**
 * Temporary migration adapter for Phase B.
 *
 * This provider stabilises the new `modules/recipes` API while delegating to
 * the current Recipes backend implementation. Later phases will replace this
 * adapter with native `modules/recipes/data/*` providers.
 */

export async function fetchRecipes(): Promise<Recipe[]> {
  return fetchRecipesInCrud();
}

export async function fetchRecipeById(id: string): Promise<Recipe | null> {
  return fetchRecipeInCrud(id);
}

export async function createRecipeInStore(
  recipe: CreateRecipeInput,
  imageData?: string,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  return createRecipeInCrud(recipe, imageData, onProgress);
}

export async function updateRecipeInStore(
  id: string,
  updates: UpdateRecipeInput,
  imageData?: string,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  return updateRecipeInCrud(id, updates, imageData, onProgress);
}

export async function deleteRecipeFromStore(id: string): Promise<void> {
  return deleteRecipeInCrud(id);
}

export async function resolveRecipeImagePath(path: string): Promise<string> {
  return resolveImagePathInCrud(path);
}

export async function repairStoredRecipe(
  recipeId: string,
  options: RepairRecipeOptions,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  void onProgress;
  return repairRecipeInCrud(recipeId, normalizeRepairOptions(options));
}

export async function notifyCanonItemsDeleted(ids: string[]): Promise<void> {
  return notifyCanonItemsDeletedInProvider(ids);
}

export async function generateRecipeFromPromptDraft(
  prompt: string,
  context?: RecipeGenerationContext
): Promise<Partial<Recipe>> {
  const normalizedContext = normalizeGenerationContext(context);

  return generateFromPromptWithAi(
    prompt,
    normalizedContext
  );
}

export async function chatAboutRecipe(
  recipe: Recipe,
  message: string,
  history: RecipeConversationTurn[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  return chatAboutRecipeWithAi(
    recipe,
    message,
    normalizeConversationTurns(history),
    onChunk
  );
}

export async function summarizeRecipeAgreement(
  history: RecipeConversationTurn[],
  currentRecipe?: Recipe
): Promise<string> {
  return summarizeAgreementWithAi(normalizeConversationTurns(history), currentRecipe);
}

export async function chatForRecipeDraft(
  history: RecipeConversationTurn[]
): Promise<string> {
  return chatForDraftWithAi(normalizeConversationTurns(history));
}

export async function generateRecipeImageData(
  recipeTitle: string,
  description?: string
): Promise<string> {
  return generateImageWithAi(recipeTitle, description);
}

export async function importRecipeDraftFromUrl(
  url: string
): Promise<Partial<Recipe>> {
  return importFromUrlWithAi(url);
}
