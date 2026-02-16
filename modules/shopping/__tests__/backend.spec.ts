import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseShoppingBackend } from '../backend/base-shopping-backend';
import type { ShoppingBackendInterface } from '../backend/shopping-backend.interface';
import type { ShoppingList, ShoppingItem } from '../../../types/contract';

/**
 * Shopping Backend Tests
 * Tests the base shopping backend interface and implementations
 */

describe('Shopping Backend - List Management', () => {
  let backend: ShoppingBackendInterface;

  beforeEach(() => {
    backend = new BaseShoppingBackend();
  });

  it('should create a new shopping list', async () => {
    const list = await backend.createList('Weekly Groceries', { userId: 'user-1' });
    
    expect(list).toBeDefined();
    expect(list.name).toBe('Weekly Groceries');
    expect(list.items).toHaveLength(0);
  });

  it('should retrieve an existing list', async () => {
    const created = await backend.createList('Test List', { userId: 'user-1' });
    const retrieved = await backend.getList(created.id);
    
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.name).toBe('Test List');
  });

  it('should update list metadata', async () => {
    const list = await backend.createList('Original Name', { userId: 'user-1' });
    
    const updated = await backend.updateList(list.id, {
      name: 'Updated Name',
    });
    
    expect(updated.name).toBe('Updated Name');
  });

  it('should delete a list', async () => {
    const list = await backend.createList('To Delete', { userId: 'user-1' });
    await backend.deleteList(list.id);
    
    // Attempt to retrieve should fail or return undefined
    const retrieved = await backend.getList(list.id).catch(() => null);
    expect(retrieved).toBeNull();
  });

  it('should list all user shopping lists', async () => {
    await backend.createList('List 1', { userId: 'user-1' });
    await backend.createList('List 2', { userId: 'user-1' });
    
    const lists = await backend.getUserLists('user-1');
    
    expect(lists.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Shopping Backend - Item Management', () => {
  let backend: ShoppingBackendInterface;
  let testList: ShoppingList;

  beforeEach(async () => {
    backend = new BaseShoppingBackend();
    testList = await backend.createList('Test List', { userId: 'user-1' });
  });

  it('should add item to shopping list', async () => {
    const item = await backend.addItem(testList.id, {
      canonicalItemId: 'item-1',
      quantity: 500,
      unit: 'g',
    });
    
    expect(item).toBeDefined();
    expect(item.canonicalItemId).toBe('item-1');
    expect(item.quantity).toBe(500);
    expect(item.unit).toBe('g');
  });

  it('should update item in list', async () => {
    const item = await backend.addItem(testList.id, {
      canonicalItemId: 'item-1',
      quantity: 500,
      unit: 'g',
    });

    const updated = await backend.updateItem(testList.id, item.id, {
      quantity: 1000,
      unit: 'g',
    });
    
    expect(updated.quantity).toBe(1000);
  });

  it('should remove item from list', async () => {
    const item = await backend.addItem(testList.id, {
      canonicalItemId: 'item-1',
      quantity: 500,
      unit: 'g',
    });

    await backend.removeItem(testList.id, item.id);
    
    const updated = await backend.getList(testList.id);
    expect(updated.items).not.toContainEqual(item);
  });

  it('should mark item as checked', async () => {
    const item = await backend.addItem(testList.id, {
      canonicalItemId: 'item-1',
      quantity: 500,
      unit: 'g',
    });

    const checked = await backend.toggleItemChecked(testList.id, item.id, true);
    
    expect(checked.isChecked).toBe(true);
  });

  it('should handle item notes', async () => {
    const item = await backend.addItem(testList.id, {
      canonicalItemId: 'item-1',
      quantity: 500,
      unit: 'g',
    });

    const withNote = await backend.updateItem(testList.id, item.id, {
      notes: 'Organic preferred',
    });
    
    expect(withNote.notes).toBe('Organic preferred');
  });
});

describe('Shopping Backend - Integration', () => {
  let backend: ShoppingBackendInterface;

  beforeEach(() => {
    backend = new BaseShoppingBackend();
  });

  it('should handle complete shopping workflow', async () => {
    // Create list
    const list = await backend.createList('Weekly Shop', { userId: 'user-1' });
    expect(list.id).toBeDefined();

    // Add multiple items
    const item1 = await backend.addItem(list.id, {
      canonicalItemId: 'tomato',
      quantity: 4,
      unit: 'piece',
    });
    const item2 = await backend.addItem(list.id, {
      canonicalItemId: 'olive-oil',
      quantity: 500,
      unit: 'ml',
    });

    // Check one item
    await backend.toggleItemChecked(list.id, item1.id, true);

    // Retrieve and verify
    const updated = await backend.getList(list.id);
    expect(updated.items).toHaveLength(2);
    
    const checkedItem = updated.items.find(i => i.id === item1.id);
    expect(checkedItem?.isChecked).toBe(true);

    const uncheckedItem = updated.items.find(i => i.id === item2.id);
    expect(uncheckedItem?.isChecked).toBe(false);
  });

  it('should handle multi-unit items', async () => {
    const list = await backend.createList('Test', { userId: 'user-1' });

    // Add same item in different units
    const grams = await backend.addItem(list.id, {
      canonicalItemId: 'flour',
      quantity: 500,
      unit: 'g',
    });

    const kilos = await backend.addItem(list.id, {
      canonicalItemId: 'flour',
      quantity: 1,
      unit: 'kg',
    });

    const retrieved = await backend.getList(list.id);
    const flours = retrieved.items.filter(i => i.canonicalItemId === 'flour');
    
    expect(flours).toHaveLength(2);
    expect(flours.some(f => f.unit === 'g')).toBe(true);
    expect(flours.some(f => f.unit === 'kg')).toBe(true);
  });
});

describe('Shopping Backend - Error Handling', () => {
  let backend: ShoppingBackendInterface;

  beforeEach(() => {
    backend = new BaseShoppingBackend();
  });

  it('should handle invalid list ID', async () => {
    expect(async () => {
      await backend.getList('invalid-id');
    }).rejects.toThrow();
  });

  it('should require canonical item ID', async () => {
    const list = await backend.createList('Test', { userId: 'user-1' });

    expect(async () => {
      await backend.addItem(list.id, {
        canonicalItemId: '',
        quantity: 100,
        unit: 'g',
      });
    }).rejects.toThrow();
  });

  it('should validate quantity is positive', async () => {
    const list = await backend.createList('Test', { userId: 'user-1' });

    expect(async () => {
      await backend.addItem(list.id, {
        canonicalItemId: 'item-1',
        quantity: 0,
        unit: 'g',
      });
    }).rejects.toThrow();
  });
});
