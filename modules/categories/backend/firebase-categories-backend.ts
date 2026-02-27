/**
 * Firebase Categories Backend
 * 
 * Implements category persistence using Firebase Firestore.
 * Extends BaseCategoriesBackend for AI-powered operations.
 */

import { BaseCategoriesBackend } from './base-categories-backend';
import { RecipeCategory } from '../../../types/contract';
import { db, auth, functions } from '../../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export class FirebaseCategoriesBackend extends BaseCategoriesBackend {
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

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    // Simplified for categories - full system instruction in shared/backend/prompts.ts later
    return customContext || "You are the Head Chef managing recipe categories and organization.";
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
  
  // ==================== VALIDATION METHODS ====================
  
  /**
   * Validate category synonyms are unique across all categories
   * Throws error if any synonym already exists on a different category
   */
  protected async validateUniqueCategorySynonyms(synonyms: string[] | undefined, currentCategoryId?: string): Promise<void> {
    if (!synonyms || synonyms.length === 0) return;

    const allCategories = await this.getCategories();
    const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());

    for (const syn of normalizedSynonyms) {
      if (!syn) continue; // Skip empty strings

      for (const category of allCategories) {
        // Skip the category we're currently updating
        if (category.id === currentCategoryId) continue;

        // Check if this synonym exists on another category
        const categorySynonyms = (category.synonyms || []).map(s => s.toLowerCase().trim());
        if (categorySynonyms.includes(syn)) {
          throw new Error(`Synonym "${syn}" already exists on category "${category.name}"`);
        }

        // Also check against the category's main name
        if (category.name.toLowerCase() === syn) {
          throw new Error(`Synonym "${syn}" conflicts with category "${category.name}"`);
        }
      }
    }
  }

  /**
   * Validate category name doesn't conflict with existing synonyms
   * Throws error if the category name matches a synonym on any other category
   */
  protected async validateCategoryNameUniqueness(categoryName: string, currentCategoryId?: string): Promise<void> {
    const normalizedName = categoryName.toLowerCase().trim();
    if (!normalizedName) return;

    const allCategories = await this.getCategories();

    for (const category of allCategories) {
      // Skip the category we're currently updating
      if (category.id === currentCategoryId) continue;

      // Check if this name matches any synonym on another category
      const categorySynonyms = (category.synonyms || []).map(s => s.toLowerCase().trim());
      if (categorySynonyms.includes(normalizedName)) {
        throw new Error(`Category name "${categoryName}" conflicts with synonym on category "${category.name}"`);
      }
    }
  }

  /**
   * Filter out conflicting category synonyms without throwing an error
   * Returns only the synonyms that don't conflict with existing categories
   */
  protected async filterValidCategorySynonyms(
    synonyms: string[] | undefined, 
    currentCategoryId?: string
  ): Promise<string[]> {
    if (!synonyms || synonyms.length === 0) return [];

    const allCategories = await this.getCategories();
    const validSynonyms: string[] = [];

    for (const syn of synonyms) {
      const normalizedSyn = syn.toLowerCase().trim();
      if (!normalizedSyn) continue; // Skip empty strings

      let isValid = true;

      for (const category of allCategories) {
        // Skip the category we're currently updating
        if (category.id === currentCategoryId) continue;

        // Check if this synonym exists on another category
        const categorySynonyms = (category.synonyms || []).map(s => s.toLowerCase().trim());
        if (categorySynonyms.includes(normalizedSyn)) {
          isValid = false;
          break;
        }

        // Also check against the category's main name
        if (category.name.toLowerCase() === normalizedSyn) {
          isValid = false;
          break;
        }
      }

      // Only add if valid
      if (isValid) {
        validSynonyms.push(syn);
      }
    }

    return validSynonyms;
  }
}
