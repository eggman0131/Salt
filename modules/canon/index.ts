/**
 * Canon Module — Public Exports
 *
 * Only api.ts functions, types, and UI components are exported.
 * Internal logic, data, and schemas are private to this module.
 */

export {
  getCanonAisles,
  getCanonUnits,
  sortAisles,
  findAisleById,
  findAisleByName,
  hasUncategorisedAisle,
  validateAisleDoc,
  UNCATEGORISED_AISLE_ID,
  sortUnits,
  findUnitById,
  groupUnitsByCategory,
  validateUnitDoc,
} from './api';

export type {
  CanonAisle,
  CanonUnit,
  AisleLookupResult,
  UnitLookupResult,
  UnitsByCategory,
} from './api';

export { AislesViewer, UnitsViewer } from './ui/CanonViewer';
export { CanonItemsWorkspace } from './ui/CanonItemsWorkspace';
