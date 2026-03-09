/**
 * Shopping list items data provider.
 *
 * Owns all Firestore I/O for shoppingListItems.
 * Items are stored flat in a top-level collection (not a sub-collection)
 * for efficient querying across lists.
 *
 * Key design:
 * - One doc per canonical item per list (canonicalItemId is the dedup key)
 * - Unmatched manual items have no canonicalItemId
 * - contributions[] is the embedded source array
 * - totalBaseQty is stored and kept in sync at write time
 * - All multi-step writes use Firestore transactions
 */

import { db, auth } from '../../../shared/backend/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import type { ShoppingListItem } from '../../../types/contract';
import type { ShoppingListContribution } from '../types';
import { sumContributions } from '../logic/aggregation';

/** Strip undefined values — Firestore rejects them in set/update calls. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getItemsForList(listId: string): Promise<ShoppingListItem[]> {
  const snapshot = await getDocs(
    query(collection(db, 'shoppingListItems'), where('shoppingListId', '==', listId))
  );
  const items: ShoppingListItem[] = [];
  snapshot.forEach((docSnap) => {
    items.push({ ...docSnap.data(), id: docSnap.id } as ShoppingListItem);
  });
  return items;
}

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Add a contribution to a canonical item's shopping list entry.
 * Creates the item if it doesn't exist yet.
 * Uses a transaction so contributions[] and totalBaseQty stay consistent.
 */
export async function upsertCanonItem(
  listId: string,
  canonicalItemId: string,
  contribution: ShoppingListContribution,
  canonMeta: { name: string; aisle?: string },
  isStaple: boolean
): Promise<void> {
  // Find existing item for this canonical item in this list
  const snapshot = await getDocs(
    query(
      collection(db, 'shoppingListItems'),
      where('shoppingListId', '==', listId),
      where('canonicalItemId', '==', canonicalItemId)
    )
  );

  const existingDoc = snapshot.empty ? null : snapshot.docs[0];
  const itemId = existingDoc ? existingDoc.id : uuidv4();
  const itemRef = doc(db, 'shoppingListItems', itemId);

  await runTransaction(db, async (tx) => {
    const current = await tx.get(itemRef);

    if (current.exists()) {
      const data = current.data() as ShoppingListItem;
      const updatedContributions = [...data.contributions, contribution];
      const { totalBaseQty, baseUnit } = sumContributions(updatedContributions);
      tx.update(itemRef, stripUndefined({
        contributions: updatedContributions,
        totalBaseQty: totalBaseQty || null,
        baseUnit: baseUnit || null,
        updatedAt: new Date().toISOString(),
      }));
    } else {
      const { totalBaseQty, baseUnit } = sumContributions([contribution]);
      const newItem = stripUndefined({
        id: itemId,
        shoppingListId: listId,
        canonicalItemId,
        name: canonMeta.name,
        aisle: canonMeta.aisle ?? null,
        totalBaseQty: totalBaseQty || null,
        baseUnit: baseUnit || null,
        contributions: [contribution],
        status: isStaple ? 'needs_review' : 'active',
        checked: false,
        updatedAt: new Date().toISOString(),
      });
      tx.set(itemRef, newItem);
    }
  });
}

/**
 * Create a discrete unmatched manual item (no canonicalItemId).
 * These are never aggregated — one doc per manual entry.
 */
export async function createUnmatchedItem(
  listId: string,
  contribution: ShoppingListContribution,
  name: string
): Promise<string> {
  const itemId = uuidv4();
  const newItem: ShoppingListItem = {
    id: itemId,
    shoppingListId: listId,
    name,
    contributions: [contribution],
    status: 'active',
    checked: false,
    addedBy: auth.currentUser?.uid,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'shoppingListItems', itemId), newItem);
  return itemId;
}

/**
 * Remove all contributions from a specific recipe.
 * Recalculates totalBaseQty. Deletes the doc if contributions become empty.
 */
