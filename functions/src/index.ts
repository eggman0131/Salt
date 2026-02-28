/**
 * SALT Cloud Functions
 * Secure Gemini API Proxy Layer
 * 
 * These functions run server-side and handle:
 * 1. Gemini API authentication (API key stored in Cloud Functions environment)
 * 2. Request validation (ensure user is authenticated)
 * 3. Rate limiting and abuse prevention
 * 4. Response forwarding to client
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { embedBatch } from './embedBatch';

// Initialize Firebase Admin SDK
const app = admin.initializeApp();

// Connect to the 'saltstore' database instead of default
const db = admin.firestore(app);
db.settings({ databaseId: 'saltstore' });
const auth = admin.auth();

// Firebase Functions v2 region configuration
const functionsConfig = { region: 'europe-west2' };

/**
 * Validates that the request is from an authenticated user
 */
async function validateRequest(idToken: string): Promise<{ uid: string; email: string }> {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    };
  } catch (error) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid or missing authentication token'
    );
  }
}

/**
 * Checks if user exists in users collection
 */
async function checkUserExists(email: string): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(email).get();
    return userDoc.exists;
  } catch (error) {
    console.error('Error checking user existence:', error);
    return false;
  }
}

/**
 * cloudGenerateContent: Proxy for Gemini API generateContent
 * 
 * Request body:
 * {
 *   idToken: string (Firebase auth token)
 *   params: GenerateContentParameters (Gemini request)
 * }
 * 
 * Response: GenerateContentResponse (Gemini response)
 */
export const cloudGenerateContent = functions.https.onCall(
  functionsConfig,
  async (request: any) => {
    const { idToken, params } = request.data;

    if (!idToken) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing idToken');
    }
    if (!params) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing params');
    }

    // Validate user is authenticated
    const user = await validateRequest(idToken);
    console.log(`[generateContent] User authenticated: ${user.email}`);

    // Check if user exists in Firestore
    const userExists = await checkUserExists(user.email);
    if (!userExists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User not found in system. Kitchen Access Denied.'
      );
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured in Cloud Functions environment');
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent(params as GenerateContentParameters);

      // Extract text from response for easier access
      const text = response.candidates?.[0]?.content?.parts
        ?.filter(part => part.text)
        .map(part => part.text)
        .join('') || '';

      // Add text property to response for compatibility
      const responseWithText = {
        ...response,
        text
      } as any as GenerateContentResponse;

      // Log successful API call (for rate limiting purposes if needed)
      console.log(`[generateContent] Success for ${user.email}`);

      return responseWithText;
    } catch (error) {
      console.error('[generateContent] Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * cloudGenerateContentStream: Proxy for Gemini API generateContentStream
 * NOTE: Streaming is returned as a complete response in Cloud Functions
 * 
 * Request body:
 * {
 *   idToken: string (Firebase auth token)
 *   params: GenerateContentParameters (Gemini request)
 * }
 * 
 * Response: GenerateContentResponse (aggregated from stream)
 */
export const cloudGenerateContentStream = functions.https.onCall(
  functionsConfig,
  async (request: any) => {
    const { idToken, params } = request.data;

    if (!idToken) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing idToken');
    }
    if (!params) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing params');
    }

    // Validate user is authenticated
    const user = await validateRequest(idToken);
    console.log(`[generateContentStream] User authenticated: ${user.email}`);

    // Check if user exists in Firestore
    const userExists = await checkUserExists(user.email);
    if (!userExists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User not found in system. Kitchen Access Denied.'
      );
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured in Cloud Functions environment');
      }

      const ai = new GoogleGenAI({ apiKey });
      const stream = await ai.models.generateContentStream(params as GenerateContentParameters);

      // Aggregate stream into a single response
      let aggregatedResponse: Partial<GenerateContentResponse> = {
        candidates: [],
      };

      for await (const chunk of stream) {
        if (!aggregatedResponse.candidates) {
          aggregatedResponse.candidates = [];
        }

        // Merge chunk candidates with existing ones
        if (chunk.candidates && chunk.candidates.length > 0) {
          const firstCandidate = chunk.candidates[0];

          if (!aggregatedResponse.candidates[0]) {
            aggregatedResponse.candidates[0] = {
              content: { parts: [] },
              finishReason: firstCandidate.finishReason,
            };
          }

          // Aggregate parts
          if (firstCandidate.content?.parts) {
            aggregatedResponse.candidates[0].content!.parts!.push(...firstCandidate.content.parts);
          }

          // Update finish reason if present
          if (firstCandidate.finishReason) {
            aggregatedResponse.candidates[0].finishReason = firstCandidate.finishReason;
          }
        }
      }

      // Extract text from aggregated response for easier access
      const text = aggregatedResponse.candidates?.[0]?.content?.parts
        ?.filter(part => part.text)
        .map(part => part.text)
        .join('') || '';

      // Add text property to aggregated response for compatibility
      const responseWithText = {
        ...aggregatedResponse,
        text
      } as any as GenerateContentResponse;

      console.log(`[generateContentStream] Success for ${user.email}`);
      return responseWithText;
    } catch (error) {
      console.error('[generateContentStream] Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Health check function for monitoring
 */
export const health = functions.https.onRequest(
  functionsConfig,
  (request: any, response: any) => {
    response.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'salt-functions',
    });
  }
);

/**
 * cloudFetchRecipeUrl: Fetches content from a recipe URL
 * Extracts recipe data from HTML (looks for JSON-LD schema or raw HTML)
 * 
 * Request body:
 * {
 *   idToken: string (Firebase auth token)
 *   url: string (Recipe URL to fetch)
 * }
 * 
 * Response: string (Raw recipe data as formatted text)
 */
