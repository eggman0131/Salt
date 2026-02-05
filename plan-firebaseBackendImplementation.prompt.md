# Plan: Firebase Backend Implementation

We will implement the Firebase "Hands" backend to mirror the simulated backend's public behavior, following the migration roadmap and global guidelines. The plan prioritizes strict contract compliance, no changes to `BaseSaltBackend`, and Firebase-specific logic isolated in `backend/firebase-backend.ts`. Decisions: use Google provider auth first, use email as the users doc ID without duplicating `id`, and `importSystemState` will clear existing data before restore.

**Steps**
1. **Audit contract + simulated behavior**: Map each `ISaltBackend` method to its simulated counterpart in [backend/simulated.ts](backend/simulated.ts) and validate required fields in [types/contract.ts](types/contract.ts). Focus on createdAt/createdBy, template plan handling, and soft-delete behavior.
2. **Auth & user gate**: Implement `login`, `logout`, `getCurrentUser`, `getUsers`, `createUser`, `deleteUser` in [backend/firebase-backend.ts](backend/firebase-backend.ts), using Google provider and the "users collection contains email" guard described in [migration-roadmap.md](migration-roadmap.md). Ensure non-authorized users sign out and throw "Access Denied".
3. **Firestore collections & mapping**: Implement inventory/recipes/plans CRUD in [backend/firebase-backend.ts](backend/firebase-backend.ts) with collection names from [migration-roadmap.md](migration-roadmap.md). Use doc IDs as object `id`, convert Firestore Timestamps to ISO strings, and mirror simulated behavior (items not returned once deleted).
4. **Recipe image storage**: Implement `resolveImagePath`, `createRecipe`, and `updateRecipe` in [backend/firebase-backend.ts](backend/firebase-backend.ts) using Firebase Storage with `Recipe.imagePath` storing the Storage path. Use `getDownloadURL` to resolve paths, per [backend-guidelines.md](backend-guidelines.md).
5. **Planner logic parity**: Implement `getPlanByDate`, `getPlanIncludingDate`, and `createOrUpdatePlan` in [backend/firebase-backend.ts](backend/firebase-backend.ts) to match template plan handling and date-range selection behavior from [backend/simulated.ts](backend/simulated.ts).
6. **Import/restore**: Implement `importSystemState` to clear existing collections and restore full manifest via `writeBatch()` in [backend/firebase-backend.ts](backend/firebase-backend.ts), enforcing contract shape and ISO date strings.
7. **Backend mode switch**: Ensure [backend/api.ts](backend/api.ts) selects Firebase when `VITE_BACKEND_MODE === 'firebase'`, without changing base backend logic.
8. **Validation passes**: Scan all paths for direct `firebase.Timestamp` leakage and any bypass of contract validation. Ensure no UI or prompt changes are required for this migration.

**Verification**
- Run `npm run emulators` and `npm run dev`, switch to Firebase mode in `.env`, and verify login gate against `users` collection.
- Create/update/delete equipment, recipes, plans; confirm returned data matches contract and timestamps are ISO strings.
- Upload a recipe image and confirm `imagePath` resolves via `resolveImagePath`.
- Export from simulation, import into Firebase, and verify parity across collections.

**Decisions**
- Auth: Google provider only
- Users collection: doc ID is email, no duplicate `id` field
- `importSystemState`: clear then restore
