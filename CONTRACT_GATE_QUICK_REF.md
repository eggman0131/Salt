# Contract Changelog Gate - Quick Reference

## When You Need to Modify `types/contract.ts`

### ✅ The 5-Step Workflow

```bash
# 1️⃣ Make your change
vim types/contract.ts
# Add, remove, or modify schemas/types

# 2️⃣ Document immediately
vim CONTRACT_CHANGELOG.md
# Add entry under "## Entries" following the template:
#
# ### 2026-02-16 - [Brief Title]
# **Impact:** [System effects]
# **Changes:**
# - [What changed]
# **Rationale:** [Why]
# **Migration:** [Data migration info]

# 3️⃣ Verify the gate
npm run check-contract
# Should show: ✅ Contract change detected AND documented in changelog

# 4️⃣ Update the snapshot
npm run update-contract-snapshot
# Should show: ✅ Ready to commit!

# 5️⃣ Commit everything together
git add types/contract.ts CONTRACT_CHANGELOG.md scripts/contract-snapshot.mjs
git commit -m "feat: [description]"
```

## Commands Reference

### Check Contract (Validation)
```bash
npm run check-contract
```
**Exit codes:**
- `0` = Pass (unchanged or documented)
- `1` = Fail (changed but not documented)
- `2` = Error

### Update Snapshot (After Documentation)
```bash
npm run update-contract-snapshot
```
Run this after you've added your changelog entry, before committing.

## Common Scenarios

### ❌ "Gate Failure: Contract changed but changelog not updated"

**Solution:**
```bash
# 1. Edit the changelog
vim CONTRACT_CHANGELOG.md

# 2. Add your entry following the template

# 3. Update snapshot
npm run update-contract-snapshot

# 4. Try the gate again
npm run check-contract
# Should now show: ✅
```

### ✅ "How do I know if my changelog entry is correct?"

**Format checklist:**
- [ ] Title is clear and specific
- [ ] **Impact:** explains which modules/systems are affected
- [ ] **Changes:** lists exact field/type additions/removals
- [ ] **Rationale:** explains why this change was needed
- [ ] **Migration:** documents any data migration or backwards compatibility

### 🔄 "How do I revert a change?"

**Add a new changelog entry:**
```markdown
### 2026-02-17 - Revert: [Original Feature]
**Impact:** Cancels changes from [date]
**Changes:**
- Removed [field/type]
**Rationale:** [Reason for revert - e.g., "Not ready for this quarter"]
**Migration:** [Any cleanup needed]
```

Then:
```bash
git revert <commit-hash>
npm run update-contract-snapshot
git commit
```

## Changelog Template

```markdown
### [Date] - [Brief Title]
**Impact:** [Which modules? System-wide effects?]
**Changes:**
- [Specific change 1]
- [Specific change 2]
**Rationale:** [Why was this change necessary?]
**Migration:** [Steps for existing data? Backwards compatibility notes?]
```

### Example

```markdown
### 2026-02-16 - Add Equipment Maintenance Status
**Impact:** Equipment module, admin panel, backend sync
**Changes:**
- Added `lastMaintenanceDate` (string, optional) to Equipment schema
- Changed `status` enum from 2 values to 3 values (added 'Maintenance')
**Rationale:** Track maintenance schedules for high-end kitchen equipment
**Migration:** Existing equipment has null lastMaintenanceDate; new entries must populate this field
```

## Git Integration

### Pre-commit Hook Setup

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
npm run check-contract || exit 1
```

Or use Husky:
```bash
npm install husky
npx husky add .husky/pre-commit "npm run check-contract"
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Verify Contract Changelog
  run: npm run check-contract
```

Add this step to your workflow to prevent PRs that modify the contract without documentation.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Gate fails after contract edit | Add changelog entry, run `npm run update-contract-snapshot` |
| "Snapshot not found" | Check `scripts/contract-snapshot.mjs` exists |
| Gate passes but should fail | Run `git status` to verify your changelog changes |
| Snapshot shows old checksum | Delete `scripts/contract-snapshot.mjs` and run `npm run update-contract-snapshot` |

## Files You'll Work With

| File | Action |
|------|--------|
| `types/contract.ts` | Edit directly |
| `CONTRACT_CHANGELOG.md` | Add entries (never delete old ones) |
| `scripts/contract-snapshot.mjs` | Never edit manually |

## Never

❌ **Don't** manually edit `scripts/contract-snapshot.mjs`
❌ **Don't** commit contract changes without updating the changelog
❌ **Don't** commit the changelog without updating the snapshot
❌ **Don't** try to bypass the gate with force-push or branches

## Always

✅ **Do** document changes immediately when you make them
✅ **Do** include both impact and rationale in the changelog
✅ **Do** run `npm run update-contract-snapshot` after documenting
✅ **Do** commit all three files together (contract, changelog, snapshot)

## Documentation

- **[README_CONTRACT_GATE.md](./README_CONTRACT_GATE.md)** — Quick start & overview
- **[GATE_GUIDE.md](./GATE_GUIDE.md)** — Complete developer guide
- **[CONTRACT_GATE_IMPLEMENTATION.md](./CONTRACT_GATE_IMPLEMENTATION.md)** — Technical details

## Support

The gate provides clear error messages. If it fails:

1. Read the error message (it tells you exactly what to do)
2. Edit `CONTRACT_CHANGELOG.md` 
3. Run `npm run update-contract-snapshot`
4. Try `npm run check-contract` again

---

**The Law is Constitutional. Modifications must be intentional and documented.**
