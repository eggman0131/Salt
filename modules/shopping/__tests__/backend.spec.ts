import { describe, it, expect, beforeEach } from 'vitest';
import type { IShoppingBackend } from '../backend/shopping-backend.interface';
import type { RecipeIngredient, ShoppingList, ShoppingListItem } from '../../../types/contract';

/**
 * Shopping Backend Tests
 * Tests the shopping backend interface and implementations
 */

type ShoppingListInput = Omit<ShoppingList, 'id' | 'createdAt' | 'createdBy'>;
type ShoppingListItemInput = Omit<ShoppingListItem, 'id'>;

const buildListInput = (overrides: Partial<ShoppingListInput> = {}): ShoppingListInput => ({
  name: 'Weekly Groceries',
  recipeIds: [],
  isDefault: false,
  ...overrides,
});

class InMemoryShoppingBackend implements IShoppingBackend {
  private lists = new Map<string, ShoppingList>();
  private items = new Map<string, ShoppingListItem>();
  private itemsByList = new Map<string, Set<string>>();
  private defaultListId: string | null = null;

  async getShoppingLists(): Promise<ShoppingList[]> {
    return Array.from(this.lists.values());
  }

  async getShoppingList(id: string): Promise<ShoppingList | null> {
    return this.lists.get(id) ?? null;
  }

  async getDefaultShoppingList(): Promise<ShoppingList> {
    if (this.defaultListId) {
      const existing = this.lists.get(this.defaultListId);
      if (existing) {
        return existing;
      }
    }

    const created = await this.createShoppingList({
      name: 'Default List',
      recipeIds: [],
      isDefault: true,
    });
    return created;
  }

  async setDefaultShoppingList(id: string): Promise<void> {
    if (!this.lists.has(id)) {
      throw new Error('Shopping list not found');
    }
    this.defaultListId = id;
  }

  async createShoppingList(list: ShoppingListInput): Promise<ShoppingList> {
    const id = `sl-${Math.random().toString(36).slice(2, 10)}`;
    const createdAt = new Date().toISOString();
    const createdBy = 'test';
    const created: ShoppingList = { ...list, id, createdAt, createdBy };
    this.lists.set(id, created);
    this.itemsByList.set(id, new Set());
    if (list.isDefault) {
      this.defaultListId = id;
    }
    return created;
  }

  async updateShoppingList(id: string, updates: Partial<ShoppingList>): Promise<ShoppingList> {
    const existing = this.lists.get(id);
    if (!existing) {
      throw new Error('Shopping list not found');
    }
    const updated: ShoppingList = { ...existing, ...updates };
    this.lists.set(id, updated);
    return updated;
  }

  async deleteShoppingList(id: string): Promise<void> {
    this.lists.delete(id);
    const itemIds = this.itemsByList.get(id);
    if (itemIds) {
      for (const itemId of itemIds) {
        this.items.delete(itemId);
      }
    }
    this.itemsByList.delete(id);
    if (this.defaultListId === id) {
      this.defaultListId = null;
    }
  }

  async getShoppingListItems(shoppingListId: string): Promise<ShoppingListItem[]> {
    const itemIds = this.itemsByList.get(shoppingListId);
    if (!itemIds) {
      return [];
    }
    return Array.from(itemIds)
      .map((id) => this.items.get(id))
      .filter((item): item is ShoppingListItem => Boolean(item));
  }

  async createShoppingListItem(item: ShoppingListItemInput): Promise<ShoppingListItem> {
    const id = `sli-${Math.random().toString(36).slice(2, 10)}`;
    const created: ShoppingListItem = { ...item, id };
    this.items.set(id, created);
    if (!this.itemsByList.has(item.shoppingListId)) {
      this.itemsByList.set(item.shoppingListId, new Set());
    }
    this.itemsByList.get(item.shoppingListId)?.add(id);
    return created;
  }

