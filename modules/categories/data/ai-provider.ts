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
export async function callGeminForCategorization(
  prompt: string,
  systemInstruction: string
): Promise<string[]> {
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

  // Schema for guaranteed array of category IDs
  const responseSchema = {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array' as const,
        items: {
          type: 'string' as const,
        },
      },
    },
  };

  const params: GenerateContentParameters = {
    model: 'gemini-3-flash-lite',
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
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 256,
      thinkingLevel: 'low',
    },
  };

  try {
    const result = await cloudGenerateContent({
      idToken,
      params,
    });

    const response = result.data as GenerateContentResponse;
    const responseText = response.text || '{"results": []}';
    const parsed = JSON.parse(responseText);
    return parsed.results || [];
  } catch (error) {
    console.error('Gemini categorization failed:', error);
    throw error;
  }
}

/**
 * Legacy system instruction getter (kept for compatibility)
 */
export function getCategorizationSystemInstruction(): string {
  return 'You are the Head Chef analysing recipes to suggest appropriate categories. Return ONLY a JSON array of category IDs, nothing else.';
}
