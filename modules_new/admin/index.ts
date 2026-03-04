/**
 * Admin Module — Public Exports
 *
 * Re-exports the admin dashboard and manifest loading utilities.
 */

export { AdminDashboard } from './ui/AdminDashboard';
export { loadAllManifests, flattenManifests, groupToolsByModule, findToolById } from './api';
export type { AdminTool, AdminManifest } from './types';
