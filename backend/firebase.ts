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

// Define exports
let db;
const auth = getAuth(app);
const storage = getStorage(app);
const functionsRegion = 'europe-west2';
const functions = getFunctions(app, functionsRegion);
const googleProvider = new GoogleAuthProvider();

// Detect environment and configure emulators
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  console.log("📡 Connecting to Firebase Emulators (Localhost)...");
  db = getFirestore(app);
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
} else {
  // Cloud Workstations / IDX logic
  const currentHost = location.hostname;
  const portPrefixMatch = currentHost.match(/^(\d+)-/);
  
  if (portPrefixMatch) {
    const domainSuffix = currentHost.substring(portPrefixMatch[0].length);
    console.log("🛠️ Dev Mode: Detected Cloud Environment. Using Direct Settings Override...");

    // 1. AUTH: PROXY
    // Must use proxy (location.origin) to allow redirects to work correctly without CORS issues.
    connectAuthEmulator(auth, location.origin, { disableWarnings: true });

    // 2. FIRESTORE: DIRECT SETTINGS OVERRIDE
    // We bypass connectFirestoreEmulator() and set the host/ssl directly in initializeFirestore.
    // This forces the SDK to use HTTPS for the direct connection, avoiding Mixed Content errors.
    const firestoreHost = `8080-${domainSuffix}:443`;
    
    try {
      db = initializeFirestore(app, {
        host: firestoreHost,
        ssl: true,
        experimentalForceLongPolling: true 
      });
    } catch (e) {
      // In case of re-initialization error (Hot Module Reload), fallback to getFirestore
      console.warn("Firestore re-init warning:", e);
      db = getFirestore(app);
    }

    // 3. STORAGE: DIRECT
    const storageHost = `9199-${domainSuffix}`;
    connectStorageEmulator(storage, storageHost, 443);

    // 4. FUNCTIONS: DIRECT
    const functionsHost = `5001-${domainSuffix}`;
    connectFunctionsEmulator(functions, functionsHost, 443);

  } else if (currentHost.includes('cloudworkstations.dev') || currentHost.includes('idx.google.com')) {
      // Fallback for cloud envs without port prefix
      console.warn("⚠️ Could not auto-detect emulator ports. Emulators not connected.");
      db = getFirestore(app);
  } else {
      // Production
      db = getFirestore(app);
  }
}

// Safety check for DB
if (!db) {
  db = getFirestore(app);
}

export { db, auth, storage, functions, googleProvider };
