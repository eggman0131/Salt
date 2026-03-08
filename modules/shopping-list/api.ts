import { db, auth } from '../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import type { ShoppingList, ShoppingListItem, Recipe } from '../../types/contract';
import { getRecipe } from '../recipes/api';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_LIST_ID = 'default-shopping-list';

export async function getDefaultShoppingList(): Promise<ShoppingList> {
  const docRef = doc(db, 'shoppingLists', DEFAULT_LIST_ID);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { ...docSnap.data(), id: docSnap.id } as ShoppingList;
  }

  // Create default list
  const newList: ShoppingList = {
    id: DEFAULT_LIST_ID,
    name: 'My Shopping List',
    recipeIds: [],
    isDefault: true,
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.uid || 'system',
  };

  await setDoc(docRef, newList);
  return newList;
}

export async function getShoppingListItems(listId: string): Promise<ShoppingListItem[]> {
  const itemsRef = collection(db, 'shoppingLists', listId, 'items');
  const snapshot = await getDocs(itemsRef);
  const items: ShoppingListItem[] = [];
  snapshot.forEach(docSnap => {
    items.push({ ...docSnap.data(), id: docSnap.id } as ShoppingListItem);
  });
  return items;
}

export async function addRecipeToShoppingList(recipeId: string, listId: string = DEFAULT_LIST_ID): Promise<void> {
  const list = await getDefaultShoppingList();
  const recipe = await getRecipe(recipeId);
  
  if (!recipe) throw new Error('Recipe not found');

  // Add recipe ID to the list's recipeIds if not present
  const updatedRecipeIds = list.recipeIds ? [...list.recipeIds] : [];
  if (!updatedRecipeIds.includes(recipeId)) {
    updatedRecipeIds.push(recipeId);
    await setDoc(doc(db, 'shoppingLists', listId), { ...list, recipeIds: updatedRecipeIds, updatedAt: new Date().toISOString() }, { merge: true });
  }

  const currentItems = await getShoppingListItems(listId);
  const batch = writeBatch(db);

  for (const ingredient of recipe.ingredients) {
    // Find matching item by canonicalId or name
    let matchingItem = currentItems.find(item => 
      (ingredient.canonicalItemId && item.canonicalItemId === ingredient.canonicalItemId) || 
      (!ingredient.canonicalItemId && item.name.toLowerCase() === ingredient.ingredientName.toLowerCase())
    );

    const quantityToAdd = ingredient.quantity || 1;
    const unit = ingredient.unit || 'whole';

    if (matchingItem) {
      // Update existing item
      const itemRef = doc(db, 'shoppingLists', listId, 'items', matchingItem.id);
      
      // If units don't match, we might want to convert or add as separate. For now, just add.
      // We assume matching items share the same basic concept.
      const newSourceRecipeIds = matchingItem.sourceRecipeIds ? [...matchingItem.sourceRecipeIds] : [];
      if (!newSourceRecipeIds.includes(recipeId)) {
        newSourceRecipeIds.push(recipeId);
      }
      
      const newSourceRecipeIngredientIds = matchingItem.sourceRecipeIngredientIds ? [...matchingItem.sourceRecipeIngredientIds] : [];
      if (!newSourceRecipeIngredientIds.includes(ingredient.id)) {
        newSourceRecipeIngredientIds.push(ingredient.id);
      }

      batch.update(itemRef, {
        recipeQuantity: (matchingItem.recipeQuantity || 0) + quantityToAdd,
        sourceRecipeIds: newSourceRecipeIds,
        sourceRecipeIngredientIds: newSourceRecipeIngredientIds,
      });
      
      matchingItem.recipeQuantity = (matchingItem.recipeQuantity || 0) + quantityToAdd;
      matchingItem.sourceRecipeIds = newSourceRecipeIds;
      matchingItem.sourceRecipeIngredientIds = newSourceRecipeIngredientIds;

    } else {
      // Create new item
      const newItemId = uuidv4();
      const itemRef = doc(db, 'shoppingLists', listId, 'items', newItemId);
      
      const newItem: ShoppingListItem = {
        id: newItemId,
        shoppingListId: listId,
        canonicalItemId: ingredient.canonicalItemId || '',
        name: ingredient.ingredientName,
        aisle: 'Uncategorized', // Default aisle, could lookup canon item later
        recipeQuantity: quantityToAdd,
        manualQuantity: 0,
        unit: unit,
        checked: false,
        isStaple: false,
        sourceRecipeIds: [recipeId],
        sourceRecipeIngredientIds: [ingredient.id],
      };
      
      batch.set(itemRef, newItem);
      currentItems.push(newItem);
    }
  }

  await batch.commit();
}

