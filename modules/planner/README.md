# Planner Module

Manages weekly meal planning for domestic kitchens, coordinating cook assignments and day-by-day meal organisation.

## Architecture

```
modules/planner/
  ├── backend/
  │   ├── planner-backend.interface.ts     # IPlannerBackend contract
  │   ├── base-planner-backend.ts          # Domain logic (extends IPlannerBackend)
  │   ├── firebase-planner-backend.ts      # Firebase persistence (extends BasePlannerBackend)
  │   └── index.ts                         # Exports plannerBackend singleton
  ├── components/
  │   └── PlannerModule.tsx                # Main meal planning UI
  ├── index.ts                             # Public API
  └── README.md                            # This file
```

## Backend Overview

### IPlannerBackend
Defines 6 core methods:
- **Plans CRUD:** `getPlans()`, `getPlanByDate()`, `createOrUpdatePlan()`, `deletePlan()`
- **Settings:** `getKitchenSettings()`, `updateKitchenSettings()`

### BasePlannerBackend
Implements helper methods:
- **getPlanIncludingDate():** Find plan containing a specific date (for date range queries)
- **getOrderedUserIds():** Extract user order from kitchen settings

### FirebasePlannerBackend
Implements persistence using Firebase Firestore:
- Stores plans in `plans` collection with deterministic IDs (e.g., `plan-2025-02-16` or `plan-template`)
- Stores global settings in `settings/global` document
- Uses transactions for atomic plan updates
- Tracks creation metadata (`createdAt`, `createdBy`)

## Usage

### Component Usage
```typescript
import { PlannerModule, plannerBackend } from '../modules/planner';

// In parent component
const [allUsers, setAllUsers] = useState<User[]>([]);
const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

useEffect(() => {
  plannerBackend.getPlanByDate(startDate).then(setCurrentPlan);
}, [startDate]);

<PlannerModule 
  users={allUsers} 
  onRefresh={() => loadData()}
/>
```

### Direct Backend Usage
```typescript
// Get all plans (most recent first)
const plans = await plannerBackend.getPlans();

// Get plan for specific date
const plan = await plannerBackend.getPlanByDate('2025-02-16');

// Create or update plan
const updated = await plannerBackend.createOrUpdatePlan({
  startDate: '2025-02-16',
  days: [
    { date: '2025-02-16', cookId: 'user-1', presentIds: ['user-1', 'user-2'], mealNotes: '', userNotes: {} },
    // ... 6 more days
  ]
});

// Delete plan
await plannerBackend.deletePlan('plan-2025-02-16');

// Get and update user preferences (user order)
const settings = await plannerBackend.getKitchenSettings();
const newSettings = { ...settings, userOrder: ['user-2', 'user-1'] };
await plannerBackend.updateKitchenSettings(newSettings);
```

## Plan Model

```typescript
interface Plan {
  id: string;                 // e.g., 'plan-2025-02-16' or 'plan-template'
  startDate: string;          // ISO date (YYYY-MM-DD) or 'template'
  days: DayPlan[];           // Array of 7 days
  createdAt: string;         // ISO timestamp
  createdBy: string;         // User ID
  imagePath?: string;        // Optional image path
}

interface DayPlan {
  date: string;              // ISO date or 'day-X'
  cookId: string | null;     // User ID of designated cook (or null)
  presentIds: string[];      // User IDs present that day
  mealNotes: string;         // Special meal notes
  userNotes: Record<string, string>; // Per-user notes
}
```

## Kitchen Settings Model

```typescript
interface KitchenSettings {
  directives: string;        // Custom kitchen instructions
  userOrder?: string[];      // Preferred user ordering for UI
  debugEnabled?: boolean;    // Debug mode flag
}
```

## Weekly Planning Workflow

1. **Load Current Week:**
   - User navigates to a date → `getFriday()` normalises to the week's start
   - `getPlanByDate()` retrieves the existing plan (or template if new)

2. **Edit Plan:**
   - User assigns cook for each day
   - User adds/removes attending users
   - Real-time save with debouncing (1200ms)
   - `createOrUpdatePlan()` persists changes

3. **Template:**
   - Special `plan-template` document for new weeks
   - Automatically used as base for new plans
   - Can be customised for consistent defaults

4. **User Preferences:**
   - `getKitchenSettings().userOrder` re-orders users in planner UI
   - Drag-to-reorder interface updates preference
   - `updateKitchenSettings()` persists new order

## Data Flow

```
Component (PlannerModule)
  ↓
plannerBackend (singleton)
  ├─ getPlans() ← Firestore: /plans/* (ordered by startDate desc)
  ├─ getPlanByDate() ← Firestore: /plans/{deterministicId}
  ├─ createOrUpdatePlan() → Firestore: /plans/{deterministicId} (transaction)
  ├─ deletePlan() → Firestore: /plans/{deterministicId}
  ├─ getKitchenSettings() ← Firestore: /settings/global
  └─ updateKitchenSettings() → Firestore: /settings/global (merge)
```

## Date Handling

All dates use ISO 8601 format (YYYY-MM-DD) in UTC:
- Week always starts on Friday (`getFriday()` normalisation)
- Timezone-aware: dates parsed as UTC midnight to prevent day shifts
- Template uses `startDate: 'template'` as sentinel value

## Error Handling

- Invalid JSON responses → return empty/default values
- Network errors → bubble up to component  
- Transaction failures → rollback and retry
- Missing settings → return defaults (`directives: '', debugEnabled: false`)

## Future Enhancements

- [ ] Recurring plan templates (auto-generate next week)
- [ ] Meal suggestions based on ingredients
- [ ] Notifications to assigned cooks
- [ ] Dietary restriction tracking
- [ ] Shopping list generation from plan
- [ ] Pan-week view / month view
