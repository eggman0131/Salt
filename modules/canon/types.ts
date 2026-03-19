/**
 * Canon Module — Module-specific types
 *
 * Only types that are specific to this module and not already
 * defined in types/contract.ts belong here.
 */

import { z } from 'zod';
import type { Unit, Aisle } from '@/types/contract';

/** Result of sortAisles / sortUnits helpers */
export type SortOrder = number;

/** Grouped units by category */
export type UnitsByCategory = {
  weight: Unit[];
  volume: Unit[];
  count: Unit[];
  colloquial: Unit[];
};

/** Result of an aisle name lookup */
export type AisleLookupResult =
  | { found: true; aisle: Aisle }
  | { found: false };

/** Result of a unit lookup */
export type UnitLookupResult =
  | { found: true; unit: Unit }
  | { found: false };

// ── PR4-A: AI Parse Types ────────────────────────────────────────────────────

/** Reference to a canonical aisle (used in parse results) */
export interface AisleRef {
  id: string;
  name: string;
}

/** Reference to a canonical unit (used in parse results) */
export interface UnitRef {
  id: string;
  name: string;
}

/** Single ingredient parse result from AI */
export interface AiSingleParseResult {
  index: number;
  originalLine: string;
  itemName: string;
  quantity: number | null;
  recipeUnitId: string | null;
  aisleId: string;
  suggestedAisleName?: string;
  preparations: string[];
  notes: string[];
}

/** AI parse response from Cloud Function */
export interface AiParseResponse {
  success: boolean;
  message?: string;
  data?: {
    results: AiSingleParseResult[];
  };
}

/** Validation flags on a parsed result */
export type ReviewFlag =
  | 'invalid-aisle-id-repaired'
  | 'invalid-unit-id-repaired'
  | 'missing-aisle-suggestion'
  | 'index-mismatch'
  | 'index-duplicate'
  | 'data-repaired';

/** Validated and potentially repaired parse result */
export interface ValidatedParseResult extends AiSingleParseResult {
  reviewFlags: ReviewFlag[];
}

/** Batch parse response after validation */
export interface BatchParseResponse {
  totalCount: number;
  successCount: number;
  hasErrors: boolean;
  hasReviewFlags: boolean;
  results: ValidatedParseResult[];
  errors?: string[];
}

/** System fallback aisle */
export const UNCATEGORISED_AISLE: AisleRef = {
  id: 'uncategorised',
  name: 'Uncategorised',
};

// ── Canon-specific domain types (moved from types/contract.ts) ───────────────


// CofID Item Schema (Imported from CofID JSON backup)
// Raw CofID items stored in canonCofidItems collection for matching and linking
export const CofIDItemSchema = z.object({
  id: z.string(), // Original CofID item ID
  name: z.string(), // CofID item name
  group: z.string(), // CofID group code (1-3 letters, e.g., "A", "B", "C")
  nutrients: z.record(z.string(), z.unknown()).optional(), // Nutritional data (extensible structure)
  importedAt: z.string(), // ISO timestamp when imported
  // NOTE: Embeddings are stored in canonEmbeddingLookup, not here
});
export type CofIDItem = z.infer<typeof CofIDItemSchema>;

// CofID Import Report Schema (for validation and diagnostics)
export const CofIDImportReportSchema = z.object({
  totalItems: z.number(),
  importedItems: z.number(),
  failedItems: z.number(),
  embeddingValidationErrors: z.array(z.object({
    id: z.string(),
    reason: z.string(),
  })).optional(),
  mappingResults: z.object({
    mapped: z.number(), // Items with valid aisle mapping
    unmapped: z.number(), // Items without aisle name in mapping file
    forced_to_uncategorised: z.number(), // Items forced to uncategorised aisle
  }).optional(),
  mappingFailures: z.array(z.object({
    group: z.string(),
    groupName: z.string(),
    reason: z.string(),
  })).optional(),
  collisions: z.array(z.object({
    normalisedName: z.string(),
    aisleNames: z.array(z.string()),
  })).optional(),
  generatedAt: z.string(),
});
export type CofIDImportReport = z.infer<typeof CofIDImportReportSchema>;

