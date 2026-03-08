/**
 * Pure categorization logic layer
 * 
 * Contains deterministic logic for analyzing recipes and suggesting categories.
 * No I/O, no side effects, fully testable.
 */

import { Recipe, RecipeCategory } from '../../../types/contract';

/**
 * Build AI prompt for recipe categorization (user message only)
 * Categories are provided via system instruction
 * Pure function that creates the prompt text without side effects
 */
export function buildCategorizationPrompt(recipe: Recipe): string {
  const ingredientsList = extractIngredientNames(recipe).slice(0, 10).join(', ');

  return `Title: ${recipe.title}
Description: ${recipe.description || 'N/A'}
Ingredients: ${ingredientsList || 'N/A'}
Complexity: ${recipe.complexity || 'N/A'}`;
}

/**
 * Build system instruction with available categories
 * Pure function
 */
export function buildCategorizationSystemInstruction(
  existingCategories: RecipeCategory[]
): string {
  const approvedCategories = existingCategories
    .filter(c => c.isApproved)
    .map(c => `${c.id}: ${c.name}${c.synonyms && c.synonyms.length > 0 ? ` (${c.synonyms.join(', ')})` : ''}`)
    .join('\n');

  return [
    'You are the Head Chef categorizing recipes. Match recipes to existing categories.',
    '',
    'Available categories:',
    approvedCategories || 'None yet',
    '',
    'Rules:',
    '- Return ONLY category IDs that match this recipe',
    '- Consider: meal type, cuisine, dietary restrictions, cooking method',
    '- Only return IDs for true matches',
    '- Never invent new categories',
    '- Return empty array if no good matches'
  ].join('\n');
}

/**
 * Extract ingredient names from recipe
 * Handles both string and object ingredient formats
 */
export function extractIngredientNames(recipe: Recipe): string[] {
  if (!Array.isArray(recipe.ingredients)) {
    return [];
  }

  return recipe.ingredients
    .map(ing => {
      if (typeof ing === 'string') {
        return ing;
      }
      return ing.raw || ing.ingredientName || '';
    })
    .filter(name => name.length > 0);
}

/**
 * Parse AI response and extract category IDs
 * Handles malformed JSON gracefully
 */
export function parseAICategoryResponse(text: string): string[] {
  const sanitized = sanitizeJson(text);

  try {
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse category response:', error);
    return [];
  }
}

/**
 * Extract JSON from text (strips markdown fences, preamble)
 * Pure utility function
 */
export function sanitizeJson(text: string): string {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) {
    return text.trim();
  }

  const isArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);

  if (isArray) {
    const lastBracket = text.lastIndexOf(']');
    return lastBracket !== -1 ? text.substring(firstBracket, lastBracket + 1) : text.trim();
  } else {
    const lastBrace = text.lastIndexOf('}');
    return lastBrace !== -1 ? text.substring(firstBrace, lastBrace + 1) : text.trim();
  }
}

/**
 * Validate category name uniqueness (no conflicts with synonyms)
 * This is a pure check that returns a validation result
 */
export function validateCategoryNameUniqueness(
  newName: string,
  existingCategories: RecipeCategory[]
): { valid: boolean; conflictingId?: string } {
  const normalised = newName.toLowerCase().trim();

  for (const cat of existingCategories) {
    // Check exact match with category name
    if (cat.name.toLowerCase() === normalised) {
      return { valid: false, conflictingId: cat.id };
    }

    // Check if it matches any existing synonyms
    if (cat.synonyms) {
      for (const syn of cat.synonyms) {
        if (syn.toLowerCase() === normalised) {
          return { valid: false, conflictingId: cat.id };
        }
      }
    }
  }

  return { valid: true };
}