export async function removeRecipeFromShoppingList(recipeId: string, listId: string = DEFAULT_LIST_ID): Promise<void> {
  const list = await getDefaultShoppingList();
  const recipe = await getRecipe(recipeId);
  
  if (!recipe) return; // Silent return if recipe missing, or throw Error? Let's just return to allow cleanup

  // Remove recipe ID from list
  if (list.recipeIds && list.recipeIds.includes(recipeId)) {
    const updatedRecipeIds = list.recipeIds.filter(id => id !== recipeId);
    await setDoc(doc(db, 'shoppingLists', listId), { ...list, recipeIds: updatedRecipeIds, updatedAt: new Date().toISOString() }, { merge: true });
  }

  const currentItems = await getShoppingListItems(listId);
  const batch = writeBatch(db);

  for (const item of currentItems) {
    // Check if this item came from this recipe
    if (item.sourceRecipeIds && item.sourceRecipeIds.includes(recipeId)) {
      const itemRef = doc(db, 'shoppingLists', listId, 'items', item.id);
      
      // Calculate how much quantity to remove
      // We need to find the specific ingredients from this recipe
      const matchingIngredients = recipe.ingredients.filter(ing => 
        (item.sourceRecipeIngredientIds && item.sourceRecipeIngredientIds.includes(ing.id)) ||
        (ing.canonicalItemId && ing.canonicalItemId === item.canonicalItemId) ||
        (!ing.canonicalItemId && ing.ingredientName.toLowerCase() === item.name.toLowerCase())
      );

      const quantityToRemove = matchingIngredients.reduce((sum, ing) => sum + (ing.quantity || 1), 0);
      
      const newRecipeQuantity = Math.max(0, (item.recipeQuantity || 0) - quantityToRemove);
      const newSourceRecipeIds = item.sourceRecipeIds.filter(id => id !== recipeId);
      const newSourceRecipeIngredientIds = (item.sourceRecipeIngredientIds || []).filter(
        id => !matchingIngredients.some(ing => ing.id === id)
      );

      // If both recipeQuantity and manualQuantity hit 0, delete the item, unless it's a staple
      if (newRecipeQuantity === 0 && (item.manualQuantity || 0) === 0 && !item.isStaple) {
        batch.delete(itemRef);
      } else {
        batch.update(itemRef, {
          recipeQuantity: newRecipeQuantity,
          sourceRecipeIds: newSourceRecipeIds,
          sourceRecipeIngredientIds: newSourceRecipeIngredientIds,
        });
      }
    }
  }

  await batch.commit();
}

export async function addMultipleRecipesToShoppingList(recipeIds: string[], listId: string = DEFAULT_LIST_ID): Promise<void> {
  // Simple sequential approach to avoid batch collision complexity
  for (const id of recipeIds) {
    await addRecipeToShoppingList(id, listId);
  }
}

export async function updateManualQuantity(itemId: string, newManualQuantity: number, listId: string = DEFAULT_LIST_ID): Promise<void> {
  const itemRef = doc(db, 'shoppingLists', listId, 'items', itemId);
  const itemSnap = await getDoc(itemRef);
  
  if (itemSnap.exists()) {
    const data = itemSnap.data() as ShoppingListItem;
    if (newManualQuantity === 0 && (data.recipeQuantity || 0) === 0 && !data.isStaple) {
      await deleteDoc(itemRef);
    } else {
      await setDoc(itemRef, { manualQuantity: newManualQuantity }, { merge: true });
    }
  }
}

export async function toggleItemChecked(itemId: string, checked: boolean, listId: string = DEFAULT_LIST_ID): Promise<void> {
  const itemRef = doc(db, 'shoppingLists', listId, 'items', itemId);
  await setDoc(itemRef, { checked }, { merge: true });
}

export async function createManualItem(name: string, aisle: string, listId: string = DEFAULT_LIST_ID): Promise<void> {
  const newItemId = uuidv4();
  const itemRef = doc(db, 'shoppingLists', listId, 'items', newItemId);
  
  const newItem: ShoppingListItem = {
    id: newItemId,
    shoppingListId: listId,
    canonicalItemId: '',
    name: name,
    aisle: aisle,
    recipeQuantity: 0,
    manualQuantity: 1, // Start with 1 when manually added
    unit: 'whole',
    checked: false,
    isStaple: false,
    sourceRecipeIds: [],
    sourceRecipeIngredientIds: [],
  };
  
  await setDoc(itemRef, newItem);
}
