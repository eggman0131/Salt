/**
 * Firebase Canon Backend
 *
 * Implements canon persistence using Firebase Firestore.
 */

import { BaseCanonBackend } from './base-canon-backend';
import {
  Unit,
  Aisle,
  CanonicalItem,
  CoFIDGroupAisleMapping,
  IngredientMatchingConfig,
  MatchingEvent,
} from '../../../types/contract';
import { IngredientSemanticCandidate, SemanticScoreCluster } from './canon-backend.interface';
import { db, auth, functions } from '../../../shared/backend/firebase';
import { shoppingBackend } from '../../shopping';
import { recipesBackend } from '../../recipes';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, orderBy, query, writeBatch, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { debugLogger } from '../../../shared/backend/debug-logger';

const EMBED_BATCH_SIZE = 100;
const EMBED_DEBUG_LIMIT_TO_ONE_BATCH = false;
const EMBED_MODEL = 'text-embedding-005';
const FIRESTORE_BATCH_LIMIT = 100;
const COFID_IMPORT_BATCH_LIMIT = 100;

// Keyword-to-aisle mapping for fast enrichment pre-filtering
// Used to narrow down aisle suggestions before sending to LLM
const KEYWORD_TO_AISLE_MAP: Record<string, string[]> = {
  // Produce
  'apple|apples|banana|berries|berry|carrot|carrots|celery|courgette|cucumber|grape|lettuce|onion|onions|orange|potato|potatoes|tomato|tomatoes|spinach|broccoli|cabbage|cauliflower|leek|parsnip|beetroot|mushroom|mushrooms|aubergine|pepper|peppers|avocado|lime|lemon|strawberry|blueberry|raspberry|blackberry': 'Produce',
  // Meat & Fish
  'beef|chicken|lamb|pork|salmon|trout|cod|haddock|prawn|shrimp|crab|lobster|mince|steak|fillet|breast|turkey|duck|sausage|bacon|ham|chorizo|salami|anchovy|tuna|mackerel|sea bass': 'Meat & Fish',
  // Dairy
  'milk|yoghurt|yogurt|cheese|butter|cream|crème|ghee|whey|cheddar|mozzarella|parmesan|feta|ricotta': 'Dairy',
  // Bakery
  'bread|flour|baguette|ciabatta|sourdough|wholemeal|white bread|croissant|bagel|naan|pita|tortilla|yeast': 'Bakery',
  // Pantry
  'oil|vinegar|olive|salt|pepper|sugar|spice|soy|worcestershire|sriracha|pesto|jam|honey|mustard|ketchup|paste|rice|pasta|noodle|bean|lentil|chickpea|canned|tin|jar|herbs|oregano|thyme|basil|paprika|cumin|chilli': 'Pantry',
  // Frozen
  'frozen|ice|ice cream': 'Frozen',
};

type CofidEmbeddingCandidate = {
  docId: string;
  sourceId: string;
  text: string;
};

type EmbedBatchResult = {
  id: string;
  embedding: number[];
  modelVersion: string;
};

