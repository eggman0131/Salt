# Seed Data Vault

Canonical data sources managed by git. **These are version-controlled** because they cost time/money to regenerate.

**Note**: Seeding is now handled via the Admin panel (see Usage below) rather than CLI scripts.

## Files

### units.json
Comprehensive British cooking unit vocabulary (36 units across 4 categories):
- **Weight**: g, kg, mg (metric)
- **Volume**: ml, l, tsp, tsps, tbsp, tbsps (metric + abbreviations)
- **Count**: clove/cloves, slice/slices, piece/pieces, stick/sticks, tin/tins, can/cans, jar/jars, pack/packs, packet/packets, bag/bags, bunch, head, fillet/fillets, rasher/rashers, block, pot, tray, punnet
- **Colloquial**: pinch, dash, handful, sprig/sprigs, knob, sheet, ball, round, joint, rib/ribs, cube

**Regeneration cost**: LOW (manually added/updated as vocabulary improves from recipe imports)

**Schema**:
```json
{
  "id": "clove",              // unique identifier
  "name": "clove",            // singular form
  "plural": "cloves",         // plural form (null if no plural)
  "category": "count",        // weight | volume | count | colloquial
  "sortOrder": 8              // display order in UI
}
```

**Used by**: 
- Ingredient parser during recipe import (normalizing units)
- Fallback vocabulary when Firestore empty (test mocks, migrations)

### cofid-aisle-mappings.json
Maps UK COFID food IDs to Salt aisle categories.

**Regeneration cost**: HIGH (manual categorization + fuzzy matching validation)

**Used by**:
- Shopping list aggregation
- Item categorization in inventory

### cofid-items.json
Full export of UK COFID canonical food items (~7000 items).

**Regeneration cost**: HIGH (sourced from external COFID API, processed, tested)

**Used by**:
- Kitchen data module (categories, canonical items)
- Fuzzy matching fallback when ingredient not directly recognized

## Workflows

### Seeding During Development
```bash
# Start development server
npm run dev

# Open Admin panel (login required)
# Navigate to Kitchen Data section
# Click "Seed Cooking Units" button
```

### Seeding During Testing
Unit tests reference seed vocabularies for realistic parsing validation. Tests pass arrays directly rather than loading from Firestore.

### Production Data Restoration
Backup restore uses these as fallback if user export missing. Manifests include export date; older exports fall back to current seed data.

### Seeding in Production
Access the Admin panel (if you have admin role):
1. Go to Kitchen Data section
2. Click "Seed Cooking Units"
3. Safe to run multiple times (existing units are preserved)

## Maintenance Workflow

### Adding a New Unit

1. **Edit `units.json`**:
   ```bash
   # Add to appropriate category (weight, volume, count, colloquial)
   # Keep sortOrder sequential within category
   {
     "id": "cup",
     "name": "cup",
     "plural": "cups",
     "category": "volume",
     "sortOrder": 8
   }
   ```

2. **Commit**:
   ```bash
   git add seed-data/units.json
   git commit -m "chore: add cup/cups unit (volume)"
   ```

3. **Seed into Firestore via Admin Panel**:
   - Admin → Kitchen Data → "Seed Cooking Units"
   - Or wait for next system startup (auto-seeded if missing)

### Updating COFID Mappings

When COFID classification rules change:

1. Export new mapping from COFID source
2. Replace `cofid-aisle-mappings.json`
3. Seed: Admin → Kitchen Data → "Import CoFID Group Mappings"
4. Test with known recipe imports
5. Commit with message explaining the changes

### Regenerating Full COFID Item Export

**High-effort task.** When sourcing fresh COFID data:

1. Contact COFID data provider or run export script
2. Process and normalize raw export
3. Place in `cofid-items.json`
4. Test fuzzy matching accuracy against known recipes
5. Seed via future Admin panel (when implemented)
6. Commit with detailed message:
   ```
   git commit -m "chore: refresh COFID items export from UK API v2.3
   
   - 7,145 items (up from 7,089)
   - Updated aisle classifications for 340 items
   - Removed 84 deprecated items
   - Tested against 50-recipe corpus: 94% match rate
   "
   ```

## Do's and Don'ts

**DO:**
- ✅ Commit seed data changes (they're canonical)
- ✅ Validate before committing: `npm run validate:seeds`
- ✅ Keep IDs immutable (they're foreign keys in other data)
- ✅ Document regen cost in git commit messages
- ✅ Test that seeded data actually loads into Firestore

**DO NOT:**
- ❌ Delete a seed file without understanding dependencies
- ❌ Break the JSON structure
- ❌ Change sortOrder without reason (affects UI order)
- ❌ Commit invalid JSON (CI will catch it, but prevent push)
- ❌ Use arbitrary numbers for IDs (use semantic names: "tsp", "clove")

## Dependencies

**Seed Data → Module/Feature:**
- `units.json` → Ingredient parser (Stage 1 quantity extraction)
- `cofid-aisle-mappings.json` → Shopping list aggregation, inventory categorization
- `cofid-items.json` → Fuzzy matching fallback, kitchen data

**Breaking a Seed File = Breaking These Features:**
- Delete `units.json` → Parser can't normalize units
- Delete `cofid-aisle-mappings.json` → Shopping lists uncategorized
- Delete `cofid-items.json` → Fuzzy matching limited to direct string matches

## Directory Structure

```
seed-data/
├── README.md                        # This file
├── .gitignore                       # (empty — files ARE tracked)
├── units.json                       # 36 cooking units
├── cofid-aisle-mappings.json       # COFID → Aisle mappings (future)
├── cofid-items.json                # COFID food database (future)
└── scripts/
    ├── seed-units.mjs              # Load units into Firestore
    ├── validate-seeds.mjs           # Check all seed files
    └── seed-all.mjs                 # (future) Run all seeders
```

## Future Improvements

- [ ] seed-all.mjs: Run all seeders in sequence
- [ ] seed-cofid-mappings.mjs: Load COFID mappings from git to Firestore
- [ ] Interactive CLI: `npm run seed:interactive` to select which seeds to load
- [ ] Backup export: `npm run export:seeds` to dump current Firestore state
- [ ] Diff tool: Compare seed files across branches (useful for migrations)
