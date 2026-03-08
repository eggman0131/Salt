# Canon
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

## Purpose

The canon module owns the reference collections for aisles, units, and canonical ingredient items. It provides the ingredient matching pipeline used when saving or repairing recipes, and manages the UK food composition (CoFID) database integration.

## Ownership

This module owns:
- `canonAisles` — canonical aisle taxonomy for the UK.
- `canonUnits` — canonical measurement unit registry.
- `canonItems` — canonical ingredient items with a review workflow.
- `canonCofidItems` — UK CoFID food composition data.
- `canonEmbeddingLookup` — vector embedding index for semantic ingredient matching.

This module does **not**:
- Write to any other module's collections.
- Import any other module's internals.

## Folder Structure

    api.ts                          # Public API
    types.ts                        # Module-specific types (CoFIDGroupAisleMapping, CanonMatchEvent, etc.)
    logic/
      aisles.ts                     # Pure aisle helpers and Zod schema
      units.ts                      # Pure unit helpers and Zod schema
      items.ts                      # Pure item helpers and Zod schema
      cofid-mapping.ts              # CofID mapping resolver and report generator
      embeddings.ts                 # Pure semantic matching (cosine similarity)
      suggestCofidMatch.ts          # Pure fuzzy matching (Levenshtein similarity)
      validateAiParse.ts            # Pure validation and repair of AI parse results
      aiParseSchemas.ts             # Zod schemas for AI parse responses
      matchIngredient.ts            # Pure composite matching logic (fuzzy + semantic + LLM)
      seed.ts                       # Pure seed validation helpers
    data/
      firebase-provider.ts          # All Firestore CRUD operations
      embeddings-provider.ts        # Embedding I/O and Cloud Function calls
      aiParseIngredients.ts         # AI ingredient parsing via Cloud Function
      matchRecipeIngredients.ts     # Ingredient matching pipeline (I/O wrapper)
      match-events-provider.ts      # Match event persistence and stats
    ui/
      admin/                        # Admin tool components
    admin.manifest.ts               # Declares canon admin tools
    __tests__/                      # Multiple test files

## Ingredient Matching Pipeline

The canon module runs a composite matching pipeline for recipe ingredients:

1. **Fuzzy matching** — Levenshtein similarity against canon item names.
2. **Semantic matching** — Vector embedding cosine similarity via the `canonEmbeddingLookup` index.
3. **LLM arbitration** — Falls back to AI when fuzzy and semantic scores are inconclusive.

Matching is aisle-bounded: candidates are filtered to the same aisle before scoring.

If no match is found above the threshold, a new `canonItem` is created with `needsReview: true`.

## Public API

### Read Helpers

```typescript
getCanonAisles(): Promise<Aisle[]>
getCanonUnits(): Promise<Unit[]>
getCanonItems(): Promise<CanonItem[]>
getCanonItemById(id: string): Promise<CanonItem | null>
```

### Canon Items CRUD

```typescript
addCanonItem(input: { name: string; aisleId: string; preferredUnitId: string; needsReview?: boolean }): Promise<CanonItem>
editCanonItem(id: string, updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId' | 'needsReview'>>): Promise<void>
approveItem(id: string): Promise<void>
deleteItem(id: string): Promise<void>
deleteAllItems(): Promise<void>
```

### Canon Aisles CRUD

```typescript
addCanonAisle(input: { name: string; sortOrder?: number }): Promise<Aisle>
editCanonAisle(id: string, updates: Partial<Pick<Aisle, 'name' | 'sortOrder'>>): Promise<void>
removeCanonAisle(id: string): Promise<void>
reorderAisles(updates: Array<{ id: string; sortOrder: number }>): Promise<void>
```

### Canon Units CRUD

```typescript
addCanonUnit(input: { name: string; plural?: string | null; category: 'weight' | 'volume' | 'count' | 'colloquial'; sortOrder?: number }): Promise<Unit>
editCanonUnit(id: string, updates: Partial<Pick<Unit, 'name' | 'plural' | 'category' | 'sortOrder'>>): Promise<void>
removeCanonUnit(id: string): Promise<void>
reorderUnits(updates: Array<{ id: string; sortOrder: number }>): Promise<void>
```

### Recipe Ingredient Matching

```typescript
processRawRecipeIngredients(
  rawLines: string[],
  onProgress?: (progress: { stage: 'parse' | 'match'; current: number; total: number }) => void
): Promise<RecipeIngredient[]>

matchAndLinkRecipeIngredient(ingredient: RecipeIngredient, aisleId?: string): Promise<RecipeIngredient>
matchAndLinkRecipeIngredients(ingredients: RecipeIngredient[], onProgress?: (current: number, total: number) => void): Promise<RecipeIngredient[]>

matchIngredientToCanonItem(
  ingredientName: string,
  canonItems: CanonItem[],
  embeddingLookup?: CanonEmbeddingLookup[],
  queryEmbedding?: number[],
  aisleId?: string
): IngredientMatchResult
```

### CofID Integration

