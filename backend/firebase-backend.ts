import { User, Recipe, Equipment, Plan, KitchenSettings } from '../types/contract';
import { BaseSaltBackend } from './base-backend';
import { db, auth, storage, functions } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc, orderBy, writeBatch, Timestamp } from 'firebase/firestore';
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
                console.error('Manual upload failed:', response.statusText);
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            return; // Success! Skip SDK.
        } catch (e) {
            console.error("Manual upload failed, falling back to SDK", e);
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
    
    console.log('[callGenerateContent] Starting - auth.currentUser:', user?.email, 'storedToken:', idToken ? 'yes' : 'no');
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }
    
    if (user) {
      try {
        console.log('[callGenerateContent] Attempting to get fresh token...');
        idToken = await user.getIdToken(true);
        console.log('[callGenerateContent] Got fresh token:', idToken ? 'yes' : 'no');
        this.currentIdToken = idToken;
      } catch (e) {
        console.log('[callGenerateContent] getIdToken failed, using fallback:', e);
        if (!idToken) throw e;
      }
    }
    
    console.log('[callGenerateContent] Final idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
    
    console.log('[callGenerateContent] Calling Cloud Function with idToken...');
    try {
      const result = await cloudGenerateContent({
        idToken,
        params
      });
      console.log('[callGenerateContent] Success');
      return result.data as GenerateContentResponse;
    } catch (error) {
      console.error('[callGenerateContent] Cloud Function error:', error);
      throw error;
    }
  }

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    console.log('[callGenerateContentStream] Starting - auth.currentUser:', user?.email, 'storedToken:', idToken ? 'yes' : 'no');
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }
    
    if (user) {
      try {
        console.log('[callGenerateContentStream] Attempting to get fresh token...');
        idToken = await user.getIdToken(true);
        console.log('[callGenerateContentStream] Got fresh token:', idToken ? 'yes' : 'no');
        this.currentIdToken = idToken;
      } catch (e) {
        console.log('[callGenerateContentStream] getIdToken failed, using fallback:', e);
        if (!idToken) throw e; 
      }
    }
    
    console.log('[callGenerateContentStream] Final idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContentStream = httpsCallable(functions, 'cloudGenerateContentStream');
    
    console.log('[callGenerateContentStream] Calling Cloud Function with idToken...');
    try {
      const result = await cloudGenerateContentStream({
        idToken,
        params
      });
      
      const response = result.data as GenerateContentResponse;
      console.log('[callGenerateContentStream] Success');
      return (async function* () {
        yield response;
      })();
    } catch (error) {
      console.error('[callGenerateContentStream] Cloud Function error:', error);
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
      console.error("Email link error:", error);
      throw new Error("Failed to send sign-in link.");
    }
  }

  async handleRedirectResult(): Promise<User | null> {
    try {
      const href = window.location.href;
      if (!isSignInWithEmailLink(auth, href)) {
        return null;
      }

      let userEmail = localStorage.getItem('salt_email_link') || '';
      if (!userEmail) {
        userEmail = window.prompt('Confirm your email to finish signing in') || '';
      }

      if (!userEmail) {
        throw new Error('Missing email for sign-in completion.');
      }

      const result = await signInWithEmailLink(auth, userEmail, href);
      localStorage.removeItem('salt_email_link');

      const userEmailFromAuth = result.user.email;
      
      if (!userEmailFromAuth) {
        await signOut(auth);
        throw new Error("Kitchen Access Denied.");
      }

      const userDoc = await getDoc(doc(db, 'users', userEmailFromAuth));
      
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error("Kitchen Access Denied.");
      }
      
      const userData = userDoc.data();
      this.currentUser = {
        id: userEmailFromAuth,
        email: userEmailFromAuth,
        displayName: userData.displayName || result.user.displayName || userEmailFromAuth
      };
      
      this.currentIdToken = await result.user.getIdToken();
      console.log('[handleRedirectResult] Token stored:', this.currentIdToken ? `${this.currentIdToken.substring(0, 20)}...` : 'FAILED');
      
      return this.currentUser;
    } catch (error: any) {
      if (error.message === "Kitchen Access Denied.") {
        throw error;
      }
      console.error("Auth Redirect Error:", error);
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
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.email));
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
      console.error("Error fetching current user:", error);
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
      console.warn('Unable to resolve image path:', error);
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
      await this.uploadRecipeImage(imagePath, imageData);
    }
    
    // Sanitize and validate before storage
    const normalizedUpdates = this.normalizeRecipeData({ ...existing, ...updates });
    
    const updated = { ...existing, ...normalizedUpdates, imagePath };
    await setDoc(doc(db, 'recipes', id), this.encodeRecipeForFirestore(updated));
    
    return updated as Recipe;
  }
  
  async deleteRecipe(id: string): Promise<void> {
    await deleteDoc(doc(db, 'recipes', id));
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
      return docSnap.data() as KitchenSettings;
    }
    return { directives: '' };
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
    const q = query(collection(db, 'plans'), where('startDate', '==', date));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const docSnap = snapshot.docs[0];
    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id
    } as Plan;
  }
  
  async getPlanIncludingDate(date: string): Promise<Plan | null> {
    const all = await this.getPlans();
    const today = new Date(date).setHours(0, 0, 0, 0);
    
    return all.find(p => {
      if (p.startDate === 'template' || p.id === TEMPLATE_ID) return false;
      
      const start = new Date(p.startDate).setHours(0, 0, 0, 0);
      return today >= start && today < (start + 7 * 24 * 60 * 60 * 1000);
    }) || null;
  }
  
  async createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'> & { id?: string }): Promise<Plan> {
    const isTemplate = p.startDate === 'template' || p.id === TEMPLATE_ID;
    
    let id: string;
    let existingPlan: Plan | null = null;
    
    if (isTemplate) {
      id = TEMPLATE_ID;
      try {
        const docRef = doc(db, 'plans', TEMPLATE_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = this.convertTimestamps(docSnap.data());
          existingPlan = { ...data, id: docSnap.id } as Plan;
        }
      } catch (e) {
        existingPlan = null;
      }
    } else {
      existingPlan = await this.getPlanByDate(p.startDate);
      id = existingPlan?.id || p.id || `plan-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    const newPlan = {
      ...p,
      id,
      createdAt: existingPlan?.createdAt || new Date().toISOString(),
      createdBy: existingPlan?.createdBy || this.currentUser?.id || 'unknown'
    };
    
    await setDoc(doc(db, 'plans', id), newPlan);
    
    return newPlan as Plan;
  }
  
  async deletePlan(id: string): Promise<void> {
    await deleteDoc(doc(db, 'plans', id));
  }
}
