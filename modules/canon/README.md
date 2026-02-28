# Canon Module

The **Canon** module is the single source of truth for items, units, and aisles.
It also owns ingredient processing for AI-powered resolution and auto-creation of new items.

## Purpose

Canon manages the item catalogue used across recipes, shopping, and inventory.
It provides:

- **Units** — g, kg, ml, l, tsp, tbsp, piece (metric-only per Salt design)
- **Aisles** — Produce, Meat & Fish, Dairy, Bakery, Pantry, Frozen, etc.
- **Canonical Items** — Standardised ingredients with British English names, preferred units, aisle locations, and synonyms
- **Ingredient Processing** — AI-powered parsing, fuzzy matching, and auto-creation pipeline
- **CoFID Integration** — Food group → aisle mappings for auto-created items
- **Data Integrity** — Impact assessment and recipe healing for item deletions

## Architecture

```
modules/canon/
├── backend/
│   ├── canon-backend.interface.ts      # Public API contract
│   ├── base-canon-backend.ts           # Core logic (ingredient processing, AI enrichment)
│   ├── firebase-canon-backend.ts       # Firebase persistence + Gemini integration
│   └── index.ts                        # Singleton factory
├── components/
│   ├── CanonModule.tsx                 # UI container
│   ├── UnitsManagement.tsx             # CRUD + drag-drop sorting
│   ├── AislesManagement.tsx            # CRUD + CoFID mapping
│   └── ItemsManagement.tsx             # Approval workflow + synonyms
└── index.ts                            # Public exports
```

## Quick Start

```typescript
import { canonBackend } from '@/modules/canon';

// Get catalogue data
const items = await canonBackend.getCanonicalItems();
const units = await canonBackend.getUnits();
const aisles = await canonBackend.getAisles();

// Process ingredients (handles parsing, matching, and auto-creation)
const ingredients = await canonBackend.processIngredients(
  ["2 large red onions, diced", "500g beef mince"],
  "recipe-123"
);

// Enhanced. Consult recipe data for rich item details
const enriched = await canonBackend.enrichCanonicalItem("extra virgin olive oil");

// Get CoFID group → aisle mappings
const mappings = await canonBackend.getCofidGroupMappings();
```

## Status

✅ **Phase 1 Complete**: Canon module structure created with backend logic  
✅ **Phase 2 Complete**: Shopping module now delegates ingredient processing to canon  
✅ **Phase 3 Complete**: UI components (Units, Aisles, Items) migrated to canon  
✅ **Phase 4 Complete**: CoFID integration with group → aisle mappings  
✅ **Phase 5 Complete**: Ingredient approval workflow for auto-created items

---

## Ingredient Matching & Item Creation Pipeline

The **ingredient processing pipeline** transforms raw recipe text into structured, linked ingredients with canonical items. It's the heart of Salt's ingredient intelligence.

### High-Level Flow

```
Raw Ingredient String
    ↓
[PARSE] Extract: quantity, unit, name, preparation
    ↓
[MATCH] Fuzzy match ingredient name against canonical items
    ↓
    ├─→ Match Found (85%+ confidence)
    │        ↓
    │     Link canonicalItemId → existing item
    │        ↓
    │     RecipeIngredient (complete)
    │
    └─→ No Match (< 85% confidence)
         ↓
      [RESOLVE] AI enrichment for item creation requests
         ↓
      ├─→ Unit doesn't exist? Create it
      ├─→ Aisle doesn't exist? Create it
      └─→ Item doesn't exist? Create with CoFID mapping lookup
         ↓
      Link canonicalItemId → new item
         ↓
      Mark approved=false (pending chef review)
         ↓
      RecipeIngredient (complete)
```

### Detailed Pipeline Stages

#### Stage 1: Parse Ingredient String

Raw input:  `"2 large red onions, diced"`

Extracts:
- **quantity**: `2`
- **unit**: `` (empty: countable item)
- **ingredientName**: `red onion`
- **preparation**: `diced`

Pattern matching identifies common units (g, kg, ml, l, tsp, tbsp, piece, pinch). Size adjectives (small, medium, large) are removed.

