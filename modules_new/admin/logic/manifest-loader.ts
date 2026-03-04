/**
 * Admin Module — Manifest Loader (Pure Logic)
 *
 * Loads and aggregates admin manifests from domain modules.
 * This is pure logic — it imports manifests but contains no I/O or side effects.
 */

import { AdminManifest, AdminTool } from '../types';

/**
 * Load all admin manifests from modules_new domain modules.
 * Returns a flat list of manifests.
 */
export async function loadAllManifests(): Promise<AdminManifest[]> {
  const manifests: AdminManifest[] = [];

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

  // Categories module
  try {
    const { categoryAdminTools } = await import('../../categories/admin.manifest');
    manifests.push({
      module: 'categories',
      tools: categoryAdminTools as AdminTool[],
    });
  } catch (err) {
    console.warn('Failed to load categories admin manifest:', err);
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
