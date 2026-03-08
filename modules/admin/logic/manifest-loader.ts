/**
 * Admin Module — Manifest Loader (Pure Logic)
 *
 * Loads and aggregates admin manifests from domain modules.
 * This is pure logic — it imports manifests but contains no I/O or side effects.
 */

import { AdminManifest, AdminTool } from '../types';

/**
 * Load all admin manifests from modules domain modules.
 * Returns a flat list of manifests.
 */
export async function loadAllManifests(): Promise<AdminManifest[]> {
  const manifests: AdminManifest[] = [];

  // Admin module (users, system)
  try {
    const { adminAdminTools } = await import('../admin.manifest');
    manifests.push({
      module: 'admin',
      tools: adminAdminTools as AdminTool[],
    });
  } catch (err) {
    console.warn('Failed to load admin manifest:', err);
  }

  // Canon module
  try {
    const { canonAdminTools } = await import('../../canon/admin.manifest');
    manifests.push({
      module: 'canon',
      tools: canonAdminTools as AdminTool[],
    });
  } catch (err) {
    console.warn('Failed to load canon admin manifest:', err);
  }

  // Recipes module
  try {
    const { recipesAdminTools } = await import('../../recipes/admin.manifest');
    manifests.push({
      module: 'recipes',
      tools: recipesAdminTools as AdminTool[],
    });
  } catch (err) {
    console.warn('Failed to load recipes admin manifest:', err);
  }

  // Assist Mode module
  try {
    const { assistModeAdminTools } = await import('../../assist-mode/admin.manifest');
    manifests.push({
      module: 'assist-mode',
      tools: assistModeAdminTools as AdminTool[],
    });
  } catch (err) {
    console.warn('Failed to load assist-mode admin manifest:', err);
  }

  return manifests;
}

/**
 * Flatten all manifests into a single list of admin tools.
 */
export function flattenManifests(manifests: AdminManifest[]): AdminTool[] {
  return manifests.flatMap(m => m.tools);
}

/**
 * Group tools by module for organized display.
 */
export function groupToolsByModule(manifests: AdminManifest[]): Map<string, AdminTool[]> {
  const groups = new Map<string, AdminTool[]>();
  
  for (const manifest of manifests) {
    groups.set(manifest.module, manifest.tools);
  }
  
  return groups;
}

/**
 * Find a specific tool by ID.
 */
export function findToolById(manifests: AdminManifest[], toolId: string): AdminTool | null {
  for (const manifest of manifests) {
    const tool = manifest.tools.find(t => t.id === toolId);
    if (tool) return tool;
  }
  return null;
}
