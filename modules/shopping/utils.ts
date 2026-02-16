import { ShoppingListItem, Unit, Aisle, CanonicalItem } from '../../types/contract';

/**
 * Ensures the specified unit exists in the units list, creating it if necessary.
 */
export async function ensureUnitExists(
  unitName: string,
  existingUnits: Unit[],
  createUnit: (name: string) => Promise<Unit>
): Promise<Unit> {
  const existing = existingUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());
  if (existing) return existing;
  return await createUnit(unitName);
}

/**
 * Ensures the specified aisle exists in the aisles list, creating it if necessary.
 */
export async function ensureAisleExists(
  aisleName: string,
  existingAisles: Aisle[],
  createAisle: (name: string, sortOrder?: number) => Promise<Aisle>
): Promise<Aisle> {
  const existing = existingAisles.find(a => a.name.toLowerCase() === aisleName.toLowerCase());
  if (existing) return existing;
  const nextSort = Math.max(0, ...existingAisles.map(a => a.sortOrder ?? 0)) + 1;
  return await createAisle(aisleName, nextSort);
}

/**
 * Groups shopping list items by aisle name.
 */
export function groupItemsByAisle(
  items: ShoppingListItem[],
  aisles: Aisle[]
): Record<string, ShoppingListItem[]> {
  const grouped: Record<string, ShoppingListItem[]> = {};
  
  for (const item of items) {
    const aisleName = item.aisle || 'Uncategorised';
    if (!grouped[aisleName]) {
      grouped[aisleName] = [];
    }
    grouped[aisleName].push(item);
  }
  
  // Sort aisles by their defined sortOrder and return as new object
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const aisleA = aisles.find(aisle => aisle.name === a);
    const aisleB = aisles.find(aisle => aisle.name === b);
    
    // Uncategorised always at the end
    if (a === 'Uncategorised') return 1;
    if (b === 'Uncategorised') return -1;
    
    const sortA = aisleA?.sortOrder ?? 999;
    const sortB = aisleB?.sortOrder ?? 999;
    return sortA - sortB;
  });
  
  const result: Record<string, ShoppingListItem[]> = {};
  sortedKeys.forEach(key => {
    result[key] = grouped[key];
  });
  
  return result;
}

/**
 * Filters canonical items by search query.
 */
export function filterCanonicalItems(
  items: CanonicalItem[],
  query: string
): CanonicalItem[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase().trim();
  return items
    .filter(item => item.name.toLowerCase().includes(lowerQuery))
    .sort((a, b) => {
      // Exact matches first
      const aExact = a.name.toLowerCase() === lowerQuery;
      const bExact = b.name.toLowerCase() === lowerQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then starts-with matches
      const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      // Finally alphabetical
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10); // Limit to 10 suggestions
}

/**
 * Calculates the shopping list progress (checked vs total items).
 */
export function calculateProgress(items: ShoppingListItem[]): { checkedCount: number; totalCount: number; percentage: number } {
  const totalCount = items.length;
  const checkedCount = items.filter(item => item.checked).length;
  const percentage = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;
  
  return { checkedCount, totalCount, percentage };
}

/**
 * Validates item data before adding to list.
 */
export function validateItemData(
  name: string,
  quantity: string,
  unit: string,
  isNewItem: boolean,
  aisle?: string
): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Item name is required' };
  }
  
  if (!quantity || parseFloat(quantity) <= 0) {
    return { valid: false, error: 'Quantity must be greater than 0' };
  }
  
  if (!unit.trim()) {
    return { valid: false, error: 'Unit is required' };
  }
  
  if (isNewItem && !aisle?.trim()) {
    return { valid: false, error: 'Aisle is required for new items' };
  }
  
  return { valid: true };
}

/**
 * Formats a shopping list item display name.
 */
export function formatItemDisplayName(item: ShoppingListItem): string {
  const quantity = parseFloat(item.quantity.toString());
  const formattedQty = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(1);
  return `${formattedQty} ${item.unit} ${item.name}`;
}
