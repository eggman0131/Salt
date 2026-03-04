# Admin Module Integration Guide

## Quick Start

The new admin module is ready to use. Here's how to integrate it:

### Option 1: Test in Isolation (Recommended for Development)

Create a standalone admin page route:

```tsx
// In App.tsx or your router
import { AdminDashboard } from './modules_new/admin';

// Add to your routes:
{activeTab === 'admin-new' && <AdminDashboard />}
```

### Option 2: Replace Old Admin Module (Future)

When ready to fully migrate:

```tsx
// App.tsx - Replace this:
import { AdminModule } from './modules/admin';

// With this:
import { AdminDashboard } from './modules_new/admin';

// Then replace the component:
<AdminDashboard /> // instead of <AdminModule />
```

---

## How It Works

### 1. Domain modules expose admin tools via manifests

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

### 2. Admin module dynamically loads all manifests

The `manifest-loader.ts` imports manifests from all `modules_new/` modules:

```typescript
import { canonAdminTools } from '../../canon/admin.manifest';
import { categoryAdminTools } from '../../categories/admin.manifest';
```

### 3. Dashboard renders tools in tabs

The `AdminDashboard` component:
- Groups tools by module (canon, categories, etc.)
- Creates a tab for each module
- Lazy-loads each tool's UI component
- Handles loading states and errors

---

## Adding a New Module's Admin Tools

When creating a new domain module in `modules_new/`:

1. **Create the admin UI component**:
   ```
   modules_new/<module>/ui/admin/<Module>Admin.tsx
   ```

2. **Create the manifest**:
   ```typescript
   // modules_new/<module>/admin.manifest.ts
   export const <module>AdminTools = [
     {
       id: '<module>.<tool>',
       label: 'Tool Name',
       description: 'What this tool does',
       component: () => import('./ui/admin/<Module>Admin').then(m => ({ default: m.<Module>Admin })),
     },
   ];
   ```

3. **Register in manifest-loader**:
   ```typescript
   // modules_new/admin/logic/manifest-loader.ts
   
   // Import the manifest
   import { <module>AdminTools } from '../../<module>/admin.manifest';
   
   // Add to loadAllManifests():
   try {
     const { <module>AdminTools } = await import('../../<module>/admin.manifest');
     manifests.push({
       module: '<module>',
       tools: <module>AdminTools as AdminTool[],
     });
   } catch (err) {
     console.warn('Failed to load <module> admin manifest:', err);
   }
   ```

4. **Done!** The dashboard will automatically render your new tools in a new tab.

---

## Current State

✅ **Modules with admin tools**:
- **Canon** — 3 tools (Items CRUD + Review Queue, Aisles Viewer, Units Viewer)
- **Categories** — 1 tool (Category Management)

---

## Testing

### Unit Tests
```bash
npx vitest run modules_new/admin
```

### Manual Testing
```bash
npm run dev
# Navigate to the admin route
# Should see Canon and Categories tabs
# Click Canon → see Canon Items UI
# Click Categories → see Categories Management UI
```

---

## Architecture Compliance

✅ Follows Salt Architecture (see `docs/salt-architecture.md`)  
✅ Admin owns no domain logic  
✅ Domain modules self-contained  
✅ No hard-coded imports  
✅ Manifest-based dynamic loading  
✅ Pure logic layer (manifest-loader is deterministic)  

---

## Troubleshooting

**"Failed to load manifest" warnings in console:**
- Check the module name matches the import path in `manifest-loader.ts`
- Ensure the manifest file exports the correct variable name
- Verify the component import path is correct (relative to manifest file)

**"Component fails to load" error:**
- Check the component exists at the specified path
- Ensure the component is exported correctly
- Verify the component can render independently

**Empty dashboard:**
- Check `loadAllManifests()` is returning manifests
- Look for errors in the browser console
- Verify at least one module has an `admin.manifest.ts` file
