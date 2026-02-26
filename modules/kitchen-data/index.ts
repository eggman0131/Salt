/**
 * Kitchen Data Module - Public API
 * 
 * ⚠️ DEPRECATED: This module has been split into Canon and Categories modules.
 * - Use '@/modules/canon' for units, aisles, and canonical items
 * - Use '@/modules/categories' for recipe categories
 * 
 * This module remains only for backwards compatibility.
 * KitchenDataModule component acts as an orchestrator importing from both modules.
 */

// Re-export backend (DEPRECATED - use canon/categories backends directly)
export { kitchenDataBackend, getKitchenDataBackend } from './backend';
export type { IKitchenDataBackend } from './backend';

// Re-export main module component
export { KitchenDataModule } from './components/KitchenDataModule';
