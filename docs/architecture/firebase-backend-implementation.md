# SALT - Firebase Backend Implementation

This document describes the current Firebase backend implementation (`backend/firebase-backend.ts`) and the technical details of how Salt integrates with Firebase services.

## Architecture Overview

Salt uses a Firebase-first architecture with the following services:
- **Firebase Auth** — Passwordless email authentication
- **Firestore** — NoSQL database with offline persistence
- **Firebase Storage** — Image storage for recipe photos
- **Firebase Functions** — Serverless backend for AI proxy and secure operations

The `SaltFirebaseBackend` class extends `BaseSaltBackend` to implement the `ISaltBackend` interface with Firebase-specific persistence.

## Core Principles

### 1. Separation of Concerns
- **BaseSaltBackend (The Brain):** All AI orchestration, prompt assembly, and business logic
- **SaltFirebaseBackend (The Hands):** Firebase-specific CRUD operations, authentication, storage

This separation ensures:
- AI logic remains stable during infrastructure changes
- Business logic is testable without database dependencies
- Portability between environments (local emulators ↔ production)

### 2. Contract Enforcement
- All data must conform to Zod schemas in `types/contract.ts`
- No Firebase-specific types (Timestamp, DocumentReference) leak into the contract
- All timestamps stored as ISO 8601 strings for portability

### 3. Offline-First Design
- Firestore persistence enabled by default
- Operations queue locally when offline
- Automatic synchronization when connection restored

## Firebase Services Integration

### Authentication (firebase/auth)

**Implementation:** Passwordless email link authentication

```typescript
// backend/firebase-backend.ts
async sendLoginEmail(email: string): Promise<void> {
  const actionCodeSettings = {
    url: window.location.origin + '/login',
    handleCodeInApp: true
  };
  await sendSignInLinkToEmail(this.auth, email, actionCodeSettings);
  window.localStorage.setItem('emailForSignIn', email);
}

async completeLogin(email: string, emailLink: string): Promise<User> {
  await signInWithEmailLink(this.auth, email, emailLink);
  // Verify user exists in Firestore users collection
  const userDoc = await getDoc(doc(this.db, 'users', email));
  if (!userDoc.exists()) {
    await signOut(this.auth);
    throw new Error('Access denied: User not authorized');
  }
  return userDoc.data() as User;
}
```

**Authorization Strategy:**
- User must exist in `users` Firestore collection
- Email-based access control (family/staff only)
- Automatic sign-out if user not in whitelist

### Firestore Database

**Collections Structure:**
```
├── users/              # User profiles (keyed by email)
├── inventory/          # Equipment (keyed by eq-* IDs)
├── recipes/            # Recipes (keyed by rec-* IDs)
├── plans/              # Meal plans (keyed by plan-* IDs)
│   └── plan-template   # Special: template plan document
└── settings/           # System settings
    └── global          # Kitchen settings document
```

**Document ID Strategy:**
- Use Firestore auto-generated IDs OR predictable prefixes (`eq-`, `rec-`, `plan-`)
- Store ID in document body AND as document path for consistency
- Always use document ID as canonical reference

**Timestamp Conversion:**
```typescript
// ALWAYS convert Firestore Timestamps to ISO 8601 strings
const recipe = {
  ...docData,
  createdAt: docData.createdAt.toDate().toISOString(),
  updatedAt: docData.updatedAt.toDate().toISOString()
};
```

**Offline Persistence:**
```typescript
// backend/firebase.ts
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  localCache: persistentLocalCache()
});
await enableIndexedDbPersistence(db);
```

**Batch Operations:**
```typescript
async importSystemState(state: SystemState): Promise<void> {
  const batch = writeBatch(this.db);
  
  // Add up to 500 operations per batch (Firestore limit)
  for (const recipe of state.recipes) {
    const docRef = doc(this.db, 'recipes', recipe.id);
    batch.set(docRef, recipe);
  }
  
  await batch.commit();
}
```

### Firebase Storage

**Image Upload Flow:**
```typescript
async uploadRecipeImage(imageData: string): Promise<string> {
  // imageData is base64 string: "data:image/jpeg;base64,..."
  const blob = await fetch(imageData).then(r => r.blob());
  const filename = `recipes/${Date.now()}.jpg`;
  const storageRef = ref(this.storage, filename);
  
  await uploadBytes(storageRef, blob);
  return filename; // Store this path in recipe.imagePath
}
```

