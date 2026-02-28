
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
  avatarUrl: z.string().optional(),
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

// External Source Link Schema (for multi-source item tracking)
// Allows canonical items to link to multiple external databases
export const ExternalSourceLinkSchema = z.object({
  source: z.enum(['cofid', 'open-food-facts', 'usda', 'tesco', 'user']), // Extensible enum
  externalId: z.string(), // ID in the external system
  confidence: z.number().min(0).max(1).optional(), // Match confidence (0-1)
  
  // Extensible property storage for source-specific data
  // Each source can store completely different properties:
  // - CoFID: { nutrition: { energy_kcal: 100, protein_g: 5 }, food_group: "..." }
  // - Open Food Facts: { brands: "...", ingredients_text: "...", nutriscore_grade: "a" }
  // - USDA: { ndb_number: "...", nutrient_data: {...} }
  // - Tesco: { price: 2.50, currency: "GBP", sku: "...", availability: true }
  // - User: { notes: "...", custom_tags: [...] }
  properties: z.record(z.string(), z.unknown()).optional(),
  
  syncedAt: z.string().optional(), // ISO timestamp of last sync for this source
});
export type ExternalSourceLink = z.infer<typeof ExternalSourceLinkSchema>;

// CanonicalItem Schema (Universal Shopping Item Catalog)
// Items can be food ingredients OR household goods (toilet paper, cleaning supplies)
// Schema is extensible for future integrations (CoFID, Open Food Facts, barcode scanning)
// Supports linking to multiple external data sources simultaneously
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
  
  // External data source integration (all optional for backwards compatibility)
  externalSources: z.array(ExternalSourceLinkSchema).optional(), // Links to external databases (CoFID, Open Food Facts, etc.)
  barcodes: z.array(z.string()).optional(), // EAN-13, UPC, etc. for barcode scanning
  itemType: z.enum(['ingredient', 'product', 'household']).default('ingredient').optional(), // Item categorization
  lastSyncedAt: z.string().optional(), // Latest sync timestamp across all external sources
  
  // Semantic matching fields
  embedding: z.array(z.number()).optional(), // Vector embedding for semantic similarity search (text-embedding-005)
  embeddingModel: z.string().optional(), // Model used for embedding (e.g., "text-embedding-005")
  embeddedAt: z.string().optional(), // ISO timestamp when embedding was generated
  
  // Approval workflow (auto-created items from CoFID require human review)
  approved: z.boolean().default(true).optional(), // True for user-created, false for auto-created from external sources
});
export type CanonicalItem = z.infer<typeof CanonicalItemSchema>;

// CoFID Group to Aisle Mapping Schema
// Maps CoFID food groups (1-3 letter codes) to kitchen aisles for auto-created canonical items
export const CoFIDGroupAisleMappingSchema = z.object({
  id: z.string(),
  cofidGroup: z.string(), // CoFID group code (1-3 letters, e.g., "A", "B", "C")
  cofidGroupName: z.string(), // Full name of CoFID group (e.g., "Cereals and cereal products")
  aisle: z.string(), // Target aisle name from Aisle table
  createdAt: z.string(),
  createdBy: z.string().optional(),
});
export type CoFIDGroupAisleMapping = z.infer<typeof CoFIDGroupAisleMappingSchema>;

