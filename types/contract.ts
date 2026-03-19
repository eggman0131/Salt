
/**
 * !!! PROTECTION LOCK !!!
 * FILE: types/contract.ts
 * ROLE: The Law (Absolute Data Schema)
 * 
 * DO NOT MODIFY THIS FILE WITHOUT EXPLICIT USER CONSENT.
 * This file defines the Salt Manifest. Changing it breaks compatibility
 * with persisted Firestore data and the AI synthesis engine.
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
  plural: z.string().nullable().default(null), // e.g., 'cloves' for 'clove'. null if no plural
  category: z.enum(['weight', 'volume', 'count', 'colloquial']),
  sortOrder: z.number().default(999),
  createdAt: z.string().optional(),
});
export type Unit = z.infer<typeof UnitSchema>;

// Aisle Schema (for shopping lists and item database)
// Three-tier hierarchy: tier3 (top) > tier2 (middle) > tier1/name (specific aisle)
export const AisleSchema = z.object({
  id: z.string(),
  name: z.string(), // tier1: most specific level, e.g. 'fresh vegetables', 'cheese'
  tier2: z.string(), // middle grouping, e.g. 'fresh', 'chilled dairy'
  tier3: z.string(), // top-level category, e.g. 'food', 'drink', 'household'
  sortOrder: z.number().default(999),
  createdAt: z.string(),
});
export type Aisle = z.infer<typeof AisleSchema>;

// External Source Link Schema (for multi-source item tracking)
// Allows canonical items to link to multiple external databases
export const ExternalSourceLinkSchema = z.object({
  source: z.string(), // Extensible source key (e.g., cofid, open-food-facts)
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

// CanonicalItem Schema v3 (Universal Shopping Item Catalog)
// Each distinct purchasable product in a UK supermarket is its own canonical item.
// Supports multi-source enrichment (CoFID, Open Food Facts, retailer APIs, barcodes).
// canonUnits = parse vocabulary (AI prompt guidance); item.unit = conversion intelligence.

// ── Sub-schemas ───────────────────────────────────────────────────────────────

// Denormalised aisle snapshot embedded on each item.
// aisleId is the FK to canonAisles; this snapshot enables fast reads without joins.
export const AisleSnapshotSchema = z.object({
  tier3: z.string(), // top-level domain: "food", "drink", "household"
  tier2: z.string(), // department: "fresh", "chilled dairy", "cleaning"
  tier1: z.string(), // aisle: "fresh vegetables", "cheese", "laundry detergent"
});
export type AisleSnapshot = z.infer<typeof AisleSnapshotSchema>;

// Per-ingredient unit & conversion intelligence.
// Defines how this ingredient behaves in recipes and how quantities aggregate internally.
export const UnitIntelligenceSchema = z.object({
  canonical_unit: z.enum(['g', 'ml', 'each']),
  density_g_per_ml: z.number().nullable().default(null), // e.g. olive oil → 0.91, honey → 1.42
  // Maps any unit name or size qualifier to grams (or ml for volume-canonical items).
  // Keys are canon unit IDs (e.g. 'tbsp', 'clove', 'rasher') or size descriptors
  // ('small', 'medium', 'large', 'default'). Populated by FDC enrichment and manual entry.
  unit_weights: z.record(z.string(), z.number()).optional(),
});
export type UnitIntelligence = z.infer<typeof UnitIntelligenceSchema>;

// A purchasable pack size (e.g. "1kg bag", "4-pack").
export const PackSizeSchema = z.object({
  unit: z.enum(['g', 'ml', 'each']),
  size: z.number(),
  description: z.string(), // e.g. "1kg bag", "4-pack", "bunch"
});
export type PackSize = z.infer<typeof PackSizeSchema>;

// Shopping intelligence: how the item is purchased in a UK supermarket.
export const ShoppingIntelligenceSchema = z.object({
  shopping_unit: z.enum(['g', 'ml', 'each']),
  pack_sizes: z.array(PackSizeSchema).default([]),
  loose: z.boolean().default(false), // true = can buy individually (e.g. loose carrots)
});
export type ShoppingIntelligence = z.infer<typeof ShoppingIntelligenceSchema>;

// Freeform item metadata (notes, AI confidence scores).
export const ItemMetadataSchema = z.object({
  notes: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(), // 0-1 confidence for AI-generated entries
});
export type ItemMetadata = z.infer<typeof ItemMetadataSchema>;

// ── Main Schema ───────────────────────────────────────────────────────────────

export const CanonicalItemSchema = z.object({
  // ── Identity & matching ─────────────────────────────────────────────────────
  id: z.string(),
  name: z.string().min(1),                   // singular form, e.g. "Carrot"
  normalisedName: z.string(),                // lowercase, punctuation-stripped, for matching
  synonyms: z.array(z.string()).default([]), // alternative recipe names/spellings

  // ── Aisle (FK + denorm snapshot) ────────────────────────────────────────────
  // aisleId is the authoritative reference. aisle is a snapshot for fast reads.
  // When an aisle is renamed, syncAisleSnapshots() propagates the change to all items.
  aisleId: z.string(),
  aisle: AisleSnapshotSchema,

  // ── Unit & conversion intelligence ──────────────────────────────────────────
  unit: UnitIntelligenceSchema,

  // ── Shopping intelligence ───────────────────────────────────────────────────
  shopping: ShoppingIntelligenceSchema.optional(),

  // ── Classification ──────────────────────────────────────────────────────────
  isStaple: z.boolean().default(false),
  itemType: z.enum(['ingredient', 'product', 'household']).default('ingredient'),
  allergens: z.array(z.string()).default([]), // e.g. ["gluten", "nuts", "dairy"]

  // ── External integrations ───────────────────────────────────────────────────
  barcodes: z.array(z.string()).default([]),               // EAN-13, UPC, etc.
  externalSources: z.array(ExternalSourceLinkSchema).default([]), // CoFID, OFF, GS1, etc.

  // ── Freeform metadata ───────────────────────────────────────────────────────
  metadata: ItemMetadataSchema.optional(),

  // ── Embeddings (optional — can be externalised to canonEmbeddingLookup) ─────
  embedding: z.array(z.number()).optional(),
  embeddingModel: z.string().optional(),
  embeddedAt: z.string().optional(),

  // ── Audit & provenance ──────────────────────────────────────────────────────
  createdAt: z.string(),
  createdBy: z.string().optional(),
  approved: z.boolean().default(true), // false = auto-created, needs human review
  lastSyncedAt: z.string().optional(), // latest sync timestamp across all external sources

  // ── Matching audit trail ─────────────────────────────────────────────────────
  matchingAudit: z.object({
    stage: z.enum(['fuzzy_match', 'semantic_analysis', 'llm_arbitration', 'manual_creation', 'cofid_import']).optional(),
    decisionAction: z.enum(['use_existing_canon', 'create_from_cofid', 'create_new_canon', 'manual_create', 'no_match']).optional(),
    decisionSource: z.enum(['algorithm', 'llm', 'user', 'import']).optional(),
    matchedSource: z.enum(['canon', 'cofid', 'new-canon', 'manual', 'unlinked']).optional(),
    finalCandidateId: z.string().optional(),
    reason: z.string().optional(),
    recordedAt: z.string().optional(),
    nearMisses: z.array(z.object({
      candidateId: z.string(),
      candidateName: z.string(),
      source: z.enum(['canon', 'cofid']),
      score: z.number().min(0).max(1),
      reason: z.string().optional(),
    })).optional(),
    topScore: z.number().min(0).max(1).optional(),
    scoreGap: z.number().min(0).max(1).optional(),
  }).optional(),
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
  qualifiers: z.array(z.string()).optional(), // e.g., ["fresh", "organic"] - extracted descriptors (Stage 4: Issue #70)
  preparation: z.string().optional(), // e.g., "diced", "chopped"
  
  // PR7: Canon parse integration (parse-only; no item linking)
  parseReviewFlags: z.array(z.enum([
    'invalid-aisle-id-repaired',
    'invalid-unit-id-repaired',
    'missing-aisle-suggestion',
    'index-mismatch',
    'index-duplicate',
    'data-repaired',
  ])).optional(), // Validation issues from AI parse
  parsedAt: z.string().optional(), // ISO timestamp when ingredient was parsed
  
  canonicalItemId: z.string().optional(), // Links to CanonicalItem
  embedding: z.array(z.number()).optional(), // Cached semantic embedding of ingredientName for faster rematching
  edited: z.boolean().optional(), // Flag to force rematch when ingredient is manually edited in UI
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
    nearMisses: z.array(z.object({
      name: z.string(),
      score: z.number(),
      method: z.enum(['exact', 'fuzzy', 'semantic']),
    })).optional(), // Top candidates from fuzzy + semantic stages (max 3)
  }).optional(),
  // Parser versioning: track parser improvements to enable incremental updates
  parserVersion: z.number().optional(), // Parser version that created this structure
  parserIdentityKey: z.string().optional(), // Hash of item + qualifiers (excludes preparation)
  parserUpdatedAt: z.string().optional(), // ISO timestamp of last parser update
  // Matching versioning: track when LLM matching was performed
  matchingVersion: z.number().optional(), // Matching pipeline version
  matchedAt: z.string().optional(), // ISO timestamp of last match
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
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  createdBy: z.string().optional(),
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;

// Shopping List Item Schema
// One doc per canonical item (or unmatched manual entry) per list.
// contributions[] tracks every recipe/manual entry that contributes to this item.
// Quantities are aggregated and stored — the shopping view is pure reads.
export const ShoppingListItemSchema = z.object({
  id: z.string(),
  shoppingListId: z.string(),
  canonicalItemId: z.string().optional(), // undefined = unmatched manual entry

  name: z.string(),
  aisle: z.string().optional(),

  // Aggregated quantities (stored, computed from contributions at write time)
  totalBaseQty: z.number().optional(),
  baseUnit: z.string().optional(),       // 'g' | 'ml' | unit as-is for count/colloquial
  displayQty: z.number().optional(),     // v2: shopping unit qty if defined on CanonicalItem
  displayUnit: z.string().optional(),

  // Embedded source records — one entry per recipe ingredient or manual addition
  contributions: z.array(z.object({
    sourceType: z.enum(['recipe', 'manual']),
    recipeId: z.string().optional(),
    recipeTitle: z.string().optional(),
    rawText: z.string(),                 // original ingredient string, always preserved
    qty: z.number().optional(),
    unit: z.string().optional(),
    addedBy: z.string(),
    addedAt: z.string(),
  })),

  status: z.enum(['needs_review', 'active']),
  // needs_review: staple/storecupboard item pending user approval
  // active: on the main list

  checked: z.boolean(),
  checkedAt: z.string().optional(),
  checkedBy: z.string().optional(),

  note: z.string().optional(),
  addedBy: z.string().optional(),        // populated for manually-initiated items
  updatedAt: z.string(),
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
  complexity: z.enum(['Beginner', 'Simple', 'Intermediate', 'Hard', 'Technical']),
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
  recipeIds: z.array(z.string()).optional(),
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


