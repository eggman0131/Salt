/**
 * Cook Mode Base Backend
 * 
 * Contains AI logic for generating cook guides and helper functions.
 * Shared between simulation and Firebase implementations.
 */

import { Recipe } from '../../../types/contract';
import { CookGuide } from '../types';
import { ICookModeBackend } from './cook-mode-backend.interface';
import { COOK_GUIDE_SYSTEM_PROMPT, COOK_GUIDE_USER_PROMPT } from '../prompts';
import { createHash } from 'crypto';

export abstract class BaseCookModeBackend implements ICookModeBackend {
  /**
   * Hash recipe for version tracking.
   * Used to detect if guide needs regeneration.
   */
  protected hashRecipe(recipe: Recipe): string {
    const data = JSON.stringify({
      id: recipe.id,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    });
    return createHash('sha256').update(data).digest('hex').slice(0, 16);
  }

  /**
   * Generate a cook guide from a recipe using AI.
   */
  protected async generateGuideWithAI(recipe: Recipe): Promise<Omit<CookGuide, 'id' | 'generatedAt' | 'generatedBy'>> {
    try {
      const prompt = COOK_GUIDE_USER_PROMPT(recipe);
      
      // Call Gemini API
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.VITE_API_KEY || '',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: COOK_GUIDE_SYSTEM_PROMPT }],
          },
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON in Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        recipeVersion: this.hashRecipe(recipe),
        prepGroups: parsed.prepGroups || [],
        steps: parsed.steps || [],
      };
    } catch (error) {
      console.error('Failed to generate cook guide with AI:', error);
      throw error;
    }
  }

  /**
   * Abstract methods to be implemented by subclasses.
   */
  abstract getOrGenerateCookGuide(recipe: Recipe): Promise<CookGuide>;
  abstract generateCookGuide(recipe: Recipe): Promise<CookGuide>;
  abstract getCookGuide(guideId: string): Promise<CookGuide | null>;
  abstract deleteCookGuide(guideId: string): Promise<void>;
  abstract getCookGuidesForRecipe(recipeId: string): Promise<CookGuide[]>;
}
