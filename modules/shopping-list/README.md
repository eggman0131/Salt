# shopping-list module

Household shopping list with recipe integration, canon item normalisation, and a mobile-optimised shopping view.

## Public API (`api.ts`)

### Lists
- `getShoppingLists()` — all lists
- `getDefaultShoppingList()` — default list (creates on first use)
- `createShoppingList(name)` — create a named list

### Items
- `getItemsForList(listId)` — all items for a list
- `upsertCanonItem(listId, canonicalItemId, contribution, canonMeta, isStaple)` — add/update a canonical item entry
- `createUnmatchedItem(listId, contribution, name)` — add a discrete unmatched item
- `removeRecipeContributions(listId, recipeId)` — remove all contributions from a recipe
- `updateItemChecked(itemId, checked)` — tick/untick an item
- `updateItemStatus(itemId, status)` — approve storecupboard item ('needs_review' → 'active')
- `updateItemNote(itemId, note)` — set item note
- `deleteItem(itemId)` — delete an item
- `clearCheckedItems(listId)` — delete all checked items
- `linkItemToCanonItem(listId, itemId, canonicalItemId, canonMeta)` — upgrade unmatched item to canon-linked

### Planner sync
- `syncPlannerToList(weekStartDate, listId)` — sync a week's recipes to a list (idempotent)
- `addRecipeToList(recipeId, listId)` — add a single recipe (idempotent)
- `removePlannerRecipeFromList(listId, recipeId)` — remove a recipe's contributions

### Canon matching
- `tryMatchManualItem(listId, itemId, rawText)` — async non-blocking canon match for a manual entry

## Owned Firestore collections

- `shoppingLists` — list metadata
- `shoppingListItems` — items (one doc per canonical item per list; unmatched items are discrete docs)

## Dependencies (read-only via their api.ts)

- `planner` — `getPlanByDate` for week sync
- `recipes` — `getRecipe` for ingredient data
- `canon` — `getCanonItemById`, `getCanonAisles`, `getCanonItems`, `matchIngredientToCanonItem`

## Key design decisions

- **Contributions embedded** — each item stores its source ingredients as an array; no separate sources collection
- **Aggregation at write time** — `totalBaseQty` stored on the doc, updated transactionally with contributions
- **Storecupboard items** — canon items with `isStaple: true` land in `status: 'needs_review'`; user approves manually
- **Checked = bought** — marks item as purchased; user bulk-clears at end of shop
- **Canon matching non-blocking** — manual items are added immediately, matched to canon in background
- **No Cloud Function** — all logic runs client-side; Firestore transactions handle concurrent household writes
