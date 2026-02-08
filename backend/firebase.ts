import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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
const googleProvider = new GoogleAuthProvider();

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
    });
  } catch (e) {
    db = getFirestore(app);
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

  db = getFirestore(app);
  functions = getFunctions(app, 'europe-west2');
}

// ---------------------------------------------------------------------------
// FALLBACK → TREAT AS PRODUCTION
// ---------------------------------------------------------------------------

else {
  env = 'fallback-production';

  db = getFirestore(app);
  functions = getFunctions(app, 'europe-west2');
}

// Safety fallback
if (!db) db = getFirestore(app);

// ---------------------------------------------------------------------------
// ENVIRONMENT LOGGING
// ---------------------------------------------------------------------------

console.log('%c🔥 Firebase Environment Detected', 'font-weight: bold; color: #ff5722;');
console.log('Hostname:', host);
console.log('Origin:', location.origin);
console.log('Environment:', env);
console.log('Using Emulators:', env.includes('emulators'));
console.log('---------------------------------------------');

export { db, auth, storage, functions, googleProvider };