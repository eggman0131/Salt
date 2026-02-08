#!/usr/bin/env node
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, connectFirestoreEmulator } from 'firebase/firestore';

const app = initializeApp({
  projectId: "gen-lang-client-0015061880",
});

const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

const recipeId = process.argv[2] || 'rec-w28rpowki';

try {
  const docRef = doc(db, 'recipes', recipeId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log(JSON.stringify({ id: docSnap.id, ...data }, null, 2));
  } else {
    console.error('Document not found');
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

process.exit(0);
