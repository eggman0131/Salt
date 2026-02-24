/**
 * Assist Mode Backend - Public API
 * 
 * Provides singleton access to assist mode backend.
 */

import { FirebaseAssistModeBackend } from './firebase-assist-mode-backend';
import { IAssistModeBackend } from './assist-mode-backend.interface';

let backendInstance: IAssistModeBackend;

/**
 * Get the assist mode backend instance.
 */
export function getAssistModeBackend(): IAssistModeBackend {
  if (!backendInstance) {
    backendInstance = new FirebaseAssistModeBackend();
  }
  return backendInstance;
}

export const assistModeBackend = getAssistModeBackend();

export type { IAssistModeBackend };
