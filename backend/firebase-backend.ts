/** File intentionally updated to use logger for non-error debug info. */
import { User, Recipe, Equipment, Plan, KitchenSettings } from '../types/contract';
import { BaseSaltBackend } from './base-backend';
import { db, auth, storage, functions } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc, orderBy, writeBatch, Timestamp, runTransaction } from 'firebase/firestore';
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { logger, setDebug, isDebugEnabled } from '../lib/logger';

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
        
        console.error(`[Firestore] Attempt ${i + 1}/${maxRetries} failed:`, error?.code, error?.message);
        
        if (isOfflineError && i < maxRetries - 1) {
          logger.log(`[Firestore] Retrying after ${delayMs}ms...`);
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
    
    logger.log('[callGenerateContent] Starting - auth.currentUser:', user?.email, 'storedToken:', idToken ? 'yes' : 'no');
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }

    if (user) {
      try {
        logger.log('[callGenerateContent] Attempting to get fresh token...');
        idToken = await user.getIdToken(true);
        logger.log('[callGenerateContent] Got fresh token:', idToken ? 'yes' : 'no');
        this.currentIdToken = idToken;
      } catch (e) {
        logger.log('[callGenerateContent] getIdToken failed, using fallback:', e);
        if (!idToken) throw e;
      }
    }
    
    logger.log('[callGenerateContent] Final idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
    
    logger.log('[callGenerateContent] Calling Cloud Function with idToken...');
    try {
      const result = await cloudGenerateContent({
        idToken,
        params
      });
      logger.log('[callGenerateContent] Success');
      return result.data as GenerateContentResponse;
    } catch (error) {
      console.error('[callGenerateContent] Cloud Function error:', error);
      throw error;
    }
  }

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    logger.log('[callGenerateContentStream] Starting - auth.currentUser:', user?.email, 'storedToken:', idToken ? 'yes' : 'no');
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }

    if (user) {
      try {
        logger.log('[callGenerateContentStream] Attempting to get fresh token...');
        idToken = await user.getIdToken(true);
        logger.log('[callGenerateContentStream] Got fresh token:', idToken ? 'yes' : 'no');
        this.currentIdToken = idToken;
      } catch (e) {
        logger.log('[callGenerateContentStream] getIdToken failed, using fallback:', e);
        if (!idToken) throw e; 
      }
    }

    logger.log('[callGenerateContentStream] Final idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContentStream = httpsCallable(functions, 'cloudGenerateContentStream');
    
    logger.log('[callGenerateContentStream] Calling Cloud Function with idToken...');
    try {
      const result = await cloudGenerateContentStream({
        idToken,
        params
      });
      
      const response = result.data as GenerateContentResponse;
      logger.log('[callGenerateContentStream] Success');
      return (async function* () {
        yield response;
      })();
    } catch (error) {
      console.error('[callGenerateContentStream] Cloud Function error:', error);
      throw error;
    }
  }