**Image Resolution:**
```typescript
async resolveImagePath(storagePath: string): Promise<string> {
  const storageRef = ref(this.storage, storagePath);
  return await getDownloadURL(storageRef);
}
```

**Storage Rules:**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /recipes/{imageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.resource.contentType.matches('image/.*')
                   && request.resource.size < 5 * 1024 * 1024; // 5MB limit
    }
  }
}
```

### Firebase Functions

**AI Request Proxying:**

Salt uses Firebase Functions to proxy Gemini AI requests, keeping API keys secure server-side.

```typescript
// functions/src/index.ts
export const generateRecipe = onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const result = await model.generateContent({
    contents: request.data.prompt,
    systemInstruction: request.data.systemInstruction
  });
  
  return { text: result.response.text() };
});
```

**Client-side Usage:**
```typescript
// backend/firebase-backend.ts
protected async callGenerateContent(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const generateRecipe = httpsCallable(this.functions, 'generateRecipe');
  const result = await generateRecipe({ prompt, systemInstruction });
  return result.data.text;
}
```

**Streaming Implementation:**
```typescript
// Functions support streaming via Server-Sent Events (SSE)
export const generateRecipeStream = onRequest(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const stream = await model.generateContentStream(req.body.prompt);
  
  for await (const chunk of stream.stream) {
    res.write(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
  }
  
  res.end();
});
```

## Error Handling & Retry Logic

### Transient Errors
```typescript
private async retryFirestoreOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (this.isRetriableError(error)) {
        await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
        continue;
      }
      throw error; // Non-retriable, fail immediately
    }
  }
}

private isRetriableError(error: any): boolean {
  return error.code === 'unavailable' || 
         error.code === 'deadline-exceeded' ||
         error.code === 'resource-exhausted';
}
```

### User-Facing Errors
```typescript
// Convert Firebase errors to user-friendly messages
try {
  await this.createRecipe(recipe);
} catch (error) {
  if (error.code === 'permission-denied') {
    throw new Error('You do not have permission to create recipes');
  } else if (error.code === 'unavailable') {
    throw new Error('Unable to connect. Please check your internet connection.');
  }
  throw new Error('Failed to create recipe. Please try again.');
}
```

## Debug Logging System

### DebugLogger Integration
```typescript
// backend/debug-logger.ts
class DebugLogger {
  private enabled: boolean = false;
  
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
  
  log(message: string, ...args: any[]) {
    if (this.enabled) console.log(`[DEBUG] ${message}`, ...args);
  }
  
  error(message: string, ...args: any[]) {
    if (this.enabled) console.error(`[ERROR] ${message}`, ...args);
  }
}

export const debugLogger = new DebugLogger();
```

**Usage in Firebase Backend:**
```typescript
async getRecipe(id: string): Promise<Recipe | null> {
  debugLogger.log('Fetching recipe:', id);
  const docSnap = await getDoc(doc(this.db, 'recipes', id));
  
  if (!docSnap.exists()) {
    debugLogger.warn('Recipe not found:', id);
    return null;
  }
  
  debugLogger.log('Recipe loaded successfully:', id);
  return this.mapDocToRecipe(docSnap);
}
```

**Runtime Control:**
```typescript
// In Admin panel, toggle via UI:
await saltBackend.updateKitchenSettings({ debugEnabled: true });
// This calls debugLogger.setEnabled(true) internally
```

## Security Rules

### Firestore Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthorized() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.token.email));
    }
    
    match /users/{userId} {
      allow read, write: if isAuthorized();
    }
    
    match /recipes/{recipeId} {
      allow read, write: if isAuthorized();
    }
    
    match /inventory/{equipmentId} {
      allow read, write: if isAuthorized();
    }
    
    match /plans/{planId} {
      allow read, write: if isAuthorized();
    }
    
    match /settings/{settingId} {
      allow read, write: if isAuthorized();
    }
  }
}
```

