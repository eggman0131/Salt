# Canon Module Refactor Plan

Three-phase effort to clean up the canon module architecture, improve CoFID/FDC separation, and simplify the matching pipeline.

**Sequence rationale:** Phase 1 is a targeted refactor of only what makes improvements easier to build. Phase 2 is the user-facing improvement work. Phase 3 is the full structural cleanup, done once the shape of the improvements is stable and won't move the goalposts again.

---

## Phase 1 — Targeted Refactor

**Goal:** Fix the three architecture violations and reduce the size of `CanonItems.tsx` so that CoFID and FDC UX can be redesigned independently in Phase 2.

**What this unlocks:** Each link section (CoFID, FDC) becomes a self-contained component with its own state and handlers. The matching pipeline logic becomes independently testable. Admin tools comply with the architecture rules.

All five tasks are independent and can be done in any order.

---

### Task 1.0 — Extract `CofidMatchButton` (prerequisite for 1.2)

**File:** `modules/canon/ui/CanonItems.tsx` lines 1956–1978 (end of file)

`CofidMatchButton` is a small presentational component defined inline at the bottom of `CanonItems.tsx`. It is currently used only inside the CoFID search UI, but must be accessible from the new `CofidLinkSection.tsx` once that is extracted.

**Fix:** Move `CofidMatchButton` and its `CofidMatchButtonProps` interface into a co-located file:
- Create `modules/canon/ui/CofidMatchButton.tsx`
- Export `CofidMatchButton` from it
- Update the import in `CanonItems.tsx`

---

### Task 1.1 — Move `mapFdcPortionsToUnitPatch` to `logic/`

**Current location:** `modules/canon/data/fdc-provider.ts` lines 182–261
**Problem:** Domain logic (converting FDC portion data → `UnitIntelligence` field patch) living in the data layer. Untestable in isolation.

**Fix:**
- Create `modules/canon/logic/fdc.ts`
- Move `ML_PER_UNIT` constant (lines 182–189) and `mapFdcPortionsToUnitPatch` function (lines 196–261) into it
- Imports needed: `FdcPortion` from `../data/fdc-provider` (or re-export type from types), `UnitIntelligence` from `../../../types/contract`
- Update `fdc-provider.ts` to import `mapFdcPortionsToUnitPatch` from `../logic/fdc`
- Export `mapFdcPortionsToUnitPatch` from `api.ts`

---

### Task 1.2 — Extract `CofidLinkSection` component

**Current location:** `CanonItems.tsx`
- State: lines 911–927 (10 variables)
- Handlers: lines 1054–1122 (3 handlers)
- JSX: lines 1585–1750 (CoFID section + nutritional data section)

**Problem:** 10 state variables, 3 handlers, and ~165 lines of JSX are inline in a 1978-line parent. CoFID UX cannot be redesigned without working in that file.

**Fix:** Create `modules/canon/ui/CofidLinkSection.tsx`

Props:
```typescript
interface CofidLinkSectionProps {
  item: CanonItem;
  onLinked: () => Promise<void>;
  onUnlinked: () => Promise<void>;
}
```

Move into this component:
- All CoFID state (cofidDetail, isLoadingCofidDetail, showCofidSearch, cofidSuggestions, isLoadingCofid, selectedMatch, cofidSearchFilter, allCofidItems, isLoadingAllCofid, localCofidSource)
- Handlers: handleSuggestCofid, handleLinkCofid, handleUnlinkCofid
- Nutrition data derivation (lines 1216–1221) — derives from localCofidSource/cofidDetail so belongs here
- CoFID section JSX and nutritional data section JSX (move nutrition to render immediately after the link UI inside this component)

API calls used (all already exported from `api.ts`):
- `suggestCofidMatch`, `linkCofidMatch`, `unlinkCofidMatch`, `getCofidItemById`, `getCanonCofidItems`

`ItemDetailSheet` replaces the inline sections with:
```tsx
<CofidLinkSection item={item} onLinked={onSaved} onUnlinked={onSaved} />
```

Also remove `NUTRIENT_LABELS` from `CanonItems.tsx` if it moves entirely into `CofidLinkSection`.

---

### Task 1.3 — Extract `FdcLinkSection` component

**Current location:** `CanonItems.tsx`
- State: lines 929–943 (8 variables)
- Handlers: lines 1126–1181 (3 handlers)
- JSX: lines 1768–1907

