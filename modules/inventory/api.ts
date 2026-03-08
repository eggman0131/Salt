/**
 * Inventory module public API.
 *
 * Single entry point for all inventory operations.
 * Consumers must only import from this file, not from data/ directly.
 */

export {
  getInventory,
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from './data/crud-provider';

export {
  searchEquipmentCandidates,
  generateEquipmentDetails,
  validateAccessory,
} from './data/ai-provider';