// Canon Embedding Lookup Schema (PR6)
// Unified embedding storage for semantic matching (CofID + Canon items)
export const CanonEmbeddingLookupSchema = z.object({
  id: z.string(), // Auto-generated document ID
  kind: z.enum(['cofid', 'canon']), // Source type
  refId: z.string(), // Reference to original item (CofID ID or Canon item ID)
  name: z.string(), // Item name for display
  aisleId: z.string(), // Canon aisle ID (for aisle-bounded matching)
  embedding: z.array(z.number()), // Vector embedding (768 dims for text-embedding-005)
  embeddingModel: z.string(), // Model used (e.g., "text-embedding-005")
  embeddingDim: z.number(), // Dimension count (768)
  createdAt: z.string(), // ISO timestamp when indexed
  updatedAt: z.string().optional(), // ISO timestamp when last updated
});
export type CanonEmbeddingLookup = z.infer<typeof CanonEmbeddingLookupSchema>;

// Canon Match Event Schema (Performance Monitoring & Analysis)
// Logs each stage of the CofID matching pipeline for troubleshooting and ML analysis
export const CanonMatchEventSchema = z.object({
  id: z.string(), // Auto-generated event ID
  timestamp: z.string(), // ISO timestamp when event occurred

  // Event classification
  eventType: z.enum([
    'ai-parse',              // AI ingredient parsing (raw strings → structured data)
    'parse-validation',      // Validation and repair of AI parse results
    'match-decision',        // Decision to link/create/skip ingredient
    'embedding-generation',  // Query embedding generation
    'semantic-match',        // Cosine similarity search
    'lexical-match',         // Levenshtein distance matching
    'candidate-merge',       // Merging semantic + lexical results
    'final-selection',       // User selects a specific match
    'fdc-data-load',         // FDC binary embeddings loaded into memory
    'fdc-match',             // FDC cosine similarity search
  ]),

  // Entity being matched
  entityType: z.enum(['canon-item', 'cofid-item', 'recipe-ingredient']),
  entityId: z.string(),
  entityName: z.string(),
  aisleId: z.string().optional(), // Canon aisle ID for context

  // Input data (stage-specific)
  input: z.object({
    queryText: z.string().optional(), // For embedding generation
    embeddingDim: z.number().optional(), // For semantic search
    candidateCount: z.number().optional(), // Pool size for matching
    aisleFiltered: z.boolean().optional(), // Whether aisle filtering applied
  }).passthrough(), // Allow additional stage-specific fields

  // Output data (stage-specific)
  output: z.object({
    resultCount: z.number().optional(), // How many results returned
    topScore: z.number().optional(), // Best match score
    topMatchId: z.string().optional(), // Best match CofID ID
    topMatchName: z.string().optional(), // Best match name
    method: z.enum(['exact', 'fuzzy', 'semantic', 'manual', 'merged', 'fdc-matching']).optional(), // Match method
    embeddingGenerated: z.boolean().optional(), // Whether new embedding was created
    embeddingReused: z.boolean().optional(), // Whether existing embedding was reused
    // Near-miss candidates — top results considered but not chosen (match-decision events)
    candidates: z.array(z.object({
      id: z.string(),
      name: z.string(),
      score: z.number(),
      method: z.string(),
      reason: z.string().optional(),
    })).optional(),
  }).passthrough(), // Allow additional stage-specific fields

  // Performance metrics
  metrics: z.object({
    durationMs: z.number(), // Time taken for this stage
    batchId: z.string().optional(), // If part of batch operation
    batchSize: z.number().optional(), // Total items in batch
    batchIndex: z.number().optional(), // This item's position in batch (0-indexed)
    sessionLabel: z.string().optional(), // Human-readable label (recipe title, operation description)
  }),

  // Additional metadata for troubleshooting
  metadata: z.object({
    error: z.string().optional(), // Error message if operation failed
    warning: z.string().optional(), // Warning message for suboptimal results
    pipelineVersion: z.string().optional(), // Code version for tracking changes
    threshold: z.number().optional(), // Matching threshold used
  }).passthrough().optional(),
});
export type CanonMatchEvent = z.infer<typeof CanonMatchEventSchema>;

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

