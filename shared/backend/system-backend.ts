import { User, KitchenSettings } from '../../types/contract';
import { auth, db, storage } from './firebase';
import { debugLogger } from './debug-logger';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
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
          avatarUrl: userData.avatarUrl,
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
        avatarUrl: data.avatarUrl,
      });
    });

    return users;
  },

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const userDoc = {
      email: userData.email,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl,
    };

    await setDoc(doc(db, 'users', userData.email), userDoc);

    return {
      id: userData.email,
      email: userData.email,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl,
    };
  },

  async deleteUser(id: string): Promise<void> {
    await deleteDoc(doc(db, 'users', id));
  },

  async updateUser(id: string, userData: Partial<Omit<User, 'id' | 'email'>>): Promise<void> {
    const userDoc = doc(db, 'users', id);
    await setDoc(userDoc, userData, { merge: true });
  },

  async uploadUserAvatar(userId: string, imageData: string): Promise<string> {
    const path = `users/${userId}/avatar.jpg`;
    
    // Log auth context for debugging
    debugLogger.log('uploadUserAvatar', 'Current auth user:', auth.currentUser?.email);
    debugLogger.log('uploadUserAvatar', 'Uploading to path:', path);
    
    // Use the same pattern as recipe images for Dev mode proxy uploads
    if (import.meta.env.DEV) {
      try {
        const bucket = storage.app.options.storageBucket || 'gen-lang-client-0015061880.firebasestorage.app';
        const encodedPath = encodeURIComponent(path);
        
        // Construct upload URL via Proxy (/v0)
        const uploadUrl = `/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;
        
        // Convert Base64 to Blob
        const res = await fetch(imageData);
        const blob = await res.blob();
        
        // Get a fresh token to ensure the request is authorized
        const token = await auth.currentUser?.getIdToken();
        debugLogger.log('uploadUserAvatar', 'Token obtained:', !!token);

        const headers: HeadersInit = {
          'Content-Type': 'image/jpeg'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: blob,
          headers: headers
        });
        
        if (!response.ok) {
          debugLogger.error('Firebase Storage', 'Manual avatar upload failed:', response.statusText);
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        // Get download URL
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
      } catch (e) {
        debugLogger.error('Firebase Storage', "Manual avatar upload failed, falling back to SDK", e);
        // Fallthrough to SDK
      }
    }
    
    // Production or fallback: Use Firebase SDK
    const res = await fetch(imageData);
    const blob = await res.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(storageRef);
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


};

export const getActiveBackendMode = (): string => 'firebase';
