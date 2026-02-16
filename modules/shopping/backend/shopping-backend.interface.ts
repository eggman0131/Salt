/**
 * Shopping Backend Interface
 * 
 * Handles all shopping domain operations:
 * - Shopping Lists (create, read, update, delete)
 * - Shopping List Items (CRUD, check/uncheck)
 * - Canonical Items (universal item catalog)
 * - Units & Aisles (kitchen data foundation)
 * - AI-powered shopping list generation from recipes
 */

import {
  ShoppingList,
  ShoppingListItem,
  CanonicalItem,
  Unit,
  Aisle,
  RecipeIngredient,
} from '../../../types/contract';

export interface IShoppingBackend {
  // ==================== CANONICAL ITEMS ====================
  // Universal item catalog (food + household goods)
  
  getCanonicalItems: () => Promise<CanonicalItem[]>;
  getCanonicalItem: (id: string) => Promise<CanonicalItem | null>;
  createCanonicalItem: (item: Omit<CanonicalItem, 'id' | 'createdAt'>) => Promise<CanonicalItem>;
  updateCanonicalItem: (id: string, updates: Partial<CanonicalItem>) => Promise<CanonicalItem>;
  deleteCanonicalItem: (id: string) => Promise<void>;
  
  // ==================== SHOPPING LISTS ====================
  
  getShoppingLists: () => Promise<ShoppingList[]>;
  getShoppingList: (id: string) => Promise<ShoppingList | null>;
  getDefaultShoppingList: () => Promise<ShoppingList>;
  setDefaultShoppingList: (id: string) => Promise<void>;
  createShoppingList: (list: Omit<ShoppingList, 'id' | 'createdAt' | 'createdBy'>) => Promise<ShoppingList>;
  updateShoppingList: (id: string, updates: Partial<ShoppingList>) => Promise<ShoppingList>;
  deleteShoppingList: (id: string) => Promise<void>;
  
  // ==================== SHOPPING LIST ITEMS ====================
  
  getShoppingListItems: (shoppingListId: string) => Promise<ShoppingListItem[]>;
  createShoppingListItem: (item: Omit<ShoppingListItem, 'id'>) => Promise<ShoppingListItem>;
  updateShoppingListItem: (id: string, updates: Partial<ShoppingListItem>) => Promise<ShoppingListItem>;
  deleteShoppingListItem: (id: string) => Promise<void>;
  
  // ==================== RECIPE INTEGRATION ====================
  
  addRecipeToShoppingList: (recipeId: string, shoppingListId: string) => Promise<void>;
  addManualItemToShoppingList: (
    shoppingListId: string,
    name: string,
    quantity: number,
    unit: string,
    aisle?: string
  ) => Promise<ShoppingListItem>;
  
  // AI-powered: Convert recipe titles → full shopping list with items
  generateShoppingList: (
    recipeIds: string[],
    name: string
  ) => Promise<{ list: ShoppingList; items: ShoppingListItem[] }>;
  
  // AI-powered: Parse raw ingredient strings → structured RecipeIngredient[]
  processRecipeIngredients: (
    ingredients: string[] | RecipeIngredient[],
    recipeId: string
  ) => Promise<RecipeIngredient[]>;
  
  // ==================== UNITS & AISLES ====================
  // Kitchen data foundation (read-only from shopping module perspective)
  
  getUnits: () => Promise<Unit[]>;
  createUnit: (unit: Omit<Unit, 'id' | 'createdAt'>) => Promise<Unit>;
  updateUnit: (id: string, updates: Partial<Unit>) => Promise<Unit>;
  deleteUnit: (id: string) => Promise<void>;
  
  getAisles: () => Promise<Aisle[]>;
  createAisle: (aisle: Omit<Aisle, 'id' | 'createdAt'>) => Promise<Aisle>;
  updateAisle: (id: string, updates: Partial<Aisle>) => Promise<Aisle>;
  deleteAisle: (id: string) => Promise<void>;
}
