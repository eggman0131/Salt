# Canon Module

Canon-owned reference collections for aisles, units, and items.  
**Ownership:** `canonAisles`, `canonUnits`, `canonItems` Firestore collections.

---

## Architecture

```
modules_new/canon/
├── api.ts                      # Public API — the ONLY file UI may import
├── types.ts                    # Module-specific TypeScript types
├── logic/
│   ├── aisles.ts               # CanonAisleSchema + pure aisle helpers
│   ├── units.ts                # CanonUnitSchema + pure unit helpers
│   └── items.ts                # CanonItemSchema + pure item helpers (PR2)
├── data/
│   └── firebase-provider.ts   # Firestore read/write helpers (I/O only)
├── ui/
│   ├── CanonViewer.tsx         # Read-only viewer components
│   └── admin/
│       └── CanonItemsAdmin.tsx # Full CRUD + review queue (PR2)
├── admin.manifest.ts           # Admin tools (ready for future mounting)
├── index.ts                    # Public re-exports
├── README.md                   # This file
└── __tests__/
    └── logic.test.ts           # Deterministic unit tests (no Firebase)
```

---

## Module Guarantee

✅ **Strict Boundaries Enforced:**
- UI imports **only** from `api.ts`
- Logic (`logic/`) is pure — no I/O, no Firebase
- Persistence (`data/`) is read-only, called only from `api.ts`
- No cross-module imports except `types/contract.ts` and `shared/backend`
- No other modules currently depend on these collections

---

## Firestore Collections

| Collection    | Owned by     | Purpose                                           |
|---------------|--------------|---------------------------------------------------|
| `canonAisles` | This module  | Canonical aisle taxonomy for the UK               |
| `canonUnits`  | This module  | Canonical measurement unit registry               |
| `canonItems`  | This module  | Canonical ingredient items with review workflow   |

### Seeding

```bash
# Seed both collections (idempotent — safe to run repeatedly)
node seed-data/scripts/seed-canon-all.mjs

# Or seed individually
node seed-data/scripts/seed-canon-aisles.mjs
node seed-data/scripts/seed-canon-units.mjs

# Target the Firebase emulator
FIREBASE_EMULATOR_HOST=localhost:8080 node seed-data/scripts/seed-canon-all.mjs
```

The `uncategorised` aisle (`id: "uncategorised"`) is always present after seeding and acts as the system fallback aisle.

---

## Seed Files

| File | Collection | Notes |
|------|------------|-------|
| `seed-data/canon-aisles.json` | `canonAisles` | 19 aisles; `uncategorised` at `sortOrder: 999` |
| `seed-data/canon-units.json`  | `canonUnits`  | 46 units across weight / volume / count / colloquial |

---

## Public API (`api.ts`)

### Read helpers (I/O)

```typescript
// Fetch all canon aisles ordered by sortOrder
getCanonAisles(): Promise<Aisle[]>

// Fetch all canon units ordered by sortOrder
getCanonUnits(): Promise<Unit[]>

// Fetch all canon items (unsorted — use sortItems for ordering)
getCanonItems(): Promise<CanonItem[]>

// Get a single canon item by ID
getCanonItemById(id: string): Promise<CanonItem | null>
```

### Canon Items CRUD (I/O)

```typescript
// Create a new canon item (defaults to needsReview: true)
addCanonItem(input: {
  name: string;
  aisleId: string;
  preferredUnitId: string;
  needsReview?: boolean;
}): Promise<CanonItem>

// Update an existing canon item
editCanonItem(
  id: string,
  updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId' | 'needsReview'>>
): Promise<void>

// Approve a canon item (set needsReview = false)
approveItem(id: string): Promise<void>
```

### Pure aisle helpers

```typescript
// Sort by sortOrder, tie-break alphabetically
sortAisles(aisles: Aisle[]): Aisle[]

// Exact ID lookup — returns typed result
findAisleById(aisles: Aisle[], id: string): AisleLookupResult

// Case-insensitive name lookup
findAisleByName(aisles: Aisle[], name: string): AisleLookupResult

// Check the system fallback aisle is present
hasUncategorisedAisle(aisles: Aisle[]): boolean

// Validate a raw Firestore document
validateAisleDoc(doc: unknown): ZodSafeParseReturn

// The well-known system aisle ID
UNCATEGORISED_AISLE_ID: 'uncategorised'
```

### Pure unit helpers

```typescript
// Sort by sortOrder, tie-break alphabetically
sortUnits(units: Unit[]): Unit[]

// Exact ID lookup — returns typed result
findUnitById(units: Unit[], id: string): UnitLookupResult

// Group into weight / volume / count / colloquial
groupUnitsByCategory(units: Unit[]): UnitsByCategory

// Validate a raw Firestore document
validateUnitDoc(doc: unknown): ZodSafeParseReturn
```

### Pure item helpers

```typescript
// Normalize item name (trim, collapse whitespace)
normalizeItemName(name: string): string

// Sort alphabetically by name
sortItems(items: CanonItem[]): CanonItem[]

// Exact ID lookup — returns typed result
findItemById(items: CanonItem[], id: string): ItemLookupResult

// Case-insensitive name lookup
findItemByName(items: CanonItem[], name: string): ItemLookupResult

// Filter items that need review
filterItemsNeedingReview(items: CanonItem[]): CanonItem[]

// Filter items by aisle ID
filterItemsByAisle(items: CanonItem[], aisleId: string): CanonItem[]

// Validate a raw Firestore document
validateItemDoc(doc: unknown): ZodSafeParseReturn
```

---

## Zod Schemas (logic layer)

```typescript
// modules_new/canon/logic/aisles.ts
CanonAisleSchema // { id, name, sortOrder, createdAt }

// modules_new/canon/logic/units.ts
CanonUnitSchema  // { id, name, plural, category, sortOrder, createdAt? }

// modules_new/canon/logic/items.ts
CanonItemSchema  // { id, name, aisleId, preferredUnitId, needsReview, createdAt, updatedAt? }
```

These schemas live in `logic/` and provide local, module-owned validation. The CanonItemSchema was added in PR2 to support the canonical items collection with a review workflow.

---

## Testing

```bash
npx vitest run modules_new/canon
```

All tests in `__tests__/logic.test.ts` are **pure** — no Firebase, no mocks, no network. They run instantly and are fully deterministic.

```typescript
// Example
hasUncategorisedAisle([{ id: 'uncategorised', ... }]) // → true
groupUnitsByCategory(units).weight                     // → [g, kg, mg, ...]
findAisleByName(aisles, 'PRODUCE').found               // → true
```

---

## Module Rules

1. ✅ **Owns** `canonAisles`, `canonUnits`, and `canonItems` Firestore collections
2. ✅ **Never** writes to another module's collections
3. ✅ **Never** imports from another module's internals
4. ✅ **Exposes** only `api.ts` to external consumers
5. ✅ **Logic is pure** — deterministic, side-effect-free, instantly testable
6. ✅ **Data layer** handles all I/O operations (read for aisles/units, CRUD for items)
7. ✅ **`uncategorised` always exists** after seeding
8. ✅ **Items workflow** — new items default to `needsReview: true` until approved

---

## Dependencies

- `types/contract.ts` — `Aisle`, `Unit` (read-only)
- `shared/backend/firebase` — Firestore client
- `zod` — document validation schemas
