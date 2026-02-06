import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

/**
 * Replace these with your actual Firebase config from the Firebase Console.
 * Even though the backend is a separate repo, the frontend needs these 
 * keys to identify which project it is talking to.
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
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functionsRegion = 'europe-west2';
const functions = getFunctions(app, functionsRegion);
const googleProvider = new GoogleAuthProvider();

// Auto-connect to emulators in local development
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  console.log("📡 Connecting to Firebase Emulators...");
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export { db, auth, storage, functions, googleProvider };