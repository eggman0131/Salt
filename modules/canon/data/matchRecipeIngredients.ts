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
  fetchCanonAisles,
  fetchCanonUnits,
  fetchCanonItems,
  createCanonItem,
} from './firebase-provider';
import { fetchEmbeddingsFromLookup, generateTextEmbeddingsBatch, generateTextEmbedding, deleteEmbeddings } from './embeddings-provider';
import type { RecipeIngredient } from '../../../types/contract';
import { callAiParseIngredients } from './aiParseIngredients';
import { validateAiParseResults } from '../logic/validateAiParse';
import type { ValidatedParseResult } from '../types';
import { logMatchEvent, flushMatchEvents, createBatchId, startTimer } from './match-events-provider';

export interface MatchingPipelineOptions {
  dryRun?: boolean;
  sessionLabel?: string; // Human-readable label for this batch (e.g. recipe title)
}

interface MatchingPipelineContext {
  canonItems: Awaited<ReturnType<typeof fetchCanonItems>>;
  embeddingLookup: Awaited<ReturnType<typeof fetchEmbeddingsFromLookup>>;
  units: Awaited<ReturnType<typeof fetchCanonUnits>>;
}

async function loadMatchingContext(): Promise<MatchingPipelineContext> {
  const [canonItems, embeddingLookup, units] = await Promise.all([
    fetchCanonItems(),
    fetchEmbeddingsFromLookup().catch(() => []),
    fetchCanonUnits(),
  ]);

  return {
    canonItems,
    embeddingLookup,
    units,
  };
}

function mapValidatedParseToRecipeIngredient(
  result: ValidatedParseResult,
  unitById: Map<string, { id: string; name: string }>
): RecipeIngredient {
  const resolvedUnit = result.recipeUnitId ? unitById.get(result.recipeUnitId) : undefined;

  return {
    id: crypto.randomUUID(),
    raw: result.originalLine,
    quantity: result.quantity,
    unit: resolvedUnit?.name ?? null,
    ingredientName: result.itemName,
    qualifiers: result.notes.length > 0 ? result.notes : undefined,
    preparation: result.preparations.length > 0 ? result.preparations[0] : undefined,
    parseReviewFlags: result.reviewFlags.length > 0 ? result.reviewFlags : undefined,
    parsedAt: new Date().toISOString(),
  };
}

