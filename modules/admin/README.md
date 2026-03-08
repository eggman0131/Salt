# Admin
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

**Module Type:** System — not a domain module.

## Purpose

The admin module provides a centralised dashboard for system configuration and cross-domain admin tools. It contains no domain logic. Instead, it dynamically loads admin UIs from domain modules via their `admin.manifest.ts` files.

## Ownership

This module owns:
- The admin dashboard UI (`AdminDashboard.tsx`).
- The manifest loader (`logic/manifest-loader.ts`) that aggregates tools from domain modules.
- System-level admin tools: Authorised Users (`UsersAdmin.tsx`), System Settings (`SystemSettingsAdmin.tsx`).

This module does **not**:
- Own any domain data or domain logic.
- Write to any domain module's data.
- Import any domain module's internals.

## Folder Structure

    api.ts                        # Public API — manifest loading helpers
    types.ts                      # AdminTool and AdminManifest types
    logic/
      manifest-loader.ts          # Pure logic: load, flatten, group manifests
    ui/
      AdminDashboard.tsx          # Main entry point — dynamic tool rendering
      UsersAdmin.tsx              # System tool: authorised user management
      SystemSettingsAdmin.tsx     # System tool: kitchen directives and debug mode
    admin.manifest.ts             # Declares system-level tools (users, settings)
    __tests__/
      manifest-loader.spec.ts     # Tests for manifest loading logic
    README.md                     # This file

## How It Works

### 1. Domain modules declare admin tools

Each domain module may provide an `admin.manifest.ts` that exports an array of `AdminTool` objects with a lazy `component` import.

### 2. Manifest loader aggregates all manifests

`logic/manifest-loader.ts` dynamically imports manifests from all participating modules. Currently loaded from:

- `modules/admin/admin.manifest` — Users, System Settings
- `modules/canon/admin.manifest` — Canon admin tools
- `modules/recipes/admin.manifest` — Storage Cleanup
- `modules/assist-mode/admin.manifest` — Cook Guides management

### 3. Dashboard renders tools dynamically

`AdminDashboard.tsx` calls `loadAllManifests()` on mount, groups tools by module, and lazy-loads each tool's component. No hard-coded domain imports exist in the dashboard.

## Public API

```typescript
loadAllManifests(): Promise<AdminManifest[]>
flattenManifests(manifests: AdminManifest[]): AdminTool[]
groupToolsByModule(manifests: AdminManifest[]): Map<string, AdminTool[]>
findToolById(manifests: AdminManifest[], toolId: string): AdminTool | null

// Types
AdminTool
AdminManifest
```

## Current Admin Tools

| Module | Tool | Description |
|--------|------|-------------|
| admin | Authorised Users | Add, edit, remove users and set display order |
| admin | System Settings | Global kitchen directives and debug mode |
| canon | (multiple) | Canon items, aisles, units, CofID tools, embeddings |
| recipes | Storage Cleanup | Find and delete orphaned recipe images |
| assist-mode | Cook Guides | List, deduplicate, and delete cook guides |

## Adding a New Module's Admin Tools

1. Create `modules/<module>/admin.manifest.ts` and export an array of `AdminTool` objects.
2. Add an import block for the new manifest in `modules/admin/logic/manifest-loader.ts`.
3. The dashboard will automatically render the new tools.

## Public API Rules

- All functions in `api.ts` are pure and synchronous (manifest loader returns Promises but contains no business logic or I/O beyond dynamic imports).
- `api.ts` does not contain domain logic.

## Admin Tools (This Module)

Declared in `admin.manifest.ts`:

    export const adminAdminTools = [
      { id: "admin.users",           label: "Authorised Users", ... },
      { id: "admin.system-settings", label: "System Settings",  ... },
    ];

## Testing

```bash
npx vitest run modules/admin
```

Tests in `__tests__/manifest-loader.spec.ts` cover pure manifest loading logic with no Firebase dependencies.

## Dependencies

- `modules/canon/admin.manifest` — Canon admin tools
- `modules/recipes/admin.manifest` — Storage Cleanup tool
- `modules/assist-mode/admin.manifest` — Cook Guides tool
- `types.ts` — `AdminTool`, `AdminManifest`

## Architectural Source of Truth

All code in this module must follow the rules defined in `docs/salt-architecture.md`.
