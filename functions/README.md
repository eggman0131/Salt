# Firebase Functions Setup for SALT

This directory contains Cloud Functions that serve as secure proxies for the Gemini API.

## Architecture

```
Frontend (React App)
    ↓ httpsCallable()
    ↓
Cloud Functions (Node.js + Firebase Admin)
    ↓ process.env.GEMINI_API_KEY (server-side)
    ↓
Gemini API
    ↓
Cloud Functions
    ↓ GenerateContentResponse
    ↓
Frontend
```

**Key Benefit:** The API key is never exposed to the browser. All Gemini API calls are authenticated and authorized on the server.

## Functions

### `cloudGenerateContent`
Proxies a single generateContent request to Gemini API.

**Request:**
```typescript
{
  idToken: string;        // Firebase Auth token from current user
  params: GenerateContentParameters;  // Gemini request parameters
}
```

**Response:**
```typescript
GenerateContentResponse  // Gemini API response
```

### `cloudGenerateContentStream`
Proxies a streaming generateContent request to Gemini API.

**Note:** The emulator aggregates the stream into a single response since streaming over HTTP is rate-limited.

**Request:**
```typescript
{
  idToken: string;
  params: GenerateContentParameters;
}
```

**Response:**
```typescript
GenerateContentResponse  // Aggregated from stream
```

### `health`
Simple health check endpoint for monitoring.

```
GET /health
Response: { status: 'ok', timestamp: '...', service: 'salt-functions' }
```

## Local Development (Emulator)

### Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Java Development Kit (JDK) installed for the emulator
3. API key in `functions/.env.local`

### Running the Functions Emulator

```bash
# From the project root
npm run emulators

# Or just functions:
cd functions
npm run serve
```

The emulator will:
- Start Functions on `localhost:5001`
- Start Firestore on `localhost:8080`
- Start Auth on `localhost:9099`
- Start Storage on `localhost:9199`
- Open UI Dashboard on `localhost:4000`

### Testing in Browser

1. Start the dev server: `npm run dev`
2. Set `VITE_BACKEND_MODE=firebase` in `.env`
3. Login with Google Auth (emulator auto-approves)
4. Trigger an AI action (search equipment, generate recipe, etc.)

Watch the Functions logs in the emulator UI or terminal:
```
[generateContent] User authenticated: user@example.com
[generateContent] Success for user@example.com
```

## Deployment (Production)

### Step 1: Update `.env` for Production
Replace `VITE_GEMINI_API_KEY` with an empty string or remove the key.

### Step 2: Set Cloud Functions Environment Variables
```bash
firebase functions:config:set gemini.api_key="YOUR_API_KEY"
```

### Step 3: Deploy
```bash
npm run deploy
# or
firebase deploy --only functions
```

### Step 4: Update Frontend
Change `connectFunctionsEmulator` detection in `backend/firebase.ts` to only apply in development:
```typescript
if (isDevelopment && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

## Security Considerations

1. **API Key Management:** Keys are stored in Cloud Functions environment variables, not in code.
2. **Authentication Gate:** Every function call validates the Firebase Auth token.
3. **Authorization Gate:** Every function checks that the user exists in the Firestore `users` collection.
4. **Firestore Rules:** Additional rules can enforce which actions each user can perform.
5. **Rate Limiting:** Can be added to prevent abuse (e.g., using Firestore counters).

## Troubleshooting

### "Permission denied" errors
- Ensure user exists in the `users` collection
- Check that the auth token is valid and not expired

### "API key not configured" error
- Verify `.env.local` file exists with `GEMINI_API_KEY` set
- Check that the key is valid

### Functions not being called
- Verify `connectFunctionsEmulator` is called in `backend/firebase.ts`
- Check emulator is running on port 5001
- Inspect browser console and emulator logs

### Build errors
```bash
cd functions
npm run build
```

## Development Workflow

1. **Make changes to `functions/src/index.ts`**
2. **Rebuild:** `npm run build` (in functions directory)
3. **Restart emulator** (it auto-reloads on file changes)
4. **Test in browser**

## References

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Callable Functions](https://firebase.google.com/docs/functions/callable)
- [Gemini API SDK](https://github.com/google/generative-ai-js)
