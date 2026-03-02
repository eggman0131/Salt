/**
 * Recipes Backend Interface
 * 
 * Handles all recipe domain operations:
 * - Recipe CRUD (create, read, update, delete)
 * - AI-powered recipe generation from prompts
 * - AI recipe chat and iteration
 * - Recipe image generation
 * - Recipe import from URLs
 */

import { Recipe } from '../../../types/contract';

export interface RecipeSaveProgress {
  stage: string;
  current?: number;
  total?: number;
  percentage?: number;
}

export interface IRecipesBackend {
  // ==================== RECIPE CRUD ====================
  
  getRecipes: () => Promise<Recipe[]>;
  getRecipe: (id: string) => Promise<Recipe | null>;
  createRecipe: (
    recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>,
    imageData?: string,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => Promise<Recipe>;
  updateRecipe: (
    id: string,
    updates: Partial<Recipe>,
    imageData?: string,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => Promise<Recipe>;
  resolveImagePath: (path: string) => Promise<string>;
  deleteRecipe: (id: string) => Promise<void>;

  // ==================== NOTIFICATION HOOKS ====================

  onCanonItemsDeleted: (ids: string[]) => Promise<void>;
  
  // Repair recipe (re-categorize and/or relink ingredients)
  repairRecipe: (
    recipeId: string,
    options: { categorize?: boolean; relinkIngredients?: boolean }
  ) => Promise<Recipe>;
  
  // ==================== AI-POWERED FEATURES ====================
  
  // Generate recipe from natural language prompt
  generateRecipeFromPrompt: (
    prompt: string,
    currentRecipe?: Recipe,
    history?: { role: string; text: string }[]
  ) => Promise<Partial<Recipe>>;
  
  // Chat with AI about a recipe (iterative refinement)
  chatWithRecipe: (
    recipe: Recipe,
    message: string,
    history: { role: string; text: string }[],
    onChunk?: (chunk: string) => void
  ) => Promise<string>;
  
  // Summarize agreed-upon recipe from chat history
  summarizeAgreedRecipe: (
    history: { role: string; text: string }[],
    currentRecipe?: Recipe
  ) => Promise<string>;
  
  // Chat for draft recipes (pre-creation)
  chatForDraft: (history: { role: string; text: string }[]) => Promise<string>;
  
  // Generate recipe image from title and description
  generateRecipeImage: (
    recipeTitle: string,
    description?: string
  ) => Promise<string>;
  
  // Import recipe from external URL (MyFitnessPal, etc.)
  importRecipeFromUrl: (url: string) => Promise<Partial<Recipe>>;
}
