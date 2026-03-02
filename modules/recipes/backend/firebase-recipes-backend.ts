/**
 * Firebase Recipes Backend
 * 
 * Implements recipe persistence using Firebase Firestore.
 * Extends BaseRecipesBackend for AI-powered operations.
 * 
 * THIS IS "THE HANDS" FOR RECIPES.
 * Persistence and transport only. No domain logic.
 */

import { BaseRecipesBackend } from './base-recipes-backend';
import {
  Recipe,
  RecipeIngredient,
  Equipment,
  RecipeCategory,
  CanonicalItem,
  Unit,
  Aisle,
  KitchenSettings,
} from '../../../types/contract';
import { db, auth, storage, functions } from '../../../shared/backend/firebase';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { SYSTEM_CORE } from '../../../shared/backend/prompts';
import { assistModeBackend } from '../../assist-mode/backend';
import { canonBackend } from '../../canon';

export class FirebaseRecipesBackend extends BaseRecipesBackend {
  private currentIdToken: string | null = null;
  
  // ==================== AI TRANSPORT (Uses Cloud Functions) ====================
  
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

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    const settings = await this.getKitchenSettings();
    const houseRules = settings.directives ? `\nHOUSE RULES & PREFERENCES:\n${settings.directives}` : '';
    return `${SYSTEM_CORE}${houseRules}${customContext ? `\n\n${customContext}` : ''}`;
  }

  // ==================== HELPER METHODS ====================
  
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

  // ==================== RECIPE CRUD ====================

  /**
   * Detect if a recipe is in old format (Issue #57).
   * @param rawData Raw recipe data from Firestore
   * @returns true if recipe has legacy fields
   */
  private hasLegacyFormat(rawData: any): boolean {
    return rawData.stepIngredients !== undefined || 
           rawData.stepAlerts !== undefined ||
           (rawData.workflowAdvice?.technicalWarnings !== undefined);
  }

  /**
   * Persist migrated recipe back to Firestore.
   * @param recipe Migrated recipe to persist
   */
  private async persistMigratedRecipe(recipe: Recipe): Promise<void> {
    try {
      const docRef = doc(db, 'recipes', recipe.id);
      
      // Explicitly remove legacy fields to ensure they don't persist
      const cleanRecipe = { ...recipe };
      delete (cleanRecipe as any).stepIngredients;
      delete (cleanRecipe as any).stepAlerts;
      if ((cleanRecipe as any).workflowAdvice) {
        delete (cleanRecipe as any).workflowAdvice.technicalWarnings;
        if (Object.keys((cleanRecipe as any).workflowAdvice).length === 0) {
          delete (cleanRecipe as any).workflowAdvice;
        }
      }
      
      const firestoreData = this.cleanUndefinedValues(this.encodeRecipeForFirestore(cleanRecipe));
      
      // Use setDoc with merge:false to completely replace the document with new format
      // This ensures legacy fields are removed
      await setDoc(docRef, firestoreData, { merge: false });
      debugLogger.log('Recipe Migration', `Persisted migrated recipe: ${recipe.id}`);
    } catch (error) {
      // Log migration persistence error, but don't fail the read operation
      debugLogger.warn('Recipe Migration', `Failed to persist migrated recipe ${recipe.id}:`, error);
    }
  }
  
  async getRecipes(): Promise<Recipe[]> {
    const snapshot = await getDocs(collection(db, 'recipes'));
    const recipes: Recipe[] = [];
    const migrationsToApply: Promise<void>[] = [];
    
    snapshot.forEach((doc) => {
      const rawData = this.decodeRecipeFromFirestore(this.convertTimestamps(doc.data()));
      const hadLegacyFormat = this.hasLegacyFormat(rawData);
      
      let data = this.normalizeRecipeData({ ...rawData, id: doc.id }) as Recipe;
      recipes.push(data);
      
      // If recipe was migrated, persist the new format back to Firestore
      if (hadLegacyFormat) {
        migrationsToApply.push(this.persistMigratedRecipe(data));
      }
    });

    // Wait for all migrations to persist (but don't block returning recipes)
    Promise.all(migrationsToApply).catch(err => 
      debugLogger.warn('Recipe Migration', 'Some migrations failed to persist:', err)
    );

    return recipes;
  }
  
  async getRecipe(id: string): Promise<Recipe | null> {
    const docRef = doc(db, 'recipes', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const rawData = this.decodeRecipeFromFirestore(this.convertTimestamps(docSnap.data()));
    const hadLegacyFormat = this.hasLegacyFormat(rawData);
    
    let data = this.normalizeRecipeData({ ...rawData, id: docSnap.id }) as Recipe;
    
    // If recipe was migrated, persist the new format back to Firestore
    if (hadLegacyFormat) {
      // Persist asynchronously, don't block the return
      this.persistMigratedRecipe(data).catch(err =>
        debugLogger.warn('Recipe Migration', `Failed to persist migrated recipe ${id}:`, err)
      );
    }
    
    return data;
  }
  
  async resolveImagePath(path: string): Promise<string> {
    if (!path) return '';

    // In dev mode and production, just return the URL
    // Let the img tag's onError handler deal with missing images silently
    if (import.meta.env.DEV) {
      const bucket = storage.app.options.storageBucket || 'gen-lang-client-0015061880.firebasestorage.app';
      const encodedPath = encodeURIComponent(path);
      return `/v0/b/${bucket}/o/${encodedPath}?alt=media`;
    }

    try {
      return await getDownloadURL(ref(storage, path));
    } catch {
      // Silently return empty string for missing images
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
      createdBy: auth.currentUser?.email || 'unknown'
    };
    
    await setDoc(doc(db, 'recipes', id), this.cleanUndefinedValues(this.encodeRecipeForFirestore(newRecipe)));
    
    // Post-processing: Auto-categorise and process ingredients
    const categoryIds = await this.categorizeRecipe(newRecipe as Recipe);
    const postProcessUpdates: any = {};
    
    if (categoryIds.length > 0) {
      postProcessUpdates.categoryIds = categoryIds;
    }
    
    // Process ingredients to link to canonical items
    if (Array.isArray(newRecipe.ingredients) && newRecipe.ingredients.length > 0) {
      const processedIngredients = await this.matchRecipeIngredients(newRecipe.ingredients as any, id);
      postProcessUpdates.ingredients = processedIngredients;
      
      // Update ingredients in instructions to reference processed versions
      if (Array.isArray(newRecipe.instructions)) {
        const ingredientMap = new Map(processedIngredients.map(ing => [ing.id, ing]));
        postProcessUpdates.instructions = newRecipe.instructions.map((instr: any) => {
          if (instr.ingredients && Array.isArray(instr.ingredients)) {
            return {
              ...instr,
              ingredients: instr.ingredients
                .map((ing: any) => ingredientMap.get(ing.id) || ing)
                .filter((ing: any) => ing !== undefined)
            };
          }
          return instr;
        });
      }
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
    await setDoc(doc(db, 'recipes', id), this.cleanUndefinedValues(this.encodeRecipeForFirestore(updated)));
    
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
      // Incremental ingredient processing: process only what changed
      const updatedIngredients = updated.ingredients as any[];
      const oldIngredients = existing.ingredients || [];
      const processedIngredients: RecipeIngredient[] = [];
      
      // Build index of old ingredients by raw text for quick lookup
      const oldIngMap = new Map(oldIngredients.map((ing: any) => [ing.raw, ing]));
      
      // Separate ingredients into categories
      const toRematch: string[] = [];
      const toReparseOnly: RecipeIngredient[] = [];
      const toSkip: RecipeIngredient[] = [];
      
      for (const newIng of updatedIngredients) {
        const raw = typeof newIng === 'string' ? newIng : newIng.raw;
        const oldIng = oldIngMap.get(raw);
        
        // For string ingredients, always process (new or changed raw text)
        if (typeof newIng === 'string') {
          const decision = canonBackend.shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
          if (decision === 'rematch') {
            toRematch.push(raw);
          } else if (decision === 'skip' && oldIng) {
            toSkip.push(oldIng);
          } else {
            // Shouldn't happen, but treat as rematch
            toRematch.push(raw);
          }
        } else {
          // Structured ingredient: check if needs reprocessing
          const decision = canonBackend.shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
          
          if (decision === 'skip') {
            // Use existing structured ingredient as-is
            toSkip.push(newIng as RecipeIngredient);
          } else if (decision === 'reparse-only') {
            // Parser upgraded but identity unchanged: update metadata only
            toReparseOnly.push(newIng as RecipeIngredient);
          } else {
            // Rematch needed
            toRematch.push(raw);
          }
        }
      }
      
      debugLogger.info('Recipe Update', `Ingredient processing decisions: ${toRematch.length} rematch, ${toReparseOnly.length} reparse-only, ${toSkip.length} skip`);
      
      // Process ingredients that need rematching
      let rematched: RecipeIngredient[] = [];
      if (toRematch.length > 0) {
        debugLogger.info('Recipe Update', `Processing ${toRematch.length} ingredients that need rematching`);
        rematched = await this.matchRecipeIngredients(toRematch, id);
      }
      
      // Update reparse-only ingredients with new parser metadata
      const reparsed = toReparseOnly.map(ing => {
        const enhanced = (canonBackend as any).parseIngredientEnhanced(ing.raw, []); // Units loaded internally
        const identityKey = (canonBackend as any).buildIdentityKey(enhanced.item, enhanced.qualifiers);
        const now = new Date().toISOString();
        
        return {
          ...ing,
          parserVersion: 2, // BaseCanonBackend.PARSER_VERSION
          parserIdentityKey: identityKey,
          parserUpdatedAt: now,
        };
      });
      
      // Combine all results in original order
      const finalIngredients: RecipeIngredient[] = [];
      let rematchIndex = 0;
      let reparseIndex = 0;
      let skipIndex = 0;
      
      for (const newIng of updatedIngredients) {
        const raw = typeof newIng === 'string' ? newIng : newIng.raw;
        const oldIng = oldIngMap.get(raw);
        
        if (typeof newIng === 'string') {
          const decision = canonBackend.shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
          if (decision === 'rematch') {
            finalIngredients.push(rematched[rematchIndex++]);
          } else if (decision === 'skip' && oldIng) {
            finalIngredients.push(toSkip[skipIndex++]);
          } else {
            finalIngredients.push(rematched[rematchIndex++]);
          }
        } else {
          const decision = canonBackend.shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
          
          if (decision === 'skip') {
            finalIngredients.push(toSkip[skipIndex++]);
          } else if (decision === 'reparse-only') {
            finalIngredients.push(reparsed[reparseIndex++]);
          } else {
            finalIngredients.push(rematched[rematchIndex++]);
          }
        }
      }
      
      postProcessUpdates.ingredients = finalIngredients;
      
      // Update ingredients in instructions to reference processed versions
      const ingredientMap = new Map(finalIngredients.map((ing: any) => [ing.id, ing]));
      if (Array.isArray(updated.instructions)) {
        postProcessUpdates.instructions = updated.instructions.map((instr: any) => {
          if (instr.ingredients && Array.isArray(instr.ingredients)) {
            return {
              ...instr,
              ingredients: instr.ingredients
                .map((ing: any) => ingredientMap.get(ing.id) || ing)
                .filter((ing: any) => ing !== undefined)
            };
          }
          return instr;
        });
      }
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
    // Delete associated cook guides first (cascade delete)
    const cookGuides = await assistModeBackend.getCookGuidesForRecipe(id);
    for (const guide of cookGuides) {
      await assistModeBackend.deleteCookGuide(guide.id);
    }

    // Then delete the recipe
    await deleteDoc(doc(db, 'recipes', id));
  }

  // ==================== NOTIFICATION HOOKS ====================

  async onCanonItemsDeleted(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const idsSet = new Set(ids);
    const recipesSnap = await getDocs(collection(db, 'recipes'));

    let batch = writeBatch(db);
    let batchCount = 0;

    for (const recipeDoc of recipesSnap.docs) {
      const rawData = this.decodeRecipeFromFirestore(this.convertTimestamps(recipeDoc.data()));
      const recipe = rawData as Recipe;

      if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
        continue;
      }

      let ingredientsChanged = false;
      const updatedIngredients = recipe.ingredients.map((ing: any) => {
        if (ing && ing.canonicalItemId && idsSet.has(ing.canonicalItemId)) {
          ingredientsChanged = true;
          const { canonicalItemId, ...rest } = ing;
          return rest;
        }
        return ing;
      });

      let instructionsChanged = false;
      const updatedInstructions = Array.isArray(recipe.instructions)
        ? recipe.instructions.map((instr: any) => {
            if (!instr || !Array.isArray(instr.ingredients)) return instr;

            let instrChanged = false;
            const updatedInstrIngredients = instr.ingredients.map((ing: any) => {
              if (ing && ing.canonicalItemId && idsSet.has(ing.canonicalItemId)) {
                instrChanged = true;
                const { canonicalItemId, ...rest } = ing;
                return rest;
              }
              return ing;
            });

            if (instrChanged) {
              instructionsChanged = true;
              return { ...instr, ingredients: updatedInstrIngredients };
            }

            return instr;
          })
        : recipe.instructions;

      if (!ingredientsChanged && !instructionsChanged) {
        continue;
      }

      const updates: any = {};
      if (ingredientsChanged) updates.ingredients = updatedIngredients;
      if (instructionsChanged) updates.instructions = updatedInstructions;

      const payload = this.encodeRecipeForFirestore(this.cleanUndefinedValues(updates));
      batch.update(recipeDoc.ref, payload);
      batchCount++;

      if (batchCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  // ==================== DEPENDENCIES (Other Modules) ====================
  
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

  async getKitchenSettings(): Promise<KitchenSettings> {
    try {
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
    } catch (error) {
      // Firestore emulator connection issues (e.g., stale Listen channels) can cause
      // non-blocking errors. Return defaults if fetch fails.
      debugLogger.warn('getKitchenSettings', 'Failed to fetch settings, using defaults:', error);
      return { directives: '', debugEnabled: false };
    }
  }

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

  async getUnits(): Promise<Unit[]> {
    const snapshot = await getDocs(collection(db, 'units'));
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

  async getAisles(): Promise<Aisle[]> {
    const snapshot = await getDocs(collection(db, 'aisles'));
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
}
