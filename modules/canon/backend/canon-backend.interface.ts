/**
 * Canon Backend Interface
 *
 * Handles all item-domain operations:
 * - Units (measurement units like g, kg, ml)
 * - Aisles (shop organisation sections)
 * - Canonical Items (universal item catalogue)
 * - Ingredient processing (AI-powered resolution)
 */

import {
  Unit,
  Aisle,
  CanonicalItem,
  RecipeIngredient,
} from '../../../types/contract';

export interface ICanonBackend {
  // ==================== UNITS ====================

  getUnits: () => Promise<Unit[]>;
  createUnit: (unit: Omit<Unit, 'id' | 'createdAt'>) => Promise<Unit>;
  updateUnit: (id: string, updates: Partial<Unit>) => Promise<Unit>;
  deleteUnit: (id: string) => Promise<void>;

  // ==================== AISLES ====================

  getAisles: () => Promise<Aisle[]>;
  createAisle: (aisle: Omit<Aisle, 'id' | 'createdAt'>) => Promise<Aisle>;
  updateAisle: (id: string, updates: Partial<Aisle>) => Promise<Aisle>;
  deleteAisle: (id: string) => Promise<void>;

  // ==================== CANONICAL ITEMS ====================

  getCanonicalItems: () => Promise<CanonicalItem[]>;
  getCanonicalItem: (id: string) => Promise<CanonicalItem | null>;
  createCanonicalItem: (item: Omit<CanonicalItem, 'id' | 'createdAt'>) => Promise<CanonicalItem>;
  updateCanonicalItem: (id: string, updates: Partial<CanonicalItem>) => Promise<CanonicalItem>;
  deleteCanonicalItem: (id: string) => Promise<void>;
  deleteCanonicalItems: (ids: string[]) => Promise<void>;

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
    recipesWithUnlinkedItems: Array<{ id: string; title: string; unlinkedCount: number }>;
  }>;

  // AI-powered: Enrich item name with proper capitalization, aisle, and unit
  enrichCanonicalItem: (rawName: string) => Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }>;

  // ==================== INGREDIENT PROCESSING ====================

  processIngredients: (
    ingredients: string[] | RecipeIngredient[],
    contextId: string
  ) => Promise<RecipeIngredient[]>;

  // ==================== COFID DATA IMPORT ====================

  importCoFIDData: (data: any[]) => Promise<{
    itemsImported: number;
    errors: string[];
  }>;
}
