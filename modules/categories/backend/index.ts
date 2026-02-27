/**
 * Categories Backend - Public API
 * 
 * Exports singleton categoriesBackend based on environment configuration.
 */

import { ICategoriesBackend } from './categories-backend.interface';
import { FirebaseCategoriesBackend } from './firebase-categories-backend';

export type { ICategoriesBackend } from './categories-backend.interface';

/**
 * Create categories backend instance based on environment
 */
function createCategoriesBackend(): ICategoriesBackend {
  const mode = import.meta.env.VITE_BACKEND_MODE;
  
  if (mode === 'firebase' || !mode) {
    return new FirebaseCategoriesBackend();
  }
  
  // Simulation mode not implemented yet
  throw new Error(`Simulation backend not implemented. Use firebase mode.`);
}

// Singleton instance
export const categoriesBackend: ICategoriesBackend = createCategoriesBackend();
