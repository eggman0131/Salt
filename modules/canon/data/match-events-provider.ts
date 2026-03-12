/**
 * Canon Match Events Provider — Performance Monitoring & Analysis
 *
 * This module logs each stage of the CofID matching pipeline to Firestore
 * for performance analysis, troubleshooting, and future ML/AI optimization.
 *
 * Event Types:
 * - embedding-generation: Query embedding generation (timing, reuse)
 * - semantic-match: Cosine similarity search (results, scores)
 * - lexical-match: Levenshtein distance matching (results, scores)
 * - candidate-merge: Merging semantic + lexical results (deduplication)
 * - final-selection: User selects a specific match (manual confirmation)
 *
 * All events are stored in the `canon-match-events` Firestore collection.
 */

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import type { CanonMatchEvent } from '../types';

const MATCH_EVENTS_COLLECTION = 'canon-match-events';

/**
 * Recursively remove undefined values so Firestore accepts the payload.
 */
function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeForFirestore(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, sanitizeForFirestore(entryValue)]);

    return Object.fromEntries(entries);
  }

  return value;
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeCode = (error as { code?: string }).code;
  const maybeMessage = (error as { message?: string }).message ?? '';

  return maybeCode === 'already-exists' || maybeMessage.includes('ALREADY_EXISTS');
}

function createEventDocId(): string {
  const timestamp = Date.now().toString(36);

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${timestamp}-${crypto.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 14);
  return `${timestamp}-${random}`;
}

// ── Batched event queue ──────────────────────────────────────────────────────
// Events are queued in memory and flushed to Firestore in batches to avoid
// overwhelming the emulator with rapid individual writes during matching.

const EVENT_QUEUE: Array<{ id: string; data: Record<string, unknown> }> = [];
const FLUSH_BATCH_SIZE = 20;
let flushScheduled = false;

async function flushEventQueue(): Promise<void> {
  if (EVENT_QUEUE.length === 0) return;

  const db = getFirestore();
  const eventsRef = collection(db, MATCH_EVENTS_COLLECTION);

  // Drain in chunks of FLUSH_BATCH_SIZE (Firestore writeBatch limit is 500)
  while (EVENT_QUEUE.length > 0) {
    const chunk = EVENT_QUEUE.splice(0, FLUSH_BATCH_SIZE);
    try {
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(eventsRef, item.id), item.data);
      }
      await batch.commit();
    } catch (error) {
      console.error(`[match-events] Batch flush failed (${chunk.length} events dropped):`, error);
    }
  }
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  // Use microtask so events from the same synchronous flow are batched together
  queueMicrotask(() => {
    flushScheduled = false;
    flushEventQueue().catch(() => {});
  });
}

/**
 * Log a match event to Firestore.
 * Non-blocking: events are queued and flushed in batches.
 */
export async function logMatchEvent(
  event: Omit<CanonMatchEvent, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const fullEvent = sanitizeForFirestore({
      ...event,
      timestamp: new Date().toISOString(),
    }) as Record<string, unknown>;

    EVENT_QUEUE.push({ id: createEventDocId(), data: fullEvent });
    scheduleFlush();
  } catch (error) {
    console.error('[match-events] Failed to queue event:', error);
  }
}

/**
 * Flush any pending events immediately. Call at the end of a batch pipeline
 * to ensure all events are written before the operation completes.
 */
export async function flushMatchEvents(): Promise<void> {
  await flushEventQueue();
}

/**
 * Fetch match events with optional filters.
 * Used by the admin UI for performance analysis.
 */
export async function fetchMatchEvents(options: {
  entityId?: string;
  batchId?: string;
  eventType?: CanonMatchEvent['eventType'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}): Promise<CanonMatchEvent[]> {
  const db = getFirestore();
  const eventsRef = collection(db, MATCH_EVENTS_COLLECTION);

  const constraints: QueryConstraint[] = [];

  if (options.entityId) {
    constraints.push(where('entityId', '==', options.entityId));
  }

  if (options.batchId) {
    constraints.push(where('metrics.batchId', '==', options.batchId));
  }

  if (options.eventType) {
    constraints.push(where('eventType', '==', options.eventType));
  }

  if (options.startDate) {
    constraints.push(where('timestamp', '>=', options.startDate.toISOString()));
  }

  if (options.endDate) {
    constraints.push(where('timestamp', '<=', options.endDate.toISOString()));
  }

  // Always order by timestamp descending (newest first)
  constraints.push(orderBy('timestamp', 'desc'));

  if (options.limit) {
    constraints.push(firestoreLimit(options.limit));
  }

  const q = query(eventsRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CanonMatchEvent[];
}

/**
 * Get performance statistics for a given time period.
 * Returns aggregated metrics for dashboard display.
 */
export async function getMatchPerformanceStats(
  startDate: Date,
  endDate: Date
): Promise<{
  totalEvents: number;
  eventsByType: Record<CanonMatchEvent['eventType'], number>;
  avgDurationByType: Record<CanonMatchEvent['eventType'], number>;
  successRate: number;
  totalDuration: number;
}> {
  const events = await fetchMatchEvents({ startDate, endDate, limit: 10000 });

  const stats = {
    totalEvents: events.length,
    eventsByType: {} as Record<CanonMatchEvent['eventType'], number>,
    avgDurationByType: {} as Record<CanonMatchEvent['eventType'], number>,
    successRate: 0,
    totalDuration: 0,
  };

  // Initialize counters
  const durationSums: Record<CanonMatchEvent['eventType'], number> = {
    'ai-parse': 0,
    'parse-validation': 0,
    'match-decision': 0,
    'embedding-generation': 0,
    'semantic-match': 0,
    'lexical-match': 0,
    'candidate-merge': 0,
    'final-selection': 0,
  };

  const counts: Record<CanonMatchEvent['eventType'], number> = {
    'ai-parse': 0,
    'parse-validation': 0,
    'match-decision': 0,
    'embedding-generation': 0,
    'semantic-match': 0,
    'lexical-match': 0,
    'candidate-merge': 0,
    'final-selection': 0,
  };

  let successfulMatches = 0;
  let finalSelections = 0;

  for (const event of events) {
    const type = event.eventType;
    
    counts[type]++;
    durationSums[type] += event.metrics.durationMs;
    stats.totalDuration += event.metrics.durationMs;

    // Track success rate (events with results)
    if (event.eventType === 'final-selection') {
      finalSelections++;
      if (event.output.topMatchId) {
        successfulMatches++;
      }
    }
  }

  // Calculate averages
  for (const type of Object.keys(counts) as CanonMatchEvent['eventType'][]) {
    stats.eventsByType[type] = counts[type];
    stats.avgDurationByType[type] = counts[type] > 0
      ? durationSums[type] / counts[type]
      : 0;
  }

  stats.successRate = finalSelections > 0
    ? successfulMatches / finalSelections
    : 0;

  return stats;
}

/**
 * Helper: Create a batch ID for grouping related events.
 */
export function createBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper: Start a performance timer.
 * Returns a function that, when called, returns the elapsed time in milliseconds.
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
