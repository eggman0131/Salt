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
  CoFIDGroupAisleMapping,
  IngredientMatchingConfig,
  MatchingEvent,
} from '../../../types/contract';

export type IngredientSemanticCandidate = {
  id: string;
  name: string;
  source: 'canon' | 'cofid';
  score: number;
  item: CanonicalItem | any;
};

export type SemanticScoreCluster = {
  topScore: number;
  topCandidates: IngredientSemanticCandidate[];
  nextScore: number | null;
  scoreGap: number;
  isAmbiguous: boolean;
  clusterSize: number;
};

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

  // ==================== INGREDIENT MATCHING CONFIG ====================

  getIngredientMatchingConfig: () => Promise<IngredientMatchingConfig>;
  updateIngredientMatchingConfig: (updates: Partial<IngredientMatchingConfig>) => Promise<IngredientMatchingConfig>;

  // ==================== MATCHING EVENTS (Issue #79: Matching Observability) ====================

  /**
   * Create a matching event log entry
   * Records structured data about ingredient matching pipeline decisions
   */
  createMatchingEvent: (event: Omit<MatchingEvent, 'id'>) => Promise<MatchingEvent>;

  /**
   * Get matching events, optionally filtered by runId, recipeId, or date range
   */
  getMatchingEvents: (filters?: {
    runId?: string;
    recipeId?: string;
    startDate?: string;
    endDate?: string;
    outcome?: MatchingEvent['outcome'];
    limit?: number;
  }) => Promise<MatchingEvent[]>;

  /**
   * Delete matching events older than the specified date
   * Used for retention policy enforcement
   */
  deleteMatchingEventsOlderThan: (cutoffDate: string) => Promise<{ deletedCount: number }>;

  // ==================== SEMANTIC SEARCH (Phase 2) ====================

  /**
   * Searches canonical items by semantic similarity to the given embedding.
   * Returns top candidates ranked by cosine similarity score.
   * 
   * Used in Stage 2 of ingredient matching pipeline.
   */
  searchSemanticCandidates: (
    embedding: number[],
    maxCandidates?: number
  ) => Promise<IngredientSemanticCandidate[]>;

  /**
   * Analyzes score distribution of semantic candidates.
   * Detects ambiguous matches where multiple items have similar confidence.
   * 
   * Used to determine if LLM arbitration is needed (Phase 3).
   */
  analyzeSemanticMatch: (
    candidates: IngredientSemanticCandidate[],
    config?: { gapThreshold?: number; clusterWindow?: number }
  ) => Promise<SemanticScoreCluster>;

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
  // Optionally accepts queryEmbedding from semantic matching to avoid regenerating it
  enrichCanonicalItem: (rawName: string, queryEmbedding?: number[]) => Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }>;

  // ==================== INGREDIENT PROCESSING ====================

  processIngredients: (
    ingredients: string[] | RecipeIngredient[],
    contextId: string,
    onProgress?: (progress: { stage: string; current: number; total: number; percentage: number }) => void
  ) => Promise<RecipeIngredient[]>;
  /**
   * Decision function for incremental ingredient processing
   * Determines whether an ingredient needs reparsing/rematching
   * 
   * Returns:
   * - 'skip': Ingredient is unchanged and up-to-date
   * - 'reparse-only': Parser improved but identity unchanged (update metadata only)
   * - 'rematch': Identity changed or needs full reprocessing
   */
  shouldRematchIngredient: (params: {
    oldIngredient?: RecipeIngredient;
    newRaw: string;
    newParsed?: any;
    parserVersion?: number;
  }) => 'skip' | 'reparse-only' | 'rematch';
  // ==================== COFID DATA IMPORT ====================

  importCoFIDData: (data: any[]) => Promise<{
    itemsImported: number;
    errors: string[];
  }>;

  // ==================== COFID GROUP AISLE MAPPINGS ====================

  getCofidGroupMappings: () => Promise<CoFIDGroupAisleMapping[]>;
  createCofidGroupMapping: (mapping: Omit<CoFIDGroupAisleMapping, 'id' | 'createdAt'>) => Promise<CoFIDGroupAisleMapping>;
  updateCofidGroupMapping: (id: string, updates: Partial<CoFIDGroupAisleMapping>) => Promise<CoFIDGroupAisleMapping>;
  deleteCofidGroupMapping: (id: string) => Promise<void>;
  importCoFIDGroupMappings: (mappings: Array<Omit<CoFIDGroupAisleMapping, 'id' | 'createdAt'>>) => Promise<{
    mappingsImported: number;
    errors: string[];
  }>;
  seedUnits: (units: Array<Omit<Unit, 'id' | 'createdAt'>>) => Promise<{
    unitsImported: number;
    unitsSkipped: number;
    errors: string[];
  }>;

  // Batch embed canonical items
  embedCanonicalItems: (itemIds: string[]) => Promise<{ itemsEmbedded: number; itemsSkipped: number }>;
}
