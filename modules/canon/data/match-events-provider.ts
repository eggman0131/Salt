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

/**
 * Log a match event to Firestore.
 * Non-blocking: errors are logged but don't interrupt the matching pipeline.
 */
export async function logMatchEvent(
  event: Omit<CanonMatchEvent, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const db = getFirestore();
    const eventsRef = collection(db, MATCH_EVENTS_COLLECTION);

    const fullEvent = sanitizeForFirestore({
      ...event,
      timestamp: new Date().toISOString(),
    }) as Omit<CanonMatchEvent, 'id'>;

    // Use explicit IDs to avoid emulator addDoc auto-ID collision behaviour.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const eventRef = doc(eventsRef, createEventDocId());
        await setDoc(eventRef, fullEvent);
        return;
      } catch (writeError) {
        const canRetry = isAlreadyExistsError(writeError) && attempt < maxAttempts;
        if (!canRetry) {
          throw writeError;
        }
      }
    }
  } catch (error) {
    // Non-blocking: log error but don't throw
    console.error('[match-events] Failed to log event:', error);
  }
}

/**
 * Fetch match events with optional filters.
 * Used by the admin UI for performance analysis.
 */
export async function fetchMatchEvents(options: {
  entityId?: string;
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
