/**
 * Kitchen Data Backend Interface
 * 
 * Handles all foundational kitchen data:
 * - Units (measurement units like g, kg, ml, etc.)
 * - Aisles (store organization sections)
 * - Canonical Items (universal item catalog for food + household)
 * - Categories (recipe categorization and AI suggestions)
 * 
 * This is the SOURCE OF TRUTH for foundational kitchen data.
 * Other modules (shopping, recipes) import from here READ-ONLY.
 */

import {
  Unit,
  Aisle,
  CanonicalItem,
  RecipeCategory,
  Recipe,
} from '../../../types/contract';

export interface IKitchenDataBackend {
  // ==================== UNITS ====================
  // Measurement units (g, kg, ml, l, items, etc.)
  
  getUnits: () => Promise<Unit[]>;
  createUnit: (unit: Omit<Unit, 'id' | 'createdAt'>) => Promise<Unit>;
  updateUnit: (id: string, updates: Partial<Unit>) => Promise<Unit>;
  deleteUnit: (id: string) => Promise<void>;
  
  // ==================== AISLES ====================
  // Store organization sections (Produce, Dairy, Bakery, etc.)
  
  getAisles: () => Promise<Aisle[]>;
  createAisle: (aisle: Omit<Aisle, 'id' | 'createdAt'>) => Promise<Aisle>;
  updateAisle: (id: string, updates: Partial<Aisle>) => Promise<Aisle>;
  deleteAisle: (id: string) => Promise<void>;
  
  // ==================== CANONICAL ITEMS ====================
  // Universal item catalog (food ingredients + household goods)
  // Master catalog that shopping lists and recipes reference
  
  getCanonicalItems: () => Promise<CanonicalItem[]>;
  getCanonicalItem: (id: string) => Promise<CanonicalItem | null>;
  createCanonicalItem: (item: Omit<CanonicalItem, 'id' | 'createdAt'>) => Promise<CanonicalItem>;
  updateCanonicalItem: (id: string, updates: Partial<CanonicalItem>) => Promise<CanonicalItem>;
  deleteCanonicalItem: (id: string) => Promise<void>;
  deleteCanonicalItems: (ids: string[]) => Promise<void>; // Bulk delete to avoid race conditions

  // Impact assessment and healing
  assessItemDeletion: (ids: string[]) => Promise<{
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }>;
  healRecipeReferences: (ids: string[], assessment: {
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }) => Promise<{
    recipesFixed: number;
    ingredientsProcessed: number;
    ingredientsRematched: number;
    ingredientsUnmatched: number;
    newCanonicalItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }>;

  }>;

  // AI-powered: Enrich item name with proper capitalization, aisle, and unit
  enrichCanonicalItem: (rawName: string) => Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }>;
  
  // ==================== CATEGORIES ====================
  // Recipe categorization (Breakfast, Dinner, Vegetarian, etc.)
  
  getCategories: () => Promise<RecipeCategory[]>;
  getCategory: (id: string) => Promise<RecipeCategory | null>;
  createCategory: (category: Omit<RecipeCategory, 'id' | 'createdAt'>) => Promise<RecipeCategory>;
  updateCategory: (id: string, updates: Partial<RecipeCategory>) => Promise<RecipeCategory>;
  deleteCategory: (id: string) => Promise<void>;
  approveCategory: (id: string) => Promise<void>;
  getPendingCategories: () => Promise<RecipeCategory[]>;
  
  // AI-powered: Suggest categories for a recipe
  categorizeRecipe: (recipe: Recipe) => Promise<string[]>;
}
