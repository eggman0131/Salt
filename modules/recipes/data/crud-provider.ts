/**
 * CRUD and lifecycle provider for Recipes.
 *
 * Native Firebase implementation replacing the legacy backend adapter.
 * Owns recipe Firestore I/O, image upload, and post-processing orchestration.
 */

import type { Recipe, RecipeIngredient } from '../../../types/contract';
import type {
  CreateRecipeInput,
  RecipeSaveProgress,
  RepairRecipeOptions,
  UpdateRecipeInput,
} from '../types';
import { db, auth } from '../../../shared/backend/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { getCookGuidesForRecipe, deleteCookGuide } from '../../../modules/assist-mode/api';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/backend/firebase';
import {
  convertTimestamps,
  decodeRecipeFromFirestore,
  encodeRecipeForFirestore,
  cleanUndefinedValues,
  sanitizeRecipeEmbeddingsForStorage,
  hasLegacyFormat,
} from './firestore-utils';
import { resolveImagePath as resolveStorageImagePath, uploadRecipeImage } from './storage-provider';
import { normalizeRecipeData } from '../logic/normalize-recipe';
import { categorizeRecipe } from './categorize-provider';

// ==================== LEGACY FORMAT MIGRATION ====================

async function persistMigratedRecipe(recipe: Recipe): Promise<void> {
  try {
    const docRef = doc(db, 'recipes', recipe.id);
    const cleanRecipe = { ...recipe };
    delete (cleanRecipe as any).stepIngredients;
    delete (cleanRecipe as any).stepAlerts;
    if ((cleanRecipe as any).workflowAdvice) {
      delete (cleanRecipe as any).workflowAdvice.technicalWarnings;
      if (Object.keys((cleanRecipe as any).workflowAdvice).length === 0) {
        delete (cleanRecipe as any).workflowAdvice;
      }
    }

    const sanitized = sanitizeRecipeEmbeddingsForStorage(cleanRecipe);
    const firestoreData = cleanUndefinedValues(encodeRecipeForFirestore(sanitized));
    await setDoc(docRef, firestoreData, { merge: false });
    debugLogger.log('Recipe Migration', `Persisted migrated recipe: ${recipe.id}`);
  } catch (error) {
    debugLogger.warn('Recipe Migration', `Failed to persist migrated recipe ${recipe.id}:`, error);
  }
}

// ==================== INGREDIENT PROCESSING ====================

/**
 * Incremental ingredient re-match decision — pure logic, no I/O.
 *
 * Since the call site never passes newParsed, 'reparse-only' is unreachable.
 * Returns 'skip' or 'rematch' for the update flow.
 */
const PARSER_VERSION = 2;

function shouldRematchIngredient(params: {
  oldIngredient?: RecipeIngredient;
  newRaw: string;
}): 'skip' | 'rematch' {
  const { oldIngredient, newRaw } = params;
  if (!oldIngredient) return 'rematch';
  if ((oldIngredient as any).edited) return 'rematch';
  if (oldIngredient.raw !== newRaw) return 'rematch';
  if (!oldIngredient.canonicalItemId) return 'rematch';
  if (oldIngredient.parserVersion && oldIngredient.parserVersion < PARSER_VERSION)
    return 'rematch';
  return 'skip';
}

async function matchIngredients(
  ingredients: string[] | RecipeIngredient[],
  recipeId: string,
  onProgress?: (progress: { stage: string; current: number; total: number; percentage: number }) => void
): Promise<RecipeIngredient[]> {
  if (ingredients.length === 0) return [];

  const rawStrings = ingredients.map((ing) =>
    typeof ing === 'string' ? ing : (ing.raw || ing.ingredientName)
  );

  const { processRawRecipeIngredients } = await import(
    '../../../modules/canon/api'
  );

  const processed = await processRawRecipeIngredients(rawStrings, (progress) => {
    const percentage =
      progress.total > 0
        ? progress.stage === 'parse'
          ? Math.round((progress.current / progress.total) * 50)
          : 50 + Math.round((progress.current / progress.total) * 50)
        : 100;

    onProgress?.({
      stage: progress.stage === 'parse' ? 'Parsing ingredients' : 'Matching ingredients',
      current: progress.current,
      total: progress.total,
      percentage,
    });
  });

  onProgress?.({
    stage: 'Matching complete',
    current: processed.length,
    total: processed.length,
    percentage: 100,
  });

  return processed;
}

// ==================== READ ====================

export async function fetchRecipes(): Promise<Recipe[]> {
  const snapshot = await getDocs(collection(db, 'recipes'));
  const recipes: Recipe[] = [];
  const migrationsToApply: Promise<void>[] = [];

  snapshot.forEach((docSnap) => {
    const rawData = decodeRecipeFromFirestore(
      convertTimestamps(docSnap.data())
    );
    const hadLegacyFormat = hasLegacyFormat(rawData);
    const data = normalizeRecipeData({ ...rawData, id: docSnap.id }) as Recipe;
    recipes.push(data);

    if (hadLegacyFormat) {
      migrationsToApply.push(persistMigratedRecipe(data));
    }
  });

  Promise.all(migrationsToApply).catch((err) =>
    debugLogger.warn('Recipe Migration', 'Some migrations failed to persist:', err)
  );

  return recipes;
}

