/**
 * Base Shopping Backend
 * 
 * Contains all shopping domain logic including:
 * - AI-powered shopping list generation from recipes
 * - Shopping list and item management
 * 
 * Subclasses (Firebase, Simulation) implement persistence only.
 * 
 * Note: Ingredient processing is delegated to canon module.
 */

import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  ShoppingList,
  ShoppingListItem,
  RecipeIngredient,
} from '../../../types/contract';
import { IShoppingBackend } from './shopping-backend.interface';
import { canonBackend } from '../../canon';

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
  
  // ==================== INGREDIENT PROCESSING (Delegated to Canon) ====================
  
  /**
   * Process raw ingredient strings → structured RecipeIngredient[] with canonical item links
   * 
   * Delegates to canon backend for ingredient intelligence.
   * Canon handles: parsing, fuzzy matching, AI resolution, and item creation.
   */
  async processRecipeIngredients(ingredients: string[] | RecipeIngredient[], recipeId: string): Promise<RecipeIngredient[]> {
    return canonBackend.processIngredients(ingredients, recipeId);
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
   * Extract JSON from AI response (strips markdown fences, preamble, etc.)
   * Used for shopping-specific AI operations (e.g., generateShoppingList)
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
