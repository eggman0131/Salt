/**
 * Canon Module Public API
 *
 * Exposes read helpers (backed by Firestore) and re-exports all pure
 * deterministic helpers from the logic layer.
 *
 * Rule: UI imports ONLY from this file.
 */

import { Aisle, Unit } from '../../types/contract';
import { fetchCanonAisles, fetchCanonUnits } from './data/firebase-provider';

// ── Persistence-backed read helpers ──────────────────────────────────────────

/**
 * List all canon aisles, ordered by sortOrder.
 */
export async function getCanonAisles(): Promise<Aisle[]> {
  return fetchCanonAisles();
}

/**
 * List all canon units, ordered by sortOrder.
 */
export async function getCanonUnits(): Promise<Unit[]> {
  return fetchCanonUnits();
}

// ── Pure logic helpers (re-exported for convenience) ─────────────────────────

export {
  sortAisles,
  findAisleById,
  findAisleByName,
  hasUncategorisedAisle,
  validateAisleDoc,
  UNCATEGORISED_AISLE_ID,
} from './logic/aisles';

export {
  sortUnits,
  findUnitById,
  groupUnitsByCategory,
  validateUnitDoc,
} from './logic/units';

// ── Type re-exports ───────────────────────────────────────────────────────────

export type { CanonAisle } from './logic/aisles';
export type { CanonUnit } from './logic/units';
export type { AisleLookupResult, UnitLookupResult, UnitsByCategory } from './types';
