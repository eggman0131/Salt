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

(Entries will be added as contract changes are made)

---

## Rules

1. **No silent changes:** Any modification to `types/contract.ts` without a corresponding changelog entry will fail CI.
2. **Document intent:** Explain *why* the change was needed, not just *what* changed.
3. **Impact assessment:** Consider downstream effects on modules, backends, and backups.
4. **Backwards compatibility:** Note any breaking changes and migration steps.
5. **Snapshot update:** The test suite snapshot is regenerated automatically when this file is modified.
