import { User, Recipe, Equipment, Plan, KitchenSettings, RecipeCategory, CanonicalItem, RecipeIngredient, ShoppingList, ShoppingListItem, Unit, Aisle } from '../types/contract';
import { BaseSaltBackend } from './base-backend';
import { db, auth, storage, functions } from './firebase';
import { debugLogger } from './debug-logger';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc, orderBy, writeBatch, Timestamp, runTransaction } from 'firebase/firestore';
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

const TEMPLATE_ID = 'plan-template';

export class SaltFirebaseBackend extends BaseSaltBackend {
  private currentUser: User | null = null;
  private currentIdToken: string | null = null;
  private authReadyPromise: Promise<void>;

  constructor() {
    super();
    // Wait for Firebase auth to restore session from persistence
    this.authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
      });
    });
  }

  // Helper to retry Firestore operations with timeout
  private async retryFirestoreOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 2,
    delayMs = 500
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Add a timeout to each attempt
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Firestore operation timeout')), 5000)
        );
        
        return await Promise.race([operation(), timeoutPromise]);
      } catch (error: any) {
        const isOfflineError = error?.code === 'unavailable' || 
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
  }

  // -- HELPER METHODS --
  
  private convertTimestamps(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const converted: any = Array.isArray(data) ? [] : {};
    
    for (const key in data) {
      const value = data[key];
      
      if (value && typeof value === 'object' && 'toDate' in value) {
        converted[key] = value.toDate().toISOString();
      }
      else if (value && typeof value === 'object') {
        converted[key] = this.convertTimestamps(value);
      }
      else {
        converted[key] = value;
      }
    }
    
    return converted;
  }

  private encodeNestedArrays(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (Array.isArray(item)) {
          return {
            __nestedArray: true,
            values: item.map((child) => this.encodeNestedArrays(child))
          };
        }
        return this.encodeNestedArrays(item);
      });
    }

    if (value && typeof value === 'object') {
      const out: any = {};
      for (const [key, val] of Object.entries(value)) {
        out[key] = this.encodeNestedArrays(val);
      }
      return out;
    }

    return value;
  }

  private decodeNestedArrays(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.decodeNestedArrays(item));
    }

    if (value && typeof value === 'object') {
      if (value.__nestedArray === true && Array.isArray(value.values)) {
        return value.values.map((item: any) => this.decodeNestedArrays(item));
      }

      const out: any = {};
      for (const [key, val] of Object.entries(value)) {
        out[key] = this.decodeNestedArrays(val);
      }
      return out;
    }

    return value;
  }

  private encodeRecipeForFirestore(recipe: any): any {
    return this.encodeNestedArrays(recipe);
  }

  private decodeRecipeFromFirestore(recipe: any): any {
    return this.decodeNestedArrays(recipe);
  }

  /**
   * Remove undefined values from objects/arrays for Firestore compatibility.
   * Firestore doesn't accept undefined - it must be null or omitted.
   */
  private cleanUndefinedValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  private async uploadRecipeImage(path: string, imageData: string): Promise<void> {
    
    // DEFINITIVE FIX: Use built-in Vite env check (same as resolveImagePath)
    // In Dev (Local/Cloud), use the Proxy to upload securely.
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
                debugLogger.error('Firebase Storage', 'Manual upload failed:', response.statusText);
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            return; // Success! Skip SDK.
        } catch (e) {
            debugLogger.error('Firebase Storage', "Manual upload failed, falling back to SDK", e);
            // Fallthrough to SDK
        }
    }

    const storageRef = ref(storage, path);
    const format = imageData.startsWith('data:') ? 'data_url' : 'base64';
    await uploadString(storageRef, imageData, format as 'data_url' | 'base64');
  }

  private async clearCollection(collectionName: string): Promise<void> {
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
  }

  // -- AI TRANSPORT (PROXIED VIA CLOUD FUNCTIONS) --

  protected async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    debugLogger.log('callGenerateContent', 'Starting - auth.currentUser:', user?.email, 'storedToken:', idToken ? 'yes' : 'no');
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }
    
    if (user) {
      try {
        debugLogger.log('callGenerateContent', 'Attempting to get fresh token...');
        idToken = await user.getIdToken(true);
        debugLogger.log('callGenerateContent', 'Got fresh token:', idToken ? 'yes' : 'no');
        this.currentIdToken = idToken;
      } catch (e) {
        debugLogger.log('callGenerateContent', 'getIdToken failed, using fallback:', e);
        if (!idToken) throw e;
      }
    }
    
    debugLogger.log('callGenerateContent', 'Final idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
    
    debugLogger.log('callGenerateContent', 'Calling Cloud Function with idToken...');
    try {
      const result = await cloudGenerateContent({
        idToken,
        params
      });
      debugLogger.log('callGenerateContent', 'Success');
      return result.data as GenerateContentResponse;
    } catch (error) {
      debugLogger.error('callGenerateContent', 'Cloud Function error:', error);
      throw error;
    }
  }

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    debugLogger.log('callGenerateContentStream', 'Starting - auth.currentUser:', user?.email, 'storedToken:', idToken ? 'yes' : 'no');
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }
    
    if (user) {
      try {
        debugLogger.log('callGenerateContentStream', 'Attempting to get fresh token...');
        idToken = await user.getIdToken(true);
        debugLogger.log('callGenerateContentStream', 'Got fresh token:', idToken ? 'yes' : 'no');
        this.currentIdToken = idToken;
      } catch (e) {
        debugLogger.log('callGenerateContentStream', 'getIdToken failed, using fallback:', e);
        if (!idToken) throw e; 
      }
    }
    
    debugLogger.log('callGenerateContentStream', 'Final idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContentStream = httpsCallable(functions, 'cloudGenerateContentStream');
    
    debugLogger.log('callGenerateContentStream', 'Calling Cloud Function with idToken...');
    try {
      const result = await cloudGenerateContentStream({
        idToken,
        params
      });
      
      const response = result.data as GenerateContentResponse;
      debugLogger.log('callGenerateContentStream', 'Success');
      return (async function* () {
        yield response;
      })();
    } catch (error) {
      debugLogger.error('callGenerateContentStream', 'Cloud Function error:', error);
      throw error;
    }
  }

  protected async fetchUrlContent(url: string): Promise<string> {
    // Ensure auth is ready before proceeding
    await this.authReadyPromise;
    
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    debugLogger.log('fetchUrlContent', 'Starting - URL:', url, 'user:', user?.email);
    
    if (!user) {
      throw new Error('User not authenticated. Cannot access recipe URLs.');
    }
    
    try {
      idToken = await user.getIdToken(true);
      this.currentIdToken = idToken;
      debugLogger.log('fetchUrlContent', 'Got token:', idToken ? 'yes' : 'no');
    } catch (e) {
      debugLogger.error('fetchUrlContent', 'getIdToken failed:', e);
      throw new Error('Failed to obtain authentication token.');
    }
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudFetchRecipeUrl = httpsCallable(functions, 'cloudFetchRecipeUrl');
    
    debugLogger.log('fetchUrlContent', 'Calling Cloud Function with token...');
    debugLogger.log('fetchUrlContent', 'Current hostname:', location.hostname);
    debugLogger.log('fetchUrlContent', 'Current origin:', location.origin);
    
    try {
      const result = await cloudFetchRecipeUrl({ idToken, url });
      debugLogger.log('fetchUrlContent', 'Success');
      return result.data as string;
    } catch (error: any) {
      debugLogger.error('fetchUrlContent', 'Cloud Function error:', error);
      debugLogger.error('fetchUrlContent', 'Error code:', error.code);
      debugLogger.error('fetchUrlContent', 'Error message:', error.message);
      
      // Check if this is a CORS or network error, and try HTTP endpoint instead
      if (error.code === 'internal' || error.message?.includes('CORS') || error.message?.includes('preflight') || error.message?.includes('Failed to construct')) {
        debugLogger.log('fetchUrlContent', 'Callable function failed, trying HTTP fallback endpoint...');
        try {
          return await this.fetchUrlContentViaHttp(url, idToken);
        } catch (fallbackError) {
          debugLogger.error('fetchUrlContent', 'HTTP fallback also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }

  private async fetchUrlContentViaHttp(url: string, idToken: string): Promise<string> {
    const projectId = 'gen-lang-client-0015061880';
    const region = 'europe-west2';
    const httpEndpointUrl = `https://${region}-${projectId}.cloudfunctions.net/cloudFetchRecipeUrlHttp`;
    
    debugLogger.log('fetchUrlContentViaHttp', 'Calling HTTP endpoint:', httpEndpointUrl);
    
    try {
      const response = await fetch(httpEndpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken, url })
      });

      if (!response.ok) {
        debugLogger.error('fetchUrlContentViaHttp', 'HTTP response failed:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        debugLogger.log('fetchUrlContentViaHttp', 'Success');
        return result.data as string;
      } else {
        debugLogger.error('fetchUrlContentViaHttp', 'API error:', result.error);
        throw new Error(result.error || 'Unknown error from HTTP endpoint');
      }
    } catch (error) {
      debugLogger.error('fetchUrlContentViaHttp', 'Request failed:', error);
      throw error;
    }
  }
  
  // -- AUTHENTICATION --
  
  async login(email: string): Promise<void> {
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      localStorage.setItem('salt_email_link', email);
    } catch (error) {
      debugLogger.error('Firebase Auth', "Email link error:", error);
      throw new Error("Failed to send sign-in link.");
    }
  }

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
        throw new Error("Kitchen Access Denied.");
      }

      // Wait briefly for auth state to propagate to Firestore
      await new Promise(resolve => setTimeout(resolve, 500));

      debugLogger.log('handleRedirectResult', 'Checking Firestore for user:', userEmailFromAuth);
      debugLogger.log('handleRedirectResult', 'Auth UID:', result.user.uid);
      debugLogger.log('handleRedirectResult', 'Auth token exists:', !!(await result.user.getIdToken()));
      
      const userDocRef = doc(db, 'users', userEmailFromAuth);
      debugLogger.log('handleRedirectResult', 'Document path:', `users/${userEmailFromAuth}`);
      
      const userDoc = await this.retryFirestoreOperation(
        () => getDoc(userDocRef)
      );
      
      debugLogger.log('handleRedirectResult', 'Document exists:', userDoc.exists());
      if (userDoc.exists()) {
        debugLogger.log('handleRedirectResult', 'Document data:', userDoc.data());
      } else {
        // Debug: List all documents in users collection
        debugLogger.log('handleRedirectResult', 'Document not found. Listing all users...');
        try {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          debugLogger.log('handleRedirectResult', 'Total users in collection:', usersSnapshot.size);
          usersSnapshot.forEach((doc) => {
            debugLogger.log('handleRedirectResult', 'Found user ID:', doc.id);
          });
        } catch (listError) {
          debugLogger.error('handleRedirectResult', 'Failed to list users:', listError);
        }
      }
      
      if (!userDoc.exists()) {
        debugLogger.error('handleRedirectResult', 'User document not found in Firestore');
        await signOut(auth);
        throw new Error("Kitchen Access Denied.");
      }
      
      debugLogger.log('handleRedirectResult', 'User document found:', userDoc.data());
      const userData = userDoc.data();
      this.currentUser = {
        id: userEmailFromAuth,
        email: userEmailFromAuth,
        displayName: userData.displayName || result.user.displayName || userEmailFromAuth
      };
      
      this.currentIdToken = await result.user.getIdToken();
      debugLogger.log('handleRedirectResult', 'Token stored:', this.currentIdToken ? `${this.currentIdToken.substring(0, 20)}...` : 'FAILED');
      
      return this.currentUser;
    } catch (error: any) {
      if (error.message === "Kitchen Access Denied.") {
        throw error;
      }
      debugLogger.error('handleRedirectResult', "Auth Redirect Error:", error);
      throw new Error("Authentication failed.");
    }
  }
  
  async logout(): Promise<void> {
    await signOut(auth);
    this.currentUser = null;
    this.currentIdToken = null;
  }
  
  async getCurrentUser(): Promise<User | null> {
    // Wait for Firebase auth to be ready before checking
    await this.authReadyPromise;

    if (this.currentUser) {
      return this.currentUser;
    }
    
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      return null;
    }
    
    try {
      const userDoc = await this.retryFirestoreOperation(
        () => getDoc(doc(db, 'users', firebaseUser.email!))
      );
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        this.currentUser = {
          id: firebaseUser.email,
          email: firebaseUser.email,
          displayName: userData.displayName || firebaseUser.displayName || firebaseUser.email
        };
        return this.currentUser;
      }
    } catch (error) {
      debugLogger.error('getCurrentUser', "Error fetching current user:", error);
    }
    
    return null;
  }
  
  async getUsers(): Promise<User[]> {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        email: doc.id,
        displayName: data.displayName || doc.id
      });
    });
    
    return users;
  }
  
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const userDoc = {
      email: userData.email,
      displayName: userData.displayName
    };
    
    await setDoc(doc(db, 'users', userData.email), userDoc);
    
    return {
      id: userData.email,
      email: userData.email,
      displayName: userData.displayName
    };
  }
  
  async deleteUser(id: string): Promise<void> {
    await deleteDoc(doc(db, 'users', id));
  }

  // -- RECIPES --
  async getRecipes(): Promise<Recipe[]> {
    const snapshot = await getDocs(collection(db, 'recipes'));
    const recipes: Recipe[] = [];
    
    snapshot.forEach((doc) => {
      const rawData = this.decodeRecipeFromFirestore(this.convertTimestamps(doc.data()));
      const data = this.normalizeRecipeData({ ...rawData, id: doc.id }) as Recipe;
      recipes.push(data);
    });
    
    return recipes;
  }
  
  async getRecipe(id: string): Promise<Recipe | null> {
    const docRef = doc(db, 'recipes', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const rawData = this.decodeRecipeFromFirestore(this.convertTimestamps(docSnap.data()));
    return this.normalizeRecipeData({ ...rawData, id: docSnap.id }) as Recipe;
  }
  
  async resolveImagePath(path: string): Promise<string> {
    if (!path) return '';

    // DEFINITIVE FIX: Explicit Environment Check
    // We check for the Cloud Workstations domain pattern explicitly.
    if (import.meta.env.DEV) {
       const bucket = storage.app.options.storageBucket || 'gen-lang-client-0015061880.firebasestorage.app';
       const encodedPath = encodeURIComponent(path);
       // Return relative URL that goes through the Vite Proxy to port 9199
       return `/v0/b/${bucket}/o/${encodedPath}?alt=media`;
    }

    try {
      return await getDownloadURL(ref(storage, path));
    } catch (error) {
      debugLogger.warn('Firebase Storage', 'Unable to resolve image path:', error);
      return '';
    }
  }
  
  async createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>, imageData?: string): Promise<Recipe> {
    const id = `rec-${Math.random().toString(36).substr(2, 9)}`;
    
    let imagePath: string | undefined = undefined;

    if (imageData) {
      imagePath = `recipes/${id}/image.jpg`;
      await this.uploadRecipeImage(imagePath, imageData);
    }

    // Sanitize and validate before storage
    const normalized = this.normalizeRecipeData(recipe);

    const newRecipe = {
      ...normalized,
      id,
      imagePath,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser?.id || 'unknown'
    };
    
    await setDoc(doc(db, 'recipes', id), this.encodeRecipeForFirestore(newRecipe));
    
    // Post-processing: Auto-categorise and process ingredients
    const categoryIds = await this.categorizeRecipe(newRecipe as Recipe);
    const postProcessUpdates: any = {};
    
    if (categoryIds.length > 0) {
      postProcessUpdates.categoryIds = categoryIds;
    }
    
    // Process ingredients to link to canonical items
    if (Array.isArray(newRecipe.ingredients) && newRecipe.ingredients.length > 0) {
      const processedIngredients = await this.processRecipeIngredients(newRecipe.ingredients as any, id);
      postProcessUpdates.ingredients = processedIngredients;
    }
    
    // Apply all post-processing updates in one write
    if (Object.keys(postProcessUpdates).length > 0) {
      const cleanedUpdates = this.cleanUndefinedValues(postProcessUpdates);
      await updateDoc(doc(db, 'recipes', id), cleanedUpdates);
      return { ...newRecipe, ...postProcessUpdates } as Recipe;
    }
    
    return newRecipe as Recipe;
  }
  
  async updateRecipe(id: string, updates: Partial<Recipe>, imageData?: string): Promise<Recipe> {
    const existing = await this.getRecipe(id);
    if (!existing) {
      throw new Error("Recipe not found");
    }
    
    let imagePath = updates.imagePath ?? existing.imagePath;
    if (imageData) {
      imagePath = `recipes/${id}/image-${Date.now()}.jpg`;
      debugLogger.info('Recipe Update', `Uploading new image to: ${imagePath}`);
      await this.uploadRecipeImage(imagePath, imageData);
    }
    
    // Sanitize and validate before storage
    const normalizedUpdates = this.normalizeRecipeData({ ...existing, ...updates });
    
    const updated = { ...existing, ...normalizedUpdates, imagePath };
    await setDoc(doc(db, 'recipes', id), this.encodeRecipeForFirestore(updated));
    
    // Post-processing: Auto-categorise and process ingredients
    const postProcessUpdates: any = {};
    
    // Auto-categorise if categoryIds weren't explicitly provided
    if (!updates.hasOwnProperty('categoryIds')) {
      const categoryIds = await this.categorizeRecipe(updated as Recipe);
      if (categoryIds.length > 0) {
        postProcessUpdates.categoryIds = categoryIds;
      }
    }
    
    // Process ingredients if they were updated
    if (updates.hasOwnProperty('ingredients') && Array.isArray(updated.ingredients) && updated.ingredients.length > 0) {
      const processedIngredients = await this.processRecipeIngredients(updated.ingredients as any, id);
      postProcessUpdates.ingredients = processedIngredients;
    }
    
    // Apply all post-processing updates in one write
    if (Object.keys(postProcessUpdates).length > 0) {
      const cleanedUpdates = this.cleanUndefinedValues(postProcessUpdates);
      await updateDoc(doc(db, 'recipes', id), cleanedUpdates);
      return { ...updated, ...postProcessUpdates } as Recipe;
    }
    
    return updated as Recipe;
  }
  
  async deleteRecipe(id: string): Promise<void> {
    await deleteDoc(doc(db, 'recipes', id));
  }

  // -- RECIPE CATEGORIZATION --
  async getCategories(): Promise<RecipeCategory[]> {
    const snapshot = await getDocs(collection(db, 'categories'));
    const categories: RecipeCategory[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      categories.push({
        ...data,
        id: doc.id
      } as RecipeCategory);
    });
    
    return categories;
  }

  async getCategory(id: string): Promise<RecipeCategory | null> {
    const docRef = doc(db, 'categories', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id
    } as RecipeCategory;
  }

  async createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory> {
    const now = new Date().toISOString();
    const newCat: any = {
      ...category,
      createdAt: now
    };

    // Remove undefined values - Firebase doesn't allow them
    Object.keys(newCat).forEach(key => {
      if (newCat[key] === undefined) {
        delete newCat[key];
      }
    });

    const docRef = doc(collection(db, 'categories'));
    await setDoc(docRef, newCat);

    return {
      ...newCat,
      id: docRef.id
    } as RecipeCategory;
  }

  async updateCategory(id: string, updates: Partial<RecipeCategory>): Promise<RecipeCategory> {
    const docRef = doc(db, 'categories', id);
    
    // Remove undefined values - Firebase doesn't allow them
    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Category ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as RecipeCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete the category
    batch.delete(doc(db, 'categories', id));
    
    // Remove this categoryId from all recipes using it
    const recipesSnap = await getDocs(query(
      collection(db, 'recipes'),
      where('categoryIds', 'array-contains', id)
    ));
    
    recipesSnap.forEach(recipeDoc => {
      const categoryIds = recipeDoc.data().categoryIds || [];
      batch.update(recipeDoc.ref, {
        categoryIds: categoryIds.filter((catId: string) => catId !== id)
      });
    });
    
    await batch.commit();
  }

  // -- CATEGORY APPROVAL (Recipe Admin Review) --

  async approveCategory(id: string): Promise<void> {
    await updateDoc(doc(db, 'categories', id), { isApproved: true });
  }

  async getPendingCategories(): Promise<RecipeCategory[]> {
    const snapshot = await getDocs(query(
      collection(db, 'categories'),
      where('isApproved', '==', false)
    ));
    
    const categories: RecipeCategory[] = [];
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      categories.push({
        ...data,
        id: doc.id
      } as RecipeCategory);
    });
    
    return categories;
  }

  // -- CANONICAL ITEMS (Universal Shopping Catalog) --

  async getCanonicalItems(): Promise<CanonicalItem[]> {
    const snapshot = await getDocs(collection(db, 'canonical_items'));
    const items: CanonicalItem[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      items.push({
        ...data,
        id: doc.id
      } as CanonicalItem);
    });
    
    return items;
  }

  async getCanonicalItem(id: string): Promise<CanonicalItem | null> {
    const docRef = doc(db, 'canonical_items', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id
    } as CanonicalItem;
  }

  async createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem> {
    const now = new Date().toISOString();
    const newItem: any = {
      ...item,
      createdAt: now,
      isStaple: item.isStaple ?? false,
      synonyms: item.synonyms || []
    };

    // Remove undefined values
    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    // Generate ID with 'item-' prefix
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'canonical_items', id);
    await setDoc(docRef, newItem);

    return {
      ...newItem,
      id
    } as CanonicalItem;
  }

  async updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem> {
    const docRef = doc(db, 'canonical_items', id);
    
    // Remove undefined values
    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Canonical item ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as CanonicalItem;
  }

  async deleteCanonicalItem(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'canonical_items', id));

    const recipesSnap = await getDocs(collection(db, 'recipes'));
    recipesSnap.forEach((recipeDoc) => {
      const rawData = this.decodeRecipeFromFirestore(this.convertTimestamps(recipeDoc.data()));
      const recipe = this.normalizeRecipeData({ ...rawData, id: recipeDoc.id }) as Recipe;
      if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) return;

      let changed = false;
      const updatedIngredients = recipe.ingredients.map(ing => {
        if (ing.canonicalItemId === id) {
          changed = true;
          return { ...ing, canonicalItemId: undefined };
        }
        return ing;
      });

      if (changed) {
        const cleanedIngredients = this.cleanUndefinedValues(updatedIngredients);
        const encodedIngredients = this.encodeRecipeForFirestore({ ingredients: cleanedIngredients }).ingredients;
        batch.update(recipeDoc.ref, { ingredients: encodedIngredients });
      }
    });

    await batch.commit();
  }

  // -- SHOPPING LISTS --

  async getShoppingLists(): Promise<ShoppingList[]> {
    const snapshot = await getDocs(collection(db, 'shopping_lists'));
    const lists: ShoppingList[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      lists.push({
        ...data,
        id: doc.id
      } as ShoppingList);
    });
    
    return lists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getShoppingList(id: string): Promise<ShoppingList | null> {
    const docRef = doc(db, 'shopping_lists', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id
    } as ShoppingList;
  }

  async getDefaultShoppingList(): Promise<ShoppingList> {
    // Find list marked as default
    const snapshot = await getDocs(query(
      collection(db, 'shopping_lists'),
      where('isDefault', '==', true)
    ));
    
    if (!snapshot.empty) {
      const data = this.convertTimestamps(snapshot.docs[0].data());
      return {
        ...data,
        id: snapshot.docs[0].id
      } as ShoppingList;
    }
    
    // No default list exists, create one
    const defaultList = await this.createShoppingList({
      name: 'Shopping List',
      isDefault: true,
    });
    
    return defaultList;
  }

  async setDefaultShoppingList(id: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Remove default flag from all lists
    const allLists = await getDocs(collection(db, 'shopping_lists'));
    allLists.forEach(docSnap => {
      if (docSnap.data().isDefault) {
        batch.update(docSnap.ref, { isDefault: false });
      }
    });
    
    // Set new default
    batch.update(doc(db, 'shopping_lists', id), { isDefault: true });
    
    await batch.commit();
  }

  async createShoppingList(list: Omit<ShoppingList, 'id' | 'createdAt' | 'createdBy'>): Promise<ShoppingList> {
    const currentUser = await this.getCurrentUser();
    const now = new Date().toISOString();
    
    const newList: any = {
      ...list,
      createdAt: now,
      createdBy: currentUser?.email || 'unknown'
    };

    // Remove undefined values
    Object.keys(newList).forEach(key => {
      if (newList[key] === undefined) {
        delete newList[key];
      }
    });

    const id = `sl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'shopping_lists', id);
    await setDoc(docRef, newList);

    return {
      ...newList,
      id
    } as ShoppingList;
  }

  async updateShoppingList(id: string, updates: Partial<ShoppingList>): Promise<ShoppingList> {
    const docRef = doc(db, 'shopping_lists', id);
    
    // Remove undefined values
    const cleanUpdates: any = { 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Shopping list ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as ShoppingList;
  }

  async deleteShoppingList(id: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete the list
    batch.delete(doc(db, 'shopping_lists', id));
    
    // Delete all items in this list
    const itemsSnap = await getDocs(query(
      collection(db, 'shopping_list_items'),
      where('shoppingListId', '==', id)
    ));
    
    itemsSnap.forEach(itemDoc => {
      batch.delete(itemDoc.ref);
    });
    
    await batch.commit();
  }

  // -- SHOPPING LIST ITEMS --

  async getShoppingListItems(shoppingListId: string): Promise<ShoppingListItem[]> {
    const snapshot = await getDocs(query(
      collection(db, 'shopping_list_items'),
      where('shoppingListId', '==', shoppingListId)
    ));
    
    const items: ShoppingListItem[] = [];
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      items.push({
        ...data,
        id: doc.id
      } as ShoppingListItem);
    });
    
    return items;
  }

  async createShoppingListItem(item: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem> {
    const newItem: any = { ...item };

    // Remove undefined values
    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    const id = `sli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'shopping_list_items', id);
    await setDoc(docRef, newItem);

    return {
      ...newItem,
      id
    } as ShoppingListItem;
  }

  async updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): Promise<ShoppingListItem> {
    const docRef = doc(db, 'shopping_list_items', id);
    
    // Remove undefined values
    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Shopping list item ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as ShoppingListItem;
  }

  async deleteShoppingListItem(id: string): Promise<void> {
    const docRef = doc(db, 'shopping_list_items', id);
    await deleteDoc(docRef);
  }

  // -- INTEGRATION METHODS --

  /**
   * Add all ingredients from a recipe to a shopping list
   */
  async addRecipeToShoppingList(recipeId: string, shoppingListId: string): Promise<void> {
    // Get the recipe
    const recipe = await this.getRecipe(recipeId);
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      return; // No ingredients to add
    }

    // For each ingredient, find or create canonical item and add to list
    const batch = writeBatch(db);
    
    for (const ingredient of recipe.ingredients) {
      // Try to find existing canonical item
      let canonicalItem: CanonicalItem | undefined;
      
      if (ingredient.canonicalItemId) {
        // Use existing link
        canonicalItem = await this.getCanonicalItem(ingredient.canonicalItemId);
      } else {
        // Try to find by name
        const normalizedName = ingredient.ingredientName.toLowerCase().trim();
        const existingItems = await this.getCanonicalItems();
        canonicalItem = existingItems.find(item => item.normalisedName === normalizedName);
        
        // Create new canonical item if not found
        if (!canonicalItem) {
          canonicalItem = await this.createCanonicalItem({
            name: ingredient.ingredientName,
            normalisedName: normalizedName,
            preferredUnit: ingredient.unit || 'items',
            aisle: '', // No aisle initially
            isStaple: false,
            synonyms: []
          });
        }
      }

      // Create shopping list item
      const itemId = `sli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      
      const newItem: any = {
        shoppingListId,
        canonicalItemId: canonicalItem.id,
        // Snapshot of canonical item data at creation time
        name: canonicalItem.name,
        aisle: canonicalItem.aisle || '',
        isStaple: canonicalItem.isStaple || false,
        // From recipe ingredient
        quantity: ingredient.quantity || 1,
        unit: ingredient.unit || canonicalItem.preferredUnit,
        checked: false,
        note: ingredient.preparation || undefined
      };

      // Remove undefined values
      Object.keys(newItem).forEach(key => {
        if (newItem[key] === undefined) {
          delete newItem[key];
        }
      });

      const itemRef = doc(db, 'shopping_list_items', itemId);
      batch.set(itemRef, newItem);
    }

    // Commit all items
    await batch.commit();
  }

  /**
   * Add a single manual item to a shopping list
   */
  async addManualItemToShoppingList(
    shoppingListId: string,
    name: string,
    quantity: number,
    unit: string,
    aisle?: string
  ): Promise<ShoppingListItem> {
    // Normalize name
    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();
    const unitInput = unit.trim();
    const aisleInput = aisle?.trim() || '';
    
    // Find or create canonical item
    const existingItems = await this.getCanonicalItems();
    let canonicalItem = existingItems.find(item => item.normalisedName === normalizedName);
    const unitToUse = unitInput || canonicalItem?.preferredUnit || 'items';
    const aisleToUse = canonicalItem ? (canonicalItem.aisle || '') : aisleInput;

    const units = await this.getUnits();
    const unitExists = units.some(existingUnit => existingUnit.name.toLowerCase() === unitToUse.toLowerCase());
    if (!unitExists) {
      await this.createUnit({
        name: unitToUse,
        sortOrder: units.length
      });
    }

    if (!canonicalItem && aisleToUse) {
      const aisles = await this.getAisles();
      const aisleExists = aisles.some(existingAisle => existingAisle.name.toLowerCase() === aisleToUse.toLowerCase());
      if (!aisleExists) {
        await this.createAisle({
          name: aisleToUse,
          sortOrder: aisles.length
        });
      }
    }
    
    if (!canonicalItem) {
      // Create new canonical item
      canonicalItem = await this.createCanonicalItem({
        name: trimmedName,
        normalisedName: normalizedName,
        preferredUnit: unitToUse,
        aisle: aisleToUse,
        isStaple: false,
        synonyms: []
      });
    }

    // Create shopping list item
    const itemId = `sli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const newItem: any = {
      shoppingListId,
      canonicalItemId: canonicalItem.id,
      // Snapshot of canonical item data at creation time
      name: canonicalItem.name,
      aisle: canonicalItem.aisle || '',
      isStaple: canonicalItem.isStaple || false,
      // From manual entry
      quantity,
      unit: unitToUse,
      checked: false,
      note: undefined
    };

    // Remove undefined values
    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    const itemRef = doc(db, 'shopping_list_items', itemId);
    await setDoc(itemRef, newItem);

    // Return the created item
    const created = this.convertTimestamps(newItem);
    return {
      ...created,
      id: itemId
    } as ShoppingListItem;
  }

  // -- UNITS & AISLES MANAGEMENT --

  async getUnits(): Promise<Unit[]> {
    const snapshot = await getDocs(query(
      collection(db, 'units'),
      orderBy('sortOrder', 'asc')
    ));
    const units: Unit[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      units.push({
        ...data,
        id: doc.id
      } as Unit);
    });
    
    return units;
  }

  async createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit> {
    const now = new Date().toISOString();
    const newUnit: any = {
      ...unit,
      createdAt: now,
      sortOrder: unit.sortOrder ?? 999
    };

    // Remove undefined values
    Object.keys(newUnit).forEach(key => {
      if (newUnit[key] === undefined) {
        delete newUnit[key];
      }
    });

    const id = `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'units', id);
    await setDoc(docRef, newUnit);

    return {
      ...newUnit,
      id
    } as Unit;
  }

  async updateUnit(id: string, updates: Partial<Unit>): Promise<Unit> {
    const docRef = doc(db, 'units', id);
    
    // Remove undefined values
    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Unit ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as Unit;
  }

  async deleteUnit(id: string): Promise<void> {
    await deleteDoc(doc(db, 'units', id));
  }

  async getAisles(): Promise<Aisle[]> {
    const snapshot = await getDocs(query(
      collection(db, 'aisles'),
      orderBy('sortOrder', 'asc')
    ));
    const aisles: Aisle[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      aisles.push({
        ...data,
        id: doc.id
      } as Aisle);
    });
    
    return aisles;
  }

  async createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle> {
    const now = new Date().toISOString();
    const newAisle: any = {
      ...aisle,
      createdAt: now,
      sortOrder: aisle.sortOrder ?? 999
    };

    // Remove undefined values
    Object.keys(newAisle).forEach(key => {
      if (newAisle[key] === undefined) {
        delete newAisle[key];
      }
    });

    const id = `aisle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'aisles', id);
    await setDoc(docRef, newAisle);

    return {
      ...newAisle,
      id
    } as Aisle;
  }

  async updateAisle(id: string, updates: Partial<Aisle>): Promise<Aisle> {
    const docRef = doc(db, 'aisles', id);
    
    // Remove undefined values
    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Aisle ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as Aisle;
  }

  async deleteAisle(id: string): Promise<void> {
    await deleteDoc(doc(db, 'aisles', id));
  }

  // -- INVENTORY (KITCHEN KIT) --
  async getInventory(): Promise<Equipment[]> {
    const snapshot = await getDocs(collection(db, 'inventory'));
    const equipment: Equipment[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      equipment.push({
        ...data,
        id: doc.id
      } as Equipment);
    });
    
    return equipment;
  }
  
  async getEquipment(id: string): Promise<Equipment | null> {
    const docRef = doc(db, 'inventory', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id
    } as Equipment;
  }
  
  async createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>): Promise<Equipment> {
    const id = `eq-${Math.random().toString(36).substr(2, 9)}`;
    
    const newEquipment = {
      ...equipment,
      id,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser?.id || 'unknown'
    };
    
    await setDoc(doc(db, 'inventory', id), newEquipment);
    
    return newEquipment as Equipment;
  }
  
  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment> {
    const existing = await this.getEquipment(id);
    if (!existing) {
      throw new Error("Equipment not found");
    }
    
    const updated = { ...existing, ...updates };
    await setDoc(doc(db, 'inventory', id), updated);
    
    return updated as Equipment;
  }
  
  async deleteEquipment(id: string): Promise<void> {
    await deleteDoc(doc(db, 'inventory', id));
  }

  // -- SYSTEM --
  async getKitchenSettings(): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as KitchenSettings;
      return {
        directives: data.directives || '',
        debugEnabled: data.debugEnabled || false,
        userOrder: data.userOrder
      };
    }
    return { directives: '', debugEnabled: false };
  }
  async updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, settings, { merge: true });
    return settings;
  }
  async importSystemState(json: string): Promise<void> {
    const data = JSON.parse(json);

    // Clear existing collections first
    await this.clearCollection('inventory');
    await this.clearCollection('recipes');
    await this.clearCollection('users');
    await this.clearCollection('plans');
    await this.clearCollection('canonical_items');
    await this.clearCollection('shopping_lists');
    await this.clearCollection('shopping_list_items');
    await this.clearCollection('units');
    await this.clearCollection('aisles');
    await this.clearCollection('categories');
    await deleteDoc(doc(db, 'settings', 'global'));

    // Batch write imports in chunks
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
        batch.set(docRef, this.encodeRecipeForFirestore(recipe));
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
          displayName: user.displayName || userEmail
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

    // Import new shopping items collections
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
  }

  // -- PLANNER --
  async getPlans(): Promise<Plan[]> {
    const snapshot = await getDocs(
      query(collection(db, 'plans'), orderBy('startDate', 'desc'))
    );
    const plans: Plan[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      plans.push({
        ...data,
        id: doc.id
      } as Plan);
    });
    
    return plans;
  }
  
  async getPlanByDate(date: string): Promise<Plan | null> {
    const deterministicId = date === 'template' ? TEMPLATE_ID : `plan-${date}`;
    const docSnap = await getDoc(doc(db, 'plans', deterministicId));
    
    if (docSnap.exists()) {
      const data = this.convertTimestamps(docSnap.data());
      return { ...data, id: docSnap.id } as Plan;
    }

    return null;
  }
  
  async getPlanIncludingDate(date: string): Promise<Plan | null> {
    const all = await this.getPlans();
    // Normalize to UTC midnight for consistent relative comparison
    const targetTime = new Date(`${date}T00:00:00Z`).getTime();
    
    return all.find(p => {
      if (p.startDate === 'template' || p.id === TEMPLATE_ID) return false;
      
      const startTime = new Date(`${p.startDate}T00:00:00Z`).getTime();
      return targetTime >= startTime && targetTime < (startTime + 7 * 24 * 60 * 60 * 1000);
    }) || null;
  }
  
  async createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy' | 'imagePath'> & { id?: string }): Promise<Plan> {
    const isTemplate = p.startDate === 'template' || p.id === TEMPLATE_ID;
    const id = isTemplate ? TEMPLATE_ID : `plan-${p.startDate}`;
    const docRef = doc(db, 'plans', id);

    return await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      
      // Use existing metadata if document exists, otherwise initialize it.
      const createdAt = sfDoc.exists() ? sfDoc.data().createdAt : new Date().toISOString();
      const createdBy = sfDoc.exists() ? sfDoc.data().createdBy : (this.currentUser?.id || 'unknown');

      const newPlan = {
        ...p,
        id,
        createdAt,
        createdBy
      };

      transaction.set(docRef, newPlan);
      return newPlan as Plan;
    });
  }
  
  async deletePlan(id: string): Promise<void> {
    await deleteDoc(doc(db, 'plans', id));
  }
}