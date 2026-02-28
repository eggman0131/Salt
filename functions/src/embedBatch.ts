import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const MODEL_VERSION = 'text-embedding-005';
const MAX_BATCH_SIZE = 100;
const PROJECT_ID = 'gen-lang-client-0015061880';
const LOCATION = 'us-central1';

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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function coerceToNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^\d+$/.test(key))
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, item]) => item)
      .filter((item): item is number => typeof item === 'number' && Number.isFinite(item));

    if (entries.length > 0) {
      return entries;
    }
  }

  return [];
}

async function embedTextsWithVertexAI(texts: string[]): Promise<number[][]> {
  const aiplatform = require('@google-cloud/aiplatform');
  const { PredictionServiceClient } = aiplatform.v1;
  const { helpers } = aiplatform;

  const client = new PredictionServiceClient({ apiEndpoint: `${LOCATION}-aiplatform.googleapis.com` });

  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/text-embedding-005`;

  const instances = texts.map((text) => helpers.toValue({
    content: text,
  }));

  const request = {
    endpoint,
    instances,
    parameters: helpers.toValue({
      autoTruncate: true,
    }),
  };

  try {
    const [response] = await client.predict(request);

    if (!response.predictions || response.predictions.length === 0) {
      throw new Error('Empty predictions from Vertex AI embedding API');
    }

    return response.predictions.map((pred: any, idx: number) => {
      console.log(`[DEBUG] Prediction ${idx} keys:`, Object.keys(pred).slice(0, 10));
      console.log(`[DEBUG] Prediction ${idx} structValue exists:`, !!pred?.structValue);
      console.log(`[DEBUG] Prediction ${idx} embeddings exists:`, !!pred?.embeddings);
      
      // Try multiple paths to extract embeddings
      let embedding: number[] = [];

      // Path 1: nested protobuf structure
      if (!embedding.length) {
        const listValues = pred?.structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values;
        if (Array.isArray(listValues)) {
          embedding = listValues
            .map((v: any) => v?.numberValue)
            .filter((v: unknown): v is number => typeof v === 'number' && Number.isFinite(v));
          console.log(`[DEBUG] Pred ${idx}: extracted ${embedding.length} from listValues (protobuf path)`);
        }
      }

      // Path 2: direct embeddings.values
      if (!embedding.length) {
        const vals = pred?.embeddings?.values;
        console.log(`[DEBUG] Pred ${idx}: embeddings.values type=${typeof vals}, isArray=${Array.isArray(vals)}, constructor=${vals?.constructor?.name}`);
        if (vals) {
          console.log(`[DEBUG] Pred ${idx}: embeddings.values keys (first 5):`, Object.keys(vals).slice(0, 5));
        }
        embedding = coerceToNumberArray(vals);
        if (embedding.length > 0) {
          console.log(`[DEBUG] Pred ${idx}: extracted ${embedding.length} from embeddings.values via coercion`);
        }
      }

      // Path 3: coerce entire prediction
      if (!embedding.length) {
        embedding = coerceToNumberArray(pred);
        if (embedding.length > 0) {
          console.log(`[DEBUG] Pred ${idx}: extracted ${embedding.length} from pred via coercion`);
        }
      }

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding format from Vertex AI');
      }

      // CRITICAL: Force to pure JavaScript array
      const pure = Array.from(embedding);
      console.log(`[DEBUG] Pred ${idx}: final pure array length=${pure.length}, isArray=${Array.isArray(pure)}, constructor=${pure.constructor.name}`);
      return pure;
    });
  } catch (error) {
    const details = (error as any)?.details;
    const code = (error as any)?.code;
    const baseMessage = error instanceof Error ? error.message : 'Unknown embedding error';
    const message = [
      baseMessage,
      typeof code !== 'undefined' ? `code=${code}` : '',
      details ? `details=${details}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    throw new Error(`Vertex AI embedding failed: ${message}`);
  }
}

// Firebase Functions v2 region configuration
const functionsConfig = { region: 'europe-west2' };

export const embedBatch = functions.https.onRequest(
  functionsConfig,
  async (req: any, res: any) => {
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

    try {
      await validateRequest(idToken);
    } catch (error) {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }

    const results: EmbedSuccess[] = [];
    const failures: EmbedFailure[] = [];

    const validItems: Array<{ itemIndex: number; item: EmbedItem }> = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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

      validItems.push({ itemIndex: i, item });
    }

    const batches = chunkArray(validItems, MAX_BATCH_SIZE);

    for (const batch of batches) {
      try {
        const texts = batch.map((x) => x.item.text);
        const embeddings = await embedTextsWithVertexAI(texts);

        for (let i = 0; i < batch.length; i++) {
          const { item } = batch[i];
          const embedding = embeddings[i];

          // Force embedding to pure array (eliminates protobuf artifacts)
          const safeEmbedding = Array.isArray(embedding) ? embedding : [];

          if (safeEmbedding.length === 0) {
            failures.push({
              id: item.id,
              error: 'Embedding returned empty or invalid',
            });
            continue;
          }

          results.push({
            id: item.id,
            embedding: safeEmbedding,
            modelVersion: MODEL_VERSION,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Batch embedding request failed';
        for (const { item } of batch) {
          failures.push({ id: item.id, error: message });
        }
      }
    }

    res.status(200).json({
      modelVersion: MODEL_VERSION,
      maxBatchSize: MAX_BATCH_SIZE,
      totalRequested: items.length,
      successCount: results.length,
      failureCount: failures.length,
      results,
      failures,
    });
  }
);

module.exports = {
  embedBatch,
};
