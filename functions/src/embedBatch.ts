import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { GoogleGenAI, EmbedContentResponse } from '@google/genai';
import type { Request, Response } from 'express';

const MODEL_VERSION = 'text-embedding-005';
const MAX_BATCH_SIZE = 100;

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();

interface EmbedItem {
  id: string;
  text: string;
}

interface EmbedSuccess {
  id: string;
  embedding: number[];
  modelVersion: typeof MODEL_VERSION;
}

interface EmbedFailure {
  id: string;
  error: string;
}

interface EmbedBatchRequestBody {
  idToken?: string;
  items?: EmbedItem[];
}

async function validateRequest(idToken: string): Promise<{ uid: string; email: string }> {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    };
  } catch {
    throw new Error('Invalid or missing authentication token');
  }
}

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured in Cloud Functions environment');
  }
  return apiKey;
}

function chunkItems(items: EmbedItem[], size: number): EmbedItem[][] {
  const chunks: EmbedItem[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parseEmbedding(response: EmbedContentResponse, index: number): number[] {
  const values = response.embeddings?.[index]?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Embedding response did not contain vector values');
  }
  return values;
}

const embedBatch = onRequest({ region: 'europe-west2' }, async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const { idToken, items } = req.body as EmbedBatchRequestBody;

  if (!idToken) {
    res.status(400).json({ error: 'Missing idToken' });
    return;
  }

  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'Invalid request body. Expected items array.' });
    return;
  }

  if (items.length === 0) {
    res.status(400).json({ error: 'items must not be empty' });
    return;
  }

  await validateRequest(idToken);

  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const results: EmbedSuccess[] = [];
  const failures: EmbedFailure[] = [];

  const validItems: EmbedItem[] = [];
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') {
      failures.push({
        id: typeof item?.id === 'string' ? item.id : 'unknown',
        error: 'Invalid item shape. Expected { id: string, text: string }',
      });
      continue;
    }

    if (!item.text.trim()) {
      failures.push({ id: item.id, error: 'Text must not be empty' });
      continue;
    }

    validItems.push(item);
  }

  const batches = chunkItems(validItems, MAX_BATCH_SIZE);

  for (const batch of batches) {
    try {
      const response = await ai.models.embedContent({
        model: MODEL_VERSION,
        contents: batch.map((item) => item.text),
      });

      for (let i = 0; i < batch.length; i += 1) {
        const item = batch[i];
        try {
          const embedding = parseEmbedding(response, i);
          results.push({
            id: item.id,
            embedding,
            modelVersion: MODEL_VERSION,
          });
        } catch (error) {
          failures.push({
            id: item.id,
            error: error instanceof Error ? error.message : 'Failed to parse embedding response',
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch embedding request failed';
      for (const item of batch) {
        failures.push({ id: item.id, error: message });
      }
    }
  }

  // Future extension point: add Firestore persistence here if needed.
  res.status(200).json({
    modelVersion: MODEL_VERSION,
    maxBatchSize: MAX_BATCH_SIZE,
    totalRequested: items.length,
    successCount: results.length,
    failureCount: failures.length,
    results,
    failures,
  });
});

module.exports = {
  embedBatch,
};
