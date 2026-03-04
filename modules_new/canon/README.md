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

**Recommended:** Use the **Canon Seeder** admin tool in the app:
1. Navigate to Admin (New) → Canon Seeder
2. Click "Seed All" to import both aisles and units
3. Or seed individually using the "Seed Aisles" / "Seed Units" buttons

**Why in-app seeding?**
- ✅ Runs in authenticated context (no Firebase project ID issues)
- ✅ Respects Firestore security rules (requires authenticated user)
- ✅ Visual feedback and error reporting
- ✅ No external script dependencies

Seeding is **idempotent** — safe to run multiple times. Existing documents are overwritten.

---

## Seed Files

| File | Collection | Records | Notes |
|------|------------|---------|-------|
| `seed-data/canon-aisles.json` | `canonAisles` | 19 | `uncategorised` at `sortOrder: 999` |
| `seed-data/canon-units.json`  | `canonUnits`  | 46 | weight / volume / count / colloquial |

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

### CofID Mapping Resolver (PR3)

```typescript
// Normalize aisle name for matching (lowercase, trim)
normaliseAisleName(name: string): string

// Resolve a single CofID group to the best matching aisle
resolveGroupToAisle(
  group: string,
  groupName: string,
  aisleRequest: string,
  aisles: AisleInfo[]
): MappingResult

// Validate embedding (model and dimension)
validateEmbedding(item: CofIDItem): { valid: boolean; error?: string }

// Resolve all CofID items to aisles with collision detection
resolveCofidItemsToAisles(
  items: CofIDItem[],
  cofidMapping: CofidMapping,
  aisles: AisleInfo[]
): { results: MappingResult[], unmappedGroups: Set<string>, collisions: Map<string, string[]> }

// Generate a diagnostic report (embeddings, mapping, collisions)
generateCofidImportReport(
  items: CofIDItem[],
  cofidMapping: CofidMapping,
  aisles: AisleInfo[]
): CofIDImportReport

// Fetch all CofID items (for diagnostics)
getCanonCofidItems(): Promise<any[]>
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

---

## Admin Tools

The Canon module exposes the following admin tools via `admin.manifest.ts`:

| Tool ID | Label | Purpose |
|---------|-------|---------|
| `canon.seeder` | Canon Seeder | Seed aisles and units from JSON files into Firestore |
| `canon.items` | Canon Items | Full CRUD + review queue for canonical items |
| `canon.cofid-mapping` | CofID Mapping Report | View CofID import validation and aisle mapping results |
| `canon.aisles-viewer` | Canon Aisles | Read-only viewer for all aisles |
| `canon.units-viewer` | Canon Units | Read-only viewer for all units |

Access via: **Admin (New)** → Select tool from dropdown

---

## PR3: CofID Import + Mapping Validation

Adds CofID item import from JSON backup with aisle mapping and embedding validation.

### New Collections

| Collection      | Purpose                                          |
|-----------------|--------------------------------------------------|
| `canonCofidItems` | Raw CofID items imported from backup            |

### New Files

```
modules_new/canon/
├── logic/
│   └── cofid-mapping.ts              # Mapping resolver + report generator
├── ui/admin/
│   └── CofidMappingReport.tsx        # Report viewer component
└── seed-data/
    ├── cofid-items.backup.v1.json    # CofID items source (test data)
    └── scripts/
        └── seed-canon-cofid-items.mjs # Import script
```

### New Types (`types/contract.ts`)

```typescript
CofIDItem       // { id, name, group, nutrients, embedding, embeddingModel, importedAt }
CofIDImportReport // { totalItems, importedItems, mappingResults, ... }
```

### Seeding

```bash
# Prerequisites: Run PR1 (seed aisles + units first)
node seed-data/scripts/seed-canon-aisles.mjs

# Then import CofID items
node seed-data/scripts/seed-canon-cofid-items.mjs [--dry-run]
```

The script:
1. ✅ Validates embeddings (model = `text-embedding-005`, dimension = 768)
2. ✅ Maps CofID groups to canonical aisles using `scripts/cofid-aisle-mapping.json`
3. ✅ Generates a diagnostic report (unmapped groups, collisions, etc.)
4. ✅ Imports valid items into `canonCofidItems` collection
5. ✅ Displays mapping results (mapped, unmapped, forced to uncategorised)

### Admin Tools

- **CofID Mapping Report** — View import validation results and aisle mapping status

### Validation Rules

- **Embedding Model:** must be `text-embedding-005`
- **Embedding Dimension:** must be exactly 768
- **Aisle Mapping:** CofID group codes map via `scripts/cofid-aisle-mapping.json` to aisle names
- **Fallback:** Unmapped groups default to `uncategorised` aisle

### Example Mapping Report

```
CofID Import Report Generated at 2026-03-04T20:15:00Z

Summary:
  Total Items: 10
  Imported: 10
  Failed: 0

Mapping Results:
  Mapped: 8
  Unmapped: 2
  Forced to Uncategorised: 2

Unmapped Groups:
  - XY (Unknown Group): "NonExistent Aisle" → NOT FOUND
  - ZZ (Test Group): "Test Aisle" → NOT FOUND
```

### Logic Functions (Pure)

All mapping logic is deterministic and testable:

- `resolveGroupToAisle()` — Single group resolution
- `resolveCofidItemsToAisles()` — Batch with collision detection
- `validateEmbedding()` — Check model and dimension
- `generateCofidImportReport()` — Full diagnostics
- `normaliseAisleName()` — Case-insensitive match prep

