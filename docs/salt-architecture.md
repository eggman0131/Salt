# Salt Architecture Overview
The canonical architecture specification for Salt.

Salt is a modular application built around strict ownership boundaries, pure logic contracts, and predictable patterns for persistence and UI. This document is the authoritative architectural model that AI coding agents must follow when generating or modifying code within the Salt codebase.

**Compliance note:** Only code under `modules_new/` conforms to this architecture. Code under `modules/` is legacy and is being migrated. All new code must be written in `modules_new/`. Do not create new files under `modules/`.

## Table of Contents
1. Architectural Model
2. Standard Module Structure
3. Module Rules
4. Module Interaction Model
5. Shared Layer
6. Admin Manifest Model
7. Architectural Guarantees
8. Migration Rules

---

## 1. Architectural Model

Salt is composed of three kinds of modules: **domain modules**, **service modules**, and **system modules**. Each type has a clear role and strict boundaries.

### Domain Modules
Domain modules own a specific domain within Salt. Examples include:

- recipes
- canon
- shopping
- planner
- inventory
- assist-mode
- categories

A domain module:

- owns its domain data and persistence
- owns its logic and transformations
- owns its UI
- exposes a typed public API (`api.ts`) as its only external interface
- never writes another module's data
- never imports another module's internals
- is self-sufficient: it can be updated or replaced entirely without breaking the app, provided its `api.ts` interface is preserved

### Service Modules
Service modules provide cross‑cutting functionality without owning domain data.

The primary service module is:

- ai — stateless conversational engine that returns drafts, improvements, or cook guides

A service module:

- owns no persistence
- exposes pure functions only
- returns data to the caller for persistence
- never writes to the database
- never calls domain internals

### System Modules
System modules own system‑wide operations that span multiple domains.

The primary system module is:

- admin — backup/restore, schema enumeration, cross‑domain data browser, system logs, health checks

A system module:

- owns system‑level logic only
- must not contain domain logic
- hosts admin UIs from domain modules via a manifest
- exposes system‑level APIs only

---

## 2. Standard Module Structure

Every module follows the same folder layout:

    modules_new/<module>/
      api.ts              # Public contract: the only file other modules may import
      types.ts            # Module-specific types not shared across modules
      logic/              # Pure logic: transformations, validation, derivations
      data/               # Persistence: Firestore reads/writes, Firebase Function calls
      ui/                 # Display-only UI: components, screens, pages
      internal/           # Private helpers, internal types, and implementation details
      __tests__/          # Tests for logic and data
      admin.manifest.ts   # Optional: admin tools exposed by this module
      README.md           # Module contract: public API, owned data, dependencies

This structure ensures:

- logic is isolated and testable
- persistence is isolated and replaceable
- UI is isolated and replaceable
- `api.ts` is the only entry point any other module may use
- there is always a clear, unambiguous location for new code

---

## 3. Module Rules

### Ownership
- A module owns its domain data and persistence.
- A module never writes another module's data.
- A module never imports from another module's `logic/`, `data/`, `ui/`, or `internal/`.
- A module's UI only calls functions exposed by its own `api.ts`.

### Public API (api.ts)
`api.ts` is the module's public contract. It is the **only file other modules may import**.

- Re-exports or wraps functions from `logic/` and `data/` as needed.
- Accepts contract-typed inputs (from `types/contract.ts` or `types.ts`).
- Returns structured, typed outputs.
- Does not contain inline business logic — delegates to `logic/`.
- Does not contain inline I/O — delegates to `data/`.
- May call Firebase Functions in `functions/` for AI or compute-heavy operations.

### Logic (logic/)
- Contains all business logic for the module.
- Must be pure, deterministic, and side‑effect‑free.
- Must not call Firestore, Firebase Functions, or any I/O.
- May call other modules only via their `api.ts` if the result is passed in as a parameter (i.e. logic is injected, not fetched).

### Persistence (data/)
- Contains all I/O: Firestore reads/writes and Firebase Function calls.
- Must be owned by the module that owns the data.
- Must not contain business logic — delegates all transformations to `logic/`.
- May call Firebase Functions located in `functions/` for AI-powered or compute-heavy operations.
- May call other domain modules via their `api.ts` for read-only lookups needed to fulfil this module's own persistence operations.

### UI (ui/)
- Must be display‑only.
- Must not contain business logic or I/O.
- Must call only this module's `api.ts` — never `logic/` or `data/` directly.
- May import from `shared/` for UI components, utilities, and configuration.

