/**
 * Semantic Matching Utilities Tests
 * 
 * Phase 6: Validation of low-level semantic matching utilities
 * These utilities support the Canon backend's ingredient matching pipeline.
 */

import { describe, it, expect } from 'vitest';
import { 
  cosineSimilarity, 
  normalizeEmbedding, 
  searchBySemantic, 
  analyzeScoreClusters, 
  categorizeByConfidence 
} from '../semantic-matching';
import type { CanonicalItem } from '../../../../types/contract';

describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors', () => {
    const vec = [0.5, 0.3, 0.2];
    expect(cosineSimilarity(vec, vec)).toBe(1.0);
  });

  it('should return 0.0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should return 0.0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('should return 0.0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('should return 0.0 for zero-magnitude vectors', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('should compute correct similarity for known vectors', () => {
    const a = [1, 0];
    const b = [1, 1];
    // Expected: (1*1 + 0*1) / (sqrt(1) * sqrt(2)) = 1 / sqrt(2) ≈ 0.707
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(0.707, 2);
  });

  it('should work with normalized Firestore format inputs', () => {
    const a = [0.5, 0.5];
    const b = normalizeEmbedding({ '0': 0.5, '1': 0.5 });
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(1.0, 10);
  });
});

describe('normalizeEmbedding', () => {
  it('should pass through valid number arrays', () => {
    const embedding = [0.5, 0.3, 0.2];
    expect(normalizeEmbedding(embedding)).toEqual(embedding);
  });

  it('should filter out non-numeric values from arrays', () => {
    const mixed = [0.5, null, 0.3, undefined, NaN, 0.2] as any;
    expect(normalizeEmbedding(mixed)).toEqual([0.5, 0.3, 0.2]);
  });

  it('should normalize Firestore object format to number array', () => {
    const firestore = { '0': 0.5, '1': 0.3, '2': 0.2 };
    expect(normalizeEmbedding(firestore)).toEqual([0.5, 0.3, 0.2]);
  });

  it('should handle objects with non-sequential keys by sorting', () => {
    const obj = { '0': 0.5, '2': 0.2, '1': 0.3 };
    const result = normalizeEmbedding(obj);
    expect(result).toEqual([0.5, 0.3, 0.2]); // Should be sorted by key
  });

  it('should return empty array for invalid input', () => {
    expect(normalizeEmbedding(null as any)).toEqual([]);
    expect(normalizeEmbedding(undefined as any)).toEqual([]);
    expect(normalizeEmbedding('notanarray' as any)).toEqual([]);
    expect(normalizeEmbedding(123 as any)).toEqual([]);
  });
});

