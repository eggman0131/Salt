
# SALT - Firebase Migration Roadmap (MANDATORY PROTOCOL)

This document is a BINDING PROTOCOL for implementing the Salt production backend.

## 🚫 THE RED LINE (DO NOT CROSS)
- **DO NOT MODIFY `BaseSaltBackend.ts`.** All synthesis logic is inherited.
- **DO NOT MODIFY `contract.ts`.** The schema is immutable.
- **DO NOT INTRODUCE `firebase.Timestamp`.** Use ISO Strings.

## PHASE 1: Authentication (Family Only)
- **Mechanism:** `firebase/auth` with Google Provider or Email.
- **Auth Guard:** Successful login MUST be followed by a `getDoc(doc(db, 'users', email))` check.
- **Failure:** If the user is not in the `users` collection, sign them out immediately and throw "Access Denied". Salt is for a specific kitchen staff only.

## PHASE 2: Firestore Topology
Map the Salt Manifest to these root collections:
- `users`: Keyed by email.
- `inventory`: Keyed by `id` (eq-...).
- `recipes`: Keyed by `id` (rec-...).
- `plans`: Keyed by `id` (plan-...). Special case: `plan-template`.
- `settings`: Single doc `global`.

## PHASE 3: Storage Integration
- Implement `resolveImagePath` using `firebase/storage`.
- In `createRecipe` and `updateRecipe`, if `imageData` is provided:
  1. Upload the base64 string as a JPEG blob.
  2. Set `imagePath` to the storage location.
  3. Return the updated Recipe object.

## PHASE 4: Manifest Restoration
- `importSystemState` must handle the full JSON manifest.
- **Atomicity:** Use `writeBatch()` for large imports.
- **Cleansing:** Optionally clear existing collections before restore (verify with user).

## PHASE 5: Transition
1. Implement `SaltFirebaseBackend.ts`.
2. Update `api.ts` to check `VITE_BACKEND_MODE === 'firebase'`.
3. Test by exporting a manifest from Simulation and importing it into Firebase.
