/**
 * Admin Module — Public API
 *
 * Exposes admin manifest loading for the admin UI.
 */

export { loadAllManifests, flattenManifests, groupToolsByModule, findToolById } from './logic/manifest-loader';
export type { AdminTool, AdminManifest } from './types';
