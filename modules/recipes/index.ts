/**
 * Recipes Module - Public API
 * 
 * Provides access to recipes backend and components.
 * The main recipes interface for the application.
 */

// Re-export backend
export { recipesBackend, getRecipesBackend } from './backend';
export type { IRecipesBackend } from './backend';

// Re-export main components
export { RecipesModule } from './components/RecipesModule';
export { RecipeDetail } from './components/RecipeDetail';
export { RecipesList } from './components/RecipesList';
