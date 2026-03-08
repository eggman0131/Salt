/**
 * Pure Firestore encoding/decoding utilities for recipe data.
 *
 * Extracted from FirebaseRecipesBackend. These are stateless helpers with no I/O.
 */

// ==================== TIMESTAMP CONVERSION ====================

export function convertTimestamps(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const converted: any = Array.isArray(data) ? [] : {};

  for (const key in data) {
    const value = data[key];

    if (value && typeof value === 'object' && 'toDate' in value) {
      converted[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object') {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }

  return converted;
}

// ==================== NESTED ARRAY ENCODING ====================

/**
 * Firestore does not support nested arrays. Encode them as objects with a marker.
 */
export function encodeNestedArrays(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (Array.isArray(item)) {
        return {
          __nestedArray: true,
          values: item.map((child) => encodeNestedArrays(child)),
        };
      }
      return encodeNestedArrays(item);
    });
  }

  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = encodeNestedArrays(val);
    }
    return out;
  }

  return value;
}

export function decodeNestedArrays(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => decodeNestedArrays(item));
  }

  if (value && typeof value === 'object') {
    if (value.__nestedArray === true && Array.isArray(value.values)) {
      return value.values.map((item: any) => decodeNestedArrays(item));
    }

    const out: any = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = decodeNestedArrays(val);
    }
    return out;
  }

  return value;
}

export function encodeRecipeForFirestore(recipe: any): any {
  return encodeNestedArrays(recipe);
}

export function decodeRecipeFromFirestore(recipe: any): any {
  return decodeNestedArrays(recipe);
}

// ==================== SANITIZATION ====================

/**
 * Remove undefined values from objects/arrays for Firestore compatibility.
 * Firestore does not accept undefined — it must be null or omitted.
 */
export function cleanUndefinedValues(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefinedValues(item));
  }

  if (obj && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefinedValues(value);
      }
    }
    return cleaned;
  }

  return obj;
}

function stripEmbeddingFromIngredient(ingredient: any): any {
  if (!ingredient || typeof ingredient !== 'object') return ingredient;
  const { embedding, edited, ...rest } = ingredient;
  void embedding;
  void edited;
  return rest;
}

/**
 * Remove embedding vectors from ingredient structures before storage.
 * Embeddings are cached separately and must not be persisted inside recipes.
 */
export function sanitizeRecipeEmbeddingsForStorage(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const sanitized: any = { ...payload };

  if (Array.isArray(sanitized.ingredients)) {
    sanitized.ingredients = sanitized.ingredients.map((ing: any) =>
      stripEmbeddingFromIngredient(ing)
    );
  }

  if (Array.isArray(sanitized.instructions)) {
    sanitized.instructions = sanitized.instructions.map((instruction: any) => {
      if (!instruction || typeof instruction !== 'object') return instruction;
      const next = { ...instruction };
      if (Array.isArray(next.ingredients)) {
        next.ingredients = next.ingredients.map((ing: any) =>
          stripEmbeddingFromIngredient(ing)
        );
      }
      return next;
    });
  }

  return sanitized;
}

// ==================== LEGACY FORMAT DETECTION ====================

/**
 * Detect if a recipe is in old format (Issue #57).
 */
export function hasLegacyFormat(rawData: any): boolean {
  return (
    rawData.stepIngredients !== undefined ||
    rawData.stepAlerts !== undefined ||
    rawData.workflowAdvice?.technicalWarnings !== undefined
  );
}
