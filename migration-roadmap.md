# SALT - Firebase Migration Roadmap (MANDATORY PROTOCOL)

This document is a BINDING PROTOCOL for any AI agent tasked with migrating Salt to Firebase. 

## 🚫 THE RED LINE (DO NOT CROSS)
- **DO NOT MODIFY `BaseSaltBackend.ts`.** All AI orchestration, Gemini SDK logic, and persona rules are LOCKED. 
- **DO NOT MODIFY `prompts.ts`.** The Head Chef's voice is immutable.
- **DO NOT MODIFY `contract.ts`.** The Salt Manifest schema is the law.
- **DO NOT INTRODUCE `firebase.Timestamp`.** All dates must remain ISO Strings as per the contract.

## PHASE 1: The Skeleton (FirebaseBackend.ts)
Implement the class structure in `backend/firebase-backend.ts`. 
- **Rule:** It MUST extend `BaseSaltBackend`. 
- **Rule:** It MUST NOT import `@google/genai`. All AI logic is inherited.
- **Rule:** Focus exclusively on `collection()`, `doc()`, and `getDoc()` logic.

## PHASE 2: Authentication (Login/Logout)
- Use `firebase/auth`.
- Upon successful login, you MUST check the `users` collection in Firestore.
- If a user does not exist in the `users` collection, the login must fail (Authorised Family Only).

## PHASE 3: Data Mapping & Sanitation
When writing to or reading from Firestore:
- **Write:** Ensure `createdAt` and `timestamp` fields are `new Date().toISOString()`.
- **Read:** If you encounter a legacy Firebase Timestamp, you MUST convert it to a string immediately before returning it to the system.
- **ID Management:** Use the document ID as the object `id`. Do not store duplicate IDs inside the document body.

## PHASE 4: The Switcher (api.ts)
- Update `backend/api.ts` only when all persistence methods are implemented.
- The system must remain switchable via environment variables.

## PHASE 5: Batch Restoration
Update `importSystemState` to handle the JSON manifest.
- Use `writeBatch()` for efficiency.
- Re-validate every incoming object against the Zod schemas in `contract.ts` before writing.

## FAILURE MODE PROTOCOL
If you encounter a conflict between Firestore's native behavior and the Salt Contract:
1. **DO NOT** change the contract.
2. **DO NOT** "improvise" a new data shape.
3. **STOP** and ask the User for a "Technical Dispensation".