**Implementation**: [base-canon-backend.ts](modules/canon/backend/base-canon-backend.ts#L234-L264) - `parseIngredientString()`

---

#### Stage 2: Fuzzy Match Against Catalogue

For the parsed ingredient name `"red onion"`:

1. **Levenshtein distance matching** against all canonical items:
   - Compare against item `normalisedName`: `"onion"` → ~0.86 match
   - Compare against item synonyms: `["red onion", "spanish onion"]` → exact match (1.0)

2. **Return best match if score ≥ 0.85**
   - Found: `CanonicalItem { id: "item-xyz", name: "Onion" }`
   - Link ingredient to item immediately

3. **No match found if score < 0.85**
   - Add to "unmatched" list for AI resolution

**Implementation**: [base-canon-backend.ts](modules/canon/backend/base-canon-backend.ts#L281-L308) - `fuzzyMatch()`, `levenshteinDistance()`

---

#### Stage 3: AI Enrichment for Unmatched Items

For each unmatched ingredient name, call Gemini 3 Flash with system instruction (Head Chef context):

**Request**:
```
Resolve these recipe ingredients to canonical items:
1. beef mince
2. extra virgin olive oil

For each, return:
{
  "name": "Title Case canonical name",
  "preferredUnit": "g|kg|ml|l| (empty for countable)",
  "aisle": "Produce|Dairy|Meat & Fish|Bakery|Pantry|Frozen|Other",
  "isStaple": true/false,
  "synonyms": ["alt name 1", "alt name 2"]
}

RULES:
- British English only
- Metric units only
- Keep culinary identity (red onion, beef mince, whole milk)
- Remove size adjectives
```

**Response** (formatted as JSON):
```json
[
  {
    "name": "Beef Mince",
    "preferredUnit": "g",
    "aisle": "Meat & Fish",
    "isStaple": false,
    "synonyms": ["ground beef", "minced beef"]
  },
  {
    "name": "Extra Virgin Olive Oil",
    "preferredUnit": "ml",
    "aisle": "Pantry",
    "isStaple": true,
    "synonyms": ["EVOO"]
  }
]
```

**Implementation**: [base-canon-backend.ts](modules/canon/backend/base-canon-backend.ts#L336-L381) - `resolveUnmatchedIngredients()`

---

#### Stage 4: Ensure Units & Aisles Exist

Before creating the canonical item:

```
Check if unit exists:
  "g" → exists, continue
  "oz" → doesn't exist, CREATE unit
    
Check if aisle exists:
  "Meat & Fish" → exists, continue
  "Game Keeper" → doesn't exist, CREATE aisle
```

New units/aisles are created with `sortOrder` set to length of existing collection (appended to end).

**Implementation**: [base-canon-backend.ts](modules/canon/backend/base-canon-backend.ts#L166-L180) in `processIngredients()`

---

#### Stage 5: Create Canonical Item (or Link Existing)

For AI-resolved items, check if the normalised name already exists:

```
If item does NOT exist:
  ├─ Canonicalise name: "Beef Mince" → normalisedName: "beef mince"
  ├─ Check synonym uniqueness (no conflicts with existing items)
  ├─ Set approved: false (pending chef review)
  ├─ Set source: "user" or "cofid" (depending on origin)
  ├─ Create in Firestore
  └─ Trigger async embedding (vector search support)

If item ALREADY exists:
  └─ Just link to existing item (no duplicate)
```

**Key Fields**:
- **name**: `"Beef Mince"` (readable, used in UI)
- **normalisedName**: `"beef mince"` (lowercase, used for matching)
- **preferredUnit**: `"g"` (guides default quantity input)
- **aisle**: `"Meat & Fish"` (physical location for shopping)
- **isStaple**: `false` (appears in staple items list when true)
- **synonyms**: `["ground beef", "minced beef"]` (alternative names for matching)
- **approved**: `false` (chef must review auto-created items)
- **source**: `"cofid"` if from CoFID import (tracks origin)
- **embedding**: Vector representation for semantic search (computed async)

**Implementation**: [firebase-canon-backend.ts](modules/canon/backend/firebase-canon-backend.ts#L997-L1040) - `createCanonicalItem()`, `updateCanonicalItem()`

---

#### Stage 5b: CoFID Group Mapping Lookup (Optional)

If the item originated from CoFID data:

```
CoFID Group Code: "BA" (Cows Milk)
    ↓
Look up mapping: BA → "Dairy"
    ↓
Item created with aisle: "Dairy"
    ↓
(Mapping persists separately in cofid_group_aisle_mappings)
```

All 127 CoFID group codes are pre-mapped to practical aisles (e.g., AA → Baking, AB → Food to Go, BA → Dairy).

**Implementation**: [firebase-canon-backend.ts](modules/canon/backend/firebase-canon-backend.ts#L1143-L1149) - `getAisleForCofidGroup()`

---

### Complete Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INGREDIENT PROCESSING PIPELINE                       │
└─────────────────────────────────────────────────────────────────────────┘

INPUT: Raw ingredients from recipe (strings)
  │
  ├─ ["2 large red onions, diced", "500g beef mince", "100ml olive oil"]
  │
  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: PARSE                                                           │
│ ────────────────────────────────────────────────────────────────────────│
│ Extract: quantity, unit, ingredientName, preparation                    │
│                                                                           │
│ "2 large red onions, diced"                                              │
│  ↓                                                                        │
│  quantity: 2, unit: "", ingredientName: "red onion", prep: "diced"      │
│                                                                           │
│ "500g beef mince"                                                        │
│  ↓                                                                        │
│  quantity: 500, unit: "g", ingredientName: "beef mince", prep: null     │
│                                                                           │
│ "100ml olive oil"                                                        │
│  ↓                                                                        │
│  quantity: 100, unit: "ml", ingredientName: "olive oil", prep: null     │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: FUZZY MATCH                                                     │
│ ────────────────────────────────────────────────────────────────────────│
│ Compare parsed name against all canonical items + synonyms               │
│ Threshold: 85% match = link to existing item                             │
│                                                                           │
│ "red onion" vs "Onion" (normalisedName)     → 0.86 ✓ MATCH             │
│   Link to existing item ✓                                                │
│                                                                           │
│ "beef mince" vs all items                   → 0.60 ✗ NO MATCH          │
│   Add to unmatched list                                                  │
│                                                                           │
│ "olive oil" vs "Olive Oil"                  → 1.0 ✓ MATCH              │
│   Link to existing item ✓                                                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ├─ MATCHED (2 items)
                              │    ├─ recipeIngredient { canonicalItemId: "item-123" }
                              │    └─ recipeIngredient { canonicalItemId: "item-456" }
                              │
                              └─ UNMATCHED (1 item)
                                   └─ "beef mince"
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: AI ENRICHMENT (for unmatched)                                  │
│ ────────────────────────────────────────────────────────────────────────│
│ Call Gemini 3 Flash with Head Chef system instruction                   │
│                                                                           │
│ Input: ["beef mince"]                                                   │
│   ↓                                                                       │
│ Gemini returns:                                                          │
│   {                                                                       │
│     "name": "Beef Mince",                                                │
│     "preferredUnit": "g",                                                │
│     "aisle": "Meat & Fish",                                              │
│     "isStaple": false,                                                   │
│     "synonyms": ["ground beef", "minced beef"]                           │
│   }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: ENSURE UNITS & AISLES EXIST                                    │
│ ────────────────────────────────────────────────────────────────────────│
│ Unit "g"           → exists ✓                                             │
│ Aisle "Meat & Fish" → exists ✓                                            │
│                                                                           │
│ (If either missing, create with next sortOrder)                          │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: CREATE CANONICAL ITEM                                          │
│ ────────────────────────────────────────────────────────────────────────│
│ Normalise name: "Beef Mince" → "beef mince"                             │
│ Check synonym uniqueness: no conflicts ✓                                 │
│                                                                           │
│ Create in canonical_items:                                               │
│   {                                                                       │
│     id: "item-new-001",                                                  │
│     name: "Beef Mince",                                                  │
│     normalisedName: "beef mince",                                        │
│     preferredUnit: "g",                                                  │
│     aisle: "Meat & Fish",                                                │
│     isStaple: false,                                                     │
│     synonyms: ["ground beef", "minced beef"],                            │
│     approved: false,              ← PENDING CHEF REVIEW                  │
│     source: "user",                                                      │
│     createdAt: "2026-02-28T...",                                         │
│     embedding: [0.123, -0.456, ...]  ← computed async                    │
│   }                                                                       │
│                                                                           │
│ Trigger async embedding via Cloud Function (embedBatch)                 │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
OUTPUT: RecipeIngredient[] (all linked)
  │
  ├─ { quantity: 2, unit: "", ingredientName: "red onion", preparation:
  │    "diced", canonicalItemId: "item-123" }
  │
  ├─ { quantity: 500, unit: "g", ingredientName: "beef mince",
  │    canonicalItemId: "item-new-001", approved: false }
  │
  └─ { quantity: 100, unit: "ml", ingredientName: "olive oil",
      canonicalItemId: "item-456" }
```

---

### Approval Workflow

Auto-created items (from unmatched ingredients) start with `approved: false`:

**ItemsManagement UI** divides items into two sections:

1. **Pending Approval** (yellow warning section)
   - Shows items with `approved: false`
   - Displays source badge (e.g. "CoFID") if `source` is set
   - User can:
     - ✓ Approve individual items → updates `approved: true`
     - 🔗 Edit synonyms, unit, aisle
     - ❌ Delete if incorrect
     - ✓ Bulk approve all pending items

2. **Approved Items** (neutral section)
   - Shows items with `approved: true` (or not set, defaults to true)
   - User can edit, delete, manage synonyms normally

**Implementation**: [ItemsManagement.tsx](modules/canon/components/ItemsManagement.tsx) - Separates `pendingItems` (approved === false) from `approvedItems`

---

### Error Handling & Validation

**Synonym Conflicts**:
```javascript
// Prevent duplicate synonyms across items
validateUniqueSynonyms(["red onion"]) 
  ↓
checks all items for "red onion" as name or synonym
  ↓
throws if conflict found
```

**Item Name Uniqueness**:
```javascript
// Prevent item name matching an existing synonym
validateItemNameUniqueness("Red Onion")
  ↓
checks all items' synonyms for "red onion"
  ↓
throws if conflict found
```

**Auto-filtering** (non-blocking):
```javascript
// Remove conflicting synonyms without throwing
filterValidSynonyms(["alt1", "alt2"], currentItemId)
  ↓
returns only ["alt1"] (alt2 conflicts with existing item)
```

**Implementation**: [base-canon-backend.ts](modules/canon/backend/base-canon-backend.ts#L391-L463) - Validation methods

---

## Component

## Components

### Management UIs

#### UnitsManagement
- **Purpose**: CRUD operations for measurement units (g, kg, ml, l, tsp, tbsp, piece, pinch)
- **Features**:
  - Drag-and-drop reordering via `@dnd-kit`
  - Create new units with validation
  - Edit unit names and sort order
  - Delete unused units
  - Real-time persistence to Firestore
- **Usage**:
  ```typescript
  import { UnitsManagement } from '@/modules/canon';
  <UnitsManagement onRefresh={handleRefresh} />
  ```

#### AislesManagement
- **Purpose**: CRUD operations for shop aisles (Produce, Dairy, Meat & Fish, etc.)
- **Features**:
  - Drag-and-drop reordering
  - Create new aisles
  - **CoFID Group Mapping** (NEW):
    - Optional link each aisle to CoFID food groups
    - Dropdown shows all 127 mapped groups (AA, AB, AC, ... WY)
    - Display mapped group name with tag icon
    - Edit dialog includes mapping controls
  - When aisle is renamed, any linked CoFID mapping is preserved
  - Delete aisles (unlinks any CoFID mappings)
- **Usage**:
  ```typescript
  import { AislesManagement } from '@/modules/canon';
  <AislesManagement onRefresh={handleRefresh} />
  ```
- **CoFID Mapping Workflow**:
  ```
  Click Edit on "Dairy" aisle
    ↓
  Dropdown shows: None, Cows milk (BA), Goats milk (BC), ...
    ↓
  Select "Cows milk (BA)"
    ↓
  Saves mapping: { aisle: "Dairy", cofidGroup: "BA" }
    ↓
  Dairy → Cows milk badge appears in list
  ```

#### ItemsManagement
- **Purpose**: Advanced canonical item management with approval workflow
- **Sections**:
  1. **Pending Approval** (items with `approved: false`)
     - Yellow warning styling
     - Shows "CoFID" badge if `source: "cofid"`
     - Individual approve button (✓) for each item
     - Bulk approve button in selection bar (when > 0 selected)
     - Displays as warning count in header
  2. **Approved Items** (items with `approved: true` or unset)
     - Neutral styling
     - Standard management interface
     - Displays as total count in header
- **Features**:
  - **Synonym Management**: Drag synonyms to reorder, swap with title, promote to main name, or delete
  - **Bulk Operations**: Multi-select mode for batch delete or aisle reassignment
  - **AI Enrichment**: "Enrich Name" button provides suggestions for preferred unit, aisle, synonyms
  - **Impact Assessment**: Before deleting items, shows all affected recipes
  - **Recipe Healing**: Automatically re-matches unlinked ingredients in affected recipes using fuzzy matching
  - **Search & Filtering**: Filter by name, aisle, unit, approved status
  - **Sorting**: Group by aisle or staple status
- **Usage**:
  ```typescript
  import { ItemsManagement } from '@/modules/canon';
  <ItemsManagement onRefresh={handleRefresh} />
  ```
- **Approval Workflow Example**:
  ```
  Recipe imported with ingredient "beef mince" (no match)
    ↓
  AI creates: { name: "Beef Mince", approved: false, source: "user" }
    ↓
  ItemsManagement shows in "Pending Approval" section (yellow)
    ↓
  Chef reviews:
    - Looks good? Click ✓ "Approve" button → approved: true
    - Wrong aisle? Edit to fix
    - Wrong name? Rename and approve
    - Delete if invalid
    ↓
  Item moves to "Approved Items" section
    ↓
  Now available for fuzzy matching in future recipes
  ```

---

## CoFID Integration

**CoFID** (Composition of Foods Integrated Dataset) is the UK Food Standards Agency's food composition database.

### Structure

127 food groups organised hierarchically:
- **Single-letter codes** (A, B, C, ... W): 23 food group categories
- **Two-letter codes** (AA, AB, AC, ... WY): 127 specific food groups
  - AA: Flours, grains and starches
  - BA: Cows milk
  - CA: Beef
  - etc.

### Integration Points

#### 1. CoFID Import (Admin Panel)
Raw CoFID data import creates items with:
- `source: "cofid"` (tracked)
- `externalId: "BA"` (original CoFID code)
- `approved: false` (pending human review)

#### 2. CoFID Group → Aisle Mapping (Admin Panel)
Pre-curated mapping of all 127 groups to practical aisles:
```json
{
  "AA": { "name": "Flours, grains and starches", "aisle": "Baking & Cooking Ingredients" },
  "AB": { "name": "Sandwiches", "aisle": "Food to Go" },
  "BA": { "name": "Cows milk", "aisle": "Dairy" },
  ...
}
```

**Import via Admin UI**:
1. Admin clicks "Import CoFID Group Mappings" card
2. Component loads mapping JSON
3. Creates entries in `cofid_group_aisle_mappings` collection
4. All 127 groups now available for aisle linking

#### 3. Auto-Create from CoFID Group
When a recipe ingredient matches a CoFID group code:
```
Recipe ingredient: "milk" (no canonical match)
  ↓
AI resolution: "Cows Milk" (if understood from CoFID context)
  ↓
Look up mapping: BA → "Dairy"
  ↓
Create item: { name: "Cows Milk", aisle: "Dairy", source: "cofid" }
```

### Future Enhancements

- **Nutritional Enrichment**: Query CoFID API for nutrient data (calories, proteins, etc.)
- **Allergen Info**: Link CoFID allergen classifications to items
- **Barcode Scanning**: CoFID product code linking
- **Storage Recommendations**: Use CoFID properties for storage guidance

---

## Healing & Impact Assessment

When deleting canonical items, Salt automatically heals affected recipes.

### Workflow

**Step 1: Assess Impact**
```
User clicks "Delete" on "Beef Mince"
  ↓
System scans all recipes for ingredients using this item
  ↓
Found in 3 recipes: "Bolognese", "Nachos", "Cottage Pie"
  ↓
Shows: Will affect 5 total ingredients (user decides)
```

**Step 2: Heal Broken References**
If user confirms deletion:
```
For each affected recipe:
  ├─ For each unlinked ingredient:
  │   ├─ Fuzzy match against all remaining canonical items
  │   ├─ If 85%+ match found: re-link automatically ✓
  │   └─ If no match: leave unlinked (user must review)
  │
  └─ Report: 4 rematched, 1 still unlinked
```

**Result**: Recipes with manually-linked items remain unchanged. Only fuzzy-linked items are updated.

**Implementation**: [firebase-canon-backend.ts](modules/canon/backend/firebase-canon-backend.ts#L702-L835) - `assessItemDeletion()`, `healRecipeReferences()`

---

## Integration Points

### Shopping Module
- **Uses**: `processIngredients()` to parse recipe ingredients
- **Receives**: Populated `RecipeIngredient[]` with `canonicalItemId` links
- **Flows**: Recipe → ingredient resolution → shopping list creation

### Recipes Module
- **Uses**: `processIngredients()` when importing or creating recipes
- **Receives**: Same as Shopping
- **Hooks**: `onCanonItemsDeleted()` to unlink affected recipes for healing

### Kitchen-Data Module (Deprecated)
- **Status**: Canon is the modern replacement
- **Migration**: Gradual move of units/items to canon collection
- **Compatibility**: Both can coexist temporarily during migration

---

## Data Integrity & Validation

All operations validate against Salt's Constitutional rules:

1. **Zod Schemas** (types/contract.ts)
   - `Unit`: name, sortOrder
   - `Aisle`: name, sortOrder, cofidGroup (optional)
   - `CanonicalItem`: full schema with optional CoFID fields
   - `RecipeIngredient`: quantity, unit, ingredientName, canonicalItemId

2. **Synonym Uniqueness**
   - No item can have another item's name as synonym
   - No two items can share synonyms
   - Validated on create/update

3. **British English**
   - AI enrichment uses British spellings
   - Non-negotiable in Head Chef system instruction

4. **Metric Units Only**
   - Parse/create only: g, kg, ml, l, tsp, tbsp, piece, pinch
   - No imperial units allowed
   - Enforced in type system

---

## Extending the Pipeline

### Adding Custom Matching Logic

Override `fuzzyMatch()` or add a pre-processing step:
```typescript
// Example: prioritise exact matches before fuzzy matching
private priorityMatch(ingredientName: string, items: CanonicalItem[]): CanonicalItem | null {
  // Exact match first
  const exactMatch = items.find(i => 
    i.normalisedName.includes(ingredientName.toLowerCase())
  );
  if (exactMatch) return exactMatch;
  
  // Fall back to fuzzy
  return null; // or fuzzyMatch result
}
```

### Extending Item Metadata

Add fields to `CanonicalItem` type and they automatically persist:
```typescript
// In types/contract.ts > CanonicalItem
allergens?: string[];  // ["peanut", "sesame"]
storageTemp?: number;  // 4 (fridge) or -18 (freezer)
shelfLifeDays?: number; // 30
supplier?: string;  // "Tesco", "Waitrose"
```

No migration needed—Firestore schema is flexible.

---

## Future Roadmap

The canonical item schema is designed to support future integrations with external databases and non-food items without breaking changes.

### Already Implemented Schema Extensions

All fields below are **optional** — existing data remains valid:

- **`source`** — Track origin: "user", "cofid", "openfacts", "household"
- **`externalId`** — Store external database IDs (CoFID code, OFI barcode)
- **`barcodes`** — Array of barcodes for scanning (EAN-13, UPC)
- **`itemType`** — Categorise as "ingredient", "product", or "household"
- **`approved`** — Flag for items pending human review (esp. auto-created)
- **`lastSyncedAt`** — Timestamp of last external data sync
- **`metadata`** — Extensible JSON: allergens, storage conditions, nutrients

### Phase N: CoFID Nutritional Enrichment
- Query CoFID API for nutrient data
- Link recipes to verified composition data
- Enable nutrition tracking per recipe

### Phase N+1: Open Food Facts Integration
- Barcode scanning for packaged products
- Product allergen information
- Automatic brand/product matching

### Phase N+2: Household Items
- Non-food items (cleaning supplies, paper goods)
- Separate aisle management for household sections
- Shopping lists can mix food + non-food seamlessly

### Phase N+3: Smart Shopping Features
- Suggest products based on allergen requirements
- Storage recommendations (fridge, freezer, pantry)
- Seasonal availability tracking
- Preferred suppliers per item
- Price comparison across retailers

### What This Enables

```typescript
// Phase N: Nutritional enrichment
const recipe = await recipesBackend.getRecipe('recipe-123');
const nutrition = recipe.ingredients.reduce((acc, ing) => ({
  calories: acc.calories + (ing.canonicalItem.calories * ing.quantity),
  protein: acc.protein + (ing.canonicalItem.protein * ing.quantity),
  ...
}), {});

// Phase N+1: Barcode lookup
const item = await canonBackend.getItemsByBarcode('5000112133263');
// Returns: cached item or fetches from Open Food Facts

// Phase N+2: Household items in shopping
const shoppingList = await shopping.addShoppingItem({
  name: 'Paper towels',
  itemType: 'household',
  aisle: 'Cleaning Supplies'
});

// Phase N+3: Smart shopping
const suggestions = await canonBackend.querySmarterShopping({
  allergenRestrictions: ['peanut', 'sesame'],
  storageAvailable: ['fridge', 'pantry'],
  preferredBrands: ['Tesco Finest', 'Waitrose']
});
```

### Benefits

✅ **No breaking changes** — All new fields are optional  
✅ **Maximum flexibility** — Non-cooking items automatically supported  
✅ **Barcode tracking** — Can implement barcode scanning later  
✅ **Source agnostic** — Can pull from user, CoFID, or Open Food Facts  
✅ **Extensible metadata** — Allergens, storage, nutrients, etc.  
✅ **Clean migration** — No schema redesign needed for integrations