function normalizeEmbeddingArray(value: unknown): number[] {
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

/**
 * Computes cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) return 0;

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

export class FirebaseCanonBackend extends BaseCanonBackend {
  private currentIdToken: string | null = null;

  // ==================== AI TRANSPORT (Uses Cloud Functions) ====================

  protected async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;

    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }

    if (user) {
      try {
        idToken = await user.getIdToken(true);
        this.currentIdToken = idToken;
      } catch (e) {
        if (!idToken) throw e;
      }
    }

    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');

    const result = await cloudGenerateContent({
      idToken,
      params,
    });
    return result.data as GenerateContentResponse;
  }

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;

    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }

    if (user) {
      try {
        idToken = await user.getIdToken(true);
        this.currentIdToken = idToken;
      } catch (e) {
        if (!idToken) throw e;
      }
    }

    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContentStream = httpsCallable(functions, 'cloudGenerateContentStream');

    const result = await cloudGenerateContentStream({
      idToken,
      params,
    });
    return result.data as AsyncIterable<GenerateContentResponse>;
  }

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    return customContext || 'You are the Head Chef managing the canon of items, units, and aisles.';
  }

  private async getAuthTokenForHttp(): Promise<string> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;

    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call embedding endpoint.');
    }

    if (user) {
      try {
        idToken = await user.getIdToken(true);
        this.currentIdToken = idToken;
      } catch (e) {
        if (!idToken) throw e;
      }
    }

    if (!idToken) {
      throw new Error('Failed to obtain authentication token for embedding.');
    }

    return idToken;
  }

  private getEmbedBatchEndpointUrl(): string {
    const projectId = 'gen-lang-client-0015061880';
    const region = 'europe-west2';
    const host = location.hostname;

    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isCloudIDE = host.endsWith('.cloudworkstations.dev');

    if (isLocalhost) {
      return `http://127.0.0.1:5001/${projectId}/${region}/embedBatch`;
    }

    if (isCloudIDE) {
      return `${location.origin}/${projectId}/${region}/embedBatch`;
    }

    return `https://${region}-${projectId}.cloudfunctions.net/embedBatch`;
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private async embedCofidCandidates(candidates: CofidEmbeddingCandidate[]): Promise<{
    totalToEmbed: number;
    updatedCount: number;
    failureCount: number;
    failures: string[];
  }> {
    if (candidates.length === 0) {
      return {
        totalToEmbed: 0,
        updatedCount: 0,
        failureCount: 0,
        failures: [],
      };
    }

    const idToken = await this.getAuthTokenForHttp();
    const endpointUrl = this.getEmbedBatchEndpointUrl();
    const allEmbedChunks = this.chunkArray(candidates, EMBED_BATCH_SIZE);
    const embedChunks = EMBED_DEBUG_LIMIT_TO_ONE_BATCH
      ? allEmbedChunks.slice(0, 1)
      : allEmbedChunks;
    const idToDocIds = new Map<string, string[]>();
    const failures: string[] = [];
    const totalCandidates = embedChunks.reduce((count, chunk) => count + chunk.length, 0);
    let processedCount = 0;
    const startTime = Date.now();

    console.log(`🔤 Starting CoFID embedding: ${totalCandidates} items in ${embedChunks.length} batches`);
    if (EMBED_DEBUG_LIMIT_TO_ONE_BATCH) {
      console.warn('⚠️ EMBED_DEBUG_LIMIT_TO_ONE_BATCH is enabled: only the first embedding batch will be processed.');
    }

    for (const candidate of candidates) {
      const existing = idToDocIds.get(candidate.sourceId) ?? [];
      existing.push(candidate.docId);
      idToDocIds.set(candidate.sourceId, existing);
    }

    const updates: Array<{ docId: string; embedding: number[]; modelVersion: string }> = [];

    for (let chunkIndex = 0; chunkIndex < embedChunks.length; chunkIndex++) {
      const chunk = embedChunks[chunkIndex];
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          items: chunk.map((item) => ({ id: item.sourceId, text: item.text })),
        }),
      });

      if (!response.ok) {
        throw new Error(`embedBatch failed: HTTP ${response.status} ${response.statusText}`);
      }

      const payload = await response.json() as {
        results?: EmbedBatchResult[];
        failures?: Array<{ id: string; error: string }>;
      };

      if (Array.isArray(payload.failures) && payload.failures.length > 0) {
        const failureSummary = payload.failures
          .slice(0, 3)
          .map((f) => `${f.id}: ${f.error}`)
          .join('; ');
        console.warn(`embedBatch partial failures (${payload.failures.length}): ${failureSummary}`);
        for (const failure of payload.failures) {
          failures.push(`Embedding failed for ${failure.id}: ${failure.error}`);
        }
      }

      for (const result of payload.results ?? []) {
        const embedding = result.embedding as unknown;
        console.log(`[EMBED] Result ${result.id}: type=${typeof embedding}, isArray=${Array.isArray(embedding)}, keys=${Array.isArray(embedding) ? `length=${embedding.length}` : Object.keys(embedding as any)?.length ?? '?'}`);
        
        const normalizedEmbedding = normalizeEmbeddingArray(embedding);
        if (normalizedEmbedding.length === 0) {
          console.error(`[EMBED] Rejected ${result.id}: normalization returned ${normalizedEmbedding.length} values`);
          failures.push(`Embedding failed for ${result.id}: invalid embedding vector format returned`);
          continue;
        }

        console.log(`[EMBED] Accepted ${result.id}: normalized to ${normalizedEmbedding.length}-d vector`);
        const docIds = idToDocIds.get(result.id) ?? [];
        for (const docId of docIds) {
          updates.push({
            docId,
            embedding: normalizedEmbedding,
            modelVersion: result.modelVersion || EMBED_MODEL,
          });
        }
      }

      processedCount += chunk.length;
      const progressPercent = Math.round((processedCount / totalCandidates) * 100);
      console.log(`⏳ Embedding progress: ${processedCount}/${totalCandidates} (${progressPercent}%) - batch ${chunkIndex + 1}/${embedChunks.length}`);
    }

    const updateChunks = this.chunkArray(updates, FIRESTORE_BATCH_LIMIT);
    let firestoreUpdateCount = 0;

    for (let chunkIndex = 0; chunkIndex < updateChunks.length; chunkIndex++) {
      const updateChunk = updateChunks[chunkIndex];
      const batch = writeBatch(db);
      for (const update of updateChunk) {
        // CRITICAL: Force embedding to be a pure array before Firestore write
        // Array.isArray() can return true for array-like objects with numeric keys
        // that still serialize as maps, so always use Array.from() to guarantee a pure array
        let finalEmbedding: number[];
        if (Array.isArray(update.embedding)) {
          finalEmbedding = Array.from(update.embedding); // Force into pure array
        } else if (typeof update.embedding === 'object' && update.embedding !== null) {
          // Numeric-keyed object—convert
          finalEmbedding = Object.keys(update.embedding)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => (update.embedding as Record<string, any>)[k])
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        } else {
          finalEmbedding = [];
        }
        
        batch.update(doc(db, 'cofid', update.docId), {
          embedding: finalEmbedding,
          embeddingModel: update.modelVersion,
        });
      }
      await batch.commit();
      firestoreUpdateCount += updateChunk.length;

      if (updateChunks.length > 1) {
        const updatePercent = Math.round((firestoreUpdateCount / updates.length) * 100);
        console.log(`💾 Firestore updates: ${firestoreUpdateCount}/${updates.length} (${updatePercent}%) - batch ${chunkIndex + 1}/${updateChunks.length}`);
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`✅ CoFID embedding complete: ${updates.length} records updated in ${(elapsedMs / 1000).toFixed(1)}s`);

    return {
      totalToEmbed: totalCandidates,
      updatedCount: updates.length,
      failureCount: failures.length,
      failures,
    };
  }

  // ==================== SEMANTIC MATCHING HELPERS ====================

  /**
   * Embed a single text string using the embedBatch function
   */
  async embedText(text: string): Promise<{ embedding: number[] } | null> {
    try {
      const idToken = await this.getAuthTokenForHttp();
      const endpointUrl = this.getEmbedBatchEndpointUrl();
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          items: [{ id: 'single', text }],
        }),
      });

      if (!response.ok) {
        throw new Error(`embedBatch failed: HTTP ${response.status} ${response.statusText}`);
      }

      const payload = await response.json() as { results?: EmbedBatchResult[] };
      const embedding = payload.results?.[0]?.embedding;

      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        return { embedding: Array.from(embedding) };
      }
    } catch (error) {
      console.error('Error embedding text:', error);
    }
    return null;
  }

  /**
   * Get CoFID items that have embeddings
   */
  async getCofidItemsWithEmbeddings(): Promise<any[]> {
    const snapshot = await getDocs(collection(db, 'cofid'));
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((item: any) => item.embedding && Array.isArray(item.embedding));
  }

  /**
   * Search for semantic matches across Canon and CoFID items
   * Returns top N candidates sorted by cosine similarity
   */
  async searchSemanticCandidates(
    queryEmbedding: number[],
    candidateCount: number
  ): Promise<IngredientSemanticCandidate[]> {
    debugLogger.log('Ingredient Matching', `Searching semantic candidates (top ${candidateCount})`);

    const candidates: IngredientSemanticCandidate[] = [];

    // Search Canon items
    const canonItems = await this.getCanonicalItems();
    for (const item of canonItems) {
      if (item.embedding && Array.isArray(item.embedding) && item.embedding.length > 0) {
        const score = this.cosineSimilarity(queryEmbedding, item.embedding);
        candidates.push({
          id: item.id,
          name: item.name,
          source: 'canon',
          score,
          item,
        });
      }
    }

    // Search CoFID items
    const cofidItems = await this.getCofidItemsWithEmbeddings();
    for (const item of cofidItems) {
      const score = this.cosineSimilarity(queryEmbedding, item.embedding);
      candidates.push({
        id: item.id,
        name: item.name || item.Name || item.FoodName,
        source: 'cofid',
        score,
        item,
      });
    }

    // Sort by score descending and take top N
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, candidateCount);

    debugLogger.log(
      'Ingredient Matching',
      `Found ${candidates.length} total candidates (${canonItems.filter(i => i.embedding).length} Canon, ${cofidItems.length} CoFID)`
    );
    debugLogger.log(
      'Ingredient Matching',
      `Top ${topCandidates.length} candidates: ${topCandidates.map(c => `${c.name} (${c.source}, ${(c.score * 100).toFixed(1)}%)`).join(', ')}`
    );

    return topCandidates;
  }

  async analyzeSemanticMatch(
    candidates: IngredientSemanticCandidate[],
    config?: { gapThreshold?: number; clusterWindow?: number }
  ): Promise<SemanticScoreCluster> {
    const gapThreshold = config?.gapThreshold ?? 0.10;
    const clusterWindow = config?.clusterWindow ?? 0.05;

    if (candidates.length === 0) {
      return {
        topScore: 0,
        topCandidates: [],
        nextScore: null,
        scoreGap: 1,
        isAmbiguous: false,
        clusterSize: 0,
      };
    }

    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    const topCandidates = sorted.filter((c) => topScore - c.score <= clusterWindow);
    const next = sorted.find((c) => topScore - c.score > clusterWindow) || null;
    const scoreGap = next ? topScore - next.score : 1;

    return {
      topScore,
      topCandidates,
      nextScore: next?.score ?? null,
      scoreGap,
      isAmbiguous: scoreGap < gapThreshold,
      clusterSize: topCandidates.length,
    };
  }

  /**
   * Create canonical item from CoFID item (unapproved state)
   * Uses group->aisle mapping to determine aisle
   * Phase 5: Enriches externalSources.properties with full CoFID metadata
   */
  async createCanonicalItemFromCofid(
    cofidItem: any,
    auditTrail?: CanonicalItem['matchingAudit'],
    originalIngredientName?: string
  ): Promise<CanonicalItem> {
    // Extract group code (CoFID uses 1-3 letter codes)
    const cofidGroup = cofidItem.group || cofidItem.Group || cofidItem.FoodGroup || '';
    const aisle = await this.getAisleForCofidGroup(cofidGroup);

    // If no mapping found, use 'Other' as fallback
    const finalAisle = aisle || 'Other';

    // Ensure 'Other' aisle exists
    const aisles = await this.getAisles();
    if (!aisles.some(a => a.name === 'Other')) {
      await this.createAisle({
        name: 'Other',
        sortOrder: aisles.length
      });
    }

    // Phase 5: Extract rich CoFID metadata for externalSources.properties
    const cofidProperties = this.extractCofidProperties(cofidItem);

    // Collect synonyms: start with CoFID synonyms, add original ingredient name if provided
    let synonyms: string[] = [];
    if (cofidItem.synonyms && Array.isArray(cofidItem.synonyms)) {
      synonyms = [...cofidItem.synonyms];
    }
    // Add original ingredient name if provided and not already present
    if (originalIngredientName) {
      const normalized = originalIngredientName.toLowerCase();
      if (!synonyms.some(s => s.toLowerCase() === normalized)) {
        synonyms.push(originalIngredientName);
      }
    }

    const newItem = await this.createCanonicalItem({
      name: cofidItem.name || cofidItem.Name || cofidItem.FoodName,
      normalisedName: (cofidItem.name || cofidItem.Name || cofidItem.FoodName).toLowerCase(),
      aisle: finalAisle,
      preferredUnit: '', // Empty for now, can be enriched later
      isStaple: false,
      synonyms: synonyms.length > 0 ? synonyms : undefined,
      externalSources: [{
        source: 'cofid',
        externalId: cofidItem.id,
        confidence: 1.0, // Direct import, 100% confidence
        properties: cofidProperties, // Phase 5: Rich metadata storage
        syncedAt: new Date().toISOString(),
      }],
      approved: false, // Requires human review
      embedding: cofidItem.embedding,
      embeddingModel: cofidItem.embeddingModel || EMBED_MODEL,
      embeddedAt: cofidItem.embeddedAt || new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      matchingAudit: auditTrail, // Add audit trail if provided
    });

    return newItem;
  }

  /**
   * Phase 5: Extract comprehensive CoFID metadata for externalSources.properties
   * Captures all useful fields beyond basic identifiers (id, name, group, embedding)
   * 
   * Returns a structured object containing:
   * - Raw CoFID data (all source fields except system/internal ones)
   * - Organized access points for common use cases
   */
  private extractCofidProperties(cofidItem: any): Record<string, unknown> {
    // Fields to exclude (already stored elsewhere in Canon schema or system fields)
    const excludedFields = new Set([
      'id', 'name', 'Name', 'FoodName', 'normalisedName',
      'group', 'Group', 'FoodGroup',
      'embedding', 'embeddingModel', 'embeddedAt',
      'importedAt', // System field from import process
    ]);

    // Extract all non-excluded fields
    const rawData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(cofidItem)) {
      if (!excludedFields.has(key) && value !== undefined && value !== null) {
        rawData[key] = value;
      }
    }

    // Structured properties for common access patterns
    const properties: Record<string, unknown> = {
      // All raw CoFID data (nutrition, descriptors, metadata, etc.)
      raw: rawData,
      
      // Quick-access normalized fields (populated if present in source)
      foodCode: cofidItem.FoodCode || cofidItem.foodCode || cofidItem.code || null,
      foodGroup: cofidItem.group || cofidItem.Group || cofidItem.FoodGroup || null,
      
      // Metadata tracking
      extractedAt: new Date().toISOString(),
      extractionVersion: '1.0', // Version enrichment logic for future migrations
    };

    return properties;
  }

  // ==================== HELPER METHODS ====================

  private convertTimestamps(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const converted: any = Array.isArray(data) ? [] : {};

    for (const key in data) {
      const value = data[key];

      if (value && typeof value === 'object' && 'toDate' in value) {
        converted[key] = value.toDate().toISOString();
      } else if (value && typeof value === 'object') {
        converted[key] = this.convertTimestamps(value);
      } else {
        converted[key] = value;
      }
    }

    return converted;
  }

  // ==================== UNITS ====================

  async getUnits(): Promise<Unit[]> {
    const snapshot = await getDocs(query(
      collection(db, 'units'),
      orderBy('sortOrder', 'asc')
    ));
    const units: Unit[] = [];

    snapshot.forEach((docSnap) => {
      const data = this.convertTimestamps(docSnap.data());
      units.push({
        ...data,
        id: docSnap.id,
      } as Unit);
    });

    return units;
  }

  async createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit> {
    const now = new Date().toISOString();
    const newUnit: any = {
      ...unit,
      createdAt: now,
      sortOrder: unit.sortOrder ?? 999,
    };

    Object.keys(newUnit).forEach(key => {
      if (newUnit[key] === undefined) {
        delete newUnit[key];
      }
    });

    const id = `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'units', id), newUnit);

    return {
      ...newUnit,
      id,
    } as Unit;
  }

  async updateUnit(id: string, updates: Partial<Unit>): Promise<Unit> {
    const docRef = doc(db, 'units', id);

    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });

    await updateDoc(docRef, cleanUpdates);

    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Unit ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id,
    } as Unit;
  }

  async deleteUnit(id: string): Promise<void> {
    await deleteDoc(doc(db, 'units', id));
  }

  // ==================== AISLES ====================

  async getAisles(): Promise<Aisle[]> {
    const snapshot = await getDocs(query(
      collection(db, 'aisles'),
      orderBy('sortOrder', 'asc')
    ));
    const aisles: Aisle[] = [];

    snapshot.forEach((docSnap) => {
      const data = this.convertTimestamps(docSnap.data());
      aisles.push({
        ...data,
        id: docSnap.id,
      } as Aisle);
    });

    return aisles;
  }

  async createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle> {
    const now = new Date().toISOString();
    const newAisle: any = {
      ...aisle,
      createdAt: now,
      sortOrder: aisle.sortOrder ?? 999,
    };

    Object.keys(newAisle).forEach(key => {
      if (newAisle[key] === undefined) {
        delete newAisle[key];
      }
    });

    const id = `aisle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'aisles', id), newAisle);

    return {
      ...newAisle,
      id,
    } as Aisle;
  }

  async updateAisle(id: string, updates: Partial<Aisle>): Promise<Aisle> {
    const docRef = doc(db, 'aisles', id);

    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });

    await updateDoc(docRef, cleanUpdates);

    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Aisle ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id,
    } as Aisle;
  }

  async deleteAisle(id: string): Promise<void> {
    await deleteDoc(doc(db, 'aisles', id));
  }

  // ==================== INGREDIENT MATCHING CONFIG ====================

  async getIngredientMatchingConfig(): Promise<IngredientMatchingConfig> {
    try {
      const docSnap = await getDoc(doc(db, 'ingredient_matching_config', 'global'));
      if (docSnap.exists()) {
        return docSnap.data() as IngredientMatchingConfig;
      }
    } catch (e) {
      debugLogger.log('Canon.getIngredientMatchingConfig', 'Config fetch error:', e);
    }

    // Return hardcoded defaults if not found
    const defaults: IngredientMatchingConfig = {
      fuzzyHighConfidenceThreshold: 0.85,
      semanticHighThreshold: 0.90,
      semanticLowThreshold: 0.70,
      semanticGapThreshold: 0.10,
      semanticClusterWindow: 0.05,
      semanticCandidateCount: 5,
      llmBiasForExistingCanon: 0.05,
      allowNewCanonItems: true,
    };
    return defaults;
  }

  async updateIngredientMatchingConfig(updates: Partial<IngredientMatchingConfig>): Promise<IngredientMatchingConfig> {
    // Fetch current config first
    const current = await this.getIngredientMatchingConfig();

    // Merge updates
    const updated: IngredientMatchingConfig = {
      ...current,
      ...updates,
    };

    // Save to Firestore
    await setDoc(doc(db, 'ingredient_matching_config', 'global'), updated, { merge: false });

    debugLogger.log('Canon.updateIngredientMatchingConfig', 'Config updated', {
      fuzzyThreshold: updated.fuzzyHighConfidenceThreshold,
      semanticHighThreshold: updated.semanticHighThreshold,
      semanticLowThreshold: updated.semanticLowThreshold,
    });

    return updated;
  }

  // ==================== MATCHING EVENTS (Issue #79: Matching Observability) ====================

  async createMatchingEvent(event: Omit<MatchingEvent, 'id'>): Promise<MatchingEvent> {
    const docRef = doc(collection(db, 'matching_events'));
    const eventWithId: MatchingEvent = {
      ...event,
      id: docRef.id,
    };

    await setDoc(docRef, eventWithId);
    return eventWithId;
  }

  async getMatchingEvents(filters?: {
    runId?: string;
    recipeId?: string;
    startDate?: string;
    endDate?: string;
    outcome?: MatchingEvent['outcome'];
    limit?: number;
  }): Promise<MatchingEvent[]> {
    const collectionRef = collection(db, 'matching_events');
    const constraints: any[] = [orderBy('timestamp', 'desc')];

    // Apply filters
    if (filters?.runId) {
      constraints.push(where('runId', '==', filters.runId));
    }
    if (filters?.recipeId) {
      constraints.push(where('recipeId', '==', filters.recipeId));
    }
    if (filters?.startDate) {
      constraints.push(where('timestamp', '>=', filters.startDate));
    }
    if (filters?.endDate) {
      constraints.push(where('timestamp', '<=', filters.endDate));
    }
    if (filters?.outcome) {
      constraints.push(where('outcome', '==', filters.outcome));
    }

    const q = query(collectionRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const events: MatchingEvent[] = [];
    snapshot.forEach((docSnap) => {
      const data = this.convertTimestamps(docSnap.data());
      events.push({
        ...data,
        id: docSnap.id,
      } as MatchingEvent);
    });

    // Apply limit if specified (Firestore doesn't support limit with multiple where clauses easily)
    if (filters?.limit && events.length > filters.limit) {
      return events.slice(0, filters.limit);
    }

    return events;
  }

  async deleteMatchingEventsOlderThan(cutoffDate: string): Promise<{ deletedCount: number }> {
    const collectionRef = collection(db, 'matching_events');
    const q = query(collectionRef, where('timestamp', '<', cutoffDate));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { deletedCount: 0 };
    }

    // Delete in batches
    const batches: any[] = [];
    let currentBatch = writeBatch(db);
    let batchCount = 0;
    let totalCount = 0;

    snapshot.forEach((docSnap) => {
      currentBatch.delete(docSnap.ref);
      batchCount++;
      totalCount++;

      if (batchCount >= FIRESTORE_BATCH_LIMIT) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        batchCount = 0;
      }
    });

    // Add remaining batch if it has items
    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches
    await Promise.all(batches.map(batch => batch.commit()));

    debugLogger.log('Canon.deleteMatchingEventsOlderThan', `Deleted ${totalCount} events older than ${cutoffDate}`);
    return { deletedCount: totalCount };
  }

  // ==================== CANONICAL ITEMS ====================

  async getCanonicalItems(): Promise<CanonicalItem[]> {
    const snapshot = await getDocs(collection(db, 'canonical_items'));
    const items: CanonicalItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = this.convertTimestamps(docSnap.data());
      items.push({
        ...data,
        id: docSnap.id,
      } as CanonicalItem);
    });

    return items;
  }

  async getCanonicalItem(id: string): Promise<CanonicalItem | null> {
    const docRef = doc(db, 'canonical_items', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id,
    } as CanonicalItem;
  }

  async createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem> {
    await this.validateItemNameUniqueness(item.name);

    const validSynonyms = await this.filterValidSynonyms(item.synonyms);
    if (validSynonyms.length > 0) {
      await this.validateUniqueSynonyms(validSynonyms);
    }

    const now = new Date().toISOString();
    const newItem: any = {
      ...item,
      createdAt: now,
      isStaple: item.isStaple ?? false,
      approved: item.approved ?? true, // User-created items are approved by default
      synonyms: validSynonyms,
    };

    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'canonical_items', id), newItem);

    const createdItem = {
      ...newItem,
      id,
    } as CanonicalItem;

    // Embed the item asynchronously
    this.embedCanonicalItems([id]).catch(error => {
      console.error(`Failed to embed item ${id}:`, error);
    });

    return createdItem;
  }

  async updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem> {
    if (updates.name !== undefined) {
      await this.validateItemNameUniqueness(updates.name, id);
    }

    let finalUpdates = { ...updates };
    if (updates.synonyms !== undefined) {
      const validSynonyms = await this.filterValidSynonyms(updates.synonyms, id);
      finalUpdates = { ...finalUpdates, synonyms: validSynonyms };
    }

    const docRef = doc(db, 'canonical_items', id);

    const cleanUpdates: any = { ...finalUpdates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });

    await updateDoc(docRef, cleanUpdates);

    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Canonical item ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id,
    } as CanonicalItem;
  }

  async deleteCanonicalItem(id: string): Promise<void> {
    await this.deleteCanonicalItems([id]);
  }

  async deleteCanonicalItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const batch = writeBatch(db);

    for (const id of ids) {
      batch.delete(doc(db, 'canonical_items', id));
    }

    await batch.commit();

    // Notify dependent modules to unlink references
    await Promise.all([
      shoppingBackend.onCanonItemsDeleted(ids),
      recipesBackend.onCanonItemsDeleted(ids),
    ]);
  }

  // ==================== IMPACT ASSESSMENT & HEALING ====================

  async assessItemDeletion(ids: string[]): Promise<{
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }> {
    const idsSet = new Set(ids);
    const affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[] = [];

    const recipesSnap = await getDocs(collection(db, 'recipes'));
    recipesSnap.forEach((recipeDoc) => {
      const data = this.convertTimestamps(recipeDoc.data());
      const recipe = data as any; // Recipe type
      if (!recipe.ingredients?.length) return;

      const affectedIndices: number[] = [];
      recipe.ingredients.forEach((ing: any, idx: number) => {
        if (ing.canonicalItemId && idsSet.has(ing.canonicalItemId)) {
          affectedIndices.push(idx);
        }
      });

      if (affectedIndices.length > 0) {
        affectedRecipes.push({
          id: recipeDoc.id,
          title: recipe.title || '(Untitled)',
          ingredientCount: affectedIndices.length,
          affectedIndices
        });
      }
    });

    return {
      itemIds: ids,
      affectedRecipes
    };
  }

  async healRecipeReferences(ids: string[], assessment: {
    itemIds: string[];
    affectedRecipes: { id: string; title: string; ingredientCount: number; affectedIndices: number[] }[];
  }): Promise<{
    recipesFixed: number;
    ingredientsProcessed: number;
    ingredientsRematched: number;
    ingredientsUnmatched: number;
    newCanonicalItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }>;
    recipesWithUnlinkedItems: Array<{ id: string; title: string; unlinkedCount: number }>;
  }> {
    const allItems = await this.getCanonicalItems();

    let recipesFixed = 0;
    let ingredientsProcessed = 0;
    let ingredientsRematched = 0;
    let ingredientsUnmatched = 0;
    const newItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }> = [];
    const recipesWithUnlinkedItems: Array<{ id: string; title: string; unlinkedCount: number }> = [];

    const batch = writeBatch(db);

    // Only process recipes that were affected by the deletion
    for (const assessedRecipe of assessment.affectedRecipes) {
      const recipeRef = doc(db, 'recipes', assessedRecipe.id);
      const recipeDoc = await getDoc(recipeRef);
      
      if (!recipeDoc.exists()) continue;
      
      const data = this.convertTimestamps(recipeDoc.data());
      const recipe = data as any; // Recipe type
      if (!recipe.ingredients?.length) continue;

      let recipeChanged = false;
      let unlinkedCount = 0;
      let finalUnlinkedCount = 0;

      // Step 1: Find unlinked ingredients (no canonicalItemId)
      const updatedIngredients = recipe.ingredients.map((ing: any) => {
        // Only try to re-match if ingredient is unlinked (no canonicalItemId)
        if (!ing.canonicalItemId) {
          unlinkedCount++;
          ingredientsProcessed++;
          
          // Step 2: Try to fuzzy match
          let bestMatch: CanonicalItem | null = null;
          let bestScore = 0;

          for (const candidate of allItems) {
            const score = this.fuzzyMatchLocal(
              ing.ingredientName.toLowerCase(),
              candidate.normalisedName
            );
            if (score > bestScore) {
              bestScore = score;
              bestMatch = candidate;
            }

            if (candidate.synonyms) {
              for (const syn of candidate.synonyms) {
                const synScore = this.fuzzyMatchLocal(
                  ing.ingredientName.toLowerCase(),
                  syn.toLowerCase()
                );
                if (synScore > bestScore) {
                  bestScore = synScore;
                  bestMatch = candidate;
                }
              }
            }
          }

          // Re-link if good match (85%+)
          if (bestScore >= 0.85 && bestMatch) {
            ingredientsRematched++;
            recipeChanged = true;
            return { ...ing, canonicalItemId: bestMatch.id };
          } else {
            // Leave unlinked for manual review
            ingredientsUnmatched++;
            finalUnlinkedCount++;
            recipeChanged = true;
            return ing;
          }
        }
        return ing;
      });

      if (recipeChanged && unlinkedCount > 0) {
        recipesFixed++;
        batch.update(recipeRef, { ingredients: updatedIngredients });
        
        // Track this recipe if it still has unlinked items
        if (finalUnlinkedCount > 0) {
          recipesWithUnlinkedItems.push({
            id: recipeDoc.id,
            title: recipe.title || '(Untitled)',
            unlinkedCount: finalUnlinkedCount
          });
        }
      }
    }

    await batch.commit();

    console.log(`✅ Healed ${recipesFixed} recipes: ${ingredientsRematched} rematched, ${ingredientsUnmatched} unmatched`);

    return {
      recipesFixed,
      ingredientsProcessed,
      ingredientsRematched,
      ingredientsUnmatched,
      newCanonicalItemsCreated: newItemsCreated,
      recipesWithUnlinkedItems
    };
  }

  private fuzzyMatchLocal(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistanceLocal(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistanceLocal(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  // ==================== AI ENRICHMENT ====================

  /**
   * Get relevant aisles for an ingredient using hybrid approach:
   * 1. If embedding provided, use semantic matching (reuses embedded from ingredient matching)
   * 2. Try keyword extraction (fast, ~50-100 tokens)
   * 3. Fall back to fuzzy matching if no good keyword match
   * Returns subset of all aisles to reduce LLM prompt size
   */
  private async getRelevantAisles(rawIngredientName: string, queryEmbedding?: number[]): Promise<string[]> {
    const allAisles = await this.getAisles();
    const aisleNames = allAisles.map(a => a.name);
    
    // Phase 1 (if available): Use cached embedding from semantic matching
    if (queryEmbedding && queryEmbedding.length > 0) {
      debugLogger.log('Ingredient Matching', `Using cached embedding for aisle filtering: "${rawIngredientName}"`);
      try {
        const candidates = await this.searchSemanticCandidates(queryEmbedding, 5);
        const semanticAisles = new Set<string>();
        
        for (const candidate of candidates) {
          if (candidate.item?.aisle) {
            semanticAisles.add(candidate.item.aisle);
          }
        }
        
        if (semanticAisles.size > 0) {
          const relevant = Array.from(semanticAisles);
          if (!relevant.includes('Other')) {
            relevant.push('Other');
          }
          debugLogger.log('Ingredient Matching', `Semantic aisle match for "${rawIngredientName}": ${relevant.join(', ')} (reused embedding)`);
          return relevant;
        }
      } catch (e) {
        debugLogger.log('Ingredient Matching', `Semantic aisle lookup failed for "${rawIngredientName}", falling back to keywords`);
      }
    }
    
    // Phase 2: Keyword extraction (fast)
    const normalized = rawIngredientName.toLowerCase();
    const keywordMatches = new Set<string>();
    
    for (const [keywords, aisle] of Object.entries(KEYWORD_TO_AISLE_MAP)) {
      const keywordList = keywords.split('|');
      if (keywordList.some(kw => normalized.includes(kw))) {
        keywordMatches.add(aisle);
      }
    }
    
    // If we got good keyword matches, return those + "Other" as fallback
    if (keywordMatches.size > 0) {
      const relevant = Array.from(keywordMatches);
      if (!relevant.includes('Other')) {
        relevant.push('Other');
      }
      return relevant;
    }
    
    // Phase 3: Fuzzy matching fallback (only if no embedding and no keywords)
    try {
      const matches = await this.getCanonicalItemsByFuzzyMatch(rawIngredientName, 5);
      const semanticAisles = new Set<string>();
      
      for (const match of matches) {
        if (match.item.aisle) {
          semanticAisles.add(match.item.aisle);
        }
      }
      
      if (semanticAisles.size > 0) {
        const relevant = Array.from(semanticAisles);
        if (!relevant.includes('Other')) {
          relevant.push('Other');
        }
        debugLogger.log('Ingredient Matching', `Fuzzy aisle match for "${rawIngredientName}": ${relevant.join(', ')}`);
        return relevant;
      }
    } catch (e) {
      debugLogger.log('Ingredient Matching', `Fuzzy aisle lookup failed for "${rawIngredientName}", using defaults`);
    }
    
    // Default: return all aisles (no context to narrow down)
    return aisleNames;
  }

  async enrichCanonicalItem(rawName: string, queryEmbedding?: number[]): Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }> {
    debugLogger.log('Ingredient Matching', `Enriching canonical item: "${rawName}"`);

    const instruction = await this.getSystemInstruction(
      "You are the Head Chef resolving ingredient names to canonical items."
    );

    // Get relevant aisles to reduce prompt size (hybrid: embedding first, then keywords, then fuzzy)
    const relevantAisles = await this.getRelevantAisles(rawName, queryEmbedding);
    const aisleConstraint = relevantAisles.join('|');
    
    debugLogger.log('Ingredient Matching', `Using ${relevantAisles.length} relevant aisle(s) for "${rawName}": ${aisleConstraint}`);

    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Resolve this ingredient name to a canonical item database entry.

INGREDIENT: ${rawName}

Return JSON object with:
{
  "name": "Canonical item name (title case)",
  "preferredUnit": "g|kg|ml|l| (empty string for countable items)",
  "aisle": "${aisleConstraint}",
  "isStaple": true/false,
  "synonyms": ["alternate name 1", "alternate name 2"]
}

RULES:
- Use British English (courgette not zucchini, aubergine not eggplant)
- Use metric units only
- Leave preferredUnit empty for countable things (eggs, onions, cans)
- Keep culinary identity descriptors (red onion, beef mince, whole milk)
- Remove size adjectives (small, medium, large)
- Capitalize properly (e.g., "Extra Virgin Olive Oil")

Return JSON object:`
        }]
      }],
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });

    const sanitized = this.sanitizeJson(response.text || '{}');
    const parsed = JSON.parse(sanitized);

    debugLogger.log('Ingredient Matching', `Enriched "${rawName}" -> "${parsed.name}" (unit: "${parsed.preferredUnit || 'countable'}", aisle: "${parsed.aisle || 'Other'}", staple: ${parsed.isStaple})`);

    // Ensure units and aisles exist (create if missing)
    if (parsed.preferredUnit) {
      const units = await this.getUnits();
      const unitExists = units.some((u: Unit) => u.name.toLowerCase() === parsed.preferredUnit.toLowerCase());
      if (!unitExists) {
        debugLogger.log('Ingredient Matching', `Creating unit "${parsed.preferredUnit}" during enrichment`);
        await this.createUnit({
          name: parsed.preferredUnit,
          sortOrder: units.length
        });
      }
    }

    if (parsed.aisle) {
      const aisles = await this.getAisles();
      const aisleExists = aisles.some((a: Aisle) => a.name.toLowerCase() === parsed.aisle.toLowerCase());
      if (!aisleExists) {
        debugLogger.log('Ingredient Matching', `Creating aisle "${parsed.aisle}" during enrichment`);
        await this.createAisle({
          name: parsed.aisle,
          sortOrder: aisles.length
        });
      }
    }

    return {
      name: parsed.name || rawName,
      preferredUnit: parsed.preferredUnit || undefined,
      aisle: parsed.aisle || undefined,
      isStaple: parsed.isStaple || false,
      synonyms: parsed.synonyms || []
    };
  }

  /**
   * Embed a batch of canonical items using Vertex AI
   * Stores embedding + model + timestamp back to Firestore
   */
  async embedCanonicalItems(itemIds: string[]): Promise<{ itemsEmbedded: number; itemsSkipped: number }> {
    if (itemIds.length === 0) return { itemsEmbedded: 0, itemsSkipped: 0 };

    const itemsToEmbed: { id: string; name: string }[] = [];
    
    for (const itemId of itemIds) {
      const item = await this.getCanonicalItem(itemId);
      if (item && !item.embedding) {
        itemsToEmbed.push({ id: itemId, name: item.name });
      }
    }

    if (itemsToEmbed.length === 0) {
      return { itemsEmbedded: 0, itemsSkipped: itemIds.length };
    }

    let itemsEmbedded = 0;
    const idToken = await this.getAuthTokenForHttp();
    const endpointUrl = this.getEmbedBatchEndpointUrl();

    // Embed in batches
    for (let i = 0; i < itemsToEmbed.length; i += EMBED_BATCH_SIZE) {
      const batch = itemsToEmbed.slice(i, i + EMBED_BATCH_SIZE);

      try {
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken,
            items: batch.map((item) => ({ id: item.id, text: item.name })),
          }),
        });

        if (!response.ok) {
          throw new Error(`embedBatch failed: HTTP ${response.status} ${response.statusText}`);
        }

        const payload = await response.json() as { results?: EmbedBatchResult[] };
        const resultMap = new Map((payload.results ?? []).map((entry) => [entry.id, entry]));

        const now = new Date().toISOString();
        const updateBatch = writeBatch(db);

        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const embeddingResult = resultMap.get(item.id);

          if (embeddingResult?.embedding) {
            const embedding = Array.from(embeddingResult.embedding);
            updateBatch.update(
              doc(db, 'canonical_items', item.id),
              {
                embedding,
                embeddingModel: EMBED_MODEL,
                embeddedAt: now,
              }
            );
            itemsEmbedded++;
          }
        }

        await updateBatch.commit();
      } catch (error) {
        console.error('Error embedding batch:', error);
        // Continue with next batch on error
      }
    }

    return { itemsEmbedded, itemsSkipped: itemIds.length - itemsEmbedded };
  }

  // ==================== COFID GROUP AISLE MAPPINGS ====================

  async getCofidGroupMappings(): Promise<CoFIDGroupAisleMapping[]> {
    const snapshot = await getDocs(collection(db, 'cofid_group_aisle_mappings'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoFIDGroupAisleMapping));
  }

  async createCofidGroupMapping(
    mapping: Omit<CoFIDGroupAisleMapping, 'id' | 'createdAt'>
  ): Promise<CoFIDGroupAisleMapping> {
    const id = `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newMapping = { ...mapping, createdAt: now };
    
    await setDoc(doc(db, 'cofid_group_aisle_mappings', id), newMapping);
    return { id, ...newMapping };
  }

  async updateCofidGroupMapping(
    id: string,
    updates: Partial<CoFIDGroupAisleMapping>
  ): Promise<CoFIDGroupAisleMapping> {
    await updateDoc(doc(db, 'cofid_group_aisle_mappings', id), updates);
    const updated = await getDoc(doc(db, 'cofid_group_aisle_mappings', id));
    return { id, ...updated.data() } as CoFIDGroupAisleMapping;
  }

  async deleteCofidGroupMapping(id: string): Promise<void> {
    await deleteDoc(doc(db, 'cofid_group_aisle_mappings', id));
  }

  async importCoFIDGroupMappings(
    mappings: Array<Omit<CoFIDGroupAisleMapping, 'id' | 'createdAt'>>
  ): Promise<{
    mappingsImported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let mappingsImported = 0;

    try {
      const now = new Date().toISOString();
      const batches: any[] = [];
      let currentBatch = writeBatch(db);
      let batchCount = 0;

      // Get all existing aisles to check for duplicates
      const existingAisles = await this.getAisles();
      const aisleNames = new Map(existingAisles.map(a => [a.name.toLowerCase(), a]));
      let nextAisleSortOrder = existingAisles.length;

      // Iterate through mappings and add to batch
      for (const mapping of mappings) {
        try {
          // Step 1: Always ensure aisle exists (create if missing) - regardless of mapping status
          const aisleLower = mapping.aisle.toLowerCase();
          let aisle = aisleNames.get(aisleLower);

          if (!aisle) {
            // Aisle doesn't exist, create it
            const newAisleId = `aisle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newAisle = {
              name: mapping.aisle,
              sortOrder: nextAisleSortOrder++,
              createdAt: now,
            };
            currentBatch.set(doc(db, 'aisles', newAisleId), newAisle);
            aisle = { ...newAisle, id: newAisleId } as Aisle;
            aisleNames.set(aisleLower, aisle);
            console.log(`Created new aisle "${mapping.aisle}" for CoFID group ${mapping.cofidGroup}`);
            batchCount++;
          }

          // Step 2: Check if mapping already exists (to avoid duplicates)
          const existingQuery = query(
            collection(db, 'cofid_group_aisle_mappings'),
            where('cofidGroup', '==', mapping.cofidGroup)
          );
          const existingDocs = await getDocs(existingQuery);

          if (existingDocs.empty) {
            // Create mapping
            const mappingId = `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newMapping = { ...mapping, createdAt: now };
            currentBatch.set(doc(db, 'cofid_group_aisle_mappings', mappingId), newMapping);
            batchCount++;
            mappingsImported++;
          } else {
            // Skip duplicate (already exists)
            console.log(`CoFID group ${mapping.cofidGroup} already mapped, skipping`);
          }

          // Commit batch when it reaches the limit (Firestore limit is 500 operations)
          if (batchCount === 100) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        } catch (err) {
          errors.push(
            `Failed to import mapping for ${mapping.cofidGroup}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        batches.push(currentBatch);
      }

      // Execute all batches
      for (const batch of batches) {
        await batch.commit();
      }

      console.log(`Successfully imported ${mappingsImported} CoFID group mappings (${errors.length} errors)`);
      return { mappingsImported, errors };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`CoFID group mapping import failed: ${errorMsg}`);
      console.error('CoFID group mapping import error:', err);
      return { mappingsImported, errors };
    }
  }

  /**
   * Seed units from canonical data (safe for production)
   * - Checks for existing units by name (case-insensitive)
   * - Only creates units that don't already exist
   * - Preserves existing customizations
   * - Safe to run multiple times
   */
  async seedUnits(
    units: Array<Omit<Unit, 'id' | 'createdAt'>>
  ): Promise<{
    unitsImported: number;
    unitsSkipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let unitsImported = 0;
    let unitsSkipped = 0;

    try {
      const now = new Date().toISOString();
      let currentBatch = writeBatch(db);
      let batchCount = 0;

      // Get all existing units to check for duplicates by name
      const existingUnits = await this.getUnits();
      const existingNames = new Map(existingUnits.map(u => [u.name.toLowerCase(), u]));

      // Iterate through seed units
      for (const unit of units) {
        try {
          const nameLower = unit.name.toLowerCase();

          // Check if unit already exists by name
          if (existingNames.has(nameLower)) {
            unitsSkipped++;
            console.log(`Unit "${unit.name}" already exists, skipping`);
            continue;
          }

          // Create new unit
          const unitId = unit.name; // Use name as ID for consistency
          const newUnit = {
            ...unit,
            createdAt: now,
          };

          currentBatch.set(doc(db, 'units', unitId), newUnit);
          existingNames.set(nameLower, { ...newUnit, id: unitId } as Unit);
          batchCount++;
          unitsImported++;

          // Commit batch when it reaches the limit
          if (batchCount >= 100) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        } catch (err) {
          errors.push(
            `Failed to seed unit "${unit.name}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await currentBatch.commit();
      }

      console.log(
        `Successfully seeded ${unitsImported} units (${unitsSkipped} existing, ${errors.length} errors)`
      );
      return { unitsImported, unitsSkipped, errors };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Unit seeding failed: ${errorMsg}`);
      console.error('Unit seeding error:', err);
      return { unitsImported, unitsSkipped, errors };
    }
  }

  /**
   * Get aisle for a CoFID group code, returns null if no mapping found
   */
  private async getAisleForCofidGroup(cofidGroup: string): Promise<string | null> {
    const mappings = await this.getCofidGroupMappings();
    const mapping = mappings.find(m => m.cofidGroup.toLowerCase() === cofidGroup.toLowerCase());
    return mapping?.aisle || null;
  }

  // ==================== COFID DATA IMPORT ====================

  async importCoFIDData(data: any[]): Promise<{
    itemsImported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let itemsImported = 0;

    try {
      // Step 1: Clear existing CoFID collection
      const existingDocs = await getDocs(collection(db, 'cofid'));
      
      if (existingDocs.size > 0) {
        const deleteBatches: any[] = [];
        let currentBatch = writeBatch(db);
        let batchCount = 0;

        existingDocs.forEach((docSnap) => {
          currentBatch.delete(doc(db, 'cofid', docSnap.id));
          batchCount++;

          if (batchCount === COFID_IMPORT_BATCH_LIMIT) {
            deleteBatches.push(currentBatch);
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        });

        if (batchCount > 0) {
          deleteBatches.push(currentBatch);
        }

        for (const batch of deleteBatches) {
          await batch.commit();
        }
      }

      // Step 2: Import new data in smaller batches to avoid transport payload errors.
      const importBatches: any[] = [];
      let currentBatch = writeBatch(db);
      let batchCount = 0;
      const embeddingCandidates: CofidEmbeddingCandidate[] = [];

      const now = new Date().toISOString();

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        
        try {
          // Generate ID from FoodCode if available, otherwise use index
          const foodCode = item.FoodCode || item.foodCode || item.code;
          const id = foodCode 
            ? `cofid-${foodCode}-${Math.random().toString(36).substr(2, 9)}`
            : `cofid-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;

          // Add import timestamp
          const itemWithTimestamp = {
            ...item,
            importedAt: now
          };

          currentBatch.set(doc(db, 'cofid', id), itemWithTimestamp);

          const sourceId = item.id;
          const sourceName = item.name;

          if (typeof sourceId === 'string' && sourceId.trim() && typeof sourceName === 'string' && sourceName.trim()) {
            embeddingCandidates.push({
              docId: id,
              sourceId: sourceId.trim(),
              text: sourceName.trim(),
            });
          } else {
            const reason = !sourceId ? 'missing id' : !sourceName ? 'missing name' : 'empty strings';
            errors.push(`Item ${i}: skipped embedding (${reason})`);
            console.debug(`CoFID item ${i} skipped for embedding: id=${sourceId}, name=${sourceName}`);
          }

          batchCount++;
          itemsImported++;

          if (batchCount === COFID_IMPORT_BATCH_LIMIT) {
            importBatches.push(currentBatch);
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        } catch (err) {
          const errorMsg = `Item ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error('CoFID import error:', errorMsg);
        }
      }

      if (batchCount > 0) {
        importBatches.push(currentBatch);
      }

      // Commit all batches
      for (const batch of importBatches) {
        await batch.commit();
      }

      // Step 3: Embed imported records by name using unique item id.
      console.log(`🔍 Checking for embedding candidates: ${embeddingCandidates.length} items collected`);
      if (embeddingCandidates.length > 0) {
        try {
          const embeddingResult = await this.embedCofidCandidates(embeddingCandidates);
          errors.push(...embeddingResult.failures);
          console.log(`📋 Embedding summary: ${embeddingResult.updatedCount}/${embeddingResult.totalToEmbed} records embedded, ${embeddingResult.failureCount} failures`);
        } catch (embedError) {
          const errorMsg = embedError instanceof Error ? embedError.message : 'Unknown embedding error';
          errors.push(`Embedding phase failed: ${errorMsg}`);
          console.error('❌ CoFID embedding failed:', errorMsg);
        }
      } else {
        console.warn('⚠️ No embedding candidates found. Check that CoFID records have valid `id` and `name` string fields.');
      }

      console.log(`✅ CoFID import complete: ${itemsImported} items imported, ${errors.length} errors`);

      return {
        itemsImported,
        errors
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during import';
      errors.push(errorMsg);
      throw new Error(`CoFID import failed: ${errorMsg}`);
    }
  }
}
