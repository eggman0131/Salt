/**
 * Base Canon Backend
 *
 * Contains item-domain logic and ingredient processing.
 * Subclasses implement persistence (Firebase, Simulation).
 */

import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import {
  Unit,
  Aisle,
  CanonicalItem,
  RecipeIngredient,
  IngredientMatchingConfig,
  MatchingEvent,
} from '../../../types/contract';
import { ICanonBackend, IngredientSemanticCandidate, SemanticScoreCluster } from './canon-backend.interface';
import { debugLogger } from '../../../shared/backend/debug-logger';

type ArbitrationDecision = {
  action: 'use_existing_canon' | 'create_from_cofid' | 'create_new_canon' | 'no_match';
  candidateId?: string;
  confidence?: number;
  reason?: string;
  decisionSource?: 'llm' | 'fallback';
};

/**
 * Internal parse shape (Stage 2: Second-pass classifier)
 * Rich representation before mapping to RecipeIngredient for persistence.
 */
type ParsedIngredientInternal = {
  quantityRaw: string | null;      // Original quantity string (e.g., "4 x 240g", "2-3")
  quantityValue: number | null;    // Parsed numeric value for maths
  unit: string | null;              // Unit (g, ml, tsp, tbsp, etc.)
  item: string;                     // Core canonicalisable noun
  qualifiers: string[];            // Modifiers, sub-varieties, parenthetical notes
  preparation: string | null;      // Action phrases (chopped, drained, etc.)
};

export abstract class BaseCanonBackend implements ICanonBackend {
  // Unit cache: populated on first matching operation (reduces Firestore reads)
  private cachedUnits: Unit[] | null = null;

  // ==================== ABSTRACT METHODS ====================
  // Subclasses MUST implement persistence and AI transport

  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;
  protected abstract getSystemInstruction(customContext?: string): Promise<string>;
  protected abstract embedText(text: string): Promise<{ embedding: number[] } | null>;
  protected abstract createCanonicalItemFromCofid(
    cofidItem: any,
    auditTrail?: CanonicalItem['matchingAudit'],
    originalIngredientName?: string
  ): Promise<CanonicalItem>;

  // Units (CRUD)
  abstract getUnits(): Promise<Unit[]>;
  abstract createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit>;
  abstract updateUnit(id: string, updates: Partial<Unit>): Promise<Unit>;
  abstract deleteUnit(id: string): Promise<void>;

  // Aisles (CRUD)
  abstract getAisles(): Promise<Aisle[]>;
  abstract createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle>;
  abstract updateAisle(id: string, updates: Partial<Aisle>): Promise<Aisle>;
  abstract deleteAisle(id: string): Promise<void>;

  // Ingredient Matching Config (admin settable thresholds)
  abstract getIngredientMatchingConfig(): Promise<IngredientMatchingConfig>;
  abstract updateIngredientMatchingConfig(updates: Partial<IngredientMatchingConfig>): Promise<IngredientMatchingConfig>;

  // Matching Events (Issue #79: Matching Observability)
  abstract createMatchingEvent(event: Omit<MatchingEvent, 'id'>): Promise<MatchingEvent>;
  abstract getMatchingEvents(filters?: {
    runId?: string;
    recipeId?: string;
    startDate?: string;
    endDate?: string;
    outcome?: MatchingEvent['outcome'];
    limit?: number;
  }): Promise<MatchingEvent[]>;
  abstract deleteMatchingEventsOlderThan(cutoffDate: string): Promise<{ deletedCount: number }>;

  // Semantic Search (Phase 2: Embedding-based matching)
  abstract searchSemanticCandidates(embedding: number[], maxCandidates?: number): Promise<IngredientSemanticCandidate[]>;
  abstract analyzeSemanticMatch(candidates: IngredientSemanticCandidate[], config?: { gapThreshold?: number; clusterWindow?: number }): Promise<SemanticScoreCluster>;

  // Canonical Items (CRUD)
  abstract getCanonicalItems(): Promise<CanonicalItem[]>;
  abstract getCanonicalItem(id: string): Promise<CanonicalItem | null>;
  abstract createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem>;
  abstract updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem>;
  abstract deleteCanonicalItem(id: string): Promise<void>;
  abstract deleteCanonicalItems(ids: string[]): Promise<void>;

