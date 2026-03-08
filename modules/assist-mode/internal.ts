/**
 * Internal re-exports for use within this module only.
 *
 * Exists to break the circular dependency between api.ts (which re-exports UI)
 * and UI components that need to call data functions.
 * Must NOT be imported by other modules.
 */

export {
  getOrGenerateCookGuide,
  updateCookingStep,
  updatePrepGroups,
  deleteCookGuide,
} from './data/guides-provider';
