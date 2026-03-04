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
| `canon.aiParseTool` | AI Ingredient Parser | Parse ingredient lines using AI and validate against canonical data (PR4-A) |
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

---

## PR4-A: AI Parse Reimplementation + Admin Parse Tool

Reimplements ingredient parsing on top of new canon foundations:
- AI-first ingredient parsing with aisle categorisation
- Deterministic validation and repair with review flags
- Admin tool UI for parsing ingredient lines

### New Types (`modules_new/canon/types.ts`)

```typescript
AisleRef            // { id, name } — reference to canonical aisle
UnitRef             // { id, name } — reference to canonical unit
AiSingleParseResult // Result from AI parse (index, itemName, quantity, aisleId, etc.)
AiParseResponse     // Response from Cloud Function
ReviewFlag          // Type of validation flag (invalid-aisle-id-repaired, etc.)
ValidatedParseResult // Parsed result with reviewFlags array
BatchParseResponse  // Batch result { totalCount, successCount, results, hasReviewFlags }
UNCATEGORISED_AISLE // Constant { id: "uncategorised", name: "Uncategorised" }
```

### Key Features

✅ **AI Parse via Cloud Function**
- Uses existing `cloudGenerateContent` callable
- Model: `flash-3`
- Validates response against Zod schema

✅ **Deterministic Validation/Repair**
- Invalid aisleId → repaired to "uncategorised" + flagged
- Invalid unitId → set to null + flagged
- Uncategorised without suggestion → flagged
- Missing arrays → repaired to [] + flagged
- All repairs are deterministic and tested

✅ **Review Flags**
- `invalid-aisle-id-repaired`
- `invalid-unit-id-repaired`
- `data-repaired`
- `missing-aisle-suggestion`

✅ **Admin UI**
- Parse ingredient lines from textarea
- Real-time validation and repair
- Review flag badges on results
- Loading and error states
- Async data fetching (aisles + units)

### File Structure (PR4-A)

```
modules_new/canon/
├── types.ts                                      # New types for PR4-A
├── logic/
│   ├── aiParseSchemas.ts                         # Zod schemas + schema builder
│   └── validateAiParse.ts                        # Pure validation/repair logic
├── data/
│   └── aiParseIngredients.ts                     # Cloud Function callable
├── ui/admin/
│   └── AiIngredientParseTool.tsx                 # Admin parse UI
├── admin.manifest.ts                             # Updated: canon.aiParseTool
├── api.ts                                        # Updated: Re-export parse functions
├── __tests__/
│   └── validateAiParse.test.ts                   # 11 deterministic tests
└── README.md                                     # This section
```

### Public API (Exports from `api.ts`)

**Pure Functions:**
```typescript
validateAiParseResults() — Validate and repair parsed results
buildParseSchemaDescription() — Build schema for prompt injection
```

**I/O Functions:**
```typescript
callAiParseIngredients() — Call Cloud Function to parse ingredients
```

**Types & Constants:**
```typescript
type AisleRef, UnitRef, AiSingleParseResult, ValidatedParseResult, BatchParseResponse
const UNCATEGORISED_AISLE
```

### How It Works

1. **User Input** → Admin UI textarea with ingredient lines
2. **Fetch Data** → Load canonAisles + canonUnits
3. **Call AI** → `callAiParseIngredients()` with schema description
4. **Validate** → `validateAiParseResults()` repairs invalid data
5. **Display** → Show results in table with review flags

### Testing

All validation logic is pure and deterministic:

```bash
npx vitest run modules_new/canon/__tests__/validateAiParse.test.ts
✓ should pass valid results unchanged
✓ should repair invalid aisleId to uncategorised
✓ should repair invalid unitId to null
✓ should flag uncategorised aisle without suggestedAisleName
✓ should not flag uncategorised with suggestedAisleName
✓ should repair missing preparations and notes arrays
✓ should detect out-of-range indices
✓ should detect duplicate indices
✓ should sort results by index
✓ should handle multiple repair flags on single result
✓ should aggregate review flags across batch
```

### Admin Tool

Access via: **Admin (New)** → **AI Ingredient Parser**

Features:
- Textarea for ingredient input
- Real-time validation on parse
- Results table with item details (quantity, unit, aisle, notes)
- Review flags as styled badges
- Error messages with recovery
- Clear/Parse/Try Again button flows

### Non-Scope (Explicitly NOT in PR4-A)

