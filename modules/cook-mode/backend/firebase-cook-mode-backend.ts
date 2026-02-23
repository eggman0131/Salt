/**
 * Firebase Cook Mode Backend
 * 
 * Persistence layer for cook guides using Firestore.
 */

import { Recipe } from '../../../types/contract';
import { CookGuide } from '../types';
import { BaseCookModeBackend } from './base-cook-mode-backend';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { auth, db, functions } from '../../../shared/backend/firebase';
import { debugLogger } from '../../../shared/backend/debug-logger';

export class FirebaseCookModeBackend extends BaseCookModeBackend {
  private currentIdToken: string | null = null;

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
        params,
      });
      debugLogger.log('callGenerateContent', 'Success');
      return result.data as GenerateContentResponse;
    } catch (error) {
      debugLogger.error('callGenerateContent', 'Cloud Function error:', error);
      throw error;
    }
  }
  private collectionName = 'cookGuides';

  async getOrGenerateCookGuide(recipe: Recipe): Promise<CookGuide> {
    // Check if guide exists
    const q = query(collection(db, this.collectionName), where('recipeId', '==', recipe.id));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const guide = snapshot.docs[0].data() as CookGuide;
      const recipeVersion = this.hashRecipe(recipe);

      // Return if version matches
      if (guide.recipeVersion === recipeVersion) {
        return guide;
      }
    }

    // Generate new guide
    return this.generateCookGuide(recipe);
  }

  async generateCookGuide(recipe: Recipe): Promise<CookGuide> {
    const guideData = await this.generateGuideWithAI(recipe);

    const guide: CookGuide = {
      id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...guideData,
      generatedAt: new Date().toISOString(),
      generatedBy: 'system', // TODO: Use actual user ID from auth
    };

    // Save to Firestore
    await setDoc(doc(db, this.collectionName, guide.id), guide);

    return guide;
  }

  async getCookGuide(guideId: string): Promise<CookGuide | null> {
    const snapshot = await getDoc(doc(db, this.collectionName, guideId));
    return snapshot.exists() ? (snapshot.data() as CookGuide) : null;
  }

  async deleteCookGuide(guideId: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, guideId));
  }

  async getCookGuidesForRecipe(recipeId: string): Promise<CookGuide[]> {
    const q = query(collection(db, this.collectionName), where('recipeId', '==', recipeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as CookGuide);
  }
}
