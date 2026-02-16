/**
 * Recipes Backend - Public API
 * 
 * Provides singleton access to recipes backend.
 * This module is imported by the app for recipe management.
 */

import { FirebaseRecipesBackend } from './firebase-recipes-backend';
import { IRecipesBackend } from './recipes-backend.interface';

// Singleton instance
let backendInstance: IRecipesBackend;

/**
 * Get the recipes backend instance.
 */
export function getRecipesBackend(): IRecipesBackend {
  if (!backendInstance) {
    backendInstance = new FirebaseRecipesBackend();
  }
  return backendInstance;
}

// Export for convenience
export const recipesBackend = getRecipesBackend();

// Re-export types
export type { IRecipesBackend } from './recipes-backend.interface';
export { BaseRecipesBackend } from './base-recipes-backend';
export { FirebaseRecipesBackend } from './firebase-recipes-backend';
