/**
 * Kitchen Data Backend - Public API
 * 
 * Provides singleton access to kitchen data backend (units, aisles, canonical items, categories).
 * This is the foundational module imported by shopping, recipes, and other modules.
 */

import { FirebaseKitchenDataBackend } from './firebase-kitchen-data-backend';
import { IKitchenDataBackend } from './kitchen-data-backend.interface';

// Singleton instance
let backendInstance: IKitchenDataBackend;

/**
 * Get the kitchen data backend instance.
 * In future: Could swap between Firebase/simulation modes here.
 */
export function getKitchenDataBackend(): IKitchenDataBackend {
  if (!backendInstance) {
    backendInstance = new FirebaseKitchenDataBackend();
  }
  return backendInstance;
}

// Export for convenience
export const kitchenDataBackend = getKitchenDataBackend();

// Re-export types
export type { IKitchenDataBackend } from './kitchen-data-backend.interface';
export { BaseKitchenDataBackend } from './base-kitchen-data-backend';
export { FirebaseKitchenDataBackend } from './firebase-kitchen-data-backend';
