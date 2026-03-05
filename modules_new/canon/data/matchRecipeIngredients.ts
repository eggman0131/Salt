/**
 * Recipe Ingredient Matching Integration (PR8)
 *
 * Orchestrates the full matching pipeline:
 * 1. Match ingredient against existing canon items (fuzzy + semantic)
 * 2. Auto-link if match is good enough
 * 3. Create pending canon item if no good match
 * 4. Auto-suggest CofID mapping for new items
 *
 * This is the data layer — all I/O happens here.
 */

import {
  matchIngredientToCanonItem,
  type IngredientMatchResult,
} from '../logic/matchIngredient';
import {
  fetchCanonItems,
  createCanonItem,
  suggestCofidForCanonItem,
} from './firebase-provider';
import { fetchEmbeddingsFromLookup } from './embeddings-provider';
import type { RecipeIngredient } from '../../../types/contract';
import { getCanonAisles, getCanonUnits } from '../api';

/**
 * Match a single recipe ingredient and link or create canon item.
 *
 * Pipeline:
 * 1. Load canon items, embeddings, aisles, units
 * 2. Run matching pipeline (fuzzy + semantic)
 * 3. If auto-link: update ingredient with canonItemId
 * 4. If create new: create pending canon item, link ingredient
 * 5. Return updated ingredient with audit trail
 *
 * Args:
 *   - ingredient: Parsed recipe ingredient (from PR7)
 *   - aisleId: Optional aisle ID for aisle-bounded search
 *
 * Returns:
 *   - Updated ingredient with canonItemId and matchingAudit populated
 */
export async function matchAndLinkRecipeIngredient(
  ingredient: RecipeIngredient,
  aisleId?: string
): Promise<RecipeIngredient> {
  const effectiveAisleId = aisleId || ingredient.suggestedAisleId;

  // Load canon items and embeddings
  const [canonItems, embeddingLookup, units] = await Promise.all([
    fetchCanonItems(),
    fetchEmbeddingsFromLookup(effectiveAisleId).catch(() => []), // Graceful fallback if no embeddings
    getCanonUnits(),
  ]);

  // Get query embedding if available (from ingredient)
  const queryEmbedding = ingredient.embedding;

  // Run matching pipeline
  const matchResult = matchIngredientToCanonItem(
    ingredient.ingredientName,
    canonItems,
    embeddingLookup,
    queryEmbedding,
    effectiveAisleId
  );

  // If aisle-bounded search found nothing, retry globally before creating a new canon item.
  const fallbackResult =
    effectiveAisleId && matchResult.decision === 'create_new_canon'
      ? matchIngredientToCanonItem(
          ingredient.ingredientName,
          canonItems,
          embeddingLookup,
          queryEmbedding
        )
      : matchResult;

  const decision = fallbackResult;

  // Handle decision
  if (decision.decision === 'use_existing_canon' && decision.canonItemId) {
    // Auto-link to existing canon item
    return {
      ...ingredient,
      canonicalItemId: decision.canonItemId,
      matchingAudit: {
        stage: decision.stage,
        decisionAction: 'use_existing_canon',
        decisionSource: 'rule',
        candidateId: decision.canonItemId,
        matchedSource: 'canon',
        topScore: decision.topScore,
        scoreGap: decision.scoreGap,
        reason: decision.reason,
        recordedAt: new Date().toISOString(),
      },
      matchedAt: new Date().toISOString(),
    };
  } else if (decision.decision === 'create_new_canon') {
    // Create pending canon item
    // Infer aisle and unit from parsed data or use defaults
    const inferredAisleId = effectiveAisleId || 'uncategorised';
    
    // Find preferred unit ID from parsed unit name
    let preferredUnitId = 'g'; // Default to grams
    if (ingredient.unit) {
      const matchedUnit = units.find(
        u => u.name.toLowerCase() === ingredient.unit!.toLowerCase()
      );
      if (matchedUnit) {
        preferredUnitId = matchedUnit.id;
      }
    }

    const newCanonItem = await createCanonItem({
      name: ingredient.ingredientName,
      aisleId: inferredAisleId,
      preferredUnitId,
      needsReview: true, // Always requires review
    });

    // Auto-suggest CofID mapping (PR4 behavior) — fire and forget
    suggestCofidForCanonItem(newCanonItem.id).catch(() => {
      // Silently fail if CofID suggestion fails
    });

    // Link to new canon item
    return {
      ...ingredient,
      canonicalItemId: newCanonItem.id,
      matchingAudit: {
        stage: decision.stage,
        decisionAction: 'create_new_canon',
        decisionSource: 'rule',
        candidateId: newCanonItem.id,
        matchedSource: 'new-canon',
        topScore: decision.topScore,
        scoreGap: decision.scoreGap,
        reason: decision.reason,
        recordedAt: new Date().toISOString(),
      },
      matchedAt: new Date().toISOString(),
    };
  } else {
    // No match — leave unlinked
    return {
      ...ingredient,
      matchingAudit: {
        stage: decision.stage,
        decisionAction: 'no_match',
        decisionSource: 'fallback',
        matchedSource: 'unlinked',
        topScore: decision.topScore,
        scoreGap: decision.scoreGap,
        reason: decision.reason,
        recordedAt: new Date().toISOString(),
      },
      matchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Batch match and link recipe ingredients.
 *
 * Processes ingredients in parallel with progress tracking.
 * Falls back to sequential processing if parallel fails.
 *
 * Args:
 *   - ingredients: Array of parsed recipe ingredients
 *   - onProgress: Optional progress callback
 *
 * Returns:
 *   - Array of updated ingredients with canon item links
 */
export async function matchAndLinkRecipeIngredients(
  ingredients: RecipeIngredient[],
  onProgress?: (current: number, total: number) => void
): Promise<RecipeIngredient[]> {
  if (ingredients.length === 0) {
    return [];
  }

  const total = ingredients.length;
  const matched: RecipeIngredient[] = [];

  // Process sequentially to avoid overwhelming Firestore
  for (let i = 0; i < ingredients.length; i++) {
    const ingredient = ingredients[i];

    try {
      const matchedIngredient = await matchAndLinkRecipeIngredient(ingredient);
      matched.push(matchedIngredient);
    } catch (error) {
      console.error(`Failed to match ingredient: ${ingredient.ingredientName}`, error);
      // Keep original ingredient on error
      matched.push(ingredient);
    }

    // Report progress
    onProgress?.(i + 1, total);
  }

  return matched;
}
