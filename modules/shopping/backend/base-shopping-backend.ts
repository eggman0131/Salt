/**
 * Base Shopping Backend
 * 
 * Contains all shopping domain logic including:
 * - AI-powered ingredient parsing
 * - AI-powered shopping list generation from recipes
 * - Fuzzy matching for canonical items
 * - Recipe ingredient processing
 * 
 * Subclasses (Firebase, Simulation) implement persistence only.
 * 
 * Note: Units, Aisles, and Canonical Items are imported from kitchen-data module.
 */

import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  ShoppingList,
  ShoppingListItem,
  RecipeIngredient,
  CanonicalItem,
  Unit,
  Aisle,
} from '../../../types/contract';
import { IShoppingBackend } from './shopping-backend.interface';
import { kitchenDataBackend } from '../../kitchen-data';

export abstract class BaseShoppingBackend implements IShoppingBackend {
  
  // ==================== ABSTRACT METHODS ====================
  // Subclasses MUST implement persistence and AI transport
  
  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;
  protected abstract getSystemInstruction(customContext?: string): Promise<string>;
  
  // Shopping Lists (CRUD)
  abstract getShoppingLists(): Promise<ShoppingList[]>;
  abstract getShoppingList(id: string): Promise<ShoppingList | null>;
  abstract getDefaultShoppingList(): Promise<ShoppingList>;
  abstract setDefaultShoppingList(id: string): Promise<void>;
  abstract createShoppingList(list: Omit<ShoppingList, 'id' | 'createdAt' | 'createdBy'>): Promise<ShoppingList>;
  abstract updateShoppingList(id: string, updates: Partial<ShoppingList>): Promise<ShoppingList>;
  abstract deleteShoppingList(id: string): Promise<void>;
  
  // Shopping List Items (CRUD)
  abstract getShoppingListItems(shoppingListId: string): Promise<ShoppingListItem[]>;
  abstract createShoppingListItem(item: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem>;
  abstract updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): Promise<ShoppingListItem>;
  abstract deleteShoppingListItem(id: string): Promise<void>;
  
  // Recipe Integration
  abstract addRecipeToShoppingList(recipeId: string, shoppingListId: string): Promise<void>;
  abstract addManualItemToShoppingList(shoppingListId: string, name: string, quantity: number, unit: string, aisle?: string): Promise<ShoppingListItem>;
  
  // ==================== AI-POWERED INGREDIENT PROCESSING ====================
  
