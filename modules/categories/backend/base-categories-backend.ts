/**
 * Base Categories Backend
 * 
 * Contains AI-powered recipe categorization logic.
 * Subclasses implement persistence (Firebase).
 */

import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { RecipeCategory, Recipe } from '../../../types/contract';
import { ICategoriesBackend } from './categories-backend.interface';

export abstract class BaseCategoriesBackend implements ICategoriesBackend {
  
  // ==================== ABSTRACT METHODS ====================
  // Subclasses MUST implement persistence and AI transport
  
  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract getSystemInstruction(customContext?: string): Promise<string>;
  
  // Category CRUD (persistence layer)
  abstract getCategories(): Promise<RecipeCategory[]>;
  abstract getCategory(id: string): Promise<RecipeCategory | null>;
  abstract createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory>;
  abstract updateCategory(id: string, updates: Partial<RecipeCategory>): Promise<RecipeCategory>;
  abstract deleteCategory(id: string): Promise<void>;
  
  // Approval workflow
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
