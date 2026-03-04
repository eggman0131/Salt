# Admin Module (System Module)

System-level admin dashboard that dynamically loads admin tools from domain modules.

**Module Type:** System  
**Ownership:** System-level operations only  
**Architecture Pattern:** Manifest-based dynamic loading

---

## Purpose

The admin module provides a centralized dashboard for managing domain data and system configuration. It does **not** contain domain logic — instead, it dynamically loads admin UIs from domain modules via their `admin.manifest.ts` files.

---

## Architecture

```
modules_new/admin/
├── api.ts                     # Public API — manifest loading helpers
├── types.ts                   # AdminTool and AdminManifest types
├── logic/
│   └── manifest-loader.ts     # Pure logic for loading manifests
├── ui/
│   └── AdminDashboard.tsx     # Main dashboard with dynamic tool rendering
├── README.md                  # This file
└── __tests__/                 # Tests for manifest loading logic
```

---

## How It Works

### 1. Domain modules expose admin tools

Each domain module can optionally provide an `admin.manifest.ts`:

```typescript
// modules_new/canon/admin.manifest.ts
export const canonAdminTools = [
  {
    id: 'canon.items',
    label: 'Canon Items',
    description: 'Manage canonical items with full CRUD and review queue.',
    component: () => import('./ui/admin/CanonItemsAdmin').then(m => ({ default: m.CanonItemsAdmin })),
  },
];
```

### 2. Admin module loads manifests dynamically

The `manifest-loader.ts` imports and aggregates all manifests:

```typescript
import { canonAdminTools } from '../../canon/admin.manifest';
import { categoryAdminTools } from '../../categories/admin.manifest';
```

### 3. Dashboard renders tools dynamically

The `AdminDashboard.tsx` component:
- Loads all manifests on mount
- Groups tools by module
- Renders tabs for each module
- Lazy-loads each tool's component

---

## Module Guarantees

✅ **No domain logic** — Admin only loads and displays domain UIs  
✅ **No hard-coded imports** — Tools are loaded dynamically via manifests  
✅ **No cross-module coupling** — Domain modules are self-contained  
✅ **Scalable pattern** — Adding a new tool only requires updating the manifest loader  
✅ **Pure logic layer** — `manifest-loader.ts` is deterministic and testable  

---

## Adding a New Domain Module's Admin Tools

1. Create `modules_new/<module>/admin.manifest.ts`
2. Export an array of `AdminTool` objects
3. Update `modules_new/admin/logic/manifest-loader.ts` to import the manifest
4. The dashboard will automatically render the new tools

---

## Architectural Compliance

This module follows the **Admin Manifest Model** defined in `docs/salt-architecture.md`:

- Admin owns system-level tools only ✅
- Domain modules expose admin tools via manifests ✅
- Admin mounts these tools but does not own their logic ✅
- No hard-coded imports ✅
- A scalable pattern as Salt grows ✅

---

## Current Supported Modules

- **Canon** — Canon Items CRUD + Review Queue, Aisles Viewer, Units Viewer
- **Categories** — Category Management with approval workflow

---

## Testing

```bash
# Test manifest loading logic
npx vitest run modules_new/admin

# Manual testing
npm run dev
# Navigate to /admin
```

---

## Dependencies

- `modules_new/canon/admin.manifest.ts` — Canon admin tools
- `modules_new/categories/admin.manifest.ts` — Categories admin tools
- `@/components/ui/*` — shadcn/ui components
- `types.ts` — AdminTool and AdminManifest types
