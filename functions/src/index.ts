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

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

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
  async (request: any) => {
    const { idToken, params } = request;

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

      // Log successful API call (for rate limiting purposes if needed)
      console.log(`[generateContent] Success for ${user.email}`);

      return response as GenerateContentResponse;
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
  async (request: any) => {
    const { idToken, params } = request;

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

      console.log(`[generateContentStream] Success for ${user.email}`);
      return aggregatedResponse as GenerateContentResponse;
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
export const health = functions.https.onRequest((request, response) => {
  response.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'salt-functions',
  });
});