  /**
   * Process raw ingredient strings → structured RecipeIngredient[] with canonical item links
   * 
   * Algorithm:
   * 1. Parse each ingredient string (quantity, unit, name, preparation)
   * 2. Fuzzy match against existing canonical items
   * 3. If match >= 85%, link to existing item
   * 4. Batch resolve unmatched ingredients via AI
   * 5. Auto-create missing units, aisles, and canonical items
   * 6. Return fully structured ingredients with canonical links
   */
  async processRecipeIngredients(ingredients: string[] | RecipeIngredient[], recipeId: string): Promise<RecipeIngredient[]> {
    // If already structured, return as-is
    if (ingredients.length > 0 && typeof ingredients[0] === 'object') {
      return ingredients as RecipeIngredient[];
    }

    // Get all canonical items for fuzzy matching
    const allItems = await kitchenDataBackend.getCanonicalItems();
    const results: RecipeIngredient[] = [];
    const unmatched: { index: number; parsed: any }[] = [];

    // Step 1: Parse and fuzzy match each ingredient
    for (let idx = 0; idx < ingredients.length; idx++) {
      const raw = typeof ingredients[idx] === 'string' ? ingredients[idx] as string : '';
      const parsed = this.parseIngredientString(raw);
      
      // Try fuzzy match to existing canonical items
      let bestMatch: CanonicalItem | null = null;
      let bestScore = 0;
      
      for (const item of allItems) {
        const score = this.fuzzyMatch(parsed.ingredientName.toLowerCase(), item.normalisedName);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
        
        // Also check synonyms
        if (item.synonyms) {
          for (const syn of item.synonyms) {
            const synScore = this.fuzzyMatch(parsed.ingredientName.toLowerCase(), syn.toLowerCase());
            if (synScore > bestScore) {
              bestScore = synScore;
              bestMatch = item;
            }
          }
        }
      }
      
      // If good match found (85%+), use it
      if (bestScore >= 0.85 && bestMatch) {
        results.push({
          id: `ring-${recipeId}-${idx}`,
          raw,
          ...parsed,
          canonicalItemId: bestMatch.id
        });
      } else {
        // Queue for AI resolution
        results.push({
          id: `ring-${recipeId}-${idx}`,
          raw,
          ...parsed,
          canonicalItemId: undefined
        });
        unmatched.push({ index: idx, parsed });
      }
    }

    // Step 2: Batch resolve unmatched items via AI
    if (unmatched.length > 0) {
      const resolved = await this.resolveUnmatchedIngredients(unmatched.map(u => u.parsed.ingredientName));
      
      // Get existing units and aisles to check what needs creating
      const [existingUnits, existingAisles] = await Promise.all([
        kitchenDataBackend.getUnits(),
        kitchenDataBackend.getAisles()
      ]);
      
      const unitNames = new Set(existingUnits.map(u => u.name.toLowerCase()));
      const aisleNames = new Set(existingAisles.map(a => a.name.toLowerCase()));
      
      // Track existing canonical items to avoid duplicates
      const canonicalItemNames = new Map<string, string>(); // normalized name -> item ID
      for (const item of allItems) {
        canonicalItemNames.set(item.normalisedName, item.id);
      }
      
      let nextUnitSortOrder = existingUnits.length;
      let nextAisleSortOrder = existingAisles.length;
      
      // Create new canonical items and update results
      for (let i = 0; i < unmatched.length; i++) {
        const { index } = unmatched[i];
        const aiResolution = resolved[i];
        
        if (aiResolution) {
          const unitName = aiResolution.preferredUnit || '';
          const aisleName = aiResolution.aisle || 'Other';
          const normalizedItemName = aiResolution.name.toLowerCase();
          
          // Ensure unit exists (reuse if found, create if missing)
          if (!unitNames.has(unitName.toLowerCase())) {
            await kitchenDataBackend.createUnit({
              name: unitName,
              sortOrder: nextUnitSortOrder++
            });
            unitNames.add(unitName.toLowerCase());
          }
          
          // Ensure aisle exists (reuse if found, create if missing)
          if (!aisleNames.has(aisleName.toLowerCase())) {
            await kitchenDataBackend.createAisle({
              name: aisleName,
              sortOrder: nextAisleSortOrder++
            });
            aisleNames.add(aisleName.toLowerCase());
          }
          
          // Create canonical item if it doesn't exist
          let canonicalItemId = canonicalItemNames.get(normalizedItemName);
          if (!canonicalItemId) {
            const newItem = await kitchenDataBackend.createCanonicalItem({
              name: aiResolution.name,
              normalisedName: normalizedItemName,
              preferredUnit: unitName,
              aisle: aisleName,
              isStaple: aiResolution.isStaple || false,
              synonyms: aiResolution.synonyms || []
            });
            canonicalItemId = newItem.id;
            canonicalItemNames.set(normalizedItemName, canonicalItemId);
          }
          
          // Update result with canonical item link
          results[index].canonicalItemId = canonicalItemId;
        }
      }
    }

    return results;
  }
  
  /**
   * Generate shopping list from recipe IDs (AI-powered consolidation)
   * TODO: Phase 2 - Full implementation with ingredient merging
   */
  async generateShoppingList(recipeIds: string[], name: string): Promise<{ list: ShoppingList; items: ShoppingListItem[] }> {
    // Placeholder implementation - will be built when recipe backend exists
    const list: ShoppingList = {
      id: `sl-${Date.now()}`,
      name,
      recipeIds,
      createdAt: new Date().toISOString(),
    };
    return { list, items: [] };
  }
  
