
/**
 * !!! PROTECTION LOCK !!!
 * FILE: types/contract.ts
 * ROLE: The Law (Absolute Data Schema)
 * 
 * DO NOT MODIFY THIS FILE WITHOUT EXPLICIT USER CONSENT.
 * This file defines the Salt Manifest. Changing it breaks compatibility 
 * with existing backups and the AI synthesis engine.
 */

import { z } from 'zod';

// User Schema
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
});
export type User = z.infer<typeof UserSchema>;

// Global Kitchen Settings
export const KitchenSettingsSchema = z.object({
  directives: z.string(),
  userOrder: z.array(z.string()).optional(),
  debugEnabled: z.boolean().optional(),
});
export type KitchenSettings = z.infer<typeof KitchenSettingsSchema>;

// Equipment & Accessory Schemas
export const AccessorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  owned: z.boolean(),
  type: z.enum(['standard', 'optional']),
});
export type Accessory = z.infer<typeof AccessorySchema>;

export const EquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  modelName: z.string(),
  description: z.string(),
  type: z.string(),
  class: z.string(),
  accessories: z.array(AccessorySchema),
  status: z.enum(['Available', 'In Use', 'Maintenance']),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

// Recipe Category Schema
export const RecipeCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
  isApproved: z.boolean().default(true),
  confidence: z.number().min(0).max(1).optional(), // For AI-suggested categories
  recipeId: z.string().optional(), // Recipe that generated this suggestion (if AI-suggested)
  createdBy: z.string().optional(),
  createdAt: z.string(),
});
export type RecipeCategory = z.infer<typeof RecipeCategorySchema>;

// Shopping Domain Schemas

// Unit Schema (for shopping lists)
export const UnitSchema = z.object({
  id: z.string(),
  name: z.string(), // e.g., 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp'
  sortOrder: z.number().default(999),
  createdAt: z.string(),
});
export type Unit = z.infer<typeof UnitSchema>;

// Aisle Schema (for shopping lists and item database)
export const AisleSchema = z.object({
  id: z.string(),
  name: z.string(), // e.g., 'Produce', 'Dairy & Eggs', 'Household / Cleaning'
  sortOrder: z.number().default(999),
  createdAt: z.string(),
});
export type Aisle = z.infer<typeof AisleSchema>;

// CanonicalItem Schema (Universal Shopping Item Catalog)
// Items can be food ingredients OR household goods (toilet paper, cleaning supplies)
export const CanonicalItemSchema = z.object({
  id: z.string(),
  name: z.string(), // e.g., "Onion" (singular form preferred)
  normalisedName: z.string(), // Lowercase, for matching
  isStaple: z.boolean().default(false),
  aisle: z.string(), // Dynamic aisle name from Aisle table
  preferredUnit: z.string(), // Dynamic unit from Unit table
  synonyms: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  createdBy: z.string().optional(),
});
export type CanonicalItem = z.infer<typeof CanonicalItemSchema>;

