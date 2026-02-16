# Admin Module

System administration panel for Salt: backup/restore, debug logging, kitchen directives, and user management.

## Architecture

```
modules/admin/
  ├── components/
  │   └── AdminModule.tsx         # Main admin UI (system state, directives, users, debug)
  ├── index.ts                    # Public API
  └── README.md                   # This file
```

## Key Features

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