  // ==================== HELPER METHODS ====================
  
  /**
   * Parse raw ingredient string → structured format
   * Example: "2 large red onions, diced" → { quantity: 2, unit: '', ingredientName: 'red onion', preparation: 'diced' }
   */
  private parseIngredientString(raw: string): Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'> {
    let text = raw.toLowerCase().trim();
    
    // Extract quantity and unit
    const knownUnits = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'];
    const unitPattern = knownUnits.join('|');
    const quantityMatch = text.match(new RegExp(`^(\\d+\\.?\\d*|\\d*\\.\\d+)\\s*(${unitPattern})?\\s+(.+)$`));
    
    let quantity: number | null = null;
    let unit: string | null = null;
    
    if (quantityMatch) {
      quantity = parseFloat(quantityMatch[1]);
      unit = quantityMatch[2] || ''; // Default to empty if no unit specified
      text = quantityMatch[3];
    }
    
    // Extract preparation instructions (comma-separated descriptors at end)
    const prepMatch = text.match(/,\s*(.+)$/);
    const preparation = prepMatch ? prepMatch[1].trim() : null;
    if (prepMatch) {
      text = text.substring(0, prepMatch.index).trim();
    }
    
    // Remove size adjectives (non-identity descriptors)
    text = text.replace(/\b(small|medium|large)\b/g, '').trim();
    
    // Normalize whitespace
    const ingredientName = text.replace(/\s+/g, ' ').trim();
    
    return {
      quantity,
      unit,
      ingredientName,
      preparation: preparation || undefined
    };
  }

  /**
   * Levenshtein distance for fuzzy string matching
   * Returns similarity score 0.0 - 1.0 (1.0 = exact match)
   */
  private fuzzyMatch(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Batch resolve unmatched ingredient names via AI
   * Sends all unmatched items in ONE prompt to minimize API calls
   */
  private async resolveUnmatchedIngredients(ingredientNames: string[]): Promise<any[]> {
    if (ingredientNames.length === 0) return [];
    
    const instruction = await this.getSystemInstruction("You are the Head Chef resolving ingredient names to canonical items.");
    
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Resolve these recipe ingredients to canonical item database entries. Return JSON array with one entry per ingredient.

INGREDIENTS TO RESOLVE:
${ingredientNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

For each ingredient, return:
{
  "name": "Canonical item name (title case)",
  "preferredUnit": "g|kg|ml|l| (empty string for countable items)",
  "aisle": "Produce|Meat & Fish|Dairy|Bakery|Pantry|Frozen|Other",
  "isStaple": true/false,
  "synonyms": ["alternate name 1", "alternate name 2"]
}

RULES:
- Use British English (courgette not zucchini, aubergine not eggplant)
- Use metric units only
- Leave preferredUnit empty for countable things (eggs, onions, cans)
- Keep culinary identity descriptors (red onion, beef mince, whole milk)
- Remove size adjectives (small, medium, large)

Return JSON array: [item1, item2, ...]`
        }]
      }],
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });

    const sanitized = this.sanitizeJson(response.text || '[]');
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? parsed : [];
  }
  
  /**
   * Extract JSON from AI response (strips markdown fences, preamble, etc.)
   */
  protected sanitizeJson(text: string): string {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    if (firstBrace === -1 && firstBracket === -1) return text.trim();
    const isArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);
    if (isArray) {
      const lastBracket = text.lastIndexOf(']');
      return lastBracket !== -1 ? text.substring(firstBracket, lastBracket + 1) : text.trim();
    } else {
      const lastBrace = text.lastIndexOf('}');
      return lastBrace !== -1 ? text.substring(firstBrace, lastBrace + 1) : text.trim();
    }
  }
}
