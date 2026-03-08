# Inventory
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

## Purpose

The inventory module manages kitchen equipment — appliances, cookware, and tools — including their accessories. It provides AI-powered equipment search to find UK equipment models matching user queries.

## Ownership

This module owns:
- The `inventory` Firestore collection (`Equipment` documents).
- All equipment CRUD and AI search logic.

This module does **not**:
- Write to any other module's data.
- Import any other module's internals.
- Expose an admin manifest — equipment management is in the main UI.

## Folder Structure

    api.ts                          # Public API
    types.ts                        # EquipmentCandidate (AI-ephemeral type)
    logic/                          # Pure logic
    data/
      crud-provider.ts              # Firestore CRUD for equipment
      ai-provider.ts                # AI-powered equipment search
    ui/                             # Equipment management UI

## Public API

### CRUD

```typescript
getInventory(): Promise<Equipment[]>
getEquipment(id: string): Promise<Equipment | null>
createEquipment(equipment: Omit<Equipment, 'id'>): Promise<Equipment>
updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment>
deleteEquipment(id: string): Promise<void>
```

### AI Equipment Search

```typescript
searchEquipmentCandidates(query: string): Promise<EquipmentCandidate[]>
generateEquipmentDetails(candidate: EquipmentCandidate): Promise<Equipment>
validateAccessory(accessory: unknown): Promise<Accessory>
```

## Types

- `Equipment`, `Accessory` — from `types/contract.ts` (shared across module boundaries).
- `EquipmentCandidate` — from `modules/inventory/types.ts`. This is an AI-ephemeral type used during equipment discovery and is not persisted.

## Dependencies

- `types/contract.ts` — `Equipment`, `Accessory`
- Firebase Firestore, Cloud Functions

## Architectural Source of Truth

All code in this module must follow the rules defined in `docs/salt-architecture.md`.
