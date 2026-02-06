import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

/**
 * Replace these with your actual Firebase config from the Firebase Console.
 */
const firebaseConfig = {
  apiKey: "AIzaSyC23dfR9R-uij0V8OeMT6ICFVCnrqj4pT8",
  authDomain: "gen-lang-client-0015061880.firebaseapp.com",
  projectId: "gen-lang-client-0015061880",
  storageBucket: "gen-lang-client-0015061880.firebasestorage.app",
  messagingSenderId: "898842475698",
  appId: "1:898842475698:web:021439bdfc6ca946bc5dab"
};

const app = initializeApp(firebaseConfig);

// Define exports (using let for re-assignment in cloud env)
let db;
let functions;
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Default functions init
functions = getFunctions(app, 'europe-west2');

// Detect environment and configure emulators
const currentHost = location.hostname;
const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';

// Extract the port prefix (e.g., '3000-')
const portPrefixMatch = currentHost.match(/^(\d+)-/);

if (isLocalhost) {
  console.log("📡 Mode: Local Development (HTTP)");
  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
} else {
  // Cloud Workstations / IDX logic
  if (portPrefixMatch) {
    const domainSuffix = currentHost.substring(portPrefixMatch[0].length);
    console.log("🛠️ Mode: Cloud Workstation (Unified HTTPS Proxy)");

    // 1. AUTH: PROXY
    connectAuthEmulator(auth, location.origin, { disableWarnings: true });

    // 2. FIRESTORE: PROXY STRATEGY
    // We use the app's own hostname (the Vite Proxy) as the Firestore host.
    // We force SSL=true so the SDK uses HTTPS.
    // Vite proxies the request to localhost:8080 internally.
    // This avoids CORS (Same Origin) and Mixed Content (HTTPS).
    const firestoreHost = location.host; 
    try {
      db = initializeFirestore(app, {
        host: firestoreHost,
        ssl: true,
        experimentalForceLongPolling: true 
      });
    } catch (e) {
      db = getFirestore(app);
    }

    // 3. STORAGE: DIRECT (With Client-Side Fix)
    // We keep this direct/default because the fix is applied in firebase-backend.ts
    // via manual URL construction.
    connectStorageEmulator(storage, `9199-${domainSuffix}`, 443);

    // 4. FUNCTIONS: PROXY VIA CUSTOM DOMAIN + PATH
    const projectId = 'gen-lang-client-0015061880';
    const region = 'europe-west2';
    const functionsUrl = `${location.origin}/${projectId}/${region}`;
    functions = getFunctions(app, functionsUrl);

  } else if (currentHost.includes('cloudworkstations.dev') || currentHost.includes('idx.google.com')) {
      console.warn("⚠️ Could not auto-detect emulator ports. Emulators not connected.");
      db = getFirestore(app);
  } else {
      // Production
      db = getFirestore(app);
  }
}

// Safety check
if (!db) db = getFirestore(app);

export { db, auth, storage, functions, googleProvider };
