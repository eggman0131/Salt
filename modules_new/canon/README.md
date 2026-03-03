# Canon
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for the canon module.

## Purpose
The Canon module owns all ingredient-domain reference data and the AI-first pipeline that maps raw recipe ingredient lines to structured, categorised, unit-validated results.

Specifically, Canon owns:
- Aisle (category) reference data, including the stable system aisle `uncategorised`.
- Unit reference data (measurement units with stable IDs).
- The AI batch ingredient parsing contract and validation logic.
- Optional deterministic pre-parsing of ingredient lines.

## Ownership
This module owns:
- All canon domain reference data (aisles, units).
- All AI ingredient parse logic and contracts.
- All validation/repair logic for AI parse results.
- All persistence for canon data.
- All UI for canon administration.

This module does **not**:
- Write to any other module's data.
- Import any other module's internals.
- Contain cross-module logic.

## Folder Structure

    api.ts              # Public API (pure synchronous functions only)
    types.ts            # Module-specific types
    logic/
      aiParseSchemas.ts # Zod schemas for AI parse contract
      validateAiParse.ts# Pure deterministic validation + review flags
    data/
      aiParseIngredients.ts   # Cloud Function wrapper (Gemini Flash-3)
      preparseIngredients.ts  # Optional deterministic pre-parse
    ui/
      admin/
        AiIngredientParseTool.tsx  # Admin tool for validating the AI pipeline
    __tests__/
      validateAiParse.test.ts  # Tests for validation logic
    admin.manifest.ts   # Admin tools exposed by this module
    README.md           # This file

## Public API Rules
- All functions in `api.ts` must be pure and synchronous.
- No Firestore, fetch, or cloud functions in `api.ts`.
- `api.ts` may call only this module's `logic/`.

## Public API

### `validateAiParseResults(rawResults, aisleRefs, unitRefs, ingredientCount)`
Pure validation and repair of AI batch parse results.

- **rawResults** – Array of `AiIngredientParseResult` as returned by the AI.
- **aisleRefs** – Allowed aisles `{id, name}[]`.
- **unitRefs** – Allowed units `{id, name, plural}[]`.
- **ingredientCount** – Expected number of results (equals the number of input lines).
- **Returns** `BatchParseResponse` – validated items + `hasReviewFlags` flag.

Validation rules:
1. Index coverage/uniqueness enforced; missing indices synthesise fallback results.
2. Invalid `aisleId` → repaired to `"uncategorised"`, `INVALID_AISLE_ID` flag raised.
3. `aisleId === "uncategorised"` with no `suggestedAisleName` → `MISSING_SUGGESTED_AISLE_NAME` flag raised.
4. Invalid `recipeUnitId` → repaired to `null`, `INVALID_RECIPE_UNIT_ID` flag raised.
5. Invalid `preferredUnitId` → repaired to `null`, `INVALID_PREFERRED_UNIT_ID` flag raised.
6. Duplicate indices → `DUPLICATE_INDEX` flag raised; first occurrence used.
7. Out-of-range indices → `INDEX_OUT_OF_RANGE` flag raised.

### `buildAiResponseSchemaDescription()`
Returns a JSON string describing the expected AI response schema for use in prompts.

### `UNCATEGORISED_AISLE`
Constant: `{ id: "uncategorised", name: "Uncategorised" }`.

## AI Request/Response Contract

### Zod Schemas

**`AiSingleParseResultSchema`** – One ingredient parse result:

```ts
{
  index: number;             // Zero-based, must align with input array
  quantity: number | null;
  recipeUnitId: string | null;   // Must be a unit ID from allowed list, or null
  preferredUnitId: string | null; // Must be a unit ID from allowed list, or null
  canonicalName: string;
  aisleId: string;           // Must be an aisle ID or "uncategorised"
  suggestedAisleName: string | null; // Required when aisleId is "uncategorised"
  preparations: string[];
  notes: string[];
}
```

**`AiParseResponseSchema`** – Array of the above.

### Model
`gemini-3-flash-preview` (referred to as Flash-3).

### Transport
The existing `cloudGenerateContent` Firebase Cloud Function (callable). No new Cloud Functions are needed.

## Logic Rules
- All business logic lives in `logic/`.
- Logic must be pure and deterministic.
- Logic must not call persistence or UI.

## Persistence Rules
- All I/O lives in `data/`.
- Persistence must not contain business logic.
- Persistence must not reach into other modules.
- AI calls go through `cloudGenerateContent` (shared Cloud Function).

## UI Rules
- UI must be display-only.
- UI must not contain business logic.
- The admin tool calls data functions for I/O and `api.ts` for pure logic.

## Types
- All types specific to this module live in `types.ts`.
- Global types (Unit, Aisle) live in `types/contract.ts`.

## System Aisles

The system aisle `uncategorised` (`id: "uncategorised"`) must always exist. When the AI cannot categorise an ingredient it uses this aisle ID and should provide a `suggestedAisleName`. Aisle ID values are stable; cosmetic name changes are safe.

## Admin Tools

| ID | Label |
|----|-------|
| `canon.aiIngredientParseTool` | AI Ingredient Parse Tool |

The AI Ingredient Parse Tool lets admins paste raw ingredient lines, run the AI parse, and inspect results and review flags.

## Cross-Module Interaction
This module does not write to any other module's data. Other modules (e.g. Recipes) may read canon reference data through the canon module's public API.

## Architectural Source of Truth
All code in this module must follow the rules defined in `docs/salt-architecture.md`.
