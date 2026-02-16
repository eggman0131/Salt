/**
 * Inventory Backend Public API
 * 
 * Exports the inventory backend singleton and types.
 */

export { FirebaseInventoryBackend } from './firebase-inventory-backend';
export type { IInventoryBackend } from './inventory-backend.interface';
export { BaseInventoryBackend } from './base-inventory-backend';

// Singleton instance
import { FirebaseInventoryBackend } from './firebase-inventory-backend';

export const inventoryBackend = new FirebaseInventoryBackend();
