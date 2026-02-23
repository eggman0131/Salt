# Contract-Based Backup System

## Overview

Salt now uses a **dynamic, contract-based backup system** that automatically includes all Firestore collections defined in the Collection Registry.

## The Problem (Before)

The old backup system required manual updates in **three places** when adding new collections:

1. `App.tsx` → `handleExportData()` - fetch from new backend
2. `system-backend.ts` → `importSystemState()` - import to new collection
3. Remember to test both export and import

**Result:** Easy to forget (e.g., cookGuides were not backed up)

## The Solution (Now)

**Single Source of Truth:** `COLLECTION_REGISTRY` in `types/contract.ts`

When you add a new collection:
```typescript
// In types/contract.ts
export const COLLECTION_REGISTRY = {
  // ... existing collections ...
  
  myNewCollection: {
    schema: MyNewCollectionSchema,  // Zod schema from contract
    requiresEncoding: false         // true for nested arrays (like recipes)
  }
}
```

**That's it!** Backup/restore automatically includes it.

## Architecture

### 1. Collection Registry (The Law)
`types/contract.ts` → `COLLECTION_REGISTRY`

Defines:
- Collection name (matches Firestore collection)
- Zod schema for validation
- Encoding requirements (nested arrays)
- Singleton flag for single-document collections (like settings)

### 2. Dynamic Export
`systemBackend.exportAllData()` iterates through registry:
- For regular collections: `getDocs(collection(db, collectionName))`
- For singletons: `getDoc(doc(db, collectionName, documentId))`
- Returns complete backup object with all data

### 3. Dynamic Import
`systemBackend.importAllData(data)` iterates through registry:
- Step 1: Clear all collections
- Step 2: Batch write all documents
- Applies encoding if needed (recipes)
- Handles singletons specially (settings)

## Collections Currently Backed Up

```typescript
✅ recipes              // With nested array encoding
✅ inventory            // Equipment
✅ plans                // Meal plans
✅ canonical_items      // Kitchen data
✅ units                // Kitchen data
✅ aisles               // Kitchen data
✅ categories           // Kitchen data
✅ shopping_lists       // Shopping
✅ shopping_list_items  // Shopping
✅ cookGuides           // Cook mode (NEW!)
✅ users                // System
✅ settings             // System (singleton)
```

## Benefits

### For Developers
- ✅ Add collection once in contract
- ✅ No manual backup code
- ✅ Type-safe with Zod schemas
- ✅ Impossible to forget

### For Users
- ✅ Complete data portability
- ✅ All features backed up automatically
- ✅ Backward compatible with old backups

### For The System
- ✅ Follows "Contract is The Law" principle
- ✅ Single source of truth
- ✅ Maintainable and scalable

## Usage

### Export (in App.tsx)
```typescript
const handleExportData = async () => {
  const exportData = await systemBackend.exportAllData();
  // Download as JSON...
};
```

### Import (in App.tsx)
```typescript
const handleImport = async (file: File) => {
  const text = await file.text();
  const data = JSON.parse(text);
  await systemBackend.importAllData(data);
};
```

## Adding a New Collection

Checklist when creating a new feature with Firestore:

1. **Define schema in `types/contract.ts`**
   ```typescript
   export const MyFeatureSchema = z.object({
     id: z.string(),
     // ... fields
   });
   export type MyFeature = z.infer<typeof MyFeatureSchema>;
   ```

2. **Add to Collection Registry**
   ```typescript
   export const COLLECTION_REGISTRY = {
     // ... existing
     myFeatures: {
       schema: MyFeatureSchema,
       requiresEncoding: false  // or true if nested arrays
     }
   }
   ```

3. **Create backend**
   ```typescript
   // modules/my-feature/backend/firebase-my-feature-backend.ts
   const collectionName = 'myFeatures'; // matches registry key
   ```

**Done!** Backup automatically includes your new collection.

## Testing

To verify your collection is backed up:

1. Create some test data
2. Admin → Backup → Download
3. Open JSON file → verify your collection exists
4. Admin → Restore → Upload same file
5. Verify data restored correctly

## Migration Notes

### Backward Compatibility
Old backup files work automatically:
- Missing collections are skipped during import
- Extra collections in backup are ignored
- Schema validation ensures data integrity

### Format Changes
If you change a schema:
1. Update Zod schema in contract
2. Add migration logic in backend if needed
3. Consider versioning backup format

## Troubleshooting

### Collection not in backup?
- Check `COLLECTION_REGISTRY` in contract.ts
- Verify collection name matches Firestore exactly
- Check browser console for export errors

### Import fails?
- Check JSON format is valid
- Verify schema validation passes
- Check for ID conflicts
- Review browser console for specific errors

## Future Enhancements

- [ ] Schema versioning and migrations
- [ ] Partial backup (select collections)
- [ ] Scheduled automatic backups
- [ ] Cloud storage integration
- [ ] Backup diff/merge tools
