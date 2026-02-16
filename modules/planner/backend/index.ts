/**
 * Planner Backend Public API
 * 
 * Exports the planner backend singleton and types.
 */

export { FirebasePlannerBackend } from './firebase-planner-backend';
export type { IPlannerBackend } from './planner-backend.interface';
export { BasePlannerBackend } from './base-planner-backend';

// Singleton instance
import { FirebasePlannerBackend } from './firebase-planner-backend';

export const plannerBackend = new FirebasePlannerBackend();
