/**
 * Base Canon Backend
 *
 * Contains item-domain logic and ingredient processing.
 * Subclasses implement persistence (Firebase, Simulation).
 */

import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import {
  Unit,
  Aisle,
  CanonicalItem,
  RecipeIngredient,
} from '../../../types/contract';
import { ICanonBackend } from './canon-backend.interface';

export abstract class BaseCanonBackend implements ICanonBackend {
  // ==================== ABSTRACT METHODS ====================
  // Subclasses MUST implement persistence and AI transport

  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;
  protected abstract getSystemInstruction(customContext?: string): Promise<string>;

  // Units (CRUD)
  abstract getUnits(): Promise<Unit[]>;
  abstract createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit>;
  abstract updateUnit(id: string, updates: Partial<Unit>): Promise<Unit>;
  abstract deleteUnit(id: string): Promise<void>;

  // Aisles (CRUD)
  abstract getAisles(): Promise<Aisle[]>;
  abstract createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle>;
  abstract updateAisle(id: string, updates: Partial<Aisle>): Promise<Aisle>;
  abstract deleteAisle(id: string): Promise<void>;

  // Canonical Items (CRUD)
  abstract getCanonicalItems(): Promise<CanonicalItem[]>;
  abstract getCanonicalItem(id: string): Promise<CanonicalItem | null>;
  abstract createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem>;
  abstract updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem>;
  abstract deleteCanonicalItem(id: string): Promise<void>;
  abstract deleteCanonicalItems(ids: string[]): Promise<void>;

  // ==================== INGREDIENT PROCESSING ====================

