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
import { db, auth, functions } from '../../../backend/firebase';
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

    // Note: Recipe unlinking will be handled by recipes module in future
    const recipesSnap = await getDocs(collection(db, 'recipes'));
    recipesSnap.forEach((recipeDoc) => {
      const data = this.convertTimestamps(recipeDoc.data());
      const recipe = data as Recipe;
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
        // Remove undefined values
        const cleanedIngredients = updatedIngredients.map(ing => {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(ing)) {
            if (value !== undefined) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        });
        batch.update(recipeDoc.ref, { ingredients: cleanedIngredients });
      }
    });

    await batch.commit();
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
    const now = new Date().toISOString();
    const newCat: any = {
      ...category,
      createdAt: now
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
    const docRef = doc(db, 'categories', id);
    
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
