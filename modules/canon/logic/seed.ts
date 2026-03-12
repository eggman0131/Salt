/**
 * Canon seed logic (pure)
 *
 * Functions for validating and preparing seed data.
 * All I/O happens in the data layer.
 */

import { z } from 'zod';
import { Aisle, Unit } from '../../../types/contract';

/**
 * Raw aisle seed schema (new three-tier JSON format)
 * { tier3: "food", tier2: "fresh", tier1: "fresh vegetables" }
 * The id is auto-generated as a UUID during seeding.
 */
const RawAisleSeedSchema = z.object({
  tier1: z.string().min(1),
  tier2: z.string().min(1),
  tier3: z.string().min(1),
});

/**
 * Raw unit seed schema (JSON format)
 */
const RawUnitSeedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  plural: z.string().nullable(),
  category: z.enum(['weight', 'volume', 'count', 'colloquial']),
  sortOrder: z.number().int().nonnegative(),
});

export type RawAisleSeed = z.infer<typeof RawAisleSeedSchema>;
export type RawUnitSeed = z.infer<typeof RawUnitSeedSchema>;

/**
 * Seed result for a single item
 */
export interface SeedItemResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Overall seed result
 */
export interface SeedResult {
  total: number;
  succeeded: number;
  failed: number;
  items: SeedItemResult[];
}

/**
 * Validate raw aisle seed data
 */
export function validateAisleSeed(raw: unknown): {
  valid: boolean;
  data?: RawAisleSeed;
  error?: string;
} {
  const result = RawAisleSeedSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, error: result.error.message };
}

/**
 * Validate raw unit seed data
 */
export function validateUnitSeed(raw: unknown): {
  valid: boolean;
  data?: RawUnitSeed;
  error?: string;
} {
  const result = RawUnitSeedSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, error: result.error.message };
}

/**
 * Validate array of aisle seeds
 */
export function validateAisleSeeds(rawArray: unknown[]): {
  valid: RawAisleSeed[];
  invalid: Array<{ index: number; error: string }>;
} {
  const valid: RawAisleSeed[] = [];
  const invalid: Array<{ index: number; error: string }> = [];

  rawArray.forEach((item, index) => {
    const result = validateAisleSeed(item);
    if (result.valid && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ index, error: result.error ?? 'Unknown validation error' });
    }
  });

  return { valid, invalid };
}

/**
 * Validate array of unit seeds
 */
export function validateUnitSeeds(rawArray: unknown[]): {
  valid: RawUnitSeed[];
  invalid: Array<{ index: number; error: string }>;
} {
  const valid: RawUnitSeed[] = [];
  const invalid: Array<{ index: number; error: string }> = [];

  rawArray.forEach((item, index) => {
    const result = validateUnitSeed(item);
    if (result.valid && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ index, error: result.error ?? 'Unknown validation error' });
    }
  });

  return { valid, invalid };
}

/**
 * Convert raw aisle seed to Firestore-ready format.
 * Caller provides the generated id and sortOrder (array index).
 */
export function prepareAisleForFirestore(
  seed: RawAisleSeed,
  id: string,
  sortOrder: number
): Aisle {
  return {
    id,
    name: seed.tier1,
    tier2: seed.tier2,
    tier3: seed.tier3,
    sortOrder,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Convert raw unit seed to Firestore-ready format
 */
export function prepareUnitForFirestore(seed: RawUnitSeed): Unit {
  return {
    id: seed.id,
    name: seed.name,
    plural: seed.plural,
    category: seed.category,
    sortOrder: seed.sortOrder,
    createdAt: new Date().toISOString(),
  };
}