```typescript
getCofidMappings(): Promise<CoFIDGroupAisleMapping[]>
addCofidMapping(input: { cofidGroup: string; cofidGroupName: string; aisleId: string; aisleName: string }): Promise<CoFIDGroupAisleMapping>
editCofidMapping(id: string, updates: Partial<...>): Promise<void>
removeCofidMapping(id: string): Promise<void>

suggestCofidMatch(canonItemId: string): Promise<{ bestMatch: SuggestedMatch | null; candidates: SuggestedMatch[] }>
linkCofidMatch(canonItemId: string, cofidId: string, matchMetadata: any): Promise<void>
unlinkCofidMatch(canonItemId: string): Promise<void>
getCofidItemById(id: string): Promise<CofIDItem | null>
getCanonCofidItems(): Promise<any[]>
```

### Semantic Embeddings

```typescript
getEmbeddingsFromLookup(aisleId?: string): Promise<CanonEmbeddingLookup[]>
generateCanonItemEmbeddings(): Promise<{ success: boolean; generated: number; errors: number; message?: string }>
seedCofidEmbeddings(rawItems: any[]): Promise<{ success: boolean; imported: number; skipped: number; errors: number }>

// Pure helpers
cosineSimilarity(a: number[], b: number[]): number
findSemanticMatches(queryEmbedding: number[], candidates: CanonEmbeddingLookup[], options?: { aisleId?: string; threshold?: number; limit?: number }): SemanticMatch[]
getBestSemanticMatch(queryEmbedding: number[], candidates: CanonEmbeddingLookup[], options?: { aisleId?: string; threshold?: number }): SemanticMatch | null
```

### Seed Operations

```typescript
seedCanonAisles(aisles: Aisle[]): Promise<void>
seedCanonUnits(units: Unit[]): Promise<void>
seedCofidGroupAisleMappings(mappings: Record<string, any>): Promise<void>
seedCofidItems(items: any[], onProgress?, signal?): Promise<{ imported: number; failed: number; errors: Array<...> }>
```

### Pure Aisle / Unit / Item Helpers

```typescript
sortAisles(aisles: Aisle[]): Aisle[]
findAisleById(aisles: Aisle[], id: string): AisleLookupResult
findAisleByName(aisles: Aisle[], name: string): AisleLookupResult
hasUncategorisedAisle(aisles: Aisle[]): boolean
UNCATEGORISED_AISLE_ID: 'uncategorised'

sortUnits(units: Unit[]): Unit[]
findUnitById(units: Unit[], id: string): UnitLookupResult
groupUnitsByCategory(units: Unit[]): UnitsByCategory

sortItems(items: CanonItem[]): CanonItem[]
normalizeItemName(name: string): string
findItemById(items: CanonItem[], id: string): ItemLookupResult
findItemByName(items: CanonItem[], name: string): ItemLookupResult
filterItemsNeedingReview(items: CanonItem[]): CanonItem[]
filterItemsByAisle(items: CanonItem[], aisleId: string): CanonItem[]
```

### Match Performance Monitoring

```typescript
getMatchEvents(options?: { entityId?: string; eventType?: ...; startDate?: Date; endDate?: Date; limit?: number }): Promise<CanonMatchEvent[]>
getPerformanceStats(startDate: Date, endDate: Date): Promise<{ totalEvents: number; eventsByType: ...; avgDurationByType: ...; successRate: number; totalDuration: number }>
```

## Types

Canon-specific types live in `modules/canon/types.ts` — not in `types/contract.ts`. These include:
- `CoFIDGroupAisleMapping`
- `CanonMatchEvent`
- `AisleLookupResult`, `UnitLookupResult`, `UnitsByCategory`
- `AisleRef`, `UnitRef`, `AiSingleParseResult`, `ValidatedParseResult`, `BatchParseResponse`, `ReviewFlag`
- `SemanticMatch`, `SuggestedMatch`, `IngredientMatchResult`

Global types (`Aisle`, `Unit`, `RecipeIngredient`) live in `types/contract.ts`.

## Admin Tools

Declared in `admin.manifest.ts` and loaded by the admin dashboard:

| Tool ID | Label | Purpose |
|---------|-------|---------|
| `canon.seeder` | Canon Seeder | Seed aisles, units, and CofID data |
| `canon.items` | Canon Items | Full CRUD + review queue |
| `canon.aiParseTool` | AI Ingredient Parser | Parse ingredient lines with AI |
| `canon.cofid-mapping` | CofID Mapping Report | View import validation results |
| `canon.aisles-viewer` | Canon Aisles | Read-only aisle viewer |
| `canon.units-viewer` | Canon Units | Read-only unit viewer |

## Seed Data

| File | Collection | Notes |
|------|------------|-------|
| `seed-data/canon-aisles.json` | `canonAisles` | 35 aisles; `uncategorised` at sortOrder 999 |
| `seed-data/canon-units.json` | `canonUnits` | 46 units across weight / volume / count / colloquial |

Seeding is idempotent. Use the Canon Seeder admin tool in-app (authenticated context).

## Testing

```bash
npx vitest run modules/canon
```

Tests in `__tests__/` cover pure logic only — no Firebase, no network.

## Dependencies

- `types/contract.ts` — `Aisle`, `Unit`, `RecipeIngredient`
- `shared/backend/firebase` — Firestore, Firebase Storage, Cloud Functions
- `zod` — document validation schemas

## Architectural Source of Truth

All code in this module must follow the rules defined in `docs/salt-architecture.md`.
