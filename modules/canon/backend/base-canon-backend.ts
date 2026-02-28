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
} from '../../../types/contract';
import { ICanonBackend } from './canon-backend.interface';
import { debugLogger } from '../../../shared/backend/debug-logger';

export abstract class BaseCanonBackend implements ICanonBackend {
  // ==================== ABSTRACT METHODS ====================
  // Subclasses MUST implement persistence and AI transport

  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;
  protected abstract getSystemInstruction(customContext?: string): Promise<string>;

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
  abstract enrichCanonicalItem(rawName: string): Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }>;

  // ==================== INGREDIENT PROCESSING ====================

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
  async processIngredients(ingredients: string[] | RecipeIngredient[], contextId: string): Promise<RecipeIngredient[]> {
    debugLogger.log('Ingredient Matching', `━━━━━ Starting processIngredients for ${contextId} with ${ingredients.length} items ━━━━━`);

    // Early return for already-structured ingredients
    if (ingredients.length > 0 && typeof ingredients[0] === 'object') {
      debugLogger.log('Ingredient Matching', `Already structured, returning ${ingredients.length} ingredients as-is`);
      return ingredients as RecipeIngredient[];
    }

    // Load matching configuration (with defaults if not found)
    const config = await this.getMatchingConfig();
    debugLogger.log('Ingredient Matching', `📋 Matching Config: fuzzy=${config.fuzzyHighConfidenceThreshold}, semantic high=${config.semanticHighThreshold}, low=${config.semanticLowThreshold}, gap=${config.semanticGapThreshold}, cluster=${config.semanticClusterWindow}`);

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
      const parsed = this.parseIngredientString(raw);

      debugLogger.log('Ingredient Matching', `[${idx}] "${raw}" → ${parsed.quantity || ''}${parsed.unit || ''} ${parsed.ingredientName}${parsed.preparation ? ' (' + parsed.preparation + ')' : ''}`);

      let bestMatch: CanonicalItem | null = null;
      let bestScore = 0;

      // Fuzzy match against canonical items
      for (const item of allCanonItems) {
        const nameScore = this.fuzzyMatch(parsed.ingredientName.toLowerCase(), item.normalisedName);
        if (nameScore > bestScore) {
          bestScore = nameScore;
          bestMatch = item;
        }

        // Check synonyms
        if (item.synonyms) {
          for (const syn of item.synonyms) {
            const synScore = this.fuzzyMatch(parsed.ingredientName.toLowerCase(), syn.toLowerCase());
            if (synScore > bestScore) {
              bestScore = synScore;
              bestMatch = item;
            }
          }
        }
      }

      // Confident fuzzy match?
      if (bestScore >= config.fuzzyHighConfidenceThreshold && bestMatch) {
        debugLogger.log('Ingredient Matching', `[${idx}] ✓ Fuzzy HIT: "${parsed.ingredientName}" → "${bestMatch.name}" (score: ${(bestScore * 100).toFixed(1)}%)`);
        
        // Add synonym if not already present
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
        });
      } else {
        debugLogger.log('Ingredient Matching', `[${idx}] ✗ Fuzzy MISS: "${parsed.ingredientName}" (best: ${(bestScore * 100).toFixed(1)}% < ${(config.fuzzyHighConfidenceThreshold * 100).toFixed(0)}%)`);
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

    // ========== STAGE 2 & 3: SEMANTIC SEARCH & DECISION ==========
    if (pendingSemanticSearch.length > 0) {
      debugLogger.log('Ingredient Matching', `┌── STAGE 2 & 3: Semantic Search & Decision (${pendingSemanticSearch.length} items) ──┐`);

      for (const { index, parsed } of pendingSemanticSearch) {
        debugLogger.log('Ingredient Matching', `[${index}] Embedding "${parsed.ingredientName}"...`);

        // Embed the ingredient string
        const embeddingResult = await this.embedText(parsed.ingredientName);
        if (!embeddingResult || !embeddingResult.embedding) {
          debugLogger.warn('Ingredient Matching', `[${index}] Failed to embed "${parsed.ingredientName}", skipping semantic search`);
          continue;
        }

        const queryEmbedding = embeddingResult.embedding;

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
          } else {
            // Create new Canon item from CoFID
            debugLogger.log('Ingredient Matching', `[${index}] Creating new Canon item from CoFID: "${topCandidate.name}"`);
            const newCanonItem = await this.createCanonicalItemFromCofid(topCandidate.item);
            results[index].canonicalItemId = newCanonItem.id;
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
            await this.applyArbitrationDecision(index, parsed, decision, results);
          } else {
            // High score but clear winner (treat as Case A)
            debugLogger.log('Ingredient Matching', `[${index}] 🎯 High score with clear winner, treating as Case A`);
            
            const topCandidate = candidates[0];
            if (topCandidate.source === 'canon') {
              const canonItem = topCandidate.item as CanonicalItem;
              results[index].canonicalItemId = canonItem.id;
            } else {
              const newCanonItem = await this.createCanonicalItemFromCofid(topCandidate.item);
              results[index].canonicalItemId = newCanonItem.id;
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
          await this.applyArbitrationDecision(index, parsed, decision, results);
        }
        // No semantic match
        else {
          debugLogger.log(
            'Ingredient Matching',
            `[${index}] ❌ No semantic match (score: ${(topScore * 100).toFixed(1)}% < ${(config.semanticLowThreshold * 100).toFixed(0)}%)`
          );
          
          if (config.allowNewCanonItems) {
            debugLogger.log('Ingredient Matching', `[${index}] → Creating new Canon item via AI enrichment`);
            await this.createNewCanonItemViaAI(index, parsed, results);
          } else {
            debugLogger.log('Ingredient Matching', `[${index}] ⚠️  New Canon items disabled, leaving unlinked`);
          }
        }
      }

      debugLogger.log('Ingredient Matching', `└── Stage 2 & 3 complete ──┘`);
    }

    debugLogger.log('Ingredient Matching', `━━━━━ Final result: ${results.filter(r => r.canonicalItemId).length}/${results.length} ingredients linked ━━━━━`);

    return results;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Parse raw ingredient string -> structured format
   */
  private parseIngredientString(raw: string): Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'> {
    let text = raw.toLowerCase().trim();

    const knownUnits = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'];
    const unitPattern = knownUnits.join('|');
    const quantityMatch = text.match(new RegExp(`^(\\d+\\.?\\d*|\\d*\\.\\d+)\\s*(${unitPattern})?\\s+(.+)$`));

    let quantity: number | null = null;
    let unit: string | null = null;

    if (quantityMatch) {
      quantity = parseFloat(quantityMatch[1]);
      unit = quantityMatch[2] || '';
      text = quantityMatch[3];
    }

    const prepMatch = text.match(/,\s*(.+)$/);
    const preparation = prepMatch ? prepMatch[1].trim() : null;
    if (prepMatch) {
      text = text.substring(0, prepMatch.index).trim();
    }

    text = text.replace(/\b(small|medium|large)\b/g, '').trim();

    const ingredientName = text.replace(/\s+/g, ' ').trim();

    return {
      quantity,
      unit,
      ingredientName,
      preparation: preparation || undefined,
    };
  }

  /**
   * Levenshtein distance for fuzzy string matching
   * Returns similarity score 0.0 - 1.0 (1.0 = exact match)
   */
  private fuzzyMatch(a: string, b: string): number {
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
- Keep culinary identity descriptors (red onion, beef mince, whole milk)
- Remove size adjectives (small, medium, large)

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