export async function removeRecipeContributions(
  listId: string,
  recipeId: string
): Promise<void> {
  const snapshot = await getDocs(
    query(collection(db, 'shoppingListItems'), where('shoppingListId', '==', listId))
  );

  const batch = writeBatch(db);

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as ShoppingListItem;
    const hasRecipeContributions = data.contributions.some(
      (c) => c.sourceType === 'recipe' && c.recipeId === recipeId
    );
    if (!hasRecipeContributions) return;

    const remaining = data.contributions.filter(
      (c) => !(c.sourceType === 'recipe' && c.recipeId === recipeId)
    );

    if (remaining.length === 0) {
      batch.delete(docSnap.ref);
    } else {
      const { totalBaseQty, baseUnit } = sumContributions(remaining);
      batch.update(docSnap.ref, stripUndefined({
        contributions: remaining,
        totalBaseQty: totalBaseQty || null,
        baseUnit: baseUnit || null,
        updatedAt: new Date().toISOString(),
      }));
    }
  });

  await batch.commit();
}

// ── Status & state updates ─────────────────────────────────────────────────────

export async function updateItemChecked(
  itemId: string,
  checked: boolean
): Promise<void> {
  const itemRef = doc(db, 'shoppingListItems', itemId);
  await setDoc(
    itemRef,
    {
      checked,
      checkedAt: checked ? new Date().toISOString() : null,
      checkedBy: checked ? (auth.currentUser?.uid ?? null) : null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function updateItemStatus(
  itemId: string,
  status: 'needs_review' | 'active'
): Promise<void> {
  const itemRef = doc(db, 'shoppingListItems', itemId);
  await setDoc(itemRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function updateItemNote(itemId: string, note: string): Promise<void> {
  const itemRef = doc(db, 'shoppingListItems', itemId);
  await setDoc(itemRef, { note, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function deleteItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'shoppingListItems', itemId));
}

export async function clearCheckedItems(listId: string): Promise<void> {
  const snapshot = await getDocs(
    query(
      collection(db, 'shoppingListItems'),
      where('shoppingListId', '==', listId),
      where('checked', '==', true)
    )
  );
  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

/**
 * Link an existing unmatched item to a canonical item.
 * Used after async canon matching resolves for a manual entry.
 */
export async function linkItemToCanonItem(
  listId: string,
  itemId: string,
  canonicalItemId: string,
  canonMeta: { name: string; aisle?: string }
): Promise<void> {
  const itemRef = doc(db, 'shoppingListItems', itemId);

  await runTransaction(db, async (tx) => {
    const current = await tx.get(itemRef);
    if (!current.exists()) return;

    const data = current.data() as ShoppingListItem;

    // Check if there's already an active item for this canon in this list
    const existingSnapshot = await getDocs(
      query(
        collection(db, 'shoppingListItems'),
        where('shoppingListId', '==', listId),
        where('canonicalItemId', '==', canonicalItemId)
      )
    );

    if (!existingSnapshot.empty) {
      // Merge contributions into the existing canon item and delete this one
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data() as ShoppingListItem;
      const merged = [...existingData.contributions, ...data.contributions];
      const { totalBaseQty, baseUnit } = sumContributions(merged);
      tx.update(existingDoc.ref, stripUndefined({
        contributions: merged,
        totalBaseQty: totalBaseQty || null,
        baseUnit: baseUnit || null,
        updatedAt: new Date().toISOString(),
      }));
      tx.delete(itemRef);
    } else {
      // Upgrade this item to a canon-linked item in place
      const { totalBaseQty, baseUnit } = sumContributions(data.contributions);
      tx.update(itemRef, stripUndefined({
        canonicalItemId,
        name: canonMeta.name,
        aisle: canonMeta.aisle ?? null,
        totalBaseQty: totalBaseQty || null,
        baseUnit: baseUnit || null,
        updatedAt: new Date().toISOString(),
      }));
    }
  });
}