- CofID auto-linking to parsed items
- Nutrient copying into canon items
- Recipes integration
- Embedding generation

---

## PR5: CofID Integration — Linking & Nutrient Copying

PR5 enables linking canon items to CofID reference data with automatic nutrient inheritance.

### Key Features

✅ **CofID Match Suggestions**
- Aisle-bounded fuzzy matching using Levenshtein similarity
- Best match recommendation with confidence scoring
- Top 5 candidate ranking for manual selection
- Exact match prioritization over fuzzy matches

✅ **Link Management**
- Manual link/unlink workflow via UI
- CofID match metadata storage (status, method, score, candidates)
- Automatic nutrient copying on canon item approval
- Unlink preserves history with status='unlinked' timestamp

✅ **Nutrient Inheritance**
- Nutrients auto-copied when linked CofID item is approved
- Nutrient source tracking (`nutrientsSource: 'cofid'`)
- Import timestamp for data provenance (`nutrientsImportedAt`)
- Unlink clears nutrients and metadata

### Data Schema Updates

**CanonItem Schema Extensions (PR4-B → PR5):**
```typescript
{
  // ... existing fields (id, name, aisleId, preferredUnitId, needsReview)
  cofidId: string | null;                      // Linked CofID item ID
  cofidMatch: CofidMatch | undefined;          // Match metadata
  nutrients: Nutrient | undefined;              // Nutrient data
  nutrientsSource: 'cofid' | 'manual' | null;  // Data source
  nutrientsImportedAt: string | null;          // ISO timestamp
}
```

**CofidMatch Schema:**
```typescript
{
  status: 'auto' | 'manual' | 'unlinked';
  method: 'exact' | 'fuzzy' | null;
  score: number | null;                        // 0-1 similarity score
  matchedAt: string;                           // ISO timestamp
  candidates?: Array<{                         // Top matches for reference
    cofidId: string;
    name: string;
    score: number;
    method: 'exact' | 'fuzzy';
  }>;
}
```

**Nutrient Schema:**
```typescript
{
  energy_kcal?: number;
  protein_g?: number;
  fat_g?: number;
  carbohydrate_g?: number;
  // ... extensible for additional fields
}
```

### File Structure (PR5 Changes)

```
modules_new/canon/
├── logic/
│   ├── items.ts                              # Extended: CofidMatch + Nutrient schemas
│   └── suggestCofidMatch.ts                  # Pure matching logic (PR4-B foundation)
├── data/
│   └── firebase-provider.ts                  # Extended: Link/unlink + suggest functions
├── ui/admin/
│   └── CanonItemsAdmin.tsx                   # Extended: CofID linking UI + dialog
└── api.ts                                    # Extended: Export PR5 functions
```

### Public API Updates (`api.ts`)

**I/O Functions:**
```typescript
// Suggest CofID matches for a canon item
// Returns bestMatch + top 5 candidates
suggestCofidMatch(canonItemId: string): Promise<{
  bestMatch: SuggestedMatch | null;
  candidates: SuggestedMatch[];
}>

// Link a CofID item to a canon item
linkCofidMatch(
  canonItemId: string,
  cofidId: string,
  matchMetadata: CofidMatch
): Promise<void>

// Unlink CofID item from canon item
// Clears cofidId, nutrients, and sets status='unlinked'
unlinkCofidMatch(canonItemId: string): Promise<void>

// Get a single CofID item by ID (for displaying details)
getCofidItemById(id: string): Promise<CofIDItem | null>
```

**Pure Logic (Re-exported):**
```typescript
// Build CofidMatch metadata for storage
buildCofidMatch(
  match: SuggestedMatch,
  status: 'auto' | 'manual',
  candidates?: SuggestedMatch[]
): CofidMatch

// Other helpers from suggestCofidMatch.ts
suggestBestMatch(), rankCandidates(), levenshteinSimilarity()
```

**Types:**
```typescript
type SuggestedMatch  // { cofidId, name, score, method, reason }
```

### How It Works

**Workflow:**
1. **Suggest** → User clicks "Link CofID" on canon item
2. **Match** → System fetches CofID items, builds aisle mapping, runs pure matching logic
3. **Display** → UI shows best match + top 5 candidates with scores
4. **Link** → User selects a candidate and confirms
5. **Store** → System saves cofidId + match metadata to canon item
6. **Approve** → When canon item is approved, nutrients auto-copy from linked CofID item
7. **Unlink** → User can unlink CofID match, which clears nutrients and metadata

