# Planner
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

## Purpose

The planner module manages weekly meal planning. Each plan records who is cooking, who is present, meal notes, and user-specific notes for a given week. It also owns kitchen settings, which control the display order of users and AI cooking directives.

## Ownership

This module owns:
- The `plans` Firestore collection (`Plan` documents).
- Kitchen settings read/write from the `settings` collection.
- All plan logic: finding plans by date, ordering users, sanitising stale user data.

This module does **not**:
- Write to any other module's data.
- Import any other module's internals.
- Expose an admin manifest — planner management is in the main UI.

## Folder Structure

    api.ts                          # Public API
    types.ts                        # Module-specific types
    logic/
      plan-utils.ts                 # Pure: findPlanForDate, getOrderedUserIds, sanitizePlan
      dates.ts                      # Pure: getFriday, addDays, TEMPLATE_ID
    data/
      plans-provider.ts             # Firestore CRUD for plans
      settings-provider.ts          # Kitchen settings read/write
    ui/                             # Weekly planner UI
    __tests__/
      logic.test.ts                 # Pure logic tests

## Public API

### Plans CRUD

```typescript
getPlans(): Promise<Plan[]>
getPlanByDate(date: Date): Promise<Plan | null>
createOrUpdatePlan(plan: Plan): Promise<Plan>
deletePlan(id: string): Promise<void>
```

### Kitchen Settings

Kitchen settings control the user display order (used by the planner UI and AI directives).

```typescript
getKitchenSettings(): Promise<KitchenSettings>
updateKitchenSettings(updates: Partial<KitchenSettings>): Promise<void>
```

### Pure Logic Helpers

```typescript
// Find the plan that covers a given date
findPlanForDate(plans: Plan[], date: Date): Plan | undefined

// Return user IDs in the order defined by KitchenSettings.userOrder
getOrderedUserIds(userIds: string[], settings: KitchenSettings): string[]

// Remove deleted users from plan data
sanitizePlan(plan: Plan, activeUserIds: string[]): Plan

// Date utilities
getFriday(date: Date): Date
addDays(date: Date, days: number): Date
TEMPLATE_ID: string  // Well-known ID for the plan template
```

## Types

- `Plan`, `DayPlan` — from `types/contract.ts`.
- `KitchenSettings` — defines `userOrder` (array of user IDs) and kitchen directives for AI.

## Testing

```bash
npx vitest run modules/planner/__tests__/logic.test.ts
```

Pure functions only — no Firebase, no mocks, no network.

## Dependencies

- `types/contract.ts` — `Plan`, `DayPlan`, `KitchenSettings`
- Firebase Firestore

## Architectural Source of Truth

All code in this module must follow the rules defined in `docs/salt-architecture.md`.