### Types
- Shared contract types live in `types/contract.ts` — the single source of truth for data shapes crossing module boundaries.
- Module-specific public types live in `types.ts` and are exported via `api.ts`.
- Internal implementation types (not exposed outside the module) live in `internal/`.
- Types must not be duplicated across modules.

### Internal (internal/)
- Contains private helpers, internal type definitions, and implementation details used only within this module.
- Must never be imported by any other module.
- Use this layer for complex internal types, intermediate schemas, or helper utilities that do not belong in `logic/` or `data/` but are not part of the public API.

### Admin
- Admin owns system‑level tools only.
- Domain modules expose admin tools via `admin.manifest.ts`.
- Admin mounts these tools dynamically but does not own their logic.

---

## 4. Module Interaction Model

Salt uses a strict, predictable interaction model:

- **Domain → Domain:** A module may call another domain module's `api.ts` for read-only lookups. It must never import that module's internals or write its data.
- **Domain → Service:** A domain module calls a service module's `api.ts` and is responsible for persisting any returned data.
- **Domain → Firebase Functions:** A module's `data/` layer may call Firebase Functions in `functions/` for AI-powered or compute-heavy operations.
- **System → Domain:** System modules call domain modules only via their `api.ts`. Never via internals.
- **UI → Module:** UI calls only its own module's `api.ts`. Never `logic/` or `data/` directly.
- **Logic → Logic:** Pure logic may call other pure logic within the same module. Cross-module logic must go through `api.ts`.

The key principle: **a module's `api.ts` is its only public surface**. Any change inside a module that does not alter its `api.ts` signature is safe and isolated by definition.

---

## 5. Shared Layer

The `shared/` directory provides standardised, cross-cutting resources that any module may use. It is **not a module** — it owns no domain data, no business logic, and no persistence.

### What belongs in shared/

    shared/
      components/         # Reusable UI primitives (buttons, inputs, modals, badges, cards)
      providers/          # React context providers (auth, theme, admin refresh, etc.)
      hooks/              # Reusable React hooks with no domain logic
      utils/              # Pure utility functions (formatting, date handling, string helpers)
      config/             # App-wide configuration constants (feature flags, environment values)

### Rules for shared/

- `shared/` must contain **no domain logic** and **no domain types**.
- `shared/` must contain **no Firestore or Firebase Function calls**.
- `shared/components/` provides UI primitives only — not domain-specific components. Domain components live inside their module's `ui/`.
- `shared/utils/` contains pure utility functions only. Any function with domain knowledge does not belong here.
- Any module may import from `shared/` freely — it is the one exception to the no-cross-module-import rule.
- `shared/` must never import from any module.

### How to use shared/

Import directly by path:

    import { Button } from "shared/components/Button";
    import { formatDate } from "shared/utils/formatDate";
    import { useAuth } from "shared/providers/AuthProvider";

Do not re-export `shared/` items through a module's `api.ts`. Consumers import from `shared/` directly.

---

## 6. Admin Manifest Model

Domain modules may expose admin tools by providing a manifest. Admin loads these manifests and mounts the tools dynamically.

Example manifest entry:

    export const adminTools = [
      {
        id: "recipes.cleanupImages",
        label: "Delete Orphaned Recipe Images",
        component: () => import("./ui/admin/CleanupImages"),
      }
    ];

This allows:

- no hard‑coded imports in Admin
- no cross‑module coupling
- no domain logic inside Admin
- a scalable pattern as Salt grows

---

## 7. Architectural Guarantees

This architecture ensures:

- A module's UI can be replaced without touching logic.
- A module's logic can be replaced without touching UI.
- A module can be replaced entirely without breaking the app, provided its `api.ts` interface is preserved.
- Firebase Function calls are owned by module `data/` layers — AI and compute operations remain centralised and predictable.
- Logic remains pure, testable, and deterministic.
- Boundaries remain enforceable by static analysis as Salt grows.

Salt becomes a stable, modular platform rather than a tangle of features.

---

## 8. Migration Rules

Salt is migrating from `modules/` (legacy) to `modules_new/` (this architecture).

- **All new code must be written in `modules_new/`.**
- Do not create new files under `modules/` unless strictly required for a temporary integration shim while a module is mid-migration.
- Migrations do not need to maintain continuous functionality. A module under migration may be partially broken during the migration. It must work correctly when the migration is complete.
- When a module is fully migrated, its legacy counterpart under `modules/` must be deleted.
- The migration order is at the discretion of the project owner. Prioritise modules that have the most dependents or the most active development.
