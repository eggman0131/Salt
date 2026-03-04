/**
 * Canon Module — Module-specific types
 *
 * Only types that are specific to this module and not already
 * defined in types/contract.ts belong here.
 */

/** Result of sortAisles / sortUnits helpers */
export type SortOrder = number;

/** Grouped units by category */
export type UnitsByCategory = {
  weight: import('../../../types/contract').Unit[];
  volume: import('../../../types/contract').Unit[];
  count: import('../../../types/contract').Unit[];
  colloquial: import('../../../types/contract').Unit[];
};

/** Result of an aisle name lookup */
export type AisleLookupResult =
  | { found: true; aisle: import('../../../types/contract').Aisle }
  | { found: false };

/** Result of a unit lookup */
export type UnitLookupResult =
  | { found: true; unit: import('../../../types/contract').Unit }
  | { found: false };

/** Result of an item lookup */
export type ItemLookupResult =
  | { found: true; item: import('../logic/items').CanonItem }
  | { found: false };
