/**
 * Firebase Kitchen Data Backend
 * 
 * Implements kitchen data persistence using Firebase Firestore.
 * Extends BaseKitchenDataBackend for AI-powered operations.
 */

import { BaseKitchenDataBackend } from './base-kitchen-data-backend';
import {
  Unit,
  Aisle,
  CanonicalItem,
  RecipeCategory,
  Recipe,
} from '../../../types/contract';
import { db, auth, functions } from '../../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export class FirebaseKitchenDataBackend extends BaseKitchenDataBackend {
  private currentIdToken: string | null = null;
  
  // ==================== AI TRANSPORT (Uses Cloud Functions) ====================
  
  protected async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }
    
    if (user) {
      try {
        idToken = await user.getIdToken(true);
        this.currentIdToken = idToken;
      } catch (e) {
        if (!idToken) throw e;
      }
    }
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
    
    try {
      const result = await cloudGenerateContent({
        idToken,
        params
      });
      return result.data as GenerateContentResponse;
    } catch (error) {
      throw error;
    }
  }

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }
    
    if (user) {
      try {
        idToken = await user.getIdToken(true);
        this.currentIdToken = idToken;
      } catch (e) {
        if (!idToken) throw e; 
      }
    }
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContentStream = httpsCallable(functions, 'cloudGenerateContentStream');
    
    try {
      const result = await cloudGenerateContentStream({
        idToken,
        params
      });
      return result.data as AsyncIterable<GenerateContentResponse>;
    } catch (error) {
      throw error;
    }
  }

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    // Simplified for kitchen-data - full system instruction in shared/backend/prompts.ts later
    return customContext || "You are the Head Chef managing kitchen data and organization.";
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
  
  // ==================== UNITS ====================
  
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
  
  // ==================== AISLES ====================
  
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
  
  // ==================== CANONICAL ITEMS ====================
  
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
    // Validate item name doesn't conflict with existing synonyms
    await this.validateItemNameUniqueness(item.name);
    
    // Filter out any conflicting synonyms (for AI-proposed synonyms that may conflict)
    const validSynonyms = await this.filterValidSynonyms(item.synonyms);
    
    // Validate remaining synonyms are unique
    if (validSynonyms.length > 0) {
      await this.validateUniqueSynonyms(validSynonyms);
    }

    const now = new Date().toISOString();
    const newItem: any = {
      ...item,
      createdAt: now,
      isStaple: item.isStaple ?? false,
      synonyms: validSynonyms // Use filtered synonyms instead of original
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
    // Validate item name doesn't conflict with existing synonyms (if name is being updated)
    if (updates.name !== undefined) {
      await this.validateItemNameUniqueness(updates.name, id);
    }
    
    // Filter out conflicting synonyms (if synonyms are being updated)
    let finalUpdates = { ...updates };
    if (updates.synonyms !== undefined) {
      const validSynonyms = await this.filterValidSynonyms(updates.synonyms, id);
      finalUpdates = { ...finalUpdates, synonyms: validSynonyms };
    }

    const docRef = doc(db, 'canonical_items', id);
    
    // Remove undefined values
    const cleanUpdates: any = { ...finalUpdates };
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
    // Delegate to bulk delete to avoid code duplication
    await this.deleteCanonicalItems([id]);
  }

  async deleteCanonicalItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const batch = writeBatch(db);
    const idsSet = new Set(ids);
    
    // Delete all canonical items
    for (const id of ids) {
      batch.delete(doc(db, 'canonical_items', id));
    }

    // Unlink ALL affected ingredients in ONE pass (prevents race conditions)
    const recipesSnap = await getDocs(collection(db, 'recipes'));
    let recipesAffected = 0;
    let ingredientsUnlinked = 0;

    recipesSnap.forEach((recipeDoc) => {
      const data = this.convertTimestamps(recipeDoc.data());
      const recipe = data as Recipe;
      if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) return;

      let recipeChanged = false;
      const updatedIngredients = recipe.ingredients.map(ing => {
        // Check if this ingredient links to ANY of the deleted items
        if (ing.canonicalItemId && idsSet.has(ing.canonicalItemId)) {
          recipeChanged = true;
          ingredientsUnlinked++;
          // Remove canonicalItemId field entirely (not just set to undefined)
          const { canonicalItemId, ...rest } = ing;
          return rest;
        }
        return ing;
      });

      if (recipeChanged) {
        recipesAffected++;
        batch.update(recipeDoc.ref, { ingredients: updatedIngredients });
      }
    });

    await batch.commit();
    
    console.log(`Deleted ${ids.length} item${ids.length === 1 ? '' : 's'}, unlinked ${ingredientsUnlinked} ingredient${ingredientsUnlinked === 1 ? '' : 's'} across ${recipesAffected} recipe${recipesAffected === 1 ? '' : 's'}`);
  }

  // ==================== IMPACT ASSESSMENT & HEALING ====================

  async assessItemDeletion(ids: string[]): Promise<{
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }> {
    const idsSet = new Set(ids);
    const affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[] = [];

    const recipesSnap = await getDocs(collection(db, 'recipes'));
    recipesSnap.forEach((recipeDoc) => {
      const data = this.convertTimestamps(recipeDoc.data());
      const recipe = data as Recipe;
      if (!recipe.ingredients?.length) return;

      const affectedIndices: number[] = [];
      recipe.ingredients.forEach((ing, idx) => {
        if (ing.canonicalItemId && idsSet.has(ing.canonicalItemId)) {
          affectedIndices.push(idx);
        }
      });

      if (affectedIndices.length > 0) {
        affectedRecipes.push({
          id: recipeDoc.id,
          title: recipe.title || '(Untitled)',
          ingredientCount: affectedIndices.length,
          affectedIndices
        });
      }
    });

    return {
      itemIds: ids,
      affectedRecipes
    };
  }

  async healRecipeReferences(ids: string[], assessment: {
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number }[];
  }): Promise<{
    recipesFixed: number;
    ingredientsProcessed: number;
    ingredientsRematched: number;
    ingredientsUnmatched: number;
    newCanonicalItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }>;
  }> {
    const allItems = await this.getCanonicalItems();
    const affectedRecipeIds = new Set(assessment.affectedRecipes.map(r => r.id));

    let recipesFixed = 0;
    let ingredientsProcessed = 0;
    let ingredientsRematched = 0;
    let ingredientsUnmatched = 0;
    const newItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }> = [];

    const batch = writeBatch(db);

    // Only process recipes that were affected by the deletion
    for (const assessedRecipe of assessment.affectedRecipes) {
      const recipeRef = doc(db, 'recipes', assessedRecipe.id);
      const recipeDoc = await getDoc(recipeRef);
      
      if (!recipeDoc.exists()) continue;
      
      const data = this.convertTimestamps(recipeDoc.data());
      const recipe = data as Recipe;
      if (!recipe.ingredients?.length) continue;

      let recipeChanged = false;
      let unlinkedCount = 0;

      // Step 1: Find unlinked ingredients (no canonicalItemId)
      const updatedIngredients = recipe.ingredients.map((ing, idx) => {
        // Only try to re-match if ingredient is unlinked (no canonicalItemId)
        if (!ing.canonicalItemId) {
          unlinkedCount++;
          ingredientsProcessed++;
          
          // Step 2: Try to fuzzy match
          let bestMatch: CanonicalItem | null = null;
          let bestScore = 0;

          for (const candidate of allItems) {
            const score = this.fuzzyMatch(
              ing.ingredientName.toLowerCase(),
              candidate.normalisedName
            );
            if (score > bestScore) {
              bestScore = score;
              bestMatch = candidate;
            }

            if (candidate.synonyms) {
              for (const syn of candidate.synonyms) {
                const synScore = this.fuzzyMatch(
                  ing.ingredientName.toLowerCase(),
                  syn.toLowerCase()
                );
                if (synScore > bestScore) {
                  bestScore = synScore;
                  bestMatch = candidate;
                }
              }
            }
          }

          // Re-link if good match (85%+)
          if (bestScore >= 0.85 && bestMatch) {
            ingredientsRematched++;
            recipeChanged = true;
            return { ...ing, canonicalItemId: bestMatch.id };
          } else {
            // Leave unlinked for manual review
            ingredientsUnmatched++;
            recipeChanged = true;
            return ing;
          }
        }
        return ing;
      });

      if (recipeChanged && unlinkedCount > 0) {
        recipesFixed++;
        batch.update(recipeRef, { ingredients: updatedIngredients });
      }
    }

    await batch.commit();

    console.log(`✅ Healed ${recipesFixed} recipes: ${ingredientsRematched} rematched, ${ingredientsUnmatched} unmatched`);

    return {
      recipesFixed,
      ingredientsProcessed,
      ingredientsRematched,
      ingredientsUnmatched,
      newCanonicalItemsCreated: newItemsCreated
    };
  }

  private fuzzyMatch(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
  
  // ==================== CATEGORIES ====================
  
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
    // Validate category name doesn't conflict with existing synonyms
    await this.validateCategoryNameUniqueness(category.name);
    
    // Filter out any conflicting synonyms (for AI-proposed synonyms that may conflict)
    const validSynonyms = await this.filterValidCategorySynonyms(category.synonyms);
    
    // Validate remaining synonyms are unique
    if (validSynonyms.length > 0) {
      await this.validateUniqueCategorySynonyms(validSynonyms);
    }

    const now = new Date().toISOString();
    const newCat: any = {
      ...category,
      createdAt: now,
      synonyms: validSynonyms // Use filtered synonyms instead of original
    };

    // Remove undefined values
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
    // Validate category name doesn't conflict with existing synonyms (if name is being updated)
    if (updates.name !== undefined) {
      await this.validateCategoryNameUniqueness(updates.name, id);
    }
    
    // Filter out conflicting synonyms (if synonyms are being updated)
    let finalUpdates = { ...updates };
    if (updates.synonyms !== undefined) {
      const validSynonyms = await this.filterValidCategorySynonyms(updates.synonyms, id);
      finalUpdates = { ...finalUpdates, synonyms: validSynonyms };
    }

    const docRef = doc(db, 'categories', id);
    
    // Remove undefined values
    const cleanUpdates: any = { ...finalUpdates };
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
}
