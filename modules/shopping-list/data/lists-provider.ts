/**
 * Shopping list data provider.
 *
 * Owns all Firestore I/O for the shoppingLists collection.
 */

import { db, auth } from '../../../shared/backend/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import type { ShoppingList } from '../../../types/contract';

const DEFAULT_LIST_ID = 'default-shopping-list';

export async function getShoppingLists(): Promise<ShoppingList[]> {
  const snapshot = await getDocs(
    query(collection(db, 'shoppingLists'), orderBy('createdAt', 'asc'))
  );
  const lists: ShoppingList[] = [];
  snapshot.forEach((docSnap) => {
    lists.push({ ...docSnap.data(), id: docSnap.id } as ShoppingList);
  });
  return lists;
}

export async function getDefaultShoppingList(): Promise<ShoppingList> {
  const docRef = doc(db, 'shoppingLists', DEFAULT_LIST_ID);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { ...docSnap.data(), id: docSnap.id } as ShoppingList;
  }

  const newList: ShoppingList = {
    id: DEFAULT_LIST_ID,
    name: 'Weekly Shop',
    isDefault: true,
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.uid ?? 'system',
  };
  await setDoc(docRef, newList);
  return newList;
}

export async function createShoppingList(name: string): Promise<ShoppingList> {
  const id = uuidv4();
  const newList: ShoppingList = {
    id,
    name,
    isDefault: false,
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.uid ?? 'system',
  };
  await setDoc(doc(db, 'shoppingLists', id), newList);
  return newList;
}
