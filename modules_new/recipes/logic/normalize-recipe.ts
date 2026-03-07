/**
 * Pure recipe data normalisation helpers.
 *
 * Extracted from BaseRecipesBackend. No I/O. All functions are stateless.
 */

import type { Recipe, RecipeInstruction } from '../../../types/contract';

// ==================== JSON UTILITIES ====================

export function sanitizeJson(text: string): string {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) return text.trim();
  const isArray =
    firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);
  if (isArray) {
    const lastBracket = text.lastIndexOf(']');
    return lastBracket !== -1
      ? text.substring(firstBracket, lastBracket + 1)
      : text.trim();
  } else {
    const lastBrace = text.lastIndexOf('}');
    return lastBrace !== -1
      ? text.substring(firstBrace, lastBrace + 1)
      : text.trim();
  }
}

// ==================== HISTORY PRUNING ====================

export function pruneHistory(
  history: { role: string; text: string }[],
  maxTurns = 15
): { role: string; text: string }[] {
  const maxMessages = maxTurns * 2;
  if (history.length <= maxMessages) return history;
  const pruned = history.slice(-maxMessages);
  while (pruned.length > 0 && pruned[0].role !== 'user') pruned.shift();
  return pruned;
}

// ==================== INSTRUCTION NORMALISATION ====================

/**
 * Convert instructions to RecipeInstruction objects with persistent IDs.
 */
export function normalizeInstructions(instructions: any[]): RecipeInstruction[] {
  if (!Array.isArray(instructions)) return [];

  return instructions.map((instr) => {
    if (typeof instr === 'object' && instr !== null && instr.id && instr.text) {
      return {
        id: instr.id,
        text: instr.text,
        ingredients: instr.ingredients || [],
        technicalWarnings: instr.technicalWarnings || [],
      };
    }

    return {
      id: `step-${crypto.randomUUID()}`,
      text: typeof instr === 'string' ? instr : String(instr),
      ingredients: [],
      technicalWarnings: [],
    };
  });
}

/**
 * Convert instructions to RecipeInstruction objects while migrating old format (Issue #57).
 * Embeds step-specific ingredients and warnings directly in instruction objects.
 */
export function normalizeInstructionsWithMigration(
  instructions: any[],
  allIngredients: any[],
  stepIngredients: any[][],
  stepAlerts: any[][],
  technicalWarnings: string[],
  _recipeId: string
): RecipeInstruction[] {
  if (!Array.isArray(instructions)) return [];

  return instructions.map((instr, stepIdx) => {
    const baseInstruction =
      typeof instr === 'object' && instr !== null && instr.id && instr.text
        ? {
            id: instr.id,
            text: instr.text,
            ingredients: instr.ingredients || [],
            technicalWarnings: instr.technicalWarnings || [],
          }
        : {
            id: `step-${crypto.randomUUID()}`,
            text: typeof instr === 'string' ? instr : String(instr),
            ingredients: [],
            technicalWarnings: [],
          };

    if (stepIngredients[stepIdx] && Array.isArray(stepIngredients[stepIdx])) {
      const stepIngredientIndices = stepIngredients[stepIdx] as number[];
      baseInstruction.ingredients = stepIngredientIndices
        .map((idx) => allIngredients[idx])
        .filter((ing) => ing !== undefined);
    }

    if (stepAlerts[stepIdx] && Array.isArray(stepAlerts[stepIdx])) {
      const stepAlertIndices = stepAlerts[stepIdx] as number[];
      baseInstruction.technicalWarnings = stepAlertIndices
        .map((idx) => technicalWarnings[idx])
        .filter((warning) => warning !== undefined);
    }

    return baseInstruction;
  });
}

// ==================== RECIPE DATA NORMALISATION ====================

export function normalizeRecipeData(raw: any): Partial<Recipe> {
  const source = Array.isArray(raw) ? (raw[0] || {}) : (raw || {});
  const normalized: any = { ...source };

  if (!normalized.title)
    normalized.title = source.recipeName || source.name || 'Untitled Recipe';
  if (!normalized.description)
    normalized.description =
      source.summary || source.recipeDescription || 'No description provided.';
  if (!normalized.ingredients)
    normalized.ingredients = source.ingredientList || source.items || [];
  if (!normalized.instructions)
    normalized.instructions = source.method || source.steps || [];
  if (!normalized.equipmentNeeded)
    normalized.equipmentNeeded = source.equipment || source.tools || [];
  if (!normalized.prepTime)
    normalized.prepTime = source.prep || source.prep_time || '---';
  if (!normalized.cookTime)
    normalized.cookTime = source.cook || source.cook_time || '---';
  if (!normalized.totalTime)
    normalized.totalTime = source.total || source.total_time || '---';
  if (!normalized.servings)
    normalized.servings = source.serves || source.yield || '---';
  if (!normalized.complexity)
    normalized.complexity = source.difficulty || 'Intermediate';

  if (!Array.isArray(normalized.instructions)) {
    normalized.instructions =
      typeof normalized.instructions === 'string'
        ? normalized.instructions.split('\n').filter((s: string) => s.trim())
        : [];
  }

  const instructionsAreAlreadyMigrated =
    normalized.instructions.length > 0 &&
    typeof normalized.instructions[0] === 'object' &&
    'id' in normalized.instructions[0] &&
    'text' in normalized.instructions[0] &&
    'ingredients' in normalized.instructions[0];

  if (Array.isArray(normalized.ingredients)) {
    normalized.ingredients = normalized.ingredients.map((ing: any) => {
      if (typeof ing === 'object' && ing !== null && ing.id) {
        const cleaned: any = { ...ing };
        Object.keys(cleaned).forEach((key) => {
          if (cleaned[key] === undefined) delete cleaned[key];
        });
        return cleaned;
      }
      if (typeof ing === 'object' && ing !== null) {
        const cleaned: any = { ...ing, id: ing.id || crypto.randomUUID() };
        Object.keys(cleaned).forEach((key) => {
          if (cleaned[key] === undefined) delete cleaned[key];
        });
        return cleaned;
      }
      const ingredient: any = {
        id: crypto.randomUUID(),
        raw: ing,
        quantity: null,
        unit: null,
        ingredientName: ing,
      };
      if (ing.preparation) ingredient.preparation = ing.preparation;
      return ingredient;
    });
  }

  if (instructionsAreAlreadyMigrated) {
    return normalized;
  }

  normalized.instructions = normalized.instructions.map((instr: any) =>
    typeof instr === 'string' ? instr : (instr.text || String(instr))
  );

  const stepIngredients = normalized.stepIngredients || [];
  const stepAlerts = normalized.stepAlerts || [];
  const warnings = normalized.workflowAdvice?.technicalWarnings || [];

  normalized.instructions = normalizeInstructionsWithMigration(
    normalized.instructions,
    normalized.ingredients,
    stepIngredients,
    stepAlerts,
    warnings,
    normalized.id || 'unknown'
  );

  delete normalized.stepIngredients;
  delete normalized.stepAlerts;
  if (normalized.workflowAdvice) {
    delete normalized.workflowAdvice.technicalWarnings;
    if (Object.keys(normalized.workflowAdvice).length === 0) {
      delete normalized.workflowAdvice;
    }
  }

  return normalized;
}
