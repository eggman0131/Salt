import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { debugLogger } from './debug-logger';

const firebaseConfig = {
  apiKey: "AIzaSyC23dfR9R-uij0V8OeMT6ICFVCnrqj4pT8",
  authDomain: "gen-lang-client-0015061880.firebaseapp.com",
  projectId: "gen-lang-client-0015061880",
  storageBucket: "gen-lang-client-0015061880.firebasestorage.app",
  messagingSenderId: "898842475698",
  appId: "1:898842475698:web:021439bdfc6ca946bc5dab"
};

const app = initializeApp(firebaseConfig);

// Database ID from environment or default to 'saltstore'
const FIRESTORE_DATABASE_ID = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'saltstore';

// Check if debug mode is enabled (via localStorage or env)
const isDebugEnabled = localStorage.getItem('salt_debug_enabled') === 'true' || import.meta.env.DEV;
const log = (context: string, message: string) => {
  if (isDebugEnabled) {
    console.log(`%c[${context}]%c ${message}`, 'color: #ff5722; font-weight: bold;', 'color: inherit;');
  }
};
const logAlways = (context: string, message: string) => {
  console.log(`%c[${context}]%c ${message}`, 'color: #ff5722; font-weight: bold;', 'color: inherit;');
};

// Always log database ID configuration regardless of debug setting
logAlways('Firebase Init', `🔥 Database ID Config: env=${import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(not set)'}, final=${FIRESTORE_DATABASE_ID}`);

let db: any;
let functions: any;
const auth = getAuth(app);
const storage = getStorage(app);

// ---------------------------------------------------------------------------
// ENVIRONMENT DETECTION
// ---------------------------------------------------------------------------

const host = location.hostname;

const isLocalhost =
  host === 'localhost' ||
  host === '127.0.0.1';

const isCloudIDE =
  host.endsWith('.cloudworkstations.dev');

const isProductionHosting =
  host.endsWith('.web.app') ||
  host.endsWith('.firebaseapp.com');

const isCustomDomain =
  !isLocalhost &&
  !isCloudIDE &&
  !host.startsWith('localhost') &&
  location.protocol === 'https:';

let env = 'unknown';

// ---------------------------------------------------------------------------
// LOCALHOST → REAL EMULATORS
// ---------------------------------------------------------------------------