  // Impact assessment and healing
  abstract assessItemDeletion(ids: string[]): Promise<{
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }>;
  abstract healRecipeReferences(ids: string[], assessment: {
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }): Promise<{
    recipesFixed: number;
    ingredientsProcessed: number;
    ingredientsRematched: number;
    ingredientsUnmatched: number;
    newCanonicalItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }>;
    recipesWithUnlinkedItems: Array<{ id: string; title: string; unlinkedCount: number }>;
  }>;

  // AI enrichment
  abstract enrichCanonicalItem(rawName: string, queryEmbedding?: number[]): Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }>;

  // CoFID + embeddings
  abstract importCoFIDData(data: any[]): Promise<{ itemsImported: number; errors: string[] }>;
  abstract getCofidGroupMappings(): Promise<import('../../../types/contract').CoFIDGroupAisleMapping[]>;
  abstract createCofidGroupMapping(mapping: Omit<import('../../../types/contract').CoFIDGroupAisleMapping, 'id' | 'createdAt'>): Promise<import('../../../types/contract').CoFIDGroupAisleMapping>;
  abstract updateCofidGroupMapping(id: string, updates: Partial<import('../../../types/contract').CoFIDGroupAisleMapping>): Promise<import('../../../types/contract').CoFIDGroupAisleMapping>;
  abstract deleteCofidGroupMapping(id: string): Promise<void>;
  abstract importCoFIDGroupMappings(mappings: Array<Omit<import('../../../types/contract').CoFIDGroupAisleMapping, 'id' | 'createdAt'>>): Promise<{ mappingsImported: number; errors: string[] }>;
  abstract seedUnits(units: Array<Omit<import('../../../types/contract').Unit, 'id' | 'createdAt'>>): Promise<{ unitsImported: number; unitsSkipped: number; errors: string[] }>;
  abstract embedCanonicalItems(itemIds: string[]): Promise<{ itemsEmbedded: number; itemsSkipped: number }>;

  /**
   * Test parsing a single ingredient string through the full pipeline
   * For admin debugging/testing of ingredient parsing behaviour
   */
  abstract testParseIngredient(raw: string): Promise<Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'>>;

  // ==================== INGREDIENT PROCESSING ====================

  /**
   * Current parser version for ingredient parsing
   * Increment when parser logic changes to enable incremental updates
   */
  private static readonly PARSER_VERSION = 2; // Updated for trailing state extraction

  /**
   * Current matching pipeline version
   * Increment when matching logic/prompts change significantly
   */
  private static readonly MATCHING_VERSION = 1;

  /**
   * Build identity key from parsed ingredient (item + qualifiers, excludes preparation)
   * Used to detect when ingredient identity changes vs. just preparation changes
   */
  private buildIdentityKey(item: string, qualifiers?: string[]): string {
    const parts = [item.toLowerCase().trim()];
    if (qualifiers && qualifiers.length > 0) {
      parts.push(...qualifiers.map(q => q.toLowerCase().trim()).sort());
    }
    return parts.join('::');
  }

  /**
   * Decision function for incremental ingredient processing
   * Determines whether an ingredient needs reparsing/rematching
   * 
   * Returns:
   * - 'skip': Ingredient is unchanged and up-to-date
   * - 'reparse-only': Parser improved but identity unchanged (update metadata only)
   * - 'rematch': Identity changed or needs full reprocessing
   * 
   * Use cases:
   * 1. Recipe updates: compare old vs new raw text
   * 2. Parser migrations: apply parser improvements without forcing AI rematching
   */
  shouldRematchIngredient(params: {
    oldIngredient?: RecipeIngredient;
    newRaw: string;
    newParsed?: ParsedIngredientInternal;
    parserVersion?: number;
  }): 'skip' | 'reparse-only' | 'rematch' {
    const { oldIngredient, newRaw, newParsed, parserVersion = BaseCanonBackend.PARSER_VERSION } = params;

    // No old ingredient: always process
    if (!oldIngredient) {
      return 'rematch';
    }

    // User manually edited the ingredient: force rematch
    if (oldIngredient.edited) {
      return 'rematch';
    }

    // Raw text changed: always rematch
    if (oldIngredient.raw !== newRaw) {
      return 'rematch';
    }

    // No canonicalItemId yet: needs matching
    if (!oldIngredient.canonicalItemId) {
      return 'rematch';
    }

    // Parser version upgraded
    if (oldIngredient.parserVersion && oldIngredient.parserVersion < parserVersion) {
      // If we have new parsed structure, check if identity changed
      if (newParsed && oldIngredient.parserIdentityKey) {
        const newIdentityKey = this.buildIdentityKey(newParsed.item, newParsed.qualifiers);
        if (newIdentityKey !== oldIngredient.parserIdentityKey) {
          // Identity changed (item or qualifiers differ): rematch needed
          return 'rematch';
        } else {
          // Identity unchanged (only preparation/metadata changed): update parser metadata only
          return 'reparse-only';
        }
      }
      // No old identity key or new parsed structure: safer to rematch
      return 'rematch';
    }

    // Ingredient is up-to-date
    return 'skip';
  }

  /**
   * Process raw ingredient strings -> structured RecipeIngredient[] with canonical item links
   * 
   * Multi-stage semantic matching pipeline (Issue #68):
   * 1. Parse ingredient strings
   * 2. Fuzzy matching (fast pass for obvious matches)
   * 3. Semantic embedding search (Canon + CoFID)
   * 4. Semantic decision logic (confident/ambiguous/weak)
   * 5. LLM arbitration (only when needed)
   * 6. Create/update Canon items
   */
  async processIngredients(
    ingredients: string[] | RecipeIngredient[],
    contextId: string,
    onProgress?: (progress: { stage: string; current: number; total: number; percentage: number }) => void
  ): Promise<RecipeIngredient[]> {
    const startTime = Date.now();
    const runId = `${contextId}_${Date.now()}`;
    
    debugLogger.log('Ingredient Matching', `━━━━━ Starting processIngredients for ${contextId} with ${ingredients.length} items ━━━━━`);
    debugLogger.log('Ingredient Matching', `Run ID: ${runId}`);
    onProgress?.({ stage: 'Starting ingredient matching', current: 0, total: ingredients.length, percentage: 0 });

    // Handle already-structured ingredients (e.g., from manual repair)
    if (ingredients.length > 0 && typeof ingredients[0] === 'object') {
      debugLogger.log('Ingredient Matching', `Processing ${ingredients.length} structured ingredients with incremental update logic`);
      
      // Load units if not cached yet (needed for parsing)
      if (!this.cachedUnits) {
        this.cachedUnits = await this.getUnits();
      }
      
      // Use incremental processing logic for structured ingredients
      const structuredIngredients = ingredients as RecipeIngredient[];
      const toRematch: { index: number; raw: string }[] = [];
      const toReparseOnly: { index: number; ingredient: RecipeIngredient }[] = [];
      const toSkip: { index: number; ingredient: RecipeIngredient }[] = [];
      
      for (let i = 0; i < structuredIngredients.length; i++) {
        const ing = structuredIngredients[i];
        const decision = this.shouldRematchIngredient({
          oldIngredient: ing,
          newRaw: ing.raw,
          parserVersion: BaseCanonBackend.PARSER_VERSION,
        });
        
        if (decision === 'skip') {
          toSkip.push({ index: i, ingredient: ing });
        } else if (decision === 'reparse-only') {
          toReparseOnly.push({ index: i, ingredient: ing });
        } else {
          toRematch.push({ index: i, raw: ing.raw });
        }
      }
      
      debugLogger.log('Ingredient Matching', `Decision breakdown: ${toRematch.length} rematch, ${toReparseOnly.length} reparse-only, ${toSkip.length} skip`);
      
      // If everything can be skipped, return as-is
      if (toRematch.length === 0 && toReparseOnly.length === 0) {
        debugLogger.log('Ingredient Matching', `All ingredients up-to-date, returning as-is`);
        onProgress?.({ stage: 'Complete', current: ingredients.length, total: ingredients.length, percentage: 100 });
        return structuredIngredients;
      }
      
      // Process ingredients that need rematching by recursively calling with raw strings
      const rematchedMap = new Map<number, RecipeIngredient>();
      if (toRematch.length > 0) {
        debugLogger.log('Ingredient Matching', `Rematching ${toRematch.length} ingredients...`);
        const rawStrings = toRematch.map(item => item.raw);
        const rematchedResults = await this.processIngredients(rawStrings, `${contextId}-rematch`, onProgress);
        
        // Map results back to original indices
        toRematch.forEach((item, idx) => {
          rematchedMap.set(item.index, {
            ...rematchedResults[idx],
            id: structuredIngredients[item.index].id, // Preserve original ID
          });
        });
      }
      
      // Update reparse-only ingredients with new parser metadata
      const now = new Date().toISOString();
      const reparseMap = new Map<number, RecipeIngredient>();
      for (const { index, ingredient } of toReparseOnly) {
        const enhanced = this.parseIngredientEnhanced(ingredient.raw, this.cachedUnits || []);
        const identityKey = this.buildIdentityKey(enhanced.item, enhanced.qualifiers);
        
        reparseMap.set(index, {
          ...ingredient,
          parserVersion: BaseCanonBackend.PARSER_VERSION,
          parserIdentityKey: identityKey,
          parserUpdatedAt: now,
        });
      }
      
      // Combine results in original order
      const finalResults: RecipeIngredient[] = structuredIngredients.map((ing, i) => {
        if (rematchedMap.has(i)) return rematchedMap.get(i)!;
        if (reparseMap.has(i)) return reparseMap.get(i)!;
        return ing; // skip - use as-is
      });
      
      onProgress?.({ stage: 'Complete', current: ingredients.length, total: ingredients.length, percentage: 100 });
      return finalResults;
    }

    // Load matching configuration and units (with defaults if not found)
    const config = await this.getIngredientMatchingConfig();
    debugLogger.log('Ingredient Matching', `📋 Matching Config: fuzzy=${config.fuzzyHighConfidenceThreshold}, semantic high=${config.semanticHighThreshold}, low=${config.semanticLowThreshold}, gap=${config.semanticGapThreshold}, cluster=${config.semanticClusterWindow}`);

    // Load units once (cache for performance)
    if (!this.cachedUnits) {
      this.cachedUnits = await this.getUnits();
    }
    const renderableUnits = this.cachedUnits.map(u => u.name).join(', ');
    debugLogger.log('Ingredient Matching', `Loaded ${this.cachedUnits.length} units: ${renderableUnits}`);

    const allCanonItems = await this.getCanonicalItems();
    debugLogger.log('Ingredient Matching', `Loaded ${allCanonItems.length} canonical items for matching`);

    const results: RecipeIngredient[] = [];
    const pendingSemanticSearch: Array<{
      index: number;
      parsed: Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'>;
    }> = [];

    // ========== STAGE 1: PARSE & FUZZY MATCHING ==========
    debugLogger.log('Ingredient Matching', `┌── STAGE 1: Parse & Fuzzy Matching (threshold: ${(config.fuzzyHighConfidenceThreshold * 100).toFixed(0)}%) ──┐`);

    for (let idx = 0; idx < ingredients.length; idx++) {
      const raw = typeof ingredients[idx] === 'string' ? ingredients[idx] as string : '';
      const parsed = this.parseIngredientString(raw, this.cachedUnits!);
      const enhanced = this.parseIngredientEnhanced(raw, this.cachedUnits!);

      // Log enhanced structure for debugging
      const qualifierStr = enhanced.qualifiers.length > 0 ? ` [qualifiers: ${enhanced.qualifiers.join(', ')}]` : '';
      const prepStr = enhanced.preparation ? ` {prep: ${enhanced.preparation}}` : '';
      debugLogger.log('Ingredient Matching', `[${idx}] "${raw}" → qty=${enhanced.quantityValue}${enhanced.unit ? enhanced.unit : ''} item="${enhanced.item}"${qualifierStr}${prepStr}`);

      let bestMatch: CanonicalItem | null = null;
      let bestScore = 0;
      let secondBestScore = 0;
      let matchingKey = 'item'; // Track which key was used for matching

      // Stage 3: Fuzzy match using enhanced.item as primary key
      // This provides cleaner input to fuzzy matching (e.g., "pizza dough" instead of "4 x 240g pizza dough")
      const primaryKey = enhanced.item.toLowerCase();
      
      for (const item of allCanonItems) {
        const nameScore = this.fuzzyMatch(primaryKey, item.normalisedName);
        if (nameScore > bestScore) {
          secondBestScore = bestScore;
          bestScore = nameScore;
          bestMatch = item;
        } else if (nameScore > secondBestScore) {
          secondBestScore = nameScore;
        }

        // Check synonyms
        if (item.synonyms) {
          for (const syn of item.synonyms) {
            const synScore = this.fuzzyMatch(primaryKey, syn.toLowerCase());
            if (synScore > bestScore) {
              secondBestScore = bestScore;
              bestScore = synScore;
              bestMatch = item;
            } else if (synScore > secondBestScore) {
              secondBestScore = synScore;
            }
          }
        }
      }

      // Qualifier-based disambiguation when scores are close
      const scoreGap = bestScore - secondBestScore;
      if (scoreGap < 0.15 && enhanced.qualifiers.length > 0) {
        // Scores are close; try matching with qualifiers included
        const qualifiedKey = `${enhanced.qualifiers.join(' ')} ${enhanced.item}`.toLowerCase();
        let qualifiedBestMatch: CanonicalItem | null = null;
        let qualifiedBestScore = 0;

        for (const item of allCanonItems) {
          const qualifiedScore = this.fuzzyMatch(qualifiedKey, item.normalisedName);
          if (qualifiedScore > qualifiedBestScore) {
            qualifiedBestScore = qualifiedScore;
            qualifiedBestMatch = item;
          }

          if (item.synonyms) {
            for (const syn of item.synonyms) {
              const qualifiedSynScore = this.fuzzyMatch(qualifiedKey, syn.toLowerCase());
              if (qualifiedSynScore > qualifiedBestScore) {
                qualifiedBestScore = qualifiedSynScore;
                qualifiedBestMatch = item;
              }
            }
          }
        }

        // Use qualified match if distinctly better
        if (qualifiedBestScore > bestScore) {
          bestScore = qualifiedBestScore;
          bestMatch = qualifiedBestMatch;
          matchingKey = 'item+qualifiers';
        }
      }

      // Confident fuzzy match?
      if (bestScore >= config.fuzzyHighConfidenceThreshold && bestMatch) {
        debugLogger.log('Ingredient Matching', `[${idx}] ✓ Fuzzy HIT: "${enhanced.item}" → "${bestMatch.name}" (score: ${(bestScore * 100).toFixed(1)}%, key: ${matchingKey}, gap: ${(scoreGap * 100).toFixed(1)}%)`);
        
        // Add synonym if not already present (use original parsed name for backwards compat)
        const normalizedIngredient = parsed.ingredientName.toLowerCase();
        if (
          normalizedIngredient !== bestMatch.normalisedName &&
          (!bestMatch.synonyms || !bestMatch.synonyms.some(s => s.toLowerCase() === normalizedIngredient))
        ) {
          debugLogger.log('Ingredient Matching', `[${idx}] Adding "${parsed.ingredientName}" as synonym to "${bestMatch.name}"`);
          const updatedSynonyms = [...(bestMatch.synonyms || []), parsed.ingredientName];
          await this.updateCanonicalItem(bestMatch.id, { synonyms: updatedSynonyms });
        }

        results.push({
          id: `ring-${contextId}-${idx}`,
          raw,
          ...parsed,
          canonicalItemId: bestMatch.id,
          matchingAudit: {
            stage: 'fuzzy',
            decisionAction: 'use_existing_canon',
            decisionSource: 'rule',
            candidateId: bestMatch.id,
            matchedSource: 'canon',
            topScore: bestScore,
            scoreGap,
            reason: `fuzzy-high-confidence-via-${matchingKey}`,
            recordedAt: new Date().toISOString(),
          },
        });
      } else {
        debugLogger.log('Ingredient Matching', `[${idx}] ✗ Fuzzy MISS: "${enhanced.item}" (best: ${(bestScore * 100).toFixed(1)}% < ${(config.fuzzyHighConfidenceThreshold * 100).toFixed(0)}%)`);
        results.push({
          id: `ring-${contextId}-${idx}`,
          raw,
          ...parsed,
          canonicalItemId: undefined,
        });
        pendingSemanticSearch.push({ index: idx, parsed });
      }
    }

    debugLogger.log('Ingredient Matching', `└── Stage 1 complete: ${results.length - pendingSemanticSearch.length}/${ingredients.length} fuzzy matched, ${pendingSemanticSearch.length} pending semantic search ──┘`);
    onProgress?.({ stage: 'Fuzzy matching complete', current: results.length - pendingSemanticSearch.length, total: ingredients.length, percentage: Math.round(((results.length - pendingSemanticSearch.length) / ingredients.length) * 33) });

    // ========== STAGE 2 & 3: SEMANTIC SEARCH & DECISION ==========
    if (pendingSemanticSearch.length > 0) {
      debugLogger.log('Ingredient Matching', `┌── STAGE 2 & 3: Semantic Search & Decision (${pendingSemanticSearch.length} items) ──┐`);
    onProgress?.({ stage: 'Starting semantic analysis', current: results.length - pendingSemanticSearch.length, total: ingredients.length, percentage: 33 });

      for (const { index, parsed } of pendingSemanticSearch) {
        debugLogger.log('Ingredient Matching', `[${index}] Embedding "${parsed.ingredientName}"...`);

        // Check if embedding is cached on this ingredient
        let queryEmbedding: number[];
        if (results[index].embedding && results[index].embedding.length > 0) {
          debugLogger.log('Ingredient Matching', `[${index}] Using cached embedding for "${parsed.ingredientName}"`);
          queryEmbedding = results[index].embedding!;
        } else {
          // Embed the ingredient string
          const embeddingResult = await this.embedText(parsed.ingredientName);
          if (!embeddingResult || !embeddingResult.embedding) {
            debugLogger.warn('Ingredient Matching', `[${index}] Failed to embed "${parsed.ingredientName}", skipping semantic search`);
            continue;
          }

          queryEmbedding = embeddingResult.embedding;
          
          // Cache embedding on recipe ingredient for future rematching
          results[index].embedding = queryEmbedding;
        }

        // Search Canon + CoFID for semantic matches
        const candidates = await this.searchSemanticCandidates(queryEmbedding, config.semanticCandidateCount);

        if (candidates.length === 0) {
          debugLogger.log('Ingredient Matching', `[${index}] No semantic candidates found`);
          continue;
        }

        const topScore = candidates[0].score;
        const secondScore = candidates.length > 1 ? candidates[1].score : 0;
        const scoreGap = topScore - secondScore;

        debugLogger.log(
          'Ingredient Matching',
          `[${index}] Top candidate: "${candidates[0].name}" (${candidates[0].source}, score: ${(topScore * 100).toFixed(1)}%), gap to 2nd: ${(scoreGap * 100).toFixed(1)}%`
        );

        // ========== SEMANTIC DECISION LOGIC ==========

        // CASE A: Confident Semantic Match
        if (topScore >= config.semanticHighThreshold && scoreGap >= config.semanticGapThreshold) {
          debugLogger.log('Ingredient Matching', `[${index}] 🎯 CASE A: Confident semantic match (score: ${(topScore * 100).toFixed(1)}% ≥ ${(config.semanticHighThreshold * 100).toFixed(0)}%, gap: ${(scoreGap * 100).toFixed(1)}% ≥ ${(config.semanticGapThreshold * 100).toFixed(0)}%)`);

          const topCandidate = candidates[0];

          if (topCandidate.source === 'canon') {
            // Update existing Canon item with synonym
            debugLogger.log('Ingredient Matching', `[${index}] Matched to existing Canon item: "${topCandidate.name}"`);
            
            const canonItem = topCandidate.item as CanonicalItem;
            const normalizedIngredient = parsed.ingredientName.toLowerCase();
            if (
              normalizedIngredient !== canonItem.normalisedName &&
              (!canonItem.synonyms || !canonItem.synonyms.some(s => s.toLowerCase() === normalizedIngredient))
            ) {
              debugLogger.log('Ingredient Matching', `[${index}] Adding "${parsed.ingredientName}" as synonym`);
              const updatedSynonyms = [...(canonItem.synonyms || []), parsed.ingredientName];
              await this.updateCanonicalItem(canonItem.id, { synonyms: updatedSynonyms });
            }

            results[index].canonicalItemId = canonItem.id;
            results[index].matchingAudit = {
              stage: 'semantic',
              decisionAction: 'use_existing_canon',
              decisionSource: 'rule',
              candidateId: canonItem.id,
              matchedSource: 'canon',
              topScore,
              scoreGap,
              reason: 'semantic-high-confidence-clear-gap',
              recordedAt: new Date().toISOString(),
            };
          } else {
            // Create new Canon item from CoFID
            debugLogger.log('Ingredient Matching', `[${index}] Creating new Canon item from CoFID: "${topCandidate.name}"`);
            
            const auditTrail = this.buildAuditTrail({
              stage: 'semantic_analysis',
              decisionAction: 'create_from_cofid',
              decisionSource: 'algorithm',
              matchedSource: 'cofid',
              originalQuery: parsed.ingredientName,
              selectedCandidate: topCandidate,
              allCandidates: candidates,
              reason: 'semantic-high-confidence-clear-gap',
            });
            
            const newCanonItem = await this.createCanonicalItemFromCofid(topCandidate.item, auditTrail, parsed.ingredientName);
            results[index].canonicalItemId = newCanonItem.id;
            results[index].matchingAudit = {
              stage: 'semantic',
              decisionAction: 'create_from_cofid',
              decisionSource: 'rule',
              candidateId: topCandidate.id,
              matchedSource: 'cofid',
              topScore,
              scoreGap,
              reason: 'semantic-high-confidence-clear-gap',
              recordedAt: new Date().toISOString(),
            };
          }
        }
        // CASE B: Ambiguous Cluster
        else if (topScore >= config.semanticHighThreshold) {
          // Check if there's a cluster of similar scores
          const cluster = candidates.filter(c => topScore - c.score <= config.semanticClusterWindow);
          
          if (cluster.length > 1) {
            debugLogger.log(
              'Ingredient Matching',
              `[${index}] 🤔 CASE B: Ambiguous cluster (${cluster.length} candidates within ${(config.semanticClusterWindow * 100).toFixed(0)}% of top score)`
            );
            debugLogger.log('Ingredient Matching', `[${index}] → LLM arbitration required`);

            // LLM arbitration
            const decision = await this.arbitrateSemanticMatch(parsed.ingredientName, cluster, config);
            await this.applyArbitrationDecision(index, parsed, decision, results, cluster);
          } else {
            // High score but clear winner (treat as Case A)
            debugLogger.log('Ingredient Matching', `[${index}] 🎯 High score with clear winner, treating as Case A`);
            
            const topCandidate = candidates[0];
            if (topCandidate.source === 'canon') {
              const canonItem = topCandidate.item as CanonicalItem;
              results[index].canonicalItemId = canonItem.id;
              results[index].matchingAudit = {
                stage: 'semantic',
                decisionAction: 'use_existing_canon',
                decisionSource: 'rule',
                candidateId: canonItem.id,
                matchedSource: 'canon',
                topScore,
                scoreGap,
                reason: 'semantic-high-confidence-single-winner',
                recordedAt: new Date().toISOString(),
              };
            } else {
              const auditTrail = this.buildAuditTrail({
                stage: 'semantic_analysis',
                decisionAction: 'create_from_cofid',
                decisionSource: 'algorithm',
                matchedSource: 'cofid',
                originalQuery: parsed.ingredientName,
                selectedCandidate: topCandidate,
                allCandidates: candidates,
                reason: 'semantic-high-confidence-single-winner',
              });
              
              const newCanonItem = await this.createCanonicalItemFromCofid(topCandidate.item, auditTrail, parsed.ingredientName);
              results[index].canonicalItemId = newCanonItem.id;
              results[index].matchingAudit = {
                stage: 'semantic',
                decisionAction: 'create_from_cofid',
                decisionSource: 'rule',
                candidateId: topCandidate.id,
                matchedSource: 'cofid',
                topScore,
                scoreGap,
                reason: 'semantic-high-confidence-single-winner',
                recordedAt: new Date().toISOString(),
              };
            }
          }
        }
        // CASE C: Weak Semantic Match
        else if (topScore >= config.semanticLowThreshold) {
          debugLogger.log(
            'Ingredient Matching',
            `[${index}] 💭 CASE C: Weak semantic match (score: ${(topScore * 100).toFixed(1)}% in range [${(config.semanticLowThreshold * 100).toFixed(0)}%, ${(config.semanticHighThreshold * 100).toFixed(0)}%])`
          );
          debugLogger.log('Ingredient Matching', `[${index}] → LLM arbitration required`);

          // LLM arbitration
          const decision = await this.arbitrateSemanticMatch(parsed.ingredientName, candidates, config);
          await this.applyArbitrationDecision(index, parsed, decision, results, candidates);
        }
        // No semantic match
        else {
          debugLogger.log(
            'Ingredient Matching',
            `[${index}] ❌ No semantic match (score: ${(topScore * 100).toFixed(1)}% < ${(config.semanticLowThreshold * 100).toFixed(0)}%)`
          );
          
          if (config.allowNewCanonItems) {
            debugLogger.log('Ingredient Matching', `[${index}] → Creating new Canon item via AI enrichment`);
            // Pass the embedding through for reuse in aisle pre-filtering
            await this.createNewCanonItemViaAI(index, parsed, results, candidates, results[index].embedding);
            results[index].matchingAudit = {
              stage: 'semantic',
              decisionAction: 'create_new_canon',
              decisionSource: 'rule',
              matchedSource: 'new-canon',
              topScore,
              scoreGap,
              reason: 'semantic-below-low-threshold-create-new',
              recordedAt: new Date().toISOString(),
            };
          } else {
            debugLogger.log('Ingredient Matching', `[${index}] ⚠️  New Canon items disabled, leaving unlinked`);
            results[index].matchingAudit = {
              stage: 'semantic',
              decisionAction: 'no_match',
              decisionSource: 'rule',
              matchedSource: 'unlinked',
              topScore,
              scoreGap,
              reason: 'semantic-below-low-threshold-no-create',
              recordedAt: new Date().toISOString(),
            };
          }
        }

        // Report progress on semantic processing
        const processedCount = pendingSemanticSearch.indexOf({ index, parsed } as any) + 1;
        const semanticProgress = Math.round(33 + (processedCount / pendingSemanticSearch.length) * 33);
        onProgress?.({ 
          stage: `Processing ingredient ${index + 1}/${ingredients.length}`,
          current: results.filter(r => r.canonicalItemId).length,
          total: ingredients.length, 
          percentage: semanticProgress 
        });
      }

      debugLogger.log('Ingredient Matching', `└── Stage 2 & 3 complete ──┘`);
    }

    // ========== MATCHING SUMMARY ==========
    const linkedCount = results.filter(r => r.canonicalItemId).length;
    debugLogger.log('Ingredient Matching', `━━━━━ Final result: ${linkedCount}/${results.length} ingredients linked ━━━━━`);
    
    // Generate neat summary table
    const summaryLines: string[] = [];
    summaryLines.push('\n┌─────────────────────────────────────────────────────────────────────────┐');
    summaryLines.push('│                      INGREDIENT MATCHING SUMMARY                        │');
    summaryLines.push('├─────────────────────────────────────────────────────────────────────────┤');
    
    const matchedExisting: string[] = [];
    const newFromCofid: string[] = [];
    const newAiGenerated: string[] = [];
    const unlinked: string[] = [];
    
    for (const result of results) {
      const itemName = result.ingredientName;
      const audit = result.matchingAudit;
      
      if (!result.canonicalItemId || !audit) {
        unlinked.push(itemName);
      } else if (audit.matchedSource === 'canon') {
        matchedExisting.push(itemName);
      } else if (audit.matchedSource === 'cofid' || audit.decisionAction === 'create_from_cofid') {
        newFromCofid.push(itemName);
      } else if (audit.matchedSource === 'new-canon' || audit.decisionAction === 'create_new_canon') {
        newAiGenerated.push(itemName);
      } else {
        unlinked.push(itemName);
      }
    }
    
    // Helper to truncate long names
    const truncate = (str: string, maxLen: number = 60): string => {
      return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
    };
    
    if (matchedExisting.length > 0) {
      summaryLines.push(`│ ✓ Matched to existing Canon items (${matchedExisting.length}):`.padEnd(74) + '│');
      matchedExisting.forEach(name => {
        const line = `│   • ${truncate(name)}`;
        summaryLines.push(line.padEnd(74) + '│');
      });
    }
    
    if (newFromCofid.length > 0) {
      summaryLines.push(`│ + Created from CoFID database (${newFromCofid.length}):`.padEnd(74) + '│');
      newFromCofid.forEach(name => {
        const line = `│   • ${truncate(name)}`;
        summaryLines.push(line.padEnd(74) + '│');
      });
    }
    
    if (newAiGenerated.length > 0) {
      summaryLines.push(`│ ✨ AI-generated new Canon items (${newAiGenerated.length}):`.padEnd(74) + '│');
      newAiGenerated.forEach(name => {
        const line = `│   • ${truncate(name)}`;
        summaryLines.push(line.padEnd(74) + '│');
      });
    }
    
    if (unlinked.length > 0) {
      summaryLines.push(`│ ✗ Unlinked ingredients (${unlinked.length}):`.padEnd(74) + '│');
      unlinked.forEach(name => {
        const line = `│   • ${truncate(name)}`;
        summaryLines.push(line.padEnd(74) + '│');
      });
    }
    
    // Show message if nothing to display
    if (matchedExisting.length === 0 && newFromCofid.length === 0 && 
        newAiGenerated.length === 0 && unlinked.length === 0) {
      summaryLines.push('│ (No ingredients processed)                                              │');
    }
    
    summaryLines.push('└─────────────────────────────────────────────────────────────────────────┘');
    
    // Log the complete summary
    summaryLines.forEach(line => debugLogger.info('Matching Summary', line));
    
    // ========== PERSIST MATCHING EVENTS (Issue #79) ==========
    // Create matching event log entries for each processed ingredient
    await this.createMatchingEventsFromResults(runId, contextId, ingredients as string[], results, startTime);
    
    // ========== SET VERSIONING METADATA ==========
    // Add parser and matching version metadata to all ingredients
    const now = new Date().toISOString();
    const enhancedResults = results.map(ing => {
      // Parse to get identity key
      const enhanced = this.parseIngredientEnhanced(ing.raw, this.cachedUnits!);
      const identityKey = this.buildIdentityKey(enhanced.item, enhanced.qualifiers);
      
      return {
        ...ing,
        parserVersion: BaseCanonBackend.PARSER_VERSION,
        parserIdentityKey: identityKey,
        parserUpdatedAt: now,
        matchingVersion: ing.canonicalItemId ? BaseCanonBackend.MATCHING_VERSION : undefined,
        matchedAt: ing.canonicalItemId ? now : undefined,
      };
    });
    
    onProgress?.({ stage: 'Complete', current: ingredients.length, total: ingredients.length, percentage: 100 });

    return enhancedResults;
  }

  /**
   * Create and persist matching event log entries from processed results
   * (Issue #79: Matching Observability)
   */
  private async createMatchingEventsFromResults(
    runId: string,
    contextId: string,
    rawIngredients: string[],
    results: RecipeIngredient[],
    startTime: number
  ): Promise<void> {
    try {
      
      const events = results.map((result, index) => {
        const raw = rawIngredients[index] || '';
        const audit = result.matchingAudit;
        
        // Determine outcome from matchingAudit
        let outcome: 'matched_existing' | 'created_from_cofid' | 'ai_generated' | 'unlinked' = 'unlinked';
        if (audit?.matchedSource === 'canon') {
          outcome = 'matched_existing';
        } else if (audit?.matchedSource === 'cofid' || audit?.decisionAction === 'create_from_cofid') {
          outcome = 'created_from_cofid';
        } else if (audit?.matchedSource === 'new-canon' || audit?.decisionAction === 'create_new_canon') {
          outcome = 'ai_generated';
        }
        
        // Get canonical item name if linked
        let canonicalItemName: string | null = null;
        if (result.canonicalItemId) {
          // We don't have the item name readily available, will need to fetch or pass it
          // For now, use the ingredient name as a fallback
          canonicalItemName = result.ingredientName;
        }
        
        // Build the matching event
        const baseEvent = {
          runId,
          recipeId: contextId,
          recipeName: contextId,
          ingredientIndex: index,
          ingredientName: result.ingredientName,
          raw,
          timestamp: new Date().toISOString(),
          
          // Parsing stage
          parsing: {
            quantity: result.quantity,
            unit: result.unit,
            item: result.ingredientName,
            qualifiers: result.qualifiers || [],
            preparation: result.preparation || null,
          },
          
          // Final outcome
          outcome,
          canonicalItemId: result.canonicalItemId || null,
          canonicalItemName,
          durationMs: Date.now() - startTime, // Total processing time (not per-ingredient in Phase 1)
        };
        
        // Conditionally add optional stages (record data when available, not based on final stage name)
        const event: any = baseEvent;
        
        // Fuzzy matching (record if stage was fuzzy or if we have fuzzy-specific data)
        // In Phase 1 we don't explicitly track fuzzy scores, so only record if stage is fuzzy
        if (audit?.stage === 'fuzzy') {
          event.fuzzy = {
            matched: true,
            matchedTo: canonicalItemName,
            matchedToId: result.canonicalItemId || null,
            score: audit.topScore || null,
          };
        }
        
        // Semantic search (record if topScore/scoreGap exist in audit AND stage was semantic or arbitration)
        // Exclude fuzzy stage to prevent fuzzy scores from being displayed as semantic data
        if ((audit?.topScore !== undefined || audit?.scoreGap !== undefined) && audit?.stage !== 'fuzzy') {
          event.semantic = {
            topCandidateName: canonicalItemName,
            topCandidateSource: audit.matchedSource === 'canon' ? 'canon' : audit.matchedSource === 'cofid' ? 'cofid' : null,
            topScore: audit.topScore || null,
            scoreGap: audit.scoreGap || null,
            candidateCount: 0, // Not tracked in Phase 1
            case: 'A_confident' as const, // Simplified for Phase 1
          };
        }
        
        // Arbitration (record if final stage was arbitration, LLM or fallback)
        // This captures the arbitration decision regardless of prior stages
        if (audit?.stage === 'arbitration' && (audit.decisionSource === 'llm' || audit.decisionSource === 'fallback')) {
          event.arbitration = {
            needed: true,
            decision: audit.decisionAction || null,
            confidence: null, // Not exposed in current audit
            reason: audit.reason || null,
            decisionSource: audit.decisionSource,
          };
        }
        
        return event;
      
      });
      
      // Persist all events (fire-and-forget to avoid slowing down recipe processing)
      // In production, consider batch writes or background job
      await Promise.all(events.map(event => this.createMatchingEvent(event)));
      
      debugLogger.log('Matching Events', `Persisted ${events.length} matching events for run ${runId}`);
    } catch (error) {
      // Don't fail the entire ingredient processing if event logging fails
      debugLogger.error('Matching Events', 'Failed to persist matching events:', error instanceof Error ? error.message : String(error));
    }
  }

  private async arbitrateSemanticMatch(
    ingredientName: string,
    candidates: IngredientSemanticCandidate[],
    config: IngredientMatchingConfig
  ): Promise<ArbitrationDecision> {
    const trimmed = candidates
      .slice(0, Math.max(1, config.semanticCandidateCount))
      .sort((a, b) => b.score - a.score);

    const candidateMap = new Map(trimmed.map((c) => [c.id, c]));
    const topCanon = trimmed.find((c) => c.source === 'canon');
    const topCofid = trimmed.find((c) => c.source === 'cofid');
    const canonBias = config.llmBiasForExistingCanon ?? 0;

    // Deterministic fallback preference to keep behaviour stable when LLM output is invalid.
    const fallback = this.selectFallbackArbitrationDecision(trimmed, config);

    const instruction = await this.getSystemInstruction(
      'You are the Head Chef arbitration layer for ingredient-to-catalogue matching.'
    );

    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Choose the best matching outcome for one ingredient.

INGREDIENT: ${ingredientName}

CANDIDATES:
${trimmed.map((c, i) => `${i + 1}. id=${c.id} | name=${c.name} | source=${c.source} | score=${c.score.toFixed(4)}`).join('\n')}

CONFIG:
${JSON.stringify({
  llmBiasForExistingCanon: config.llmBiasForExistingCanon,
  allowNewCanonItems: config.allowNewCanonItems,
})}

CRITICAL UK SUPERMARKET PRODUCT DIFFERENTIATION RULES:
- Items are DIFFERENT if they would be sold separately in a UK supermarket, regardless of nutritional similarity.
- Olive oil and extra virgin olive oil are DIFFERENT items (different price, quality, use case).
- Different cheese varieties are DIFFERENT items even if nutritional profiles are similar (Red Leicester ≠ Cheddar).
- Raw vs cooked/precooked items are DIFFERENT (baking potato ≠ baked potato; raw chicken ≠ cooked chicken).
- Cooked items typically weigh less than raw equivalents due to moisture loss - this matters for recipe accuracy.
- Only use precooked/baked candidates if the ingredient clearly indicates the item is already cooked.
- Temperature/state descriptors (fridge-cold, room temperature) do NOT make items different if they're the same product.
- Brands, varieties, and culinary types (smoked, salted, aged) DO make items different.

MATCHING RULES:
- Prefer existing Canon candidates where fit is close AND product identity matches.
- Use CoFID when clearly a stronger fit OR when Canon candidate is wrong product type.
- If nothing is suitable and allowNewCanonItems is true, choose create_new_canon.
- Use no_match only if confidence is too poor.
- candidateId MUST be one of: [${trimmed.map((c) => c.id).join(', ')}]
- If action is use_existing_canon, candidateId must refer to a canon candidate.
- If action is create_from_cofid, candidateId must refer to a cofid candidate.

Return JSON only:
{
  "action": "use_existing_canon" | "create_from_cofid" | "create_new_canon" | "no_match",
  "candidateId": "candidate id when action selects candidate",
  "confidence": 0.0,
  "reason": "short reason"
}`,
        }],
      }],
      config: {
        systemInstruction: instruction,
        responseMimeType: 'application/json',
      },
    });

    try {
      const parsed = JSON.parse(this.sanitizeJson(response.text || '{}')) as ArbitrationDecision;
      if (!parsed.action) {
        throw new Error('Arbitration result missing action');
      }

      const action = parsed.action;
      const needsCandidate = action === 'use_existing_canon' || action === 'create_from_cofid';
      if (needsCandidate && !parsed.candidateId) {
        throw new Error(`Arbitration action ${action} missing candidateId`);
      }

      if (parsed.candidateId) {
        const selected = candidateMap.get(parsed.candidateId);
        if (!selected) {
          throw new Error(`Arbitration candidateId not in provided candidates: ${parsed.candidateId}`);
        }
        if (action === 'use_existing_canon' && selected.source !== 'canon') {
          throw new Error(`Arbitration candidate/source mismatch: expected canon for ${parsed.candidateId}`);
        }
        if (action === 'create_from_cofid' && selected.source !== 'cofid') {
          throw new Error(`Arbitration candidate/source mismatch: expected cofid for ${parsed.candidateId}`);
        }
      }

      debugLogger.log('Ingredient Matching', '[Arbitration] LLM decision accepted', {
        ingredientName,
        action,
        candidateId: parsed.candidateId,
        confidence: parsed.confidence,
        reason: parsed.reason,
        candidateCount: trimmed.length,
        topCanonScore: topCanon?.score,
        topCofidScore: topCofid?.score,
        canonBias,
      });

      return {
        ...parsed,
        decisionSource: 'llm',
      };
    } catch (error) {
      debugLogger.warn('Ingredient Matching', '[Arbitration] Invalid LLM decision, applying fallback', {
        ingredientName,
        error,
        rawResponse: response.text,
        fallback,
        candidateCount: trimmed.length,
      });

      return {
        ...fallback,
        decisionSource: 'fallback',
      };
    }
  }

  private async applyArbitrationDecision(
    index: number,
    parsed: Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'>,
    decision: ArbitrationDecision,
    results: RecipeIngredient[],
    candidates: IngredientSemanticCandidate[]
  ): Promise<void> {
    debugLogger.log('Ingredient Matching', `[${index}] Arbitration decision`, {
      ingredientName: parsed.ingredientName,
      action: decision.action,
      candidateId: decision.candidateId,
      confidence: decision.confidence,
      reason: decision.reason,
      decisionSource: decision.decisionSource,
    });

    if (decision.action === 'use_existing_canon' && decision.candidateId) {
      const selected = candidates.find((c) => c.id === decision.candidateId && c.source === 'canon');
      if (!selected) {
        debugLogger.warn('Ingredient Matching', `[${index}] Arbitration selected missing canon candidate`, {
          candidateId: decision.candidateId,
        });
        return;
      }

      const canonItem = selected.item as CanonicalItem;
      const normalizedIngredient = parsed.ingredientName.toLowerCase();
      if (
        normalizedIngredient !== canonItem.normalisedName &&
        (!canonItem.synonyms || !canonItem.synonyms.some((s) => s.toLowerCase() === normalizedIngredient))
      ) {
        await this.updateCanonicalItem(canonItem.id, { synonyms: [...(canonItem.synonyms || []), parsed.ingredientName] });
      }
      results[index].canonicalItemId = canonItem.id;
      results[index].matchingAudit = {
        stage: 'arbitration',
        decisionAction: 'use_existing_canon',
        decisionSource: decision.decisionSource || 'llm',
        candidateId: canonItem.id,
        matchedSource: 'canon',
        topScore: selected.score,
        reason: decision.reason,
        recordedAt: new Date().toISOString(),
      };
      return;
    }

    if (decision.action === 'create_from_cofid' && decision.candidateId) {
      const selected = candidates.find((c) => c.id === decision.candidateId && c.source === 'cofid');
      if (!selected) {
        debugLogger.warn('Ingredient Matching', `[${index}] Arbitration selected missing cofid candidate`, {
          candidateId: decision.candidateId,
        });
        return;
      }
      
      const auditTrail = this.buildAuditTrail({
        stage: 'llm_arbitration',
        decisionAction: 'create_from_cofid',
        decisionSource: decision.decisionSource === 'fallback' ? 'algorithm' : 'llm',
        matchedSource: 'cofid',
        originalQuery: parsed.ingredientName,
        selectedCandidate: selected,
        allCandidates: candidates,
        reason: decision.reason || 'LLM arbitration selected CoFID candidate',
      });
      
      const created = await this.createCanonicalItemFromCofid(selected.item, auditTrail, parsed.ingredientName);
      results[index].canonicalItemId = created.id;
      results[index].matchingAudit = {
        stage: 'arbitration',
        decisionAction: 'create_from_cofid',
        decisionSource: decision.decisionSource || 'llm',
        candidateId: decision.candidateId,
        matchedSource: 'cofid',
        topScore: selected.score,
        reason: decision.reason,
        recordedAt: new Date().toISOString(),
      };
      return;
    }

    if (decision.action === 'create_new_canon') {
      // Pass the embedding through for reuse in aisle pre-filtering
      await this.createNewCanonItemViaAI(index, parsed, results, candidates, results[index].embedding);
      results[index].matchingAudit = {
        stage: 'arbitration',
        decisionAction: 'create_new_canon',
        decisionSource: decision.decisionSource || 'llm',
        matchedSource: 'new-canon',
        reason: decision.reason,
        recordedAt: new Date().toISOString(),
      };
      return;
    }

    results[index].matchingAudit = {
      stage: 'arbitration',
      decisionAction: 'no_match',
      decisionSource: decision.decisionSource || 'llm',
      matchedSource: 'unlinked',
      reason: decision.reason || 'arbitration-no-match',
      recordedAt: new Date().toISOString(),
    };
    debugLogger.log('Ingredient Matching', `[${index}] Arbitration chose no_match; ingredient left unlinked`);
  }

  private async createNewCanonItemViaAI(
    index: number,
    parsed: Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'>,
    results: RecipeIngredient[],
    candidates?: IngredientSemanticCandidate[],
    queryEmbedding?: number[]
  ): Promise<void> {
    try {
      // Pass embedding through to avoid regenerating it in enrichCanonicalItem
      const enriched = await this.enrichCanonicalItem(parsed.ingredientName, queryEmbedding);
      const aisles = await this.getAisles();
      const aisleName = enriched.aisle || 'Other';

      if (!aisles.some((a) => a.name.toLowerCase() === aisleName.toLowerCase())) {
        await this.createAisle({ name: aisleName, sortOrder: aisles.length + 1 });
      }

      // Ensure parsed ingredient is in synonyms
      let synonyms: string[] = enriched.synonyms || [];
      const normalized = parsed.ingredientName.toLowerCase();
      if (!synonyms.some(s => s.toLowerCase() === normalized)) {
        synonyms = [...synonyms, parsed.ingredientName];
      }

      // Build audit trail with near misses
      const auditTrail = this.buildAuditTrail({
        stage: 'semantic_analysis',
        decisionAction: 'create_new_canon',
        decisionSource: 'algorithm',
        matchedSource: 'new-canon',
        originalQuery: parsed.ingredientName,
        selectedCandidate: null,
        allCandidates: candidates || [],
        reason: 'No suitable matches found, creating new item via AI enrichment',
      });

      const created = await this.createCanonicalItem({
        name: enriched.name,
        normalisedName: enriched.name.toLowerCase(),
        aisle: aisleName,
        preferredUnit: enriched.preferredUnit || '',
        isStaple: enriched.isStaple,
        synonyms,
        approved: false,
        matchingAudit: auditTrail,
      });

      results[index].canonicalItemId = created.id;
      debugLogger.log('Ingredient Matching', `[${index}] Created new Canon item via AI: ${created.name}`);
    } catch (error) {
      debugLogger.warn('Ingredient Matching', `[${index}] Failed to create new Canon item via AI`, error);
    }
  }

  private selectFallbackArbitrationDecision(
    candidates: IngredientSemanticCandidate[],
    config: IngredientMatchingConfig
  ): ArbitrationDecision {
    if (candidates.length === 0) {
      return {
        action: config.allowNewCanonItems ? 'create_new_canon' : 'no_match',
        reason: 'fallback-no-candidates',
      };
    }

    const topCanon = candidates.find((c) => c.source === 'canon');
    const topCofid = candidates.find((c) => c.source === 'cofid');
    const bias = config.llmBiasForExistingCanon ?? 0;

    if (topCanon && topCofid) {
      if (topCanon.score + bias >= topCofid.score) {
        return {
          action: 'use_existing_canon',
          candidateId: topCanon.id,
          confidence: topCanon.score,
          reason: 'fallback-bias-existing-canon',
        };
      }

      return {
        action: 'create_from_cofid',
        candidateId: topCofid.id,
        confidence: topCofid.score,
        reason: 'fallback-top-cofid',
      };
    }

    if (topCanon) {
      return {
        action: 'use_existing_canon',
        candidateId: topCanon.id,
        confidence: topCanon.score,
        reason: 'fallback-top-canon',
      };
    }

    if (topCofid) {
      return {
        action: 'create_from_cofid',
        candidateId: topCofid.id,
        confidence: topCofid.score,
        reason: 'fallback-top-cofid',
      };
    }

    return {
      action: config.allowNewCanonItems ? 'create_new_canon' : 'no_match',
      reason: 'fallback-unresolvable',
    };
  }
  /**
   * Build audit trail for canonical item creation/matching
   * Captures decision metadata and near misses for transparency
   */
  private buildAuditTrail(params: {
    stage: NonNullable<CanonicalItem['matchingAudit']>['stage'];
    decisionAction: NonNullable<CanonicalItem['matchingAudit']>['decisionAction'];
    decisionSource: NonNullable<CanonicalItem['matchingAudit']>['decisionSource'];
    matchedSource: NonNullable<CanonicalItem['matchingAudit']>['matchedSource'];
    originalQuery: string;
    selectedCandidate: IngredientSemanticCandidate | null;
    allCandidates: IngredientSemanticCandidate[];
    reason: string;
  }): NonNullable<CanonicalItem['matchingAudit']> {
    const { stage, decisionAction, decisionSource, matchedSource, originalQuery, selectedCandidate, allCandidates, reason } = params;

    // Calculate scores
    const topScore = allCandidates.length > 0 ? allCandidates[0].score : undefined;
    const secondScore = allCandidates.length > 1 ? allCandidates[1].score : undefined;
    const scoreGap = topScore !== undefined && secondScore !== undefined ? topScore - secondScore : undefined;

    // Build near misses array (exclude the selected candidate, include rest)
    const nearMisses = allCandidates
      .filter(c => !selectedCandidate || c.id !== selectedCandidate.id)
      .slice(0, 5) // Keep top 5 near misses for audit
      .map(c => ({
        candidateId: c.id,
        candidateName: c.name,
        source: c.source,
        score: c.score,
        reason: c.id === allCandidates[0]?.id && !selectedCandidate
          ? 'Top candidate but not selected'
          : `Score: ${(c.score * 100).toFixed(1)}%`,
      }));

    // Detailed audit trail logging
    debugLogger.log('Ingredient Matching', `\n📋 AUDIT TRAIL: "${originalQuery}"`);
    debugLogger.log('Ingredient Matching', `  Stage: ${stage}`);
    debugLogger.log('Ingredient Matching', `  Decision: ${decisionAction} (${decisionSource})`);
    debugLogger.log('Ingredient Matching', `  Source: ${matchedSource}`);
    if (selectedCandidate) {
      debugLogger.log('Ingredient Matching', `  ✅ Selected: ${selectedCandidate.name} (${selectedCandidate.source}, score: ${(selectedCandidate.score * 100).toFixed(1)}%)`);
    }
    debugLogger.log('Ingredient Matching', `  Top Score: ${topScore ? (topScore * 100).toFixed(1) + '%' : 'N/A'}`);
    if (scoreGap !== undefined) {
      debugLogger.log('Ingredient Matching', `  Score Gap: ${(scoreGap * 100).toFixed(1)}%`);
    }
    if (nearMisses.length > 0) {
      debugLogger.log('Ingredient Matching', `  Near Misses (${nearMisses.length}):`);
      nearMisses.forEach((miss, i) => {
        debugLogger.log('Ingredient Matching', `    ${i + 1}. ${miss.candidateName} (${miss.source}, ${(miss.score * 100).toFixed(1)}%)`);
      });
    }
    debugLogger.log('Ingredient Matching', `  Reason: ${reason}\n`);

    // Firestore rejects undefined values — strip them from the audit object
    const audit: Record<string, unknown> = {
      stage,
      decisionAction,
      decisionSource,
      matchedSource,
      reason,
      recordedAt: new Date().toISOString(),
    };
    if (selectedCandidate?.id) audit.finalCandidateId = selectedCandidate.id;
    if (nearMisses.length > 0) audit.nearMisses = nearMisses;
    if (topScore !== undefined) audit.topScore = topScore;
    if (scoreGap !== undefined) audit.scoreGap = scoreGap;

    return audit as NonNullable<CanonicalItem['matchingAudit']>;
  }
  // ==================== HELPER METHODS ====================

  /**
   * Normalisation pass (Stage 1a)
   * Cleans unicode, standardises spacing and punctuation before parsing.
   */
  private normaliseIngredientString(raw: string): string {
    let text = raw
      // Unicode fraction handling: ½ → 1/2, ¼ → 1/4, etc.
      .replace(/½/g, '1/2')
      .replace(/¼/g, '1/4')
      .replace(/¾/g, '3/4')
      .replace(/⅓/g, '1/3')
      .replace(/⅔/g, '2/3')
      // Multiplication symbol: × → x
      .replace(/×/g, 'x')
      // Multiple spaces → single space
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
      .toLowerCase();

    return text;
  }

  /**
   * Preparation verb list (configurable, Stage 2)
   * Used to detect start of preparation phrases.
   */
  private getPreparationTerms(): Set<string> {
    return new Set([
      // Main verbs
      'chopped', 'diced', 'minced', 'sliced', 'crushed', 'grated',
      'peeled', 'trimmed', 'torn', 'drained', 'finely', 'coarsely',
      'roughly', 'thinly', 'thickly', 'cubed', 'shredded',
      'julienned', 'blanched', 'roasted', 'toasted', 'caramelised',
      'melted', 'whipped', 'beaten', 'whisked', 'folded', 'sifted',
      'strained', 'filtered', 'pressed', 'zested', 'deveined', 'pitted',
      'cored', 'deseeded', 'boned', 'flaked', 'crumbled',
      'scattered', 'dusted', 'rinsed', 'patted',
      'juiced', 'grated', 'shaved', 'slathered', 'smashed',
      'dissolved', 'pounded', 'soaked', 'strained', 'chilled',
      'warmed', 'heated', 'cooled',
      // Adverbs that modify prep verbs
      'very', 'lightly', 'heavily', 'just', 'left',
      // Connectors that signal continuation of same clause
      'and', 'then', 'but', 'or'
    ]);
  }

  /**
   * List of quality/descriptive adjectives for qualifiers
   */
  private getQualifierAdjectives(): Set<string> {
    return new Set([
      // Temperature/storage
      'fresh', 'dried', 'raw', 'cooked', 'prepared',
      'chilled', 'room-temperature',
      // Texture
      'soft', 'firm', 'hard', 'tender', 'tough', 'smooth', 'rough',
      'thick', 'thin', 'crisp', 'crumbly', 'creamy',
      // Size
      'small', 'big', 'large', 'medium', 'tiny', 'chunky',
      // Quality/provenance
      'good-quality', 'premium', 'unwaxed', 'organic', 'smoked',
      'extra', 'virgin', 'pure', 'unsalted', 'salted',
      // Flavour
      'mild', 'hot', 'spicy', 'sweet', 'salty', 'sharp', 'strong',
      'weak', 'light', 'dark', 'heavy', 'ripe', 'unripe',
      // Colour (basic)
      'red', 'green', 'yellow', 'white', 'black', 'brown', 'golden',
      // Culinary states
      'mature', 'young', 'whole', 'ground', 'flaked', 'shaved'
    ]);
  }

  /**
   * Match units with word boundaries (no substring matches) and support multi-word units
   * Returns longest matching unit first to handle "heaped tsp" before "tsp"
   */
  private extractUnitAndRemainder(
    text: string,
    unitNames: string[]
  ): { unit: string | null; remainder: string } {
    // Sort by length descending (match longest units first: "heaped tsp" before "tsp")
    const sortedUnits = [...unitNames].sort((a, b) => b.length - a.length);

    for (const unit of sortedUnits) {
      // Use word boundary regex: unit must be complete word(s)
      const regex = new RegExp(`^(.*)\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*(.*)$`, 'i');
      const match = text.match(regex);
      if (match) {
        const before = match[1].trim();
        const after = match[2].trim();
        // Only accept if unit appears after a quantity or article
        if (before && /\d|a|an|the|some|one|two|three|four|five|six|seven|eight|nine|ten$/.test(before)) {
          return { unit: unit.toLowerCase(), remainder: after };
        }
      }
    }

    return { unit: null, remainder: text };
  }

  /**
   * Extract multi-word preparation phrases
   * Examples: "finely chopped", "deseeded and sliced", "dissolved in warm water"
   */
  private extractPreparationPhrase(text: string): { prep: string | null; remainder: string } {
    const prepTerms = this.getPreparationTerms();
    const tokens = text.split(/\s+/);

    for (let i = 0; i < tokens.length; i++) {
      if (prepTerms.has(tokens[i])) {
        // Found start of prep; take everything from here to end
        const prep = tokens.slice(i).join(' ').trim();
        const remainder = tokens.slice(0, i).join(' ').trim();
        return { prep: prep || null, remainder };
      }
    }

    return { prep: null, remainder: text };
  }

  /**
   * Detect and handle special patterns: "juice of X", "zest of X"
   */
  private extractJuiceOrZest(text: string): { prep: string | null; item: string | null; remainder: string } {
    const juiceMatch = text.match(/^(juice\s+of\s+)(.+)$/i);
    if (juiceMatch) {
      return { prep: 'juiced', item: juiceMatch[2].trim(), remainder: '' };
    }

    const zestMatch = text.match(/^(zest\s+of\s+)(.+)$/i);
    if (zestMatch) {
      return { prep: 'zested', item: zestMatch[2].trim(), remainder: '' };
    }

    return { prep: null, item: null, remainder: text };
  }

  /**
   * Parse raw ingredient (Stage 1 & 2: Regex upgrade + Second-pass classifier)
   * Produces rich internal model: quantity, unit, item, qualifiers[], preparation.
   * @param raw Raw ingredient string
   * @param units List of Unit objects from Firestore (uses unit.name for regex pattern)
   */
  private parseIngredientEnhanced(raw: string, units: Unit[]): ParsedIngredientInternal {
    let text = this.normaliseIngredientString(raw);

    // ===== STAGE 1: Quantity + Unit extraction (with word boundaries) =====
    // Use provided units or fallback to comprehensive British cooking units
    const unitNames = units.length > 0 
      ? units.flatMap(u => [u.name, u.plural].filter((n) => n !== null && n !== undefined))
      : [
          // Weight
          'g', 'kg', 'mg',
          // Volume
          'ml', 'l', 'tsp', 'tsps', 'tbsp', 'tbsps',
          // Count
          'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces', 'stick', 'sticks',
          'tin', 'tins', 'can', 'cans', 'jar', 'jars', 'pack', 'packs',
          'packet', 'packets', 'bag', 'bags', 'bunch', 'head', 'fillet', 'fillets',
          'rasher', 'rashers', 'block', 'pot', 'tray', 'punnet',
          // Colloquial units (new)
          'pinch', 'dash', 'splash', 'glug', 'twist', 'grating', 'handful', 'handfuls',
          'thumb-sized', 'sprig', 'sprigs', 'knob', 'sheet', 'sheets',
          'heaped-tsp', 'level-tsp', 'heaped-tbsp', 'level-tbsp',
          'ball', 'round', 'joint', 'rib', 'ribs', 'cube'
        ];

    let quantityRaw: string | null = null;
    let quantityValue: number | null = null;
    let unit: string | null = null;
    let hasExplicitQuantity = false;

    // Try to extract quantity + unit
    const quantityPatterns = [
      /^(\d+\s+\d+\/\d+|\d+\s*-\s*\d+|\d+\s*x\s*\d+\.?\d*|\d+\.?\d*|\d+\s*\/\s*\d+)\s+(.+)$/, // quantity first
      /^(a|an|some|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/ // articles
    ];

    let match = text.match(quantityPatterns[0]);
    if (match) {
      const qtyStr = match[1].trim();
      text = match[2].trim();
      quantityValue = this.parseQuantity(qtyStr);
      quantityRaw = qtyStr;
      hasExplicitQuantity = true;

      // Try to extract unit from remainder
      const unitMatch = this.extractUnitAndRemainder(text, unitNames);
      if (unitMatch.unit) {
        unit = unitMatch.unit;
        text = unitMatch.remainder;
      }
    } else if ((match = text.match(quantityPatterns[1]))) {
      // Handle articles: "a splash of soy sauce" → quantity=1, unit=splash, item=soy sauce
      const article = match[1].toLowerCase();
      text = match[2].trim();
      // Articles implicitly mean quantity 1
      quantityValue = article === 'some' ? 1 : 1;
      quantityRaw = article;
      hasExplicitQuantity = false;

      // Try to extract unit
      const unitMatch = this.extractUnitAndRemainder(text, unitNames);
      if (unitMatch.unit) {
        unit = unitMatch.unit;
        text = unitMatch.remainder;
        // If we matched a unit (e.g., "a splash of"), check for "of" pattern
        if (text.match(/^of\s+/i)) {
          text = text.replace(/^of\s+/i, '').trim();
        }
      }
    }

    // ===== STAGE 2: Second-pass classifier (item + qualifiers + preparation) =====
    let qualifiers: string[] = [];
    let preparation: string | null = null;

    // Check for juice/zest patterns first (these override normal parsing)
    const juiceZestMatch = this.extractJuiceOrZest(text);
    if (juiceZestMatch.prep) {
      preparation = juiceZestMatch.prep;
      if (juiceZestMatch.item) {
        text = juiceZestMatch.item;
      }
    }

    // Extract parenthetical notes (treat as qualifiers)
    const parenRegex = /\(([^)]+)\)/g;
    let parenMatch;
    while ((parenMatch = parenRegex.exec(text)) !== null) {
      qualifiers.push(parenMatch[1].trim());
      text = text.replace(`(${parenMatch[1]})`, '').trim();
    }

    // ===== COMMA-BASED PREP DETECTION =====
    // If comma present, split: left = item+qualifiers, right = preparation
    const commaIdx = text.indexOf(',');
    if (commaIdx !== -1) {
      const beforeComma = text.substring(0, commaIdx).trim();
      const afterComma = text.substring(commaIdx + 1).trim();
      text = beforeComma;
      if (afterComma) {
        preparation = preparation ? `${preparation}, ${afterComma}` : afterComma;
      }
    }

    // ===== MULTI-TOKEN PREPARATION PHRASE EXTRACTION =====
    // Extract preparation from remaining text (e.g., "finely chopped", "deseeded and sliced")
    const prepMatch = this.extractPreparationPhrase(text);
    if (prepMatch.prep) {
      text = prepMatch.remainder;
      preparation = preparation ? `${preparation} ${prepMatch.prep}` : prepMatch.prep;
    }

    // ===== QUALIFIER EXTRACTION =====
    // Extract leading qualifiers (adjectives) from remaining text
    const qualifierAdj = this.getQualifierAdjectives();
    const tokens = text.split(/\s+/);
    let qualifierIdx = 0;

    for (let i = 0; i < tokens.length; i++) {
      if (qualifierAdj.has(tokens[i])) {
        // Accumulate consecutive qualifiers
        let j = i;
        const qualGroup: string[] = [];
        while (j < tokens.length && qualifierAdj.has(tokens[j])) {
          qualGroup.push(tokens[j]);
          j++;
        }
        qualifiers.push(qualGroup.join(' '));
        qualifierIdx = j;
        i = j - 1;
      } else {
        // Stop at first non-qualifier
        break;
      }
    }

    // ===== ITEM EXTRACTION =====
    // Everything remaining after qualifiers is the item
    const item = tokens.slice(qualifierIdx).join(' ').trim() || 'unknown';

    return {
      quantityRaw,
      quantityValue: quantityValue || (!hasExplicitQuantity && unit ? 1 : quantityValue),
      unit,
      item,
      qualifiers: qualifiers.length > 0 ? qualifiers : [],
      preparation: preparation || null,
    };
  }

  /**
   * Parse quantity string into numeric value.
   * Handles: "100", "4 x 240g", "2-3", "1/2", "1 1/2"
   */
  private parseQuantity(quantityStr: string): number | null {
    quantityStr = quantityStr.trim();

    // Mixed fraction first: "1 1/2" (must try before simple decimal which would match "1")
    const mixedMatch = quantityStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
      const whole = parseFloat(mixedMatch[1]);
      const numerator = parseFloat(mixedMatch[2]);
      const denominator = parseFloat(mixedMatch[3]);
      return whole + numerator / denominator;
    }

    // Multiplier pattern: "4 x 240g" or "4x240"
    const multiplierMatch = quantityStr.match(/^(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/);
    if (multiplierMatch) {
      const factor = parseFloat(multiplierMatch[1]);
      const base = parseFloat(multiplierMatch[2]);
      return factor * base;
    }

    // Range pattern: "2-3" → midpoint
    const rangeMatch = quantityStr.match(/^(\d+\.?\d*)\s*-\s*(\d+\.?\d*)$/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      return (min + max) / 2;
    }

    // Simple fraction: "1/2"
    const fractionMatch = quantityStr.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const numerator = parseFloat(fractionMatch[1]);
      const denominator = parseFloat(fractionMatch[2]);
      return numerator / denominator;
    }

    // Simple decimal: "100" or "100.5"
    const simpleMatch = quantityStr.match(/^(\d+\.?\d*)$/);
    if (simpleMatch) {
      return parseFloat(simpleMatch[1]);
    }

    return null;
  }

  /**
   * Convert string to Title Case for display (British English culinary context)
   * Preserves special cases like pH, CoFID acronyms
   */
  private toTitleCase(str: string): string {
    if (!str) return str;
    
    // Special cases that should not be capitalized
    const specialCases: { [key: string]: string } = {
      'ph': 'pH',
      'cofid': 'CoFID',
    };
    
    return str
      .split(' ')
      .map(word => {
        const lower = word.toLowerCase();
        if (specialCases[lower]) {
          return specialCases[lower];
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Backward compatibility wrapper: map internal parse to RecipeIngredient shape
   * (Stage 4: Persistence layer)
   * @param raw Raw ingredient string
   * @param units List of Unit objects from Firestore
   */
  protected parseIngredientString(raw: string, units: Unit[]): Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'> {
    const parsed = this.parseIngredientEnhanced(raw, units);

    const ingredientNameLower = parsed.qualifiers.length > 0
      ? `${parsed.qualifiers.join(' ')} ${parsed.item}`.trim()
      : parsed.item;

    const result = {
      quantity: parsed.quantityValue,
      unit: parsed.unit,
      // ingredientName: Title Case for display consistency with Canon items
      ingredientName: this.toTitleCase(ingredientNameLower),
      // Stage 4: persist qualifiers separately for enhanced matching and context
      qualifiers: parsed.qualifiers.length > 0 ? parsed.qualifiers : undefined,
      preparation: parsed.preparation || undefined,
    };

    // Log parsed ingredient for debugging
    void this.logParsedIngredientToDb(raw, result); // Fire and forget

    return result;
  }

  /**
   * Hook to log parsed ingredient data to database
   * Override in subclass to implement actual logging
   */
  protected logParsedIngredientToDb(
    raw: string,
    parsed: Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'>
  ): void | Promise<void> {
    // Base implementation: no-op. Firebase backend overrides to write to Firestore.
  }

  /**
   * Levenshtein distance for fuzzy string matching
   * Returns similarity score 0.0 - 1.0 (1.0 = exact match)
   */
  protected fuzzyMatch(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Batch resolve unmatched ingredient names via AI
   */
  private async resolveUnmatchedIngredients(ingredientNames: string[]): Promise<any[]> {
    if (ingredientNames.length === 0) return [];

    debugLogger.log('Ingredient Matching', `Calling AI to resolve: ${ingredientNames.join(', ')}`);

    const instruction = await this.getSystemInstruction(
      'You are the Head Chef resolving ingredient names to canonical items.'
    );

    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Resolve these recipe ingredients to canonical item catalogue entries. Return JSON array with one entry per ingredient.

INGREDIENTS TO RESOLVE:
${ingredientNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

For each ingredient, return:
{
  "name": "Canonical item name (title case)",
  "preferredUnit": "g|kg|ml|l| (empty string for countable items)",
  "aisle": "Produce|Meat & Fish|Dairy|Bakery|Pantry|Frozen|Other",
  "isStaple": true/false,
  "synonyms": ["alternate name 1", "alternate name 2"]
}

RULES:
- Use British English (courgette not zucchini, aubergine not eggplant)
- Use metric units only
- Leave preferredUnit empty for countable things (eggs, onions, cans)
- Keep culinary identity descriptors (red onion, beef mince, whole milk, extra virgin olive oil)
- Preserve cooking state (raw vs cooked/baked/roasted - these are different products)
- Preserve variety distinctions (Red Leicester ≠ Cheddar, rapeseed oil ≠ olive oil)
- Only indicate precooked/baked if explicitly stated in ingredient name
- Remove size adjectives (small, medium, large)
- Remove temperature/state descriptors (fridge-cold, room temperature) unless they define the product

Return JSON array: [item1, item2, ...]`
        }]
      }],
      config: {
        systemInstruction: instruction,
        responseMimeType: 'application/json',
      }
    });

    const sanitized = this.sanitizeJson(response.text || '[]');
    debugLogger.log('Ingredient Matching', `AI response received, parsing ${sanitized.length} chars`);

    const parsed = JSON.parse(sanitized);
    const result = Array.isArray(parsed) ? parsed : [];
    debugLogger.log('Ingredient Matching', `AI resolved to ${result.length} items: ${result.map((r: any) => r.name).join(', ')}`);
    return result;
  }

  /**
   * Extract JSON from AI response (strips markdown fences, preamble, etc.)
   */
  protected sanitizeJson(text: string): string {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    if (firstBrace === -1 && firstBracket === -1) {
      debugLogger.log('Ingredient Matching', 'JSON sanitization: no braces found, returning raw text');
      return text.trim();
    }
    const isArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);
    if (isArray) {
      const lastBracket = text.lastIndexOf(']');
      const result = lastBracket !== -1 ? text.substring(firstBracket, lastBracket + 1) : text.trim();
      debugLogger.log('Ingredient Matching', `JSON sanitization: extracted array from position ${firstBracket} to ${lastBracket}`);
      return result;
    }
    const lastBrace = text.lastIndexOf('}');
    const result = lastBrace !== -1 ? text.substring(firstBrace, lastBrace + 1) : text.trim();
    debugLogger.log('Ingredient Matching', `JSON sanitization: extracted object from position ${firstBrace} to ${lastBrace}`);
    return result;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
   */
  protected cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    if (a.length !== b.length) {
      debugLogger.warn('Ingredient Matching', `Cosine similarity: dimension mismatch (${a.length} vs ${b.length})`);
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Validate synonyms are unique across all canonical items
   */
  protected async validateUniqueSynonyms(synonyms: string[] | undefined, currentItemId?: string): Promise<void> {
    if (!synonyms || synonyms.length === 0) return;

    const allItems = await this.getCanonicalItems();
    const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());

    for (const syn of normalizedSynonyms) {
      if (!syn) continue;

      for (const item of allItems) {
        if (item.id === currentItemId) continue;

        const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
        if (itemSynonyms.includes(syn)) {
          throw new Error(`Synonym "${syn}" already exists on item "${item.name}"`);
        }

        if (item.normalisedName === syn) {
          throw new Error(`Synonym "${syn}" conflicts with canonical item "${item.name}"`);
        }
      }
    }
  }

  /**
   * Validate item name doesn't conflict with existing synonyms
   */
  protected async validateItemNameUniqueness(itemName: string, currentItemId?: string): Promise<void> {
    const normalizedName = itemName.toLowerCase().trim();
    if (!normalizedName) return;

    const allItems = await this.getCanonicalItems();

    for (const item of allItems) {
      if (item.id === currentItemId) continue;

      const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
      if (itemSynonyms.includes(normalizedName)) {
        throw new Error(`Item name "${itemName}" conflicts with synonym on item "${item.name}"`);
      }
    }
  }

  /**
   * Filter out conflicting canonical item synonyms without throwing an error
   */
  protected async filterValidSynonyms(
    synonyms: string[] | undefined,
    currentItemId?: string
  ): Promise<string[]> {
    if (!synonyms || synonyms.length === 0) return [];

    const allItems = await this.getCanonicalItems();
    const validSynonyms: string[] = [];

    for (const syn of synonyms) {
      const normalizedSyn = syn.toLowerCase().trim();
      if (!normalizedSyn) continue;

      let isValid = true;

      for (const item of allItems) {
        if (item.id === currentItemId) continue;

        const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
        if (itemSynonyms.includes(normalizedSyn)) {
          isValid = false;
          break;
        }

        if (item.normalisedName === normalizedSyn) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        validSynonyms.push(syn);
      }
    }

    return validSynonyms;
  }
}
