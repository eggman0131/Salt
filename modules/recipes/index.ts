/**
 * Recipes Module - Public Exports
 *
 * Phase B exposes a stable API contract for all recipe workflows.
 */

export {
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
  recipesApi,
} from './api';

export type {
  CreateRecipeInput,
  RecipeConversationTurn,
  RecipeGenerationContext,
  RecipeSaveProgress,
  RepairRecipeOptions,
  UpdateRecipeInput,
} from './api';

export { AIModule } from './ui/AIModule';
export { RecipesModule } from './ui/RecipesModule';
