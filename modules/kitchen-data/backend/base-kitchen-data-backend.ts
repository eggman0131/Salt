/**
 * Base Kitchen Data Backend
 * 
 * Contains AI-powered categorization logic.
 * Subclasses implement persistence (Firebase, Simulation).
 */

import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  Unit,
  Aisle,
  CanonicalItem,
  RecipeCategory,
  Recipe,
} from '../../../types/contract';
import { IKitchenDataBackend } from './kitchen-data-backend.interface';

export abstract class BaseKitchenDataBackend implements IKitchenDataBackend {
  
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
  
  // Impact Assessment & Healing
  abstract assessItemDeletion(ids: string[]): Promise<{
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }>;
  abstract healRecipeReferences(ids: string[], assessment: {
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }): Promise<{
    recipesFixed: number;
    ingredientsProcessed: number;
    ingredientsRematched: number;
    ingredientsUnmatched: number;
    newCanonicalItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }>;

  }>;
  
  // Categories (CRUD)
  abstract getCategories(): Promise<RecipeCategory[]>;
  abstract getCategory(id: string): Promise<RecipeCategory | null>;
  abstract createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory>;
  abstract updateCategory(id: string, updates: Partial<RecipeCategory>): Promise<RecipeCategory>;
  abstract deleteCategory(id: string): Promise<void>;
  abstract approveCategory(id: string): Promise<void>;
  abstract getPendingCategories(): Promise<RecipeCategory[]>;
  
  // ==================== AI-POWERED CATEGORIZATION ====================
  
  /**
   * AI-powered recipe categorization
   * Analyzes recipe title, description, ingredients to suggest relevant categories
   */
  async categorizeRecipe(recipe: Recipe): Promise<string[]> {
    const instruction = await this.getSystemInstruction(
      "You are the Head Chef analyzing recipes to suggest appropriate categories."
    );
    
    // Get existing categories for context
    const existingCategories = await this.getCategories();
    const approvedCategories = existingCategories
      .filter(c => c.isApproved)
      .map(c => `${c.name}${c.synonyms && c.synonyms.length > 0 ? ` (${c.synonyms.join(', ')})` : ''}`)
      .join('\n');
    
    const ingredientsList = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .map(ing => typeof ing === 'string' ? ing : ing.raw || ing.ingredientName)
          .slice(0, 10) // First 10 ingredients
          .join(', ')
      : '';
    
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Analyze this recipe and suggest appropriate categories.

RECIPE:
Title: ${recipe.title}
Description: ${recipe.description || 'N/A'}
Ingredients: ${ingredientsList || 'N/A'}
Complexity: ${recipe.complexity || 'N/A'}

EXISTING CATEGORIES:
${approvedCategories || 'None yet'}

RULES:
- Return category IDs that match existing categories
- If a perfect match exists, use it
- Consider: meal type (breakfast/lunch/dinner), cuisine, dietary restrictions, cooking method
- Only return categories that truly fit this recipe
- Return empty array if no good matches

Return JSON array of category IDs: ["cat-id-1", "cat-id-2"]`
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
   * AI-powered canonical item enrichment
   * Takes a raw item name and returns proper capitalization, aisle, and preferred unit
   * Also creates any missing units/aisles automatically
   */
  async enrichCanonicalItem(rawName: string): Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }> {
    const instruction = await this.getSystemInstruction(
      "You are the Head Chef resolving ingredient names to canonical items."
    );

    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Resolve this ingredient name to a canonical item database entry.

INGREDIENT: ${rawName}

Return JSON object with:
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
- Capitalize properly (e.g., "Extra Virgin Olive Oil")

Return JSON object:`
        }]
      }],
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });

    const sanitized = this.sanitizeJson(response.text || '{}');
    const parsed = JSON.parse(sanitized);

    // Ensure units and aisles exist (create if missing)
    if (parsed.preferredUnit) {
      const units = await this.getUnits();
      const unitExists = units.some(u => u.name.toLowerCase() === parsed.preferredUnit.toLowerCase());
      if (!unitExists) {
        await this.createUnit({
          name: parsed.preferredUnit,
          sortOrder: units.length
        });
      }
    }

    if (parsed.aisle) {
      const aisles = await this.getAisles();
      const aisleExists = aisles.some(a => a.name.toLowerCase() === parsed.aisle.toLowerCase());
      if (!aisleExists) {
        await this.createAisle({
          name: parsed.aisle,
          sortOrder: aisles.length
        });
      }
    }

    return {
      name: parsed.name || rawName,
      preferredUnit: parsed.preferredUnit || undefined,
      aisle: parsed.aisle || undefined,
      isStaple: parsed.isStaple || false,
      synonyms: parsed.synonyms || []
    };
  }
  
  // ==================== HELPER METHODS ====================
  
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

  /**
   * Validate synonyms are unique across all canonical items
   * Throws error if any synonym already exists on a different item
   * 
   * @param synonyms - Array of synonyms to validate
   * @param currentItemId - ID of item being updated (undefined for new items)
   * @throws Error if duplicate synonym found
   */
  protected async validateUniqueSynonyms(synonyms: string[] | undefined, currentItemId?: string): Promise<void> {
    if (!synonyms || synonyms.length === 0) return;

    const allItems = await this.getCanonicalItems();
    const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());

    for (const syn of normalizedSynonyms) {
      if (!syn) continue; // Skip empty strings

      for (const item of allItems) {
        // Skip the item we're currently updating
        if (item.id === currentItemId) continue;

        // Check if this synonym exists on another item
        const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
        if (itemSynonyms.includes(syn)) {
          throw new Error(`Synonym "${syn}" already exists on item "${item.name}"`);
        }

        // Also check against the item's main name
        if (item.normalisedName === syn) {
          throw new Error(`Synonym "${syn}" conflicts with canonical item "${item.name}"`);
        }
      }
    }
  }

  /**
   * Validate item name doesn't conflict with existing synonyms
   * Throws error if the item name matches a synonym on any other item
   * 
   * @param itemName - The item name to validate
   * @param currentItemId - ID of item being updated (undefined for new items)
   * @throws Error if name conflicts with an existing synonym
   */
  protected async validateItemNameUniqueness(itemName: string, currentItemId?: string): Promise<void> {
    const normalizedName = itemName.toLowerCase().trim();
    if (!normalizedName) return;

    const allItems = await this.getCanonicalItems();

    for (const item of allItems) {
      // Skip the item we're currently updating
      if (item.id === currentItemId) continue;

      // Check if this name matches any synonym on another item
      const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
      if (itemSynonyms.includes(normalizedName)) {
        throw new Error(`Item name "${itemName}" conflicts with synonym on item "${item.name}"`);
      }
    }
  }

  /**
   * Filter out conflicting canonical item synonyms without throwing an error
   * Returns only the synonyms that don't conflict with existing items
   * (for AI-proposed synonyms that may have conflicts)
   * 
   * @param synonyms - Array of synonyms to filter
   * @param currentItemId - ID of item being updated (undefined for new items)
   * @returns Filtered array containing only valid synonyms
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
      if (!normalizedSyn) continue; // Skip empty strings

      let isValid = true;

      for (const item of allItems) {
        // Skip the item we're currently updating
        if (item.id === currentItemId) continue;

        // Check if this synonym exists on another item
        const itemSynonyms = (item.synonyms || []).map(s => s.toLowerCase().trim());
        if (itemSynonyms.includes(normalizedSyn)) {
          isValid = false;
          break;
        }

        // Also check against the item's main name
        if (item.normalisedName === normalizedSyn) {
          isValid = false;
          break;
        }
      }

      // Only add if valid
      if (isValid) {
        validSynonyms.push(syn);
      }
    }

    return validSynonyms;
  }

  /**
   * Validate category synonyms are unique across all categories
   * Throws error if any synonym already exists on a different category
   * 
   * @param synonyms - Array of synonyms to validate
   * @param currentCategoryId - ID of category being updated (undefined for new categories)
   * @throws Error if duplicate synonym found
   */
  protected async validateUniqueCategorySynonyms(synonyms: string[] | undefined, currentCategoryId?: string): Promise<void> {
    if (!synonyms || synonyms.length === 0) return;

    const allCategories = await this.getCategories();
    const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());

    for (const syn of normalizedSynonyms) {
      if (!syn) continue; // Skip empty strings

      for (const category of allCategories) {
        // Skip the category we're currently updating
        if (category.id === currentCategoryId) continue;

        // Check if this synonym exists on another category
        const categorySynonyms = (category.synonyms || []).map(s => s.toLowerCase().trim());
        if (categorySynonyms.includes(syn)) {
          throw new Error(`Synonym "${syn}" already exists on category "${category.name}"`);
        }

        // Also check against the category's main name
        if (category.name.toLowerCase() === syn) {
          throw new Error(`Synonym "${syn}" conflicts with category "${category.name}"`);
        }
      }
    }
  }

  /**
   * Validate category name doesn't conflict with existing synonyms
   * Throws error if the category name matches a synonym on any other category
   * 
   * @param categoryName - The category name to validate
   * @param currentCategoryId - ID of category being updated (undefined for new categories)
   * @throws Error if name conflicts with an existing synonym
   */
  protected async validateCategoryNameUniqueness(categoryName: string, currentCategoryId?: string): Promise<void> {
    const normalizedName = categoryName.toLowerCase().trim();
    if (!normalizedName) return;

    const allCategories = await this.getCategories();

    for (const category of allCategories) {
      // Skip the category we're currently updating
      if (category.id === currentCategoryId) continue;

      // Check if this name matches any synonym on another category
      const categorySynonyms = (category.synonyms || []).map(s => s.toLowerCase().trim());
      if (categorySynonyms.includes(normalizedName)) {
        throw new Error(`Category name "${categoryName}" conflicts with synonym on category "${category.name}"`);
      }
    }
  }

  /**
   * Filter out conflicting category synonyms without throwing an error
   * Returns only the synonyms that don't conflict with existing categories
   * (for AI-proposed synonyms that may have conflicts)
   * 
   * @param synonyms - Array of synonyms to filter
   * @param currentCategoryId - ID of category being updated (undefined for new categories)
   * @returns Filtered array containing only valid synonyms
   */
  protected async filterValidCategorySynonyms(
    synonyms: string[] | undefined, 
    currentCategoryId?: string
  ): Promise<string[]> {
    if (!synonyms || synonyms.length === 0) return [];

    const allCategories = await this.getCategories();
    const validSynonyms: string[] = [];

    for (const syn of synonyms) {
      const normalizedSyn = syn.toLowerCase().trim();
      if (!normalizedSyn) continue; // Skip empty strings

      let isValid = true;

      for (const category of allCategories) {
        // Skip the category we're currently updating
        if (category.id === currentCategoryId) continue;

        // Check if this synonym exists on another category
        const categorySynonyms = (category.synonyms || []).map(s => s.toLowerCase().trim());
        if (categorySynonyms.includes(normalizedSyn)) {
          isValid = false;
          break;
        }

        // Also check against the category's main name
        if (category.name.toLowerCase() === normalizedSyn) {
          isValid = false;
          break;
        }
      }

      // Only add if valid
      if (isValid) {
        validSynonyms.push(syn);
      }
    }

    return validSynonyms;
  }
}