### Storage Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthorized() {
      return request.auth != null;
    }
    
    match /recipes/{allPaths=**} {
      allow read: if isAuthorized();
      allow write: if isAuthorized() 
                   && request.resource.contentType.matches('image/.*')
                   && request.resource.size < 5 * 1024 * 1024;
    }
  }
}
```

## Data Portability

### Export System State
```typescript
async exportSystemState(): Promise<SystemState> {
  const [recipes, inventory, plans, users] = await Promise.all([
    this.getRecipes(),
    this.getEquipment(),
    this.getPlans(),
    this.getUsers()
  ]);
  
  return SystemStateSchema.parse({
    recipes,
    inventory,
    plans,
    users,
    kitchenSettings: await this.getKitchenSettings()
  });
}
```

### Import System State
```typescript
async importSystemState(state: SystemState): Promise<void> {
  // Validate entire structure
  const validated = SystemStateSchema.parse(state);
  
  // Use batched writes for efficiency
  const batch = writeBatch(this.db);
  
  // Import in order: settings, users, inventory, recipes, plans
  for (const recipe of validated.recipes) {
    batch.set(doc(this.db, 'recipes', recipe.id), recipe);
  }
  
  await batch.commit();
  debugLogger.log('System state imported successfully');
}
```

## Performance Optimization

### Query Optimization
```typescript
// Use indexes for common queries
async getRecentRecipes(limit: number = 10): Promise<Recipe[]> {
  const q = query(
    collection(this.db, 'recipes'),
    orderBy('updatedAt', 'desc'),
    limit(limit)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => this.mapDocToRecipe(doc));
}
```

### Caching Strategy
- Firestore built-in caching handles most use cases
- No additional caching layer needed
- Use `getDocFromCache()` for explicit cache reads (offline mode)

### Pagination
```typescript
async getRecipesPaginated(
  pageSize: number,
  lastDoc?: DocumentSnapshot
): Promise<{ recipes: Recipe[], lastDoc: DocumentSnapshot | null }> {
  let q = query(
    collection(this.db, 'recipes'),
    orderBy('name'),
    limit(pageSize)
  );
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  
  const snapshot = await getDocs(q);
  const recipes = snapshot.docs.map(doc => this.mapDocToRecipe(doc));
  const last = snapshot.docs[snapshot.docs.length - 1] || null;
  
  return { recipes, lastDoc: last };
}
```

## Testing with Emulators

### Local Development Setup
```bash
# Start Firebase emulators
npm run emulators

# Emulator ports (configured in firebase.json):
# - Auth: 9099
# - Firestore: 8080
# - Storage: 9199
# - Functions: 5001
# - Emulator UI: 4000
```

### Emulator Configuration
```typescript
// backend/firebase.ts
const app = initializeApp(firebaseConfig);
let auth, db, storage, functions;

if (import.meta.env.DEV) {
  // Connect to emulators in development
  auth = getAuth(app);
  connectAuthEmulator(auth, 'http://localhost:9099');
  
  db = initializeFirestore(app, { /* ... */ });
  connectFirestoreEmulator(db, 'localhost', 8080);
  
  storage = getStorage(app);
  connectStorageEmulator(storage, 'localhost', 9199);
  
  functions = getFunctions(app);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### Data Persistence Between Restarts
```bash
# Emulators export data on exit
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data

# Manual save while running
./scripts/save-db.sh
```

## Common Implementation Patterns

### Creating a Document
```typescript
async createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe> {
  const docRef = doc(collection(this.db, 'recipes'));
  const now = new Date().toISOString();
  
  const newRecipe: Recipe = {
    id: docRef.id,
    ...recipe,
    createdAt: now,
    updatedAt: now
  };
  
  // Validate before write
  const validated = RecipeSchema.parse(newRecipe);
  
  await setDoc(docRef, validated);
  return validated;
}
```

### Updating a Document
```typescript
async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
  const docRef = doc(this.db, 'recipes', id);
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await updateDoc(docRef, updatedData);
  
  const updated = await getDoc(docRef);
  return RecipeSchema.parse({ id: updated.id, ...updated.data() });
}
```

### Deleting a Document
```typescript
async deleteRecipe(id: string): Promise<void> {
  // Delete image from storage if exists
  const recipe = await this.getRecipe(id);
  if (recipe?.imagePath) {
    const storageRef = ref(this.storage, recipe.imagePath);
    await deleteObject(storageRef).catch(() => {}); // Ignore if not found
  }
  
  // Delete Firestore document
  await deleteDoc(doc(this.db, 'recipes', id));
}
```

## Migration Notes

This implementation represents the complete Firebase backend. There is no simulated backend or backend switching mechanism. All persistence is handled through Firebase services.

## References

- [Backend Guidelines](./backend-guidelines.md) — Separation principles and architecture
- [Contract Guidelines](./contract-guidelines.md) — Data schema and validation rules
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
