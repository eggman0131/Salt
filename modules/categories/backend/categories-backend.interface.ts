/**
 * Categories Backend Interface
 * 
 * Manages recipe categorization including:
 * - Category CRUD operations
 * - Pending category approval workflow
 * - AI-powered recipe categorization
 */

import { RecipeCategory, Recipe } from '../../../types/contract';

export interface ICategoriesBackend {
  // ==================== CATEGORY CRUD ====================
  
  getCategories: () => Promise<RecipeCategory[]>;
  getCategory: (id: string) => Promise<RecipeCategory | null>;
  createCategory: (category: Omit<RecipeCategory, 'id' | 'createdAt'>) => Promise<RecipeCategory>;
  updateCategory: (id: string, updates: Partial<RecipeCategory>) => Promise<RecipeCategory>;
  deleteCategory: (id: string) => Promise<void>;
  
  // ==================== APPROVAL WORKFLOW ====================
  
  approveCategory: (id: string) => Promise<void>;
  getPendingCategories: () => Promise<RecipeCategory[]>;
  
  // ==================== AI-POWERED CATEGORIZATION ====================
  
  /**
   * Analyze a recipe and suggest appropriate categories
   * Uses AI to analyze title, description, and ingredients
   */
  categorizeRecipe: (recipe: Recipe) => Promise<string[]>;
}