export async function fetchRecipeById(id: string): Promise<Recipe | null> {
  const docRef = doc(db, 'recipes', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const rawData = decodeRecipeFromFirestore(
    convertTimestamps(docSnap.data())
  );
  const hadLegacyFormat = hasLegacyFormat(rawData);
  const data = normalizeRecipeData({ ...rawData, id: docSnap.id }) as Recipe;

  if (hadLegacyFormat) {
    persistMigratedRecipe(data).catch((err) =>
      debugLogger.warn('Recipe Migration', `Failed to persist migrated recipe ${id}:`, err)
    );
  }

  return data;
}

// ==================== CREATE ====================

export async function createRecipeInStore(
  recipe: CreateRecipeInput,
  imageData?: string,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  onProgress?.({ stage: 'Preparing recipe data', percentage: 5 });
  const id = `rec-${Math.random().toString(36).substr(2, 9)}`;

  let imagePath: string | undefined;
  if (imageData) {
    onProgress?.({ stage: 'Uploading image', percentage: 15 });
    imagePath = `recipes/${id}/image.jpg`;
    await uploadRecipeImage(imagePath, imageData);
  }

  onProgress?.({ stage: 'Validating recipe', percentage: 20 });
  const normalized = normalizeRecipeData(recipe);

  const newRecipe = {
    ...normalized,
    id,
    imagePath,
    matchingStatus: 'pending' as const,
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.email || 'unknown',
  };

  onProgress?.({ stage: 'Saving recipe', percentage: 35 });
  const sanitized = sanitizeRecipeEmbeddingsForStorage(newRecipe);
  await setDoc(
    doc(db, 'recipes', id),
    cleanUndefinedValues(encodeRecipeForFirestore(sanitized))
  );

  onProgress?.({ stage: 'Categorising recipe', percentage: 50 });
  const categoryIds = await categorizeRecipe(newRecipe as Recipe);

  if (categoryIds.length > 0) {
    onProgress?.({ stage: 'Finalising recipe', percentage: 95 });
    const sanitizedUpdates = sanitizeRecipeEmbeddingsForStorage({ categoryIds });
    await updateDoc(
      doc(db, 'recipes', id),
      cleanUndefinedValues(sanitizedUpdates)
    );
  }

  // Ingredient matching is handled server-side by the matchRecipeOnCreate Cloud Function
  // which fires automatically on recipe creation. matchingStatus: 'pending' signals the UI.
  onProgress?.({ stage: 'Recipe saved', percentage: 100 });
  return { ...newRecipe, categoryIds: categoryIds.length > 0 ? categoryIds : undefined } as Recipe;
}

// ==================== UPDATE ====================

export async function updateRecipeInStore(
  id: string,
  updates: UpdateRecipeInput,
  imageData?: string,
  onProgress?: (progress: RecipeSaveProgress) => void
): Promise<Recipe> {
  onProgress?.({ stage: 'Loading existing recipe', percentage: 5 });
  const existing = await fetchRecipeById(id);
  if (!existing) throw new Error('Recipe not found');

  let imagePath = updates.imagePath ?? existing.imagePath;
  if (imageData) {
    onProgress?.({ stage: 'Uploading image', percentage: 15 });
    imagePath = `recipes/${id}/image-${Date.now()}.jpg`;
    debugLogger.info('Recipe Update', `Uploading new image to: ${imagePath}`);
    await uploadRecipeImage(imagePath, imageData);
  }

  onProgress?.({ stage: 'Validating changes', percentage: 20 });
  const normalizedUpdates = normalizeRecipeData({ ...existing, ...updates });
  const updated = { ...existing, ...normalizedUpdates, imagePath };

  onProgress?.({ stage: 'Saving changes', percentage: 35 });
  const sanitizedUpdated = sanitizeRecipeEmbeddingsForStorage(updated);
  await setDoc(
    doc(db, 'recipes', id),
    cleanUndefinedValues(encodeRecipeForFirestore(sanitizedUpdated))
  );

  const postProcessUpdates: any = {};

  if (!Object.prototype.hasOwnProperty.call(updates, 'categoryIds')) {
    onProgress?.({ stage: 'Categorising recipe', percentage: 50 });
    const categoryIds = await categorizeRecipe(updated as Recipe);
    if (categoryIds.length > 0) {
      postProcessUpdates.categoryIds = categoryIds;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, 'ingredients') &&
    Array.isArray(updated.ingredients) &&
    updated.ingredients.length > 0
  ) {
    const updatedIngredients = updated.ingredients as any[];
    const oldIngredients = existing.ingredients || [];

    const oldIngMap = new Map(
      oldIngredients.map((ing: any) => [ing.raw, ing])
    );

    const toRematch: string[] = [];
    const toSkip: RecipeIngredient[] = [];

    for (const newIng of updatedIngredients) {
      const raw = typeof newIng === 'string' ? newIng : newIng.raw;
      const oldIng = oldIngMap.get(raw);

      if (typeof newIng === 'string') {
        const decision = shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
        if (decision === 'rematch') {
          toRematch.push(raw);
        } else if (oldIng) {
          toSkip.push(oldIng);
        } else {
          toRematch.push(raw);
        }
      } else {
        const decision = shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
        if (decision === 'skip') {
          toSkip.push(newIng as RecipeIngredient);
        } else {
          toRematch.push(raw);
        }
      }
    }

    debugLogger.info(
      'Recipe Update',
      `Ingredient processing decisions: ${toRematch.length} rematch, ${toSkip.length} skip`
    );

    let rematched: RecipeIngredient[] = [];
    if (toRematch.length > 0) {
      onProgress?.({ stage: 'Matching ingredients', percentage: 60 });
      rematched = await matchIngredients(
        toRematch,
        id,
        onProgress
          ? (progress) => {
              const ingredientWeight = 30;
              const base = 60;
              const mapped =
                base + Math.round((progress.percentage / 100) * ingredientWeight);
              onProgress({
                stage: 'Matching ingredients',
                current: progress.current,
                total: progress.total,
                percentage: mapped,
              });
            }
          : undefined
      );
    }

    const finalIngredients: RecipeIngredient[] = [];
    let rematchIndex = 0;
    let skipIndex = 0;

    for (const newIng of updatedIngredients) {
      const raw = typeof newIng === 'string' ? newIng : newIng.raw;
      const oldIng = oldIngMap.get(raw);

      if (typeof newIng === 'string') {
        const decision = shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
        if (decision === 'rematch') {
          finalIngredients.push(rematched[rematchIndex++]);
        } else if (oldIng) {
          finalIngredients.push(toSkip[skipIndex++]);
        } else {
          finalIngredients.push(rematched[rematchIndex++]);
        }
      } else {
        const decision = shouldRematchIngredient({ oldIngredient: oldIng, newRaw: raw });
        if (decision === 'skip') {
          finalIngredients.push(toSkip[skipIndex++]);
        } else {
          finalIngredients.push(rematched[rematchIndex++]);
        }
      }
    }

    postProcessUpdates.ingredients = finalIngredients;

    const ingredientMap = new Map(
      finalIngredients.map((ing: any) => [ing.id, ing])
    );
    if (Array.isArray(updated.instructions)) {
      postProcessUpdates.instructions = (updated.instructions as any[]).map(
        (instr: any) => {
          if (instr.ingredients && Array.isArray(instr.ingredients)) {
            return {
              ...instr,
              ingredients: instr.ingredients
                .map((ing: any) => ingredientMap.get(ing.id) || ing)
                .filter((ing: any) => ing !== undefined),
            };
          }
          return instr;
        }
      );
    }
  }

  if (Object.keys(postProcessUpdates).length > 0) {
    onProgress?.({ stage: 'Finalising recipe', percentage: 95 });
    const sanitizedUpdates = sanitizeRecipeEmbeddingsForStorage(postProcessUpdates);
    await updateDoc(
      doc(db, 'recipes', id),
      cleanUndefinedValues(sanitizedUpdates)
    );
    onProgress?.({ stage: 'Recipe updated', percentage: 100 });
    return { ...updated, ...postProcessUpdates } as Recipe;
  }

  onProgress?.({ stage: 'Recipe updated', percentage: 100 });
  return updated as Recipe;
}

// ==================== DELETE ====================

export async function deleteRecipeFromStore(id: string): Promise<void> {
  const cookGuides = await getCookGuidesForRecipe(id);
  for (const guide of cookGuides) {
    await deleteCookGuide(guide.id);
  }
  await deleteDoc(doc(db, 'recipes', id));
}

// ==================== RESOLVE IMAGE ====================

export async function resolveRecipeImagePath(path: string): Promise<string> {
  return resolveStorageImagePath(path);
}

// ==================== REPAIR ====================

export async function repairStoredRecipe(
  recipeId: string,
  options: RepairRecipeOptions
): Promise<Recipe> {
  const recipe = await fetchRecipeById(recipeId);
  if (!recipe) throw new Error(`Recipe not found: ${recipeId}`);

  if (options.categorize) {
    const categoryIds = await categorizeRecipe(recipe);
    if (categoryIds.length > 0) {
      await updateRecipeInStore(recipeId, { categoryIds });
    }
  }

  if (options.relinkIngredients) {
    // Delegate ingredient matching to the server-side CF (avoids 57s client-side run)
    const relink = httpsCallable<{ recipeId: string }, { success: boolean; message?: string }>(
      functions,
      'relinkRecipeIngredients'
    );
    const result = await relink({ recipeId });
    if (!result.data.success) {
      throw new Error(result.data.message ?? 'Relinking failed');
    }
  }

  // Return the latest state from Firestore (CF may have updated ingredients)
  return (await fetchRecipeById(recipeId)) ?? recipe;
}
