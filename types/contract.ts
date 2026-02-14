
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
  ingredients: z.array(z.string()),
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

// Ingredient Knowledgebase Schema
export const IngredientKnowledgebaseSchema = z.object({
  id: z.string(),
  ingredientName: z.string(), // Canonical name
  aliases: z.array(z.string()), // Variations
  aisleName: z.string(), // FREE TEXT — prefers existing values, allows new ones
  unitType: z.string(), // FREE TEXT — prefers existing values, allows new ones
  isStoreCupboard: z.boolean().default(false),
  confidenceScore: z.number().min(0).max(1),
  aiSuggested: z.boolean().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IngredientKnowledgebase = z.infer<typeof IngredientKnowledgebaseSchema>;

// Shopping List Item Schema
export const ShoppingListItemSchema = z.object({
  id: z.string(),
  ingredientName: z.string(),
  quantity: z.number(),
  unit: z.string(), // FREE TEXT
  aisleName: z.string(), // FREE TEXT
  isCheckedOff: z.boolean().default(false),
  recipeIds: z.array(z.string()).optional(),
  isStoreCupboard: z.boolean().default(false),
  notes: z.string().optional(),
  addedAt: z.string(),
});
export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;

// Shopping List Schema (supports multiple lists)
export const ShoppingListSchema = z.object({
  id: z.string(), // Unique per list
  userId: z.string(),
  name: z.string(), // e.g., "Tesco", "Farmers Market", "Default"
  items: z.array(ShoppingListItemSchema),
  isDefault: z.boolean().default(false), // One list per user is default
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;

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
  // Ingredient Knowledgebase
  getIngredientKnowledgebase(): Promise<IngredientKnowledgebase[]>;
  getIngredientByName(name: string): Promise<IngredientKnowledgebase | null>;
  classifyIngredient(ingredientName: string): Promise<IngredientKnowledgebase>;
  updateIngredientMapping(id: string, updates: Partial<IngredientKnowledgebase>): Promise<IngredientKnowledgebase>;
  getUniqueAisleNames(): Promise<string[]>;
  getUniqueUnitTypes(): Promise<string[]>;
  // Shopping Lists (multiple lists support)
  getShoppingLists(): Promise<ShoppingList[]>;
  getShoppingList(listId: string): Promise<ShoppingList | null>;
  getDefaultShoppingList(): Promise<ShoppingList | null>;
  createShoppingList(name: string): Promise<ShoppingList>;
  updateShoppingListName(listId: string, newName: string): Promise<ShoppingList>;
  deleteShoppingList(listId: string): Promise<void>;
  setDefaultShoppingList(listId: string): Promise<void>;
  addShoppingListItem(listId: string, item: Omit<ShoppingListItem, 'id' | 'addedAt'>): Promise<ShoppingListItem>;
  toggleShoppingListItem(listId: string, itemId: string, checked: boolean): Promise<void>;
  removeShoppingListItem(listId: string, itemId: string): Promise<void>;
  addRecipeToShoppingList(recipeId: string, listId?: string): Promise<void>;
  clearCheckedItems(listId: string): Promise<void>;
}