// Ingredient Matching Configuration Schema
// Admin-editable thresholds for the multi-stage ingredient identity resolution pipeline
export const IngredientMatchingConfigSchema = z.object({
  // Stage 1: Fuzzy matching threshold (fast pass)
  fuzzyHighConfidenceThreshold: z.number().min(0).max(1).default(0.85),
  
  // Stage 2: Semantic matching thresholds
  semanticHighThreshold: z.number().min(0).max(1).default(0.90), // Confident match, accept immediately
  semanticLowThreshold: z.number().min(0).max(1).default(0.70),  // Weak match, requires LLM
  semanticGapThreshold: z.number().min(0).max(1).default(0.10),  // Min gap between top 2 for confident match
  semanticClusterWindow: z.number().min(0).max(1).default(0.05), // Max score difference within cluster
  semanticCandidateCount: z.number().min(1).max(20).default(5),  // How many top candidates to consider
  
  // Stage 3: LLM arbitration settings
  llmBiasForExistingCanon: z.number().min(0).max(1).default(0.05), // Slight preference for existing Canon items
  allowNewCanonItems: z.boolean().default(true), // Allow creation of new Canon items
});
export type IngredientMatchingConfig = z.infer<typeof IngredientMatchingConfigSchema>;

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
  matchingAudit: z.object({
    stage: z.enum(['fuzzy', 'semantic', 'arbitration']).optional(),
    decisionAction: z.enum(['use_existing_canon', 'create_from_cofid', 'create_new_canon', 'no_match']).optional(),
    decisionSource: z.enum(['rule', 'llm', 'fallback']).optional(),
    candidateId: z.string().optional(),
    matchedSource: z.enum(['canon', 'cofid', 'new-canon', 'unlinked']).optional(),
    topScore: z.number().optional(),
    scoreGap: z.number().optional(),
    reason: z.string().optional(),
    recordedAt: z.string().optional(),
  }).optional(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

// Recipe Instruction Schema with persistent ID (Issue #57: Anchor-based mapping)
// Simplified design: embeds ingredients and warnings directly per step
export const RecipeInstructionSchema = z.object({
  id: z.string(), // Persistent ID: survives step reordering/deletion
  text: z.string(), // The instruction text
  ingredients: z.array(RecipeIngredientSchema), // Ingredients used in this step (always array, maybe empty)
  technicalWarnings: z.array(z.string()), // Warnings that apply to this step (always array, maybe empty)
});
export type RecipeInstruction = z.infer<typeof RecipeInstructionSchema>;

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
  instructions: z.array(RecipeInstructionSchema), // Self-contained with embedded ingredients/warnings
  equipmentNeeded: z.array(z.string()),
  prepTime: z.string(),
  cookTime: z.string(),
  totalTime: z.string(),
  servings: z.string(),
  complexity: z.enum(['Simple', 'Intermediate', 'Advanced']),
  workflowAdvice: z.object({
    parallelTracks: z.array(z.string()).optional(),
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

/**
 * Collection Registry
 * 
 * Defines all Firestore collections that constitute "kitchen state".
 * Used by backup/restore system to dynamically discover all data.
 * 
 * When adding a new feature with Firestore persistence:
 * 1. Add collection to this registry
 * 2. Backup/restore will automatically include it
 */
export const COLLECTION_REGISTRY = {
  // Foundational collections - imported first (no dependencies)
  categories: { 
    schema: RecipeCategorySchema,
    requiresEncoding: false,
    idField: 'id'
  },
  units: { 
    schema: UnitSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  aisles: { 
    schema: AisleSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  cofid_group_aisle_mappings: {
    schema: CoFIDGroupAisleMappingSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  ingredient_matching_config: {
    schema: IngredientMatchingConfigSchema,
    requiresEncoding: false,
    isSingleton: true, // Only one document: 'global'
    documentId: 'global'
  },
  canonical_items: { 
    schema: CanonicalItemSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  inventory: { 
    schema: EquipmentSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  users: { 
    schema: UserSchema,
    requiresEncoding: false,
    idField: 'email' // Users use email as document ID, not 'id'
  },
  settings: {
    schema: KitchenSettingsSchema,
    requiresEncoding: false,
    isSingleton: true, // Only one document: 'global'
    documentId: 'global'
  },
  
  // Shopping collections (depends on canonical_items)
  shopping_lists: { 
    schema: ShoppingListSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  shopping_list_items: { 
    schema: ShoppingListItemSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  
  // Core domain collections (recipes depend on categories)
  recipes: { 
    schema: RecipeSchema, 
    requiresEncoding: true, // Recipes need special encoding for Firestore
    idField: 'id'
  },
  plans: { 
    schema: PlanSchema,
    requiresEncoding: false,
    idField: 'id'
  },
  
  // Cook mode collections (depends on recipes)
  cookGuides: {
    schema: z.any(), // CookGuide schema lives in assist-mode module
    requiresEncoding: false,
    idField: 'id'
  },
} as const;

export type CollectionName = keyof typeof COLLECTION_REGISTRY;

