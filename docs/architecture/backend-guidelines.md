# SALT - Backend Guidelines

The Salt backend is built on a strict inheritance hierarchy designed to keep "Intelligence" (AI Orchestration/Logic) separate from "Execution" (Persistence/Transport).

## 1. The Separation Principle
- **BaseSaltBackend (The Brain):** Abstract base class housing ALL AI orchestration, JSON sanitization, and prompt assembly. Contains no persistence or transport logic. Must never be modified during infrastructure changes.
- **SaltFirebaseBackend (The Hands):** Concrete implementation responsible ONLY for CRUD operations (Firestore), Authentication (Firebase Auth), Storage (Firebase Storage), and AI request proxying (Firebase Functions).

This separation ensures:
- AI logic remains stable during backend migrations
- Business logic never depends on specific database implementations
- Testing and validation can occur at the appropriate abstraction level

## 2. Technical Specification: Gemini SDK Location
To enable future proxy/serverless migration and maintain separation of concerns:
- **SDK Instantiation:** The Gemini client MUST be instantiated inside the `callGenerateContent` and `callGenerateContentStream` methods of the *subclass* (SaltFirebaseBackend).
- **Named Parameters:** Always use explicit configuration: `new GoogleGenAI({ apiKey: ... })`.
- **Why?** This prevents the base class from becoming "transport-aware" and allows easy substitution of direct SDK calls with HTTP requests to secure backend proxies.

## 3. Storage & Image Handling
- **Firebase Storage:** All recipe images MUST use Firebase Storage. The `Recipe.imagePath` field stores the storage reference path.
- **Image Resolution:** The `resolveImagePath()` method in SaltFirebaseBackend handles `getDownloadURL()` conversion from storage paths to browser-accessible URLs.
- **Upload Flow:** Images are uploaded as Blobs via `uploadRecipeImage()`, returning storage paths for database persistence.

## 4. Contract Enforcement (Zod)
- Every data operation (read/write) should ideally be wrapped in Zod validation when the source is external (e.g., `importSystemState`).
- Use `.strict()` to ensure no "database rot" (leaking internal DB fields like `_v` or `_createdAt`) enters the application state.
- Parse with `.safeParse()` and handle validation errors gracefully rather than allowing corrupt data through.

## 5. Persistence Mapping (Firebase-Specific)
- **Timestamps:** Firestore native `Timestamp` objects MUST NOT leak into the application. Always convert to ISO 8601 strings using `.toDate().toISOString()` in the Firebase backend wrapper.
- **ID Strategy:** Use Firestore document IDs as the object `id`. Avoid duplicating IDs in both the document path AND body to prevent desynchronization.
- **Offline Persistence:** Firestore offline persistence is enabled by default. Ensure all operations handle potential offline queuing and eventual consistency.

## 6. Firebase Functions Integration
- **AI Proxying:** All Generative AI requests (`generateContent`, `generateContentStream`) MUST be proxied through Firebase Functions to keep API keys secure.
- **Function Endpoints:** The backend calls HTTPS callable functions (`generateRecipe`, `generateRecipeStream`, etc.) rather than directly instantiating the Gemini SDK.
- **Error Handling:** Firebase Functions errors are wrapped and propagated with appropriate context (authentication failures, quota exceeded, etc.).

## 7. Debug Logging System
- **DebugLogger:** Centralized logging via `backend/debug-logger.ts` singleton.
- **Runtime Toggle:** Debug logging can be enabled/disabled via Admin interface without code changes.
- **Usage:** Replace all `console.log/warn/error` with `debugLogger.log/warn/error` to respect user preferences.
- **Production:** Debug logs are disabled by default in production; enable temporarily for troubleshooting.

## 8. Authentication & Authorization
- **Passwordless Auth:** Using Firebase Auth with email link sign-in (no passwords).
- **User Collection:** The `users` Firestore collection maintains user profiles and permissions.
- **Authorization Gate:** `isAuthorized()` method checks for authenticated users with valid profiles.
- **Firestore Rules:** Production rules enforce authentication. Development emulators may relax rules for testing.

## 9. Data Migration & Portability
- **Export:** `exportSystemState()` creates a complete JSON manifest of all data (recipes, equipment, plans, users, settings).
- **Import:** `importSystemState()` accepts the JSON manifest and reconstitutes the entire kitchen state.
- **Portability:** Manifests are environment-agnostic and can move between local emulators and production Firebase projects.

## 10. Error Handling Patterns
- **Retry Logic:** Use `retryFirestoreOperation()` wrapper for transient Firebase errors.
- **Graceful Degradation:** Offline operations queue locally; display status to users.
- **User-Facing Errors:** Convert technical errors (Firestore codes, Function errors) to user-friendly messages in the UI layer.

## 11. Performance Optimization
- **Batch Operations:** Use Firestore batched writes when creating/updating multiple documents.
- **Caching:** Leverage Firestore's built-in caching; avoid redundant queries.
- **Pagination:** Implement cursor-based pagination for large collections (recipes, equipment).
- **Streaming:** Use `generateContentStream` for recipe generation to provide real-time feedback.

## 12. Testing Strategy
- **Local Emulators:** All testing uses Firebase emulators (Auth, Firestore, Storage, Functions).
- **State Persistence:** Emulator data persists in `./emulator-data` directory between sessions.
- **Test Data:** Use emulator UI (localhost:4000) to inspect/modify data during development.
- **Manual Save:** Run `./scripts/save-db.sh` to snapshot emulator state without stopping services.

## DO NOT MODIFY
- Do not alter `BaseSaltBackend` when adding new Firebase features
- Do not instantiate Gemini SDK in the base class
- Do not leak Firestore `Timestamp` or other Firebase-specific types into the contract
- Do not bypass Zod validation for external data sources
- Do not store API keys in client-side code; always use Firebase Functions proxy