// RecipeIngredient Schema (Recipe Context - Culinary Domain)
// Note: This represents an ingredient IN A RECIPE, which links to the universal item catalog
export const RecipeIngredientSchema = z.object({
  id: z.string(),
  raw: z.string(), // Original recipe text: "2 red onions, diced"
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  ingredientName: z.string(), // The ingredient name in cooking context
  preparation: z.string().optional(), // e.g., "diced", "chopped"
  canonicalItemId: z.string().optional(), // Links to CanonicalItem
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

// Shopping List Schema
export const ShoppingListSchema = z.object({
  id: z.string(),
  name: z.string(),
  recipeIds: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  createdBy: z.string().optional(),
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;

// Shopping List Item Schema
export const ShoppingListItemSchema = z.object({
  id: z.string(),
  shoppingListId: z.string(),
  canonicalItemId: z.string(), // Links to CanonicalItem
  name: z.string(), // Snapshot at creation time
  aisle: z.string(), // Snapshot at creation time
  quantity: z.number(),
  unit: z.string(),
  checked: z.boolean(),
  isStaple: z.boolean(),
  sourceRecipeIds: z.array(z.string()).optional(),
  sourceRecipeIngredientIds: z.array(z.string()).optional(),
  note: z.string().optional(),
});
export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;

// Recipe History Entry
export const RecipeHistoryEntrySchema = z.object({
  timestamp: z.string(),
  changeDescription: z.string(),
  snapshot: z.any(), // Snapshot of the recipe fields
  userName: z.string().optional(),
});
export type RecipeHistoryEntry = z.infer<typeof RecipeHistoryEntrySchema>;

// Recipe Schema
export const RecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ingredients: z.array(RecipeIngredientSchema), // Structured format
  legacyIngredients: z.array(z.string()).optional(), // For rollback compatibility
  instructions: z.array(z.string()),
  equipmentNeeded: z.array(z.string()),
  prepTime: z.string(),
  cookTime: z.string(),
  totalTime: z.string(),
  servings: z.string(),
  complexity: z.enum(['Simple', 'Intermediate', 'Advanced']),
  stepIngredients: z.array(z.array(z.number())).optional(),
  stepAlerts: z.array(z.array(z.number())).optional(),
  workflowAdvice: z.object({
    parallelTracks: z.array(z.string()).optional(),
    technicalWarnings: z.array(z.string()).optional(),
    optimumToolLogic: z.string().optional(),
  }).optional(),
  categoryIds: z.array(z.string()).optional(),
  history: z.array(RecipeHistoryEntrySchema).optional(),
  imagePath: z.string().optional(),
  collection: z.string().optional(),
  source: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

// Planner Schemas
export const DayPlanSchema = z.object({
  date: z.string(),
  cookId: z.string().nullable(),
  presentIds: z.array(z.string()),
  userNotes: z.record(z.string(), z.string()), // userId -> note
  mealNotes: z.string(),
});
export type DayPlan = z.infer<typeof DayPlanSchema>;

export const PlanSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  days: z.array(DayPlanSchema),
  createdAt: z.string(),
  createdBy: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

export interface EquipmentCandidate {
  brand: string;
  modelName: string;
  description: string;
  category: 'Complex Appliance' | 'Technical Cookware' | 'Standard Tool';
}

export interface ISaltBackend {
  login: (email: string) => Promise<void>;
  handleRedirectResult: () => Promise<User | null>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  getUsers: () => Promise<User[]>;
  createUser: (userData: Omit<User, 'id'>) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
  getRecipes: () => Promise<Recipe[]>;
  getRecipe: (id: string) => Promise<Recipe | null>;
  createRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>, imageData?: string) => Promise<Recipe>;
  updateRecipe: (id: string, updates: Partial<Recipe>, imageData?: string) => Promise<Recipe>;
  resolveImagePath: (path: string) => Promise<string>;
  deleteRecipe: (id: string) => Promise<void>;
  getInventory: () => Promise<Equipment[]>;
  getEquipment(id: string): Promise<Equipment | null>;
  createEquipment: (equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>) => Promise<Equipment>;
  updateEquipment: (id: string, equipment: Partial<Equipment>) => Promise<Equipment>;
  deleteEquipment: (id: string) => Promise<void>;
  getKitchenSettings(): Promise<KitchenSettings>;
  updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings>;
  searchEquipmentCandidates: (query: string) => Promise<EquipmentCandidate[]>;
  generateEquipmentDetails: (candidate: EquipmentCandidate) => Promise<Partial<Equipment>>;
  validateAccessory: (equipmentName: string, accessoryName: string) => Promise<Omit<Accessory, 'id'>>;
  generateRecipeFromPrompt: (prompt: string, currentRecipe?: Recipe, history?: {role: string, text: string}[]) => Promise<Partial<Recipe>>;
  chatWithRecipe: (recipe: Recipe, message: string, history: {role: string, text: string}[], onChunk?: (chunk: string) => void) => Promise<string>;
  summarizeAgreedRecipe: (history: {role: string, text: string}[], currentRecipe?: Recipe) => Promise<string>;
  chatForDraft: (history: {role: string, text: string}[]) => Promise<string>;
  generateRecipeImage: (recipeTitle: string) => Promise<string>;
  importRecipeFromUrl: (url: string) => Promise<Partial<Recipe>>;
  importSystemState: (json: string) => Promise<void>;
  getPlans(): Promise<Plan[]>;
  getPlanByDate(date: string): Promise<Plan | null>;
  getPlanIncludingDate(date: string): Promise<Plan | null>;
  createOrUpdatePlan: (plan: Omit<Plan, 'id' | 'createdAt' | 'createdBy'> & { id?: string }) => Promise<Plan>;
  deletePlan: (id: string) => Promise<void>;
  getCategories: () => Promise<RecipeCategory[]>;
  getCategory: (id: string) => Promise<RecipeCategory | null>;
  createCategory: (category: Omit<RecipeCategory, 'id' | 'createdAt'>) => Promise<RecipeCategory>;
  updateCategory: (id: string, updates: Partial<RecipeCategory>) => Promise<RecipeCategory>;
  deleteCategory: (id: string) => Promise<void>;
  approveCategory: (id: string) => Promise<void>;
  getPendingCategories: () => Promise<RecipeCategory[]>;
  categorizeRecipe: (recipe: Recipe) => Promise<string[]>;
  
  // Shopping Items (Universal Catalog)
  getCanonicalItems: () => Promise<CanonicalItem[]>;
  getCanonicalItem: (id: string) => Promise<CanonicalItem | null>;
  createCanonicalItem: (item: Omit<CanonicalItem, 'id' | 'createdAt'>) => Promise<CanonicalItem>;
  updateCanonicalItem: (id: string, updates: Partial<CanonicalItem>) => Promise<CanonicalItem>;
  deleteCanonicalItem: (id: string) => Promise<void>;
  
  // Shopping Lists
  getShoppingLists: () => Promise<ShoppingList[]>;
  getShoppingList: (id: string) => Promise<ShoppingList | null>;
  getDefaultShoppingList: () => Promise<ShoppingList>;
  setDefaultShoppingList: (id: string) => Promise<void>;
  createShoppingList: (list: Omit<ShoppingList, 'id' | 'createdAt' | 'createdBy'>) => Promise<ShoppingList>;
  updateShoppingList: (id: string, updates: Partial<ShoppingList>) => Promise<ShoppingList>;
  deleteShoppingList: (id: string) => Promise<void>;
  addRecipeToShoppingList: (recipeId: string, shoppingListId: string) => Promise<void>;
  addManualItemToShoppingList: (shoppingListId: string, name: string, quantity: number, unit: string, aisle?: string) => Promise<ShoppingListItem>;
  getShoppingListItems: (shoppingListId: string) => Promise<ShoppingListItem[]>;
  createShoppingListItem: (item: Omit<ShoppingListItem, 'id'>) => Promise<ShoppingListItem>;
  updateShoppingListItem: (id: string, updates: Partial<ShoppingListItem>) => Promise<ShoppingListItem>;
  deleteShoppingListItem: (id: string) => Promise<void>;
  
  // Recipe Ingredient Processing
  processRecipeIngredients: (ingredients: string[] | RecipeIngredient[], recipeId: string) => Promise<RecipeIngredient[]>;
  generateShoppingList: (recipeIds: string[], name: string) => Promise<{ list: ShoppingList; items: ShoppingListItem[] }>;
  
  // Units & Aisles Management
  getUnits: () => Promise<Unit[]>;
  createUnit: (unit: Omit<Unit, 'id' | 'createdAt'>) => Promise<Unit>;
  updateUnit: (id: string, updates: Partial<Unit>) => Promise<Unit>;
  deleteUnit: (id: string) => Promise<void>;
  getAisles: () => Promise<Aisle[]>;
  createAisle: (aisle: Omit<Aisle, 'id' | 'createdAt'>) => Promise<Aisle>;
  updateAisle: (id: string, updates: Partial<Aisle>) => Promise<Aisle>;
  deleteAisle: (id: string) => Promise<void>;
}
