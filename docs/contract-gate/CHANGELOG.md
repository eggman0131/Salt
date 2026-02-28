# Contract Changelog

All changes to "The Law" (`types/contract.ts`) must be documented here with intention and impact analysis.

## Format

Each entry must follow this structure:

```
### [Date] - [Brief Title]
**Impact:** [System-wide effects]
**Changes:**
- [Specific field/type changes]
- [Additions or removals]
**Rationale:** [Why this change was necessary]
**Migration:** [Any data migration steps or backwards compatibility notes]
```

## Entries

### [2026-02-28] - Multi-Source External Link Support for Canonical Items
**Impact:** Canonical items can now link to multiple external databases simultaneously (CoFID, Open Food Facts, USDA, etc.) with individual confidence scores and extensible property storage for source-specific data.
**Changes:**
- Added `ExternalSourceLinkSchema` defining structure for external database links:
  - `source`: Enum identifying the external system
  - `externalId`: ID in that system
  - `confidence`: Optional match confidence (0-1)
  - `properties`: Extensible key-value storage for source-specific data (nutrition, brands, pricing, etc.)
  - `syncedAt`: Per-source sync timestamp
- Modified `CanonicalItemSchema`:
  - **Removed:** `source` (single enum field)
  - **Removed:** `externalId` (single string field)
  - **Added:** `externalSources` (optional array of ExternalSourceLink objects)
  - **Kept:** `lastSyncedAt` (now represents max sync time across all sources), `barcodes`, `itemType`
**Rationale:** Single-source tracking was insufficient for the planned semantic matching pipeline where ingredients may match against multiple nutrition databases. Supporting multiple sources enables:
- Aggregating nutrition data from CoFID + Open Food Facts + USDA simultaneously
- Tracking confidence scores per-source for prioritization
- Storing source-specific metadata in extensible `properties` field (different schemas per source)
- Individual sync timestamps for staleness detection
- Future-proofing for multi-database integrations
**Migration:** **Breaking change** - existing Canon items with CoFID links will lose `source` and `externalId` fields. No automated migration provided. Canon module data is disposable during development phase. After stable release, CoFID items should be re-imported or manually migrated to `externalSources: [{ source: 'cofid', externalId: '...' }]` format.

---

### [2026-02-28] - Include CoFID Group Mappings In Kitchen Backup
**Impact:** Main backup/restore now includes CoFID group-to-aisle mapping records while still excluding raw CoFID food data.
**Changes:**
- Added `cofid_group_aisle_mappings` to `COLLECTION_REGISTRY` in `types/contract.ts`.
- Bound registry entry to `CoFIDGroupAisleMappingSchema` with `idField: 'id'` and `requiresEncoding: false`.
**Rationale:** CoFID aisle mappings are user-curated kitchen configuration and should travel with the kitchen state backup.
**Migration:** Backwards-compatible addition. Existing backups remain valid; restored backups without this collection simply continue with default/empty mappings.

---

## Rules

1. **No silent changes:** Any modification to `types/contract.ts` without a corresponding changelog entry will fail CI.
2. **Document intent:** Explain *why* the change was needed, not just *what* changed.
3. **Impact assessment:** Consider downstream effects on modules, backends, and backups.
4. **Backwards compatibility:** Note any breaking changes and migration steps.
5. **Snapshot update:** The test suite snapshot is regenerated automatically when this file is modified.
