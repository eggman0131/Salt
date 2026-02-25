# Admin Module

System administration panel for Salt: backup/restore, debug logging, kitchen directives, and user management.

## Architecture

```
modules/admin/
  ├── backend/
  │   ├── admin-backend.ts       # Storage cleanup and admin functions
  │   └── index.ts               # Backend public API
  ├── components/
  │   └── AdminModule.tsx         # Main admin UI (system state, directives, users, debug)
  ├── index.ts                    # Module public API
  └── README.md                   # This file
```

## Key Features

### Data Portability - Contract-Based Backup System

**Dynamic Collection Registry** - All kitchen data is automatically backed up using `COLLECTION_REGISTRY` in `types/contract.ts`.

**How It Works:**
1. Collection Registry defines all Firestore collections as "The Law"
2. `systemBackend.exportAllData()` dynamically exports all registered collections
3. `systemBackend.importAllData()` dynamically imports all registered collections

**Adding New Collections:**
```typescript
// In types/contract.ts - COLLECTION_REGISTRY
myNewCollection: {
  schema: MyNewSchema,
  requiresEncoding: false  // true if needs nested array encoding like recipes
}
```
That's it! Backup/restore automatically includes it.

**What Gets Backed Up:**
- Recipes (with nested array encoding)
- Equipment inventory
- Meal plans
- Kitchen data (canonical items, units, aisles, categories)
- Shopping lists and items
- **Cook guides** (automatically added via registry)
- Users and settings

**Benefits:**
- ✅ No manual updates needed when adding collections
- ✅ Type-safe with schema validation
- ✅ Follows "Contract is The Law" principle
- ✅ Backward compatible with old backups

### System State Management
- **Backend Mode:** Display current backend (Firebase vs Simulation)
- **Last Synced:** Show timestamp of last backup restore
- **Import/Export:** Trigger data portability (full manifest export)

### Kitchen Directives
- Global AI rules that guide recipe suggestions
- Examples: "Prefer Anova over Rangemaster", "No mushrooms", "Always metric substitutes"
- Auto-saves with 1.2s debounce

### Debug Logging
- Toggle console logging for development
- Affects Backend's internal logging level
- Persistent across sessions via KitchenSettings

### User Management
- Embedded UsersModule for user CRUD
- Add/edit/delete household members
- Manage member preferences

### Storage Cleanup
- Remove orphaned recipe images from Firebase Storage
- Orphaned files are images no longer referenced by any recipe
- Occurs when recipes are deleted or new images replace old ones
- Supports dry-run mode to identify files before deletion

**Usage:**
```typescript
import { cleanupOrphanedRecipeImages } from '../modules/admin';

// Dry run: identify orphaned files without deleting
const stats = await cleanupOrphanedRecipeImages(true);
console.log(`Found ${stats.orphanedFiles.length} orphaned files`);

// Actually delete orphaned files
const results = await cleanupOrphanedRecipeImages(false);
console.log(`Deleted ${results.deletedCount} files`);
```

**Returns `CleanupStats`:**
```typescript
interface CleanupStats {
  totalFiles: number;           // Total files in recipes folder
  orphanedFiles: string[];      // Paths of orphaned image files
  referencedFiles: string[];    // Paths of files still in use
  deletedCount: number;         // Number of files deleted (dryRun=false only)
  errors: string[];             // Any errors encountered
}
```

## Dependencies

### Imports from Other Modules
- **planner module:** `plannerBackend` for `getKitchenSettings()` / `updateKitchenSettings()`

### Re-exported to Parent  
- All backup/restore logic handled by parent (App.tsx)
- Admin module receives `onImport` and `onExport` as props
- Settings persistence handled through plannerBackend

## Usage

### Component Usage
```typescript
import { AdminModule } from '../modules/admin';

// In parent component
<AdminModule
  users={allUsers}
  onRefresh={() => loadData()}
  onImport={handleImport}
  onExport={handleExportData}
  isImporting={isImporting}
  lastSync={lastSync}
/>
```

## Data Model

Kitchen Settings (stored in Firestore `settings/global`):
```typescript
interface KitchenSettings {
  directives: string;        // AI rules (markdown format)
  userOrder?: string[];      // Preferred user ordering
  debugEnabled?: boolean;    // Debug mode flag
}
```

## Design Patterns

### Settings Synchronisation
1. On mount, load current settings via `plannerBackend.getKitchenSettings()`
2. Update state locally
3. On change, debounce 1.2s then `updateKitchenSettings()`
4. Show "Saving..." → "Saved" feedback

### Embedded User Management
- UsersModule rendered directly in right column
- Shared user state with parent component
- OnRefresh propagates to parent for data reload

## Error Handling

- Settings load failures → silent, use defaults
- Settings update failures → console.error, show save status
- Import/export errors → parent component handles

## Future Enhancements

- [ ] Backup schedule automation
- [ ] Version history for settings
- [ ] User activity audit log
- [ ] System health dashboard
- [ ] Export/import scheduling
- [ ] Multi-environment sync (test vs production)
