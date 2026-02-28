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
} from '../../../types/contract';
import { db, auth, functions } from '../../../shared/backend/firebase';
import { shoppingBackend } from '../../shopping';
import { recipesBackend } from '../../recipes';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, orderBy, query, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

const EMBED_BATCH_SIZE = 100;
const EMBED_DEBUG_LIMIT_TO_ONE_BATCH = false;
const EMBED_MODEL = 'text-embedding-005';
const FIRESTORE_BATCH_LIMIT = 100;
const COFID_IMPORT_BATCH_LIMIT = 100;

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
      synonyms: validSynonyms,
    };

    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'canonical_items', id), newItem);

    return {
      ...newItem,
      id,
    } as CanonicalItem;
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
            const score = this.fuzzyMatch(
              ing.ingredientName.toLowerCase(),
              candidate.normalisedName
            );
            if (score > bestScore) {
              bestScore = score;
              bestMatch = candidate;
            }

            if (candidate.synonyms) {
              for (const syn of candidate.synonyms) {
                const synScore = this.fuzzyMatch(
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

  private fuzzyMatch(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
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

  async enrichCanonicalItem(rawName: string): Promise<{
    name: string;
    preferredUnit?: string;
    aisle?: string;
    isStaple: boolean;
    synonyms: string[];
  }> {
    const instruction = await this.getSystemInstruction(
      "You are the Head Chef resolving ingredient names to canonical items."
    );

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
  "aisle": "Produce|Meat & Fish|Dairy|Bakery|Pantry|Frozen|Other",
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

    // Ensure units and aisles exist (create if missing)
    if (parsed.preferredUnit) {
      const units = await this.getUnits();
      const unitExists = units.some((u: Unit) => u.name.toLowerCase() === parsed.preferredUnit.toLowerCase());
      if (!unitExists) {
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
