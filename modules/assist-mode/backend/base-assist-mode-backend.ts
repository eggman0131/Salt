/**
 * Assist Mode Base Backend
 * 
 * Contains AI logic for generating cook guides and helper functions.
 * Shared between simulation and Firebase implementations.
 */

import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { Recipe } from '../../../types/contract';
import { CookGuide } from '../types';
import { IAssistModeBackend } from './assist-mode-backend.interface';
import { COOK_GUIDE_SYSTEM_PROMPT, COOK_GUIDE_USER_PROMPT } from '../prompts';
const HASH_HEX_LENGTH = 16;

const hashString = (value: string): string => {
  // Simple deterministic hash for cache versioning (not for security).
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16);
  return hex.padStart(HASH_HEX_LENGTH, '0').slice(0, HASH_HEX_LENGTH);
};

export abstract class BaseAssistModeBackend implements IAssistModeBackend {
  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;

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
    return hashString(data);
  }

  /**
   * Generate a cook guide from a recipe using AI.
   */
  protected async generateGuideWithAI(recipe: Recipe): Promise<Omit<CookGuide, 'id' | 'generatedAt' | 'generatedBy'>> {
    try {
      const prompt = COOK_GUIDE_USER_PROMPT(recipe);
      
      const response = await this.callGenerateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: prompt }],
          },
        ],
        config: { systemInstruction: COOK_GUIDE_SYSTEM_PROMPT },
      });

      const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
  abstract updateCookingStep(guideId: string, stepId: string, updatedStep: Partial<CookGuide['steps'][0]>): Promise<CookGuide>;
  abstract updatePrepGroups(guideId: string, prepGroups: CookGuide['prepGroups']): Promise<CookGuide>;
  abstract deleteCookGuide(guideId: string): Promise<void>;
  abstract getCookGuidesForRecipe(recipeId: string): Promise<CookGuide[]>;
  abstract getAllCookGuides(): Promise<CookGuide[]>;
}
