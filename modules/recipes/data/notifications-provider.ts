/**
 * Cross-module notification hooks provider.
 *
 * Handles canon item deletion notifications by unlinking canonical item IDs
 * from all affected recipe ingredients.
 */

import { db } from '../../../shared/backend/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import {
  convertTimestamps,
  decodeRecipeFromFirestore,
  encodeRecipeForFirestore,
  cleanUndefinedValues,
  sanitizeRecipeEmbeddingsForStorage,
} from './firestore-utils';
import type { Recipe } from '../../../types/contract';

export async function notifyCanonItemsDeleted(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const idsSet = new Set(ids);
  const recipesSnap = await getDocs(collection(db, 'recipes'));

  let batch = writeBatch(db);
  let batchCount = 0;

  for (const recipeDoc of recipesSnap.docs) {
    const rawData = decodeRecipeFromFirestore(
      convertTimestamps(recipeDoc.data())
    );
    const recipe = rawData as Recipe;

    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      continue;
    }

    let ingredientsChanged = false;
    const updatedIngredients = recipe.ingredients.map((ing: any) => {
      if (ing && ing.canonicalItemId && idsSet.has(ing.canonicalItemId)) {
        ingredientsChanged = true;
        const { canonicalItemId, ...rest } = ing;
        void canonicalItemId;
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
              void canonicalItemId;
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

    if (!ingredientsChanged && !instructionsChanged) continue;

    const updates: any = {};
    if (ingredientsChanged) updates.ingredients = updatedIngredients;
    if (instructionsChanged) updates.instructions = updatedInstructions;

    const sanitizedUpdates = sanitizeRecipeEmbeddingsForStorage(updates);
    const payload = encodeRecipeForFirestore(
      cleanUndefinedValues(sanitizedUpdates)
    );
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
