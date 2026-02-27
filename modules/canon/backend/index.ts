/**
 * Canon Backend Public API
 *
 * Exports the canon backend singleton based on environment configuration.
 */

import { FirebaseCanonBackend } from './firebase-canon-backend';
import { ICanonBackend } from './canon-backend.interface';

const createCanonBackend = (): ICanonBackend => {
  const backendMode = import.meta.env.VITE_BACKEND_MODE || 'firebase';

  switch (backendMode) {
    case 'firebase':
      return new FirebaseCanonBackend();

    case 'simulation':
      // TODO: Add SimulationCanonBackend when needed
      throw new Error('Simulation backend not yet implemented for canon module');

    default:
      throw new Error(`Unknown backend mode: ${backendMode}`);
  }
};

export const canonBackend: ICanonBackend = createCanonBackend();

export type { ICanonBackend };
export { BaseCanonBackend } from './base-canon-backend';
export { FirebaseCanonBackend } from './firebase-canon-backend';