**Problem:** Same as Task 1.2. Also: `fdcDetail` and `isLoadingFdcDetail` are dead state — declared but never read in JSX (description/dataType now read from `localFdcSource.properties` after previous session's fix). Drop them.

**Fix:** Create `modules/canon/ui/FdcLinkSection.tsx`

Props:
```typescript
interface FdcLinkSectionProps {
  item: CanonItem;
  onLinked: () => Promise<void>;
  onUnlinked: () => Promise<void>;
}
```

Move into this component:
- FDC state, minus dead variables fdcDetail and isLoadingFdcDetail
- Handlers: handleSuggestFdc, handleLinkFdc, handleUnlinkFdc
- FDC section JSX

API calls used (all already exported from `api.ts`):
- `suggestFdcMatch`, `linkFdcMatch`, `unlinkFdcMatch`

`ItemDetailSheet` replaces the inline section with:
```tsx
<FdcLinkSection item={item} onLinked={onSaved} onUnlinked={onSaved} />
```

---

### Task 1.4 — Fix `EmbeddingSyncUtility` architecture violation

**File:** `modules/canon/ui/admin/EmbeddingSyncUtility.tsx` lines 9–15
**Problem:** Imports directly from `data/firebase-provider` and `data/embeddings-provider` — violates the rule that UI must only import from `api.ts`.

**Current direct imports:**
- `fetchCanonItems` from `data/firebase-provider` → already exported as `getCanonItems` in `api.ts`
- `fetchEmbeddingsFromLookup` from `data/embeddings-provider` → already exported as `getEmbeddingsFromLookup` in `api.ts`
- `deleteEmbeddings` from `data/embeddings-provider` → **not in api.ts, needs adding**
- `upsertCanonItemEmbeddingById` from `data/embeddings-provider` → **not in api.ts, needs adding**
- `publishLocalToMaster` from `data/embeddings-provider` → **not in api.ts, needs adding**

**Fix:**
- Add three wrappers to `api.ts`: `deleteEmbeddings`, `upsertCanonItemEmbeddingById`, `publishLocalToMaster`
- Update `EmbeddingSyncUtility.tsx` to import everything from `../../api`
- Use the existing `getCanonItems` / `getEmbeddingsFromLookup` names (or alias to match current usage)

---

### Task 1.5 — Remove internal algorithm re-exports from `api.ts`

**Problem:** `api.ts` re-exports raw algorithm internals that no external module uses:
`cosineSimilarity`, `levenshteinSimilarity`, `rankCandidates`, `normaliseForMatching`, `validateEmbeddingDimension`, `groupCoverageByAisle`, `calculateCoverageStats`, `getBestSemanticMatch`, `findSemanticMatches`, `buildCofidMatch`, `suggestBestMatch`

Confirmed: zero usages of these outside `modules/canon/`. They are implementation details of the matching pipeline leaking through the public surface.

**Fix:** Remove these re-exports from `api.ts`. Keep only consumer-facing functions. If `EmbeddingCoverageDashboard` uses `groupCoverageByAisle` or `calculateCoverageStats`, those stay — verify first.

---

## Phase 2 — Improvements

**Prerequisite:** Phase 1 complete and stable.

**What this phase addresses:** Now that CoFID and FDC are independent components with clear boundaries, and the pipeline logic is cleanly separated from I/O, each can be improved without risk of entanglement.

### 2A — CoFID and FDC as first-class separate concepts

With `CofidLinkSection` and `FdcLinkSection` as independent components, each can be redesigned without touching the other.

**CoFID** serves ingredient *identity* — it links a canon item to a known food composition database entry and pulls in nutritional data. Questions to resolve:
- Is the current two-panel search UX (algorithm suggestions + full database) the right model?
- Should match confidence be shown more prominently, or hidden from non-admin users?
- How should a low-confidence auto-link be surfaced for review?

**FDC** serves *unit conversion intelligence* — it populates `unit_weights` and `density_g_per_ml` from USDA portion data. Questions to resolve:
- Should FDC matching be more automated (bulk enrichment at import time) or remain per-item?
- How should FDC-populated `unit_weights` be visually distinguished from manually-entered values?
- Should the FDC link UI be surfaced prominently for unenriched items, or kept as an admin detail?

### 2B — Matching pipeline deep dive

The current pipeline (`matchRecipeIngredients.ts` + `logic/matchIngredient.ts`):
1. AI parses raw ingredient strings
2. Validates/repairs parse results
3. Per ingredient: fuzzy match → semantic match → auto-link at score ≥0.85 + gap ≥0.15
4. Unresolved items returned for manual review

The orchestration decisions (when to parse vs match, batch sizing, progress reporting, retry logic) are business logic currently living in `matchRecipeIngredients.ts` (data layer). These should move to `logic/` as part of this phase.

Questions to answer before redesigning:
- Where do users make wrong decisions in the review step?
- Does the 0.85/0.15 threshold produce the right auto-link rate in practice?
- Should pipeline stage visibility (parse → fuzzy → semantic → decision) be exposed to users or kept internal?
- How should multi-match conflicts be surfaced and resolved?
- Can the fuzzy + semantic merge step be simplified given current embedding quality?

---

## Phase 3 — Full Structural Refactor

**Prerequisite:** Phase 2 complete. Pipeline improvements stable. CoFID/FDC boundaries clear.

**Goal:** Clean up the data layer now that we know exactly what each provider needs to do.

### 3A — Split `firebase-provider.ts` (currently 1375 lines)

Once CoFID/FDC boundaries are settled from Phase 2, split by concern:
- `items-provider.ts` — item CRUD, approval, bulk deletion
- `aisles-provider.ts` — aisle CRUD, snapshot resolution, reorder
- `units-provider.ts` — unit CRUD, reorder
- `external-sources-provider.ts` — CoFID and FDC link management (`withCofidSource`, `withFdcSource` helpers and their Firestore writes)

### 3B — Split `embeddings-provider.ts` (currently 965 lines)

Two distinct concerns currently bundled:
- `embeddings-local-provider.ts` — IndexedDB cache management (read/write local lookup table)
- `embeddings-firestore-provider.ts` — Firestore master sync, batch embedding generation

### 3C — Final `api.ts` audit

After Phase 2 pipeline redesign, some functions currently in `api.ts` may no longer be needed externally, or may have been replaced. Audit the full export surface and remove anything unused.

---

## Notes

- No data migrations required in any phase — all changes are code-only
- Task 1.0 (CofidMatchButton extraction) is a prerequisite for Task 1.2 only
- All other Phase 1 tasks are fully independent
- Phase 2 tasks 2A and 2B are also independent of each other
