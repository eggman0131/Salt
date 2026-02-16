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
}
