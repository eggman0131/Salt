/**
 * Admin Module — Types
 *
 * Type definitions for the admin manifest system.
 */

import { ComponentType } from 'react';

/**
 * A single admin tool exposed by a domain module.
 */
export interface AdminTool {
  /** Unique identifier (e.g., "canon.items", "categories.management") */
  id: string;

  /** Display label for the tool */
  label: string;

  /** Brief description of what the tool does */
  description: string;

  /** Lazy-loaded component returning the tool's UI */
  component: () => Promise<{ default: ComponentType }>;
}

/**
 * Collection of admin tools from a single module.
 */
export interface AdminManifest {
  /** Module name (e.g., "canon", "categories") */
  module: string;

  /** Tools exposed by this module */
  tools: AdminTool[];
}