// Matching Event Schema (Issue #79: Matching Observability)
// Structured log of ingredient matching pipeline decisions for analysis and debugging
export const MatchingEventSchema = z.object({
  id: z.string(),

  // Context
  runId: z.string(), // Groups all events from one processIngredients call
  recipeId: z.string(),
  recipeName: z.string(),
  ingredientIndex: z.number(), // Position in ingredient list
  ingredientName: z.string(),
  raw: z.string(), // Original raw ingredient string
  timestamp: z.string(), // ISO timestamp

  // Stage 1: Parsing
  parsing: z.object({
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    item: z.string(),
    qualifiers: z.array(z.string()),
    preparation: z.string().nullable(),
  }),

  // Stage 1b: Fuzzy matching
  fuzzy: z.object({
    matched: z.boolean(),
    matchedTo: z.string().nullable(), // Canon item name
    matchedToId: z.string().nullable(), // Canon item ID
    score: z.number().nullable(),
  }).optional(),

  // Stage 2: Semantic search
  semantic: z.object({
    topCandidateName: z.string().nullable(),
    topCandidateSource: z.enum(['canon', 'cofid']).nullable(),
    topScore: z.number().nullable(),
    scoreGap: z.number().nullable(), // Gap between 1st and 2nd candidate
    candidateCount: z.number(),
    clusterSize: z.number().optional(), // For ambiguous clusters
    case: z.enum(['A_confident', 'B_ambiguous', 'C_weak', 'D_none']),
    allCandidates: z.array(z.object({
      name: z.string(),
      source: z.enum(['canon', 'cofid']),
      score: z.number(),
    })).optional(), // Top N candidates for analysis
  }).optional(),

  // Stage 3: LLM Arbitration (only when needed)
  arbitration: z.object({
    needed: z.boolean(),
    decision: z.enum(['use_existing_canon', 'create_from_cofid', 'create_new_canon', 'no_match']).nullable(),
    confidence: z.number().nullable(),
    reason: z.string().nullable(),
    decisionSource: z.enum(['llm', 'fallback']).nullable(),
  }).optional(),

  // Final outcome
  outcome: z.enum(['matched_existing', 'created_from_cofid', 'ai_generated', 'unlinked']),
  canonicalItemId: z.string().nullable(),
  canonicalItemName: z.string().nullable(),
  durationMs: z.number(), // Time spent processing this ingredient
});
export type MatchingEvent = z.infer<typeof MatchingEventSchema>;

// Ingredient Parsing Log (for debugging and auditing parsing output)
export const IngredientParsingLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(), // ISO timestamp
  raw: z.string(), // Original ingredient string
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  ingredientName: z.string(),
  qualifiers: z.array(z.string()),
  preparation: z.string().nullable(),
  parserVersion: z.number().nullable(),
  createdAt: z.string(),
  // Correctness tracking for parser tuning
  correct: z.boolean().default(false),
  correctedQuantity: z.number().nullable().optional(),
  correctedUnit: z.string().nullable().optional(),
  correctedIngredientName: z.string().nullable().optional(),
  correctedQualifiers: z.array(z.string()).optional(),
  correctedPreparation: z.string().nullable().optional(),
  correctionNotes: z.string().nullable().optional(),
  correctedAt: z.string().nullable().optional(),
});
export type IngredientParsingLog = z.infer<typeof IngredientParsingLogSchema>;
