import { readFile } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const hasFlag = (name) => args.includes(name);

const filePath = arg('--file', 'scripts/salt-test-data.json');
const projectId = arg('--project', process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0015061880');
const databaseId = arg('--database', process.env.FIRESTORE_DATABASE_ID || 'saltstore');
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;

const encodeNestedArrays = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (Array.isArray(item)) {
        return {
          __nestedArray: true,
          values: item.map((child) => encodeNestedArrays(child))
        };
      }
      return encodeNestedArrays(item);
    });
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = encodeNestedArrays(val);
    }
    return out;
  }

  return value;
};

const loadExport = async () => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const initDb = () => {
  const app = initializeApp({ projectId });
  const db = getFirestore(app, databaseId);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
};

const deleteCollection = async (db, collectionName) => {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return 0;

  let batch = db.batch();
  let count = 0;

  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    count += 1;

    if (count % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  return count;
};

const run = async () => {
  const data = await loadExport();
  const db = initDb();

  console.log('Importing test data to Firestore emulator');
  console.log(`Project: ${projectId}`);
  console.log(`Database: ${databaseId}`);
  console.log(`Emulator: ${emulatorHost}`);
  console.log(`File: ${filePath}`);

  if (hasFlag('--clear')) {
    const collectionsToClear = [
      'inventory',
      'recipes',
      'users',
      'plans',
      'canonical_items',
      'shopping_lists',
      'shopping_list_items',
      'units',
      'aisles',
      'categories'
    ];

    for (const collectionName of collectionsToClear) {
      const deleted = await deleteCollection(db, collectionName);
      console.log(`Cleared ${collectionName}: ${deleted} documents`);
    }

    await db.collection('settings').doc('global').delete();
    console.log('Cleared settings/global');
  }

  let batch = db.batch();
  let count = 0;

  const commitIfNeeded = async () => {
    if (count >= 450) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  };

  const queueDocs = async (items, collectionName, getId, transform) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const id = getId(item);
      if (!id) continue;
      const docRef = db.collection(collectionName).doc(id);
      batch.set(docRef, transform ? transform(item) : item);
      count += 1;
      await commitIfNeeded();
    }
    console.log(`Queued ${collectionName}: ${items.length} documents`);
  };

  await queueDocs(data.inventory, 'inventory', (item) => item.id);
  await queueDocs(data.recipes, 'recipes', (item) => item.id, encodeNestedArrays);
  await queueDocs(data.users, 'users', (item) => item.email || item.id, (user) => ({
    email: user.email || user.id,
    displayName: user.displayName || user.email || user.id
  }));
  await queueDocs(data.plans, 'plans', (item) => item.id);
  await queueDocs(data.canonicalItems, 'canonical_items', (item) => item.id);
  await queueDocs(data.shoppingLists, 'shopping_lists', (item) => item.id);
  await queueDocs(data.shoppingListItems, 'shopping_list_items', (item) => item.id);
  await queueDocs(data.units, 'units', (item) => item.id);
  await queueDocs(data.aisles, 'aisles', (item) => item.id);
  await queueDocs(data.categories, 'categories', (item) => item.id);

  if (data.settings) {
    const docRef = db.collection('settings').doc('global');
    batch.set(docRef, data.settings);
    count += 1;
    await commitIfNeeded();
    console.log('Queued settings/global');
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log('Import complete.');
};

run().catch((error) => {
  console.error('Import failed:', error);
  process.exitCode = 1;
});
