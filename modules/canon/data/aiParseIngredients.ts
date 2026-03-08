/**
 * AI Parse Data Layer (I/O)
 *
 * Handles Cloud Function calls and Firestore reads for ingredient parsing.
 * All functions are async and handle I/O.
 */

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../../shared/backend/firebase';
import { AiParseResponse, AiSingleParseResult } from '../types';
import { AiRawParseResponseSchema } from '../logic/aiParseSchemas';
import type { GenerateContentResponse } from '@google/genai';
import { logMatchEvent, createBatchId, startTimer } from './match-events-provider';

interface PromptScaffold {
  systemInstruction: string;
}

const promptScaffoldCache = new Map<string, PromptScaffold>();

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function extractOuterJsonObject(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, '$1');
}

function normaliseSmartQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function stripJsonComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

function normaliseJsLiterals(text: string): string {
  return text
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null');
}

function quoteUnquotedKeys(text: string): string {
  // Converts patterns like {results: ...} and , index: ... into JSON-compliant keys.
  return text.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)(\s*:)/g, '$1"$2"$3');
}

function parseAiJsonWithRepair(rawText: string): { parsed: unknown; strategy: string } {
  const initial = normaliseSmartQuotes(stripCodeFences(rawText));
  const attempts: Array<{ strategy: string; value: string }> = [
    { strategy: 'direct', value: initial },
  ];

  const extracted = extractOuterJsonObject(initial);
  if (extracted && extracted !== initial) {
    attempts.push({ strategy: 'extract-object', value: extracted });
  }

  const extractedOrInitial = extracted ?? initial;
  attempts.push({
    strategy: 'remove-trailing-commas',
    value: removeTrailingCommas(extractedOrInitial),
  });
  attempts.push({
    strategy: 'quote-keys+remove-trailing-commas',
    value: removeTrailingCommas(quoteUnquotedKeys(extractedOrInitial)),
  });
  attempts.push({
    strategy: 'strip-comments+quote-keys+normalise-js-literals',
    value: removeTrailingCommas(
      quoteUnquotedKeys(normaliseJsLiterals(stripJsonComments(extractedOrInitial)))
    ),
  });

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return {
        parsed: JSON.parse(attempt.value),
        strategy: attempt.strategy,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to parse AI response as JSON after repair attempts');
}

function buildPromptScaffold(
  aisleDescriptions: Record<string, string>,
  unitDescriptions: Record<string, string>
): PromptScaffold {
  const aisleIds = Object.keys(aisleDescriptions).sort();
  const unitIds = Object.keys(unitDescriptions).sort();
  const cacheKey = `${aisleIds.join('|')}__${unitIds.join('|')}`;

  const cached = promptScaffoldCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const aisleNames = aisleIds.map(id => aisleDescriptions[id]);

  const unitNames = unitIds.map(id => unitDescriptions[id]);

  const systemInstruction = [
    'You are a British culinary data extractor. Standardise ingredients to UK metric conventions.',
    '',
    'Available units: ' + unitNames.join(', '),
    'Available aisles: ' + aisleNames.join(', '),
    '',
    'Rules:',
    '1. Units: Use ONLY from available units list. If not found, use null.',
    '2. Aisles: Use ONLY from available aisles list. Default to "Uncategorised".',
    '3. Formatting: Standardise units (e.g., "grams" -> "g"). Keep item to the core ingredient (e.g., "Maris Piper potatoes").',
    '4. Integrity: Do not invent data. If a quantity is missing, return null.',
  ].join('\n');

  const scaffold = {
    systemInstruction,
  };

  promptScaffoldCache.set(cacheKey, scaffold);
  return scaffold;
}

/**
 * Map natural language aisle/unit names to IDs.
 * Returns mapped result ready for validation.
 */
function mapNamesToIds(
  rawResult: any,
  aisleDescriptions: Record<string, string>,
  unitDescriptions: Record<string, string>
): AiSingleParseResult {
  // Build reverse lookup maps (name → id, case-insensitive)
  const aisleNameToId = new Map<string, string>();
  for (const [id, name] of Object.entries(aisleDescriptions)) {
    aisleNameToId.set(name.toLowerCase(), id);
  }

  const unitNameToId = new Map<string, string>();
  for (const [id, name] of Object.entries(unitDescriptions)) {
    unitNameToId.set(name.toLowerCase(), id);
  }

  // Map aisle name to ID
  const aisleName = String(rawResult.aisle || '').trim();
  const aisleId = aisleNameToId.get(aisleName.toLowerCase()) || 'uncategorised';
  const suggestedAisleName = aisleId === 'uncategorised' && aisleName ? aisleName : undefined;

  // Map unit name to ID
  const unitName = rawResult.unit ? String(rawResult.unit).trim() : null;
  const recipeUnitId = unitName ? unitNameToId.get(unitName.toLowerCase()) || null : null;

  // Map prep (single string or null) to preparations array
  const prepString = rawResult.prep ? String(rawResult.prep).trim() : '';
  const preparations = prepString ? [prepString] : [];

  // Map notes (single string or null) to notes array
  const notesString = rawResult.notes ? String(rawResult.notes).trim() : '';
  const notes = notesString ? [notesString] : [];

  return {
    index: rawResult.index,
    originalLine: rawResult.originalLine,
    itemName: rawResult.item,
    quantity: rawResult.quantity ?? null,
    recipeUnitId,
    aisleId,
    suggestedAisleName,
    preparations,
    notes,
  };
}

/**
 * Call the AI parse Cloud Function.
 * 
 * Args:
 *   - lines: array of ingredient lines to parse
 *   - aisleDescriptions: map of aisle id → name (for schema description)
 *   - unitDescriptions: map of unit id → name
 * 
 * Returns: parsed results or error
 */
export async function callAiParseIngredients(
  lines: string[],
  aisleDescriptions: Record<string, string>,
  unitDescriptions: Record<string, string>
): Promise<{ success: boolean; data?: AiSingleParseResult[]; error?: string }> {
  const batchId = createBatchId();
  const endTimer = startTimer();
  let authMs = 0;
  let promptBuildMs = 0;
  let functionCallMs = 0;
  let responseParseMs = 0;
  let schemaValidationMs = 0;
  let promptChars = 0;
  let maxOutputTokens = 0;
  let jsonParseStrategy = 'direct';
  let parseModel = 'gemini-3-flash-preview';
  let aiAttemptCount = 0;
  let finishReason = 'unknown';
  let responseTextLength = 0;
  
  try {
    // Get authentication token
    const authTimer = startTimer();
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Reuse cached token when possible. Forcing refresh adds avoidable network latency.
    const idToken = await user.getIdToken();
    authMs = authTimer();

    // Build/cached static prompt scaffolding for current aisle/unit dictionaries.
    const promptBuildTimer = startTimer();
    const { systemInstruction } = buildPromptScaffold(
      aisleDescriptions,
      unitDescriptions
    );

    // Build ingredient list for the prompt (just the data, rules in system instruction)
    const prompt = lines.join('\n');

    // Keep output budget tight to reduce generation latency while leaving headroom.
    maxOutputTokens = Math.max(512, lines.length * 96);
    promptBuildMs = promptBuildTimer();
    promptChars = prompt.length;

    // Call the Cloud Function with proper structure
    const callable = httpsCallable<
      { idToken: string; params: any },
      GenerateContentResponse
    >(functions, 'cloudGenerateContent');

    parseModel = (import.meta.env.VITE_CANON_AI_PARSE_MODEL || '').trim() || 'gemini-3.1-flash-lite-preview';

    // Build response schema for structured output
    const responseSchema = {
      type: 'object' as const,
      properties: {
        results: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              index: { type: 'number' as const },
              originalLine: { type: 'string' as const },
              quantity: { type: 'number' as const, nullable: true },
              unit: { type: 'string' as const, nullable: true },
              item: { type: 'string' as const },
              prep: { type: 'string' as const, nullable: true },
              notes: { type: 'string' as const, nullable: true },
              aisle: { type: 'string' as const },
            },
            required: ['index', 'originalLine', 'item', 'aisle'],
          },
        },
      },
    };

    async function runAiAttempt(promptText: string): Promise<string> {
      aiAttemptCount += 1;
      const functionCallTimer = startTimer();
      const result = await callable({
        idToken,
        params: {
          model: parseModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0,
            topP: 0.1,
            maxOutputTokens,
            thinkingLevel: 'low',
          },
        },
      });
      functionCallMs += functionCallTimer();

      const responseData = result.data as GenerateContentResponse;
      const candidate = responseData.candidates?.[0];
      finishReason = String(candidate?.finishReason ?? 'unknown');

      const text = candidate?.content?.parts
        ?.filter(part => part.text)
        .map(part => part.text)
        .join('') || '{}';

      responseTextLength = text.length;
      return text;
    }

    // Extract and parse response (schema-enforced, guaranteed valid JSON)
    const parseTimer = startTimer();
    const text = await runAiAttempt(prompt);

    // Parse JSON response (schema-enforced, no repair needed)
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
      jsonParseStrategy = 'schema-enforced';
    } catch (parseError) {
      const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
      const durationMs = endTimer();
      logMatchEvent({
        eventType: 'ai-parse',
        entityType: 'recipe-ingredient',
        entityId: batchId,
        entityName: `Failed batch of ${lines.length} ingredients`,
        input: {
          rawIngredients: lines,
          inputCount: lines.length,
        },
        output: {
          success: false,
          error: `JSON parse failure: ${parseMessage}`,
        },
        metrics: {
          durationMs,
            batchId,
            batchSize: lines.length,
          },
          metadata: {
            authMs,
            promptBuildMs,
            promptChars,
            maxOutputTokens,
            model: parseModel,
            functionCallMs,
            responseParseMs,
            schemaValidationMs,
            finishReason,
            aiAttemptCount,
            jsonParseStrategy: 'failed',
            responseTextLength: text.length,
            responseTextSample: text.slice(0, 280),
            error: parseMessage,
            pipelineVersion: 'ai-parse-v9-system-instruction-low-thinking',
          },
        }).catch(err => console.error('Failed to log ai-parse JSON parse error event:', err));

      return {
        success: false,
        error: `Failed to parse AI response as JSON: ${parseMessage}`,
      };
    }
    responseParseMs = parseTimer();

    // Validate raw response against schema (with natural language names)
    const schemaValidationTimer = startTimer();
    const parsedObject = parsedJson as { results?: unknown };
    const validated = AiRawParseResponseSchema.safeParse(parsedObject);
    schemaValidationMs = schemaValidationTimer();

    if (!validated.success) {
      return {
        success: false,
        error: `Invalid response schema: ${validated.error.message}`,
      };
    }

    if (!validated.data.results || validated.data.results.length === 0) {
      return {
        success: false,
        error: 'No results in AI response',
      };
    }

    // Map natural language names to IDs
    const results: AiSingleParseResult[] = validated.data.results.map(rawResult =>
      mapNamesToIds(rawResult, aisleDescriptions, unitDescriptions)
    );

    // Log AI parse event (batch-level)
    const durationMs = endTimer();
    logMatchEvent({
      eventType: 'ai-parse',
      entityType: 'recipe-ingredient',
      entityId: batchId,
      entityName: `Batch of ${lines.length} ingredients`,
      input: {
        rawIngredients: lines,
        inputCount: lines.length,
        availableAisles: Object.keys(aisleDescriptions).length,
        availableUnits: Object.keys(unitDescriptions).length,
      },
      output: {
        resultCount: results.length,
        success: true,
        parsedItems: results.map(r => r.itemName),
      },
      metrics: {
        durationMs,
        batchId,
        batchSize: lines.length,
      },
      metadata: {
        authMs,
        promptBuildMs,
        promptChars,
        maxOutputTokens,
        model: parseModel,
        finishReason,
        aiAttemptCount,
        jsonParseStrategy,
        responseTextLength,
        functionCallMs,
        responseParseMs,
        schemaValidationMs,
        pipelineVersion: 'ai-parse-v9-system-instruction-low-thinking',
      },
    }).catch(err => console.error('Failed to log ai-parse event:', err));

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = endTimer();
    
    // Log failure event
    logMatchEvent({
      eventType: 'ai-parse',
      entityType: 'recipe-ingredient',
      entityId: batchId,
      entityName: `Failed batch of ${lines.length} ingredients`,
      input: {
        rawIngredients: lines,
        inputCount: lines.length,
      },
      output: {
        success: false,
        error: message,
      },
      metrics: {
        durationMs,
        batchId,
        batchSize: lines.length,
      },
      metadata: {
        authMs,
        promptBuildMs,
        promptChars,
        maxOutputTokens,
        model: parseModel,
        finishReason,
        aiAttemptCount,
        jsonParseStrategy,
        responseTextLength,
        functionCallMs,
        responseParseMs,
        schemaValidationMs,
        error: message,
        pipelineVersion: 'ai-parse-v9-system-instruction-low-thinking',
      },
    }).catch(err => console.error('Failed to log ai-parse error event:', err));
    
    return {
      success: false,
      error: `Cloud Function error: ${message}`,
    };
  }
}
