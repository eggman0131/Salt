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

let db;
let functions;
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

let env = 'unknown';

// ---------------------------------------------------------------------------
// LOCALHOST → REAL EMULATORS
// ---------------------------------------------------------------------------

if (isLocalhost) {
  env = 'localhost-emulators';

  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

  connectStorageEmulator(storage, '127.0.0.1', 9199);

  functions = getFunctions(app, 'europe-west2');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

// ---------------------------------------------------------------------------
// CLOUD IDE (Firebase Studio + Workstations) → PROXY EMULATORS
// ---------------------------------------------------------------------------

else if (isCloudIDE) {
  env = 'cloud-ide-proxy-emulators';

  connectAuthEmulator(auth, location.origin, { disableWarnings: true });

  try {
    db = initializeFirestore(app, {
      host: location.host,
      ssl: true,
      experimentalForceLongPolling: true
    }, 'saltstore'); // Use the named database
  } catch (e) {
    db = getFirestore(app, 'saltstore'); // Fallback with named database
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

else if (isProductionHosting) {
  env = 'production-hosting';

  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    }, 'saltstore'); // Use the named database
    debugLogger.log('Firebase Init', 'Firestore initialized for production (saltstore database)');
    
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
    debugLogger.error('Firebase Init', 'Firestore initialization failed:', e);
    db = getFirestore(app, 'saltstore'); // Fallback with named database
  }
  functions = getFunctions(app, 'europe-west2');
}

// ---------------------------------------------------------------------------
// FALLBACK → TREAT AS PRODUCTION
// ---------------------------------------------------------------------------

else {
  env = 'fallback-production';

  db = getFirestore(app, 'saltstore'); // Use the named database
  
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

// Safety fallback
if (!db) db = getFirestore(app, 'saltstore');

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