  /**
   * Process raw ingredient strings -> structured RecipeIngredient[] with canonical item links
   */
  async processIngredients(ingredients: string[] | RecipeIngredient[], contextId: string): Promise<RecipeIngredient[]> {
    // If already structured, return as-is
    if (ingredients.length > 0 && typeof ingredients[0] === 'object') {
      return ingredients as RecipeIngredient[];
    }

    const allItems = await this.getCanonicalItems();
    const results: RecipeIngredient[] = [];
    const unmatched: { index: number; parsed: Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'> }[] = [];

    for (let idx = 0; idx < ingredients.length; idx++) {
      const raw = typeof ingredients[idx] === 'string' ? ingredients[idx] as string : '';
      const parsed = this.parseIngredientString(raw);

      let bestMatch: CanonicalItem | null = null;
      let bestScore = 0;

      for (const item of allItems) {
        const score = this.fuzzyMatch(parsed.ingredientName.toLowerCase(), item.normalisedName);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }

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

      if (bestScore >= 0.85 && bestMatch) {
        results.push({
          id: `ring-${contextId}-${idx}`,
          raw,
          ...parsed,
          canonicalItemId: bestMatch.id,
        });
      } else {
        results.push({
          id: `ring-${contextId}-${idx}`,
          raw,
          ...parsed,
          canonicalItemId: undefined,
        });
        unmatched.push({ index: idx, parsed });
      }
    }

    if (unmatched.length > 0) {
      const resolved = await this.resolveUnmatchedIngredients(
        unmatched.map(u => u.parsed.ingredientName)
      );

      const [existingUnits, existingAisles] = await Promise.all([
        this.getUnits(),
        this.getAisles(),
      ]);

      const unitNames = new Set(existingUnits.map(u => u.name.toLowerCase()));
      const aisleNames = new Set(existingAisles.map(a => a.name.toLowerCase()));

      const canonicalItemNames = new Map<string, string>();
      for (const item of allItems) {
        canonicalItemNames.set(item.normalisedName, item.id);
      }

      let nextUnitSortOrder = existingUnits.length;
      let nextAisleSortOrder = existingAisles.length;

      for (let i = 0; i < unmatched.length; i++) {
        const { index } = unmatched[i];
        const aiResolution = resolved[i];

        if (aiResolution) {
          const unitName = aiResolution.preferredUnit || '';
          const aisleName = aiResolution.aisle || 'Other';
          const normalizedItemName = aiResolution.name.toLowerCase();

          if (!unitNames.has(unitName.toLowerCase())) {
            await this.createUnit({
              name: unitName,
              sortOrder: nextUnitSortOrder++,
            });
            unitNames.add(unitName.toLowerCase());
          }

          if (!aisleNames.has(aisleName.toLowerCase())) {
            await this.createAisle({
              name: aisleName,
              sortOrder: nextAisleSortOrder++,
            });
            aisleNames.add(aisleName.toLowerCase());
          }

          let canonicalItemId = canonicalItemNames.get(normalizedItemName);
          if (!canonicalItemId) {
            const newItem = await this.createCanonicalItem({
              name: aiResolution.name,
              normalisedName: normalizedItemName,
              preferredUnit: unitName,
              aisle: aisleName,
              isStaple: aiResolution.isStaple || false,
              synonyms: aiResolution.synonyms || [],
            });
            canonicalItemId = newItem.id;
            canonicalItemNames.set(normalizedItemName, canonicalItemId);
          }

          results[index].canonicalItemId = canonicalItemId;
        }
      }
    }

    return results;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Parse raw ingredient string -> structured format
   */
  private parseIngredientString(raw: string): Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'> {
    let text = raw.toLowerCase().trim();

    const knownUnits = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'];
    const unitPattern = knownUnits.join('|');
    const quantityMatch = text.match(new RegExp(`^(\\d+\\.?\\d*|\\d*\\.\\d+)\\s*(${unitPattern})?\\s+(.+)$`));

    let quantity: number | null = null;
    let unit: string | null = null;

    if (quantityMatch) {
      quantity = parseFloat(quantityMatch[1]);
      unit = quantityMatch[2] || '';
      text = quantityMatch[3];
    }

    const prepMatch = text.match(/,\s*(.+)$/);
    const preparation = prepMatch ? prepMatch[1].trim() : null;
    if (prepMatch) {
      text = text.substring(0, prepMatch.index).trim();
    }

    text = text.replace(/\b(small|medium|large)\b/g, '').trim();

    const ingredientName = text.replace(/\s+/g, ' ').trim();

    return {
      quantity,
      unit,
      ingredientName,
      preparation: preparation || undefined,
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
   */
  private async resolveUnmatchedIngredients(ingredientNames: string[]): Promise<any[]> {
    if (ingredientNames.length === 0) return [];

    const instruction = await this.getSystemInstruction(
      'You are the Head Chef resolving ingredient names to canonical items.'
    );

    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Resolve these recipe ingredients to canonical item catalogue entries. Return JSON array with one entry per ingredient.

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
        responseMimeType: 'application/json',
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
    }
    const lastBrace = text.lastIndexOf('}');
    return lastBrace !== -1 ? text.substring(firstBrace, lastBrace + 1) : text.trim();
  }

  /**
   * Validate synonyms are unique across all canonical items
   */
  protected async validateUniqueSynonyms(synonyms: string[] | undefined, currentItemId?: string): Promise<void> {
    if (!synonyms || synonyms.length === 0) return;

    const allItems = await this.getCanonicalItems();
    const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());

    for (const syn of normalizedSynonyms) {
      if (!syn) continue;

      for (const item of allItems) {
        if (item.id === currentItemId) continue;

        const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
        if (itemSynonyms.includes(syn)) {
          throw new Error(`Synonym "${syn}" already exists on item "${item.name}"`);
        }

        if (item.normalisedName === syn) {
          throw new Error(`Synonym "${syn}" conflicts with canonical item "${item.name}"`);
        }
      }
    }
  }

  /**
   * Validate item name doesn't conflict with existing synonyms
   */
  protected async validateItemNameUniqueness(itemName: string, currentItemId?: string): Promise<void> {
    const normalizedName = itemName.toLowerCase().trim();
    if (!normalizedName) return;

    const allItems = await this.getCanonicalItems();

    for (const item of allItems) {
      if (item.id === currentItemId) continue;

      const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
      if (itemSynonyms.includes(normalizedName)) {
        throw new Error(`Item name "${itemName}" conflicts with synonym on item "${item.name}"`);
      }
    }
  }

  /**
   * Filter out conflicting canonical item synonyms without throwing an error
   */
  protected async filterValidSynonyms(
    synonyms: string[] | undefined,
    currentItemId?: string
  ): Promise<string[]> {
    if (!synonyms || synonyms.length === 0) return [];

    const allItems = await this.getCanonicalItems();
    const validSynonyms: string[] = [];

    for (const syn of synonyms) {
      const normalizedSyn = syn.toLowerCase().trim();
      if (!normalizedSyn) continue;

      let isValid = true;

      for (const item of allItems) {
        if (item.id === currentItemId) continue;

        const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
        if (itemSynonyms.includes(normalizedSyn)) {
          isValid = false;
          break;
        }

        if (item.normalisedName === normalizedSyn) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        validSynonyms.push(syn);
      }
    }

    return validSynonyms;
  }
}
