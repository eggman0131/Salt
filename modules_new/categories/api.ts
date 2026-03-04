/**
 * Categories Module Public API
 * 
 * Pure, synchronous contract exposed to the rest of the application.
 * Orchestrates between logic (categorization.ts) and persistence (data/).
 */

import { Recipe, RecipeCategory } from '../../types/contract';
import {
  buildCategorizationPrompt,
  parseAICategoryResponse,
  validateCategoryNameUniqueness
} from './logic/categorization';
import {
  getAllCategories,
  getCategoryById,
  createCategory as createCategoryInDb,
  updateCategory as updateCategoryInDb,
  deleteCategory as deleteCategoryFromDb,
  getPendingCategories as getPendingCategoriesFromDb,
  approveCategoryInFirestore
} from './data/firebase-provider';
import { callGeminForCategorization } from './data/ai-provider';

// ==================== CATEGORY CRUD ====================

/**
 * Get all categories
 */
export async function getCategories(): Promise<RecipeCategory[]> {
  return getAllCategories();
}

/**
 * Get a specific category by ID
 */
export async function getCategory(id: string): Promise<RecipeCategory | null> {
  return getCategoryById(id);
}

/**
 * Create a new category
 * Validates name uniqueness before creating
 */
export async function createCategory(
  category: Omit<RecipeCategory, 'id' | 'createdAt'>
): Promise<RecipeCategory> {
  // Validate name uniqueness
  const existingCategories = await getAllCategories();
  const validation = validateCategoryNameUniqueness(category.name, existingCategories);

  if (!validation.valid) {
    throw new Error(
      `Category name "${category.name}" conflicts with existing category (ID: ${validation.conflictingId})`
    );
  }

  // Create in database
  return createCategoryInDb(category);
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  updates: Partial<RecipeCategory>
): Promise<RecipeCategory> {
  // If name is being updated, validate uniqueness
  if (updates.name) {
    const existingCategories = await getAllCategories();
    const validation = validateCategoryNameUniqueness(updates.name, existingCategories);

    if (!validation.valid && validation.conflictingId !== id) {
      throw new Error(
        `Category name "${updates.name}" conflicts with existing category (ID: ${validation.conflictingId})`
      );
    }
  }

  return updateCategoryInDb(id, updates);
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<void> {
  return deleteCategoryFromDb(id);
}

// ==================== APPROVAL WORKFLOW ====================

/**
 * Get all pending (unapproved) categories
 */
export async function getPendingCategories(): Promise<RecipeCategory[]> {
  return getPendingCategoriesFromDb();
}

/**
 * Approve a pending category
 */
export async function approveCategory(id: string): Promise<void> {
  return approveCategoryInFirestore(id);
}

// ==================== AI-POWERED CATEGORIZATION ====================

/**
 * Analyse a recipe and suggest appropriate categories
 * 
 * Uses AI to analyse title, description, and ingredients.
 * Returns array of category IDs.
 */
export async function categorizeRecipe(recipe: Recipe): Promise<string[]> {
  // Get existing categories for context
  const existingCategories = await getAllCategories();

  // Build prompt using pure logic
  const prompt = buildCategorizationPrompt(recipe, existingCategories);

  // Call Gemini via Cloud Function (I/O)
  const categoryIds = await callGeminForCategorization(prompt);

  // Parse and validate response using pure logic
  const validatedCategoryIds = parseAICategoryResponse(JSON.stringify(categoryIds));

  return validatedCategoryIds;
}

// ==================== EXPORTS FOR MODULE ====================

export const categoriesApi = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getPendingCategories,
  approveCategory,
  categorizeRecipe,
};
