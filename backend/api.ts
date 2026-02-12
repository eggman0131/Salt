/**
 * !!! PROTECTION LOCK !!!
 * FILE: backend/api.ts
 * ROLE: The Switcher (Gatekeeper)
 * 
 * DO NOT MODIFY THIS FILE WITHOUT EXPLICIT USER CONSENT.
 * This file manages the environment-based switching between Simulation and Firebase.
 */

import { ISaltBackend } from '../types/contract';
import { SaltSimulatedBackend } from './simulated';
import { SaltFirebaseBackend } from './firebase-backend';
import { debugLogger } from './debug-logger';

/**
 * SALT BACKEND CONFIGURATION
 */
const BACKEND_MODE = (import.meta as any).env?.VITE_BACKEND_MODE || 'simulation';

export const saltBackend: ISaltBackend = BACKEND_MODE === 'firebase' 
  ? new SaltFirebaseBackend() 
  : new SaltSimulatedBackend();

/**
 * Retrieves the currently active backend mode for UI labels.
 */
export function getActiveBackendMode(): string {
  return BACKEND_MODE;
}

console.log(`SALT: Initialised with ${BACKEND_MODE.toUpperCase()} backend.`);

// Initialize debug logger state from settings
(async () => {
  try {
    const settings = await saltBackend.getKitchenSettings();
    debugLogger.setEnabled(settings.debugEnabled || false);
  } catch (e) {
    // Settings not available yet, keep debug disabled
  }
})();

export function sanitizeJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1) {
      const startArr = text.indexOf('[');
      const endArr = text.lastIndexOf(']');
      return startArr !== -1 && endArr !== -1 ? text.substring(startArr, endArr + 1) : text.trim();
  }
  return start !== -1 && end !== -1 ? text.substring(start, end + 1) : text.trim();
}