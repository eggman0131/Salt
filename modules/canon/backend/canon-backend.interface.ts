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

  // ==================== INGREDIENT PROCESSING ====================

  processIngredients: (
    ingredients: string[] | RecipeIngredient[],
    contextId: string
  ) => Promise<RecipeIngredient[]>;
}