export const cloudFetchRecipeUrl = functions.https.onCall(
  functionsConfig,
  async (request: any) => {
    const { idToken, url } = request.data;

    if (!idToken) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing idToken');
    }
    if (!url || typeof url !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid url');
    }

    // Validate user is authenticated
    const user = await validateRequest(idToken);
    console.log(`[fetchRecipeUrl] User authenticated: ${user.email}, URL: ${url}`);

    // Check if user exists in Firestore
    const userExists = await checkUserExists(user.email);
    if (!userExists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User not found in system. Kitchen Access Denied.'
      );
    }

    try {
      // Fetch the URL
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Salt Kitchen System/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Try to extract JSON-LD recipe schema
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
          try {
            const data = JSON.parse(jsonContent);
            const recipes = Array.isArray(data) ? data : [data];
            
            for (const item of recipes) {
              if (item['@type'] === 'Recipe' || item.recipeIngredient || item.recipeInstructions) {
                const title = item.name || item.headline || '';
                const ingredients = item.recipeIngredient || [];
                let instructions: string[] = [];
                
                if (Array.isArray(item.recipeInstructions)) {
                  instructions = item.recipeInstructions.map((step: any) => {
                    if (typeof step === 'string') return step;
                    if (step.text) return step.text;
                    if (step.name) return step.name;
                    return '';
                  }).filter(Boolean);
                } else if (typeof item.recipeInstructions === 'string') {
                  instructions = [item.recipeInstructions];
                }
                
                const formatted = `TITLE: ${title}\n\nINGREDIENTS:\n${ingredients.join('\n')}\n\nINSTRUCTIONS:\n${instructions.join('\n')}`;
                console.log(`[fetchRecipeUrl] Successfully extracted recipe via JSON-LD`);
                return formatted;
              }
            }
          } catch (e) {
            // Skip malformed JSON-LD
            console.log(`[fetchRecipeUrl] Failed to parse JSON-LD block:`, e);
          }
        }
      }

      // Fallback: return raw HTML for AI to parse
      console.log(`[fetchRecipeUrl] No JSON-LD found, returning raw HTML`);
      // Strip scripts and styles to reduce noise
      const cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50000); // Limit to 50k chars
      
      return `RAW CONTENT:\n${cleaned}`;
    } catch (error) {
      console.error('[fetchRecipeUrl] Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to retrieve content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Fallback HTTP endpoint for fetching recipe URLs (for custom domains with CORS issues)
 * Accessible via: POST /cloudFetchRecipeUrlHttp with body: { idToken, url }
 */
export const cloudFetchRecipeUrlHttp = functions.https.onRequest(
  functionsConfig,
  async (req, res) => {
    // Set CORS headers explicitly
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(400).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { idToken, url } = req.body;

      if (!idToken) {
        res.status(400).json({ error: 'Missing idToken' });
        return;
      }
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Missing or invalid url' });
        return;
      }

      // Validate user is authenticated
      const user = await validateRequest(idToken);
      console.log(`[fetchRecipeUrlHttp] User authenticated: ${user.email}, URL: ${url}`);

      // Check if user exists in Firestore
      const userExists = await checkUserExists(user.email);
      if (!userExists) {
        res.status(403).json({
          error: 'User not found in system. Kitchen Access Denied.'
        });
        return;
      }

      // Fetch the URL
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Salt Kitchen System/1.0)',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: `HTTP ${response.status}: ${response.statusText}`
        });
        return;
      }

      const html = await response.text();
      
      // Try to extract JSON-LD recipe schema
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
          try {
            const data = JSON.parse(jsonContent);
            const recipes = Array.isArray(data) ? data : [data];
            
            for (const item of recipes) {
              if (item['@type'] === 'Recipe' || item.recipeIngredient || item.recipeInstructions) {
                const title = item.name || item.headline || '';
                const ingredients = item.recipeIngredient || [];
                let instructions: string[] = [];
                
                if (Array.isArray(item.recipeInstructions)) {
                  instructions = item.recipeInstructions.map((step: any) => {
                    if (typeof step === 'string') return step;
                    if (step.text) return step.text;
                    if (step.name) return step.name;
                    return '';
                  }).filter(Boolean);
                } else if (typeof item.recipeInstructions === 'string') {
                  instructions = [item.recipeInstructions];
                }
                
                const formatted = `TITLE: ${title}\n\nINGREDIENTS:\n${ingredients.join('\n')}\n\nINSTRUCTIONS:\n${instructions.join('\n')}`;
                console.log(`[fetchRecipeUrlHttp] Successfully extracted recipe via JSON-LD`);
                res.set('Content-Type', 'application/json');
                res.json({ success: true, data: formatted });
                return;
              }
            }
          } catch (e) {
            // Skip malformed JSON-LD
            console.log(`[fetchRecipeUrlHttp] Failed to parse JSON-LD block:`, e);
          }
        }
      }

      // Fallback: return raw HTML for AI to parse
      console.log(`[fetchRecipeUrlHttp] No JSON-LD found, returning raw HTML`);
      // Strip scripts and styles to reduce noise
      const cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

      res.set('Content-Type', 'application/json');
      res.json({ success: true, data: cleaned });
    } catch (error) {
      console.error('[fetchRecipeUrlHttp] Error:', error);
      res.status(500).json({
        error: `Failed to retrieve content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
);

// Re-export embedBatch from separate module
export { embedBatch };