if (isLocalhost) {
  env = 'localhost-emulators';
  log('Firebase Init', `Initializing for localhost with database: ${FIRESTORE_DATABASE_ID}`);

  // Use the named Firestore database locally so it matches the Functions emulator
  // which is configured to use the 'saltstore' database. Initialize with explicit
  // host/ssl settings so the SDK connects to the local emulator and uses the
  // named database, ensuring frontend and functions read/write the same data.
  try {
    db = initializeFirestore(app, {
      host: 'localhost:8080',
      ssl: false,
      experimentalForceLongPolling: true
    }, FIRESTORE_DATABASE_ID);
    log('Firebase Init', `✓ Initialized Firestore (${FIRESTORE_DATABASE_ID}) for local emulators`);
  } catch (e) {
    console.warn(`[Firebase Init] initializeFirestore failed for localhost (${FIRESTORE_DATABASE_ID}), falling back:`, e);
    // Fallback to getFirestore if initializeFirestore is not available
    db = getFirestore(app, FIRESTORE_DATABASE_ID);
  }
  
  // Ensure db is defined before connecting emulator
  if (!db) {
    console.warn(`[Firebase Init] Database not initialized after fallback for localhost, creating with ${FIRESTORE_DATABASE_ID}`);
    db = getFirestore(app, FIRESTORE_DATABASE_ID);
  }
  
  log('Firebase Init', 'Connecting to Emulator Suite (Firestore: localhost:8080)');
  connectFirestoreEmulator(db, 'localhost', 8080);

  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

  connectStorageEmulator(storage, 'localhost', 9199);

  functions = getFunctions(app, 'europe-west2');
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// ---------------------------------------------------------------------------
// CLOUD IDE (Firebase Studio + Workstations) → PROXY EMULATORS
// ---------------------------------------------------------------------------

else if (isCloudIDE) {
  env = 'cloud-ide-proxy-emulators';
  log('Firebase Init', `Initializing for Cloud IDE with database: ${FIRESTORE_DATABASE_ID}`);

  connectAuthEmulator(auth, location.origin, { disableWarnings: true });

  try {
    db = initializeFirestore(app, {
      host: location.host,
      ssl: true,
      experimentalForceLongPolling: true
    }, FIRESTORE_DATABASE_ID); // Use the named database
    log('Firebase Init', `✓ Initialized Firestore (${FIRESTORE_DATABASE_ID}) for Cloud IDE`);
  } catch (e) {
    console.warn(`[Firebase Init] initializeFirestore failed for Cloud IDE (${FIRESTORE_DATABASE_ID}), falling back:`, e);
    db = getFirestore(app, FIRESTORE_DATABASE_ID); // Fallback with named database
  }

  const domainSuffix = host.split('.').slice(1).join('.');
  connectStorageEmulator(storage, `9199-${domainSuffix}`, 443);

  const projectId = 'gen-lang-client-0015061880';
  const region = 'europe-west2';
  const functionsUrl = `${location.origin}/${projectId}/${region}`;
  functions = getFunctions(app, functionsUrl);
}

// ---------------------------------------------------------------------------
// PRODUCTION HOSTING → NEVER EMULATORS
// ---------------------------------------------------------------------------

else if (isProductionHosting || isCustomDomain) {
  env = isCustomDomain ? 'custom-domain-production' : 'production-hosting';
  log('Firebase Init', `Initializing for ${env} with database: ${FIRESTORE_DATABASE_ID}`);

  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    }, FIRESTORE_DATABASE_ID); // Use the named database
    log('Firebase Init', `✓ Firestore initialized for ${env} (${FIRESTORE_DATABASE_ID} database)`);
    
    // Enable offline persistence
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        debugLogger.warn('Firebase Init', 'Offline persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        debugLogger.warn('Firebase Init', 'Offline persistence not available in this browser');
      }
    });
    debugLogger.log('Firebase Init', 'Offline persistence enabled');
  } catch (e) {
    console.error(`[Firebase Init] Firestore initialization failed for ${env} (${FIRESTORE_DATABASE_ID}):`, e);
    db = getFirestore(app, FIRESTORE_DATABASE_ID); // Fallback with named database
  }
  functions = getFunctions(app, 'europe-west2');
}

// ---------------------------------------------------------------------------
// FALLBACK → TREAT AS PRODUCTION
// ---------------------------------------------------------------------------

else {
  env = 'fallback-production';
  log('Firebase Init', `Initializing fallback production with database: ${FIRESTORE_DATABASE_ID}`);

  db = getFirestore(app, FIRESTORE_DATABASE_ID); // Use the named database
  log('Firebase Init', `✓ Firestore fallback initialized (${FIRESTORE_DATABASE_ID})`);
  
  // Enable offline persistence
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      debugLogger.warn('Firebase Init', 'Offline persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      debugLogger.warn('Firebase Init', 'Offline persistence not available in this browser');
    }
  });
  
  functions = getFunctions(app, 'europe-west2');
}

// Safety fallback - ensure db is always defined
if (!db) {
  console.error(`[Firebase Init] Database was not initialized in ${env} path, creating fallback with ${FIRESTORE_DATABASE_ID}`);
  db = getFirestore(app, FIRESTORE_DATABASE_ID);
}

// Verify db is a valid Firestore instance
if (db && typeof db === 'object') {
  logAlways('Firebase Init', `✅ Database initialization complete. Environment: ${env}, Database: ${FIRESTORE_DATABASE_ID}`);
} else {
  console.error(`[Firebase Init] ❌ Database initialization failed! db is: ${typeof db}, env: ${env}, database: ${FIRESTORE_DATABASE_ID}`);
  // Force re-initialization
  db = getFirestore(app, FIRESTORE_DATABASE_ID);
}

// ---------------------------------------------------------------------------
// ENVIRONMENT LOGGING
// ---------------------------------------------------------------------------

debugLogger.log('Firebase Init', '%c🔥 Firebase Environment Detected', 'font-weight: bold; color: #ff5722;');
debugLogger.log('Firebase Init', 'Hostname:', host);
debugLogger.log('Firebase Init', 'Origin:', location.origin);
debugLogger.log('Firebase Init', 'Environment:', env);
debugLogger.log('Firebase Init', 'Using Emulators:', env.includes('emulators'));
debugLogger.log('Firebase Init', '---------------------------------------------');

export { db, auth, storage, functions };
