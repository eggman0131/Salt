/**
 * AI provider for recipe categorization
 * 
 * Calls Gemini via Cloud Functions to analyze recipes.
 * Called from api.ts, never directly from UI.
 */

import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { auth, functions } from '../../../shared/backend/firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Call Gemini API via Cloud Function for recipe categorization
 * Handles authentication and error handling
 */
export async function callGeminForCategorization(prompt: string): Promise<string[]> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User not authenticated. Cannot call Gemini API.');
  }

  let idToken: string | null = null;

  try {
    idToken = await user.getIdToken(true);
  } catch (error) {
    throw new Error('Failed to obtain authentication token for Gemini call.');
  }

  const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');

  const params: GenerateContentParameters = {
    model: 'gemini-2-5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      systemInstruction: 'You are the Head Chef analysing recipes to suggest appropriate categories. Return ONLY a JSON array of category IDs, nothing else.',
      responseMimeType: 'application/json',
    },
  };

  try {
    const result = await cloudGenerateContent({
      idToken,
      params,
    });

    const response = result.data as GenerateContentResponse;
    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error('Gemini categorization failed:', error);
    throw error;
  }
}

/**
 * Get system instruction for recipe categorization
 * Currently simple, but can be expanded with custom context
 */
export function getCategorizationSystemInstruction(): string {
  return 'You are the Head Chef analysing recipes to suggest appropriate categories. Return ONLY a JSON array of category IDs, nothing else.';
}
