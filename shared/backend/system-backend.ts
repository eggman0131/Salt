import { User, KitchenSettings } from '../../types/contract';
import { auth, db } from './firebase';
import { debugLogger } from './debug-logger';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

let currentUser: User | null = null;
let currentIdToken: string | null = null;

const authReadyPromise = new Promise<void>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, () => {
    unsubscribe();
    resolve();
  });
});

const retryFirestoreOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  delayMs = 500
): Promise<T> => {
  for (let i = 0; i < maxRetries; i += 1) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore operation timeout')), 5000)
      );
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error: any) {
      const isOfflineError =
        error?.code === 'unavailable' ||
        error?.message?.includes('offline') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('Failed to get document');

      debugLogger.error('Firestore', `Attempt ${i + 1}/${maxRetries} failed:`, error?.code, error?.message);

      if (isOfflineError && i < maxRetries - 1) {
        debugLogger.log('Firestore', `Retrying after ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Firestore operation failed after retries');
};

const encodeNestedArrays = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (Array.isArray(item)) {
        return {
          __nestedArray: true,
          values: item.map((child) => encodeNestedArrays(child)),
        };
      }
      return encodeNestedArrays(item);
    });
  }

  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = encodeNestedArrays(val);
    }
    return out;
  }

  return value;
};

const encodeRecipeForFirestore = (recipe: any): any => encodeNestedArrays(recipe);

const clearCollection = async (collectionName: string): Promise<void> => {
  const snapshot = await getDocs(collection(db, collectionName));
  if (snapshot.empty) return;

  let batch = writeBatch(db);
  let count = 0;

  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    count += 1;

    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
};

export const systemBackend = {
  async login(email: string): Promise<void> {
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      localStorage.setItem('salt_email_link', email);
    } catch (error) {
      debugLogger.error('Firebase Auth', 'Email link error:', error);
      throw new Error('Failed to send sign-in link.');
    }
  },

  async handleRedirectResult(): Promise<User | null> {
    try {
      const href = window.location.href;
      debugLogger.log('handleRedirectResult', 'Checking URL:', href);
      debugLogger.log('handleRedirectResult', 'URL length:', href.length);
      debugLogger.log('handleRedirectResult', 'Has apiKey param:', href.includes('apiKey='));
      debugLogger.log('handleRedirectResult', 'Has oobCode param:', href.includes('oobCode='));

      if (!isSignInWithEmailLink(auth, href)) {
        debugLogger.log('handleRedirectResult', 'Not a sign-in link');
        return null;
      }

      debugLogger.log('handleRedirectResult', 'Valid sign-in link detected');
      let userEmail = localStorage.getItem('salt_email_link') || '';
      debugLogger.log('handleRedirectResult', 'Stored email from localStorage:', userEmail);

      if (!userEmail) {
        userEmail = window.prompt('Confirm your email to finish signing in') || '';
        debugLogger.log('handleRedirectResult', 'Email from prompt:', userEmail);
      }

      if (!userEmail) {
        throw new Error('Missing email for sign-in completion.');
      }

      debugLogger.log('handleRedirectResult', 'Attempting sign-in for:', userEmail);
      debugLogger.log('handleRedirectResult', 'About to call signInWithEmailLink...');

      const result = await signInWithEmailLink(auth, userEmail, href);

      debugLogger.log('handleRedirectResult', 'Sign-in successful');
      localStorage.removeItem('salt_email_link');

      const userEmailFromAuth = result.user.email;

      if (!userEmailFromAuth) {
        await signOut(auth);
        throw new Error('Kitchen Access Denied.');
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      debugLogger.log('handleRedirectResult', 'Checking Firestore for user:', userEmailFromAuth);
      debugLogger.log('handleRedirectResult', 'Auth UID:', result.user.uid);
      debugLogger.log('handleRedirectResult', 'Auth token exists:', !!(await result.user.getIdToken()));

      const userDocRef = doc(db, 'users', userEmailFromAuth);
      debugLogger.log('handleRedirectResult', 'Document path:', `users/${userEmailFromAuth}`);

      const userDoc = await retryFirestoreOperation(() => getDoc(userDocRef));

      debugLogger.log('handleRedirectResult', 'Document exists:', userDoc.exists());
      if (userDoc.exists()) {
        debugLogger.log('handleRedirectResult', 'Document data:', userDoc.data());
      } else {
        debugLogger.log('handleRedirectResult', 'Document not found. Listing all users...');
        try {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          debugLogger.log('handleRedirectResult', 'Total users in collection:', usersSnapshot.size);
          usersSnapshot.forEach((docSnap) => {
            debugLogger.log('handleRedirectResult', 'Found user ID:', docSnap.id);
          });
        } catch (listError) {
          debugLogger.error('handleRedirectResult', 'Failed to list users:', listError);
        }
      }

      if (!userDoc.exists()) {
        debugLogger.error('handleRedirectResult', 'User document not found in Firestore');
        await signOut(auth);
        throw new Error('Kitchen Access Denied.');
      }

      debugLogger.log('handleRedirectResult', 'User document found:', userDoc.data());
      const userData = userDoc.data();
      currentUser = {
        id: userEmailFromAuth,
        email: userEmailFromAuth,
        displayName: userData.displayName || result.user.displayName || userEmailFromAuth,
      };

      currentIdToken = await result.user.getIdToken();
      debugLogger.log(
        'handleRedirectResult',
        'Token stored:',
        currentIdToken ? `${currentIdToken.substring(0, 20)}...` : 'FAILED'
      );

      return currentUser;
    } catch (error: any) {
      if (error.message === 'Kitchen Access Denied.') {
        throw error;
      }
      debugLogger.error('handleRedirectResult', 'Auth Redirect Error:', error);
      throw new Error('Authentication failed.');
    }
  },

  async logout(): Promise<void> {
    await signOut(auth);
    currentUser = null;
    currentIdToken = null;
  },

  async getCurrentUser(): Promise<User | null> {
    await authReadyPromise;

    if (currentUser) {
      return currentUser;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      return null;
    }

    try {
      const userDoc = await retryFirestoreOperation(
        () => getDoc(doc(db, 'users', firebaseUser.email!))
      );

      if (userDoc.exists()) {
        const userData = userDoc.data();
        currentUser = {
          id: firebaseUser.email,
          email: firebaseUser.email,
          displayName: userData.displayName || firebaseUser.displayName || firebaseUser.email,
        };
        return currentUser;
      }
    } catch (error) {
      debugLogger.error('getCurrentUser', 'Error fetching current user:', error);
    }

    return null;
  },

  async getUsers(): Promise<User[]> {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: User[] = [];

    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        email: docSnap.id,
        displayName: data.displayName || docSnap.id,
      });
    });

    return users;
  },

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const userDoc = {
      email: userData.email,
      displayName: userData.displayName,
    };

    await setDoc(doc(db, 'users', userData.email), userDoc);

    return {
      id: userData.email,
      email: userData.email,
      displayName: userData.displayName,
    };
  },

  async deleteUser(id: string): Promise<void> {
    await deleteDoc(doc(db, 'users', id));
  },

  async getKitchenSettings(): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as KitchenSettings;
      return {
        directives: data.directives || '',
        debugEnabled: data.debugEnabled || false,
        userOrder: data.userOrder,
      };
    }
    return { directives: '', debugEnabled: false };
  },

  async updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, settings, { merge: true });
    return settings;
  },

  async importSystemState(json: string): Promise<void> {
    const data = JSON.parse(json);

    await clearCollection('inventory');
    await clearCollection('recipes');
    await clearCollection('users');
    await clearCollection('plans');
    await clearCollection('canonical_items');
    await clearCollection('shopping_lists');
    await clearCollection('shopping_list_items');
    await clearCollection('units');
    await clearCollection('aisles');
    await clearCollection('categories');
    await deleteDoc(doc(db, 'settings', 'global'));

    let batch = writeBatch(db);
    let count = 0;

    const commitIfNeeded = async () => {
      if (count >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    };

    if (data.inventory) {
      for (const item of data.inventory) {
        const docRef = doc(db, 'inventory', item.id);
        batch.set(docRef, item);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.recipes) {
      for (const recipe of data.recipes) {
        const docRef = doc(db, 'recipes', recipe.id);
        batch.set(docRef, encodeRecipeForFirestore(recipe));
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.users) {
      for (const user of data.users) {
        const userEmail = user.email || user.id;
        const docRef = doc(db, 'users', userEmail);
        batch.set(docRef, {
          email: userEmail,
          displayName: user.displayName || userEmail,
        });
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.plans) {
      for (const plan of data.plans) {
        const docRef = doc(db, 'plans', plan.id);
        batch.set(docRef, plan);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.settings) {
      const docRef = doc(db, 'settings', 'global');
      batch.set(docRef, data.settings);
      count += 1;
      await commitIfNeeded();
    }

    if (data.canonicalItems) {
      for (const item of data.canonicalItems) {
        const docRef = doc(db, 'canonical_items', item.id);
        batch.set(docRef, item);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.shoppingLists) {
      for (const list of data.shoppingLists) {
        const docRef = doc(db, 'shopping_lists', list.id);
        batch.set(docRef, list);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.shoppingListItems) {
      for (const item of data.shoppingListItems) {
        const docRef = doc(db, 'shopping_list_items', item.id);
        batch.set(docRef, item);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.units) {
      for (const unit of data.units) {
        const docRef = doc(db, 'units', unit.id);
        batch.set(docRef, unit);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.aisles) {
      for (const aisle of data.aisles) {
        const docRef = doc(db, 'aisles', aisle.id);
        batch.set(docRef, aisle);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (data.categories) {
      for (const category of data.categories) {
        const docRef = doc(db, 'categories', category.id);
        batch.set(docRef, category);
        count += 1;
        await commitIfNeeded();
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  },
};

export const getActiveBackendMode = (): string => 'firebase';
