# SALT Backend Parity Test Suite

The parity test suite ensures that `SaltSimulatedBackend` and `SaltFirebaseBackend` maintain behavioral consistency across all contract-defined operations.

## Overview

The suite tests:
- **Auth Gate & Users** — Both backends handle unauthenticated users consistently
- **Inventory CRUD** — Create, read, update, delete operations match
- **Recipe Generation** — AI-driven recipe synthesis (skipped if no API key)
- **Planner CRUD** — Plan operations and template plan handling match
- **Import/Export** — Both backends export the same structure

## Running the Parity Check

### Prerequisites

1. **Dev server running**
   ```bash
   npm run dev
   ```

2. **Emulators running** (for Firebase backend tests)
   ```bash
   npm run emulators
   ```

3. **API key configured** (optional, for AI tests)
   - Set `VITE_GEMINI_API_KEY` in `.env` (for simulated backend)
   - Set `GEMINI_API_KEY` in `functions/.env.local` (for functions emulator)
   - If not set, AI tests are skipped

### Run the Suite

```bash
npm run parity
```

### Output Example

```
🧪 Starting SALT Parity Check
📍 Target: http://localhost:3000/?parity=1
⏱️  Timeout: 30000ms

🌐 Loading dev server...
⏳ Running parity suite...

╔═══════════════════════════════════════════════════════════╗
║         SALT BACKEND PARITY TEST REPORT                  ║
╚═══════════════════════════════════════════════════════════╝

📊 SUMMARY
   Total:  5
   ✅ Passed: 5
   ❌ Failed: 0
   ⏭️  Skipped: 0

📋 DETAILED RESULTS

✅ Auth Gate & Users Check
   ✓ Simulated: null
   ✓ Firebase: null

✅ Inventory CRUD
   ✓ Simulated: {"created":true,"read":true,"updated":true,"deleted":true}
   ✓ Firebase: {"created":true,"read":true,"updated":true,"deleted":true}

⏭️  Recipe Generation Flow
   ✓ Simulated: SKIPPED (no API key)
   ✓ Firebase: SKIPPED (no API key)

✅ Planner CRUD + Template
   ✓ Simulated: {"created":true,"retrieved":true,"deleted":true}
   ✓ Firebase: {"created":true,"retrieved":true,"deleted":true}

✅ Import/Export Parity
   ✓ Simulated: {"recipes":0,"inventory":0,"users":0,"plans":0}
   ✓ Firebase: {"recipes":0,"inventory":0,"users":0,"plans":0}

✅ All tests passed
```

## Exit Codes

- **0** — All parity tests passed
- **1** — One or more tests failed, or suite timed out

## Troubleshooting

### "Could not connect to dev server"
- Ensure `npm run dev` is running on `http://localhost:3000`
- Check that port 3000 is not blocked

### "Emulator connection failed"
- Ensure `npm run emulators` is running
- Check that Firebase emulator ports match `firebase.json`:
  - Auth: 9099
  - Firestore: 8080
  - Storage: 9199
  - Functions: 5001

### "Recipe tests are skipped"
- Set `VITE_GEMINI_API_KEY` in `.env` to enable AI tests in the simulated backend
- Set `GEMINI_API_KEY` in `functions/.env.local` to enable in Firebase Functions emulator

### "Auth tests fail in Firebase backend"
- Ensure a user exists in the `users` Firestore collection
- The authorization gate requires at least one document in the users collection
- Manually create a test user via the Firestore emulator UI (localhost:4000) if needed

## Architecture

```
App.tsx
  ↓ (detects ?parity=1 query param)
  ↓
scripts/parity-suite.ts (TypeScript module)
  ├─ Instantiates SaltSimulatedBackend
  ├─ Instantiates SaltFirebaseBackend
  ├─ Runs 5 test suites in parallel
  └─ Compiles structured report
  ↓
window.__SALT_PARITY__ (global result object)
  ↓
scripts/parity-check.mjs (Playwright CLI)
  ├─ Launches browser
  ├─ Loads http://localhost:3000/?parity=1
  ├─ Waits for parity suite completion
  └─ Prints formatted report

Process exit code = 0 (pass) or 1 (fail)
```

## Development Workflow

When adding a new AI-driven feature:

1. **Prototype in simulated backend** (direct SDK, no auth gating)
2. **Add parity test** — Update `scripts/parity-suite.ts` with the test case
3. **Run parity check** — `npm run parity` to ensure both backends match
4. **Port to Firebase** — Add Cloud Function proxy if needed
5. **Verify parity** — `npm run parity` again

## Customization

### Adding a New Test

Edit `scripts/parity-suite.ts` and add a new `async testXxx()` method following the pattern:

```typescript
private async testMyFeature(): Promise<void> {
  const result: TestResult = {
    name: 'My Feature Test',
    simulated: { pass: false },
    firebase: { pass: false },
    parity: false
  };

  try {
    // Test simulated
    result.simulated.pass = await this.simulated.myFeature() === true;

    // Test Firebase
    result.firebase.pass = await this.firebase.myFeature() === true;

    // Compare
    result.parity = result.simulated.pass === result.firebase.pass;
    result.details = '...';
  } catch (e) {
    result.details = String(e);
  }

  this.results.push(result);
}
```

Then add it to `runAll()`:

```typescript
async runAll(): Promise<ParitySuiteReport> {
  // ... existing tests
  await this.testMyFeature(); // ← Add this
  return this.compileReport();
}
```

### Changing Report Format

Edit the `formatReport()` function in `scripts/parity-check.mjs` to customize the output.

## References

- [Parity Suite Module](./parity-suite.ts)
- [Parity Check CLI](./parity-check.mjs)
- [Backend API Switcher](../backend/api.ts)
- [Simulated Backend](../backend/simulated.ts)
- [Firebase Backend](../backend/firebase-backend.ts)