export async function processRawRecipeIngredients(
  rawLines: string[],
  onProgress?: (progress: { stage: 'parse' | 'match'; current: number; total: number }) => void,
  options: MatchingPipelineOptions = {}
): Promise<RecipeIngredient[]> {
  if (rawLines.length === 0) {
    return [];
  }

  const batchId = createBatchId();
  const [aisles, units] = await Promise.all([fetchCanonAisles(), fetchCanonUnits()]);

  // Only offer food/drink aisles to the AI — household etc. aren't relevant for ingredient parsing.
  // Description format: "tier2 / tier1" (e.g. "fresh / fresh vegetables") for better AI context.
  const aisleDescriptions: Record<string, string> = {};
  for (const aisle of aisles) {
    const tier3 = (aisle.tier3 ?? '').toLowerCase();
    if (tier3 === 'food' || tier3 === 'drink') {
      aisleDescriptions[aisle.id] = `${aisle.tier2} / ${aisle.name}`;
    }
  }

  // Filter out colloquial units for AI prompt (e.g., "pinch", "handful")
  // Keep them for validation, just don't suggest them to the AI
  const standardUnits = units.filter(u => u.category !== 'colloquial');

  const unitDescriptions: Record<string, string> = {};
  for (const unit of standardUnits) {
    unitDescriptions[unit.id] = unit.name;
  }

  onProgress?.({ stage: 'parse', current: 0, total: rawLines.length });

  const parseResult = await callAiParseIngredients(rawLines, aisleDescriptions, unitDescriptions);
  if (!parseResult.success || !parseResult.data) {
    throw new Error(parseResult.error || 'AI parse failed');
  }

  // Validate and repair AI parse results with timing
  const validationTimer = startTimer();
  const validated = validateAiParseResults(
    parseResult.data,
    aisles.map(a => a.id),
    units.map(u => u.id)
  );
  const validationDuration = validationTimer();

  // Log validation event
  logMatchEvent({
    eventType: 'parse-validation',
    entityType: 'recipe-ingredient',
    entityId: batchId,
    entityName: `Validation of ${parseResult.data.length} parsed ingredients`,
    input: {
      inputCount: parseResult.data.length,
      validAislesCount: aisles.length,
      validUnitsCount: units.length,
    },
    output: {
      totalCount: validated.totalCount,
      successCount: validated.successCount,
      hasErrors: validated.hasErrors,
      hasReviewFlags: validated.hasReviewFlags,
      reviewFlagBreakdown: validated.results
        .flatMap(r => r.reviewFlags)
        .reduce((acc, flag) => {
          acc[flag] = (acc[flag] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      errors: validated.errors,
    },
    metrics: {
      durationMs: validationDuration,
      batchId,
      batchSize: parseResult.data.length,
      sessionLabel: options.sessionLabel,
    },
  }).catch(err => console.error('Failed to log parse-validation event:', err));

  onProgress?.({ stage: 'parse', current: rawLines.length, total: rawLines.length });

  const contextLoadTimer = startTimer();
  const matchingContext = await loadMatchingContext();
  const contextLoadDurationMs = contextLoadTimer();

  logMatchEvent({
    eventType: 'embedding-generation',
    entityType: 'recipe-ingredient',
    entityId: batchId,
    entityName: `Context preload for ${validated.results.length} ingredients`,
    input: {
      candidateCount: matchingContext.canonItems.length,
      aisleFiltered: false,
    },
    output: {
      resultCount: matchingContext.embeddingLookup.length,
      embeddingGenerated: false,
      embeddingReused: true,
    },
    metrics: {
      durationMs: contextLoadDurationMs,
      batchId,
      batchSize: validated.results.length,
      sessionLabel: options.sessionLabel,
    },
    metadata: {
      pipelineVersion: 'match-v3-batch-context',
      warning: 'Preloaded canon items, units, and embedding lookup for batch execution',
    },
  }).catch(err => console.error('Failed to log context preload event:', err));

  const unitById = new Map(units.map(u => [u.id, { id: u.id, name: u.name }]));
  const matchedIngredients: RecipeIngredient[] = [];

  // Batch-generate query embeddings for all ingredients in one API call
  // so that semantic matching runs for every ingredient.
  const batchEmbedTimer = startTimer();
  const ingredientNames = validated.results.map(r => r.itemName);
  const batchEmbeddings = await generateTextEmbeddingsBatch(ingredientNames).catch(() => {
    return ingredientNames.map(() => null as number[] | null);
  });
  const batchEmbedDurationMs = batchEmbedTimer();

  logMatchEvent({
    eventType: 'embedding-generation',
    entityType: 'recipe-ingredient',
    entityId: batchId,
    entityName: `Batch query embeddings for ${validated.results.length} ingredients`,
    input: { ingredientCount: validated.results.length },
    output: {
      generatedCount: batchEmbeddings.filter(Boolean).length,
      failedCount: batchEmbeddings.filter(e => !e).length,
      embeddingGenerated: true,
    },
    metrics: {
      durationMs: batchEmbedDurationMs,
      batchId,
      batchSize: validated.results.length,
      sessionLabel: options.sessionLabel,
    },
    metadata: { pipelineVersion: 'match-v3-batch-context' },
  }).catch(err => console.error('Failed to log batch embedding-generation event:', err));

  for (let i = 0; i < validated.results.length; i++) {
    const parsed = validated.results[i];
    const recipeIngredient = mapValidatedParseToRecipeIngredient(parsed, unitById);
    // Attach the pre-generated query embedding so semantic matching can run
    const queryEmbedding = batchEmbeddings[i];
    if (queryEmbedding) {
      recipeIngredient.embedding = queryEmbedding;
    }
    const linkedIngredient = await matchAndLinkRecipeIngredient(
      recipeIngredient,
      parsed.aisleId,
      batchId,
      i,
      options,
      matchingContext
    );
    matchedIngredients.push(linkedIngredient);
    onProgress?.({ stage: 'match', current: i + 1, total: validated.results.length });
  }

  // Flush any queued match events before returning
  await flushMatchEvents();

  return matchedIngredients;
}

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
 *   - batchId: Batch identifier for performance tracking
 *   - batchIndex: Index of this ingredient in the batch
 *
 * Returns:
 *   - Updated ingredient with canonItemId and matchingAudit populated
 */
export async function matchAndLinkRecipeIngredient(
  ingredient: RecipeIngredient,
  aisleId?: string,
  batchId?: string,
  batchIndex?: number,
  options: MatchingPipelineOptions = {},
  context?: MatchingPipelineContext
): Promise<RecipeIngredient> {
  const effectiveAisleId = aisleId;

  const dataLoadTimer = startTimer();
  const resolvedContext = context ?? (await loadMatchingContext());
  const dataLoadDurationMs = context ? 0 : dataLoadTimer();
  const canonItems = resolvedContext.canonItems;
  const embeddingLookup = resolvedContext.embeddingLookup;
  const units = resolvedContext.units;

  // Query embedding stage: use cached embedding, or generate one if not present.
  const embeddingTimer = startTimer();
  const cachedEmbedding = Array.isArray(ingredient.embedding) && ingredient.embedding.length > 0
    ? ingredient.embedding
    : null;
  // Fallback: generate on-the-fly if not pre-computed (e.g. standalone call path)
  const generatedEmbedding = cachedEmbedding
    ? null
    : await generateTextEmbedding(ingredient.ingredientName).catch(() => null);
  const queryEmbedding: number[] | undefined =
    cachedEmbedding ?? generatedEmbedding ?? undefined;
  const hasQueryEmbedding = !!queryEmbedding;
  const embeddingDurationMs = embeddingTimer();

  logMatchEvent({
    eventType: 'embedding-generation',
    entityType: 'recipe-ingredient',
    entityId: ingredient.id,
    entityName: ingredient.ingredientName,
    aisleId: effectiveAisleId,
    input: {
      queryText: ingredient.ingredientName,
      embeddingDim: hasQueryEmbedding ? queryEmbedding!.length : undefined,
      aisleFiltered: !!effectiveAisleId,
    },
    output: {
      embeddingGenerated: !!generatedEmbedding,
      embeddingReused: !!cachedEmbedding,
      method: hasQueryEmbedding ? 'semantic' : 'fuzzy',
    },
    metrics: {
      durationMs: embeddingDurationMs,
      batchId,
      batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
      batchIndex,
    },
    metadata: !hasQueryEmbedding
      ? { warning: 'Embedding generation failed; semantic similarity skipped' }
      : undefined,
  }).catch(err => console.error('Failed to log embedding-generation event:', err));

  // Run matching pipeline — no aisle filter, search full canon item pool.
  // Aisle-bounded search was removed because the AI-assigned aisle can be wrong,
  // turning the filter into a hard constraint that causes missed matches.
  const decision = matchIngredientToCanonItem(
    ingredient.ingredientName,
    canonItems,
    embeddingLookup,
    queryEmbedding
  );

  // Clean up stale embeddings for deleted canon items (fire-and-forget)
  if (decision.staleEmbeddingIds.length > 0) {
    deleteEmbeddings(decision.staleEmbeddingIds).catch(err =>
      console.warn('[matchAndLinkRecipeIngredient] Failed to delete stale embeddings:', err)
    );
  }

  const stageTimings = decision.timingsMs;
  const lexicalOperationalMs = stageTimings.lexical;
  const semanticOperationalMs = stageTimings.semantic + embeddingDurationMs;

  // Log stage-level pipeline events so admin analytics show lexical/semantic/merge activity.
  const lexicalCandidates = decision.candidates.filter(c => c.method !== 'semantic');
  const semanticCandidates = decision.candidates.filter(c => c.method === 'semantic');
  const topLexical = lexicalCandidates[0];
  const topSemantic = semanticCandidates[0];
  const lexicalSearchPoolCount = effectiveAisleId
    ? canonItems.filter(item => item.aisleId === effectiveAisleId).length
    : canonItems.length;

  logMatchEvent({
    eventType: 'lexical-match',
    entityType: 'recipe-ingredient',
    entityId: ingredient.id,
    entityName: ingredient.ingredientName,
    aisleId: effectiveAisleId,
    input: {
      queryText: ingredient.ingredientName,
      candidateCount: lexicalSearchPoolCount,
      aisleFiltered: !!effectiveAisleId,
    },
    output: {
      resultCount: lexicalCandidates.length,
      topScore: topLexical?.score,
      topMatchId: topLexical?.canonItemId,
      topMatchName: topLexical?.name,
      method: topLexical?.method,
      candidates: lexicalCandidates.slice(0, 3).map(c => ({ id: c.canonItemId, name: c.name, score: c.score, method: c.method })),
    },
    metrics: {
      durationMs: lexicalOperationalMs,
      batchId,
      batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
      batchIndex,
    },
    metadata: {
      lexicalAlgorithmMs: stageTimings.lexical,
      dataLoadMs: dataLoadDurationMs,
      contextSource: context ? 'batch-preloaded' : 'single-call',
      pipelineVersion: 'match-v3-batch-context',
    },
  }).catch(err => console.error('Failed to log lexical-match event:', err));

  logMatchEvent({
    eventType: 'semantic-match',
    entityType: 'recipe-ingredient',
    entityId: ingredient.id,
    entityName: ingredient.ingredientName,
    aisleId: effectiveAisleId,
    input: {
      queryText: ingredient.ingredientName,
      candidateCount: embeddingLookup.length,
      aisleFiltered: !!effectiveAisleId,
      embeddingDim: queryEmbedding?.length,
    },
    output: {
      resultCount: semanticCandidates.length,
      topScore: topSemantic?.score,
      topMatchId: topSemantic?.canonItemId,
      topMatchName: topSemantic?.name,
      method: 'semantic',
      candidates: semanticCandidates.slice(0, 3).map(c => ({ id: c.canonItemId, name: c.name, score: c.score, method: c.method })),
    },
    metrics: {
      durationMs: semanticOperationalMs,
      batchId,
      batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
      batchIndex,
    },
    metadata: {
      semanticAlgorithmMs: stageTimings.semantic,
      embeddingPrepMs: embeddingDurationMs,
      contextSource: context ? 'batch-preloaded' : 'single-call',
      pipelineVersion: 'match-v3-batch-context',
    },
  }).catch(err => console.error('Failed to log semantic-match event:', err));

  logMatchEvent({
    eventType: 'candidate-merge',
    entityType: 'recipe-ingredient',
    entityId: ingredient.id,
    entityName: ingredient.ingredientName,
    aisleId: effectiveAisleId,
    input: {
      queryText: ingredient.ingredientName,
      lexicalCount: lexicalCandidates.length,
      semanticCount: semanticCandidates.length,
    },
    output: {
      resultCount: decision.candidates.length,
      topScore: decision.topScore,
      topMatchId: decision.candidates[0]?.canonItemId,
      topMatchName: decision.candidates[0]?.name,
      method: 'merged',
    },
    metrics: {
      durationMs: stageTimings.merge,
      batchId,
      batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
      batchIndex,
    },
  }).catch(err => console.error('Failed to log candidate-merge event:', err));

  // Handle decision
  if (decision.decision === 'use_existing_canon' && decision.canonItemId) {
    const decisionTimer = startTimer();

    // Log match decision event
    logMatchEvent({
      eventType: 'match-decision',
      entityType: 'recipe-ingredient',
      entityId: ingredient.id,
      entityName: ingredient.ingredientName,
      aisleId: effectiveAisleId,
      input: {
        queryText: ingredient.ingredientName,
        aisleId: effectiveAisleId,
        hasEmbedding: !!ingredient.embedding,
      },
      output: {
        decision: 'use_existing_canon',
        canonItemId: decision.canonItemId,
        topScore: decision.topScore,
        scoreGap: decision.scoreGap,
        stage: decision.stage,
        reason: decision.reason,
        candidates: decision.candidates.slice(0, 5).map(c => ({ id: c.canonItemId, name: c.name, score: c.score, method: c.method, reason: c.reason })),
      },
      metrics: {
        durationMs: decisionTimer(),
        batchId,
        batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
        batchIndex,
        sessionLabel: options.sessionLabel,
      },
      metadata: {
        decisionAlgorithmMs: stageTimings.decision,
        contextSource: context ? 'batch-preloaded' : 'single-call',
        pipelineVersion: 'match-v3-batch-context',
      },
    }).catch(err => console.error('Failed to log match-decision event:', err));

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
        nearMisses: decision.candidates.slice(0, 3).map(c => ({ name: c.name, score: c.score, method: c.method })),
      },
      matchedAt: new Date().toISOString(),
    };
  } else if (decision.decision === 'create_new_canon') {
    const decisionTimer = startTimer();

    if (options.dryRun) {
      logMatchEvent({
        eventType: 'match-decision',
        entityType: 'recipe-ingredient',
        entityId: ingredient.id,
        entityName: ingredient.ingredientName,
        aisleId: effectiveAisleId,
        input: {
          queryText: ingredient.ingredientName,
          aisleId: effectiveAisleId,
          hasEmbedding: !!ingredient.embedding,
        },
        output: {
          decision: 'create_new_canon',
          topScore: decision.topScore,
          scoreGap: decision.scoreGap,
          stage: decision.stage,
          reason: decision.reason,
          dryRun: true,
          candidates: decision.candidates.slice(0, 5).map(c => ({ id: c.canonItemId, name: c.name, score: c.score, method: c.method, reason: c.reason })),
        },
        metrics: {
          durationMs: decisionTimer(),
          batchId,
          batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
          batchIndex,
          sessionLabel: options.sessionLabel,
        },
        metadata: {
          decisionAlgorithmMs: stageTimings.decision,
          contextSource: context ? 'batch-preloaded' : 'single-call',
          pipelineVersion: 'match-v3-batch-context',
        },
      }).catch(err => console.error('Failed to log dry-run match-decision event:', err));

      return {
        ...ingredient,
        matchingAudit: {
          stage: decision.stage,
          decisionAction: 'create_new_canon',
          decisionSource: 'rule',
          matchedSource: 'new-canon',
          topScore: decision.topScore,
          scoreGap: decision.scoreGap,
          reason: `[dry-run] ${decision.reason}`,
          recordedAt: new Date().toISOString(),
          nearMisses: decision.candidates.slice(0, 3).map(c => ({ name: c.name, score: c.score, method: c.method })),
        },
        matchedAt: new Date().toISOString(),
      };
    }

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

    // Log match decision event
    logMatchEvent({
      eventType: 'match-decision',
      entityType: 'recipe-ingredient',
      entityId: ingredient.id,
      entityName: ingredient.ingredientName,
      aisleId: effectiveAisleId,
      input: {
        queryText: ingredient.ingredientName,
        aisleId: effectiveAisleId,
        hasEmbedding: !!ingredient.embedding,
      },
      output: {
        decision: 'create_new_canon',
        canonItemId: newCanonItem.id,
        topScore: decision.topScore,
        scoreGap: decision.scoreGap,
        stage: decision.stage,
        reason: decision.reason,
        inferredAisleId,
        preferredUnitId,
        candidates: decision.candidates.slice(0, 5).map(c => ({ id: c.canonItemId, name: c.name, score: c.score, method: c.method, reason: c.reason })),
      },
      metrics: {
        durationMs: decisionTimer(),
        batchId,
        batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
        batchIndex,
        sessionLabel: options.sessionLabel,
      },
      metadata: {
        decisionAlgorithmMs: stageTimings.decision,
        contextSource: context ? 'batch-preloaded' : 'single-call',
        pipelineVersion: 'match-v3-batch-context',
      },
    }).catch(err => console.error('Failed to log match-decision event:', err));

    // CofID auto-linking happens inside createCanonItem for high-confidence matches.
    // No need to fire-and-forget suggestCofidForCanonItem here — it triggers heavy
    // Firestore reads (all CofID items + embeddings) per item, overwhelming the emulator
    // during batch processing.

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
        nearMisses: decision.candidates.slice(0, 3).map(c => ({ name: c.name, score: c.score, method: c.method })),
      },
      matchedAt: new Date().toISOString(),
    };
  } else {
    const decisionTimer = startTimer();

    // Log match decision event
    logMatchEvent({
      eventType: 'match-decision',
      entityType: 'recipe-ingredient',
      entityId: ingredient.id,
      entityName: ingredient.ingredientName,
      aisleId: effectiveAisleId,
      input: {
        queryText: ingredient.ingredientName,
        aisleId: effectiveAisleId,
        hasEmbedding: !!ingredient.embedding,
      },
      output: {
        decision: 'no_match',
        topScore: decision.topScore,
        scoreGap: decision.scoreGap,
        stage: decision.stage,
        reason: decision.reason,
        candidates: decision.candidates.slice(0, 5).map(c => ({ id: c.canonItemId, name: c.name, score: c.score, method: c.method, reason: c.reason })),
      },
      metrics: {
        durationMs: decisionTimer(),
        batchId,
        batchSize: batchIndex !== undefined ? batchIndex + 1 : undefined,
        batchIndex,
        sessionLabel: options.sessionLabel,
      },
      metadata: {
        decisionAlgorithmMs: stageTimings.decision,
        contextSource: context ? 'batch-preloaded' : 'single-call',
        pipelineVersion: 'match-v3-batch-context',
      },
    }).catch(err => console.error('Failed to log match-decision event:', err));

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
        nearMisses: decision.candidates.slice(0, 3).map(c => ({ name: c.name, score: c.score, method: c.method })),
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
  onProgress?: (current: number, total: number) => void,
  options: MatchingPipelineOptions = {}
): Promise<RecipeIngredient[]> {
  if (ingredients.length === 0) {
    return [];
  }

  const batchId = createBatchId();
  const total = ingredients.length;
  const matched: RecipeIngredient[] = [];
  const sharedContext = await loadMatchingContext();

  // Process sequentially to avoid overwhelming Firestore
  for (let i = 0; i < ingredients.length; i++) {
    const ingredient = ingredients[i];

    try {
      const matchedIngredient = await matchAndLinkRecipeIngredient(
        ingredient,
        undefined,
        batchId,
        i,
        options,
        sharedContext
      );
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