**Aisle-Bounded Matching:**
- Filters CofID items to same canon aisle only
- Uses CofID group → aisle mappings from `cofid_group_aisle_mappings` collection
- Exact match prioritized over fuzzy (exact score = 1.0)
- Fuzzy match threshold: 0.75 similarity minimum

**Nutrient Copying:**
- Triggered automatically in `approveCanonItem()` when `cofidId` is present
- Fetches linked CofID item's nutrients
- Copies nutrients, sets `nutrientsSource: 'cofid'`, adds `nutrientsImportedAt` timestamp
- Respects null safety (handles missing CofID item gracefully)

### UI Changes (CanonItemsAdmin)

**Item Display:**
- **CofID Linked Badge** — Shows when item has `cofidId`
- **Nutrients Badge** — Shows when item has nutrient data
- **Match Info** — Displays match method and score percentage

**Actions:**
- **Link CofID Button** — Opens suggestions dialog (shown when not linked)
- **Unlink Button** — Removes CofID link (shown when linked)
- **Suggestions Dialog** — Displays best match + top 5 candidates with scores
  - Auto-selects best match
  - Shows "Best Match" sparkle badge on top candidate
  - Color-coded method badges (exact/fuzzy)
  - Percentage scores with match reasoning

**Visual States:**
- Not linked: Shows "Link CofID" button with sparkle icon
- Linked: Shows "CofID Linked" badge + "Unlink" button
- Has nutrients: Shows "Nutrients" badge

### Data Layer Implementation

**New Functions in `firebase-provider.ts`:**

```typescript
// Fetch single CofID item by ID (for nutrient copying)
fetchCofidItemById(id: string): Promise<CofIDItem | null>

// Link CofID match to canon item
linkCofidMatchToCanonItem(
  canonItemId: string,
  cofidId: string,
  matchMetadata: CofidMatch
): Promise<void>

// Unlink CofID match and clear nutrients
unlinkCofidMatchFromCanonItem(canonItemId: string): Promise<void>

// Suggest CofID matches (I/O wrapper for pure logic)
suggestCofidForCanonItem(canonItemId: string): Promise<{
  bestMatch: SuggestedMatch | null;
  candidates: SuggestedMatch[];
}>

// Helper: Build aisle mapping for CofID items
buildAisleMapping(cofidItems: CofIDItem[]): Promise<Record<string, string>>
```

**Modified Functions:**

```typescript
// approveCanonItem() — Extended to copy nutrients from linked CofID item
// fetchCanonItems() — Extended to return cofidId, cofidMatch, nutrients fields
// fetchCanonItemById() — Extended to return CofID enrichment fields
```

### Testing

**Unit Tests (Pure Logic):**
- All matching logic in `suggestCofidMatch.ts` is deterministic and testable
- See PR4-B for existing Levenshtein similarity tests

**Manual Testing Workflow:**
1. Ensure CofID items are seeded (`cofid import` admin tool)
2. Create a canon item (e.g., "Chicken breast")
3. Click "Link CofID" → Verify suggestions appear
4. Select a match → Verify link is saved
5. Approve canon item → Verify nutrients copied
6. Check item display → Verify badges and match info
7. Click "Unlink" → Verify nutrients cleared and status='unlinked'

**Data Integrity Checks:**
- Unlink preserves history with `matchedAt` timestamp
- Nutrient source tracking prevents data confusion
- Null safety for missing CofID items
- Idempotent operations (safe to link/unlink multiple times)

### Dependencies

**Firestore Collections:**
- `canonItems` — Owns canon item documents
- `canonCofidItems` — Read-only CofID reference data (PR3)
- `cofid_group_aisle_mappings` — Read-only group → aisle mappings (PR3)

**Logic Dependencies:**
- `suggestCofidMatch.ts` — Pure matching algorithms (PR4-B)
- `items.ts` — CofidMatch and Nutrient schemas (PR4-B)
- `buildCofidMatch()` — Metadata builder for storage

**Architecture Compliance:**
- ✅ All I/O in `data/firebase-provider.ts`
- ✅ All matching logic pure and deterministic
- ✅ UI imports only from `api.ts`
- ✅ No cross-module imports except `types/contract.ts`

### Non-Scope (Intentionally Excluded)

- Auto-linking CofID items on canon item creation (manual-only workflow)
- Bulk CofID linking operations
- CofID match confidence adjustment
- Manual nutrient editing (future feature)
- Embedding-based matching (vectors not yet utilized)


