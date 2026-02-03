import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';

/**
 * Replace these with your actual Firebase config from the Firebase Console.
 * Even though the backend is a separate repo, the frontend needs these 
 * keys to identify which project it is talking to.
 */
const firebaseConfig = {
  apiKey: "local-dev-key",
  authDomain: "salt-kitchen.firebaseapp.com",
  projectId: "salt-kitchen",
  storageBucket: "salt-kitchen.appspot.com",
  messagingSenderId: "12345",
  appId: "1:12345:web:6789"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Auto-connect to emulators if you are running the backend repo locally
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  console.log("📡 Frontend attempting to connect to local Firebase Emulators...");
  // Note: These ports must match the config in your separate salt-backend/firebase.json
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, "http://localhost:9099");
}

export { db, auth, googleProvider };