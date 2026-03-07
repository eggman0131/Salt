/**
 * AI transport layer for recipe workflows.
 *
 * Handles Cloud Function calls for Gemini content generation and URL fetching.
 * Extracted from FirebaseRecipesBackend.
 */

import { auth, functions } from '../../../shared/backend/firebase';
import { httpsCallable } from 'firebase/functions';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import { SYSTEM_CORE } from '../../../shared/backend/prompts';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { getKitchenSettings } from './settings-provider';

let cachedIdToken: string | null = null;

async function getFreshIdToken(): Promise<string> {
  const user = auth.currentUser;

  if (!cachedIdToken && !user) {
    throw new Error('User not authenticated. Cannot call Gemini API.');
  }

  if (user) {
    try {
      cachedIdToken = await user.getIdToken(true);
    } catch (e) {
      if (!cachedIdToken) throw e;
    }
  }

  if (!cachedIdToken) {
    throw new Error('Failed to obtain authentication token.');
  }

  return cachedIdToken;
}

export async function callGenerateContent(
  params: GenerateContentParameters
): Promise<GenerateContentResponse> {
  debugLogger.log('callGenerateContent', 'Starting');

  const idToken = await getFreshIdToken();
  const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');

  try {
    const result = await cloudGenerateContent({ idToken, params });
    debugLogger.log('callGenerateContent', 'Success');
    return result.data as GenerateContentResponse;
  } catch (error) {
    debugLogger.error('callGenerateContent', 'Cloud Function error:', error);
    throw error;
  }
}

export async function callGenerateContentStream(
  params: GenerateContentParameters
): Promise<AsyncIterable<GenerateContentResponse>> {
  debugLogger.log('callGenerateContentStream', 'Starting');

  const idToken = await getFreshIdToken();
  const cloudGenerateContentStream = httpsCallable(
    functions,
    'cloudGenerateContentStream'
  );

  try {
    const result = await cloudGenerateContentStream({ idToken, params });
    const response = result.data as GenerateContentResponse;
    debugLogger.log('callGenerateContentStream', 'Success');
    return (async function* () {
      yield response;
    })();
  } catch (error) {
    debugLogger.error(
      'callGenerateContentStream',
      'Cloud Function error:',
      error
    );
    throw error;
  }
}

async function fetchUrlContentViaHttp(
  url: string,
  idToken: string
): Promise<string> {
  const projectId = 'gen-lang-client-0015061880';
  const region = 'europe-west2';
  const httpEndpointUrl = `https://${region}-${projectId}.cloudfunctions.net/cloudFetchRecipeUrlHttp`;

  debugLogger.log('fetchUrlContentViaHttp', 'Calling HTTP endpoint:', httpEndpointUrl);

  const response = await fetch(httpEndpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, url }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.success) {
    debugLogger.log('fetchUrlContentViaHttp', 'Success');
    return result.data as string;
  } else {
    throw new Error(result.error || 'Unknown error from HTTP endpoint');
  }
}

export async function fetchUrlContent(url: string): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User not authenticated. Cannot access recipe URLs.');
  }

  let idToken: string;
  try {
    idToken = await user.getIdToken(true);
    cachedIdToken = idToken;
  } catch (e) {
    debugLogger.error('fetchUrlContent', 'getIdToken failed:', e);
    throw new Error('Failed to obtain authentication token.');
  }

  const cloudFetchRecipeUrl = httpsCallable(functions, 'cloudFetchRecipeUrl');

  try {
    const result = await cloudFetchRecipeUrl({ idToken, url });
    debugLogger.log('fetchUrlContent', 'Success');
    return result.data as string;
  } catch (error: any) {
    debugLogger.error('fetchUrlContent', 'Cloud Function error:', error);

    if (
      error.code === 'internal' ||
      error.message?.includes('CORS') ||
      error.message?.includes('preflight') ||
      error.message?.includes('Failed to construct')
    ) {
      try {
        return await fetchUrlContentViaHttp(url, idToken);
      } catch (fallbackError) {
        debugLogger.error('fetchUrlContent', 'HTTP fallback also failed:', fallbackError);
        throw error;
      }
    }

    throw error;
  }
}

export async function getSystemInstruction(customContext?: string): Promise<string> {
  const settings = await getKitchenSettings();
  const houseRules = settings.directives
    ? `\nHOUSE RULES & PREFERENCES:\n${settings.directives}`
    : '';
  return `${SYSTEM_CORE}${houseRules}${customContext ? `\n\n${customContext}` : ''}`;
}
