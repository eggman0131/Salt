/**
 * Cook Mode Backend Interface
 * 
 * Handles all cook mode operations:
 * - Generate autism-friendly cooking guides from recipes
 * - Retrieve existing guides
 * - Manage guide lifecycle (create, update, delete)
 */

import { Recipe } from '../../../types/contract';
import { CookGuide } from '../types';

export interface ICookModeBackend {
  /**
   * Get or generate a cook guide for a recipe.
   * If a guide exists and recipe hasn't changed, returns cached version.
   * Otherwise, generates a new guide with sensory cues and prep grouping.
   */
  getOrGenerateCookGuide: (recipe: Recipe) => Promise<CookGuide>;

  /**
   * Force regenerate a cook guide (even if one exists).
   * Useful if prompts have been updated or user requests refresh.
   */
  generateCookGuide: (recipe: Recipe) => Promise<CookGuide>;

  /**
   * Retrieve an existing cook guide by ID.
   */
  getCookGuide: (guideId: string) => Promise<CookGuide | null>;

  /**
   * Delete a cook guide.
   */
  deleteCookGuide: (guideId: string) => Promise<void>;

  /**
   * Get all cook guides for a recipe.
   * (Useful for version history or debugging)
   */
  getCookGuidesForRecipe: (recipeId: string) => Promise<CookGuide[]>;
}
