/**
 * Merge Provider
 *
 * Impact queries and execute functions for merging Canon Items and Aisles.
 * Called from api.ts only — never imported directly from UI.
 *
 * Merge rules:
 * - Primary record keeps its UUID; secondary is deleted after all FKs are migrated.
 * - Canon Items: updates all recipe ingredient references + shopping list items.
 * - Aisles: updates canonItems, cofid_group_aisle_mappings, canonEmbeddingLookup.
 * - Shopping list collision (both items on same list) → blocked, caller must handle.
 * - Synonyms are unioned from both items.
 * - externalSources: primary's are kept only (secondary's dropped).
 */

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  where,
  query,
} from 'firebase/firestore';
import { db } from '../../../shared/backend/firebase';
import { CanonItem } from '../logic/items';
import { UNCATEGORISED_AISLE_ID } from '../logic/aisles';
import {
  patchIngredientArray,
  patchInstructionArray,
  mergeItemSynonyms,
  isValidAisleMerge,
} from '../logic/merge';
import { deleteCanonItem, deleteCanonAisle, updateCanonItem } from './firebase-provider';
import { upsertCanonItemEmbeddingById } from './embeddings-provider';

// ── Collection constants ───────────────────────────────────────────────────────

const CANON_ITEMS_COLLECTION = 'canonItems';
const CANON_AISLES_COLLECTION = 'canonAisles';
const COFID_MAPPINGS_COLLECTION = 'cofid_group_aisle_mappings';
const EMBEDDING_LOOKUP_COLLECTION = 'canonEmbeddingLookup';
const RECIPES_COLLECTION = 'recipes';
const SHOPPING_LIST_ITEMS_COLLECTION = 'shoppingListItems';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CanonItemMergeImpact {
  a: { recipeIngredientCount: number; shoppingListCount: number };
  b: { recipeIngredientCount: number; shoppingListCount: number };
  collidingShoppingListIds: string[];
}

export interface AisleMergeImpact {
  a: { canonItemCount: number };
  b: { canonItemCount: number };
}

// ── Impact queries ─────────────────────────────────────────────────────────────

/**
 * Count recipe ingredients and shopping list items linked to each of two canon items.
 * Also detects shopping list collisions (both items appear on the same list).
 */
export async function getCanonItemMergeImpact(
  idA: string,
  idB: string
): Promise<CanonItemMergeImpact> {
  const [recipesSnap, shoppingSnap] = await Promise.all([
    getDocs(collection(db, RECIPES_COLLECTION)),
    getDocs(collection(db, SHOPPING_LIST_ITEMS_COLLECTION)),
  ]);

  let aRecipeCount = 0;
  let bRecipeCount = 0;

  for (const recipeDoc of recipesSnap.docs) {
    const data = recipeDoc.data();

    // Count in top-level ingredients array
    const ingredients: any[] = data.ingredients ?? [];
    for (const ing of ingredients) {
      if (ing.canonicalItemId === idA) aRecipeCount++;
      if (ing.canonicalItemId === idB) bRecipeCount++;
    }

    // Count in instructions[].ingredients
    const instructions: any[] = data.instructions ?? [];
    for (const step of instructions) {
      const stepIngredients: any[] = step.ingredients ?? [];
      for (const ing of stepIngredients) {
        if (ing.canonicalItemId === idA) aRecipeCount++;
        if (ing.canonicalItemId === idB) bRecipeCount++;
      }
    }
  }

  // Shopping list items
  const aListIds = new Set<string>();
  const bListIds = new Set<string>();

  let aShoppingCount = 0;
  let bShoppingCount = 0;

  for (const itemDoc of shoppingSnap.docs) {
    const data = itemDoc.data();
    if (data.canonicalItemId === idA) {
      aShoppingCount++;
      if (data.shoppingListId) aListIds.add(data.shoppingListId);
    }
    if (data.canonicalItemId === idB) {
      bShoppingCount++;
      if (data.shoppingListId) bListIds.add(data.shoppingListId);
    }
  }

  const collidingShoppingListIds = [...aListIds].filter(id => bListIds.has(id));

  return {
    a: { recipeIngredientCount: aRecipeCount, shoppingListCount: aShoppingCount },
    b: { recipeIngredientCount: bRecipeCount, shoppingListCount: bShoppingCount },
    collidingShoppingListIds,
  };
}

/**
 * Count canon items in each of two aisles.
 */
export async function getAisleMergeImpact(
  idA: string,
  idB: string
): Promise<AisleMergeImpact> {
  const snap = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  let aCount = 0;
  let bCount = 0;
  for (const d of snap.docs) {
    const aisleId = d.data().aisleId;
    if (aisleId === idA) aCount++;
    if (aisleId === idB) bCount++;
  }
  return { a: { canonItemCount: aCount }, b: { canonItemCount: bCount } };
}

// ── Execute functions ──────────────────────────────────────────────────────────

export interface CanonItemMergeUpdates {
  name: string;
  aisleId: string;
  preferredUnitId: string;
  synonyms?: string[];
}