  async updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): Promise<ShoppingListItem> {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error('Shopping list item not found');
    }
    const updated: ShoppingListItem = { ...existing, ...updates };
    this.items.set(id, updated);
    return updated;
  }

  async deleteShoppingListItem(id: string): Promise<void> {
    const existing = this.items.get(id);
    if (!existing) {
      return;
    }
    this.items.delete(id);
    this.itemsByList.get(existing.shoppingListId)?.delete(id);
  }

  async addRecipeToShoppingList(recipeId: string, shoppingListId: string): Promise<void> {
    const list = this.lists.get(shoppingListId);
    if (!list) {
      throw new Error('Shopping list not found');
    }
    const recipeIds = new Set(list.recipeIds ?? []);
    recipeIds.add(recipeId);
    await this.updateShoppingList(shoppingListId, { recipeIds: Array.from(recipeIds) });
  }

  async addManualItemToShoppingList(
    shoppingListId: string,
    name: string,
    quantity: number,
    unit: string,
    aisle?: string
  ): Promise<ShoppingListItem> {
    return this.createShoppingListItem({
      shoppingListId,
      canonicalItemId: `manual-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      aisle: aisle ?? 'Other',
      quantity,
      unit,
      checked: false,
      isStaple: false,
    });
  }

  async generateShoppingList(recipeIds: string[], name: string): Promise<{ list: ShoppingList; items: ShoppingListItem[] }> {
    const list = await this.createShoppingList({ name, recipeIds, isDefault: false });
    return { list, items: [] };
  }

  async processRecipeIngredients(ingredients: string[] | RecipeIngredient[], recipeId: string): Promise<RecipeIngredient[]> {
    if (ingredients.length > 0 && typeof ingredients[0] === 'object') {
      return ingredients as RecipeIngredient[];
    }
    return (ingredients as string[]).map((raw, idx) => ({
      id: `ring-${recipeId}-${idx}`,
      raw,
      quantity: null,
      unit: null,
      ingredientName: raw.toLowerCase(),
    }));
  }
}

describe('Shopping Backend - List Management', () => {
  let backend: IShoppingBackend;

  beforeEach(() => {
    backend = new InMemoryShoppingBackend();
  });

  it('should create a new shopping list', async () => {
    const list = await backend.createShoppingList(buildListInput());
    
    expect(list).toBeDefined();
    expect(list.name).toBe('Weekly Groceries');
  });

  it('should retrieve an existing list', async () => {
    const created = await backend.createShoppingList(buildListInput({ name: 'Test List' }));
    const retrieved = await backend.getShoppingList(created.id);
    
    if (!retrieved) {
      throw new Error('Expected list to exist');
    }
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.name).toBe('Test List');
  });

  it('should update list metadata', async () => {
    const list = await backend.createShoppingList(buildListInput({ name: 'Original Name' }));
    
    const updated = await backend.updateShoppingList(list.id, {
      name: 'Updated Name',
    });
    
    expect(updated.name).toBe('Updated Name');
  });

  it('should delete a list', async () => {
    const list = await backend.createShoppingList(buildListInput({ name: 'To Delete' }));
    await backend.deleteShoppingList(list.id);
    
    const retrieved = await backend.getShoppingList(list.id);
    expect(retrieved).toBeNull();
  });

  it('should list all shopping lists', async () => {
    await backend.createShoppingList(buildListInput({ name: 'List 1' }));
    await backend.createShoppingList(buildListInput({ name: 'List 2' }));
    
    const lists = await backend.getShoppingLists();
    
    expect(lists.length).toBeGreaterThanOrEqual(2);
  });

  it('should set and retrieve default list', async () => {
    const list = await backend.createShoppingList(buildListInput({ name: 'Default', isDefault: true }));
    await backend.setDefaultShoppingList(list.id);

    const retrieved = await backend.getDefaultShoppingList();
    expect(retrieved.id).toBe(list.id);
  });
});

describe('Shopping Backend - Item Management', () => {
  let backend: IShoppingBackend;
  let testList: ShoppingList;

  beforeEach(async () => {
    backend = new InMemoryShoppingBackend();
    testList = await backend.createShoppingList(buildListInput({ name: 'Test List' }));
  });

  it('should add item to shopping list', async () => {
    const item = await backend.createShoppingListItem({
      shoppingListId: testList.id,
      canonicalItemId: 'item-1',
      name: 'Tomatoes',
      aisle: 'Produce',
      quantity: 500,
      unit: 'g',
      checked: false,
      isStaple: false,
    });
    
    expect(item).toBeDefined();
    expect(item.canonicalItemId).toBe('item-1');
    expect(item.quantity).toBe(500);
    expect(item.unit).toBe('g');
  });

  it('should update item in list', async () => {
    const item = await backend.createShoppingListItem({
      shoppingListId: testList.id,
      canonicalItemId: 'item-1',
      name: 'Tomatoes',
      aisle: 'Produce',
      quantity: 500,
      unit: 'g',
      checked: false,
      isStaple: false,
    });

    const updated = await backend.updateShoppingListItem(item.id, {
      quantity: 1000,
      unit: 'g',
    });
    
    expect(updated.quantity).toBe(1000);
  });

  it('should remove item from list', async () => {
    const item = await backend.createShoppingListItem({
      shoppingListId: testList.id,
      canonicalItemId: 'item-1',
      name: 'Tomatoes',
      aisle: 'Produce',
      quantity: 500,
      unit: 'g',
      checked: false,
      isStaple: false,
    });

    await backend.deleteShoppingListItem(item.id);

    const items = await backend.getShoppingListItems(testList.id);
    expect(items).toHaveLength(0);
  });

  it('should mark item as checked', async () => {
    const item = await backend.createShoppingListItem({
      shoppingListId: testList.id,
      canonicalItemId: 'item-1',
      name: 'Tomatoes',
      aisle: 'Produce',
      quantity: 500,
      unit: 'g',
      checked: false,
      isStaple: false,
    });

    const checked = await backend.updateShoppingListItem(item.id, {
      checked: true,
    });
    
    expect(checked.checked).toBe(true);
  });

  it('should handle item notes', async () => {
    const item = await backend.createShoppingListItem({
      shoppingListId: testList.id,
      canonicalItemId: 'item-1',
      name: 'Tomatoes',
      aisle: 'Produce',
      quantity: 500,
      unit: 'g',
      checked: false,
      isStaple: false,
    });

    const withNote = await backend.updateShoppingListItem(item.id, {
      note: 'Organic preferred',
    });
    
    expect(withNote.note).toBe('Organic preferred');
  });
});

describe('Shopping Backend - Integration', () => {
  let backend: IShoppingBackend;

  beforeEach(() => {
    backend = new InMemoryShoppingBackend();
  });

  it('should handle complete shopping workflow', async () => {
    // Create list
    const list = await backend.createShoppingList(buildListInput({ name: 'Weekly Shop' }));
    expect(list.id).toBeDefined();

    // Add multiple items
    const item1 = await backend.createShoppingListItem({
      shoppingListId: list.id,
      canonicalItemId: 'tomato',
      name: 'Tomatoes',
      aisle: 'Produce',
      quantity: 4,
      unit: 'piece',
      checked: false,
      isStaple: false,
    });
    const item2 = await backend.createShoppingListItem({
      shoppingListId: list.id,
      canonicalItemId: 'olive-oil',
      name: 'Olive oil',
      aisle: 'Pantry',
      quantity: 500,
      unit: 'ml',
      checked: false,
      isStaple: false,
    });

    // Check one item
    await backend.updateShoppingListItem(item1.id, { checked: true });

    // Retrieve and verify
    const updatedItems = await backend.getShoppingListItems(list.id);
    expect(updatedItems).toHaveLength(2);
    
    const checkedItem = updatedItems.find(i => i.id === item1.id);
    expect(checkedItem?.checked).toBe(true);

    const uncheckedItem = updatedItems.find(i => i.id === item2.id);
    expect(uncheckedItem?.checked).toBe(false);
  });

  it('should handle multi-unit items', async () => {
    const list = await backend.createShoppingList(buildListInput({ name: 'Test' }));

    // Add same item in different units
    await backend.createShoppingListItem({
      shoppingListId: list.id,
      canonicalItemId: 'flour',
      name: 'Flour',
      aisle: 'Baking',
      quantity: 500,
      unit: 'g',
      checked: false,
      isStaple: false,
    });

    await backend.createShoppingListItem({
      shoppingListId: list.id,
      canonicalItemId: 'flour',
      name: 'Flour',
      aisle: 'Baking',
      quantity: 1,
      unit: 'kg',
      checked: false,
      isStaple: false,
    });

    const retrieved = await backend.getShoppingListItems(list.id);
    const flours = retrieved.filter(i => i.canonicalItemId === 'flour');
    
    expect(flours).toHaveLength(2);
    expect(flours.some(f => f.unit === 'g')).toBe(true);
    expect(flours.some(f => f.unit === 'kg')).toBe(true);
  });
});

describe('Shopping Backend - Error Handling', () => {
  let backend: IShoppingBackend;

  beforeEach(() => {
    backend = new InMemoryShoppingBackend();
  });

  it('should handle invalid list ID', async () => {
    const list = await backend.getShoppingList('invalid-id');
    expect(list).toBeNull();
  });

  it('should add recipe ID to a list', async () => {
    const list = await backend.createShoppingList(buildListInput({ name: 'Test' }));
    await backend.addRecipeToShoppingList('recipe-1', list.id);

    const updated = await backend.getShoppingList(list.id);
    if (!updated) {
      throw new Error('Expected list to exist');
    }
    expect(updated.recipeIds).toContain('recipe-1');
  });
});
