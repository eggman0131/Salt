/**
 * Assist Mode AI provider.
 *
 * Handles authenticated Gemini calls via the cloudGenerateContent Cloud Function
 * and produces raw guide data from a recipe.
 */

import { httpsCallable } from 'firebase/functions';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { auth, functions } from '../../../shared/backend/firebase';
import { debugLogger } from '../../../shared/backend/debug-logger';
import type { Recipe } from '../../../types/contract';
import type { CookGuide } from '../types';
import { COOK_GUIDE_SYSTEM_PROMPT, COOK_GUIDE_USER_PROMPT } from '../logic/prompts';
import { hashRecipe } from '../logic/guide-utils';

let cachedIdToken: string | null = null;

async function callGenerateContent(
  params: GenerateContentParameters
): Promise<GenerateContentResponse> {
  const user = auth.currentUser;

  debugLogger.log('assist-mode/ai-provider', 'callGenerateContent — user:', user?.email);

  if (!cachedIdToken && !user) {
    throw new Error('User not authenticated. Cannot call Gemini API.');
  }

  if (user) {
    try {
      cachedIdToken = await user.getIdToken(true);
    } catch (e) {
      debugLogger.log('assist-mode/ai-provider', 'getIdToken failed, using cached token:', e);
      if (!cachedIdToken) throw e;
    }
  }

  if (!cachedIdToken) {
    throw new Error('Failed to obtain authentication token.');
  }

  const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
  try {
    const result = await cloudGenerateContent({ idToken: cachedIdToken, params });
    return result.data as GenerateContentResponse;
  } catch (error) {
    debugLogger.error('assist-mode/ai-provider', 'Cloud Function error:', error);
    throw error;
  }
}

/**
 * Call the AI to generate guide data from a recipe.
 * Returns everything except id, generatedAt, and generatedBy.
 */
export async function generateGuideWithAI(
  recipe: Recipe
): Promise<Omit<CookGuide, 'id' | 'generatedAt' | 'generatedBy'>> {
  const prompt = COOK_GUIDE_USER_PROMPT(recipe);

  const response = await callGenerateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    config: { systemInstruction: COOK_GUIDE_SYSTEM_PROMPT },
  });

  const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON in Gemini response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    recipeVersion: hashRecipe(recipe),
    prepGroups: parsed.prepGroups || [],
    steps: parsed.steps || [],
  };
}