/**
 * Merge two canon items.
 *
 * - Updates primary item with the provided field values and merged synonyms.
 * - Re-points all recipe ingredient and shopping list references from secondary → primary.
 * - Deletes secondary item (cascade removes its embedding).
 * - Regenerates primary's embedding if name changed.
 *
 * Caller must have already verified no shopping list collision exists.
 */
export async function mergeCanonItems(
  primary: CanonItem,
  secondary: CanonItem,
  updates: CanonItemMergeUpdates
): Promise<void> {
  const primaryId = primary.id;
  const secondaryId = secondary.id;

  // 1. Update primary item — keep primary's externalSources only
  const mergedSynonyms = mergeItemSynonyms(
    updates.synonyms ?? [],
    []  // caller already unions both items' synonyms before passing updates
  );

  await updateCanonItem(primaryId, {
    name: updates.name,
    aisleId: updates.aisleId,
    preferredUnitId: updates.preferredUnitId,
  });

  // Write synonyms + externalSources directly since updateCanonItem only takes a subset of fields
  const primaryRef = doc(db, CANON_ITEMS_COLLECTION, primaryId);
  await updateDoc(primaryRef, {
    synonyms: mergedSynonyms,
    // externalSources: keep primary's as-is (already there) — no change needed
    updatedAt: new Date().toISOString(),
  });

  // 2. Regenerate embedding if name changed
  if (updates.name !== primary.name) {
    await upsertCanonItemEmbeddingById(primaryId).catch(err =>
      console.warn('[mergeCanonItems] Embedding regeneration failed (non-blocking):', err)
    );
  }

  // 3. Re-point recipe ingredient references
  const recipesSnap = await getDocs(collection(db, RECIPES_COLLECTION));
  const BATCH_SIZE = 499;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const recipeDoc of recipesSnap.docs) {
    const data = recipeDoc.data();
    let changed = false;

    const ingResult = patchIngredientArray(data.ingredients ?? [], secondaryId, primaryId);
    const stepResult = patchInstructionArray(data.instructions ?? [], secondaryId, primaryId);
    changed = ingResult.changed || stepResult.changed;

    if (changed) {
      const newIngredients = ingResult.patched;
      const newInstructions = stepResult.patched;
      batch.update(recipeDoc.ref, {
        ingredients: newIngredients,
        instructions: newInstructions,
      });
      batchCount++;
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) await batch.commit();

  // 4. Re-point shopping list items
  const shoppingSnap = await getDocs(
    query(
      collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
      where('canonicalItemId', '==', secondaryId)
    )
  );

  if (shoppingSnap.docs.length > 0) {
    let shBatch = writeBatch(db);
    let shCount = 0;
    for (const itemDoc of shoppingSnap.docs) {
      shBatch.update(itemDoc.ref, { canonicalItemId: primaryId });
      shCount++;
      if (shCount >= BATCH_SIZE) {
        await shBatch.commit();
        shBatch = writeBatch(db);
        shCount = 0;
      }
    }
    if (shCount > 0) await shBatch.commit();
  }

  // 5. Delete secondary (cascade removes embedding)
  await deleteCanonItem(secondaryId);
}

export interface AisleMergeUpdates {
  name: string;
  sortOrder: number;
}

/**
 * Merge two aisles.
 *
 * - Updates primary aisle with the provided field values.
 * - Re-points canonItems, cofid_group_aisle_mappings, and canonEmbeddingLookup
 *   from secondary → primary.
 * - Deletes secondary aisle.
 *
 * Caller must ensure secondary is not the uncategorised system aisle.
 */
export async function mergeCanonAisles(
  primaryId: string,
  secondaryId: string,
  updates: AisleMergeUpdates
): Promise<void> {
  if (!isValidAisleMerge(primaryId, secondaryId)) {
    throw new Error('Cannot merge: the uncategorised aisle cannot be deleted');
  }

  // 1. Update primary aisle
  const primaryRef = doc(db, CANON_AISLES_COLLECTION, primaryId);
  await updateDoc(primaryRef, {
    name: updates.name,
    sortOrder: updates.sortOrder,
    updatedAt: new Date().toISOString(),
  });

  const BATCH_SIZE = 499;

  // Helper: batch-update a collection where field === secondaryId
  async function migrateAisleId(collectionName: string, field: string) {
    const snap = await getDocs(
      query(collection(db, collectionName), where(field, '==', secondaryId))
    );
    if (snap.docs.length === 0) return;

    let batch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
      batch.update(d.ref, { [field]: primaryId });
      count++;
      if (count >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }

  // 2. Migrate canon items
  await migrateAisleId(CANON_ITEMS_COLLECTION, 'aisleId');

  // 3. Migrate CoFID group mappings
  await migrateAisleId(COFID_MAPPINGS_COLLECTION, 'aisleId');

  // 4. Migrate embedding lookup entries
  await migrateAisleId(EMBEDDING_LOOKUP_COLLECTION, 'aisleId');

  // 5. Delete secondary aisle (all references now gone so the guard passes)
  await deleteCanonAisle(secondaryId);
}
