
# SALT - Backend Guidelines

The Salt backend is built on a strict inheritance hierarchy designed to keep "Intelligence" (Prompting/Logic) separate from "Execution" (Persistence/Transport).

## 1. The Split-Brain Architecture
- **BaseSaltBackend (The Brain):** Houses ALL AI orchestration, JSON sanitization, and prompt assembly. It is abstract and must never be modified during persistence migrations.
- **Hands Implementation (Simulated or Firebase):** Responsible ONLY for CRUD operations, Authentication, and the final delivery of AI requests to the Gemini SDK.

## 2. Technical Dispensation: Gemini SDK Location
To ensure production readiness and allow for future Proxy/Serverless migration:
- **SDK Instantiation:** The `GoogleGenAI` client MUST be instantiated inside the `callGenerateContent` and `callGenerateContentStream` methods of the *subclass*.
- **Named Parameters:** Always use `new GoogleGenAI({ apiKey: process.env.API_KEY })`.
- **Why?** This prevents the base class from becoming "transport-aware" and allows the subclass to easily swap the client-side SDK for a `fetch()` call to a secure server if needed.

## 3. Storage & Image Handling
- **Simulated Mode:** Uses `localStorage` with a 600px JPEG compression bridge (defined in `SaltSimulatedBackend`) to prevent quota issues.
- **Firebase Mode:** Must use **Firebase Storage** for images. `Recipe.imagePath` should store the storage reference path, and `resolveImagePath` should use `getDownloadURL`.

## 4. Contract Enforcement (Zod)
- Every data operation (read/write) should ideally be wrapped in Zod validation if the source is external (e.g. `importSystemState`).
- Use `.strict()` to ensure no "database rot" (leaking internal DB fields like `_v` or `_createdAt`) enters the app state.

## 5. Persistence Mapping
- **Timestamps:** Firestore native `Timestamp` objects MUST NOT leak into the app. Convert them to ISO 8601 strings in the `FirebaseBackend` wrapper.
- **ID Strategy:** Use document IDs as the object `id`. Avoid storing the ID twice (inside the document body AND as the doc ID) if possible, but prioritize consistency with the `ISaltBackend` return types.
