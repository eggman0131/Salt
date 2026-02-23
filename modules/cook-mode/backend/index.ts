/**
 * Cook Mode Backend - Public API
 * 
 * Provides singleton access to cook mode backend.
 */

import { FirebaseCookModeBackend } from './firebase-cook-mode-backend';
import { ICookModeBackend } from './cook-mode-backend.interface';

let backendInstance: ICookModeBackend;

/**
 * Get the cook mode backend instance.
 */
export function getCookModeBackend(): ICookModeBackend {
  if (!backendInstance) {
    backendInstance = new FirebaseCookModeBackend();
  }
  return backendInstance;
}

export const cookModeBackend = getCookModeBackend();

export type { ICookModeBackend };
