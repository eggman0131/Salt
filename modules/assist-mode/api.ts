/**
 * Assist Mode module public API.
 *
 * Single entry point for all assist mode operations.
 * Consumers must only import from this file, not from data/ or logic/ directly.
 */

export {
  getOrGenerateCookGuide,
  generateCookGuide,
  regenerateCookGuide,
  isGuideStale,
  getCookGuide,
  updateCookingStep,
  updatePrepGroups,
  deleteCookGuide,
  getAllCookGuides,
  getCookGuidesForRecipe,
} from './data/guides-provider';

export type { CookGuide, PrepGroup, CookingStep, SensoryCues } from './types';

export { CookModeModule } from './ui/CookModeModule';
