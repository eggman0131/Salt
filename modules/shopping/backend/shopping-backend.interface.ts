/**
 * Shopping Backend Interface
 * 
 * Handles all shopping domain operations:
 * - Shopping Lists (create, read, update, delete)
 * - Shopping List Items (CRUD, check/uncheck)
 * - AI-powered shopping list generation from recipes
 * 
 * Note: Units, Aisles, and Canonical Items are managed by kitchen-data module.
 */

import {
  ShoppingList,
  ShoppingListItem,
  RecipeIngredient,
} from '../../../types/contract';

export interface IShoppingBackend {
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

  // ==================== NOTIFICATION HOOKS ====================

  onCanonItemsDeleted: (ids: string[]) => Promise<void>;
  
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
}
