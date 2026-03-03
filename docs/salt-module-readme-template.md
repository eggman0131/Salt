# <Module Name>
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

## Purpose
Describe the domain this module owns and the problems it solves.  
Example: “The Recipes module owns all recipe data, transformations, and UI.”

## Ownership
This module owns:
- All domain data for <module>.
- All business logic for <module>.
- All persistence for <module>.
- All UI for <module>.

This module does **not**:
- Write to any other module’s data.
- Import any other module’s internals.
- Contain cross‑module logic.

## Folder Structure

    api.ts              # Public API (pure functions only)
    types.ts            # Module-specific types
    logic/              # Pure logic only
    data/               # Persistence and I/O only
    ui/                 # Display-only UI
    internal/           # Private helpers
    __tests__/          # Tests
    admin.manifest.ts   # Optional admin tools

## Public API Rules
- All functions in `api.ts` must be pure and synchronous.
- No Firestore, fetch, or cloud functions in `api.ts`.
- `api.ts` may call only this module’s logic.

## Logic Rules
- All business logic lives in `logic/`.
- Logic must be pure and deterministic.
- Logic must not call persistence or UI.

## Persistence Rules
- All I/O lives in `data/`.
- Persistence must not contain business logic.
- Persistence must not reach into other modules.

## UI Rules
- UI must be display‑only.
- UI must call only this module’s public API.
- UI must not contain business logic.

## Types
- All types specific to this module live in `types.ts`.
- Types must not be duplicated across modules.
- Global types live in `types/contract.ts`.

## Admin Tools (Optional)
If this module exposes admin tools, they must be declared in `admin.manifest.ts`:

    export const adminTools = [
      {
        id: "<module>.toolName",
        label: "Human-readable name",
        component: () => import("./ui/admin/ToolComponent"),
      }
    ];

Admin tools must not contain domain logic.

## Cross‑Module Interaction
This module may call other modules only through their public APIs.  
This module must not import another module’s internals.

## Architectural Source of Truth
All code in this module must follow the rules defined in `salt-architecture.md`.