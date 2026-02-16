/**
 * Shopping Backend Public API
 * 
 * Exports the shopping backend singleton based on environment configuration.
 */

import { FirebaseShoppingBackend } from './firebase-shopping-backend';
import { IShoppingBackend } from './shopping-backend.interface';

// Initialize the appropriate backend implementation
const createShoppingBackend = (): IShoppingBackend => {
  const backendMode = import.meta.env.VITE_BACKEND_MODE || 'firebase';
  
  switch (backendMode) {
    case 'firebase':
      return new FirebaseShoppingBackend();
    
    case 'simulation':
      // TODO: Add SimulationShoppingBackend when needed
      throw new Error('Simulation backend not yet implemented for shopping module');
    
    default:
      throw new Error(`Unknown backend mode: ${backendMode}`);
  }
};

// Singleton instance
export const shoppingBackend: IShoppingBackend = createShoppingBackend();

// Re-export types for convenience
export type { IShoppingBackend };
export { FirebaseShoppingBackend } from './firebase-shopping-backend';
export { BaseShoppingBackend } from './base-shopping-backend';
