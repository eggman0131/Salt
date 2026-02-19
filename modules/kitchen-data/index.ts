/**
 * Kitchen Data Module - Public API
 * 
 * The foundational module for kitchen data management (units, aisles, canonical items, categories).
 * This module is imported by shopping, recipes, and other modules.
 */

// Re-export backend
export { kitchenDataBackend, getKitchenDataBackend } from './backend';
export type { IKitchenDataBackend } from './backend';

// Re-export main module component
export { KitchenDataModule } from './components/KitchenDataModule';
