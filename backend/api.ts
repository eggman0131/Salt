/**
 * !!! PROTECTION LOCK !!!
 * FILE: backend/api.ts
 * ROLE: The Gatekeeper
 * 
 * DO NOT MODIFY THIS FILE WITHOUT EXPLICIT USER CONSENT.
 * This file manages the Firebase backend initialization.
 */

import { ISaltBackend } from '../types/contract';
import { SaltFirebaseBackend } from './firebase-backend';
import { debugLogger } from './debug-logger';

/**
 * SALT BACKEND CONFIGURATION
 */
export const saltBackend: ISaltBackend = new SaltFirebaseBackend();

/**
 * Retrieves the currently active backend mode for UI labels.
 */
export function getActiveBackendMode(): string {
  return 'firebase';
}

console.log('SALT: Initialised with FIREBASE backend.');

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