/**
 * Assist Mode Module - Public API
 * 
 * Provides access to assist mode backend and components.
 */

// Re-export backend
export { assistModeBackend, getAssistModeBackend } from './backend';
export type { IAssistModeBackend } from './backend';

// Re-export types
export type { CookGuide, PrepGroup, CookingStep, SensoryCues } from './types';

// Re-export main component
export { CookModeModule } from './components/CookModeModule';

// Re-export helper components
export { PrepPhaseView } from './components/PrepPhaseView';
export { CookingStepView } from './components/CookingStepView';
export { ProgressionCheck } from './components/ProgressionCheck';
