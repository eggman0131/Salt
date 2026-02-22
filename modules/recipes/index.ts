/**
 * Recipes Module - Public API
 * 
 * Provides access to recipes backend and components.
 * The main recipes interface for the application.
 */

// Re-export backend
export { recipesBackend, getRecipesBackend } from './backend';
export type { IRecipesBackend } from './backend';

// Re-export main component (simplified version)
export { RecipesModule } from './components/RecipesModule';
