/**
 * Canon Module — CofID Mapping Resolver
 *
 * Pure logic for resolving CofID group codes to canonical aisle IDs.
 * Validates embeddings and generates mapping reports.
 */

import { z } from 'zod';
import { CofIDItem, CofIDImportReport } from '../types';

/**
 * CofID Aisle Mapping (from scripts/cofid-aisle-mapping.json)
 * Group code → aisle name
 */
export interface CofidAisleEntry {
  name: string; // Full name of the CofID group
  aisle: string; // Target aisle name
}

export type CofidMapping = Record<string, CofidAisleEntry>;

/**
 * Aisle info for resolution
 */
export interface AisleInfo {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * Result of resolving a CofID group to an aisle
 */
export interface MappingResult {
  group: string;
  groupName: string;
  aisleRequest: string; // What the mapping file asked for
  resolved: boolean;
  aisleId?: string; // If resolved
  aisleName?: string; // If resolved
  reason?: string; // If not resolved
}

/**
 * Normalize aisle names for matching (lowercase, trim whitespace)
 */
export function normaliseAisleName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Resolve a CofID group to the best matching aisle
 * Returns the first exact match found
 */
export function resolveGroupToAisle(
  group: string,
  groupName: string,
  aisleRequest: string,
  aisles: AisleInfo[],
): MappingResult {
  const normalisedRequest = normaliseAisleName(aisleRequest);

  // Try exact match first (case-insensitive)
  const exactMatch = aisles.find((a) => normaliseAisleName(a.name) === normalisedRequest);
  if (exactMatch) {
    return {
      group,
      groupName,
      aisleRequest,
      resolved: true,
      aisleId: exactMatch.id,
      aisleName: exactMatch.name,
    };
  }

  // No match found - will be forced to uncategorised
  return {
    group,
    groupName,
    aisleRequest,
    resolved: false,
    reason: `Aisle "${aisleRequest}" not found in canonical aisles`,
  };
}

/**
 * Validate CofID item embeddings
 */
export function validateEmbedding(
  item: CofIDItem,
): { valid: boolean; error?: string } {
  const anyItem = item as any;
  if (!anyItem.embedding) {
    return { valid: false, error: 'No embedding provided' };
  }

  if (anyItem.embeddingModel !== 'text-embedding-005') {
    return {
      valid: false,
      error: `Invalid embedding model: ${anyItem.embeddingModel} (expected text-embedding-005)`,
    };
  }

  if (anyItem.embedding.length !== 768) {
    return {
      valid: false,
      error: `Invalid embedding dimension: ${anyItem.embedding.length} (expected 768)`,
    };
  }

  return { valid: true };
}

/**
 * Resolve all CofID items to aisles and produce a report
 */
export function resolveCofidItemsToAisles(
  items: CofIDItem[],
  cofidMapping: CofidMapping,
  aisles: AisleInfo[],
): {
  results: MappingResult[];
  unmappedGroups: Set<string>;
  collisions: Map<string, string[]>;
} {
  const results: MappingResult[] = [];
  const unmappedGroups = new Set<string>();
  const collisions = new Map<string, string[]>();

  // Group items by unique groups
  const uniqueGroups = new Map<string, CofidAisleEntry>();
  for (const item of items) {
    const entry = cofidMapping[item.group];
    if (entry && !uniqueGroups.has(item.group)) {
      uniqueGroups.set(item.group, entry);
    }
  }

  // Resolve each unique group
  for (const [group, entry] of uniqueGroups) {
    const result = resolveGroupToAisle(group, entry.name, entry.aisle, aisles);
    results.push(result);

    if (!result.resolved) {
      unmappedGroups.add(group);
    }
  }

  // Check for collisions (multiple aisles with same normalised name)
  const normalisedToAisles = new Map<string, string[]>();
  for (const aisle of aisles) {
    const norm = normaliseAisleName(aisle.name);
    if (!normalisedToAisles.has(norm)) {
      normalisedToAisles.set(norm, []);
    }
    normalisedToAisles.get(norm)!.push(aisle.name);
  }

  for (const [norm, names] of normalisedToAisles) {
    if (names.length > 1) {
      collisions.set(norm, names);
    }
  }

  return { results, unmappedGroups, collisions };
}

/**
 * Generate CofID import report
 * 
 * NOTE: This reports on MAPPING only (groups → aisles).
 * Embedding validation happens separately during seedCofidEmbeddings().
 */
export function generateCofidImportReport(
  items: CofIDItem[],
  cofidMapping: CofidMapping,
  aisles: AisleInfo[],
): CofIDImportReport {
  const resolution = resolveCofidItemsToAisles(items, cofidMapping, aisles);

  // Count items by mapping result
  const mappedCount = resolution.results.filter((r) => r.resolved).length;
  const unmappedCount = resolution.results.filter((r) => !r.resolved).length;
  const forcedToUncategorisedCount = resolution.results.filter((r) => !r.resolved).length;

  // Mapping failures
  const mappingFailures = resolution.results
    .filter((r) => !r.resolved)
    .map((r) => ({
      group: r.group,
      groupName: r.groupName,
      reason: r.reason!,
    }));

  // Collision info
  const collisionList = Array.from(resolution.collisions.entries()).map(([norm, names]) => ({
    normalisedName: norm,
    aisleNames: names,
  }));

  return {
    totalItems: items.length,
    importedItems: items.length, // All items import (embedding validation is separate)
    failedItems: 0, // Import step doesn't fail items; embeddings are validated separately
    embeddingValidationErrors: undefined, // Not relevant for item import
    mappingResults: {
      mapped: mappedCount,
      unmapped: unmappedCount,
      forced_to_uncategorised: forcedToUncategorisedCount,
    },
    mappingFailures: mappingFailures.length > 0 ? mappingFailures : undefined,
    collisions: collisionList.length > 0 ? collisionList : undefined,
    generatedAt: new Date().toISOString(),
  };
}
