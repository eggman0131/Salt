# Canon Module

The **Canon** module is the single source of truth for items, units, and aisles.
It also owns ingredient processing for AI-powered resolution.

## Purpose

Canon manages the item catalogue used across recipes, shopping, and inventory.
It provides:

- Units (g, kg, ml, l, etc.)
- Aisles (Produce, Pantry, Dairy, etc.)
- Canonical items (ingredients and household goods)
- Ingredient parsing and resolution

## Architecture

```
modules/canon/
├── backend/
│   ├── canon-backend.interface.ts
│   ├── base-canon-backend.ts
│   ├── firebase-canon-backend.ts
│   └── index.ts
├── components/
│   └── CanonModule.tsx
└── index.ts
```

## Usage

```typescript
import { canonBackend } from '@/modules/canon';

// Get catalogue data
const items = await canonBackend.getCanonicalItems();
const units = await canonBackend.getUnits();
const aisles = await canonBackend.getAisles();

// Process ingredients (used by recipes and shopping modules)
const ingredients = await canonBackend.processIngredients(
  ["2 large red onions, diced", "500g beef mince"],
  "recipe-123"
);
```

## Status

✅ **Phase 1 Complete**: Canon module structure created with backend logic  
✅ **Phase 2 Complete**: Shopping module now delegates ingredient processing to canon

## Integration Points

- **Shopping Module**: Uses `processIngredients()` to parse recipe ingredients  
- **Recipes Module**: Will use ingredient processing for recipe creation (future)  
- **Kitchen-Data Module**: Migration in progress (canon will replace it)

## Notes

- Canon is the sole owner of ingredient intelligence.
- Other modules consume this API; they do not manage items directly.

---

## Future Integration - CoFID, Open Food Facts, Household Items

The canonical item schema is designed to support future integrations with external databases and non-food items without breaking changes.

### Schema Extensions (Already Implemented)

All fields below are **optional** - existing data remains valid:

- **`source`** - Track where the item came from (user, cofid, open-food-facts)
- **`externalId`** - Store external database IDs (CoFID product ID, OFI barcode, etc.)
- **`barcodes`** - Array of barcodes for scanning (EAN-13, UPC, etc.)
- **`itemType`** - Categorize as ingredient, product, or household item
- **`lastSyncedAt`** - Track when external data was last synchronized
- **`metadata`** - Extensible field for allergens, storage conditions, nutrients, etc.

### Planned Integrations (Future Phases)

**Phase N: CoFID Integration**
- Import food composition data from UK CoFID database
- Enrich items with nutritional information
- Link recipes to verified ingredient data

**Phase N+1: Open Food Facts**
- Barcode scanning for packaged goods
- Product allergen information
- Automatic brand/product matching

**Phase N+2: Household Items**
- Non-food items (cleaning supplies, paper goods, etc.)
- Separate aisle management for household sections
- Shopping lists can mix food and non-food items seamlessly

**Phase N+3: Smart Shopping**
- Suggest products based on allergen requirements
- Storage recommendations (fridge, freezer, pantry)
- Seasonal availability tracking
- Preferred suppliers per item

### What This Enables

```typescript
// Phase N: Barcode lookup
const item = await canonBackend.getItemsByBarcode('5000112133263');
// Returns cached item or fetches from Open Food Facts

// Phase N+1: Smart shopping
const results = await canonBackend.queryExternalDatabase('open-food-facts', 'cereal');
// Suggests products with allergen info, storage recommendations

// Phase N+2: Household items
const shoppingList = await shopping.addShoppingItem({
  name: 'Paper towels',
  itemType: 'household',
  aisle: 'Cleaning'
});
// Household items work seamlessly alongside ingredients

// Phase N+3: Data enrichment
const item = await canonBackend.syncItemMetadata('item-123', 'cofid');
// Updates metadata (allergens, nutrients) from external source
```

### Benefits

✅ **No breaking changes** - All new fields are optional  
✅ **Maximum flexibility** - Non-cooking items automatically supported  
✅ **Barcode tracking** - Can implement barcode scanning later  
✅ **Source agnostic** - Can pull from user, CoFID, or Open Food Facts  
✅ **Extensible metadata** - Allergens, storage conditions, nutrients, etc.  
✅ **Clean future migration** - No schema redesign needed when integrating
