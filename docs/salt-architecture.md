# Salt Architecture Overview
The canonical architecture specification for Salt.

Salt is a modular application built around strict ownership boundaries, pure logic contracts, and predictable patterns for persistence and UI. This document defines the authoritative architectural model that GitHub Copilot should follow when generating or modifying code within the Salt codebase.

## Table of Contents
1. Architectural Model
2. Standard Module Structure
3. Module Rules
4. Module Interaction Model
5. Admin Manifest Model
6. Architectural Guarantees

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

A domain module:

- owns its domain data and persistence  
- owns its logic and transformations  
- owns its UI  
- exposes a pure, typed public API  
- never writes another module’s data  
- never imports another module’s internals  

### Service Modules
Service modules provide cross‑cutting functionality without owning domain data.

The primary service module is:

- ai — stateless conversational engine that returns drafts, improvements, or cook guides

A service module:

- owns no persistence  
- exposes pure logic only  
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

    modules/<module>/
      api.ts              # Public contract: pure functions only
      types.ts            # Module-specific types (if not in shared contract)
      logic/              # Pure logic: transformations, validation, derivations
      data/               # Persistence: Firestore, cloud functions, fetchers
      ui/                 # Display-only UI: components, screens, pages
      internal/           # Private helpers not exposed outside the module
      __tests__/          # Tests for logic and data
      admin.manifest.ts   # Optional: admin tools exposed by this module
      README.md           # Module contract for Copilot

This structure ensures:

- logic is isolated  
- persistence is isolated  
- UI is isolated  
- the public API is the only entry point  
- Copilot always knows where to place new code  

---

## 3. Module Rules

### Ownership
- A module owns its domain data and persistence.  
- A module never writes another module’s data.  
- A module never imports another module’s internals.  
- A module’s UI only interacts with its own API.  

### Public API (api.ts)
- Exposes pure, synchronous functions only.  
- Accepts raw or contract‑typed inputs.  
- Returns structured outputs.  
- Contains no I/O.  
- Contains no cross‑module calls.  

### Logic (logic/)
- Contains all business logic.  
- Must be pure, deterministic, and side‑effect‑free.  
- Must not call persistence or cloud functions.  

### Persistence (data/)
- Contains all I/O.  
- Must be owned by the module that owns the data.  
- Must not contain business logic.  
- Must call AI only via shared cloud functions.  

### UI (ui/)
- Must be display‑only.  
- Must not contain business logic.  
- Must call only the module’s public API.  

### Types
- Shared types live in /types/contract.ts.  
- Module‑specific types live in types.ts.  
- Types must not be duplicated across modules.  

### Admin
- Admin owns system‑level tools only.  
- Domain modules expose admin tools via admin.manifest.ts.  
- Admin mounts these tools but does not own their logic.  

---

## 4. Module Interaction Model

Salt uses a strict, predictable interaction model:

- Domain modules call each other only through public APIs.  
- Service modules return data to the owning domain module.  
- System modules never call domain internals.  
- UI never calls logic or persistence directly.  
- Persistence never calls logic directly.  
- Logic never calls persistence or UI.  

This ensures modules remain replaceable and predictable.

---

## 5. Admin Manifest Model

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

- no hard‑coded imports  
- no cross‑module coupling  
- no domain logic inside Admin  
- a scalable pattern as Salt grows  

---

## 6. Architectural Guarantees

This architecture ensures:

- A module’s UI can be replaced without touching logic.  
- A module’s logic can be replaced without touching UI.  
- A module can be replaced entirely without breaking the app.  
- AI calls are centralised and predictable.  
- Copilot can safely refactor and extend the system.  
- Logic remains testable and deterministic.  
- Boundaries remain clear as Salt grows.  

Salt becomes a stable, modular platform rather than a tangle of features.
