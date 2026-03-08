/**
 * Admin Module — Manifest Loader Tests
 *
 * Tests for the manifest loading logic.
 */

import { describe, it, expect } from 'vitest';
import { loadAllManifests, flattenManifests, groupToolsByModule, findToolById } from '../logic/manifest-loader';

describe('Manifest Loader', () => {
  it('loads all available manifests', async () => {
    const manifests = await loadAllManifests();

    // admin, canon, recipes, assist-mode
    expect(manifests.length).toBeGreaterThanOrEqual(2);

    const moduleNames = manifests.map(m => m.module);
    expect(moduleNames).toContain('admin');
    expect(moduleNames).toContain('canon');
    expect(moduleNames).toContain('recipes');
    expect(moduleNames).toContain('assist-mode');
    // categories is no longer in admin — it lives in the recipes UI sheet
    expect(moduleNames).not.toContain('categories');
  });

  it('flattens manifests into a single tool list', async () => {
    const manifests = await loadAllManifests();
    const tools = flattenManifests(manifests);
    
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty('id');
    expect(tools[0]).toHaveProperty('label');
    expect(tools[0]).toHaveProperty('description');
    expect(tools[0]).toHaveProperty('component');
  });

  it('groups tools by module', async () => {
    const manifests = await loadAllManifests();
    const grouped = groupToolsByModule(manifests);
    
    expect(grouped.size).toBeGreaterThanOrEqual(2);
    expect(grouped.has('admin')).toBe(true);
    expect(grouped.has('canon')).toBe(true);
    expect(grouped.has('recipes')).toBe(true);
    expect(grouped.has('categories')).toBe(false);
  });

  it('finds a tool by ID', async () => {
    const manifests = await loadAllManifests();

    // Canon operational tooling remains in Admin.
    const canonSeeder = findToolById(manifests, 'canon.seeder');
    expect(canonSeeder).toBeTruthy();
    expect(canonSeeder?.label).toBe('Canon Seeder');

    // Canon catalogue management is now in dedicated nav, not Admin.
    expect(findToolById(manifests, 'canon.items')).toBeNull();
  });

  it('returns null for non-existent tool ID', async () => {
    const manifests = await loadAllManifests();
    const nonExistent = findToolById(manifests, 'non.existent.tool');
    expect(nonExistent).toBeNull();
  });
});