describe('searchBySemantic', () => {
  const createMockItem = (id: string, name: string, embedding: number[]): CanonicalItem => ({
    id,
    name,
    normalisedName: name.toLowerCase(),
    isStaple: false,
    aisle: 'produce',
    preferredUnit: 'g',
    synonyms: [],
    embedding,
    createdAt: new Date().toISOString(),
    approved: true,
  });

  const mockItems: CanonicalItem[] = [
    createMockItem('canon-1', 'Tomato', [0.9, 0.1, 0.0]),
    createMockItem('canon-2', 'Potato', [0.1, 0.9, 0.0]),
    createMockItem('canon-3', 'Tomatoes', [0.85, 0.15, 0.0]),
  ];

  it('should rank items by semantic similarity', () => {
    const query = [0.95, 0.05, 0.0]; // More similar to Tomato
    const results = searchBySemantic(query, mockItems);

    expect(results.length).toBe(3);
    expect(results[0].itemId).toBe('canon-1'); // Tomato should rank first
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('should respect minScore threshold', () => {
    const query = [0.95, 0.05, 0.0];
    const results = searchBySemantic(query, mockItems, 10, 0.95);

    // Only near-perfect matches should pass
    expect(results.length).toBeLessThan(mockItems.length);
    expect(results.every(r => r.score >= 0.95)).toBe(true);
  });

  it('should respect maxCandidates limit', () => {
    const query = [0.95, 0.05, 0.0];
    const results = searchBySemantic(query, mockItems, 1, 0);

    expect(results.length).toBe(1);
    expect(results[0].itemId).toBe('canon-1');
  });

  it('should handle empty item list', () => {
    const query = [0.5, 0.5];
    const results = searchBySemantic(query, []);

    expect(results).toEqual([]);
  });

  it('should skip items with missing embeddings', () => {
    const itemsWithMissing: CanonicalItem[] = [
      createMockItem('canon-1', 'No Embedding', undefined as any),
      createMockItem('canon-2', 'Has Embedding', [0.5, 0.5, 0.0]),
    ];

    const query = [0.5, 0.5, 0.0];
    const results = searchBySemantic(query, itemsWithMissing);

    expect(results.length).toBe(1);
    expect(results[0].itemId).toBe('canon-2');
  });
});

describe('analyzeScoreClusters', () => {
  it('should identify single high-confidence match', () => {
    const candidates = [
      { itemId: '1', itemName: 'Match', score: 0.95, synonyms: [] },
      { itemId: '2', itemName: 'Noise', score: 0.30, synonyms: [] },
      { itemId: '3', itemName: 'Noise', score: 0.25, synonyms: [] },
    ];

    const cluster = analyzeScoreClusters(candidates);

    expect(cluster.topScore).toBeCloseTo(0.95, 2);
    expect(cluster.clusterSize).toBe(1);
    expect(cluster.isAmbiguous).toBe(false); // Large gap
    expect(cluster.topCandidates[0].itemId).toBe('1');
  });

  it('should identify tied top results', () => {
    const candidates = [
      { itemId: '1', itemName: 'Tie1', score: 0.92, synonyms: [] },
      { itemId: '2', itemName: 'Tie2', score: 0.91, synonyms: [] }, // Within 0.05 cluster window
      { itemId: '3', itemName: 'Lower', score: 0.70, synonyms: [] },
    ];

    const cluster = analyzeScoreClusters(candidates);

    expect(cluster.clusterSize).toBe(2); // Two items in top cluster
    expect(cluster.isAmbiguous).toBe(false); // Gap to next tier is large
  });

  it('should detect ambiguous matches with small gap', () => {
    const candidates = [
      { itemId: '1', itemName: 'Top', score: 0.85, synonyms: [] },
      { itemId: '2', itemName: 'Mid', score: 0.78, synonyms: [] }, // 0.07 gap - outside 0.05 cluster window but < 0.10 threshold
      { itemId: '3', itemName: 'Lower', score: 0.60, synonyms: [] },
    ];

    const cluster = analyzeScoreClusters(candidates, 0.10);

    expect(cluster.isAmbiguous).toBe(true); // Gap is 0.07 < 0.10
    expect(cluster.scoreGap).toBeCloseTo(0.07, 2);
  });

  it('should handle empty candidate list', () => {
    const cluster = analyzeScoreClusters([]);

    expect(cluster.topScore).toBe(0);
    expect(cluster.clusterSize).toBe(0);
    expect(cluster.topCandidates).toEqual([]);
  });

  it('should use custom gap threshold when provided', () => {
    const candidates = [
      { itemId: '1', itemName: 'A', score: 0.90, synonyms: [] },
      { itemId: '2', itemName: 'B', score: 0.70, synonyms: [] }, // 0.20 gap
    ];

    const clusterDefault = analyzeScoreClusters(candidates); // Default 0.10
    expect(clusterDefault.isAmbiguous).toBe(false);

    const clusterLarge = analyzeScoreClusters(candidates, 0.25); // Larger threshold
    expect(clusterLarge.isAmbiguous).toBe(true); // 0.20 < 0.25
  });
});

describe('categorizeByConfidence', () => {
  it('should categorize high confidence matches', () => {
    const candidates = [
      { itemId: '1', itemName: 'HighMatch', score: 0.95, synonyms: [] },
      { itemId: '2', itemName: 'MidMatch', score: 0.75, synonyms: [] },
      { itemId: '3', itemName: 'LowMatch', score: 0.55, synonyms: [] },
    ];

    const result = categorizeByConfidence(candidates, 0.90, 0.70);

    expect(result.highConfidence).toHaveLength(1);
    expect(result.highConfidence[0].itemId).toBe('1');
    expect(result.candidates).toHaveLength(1); // Between thresholds
    expect(result.lowConfidence).toHaveLength(1);
  });

  it('should handle all high confidence', () => {
    const candidates = [
      { itemId: '1', itemName: 'A', score: 0.98, synonyms: [] },
      { itemId: '2', itemName: 'B', score: 0.95, synonyms: [] },
      { itemId: '3', itemName: 'C', score: 0.91, synonyms: [] },
    ];

    const result = categorizeByConfidence(candidates, 0.90, 0.70);

    expect(result.highConfidence).toHaveLength(3);
    expect(result.candidates).toHaveLength(0);
    expect(result.lowConfidence).toHaveLength(0);
  });

  it('should handle all low confidence', () => {
    const candidates = [
      { itemId: '1', itemName: 'A', score: 0.60, synonyms: [] },
      { itemId: '2', itemName: 'B', score: 0.55, synonyms: [] },
    ];

    const result = categorizeByConfidence(candidates, 0.90, 0.70);

    expect(result.highConfidence).toHaveLength(0);
    expect(result.candidates).toHaveLength(0);
    expect(result.lowConfidence).toHaveLength(2);
  });

  it('should handle empty input', () => {
    const result = categorizeByConfidence([]);

    expect(result.highConfidence).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(result.lowConfidence).toEqual([]);
  });

  it('should use custom thresholds', () => {
    const candidates = [
      { itemId: '1', itemName: 'A', score: 0.85, synonyms: [] },
      { itemId: '2', itemName: 'B', score: 0.75, synonyms: [] },
      { itemId: '3', itemName: 'C', score: 0.65, synonyms: [] },
    ];

    const result = categorizeByConfidence(candidates, 0.80, 0.70);

    expect(result.highConfidence).toHaveLength(1); // >= 0.80
    expect(result.candidates).toHaveLength(1); // 0.70-0.80
    expect(result.lowConfidence).toHaveLength(1); // < 0.70
  });
});

describe('Decision Structures', () => {
  it('should have valid use_existing_canon decision', () => {
    const decision = {
      decision: 'use_existing_canon' as const,
      selectedCandidateId: 'canon-123',
      reasoning: 'Perfect semantic match to existing Canon item "Tomato"',
    };

    expect(decision.decision).toBe('use_existing_canon');
    expect(decision.selectedCandidateId).toBeTruthy();
    expect(decision.reasoning).toBeTruthy();
  });

  it('should have valid create_from_cofid decision', () => {
    const decision = {
      decision: 'create_from_cofid' as const,
      selectedCandidateId: 'cofid-456',
      reasoning: 'CoFID entry provides more specific match',
    };

    expect(decision.decision).toBe('create_from_cofid');
    expect(decision.selectedCandidateId).toMatch(/^cofid-/);
  });

  it('should have valid create_new_canon decision', () => {
    const decision = {
      decision: 'create_new_canon' as const,
      selectedCandidateId: null,
      reasoning: 'No suitable matches. Creating new Canon item.',
    };

    expect(decision.decision).toBe('create_new_canon');
    expect(decision.selectedCandidateId).toBeNull();
  });

  it('should have valid no_match decision', () => {
    const decision = {
      decision: 'no_match' as const,
      selectedCandidateId: null,
      reasoning: 'Non-functional item (cookbook). No Canon item needed.',
    };

    expect(decision.decision).toBe('no_match');
    expect(decision.selectedCandidateId).toBeNull();
  });
});

describe('Audit Trail Structures', () => {
  it('should create valid fuzzy_match success audit', () => {
    const audit = {
      stage: 'fuzzy_match' as const,
      decisionAction: 'match_found' as const,
      decisionSource: 'algorithm' as const,
      candidateId: 'canon-123',
      matchedSource: 'canon' as const,
      topScore: 0.92,
      scoreGap: null,
      reason: 'High fuzzy similarity (92%)',
      recordedAt: new Date().toISOString(),
    };

    expect(audit.stage).toBe('fuzzy_match');
    expect(audit.decisionAction).toBe('match_found');
    expect(audit.topScore).toBeGreaterThanOrEqual(0.85);
    expect(audit.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should create valid semantic arbitration audit', () => {
    const audit = {
      stage: 'semantic_analysis' as const,
      decisionAction: 'arbitration_decided' as const,
      decisionSource: 'llm' as const,
      candidateId: 'cofid-456',
      matchedSource: 'cofid' as const,
      topScore: 0.88,
      scoreGap: 0.03,
      reason: 'LLM selected CoFID after analyzing tied results',
      recordedAt: new Date().toISOString(),
    };

    expect(audit.stage).toBe('semantic_analysis');
    expect(audit.decisionSource).toBe('llm');
    expect(audit.scoreGap).toBeTruthy();
  });

  it('should create valid no_match audit', () => {
    const audit = {
      stage: 'fuzzy_match' as const,
      decisionAction: 'no_match_proceed_semantic' as const,
      decisionSource: 'algorithm' as const,
      candidateId: null,
      matchedSource: null,
      topScore: 0.72,
      scoreGap: null,
      reason: 'Below threshold, proceeding to semantic',
      recordedAt: new Date().toISOString(),
    };

    expect(audit.decisionAction).toBe('no_match_proceed_semantic');
    expect(audit.candidateId).toBeNull();
    expect(audit.topScore).toBeLessThan(0.85);
  });

  it('should have ISO 8601 timestamp format', () => {
    const timestamp = new Date().toISOString();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
