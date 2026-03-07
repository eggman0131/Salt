/**
 * Recipe categorisation orchestration.
 *
 * Calls AI via ai-transport and uses the categories module API for persistence.
 * Replicates the legacy BaseRecipesBackend.categorizeRecipe behaviour exactly.
 */

import type { Recipe } from '../../../types/contract';
import { RECIPE_PROMPTS } from '../../../shared/backend/prompts';
import { callGenerateContent, getSystemInstruction } from '../data/ai-transport';
import { getCategories, createCategory } from '../../../modules_new/categories/api';
import { sanitizeJson } from './normalize-recipe';

export async function categorizeRecipe(recipe: Recipe): Promise<string[]> {
  const instruction = await getSystemInstruction(
    'You are the Head Chef categorising recipes for the kitchen system.'
  );

  const existingCategories = await getCategories();
  const categoryNames = existingCategories
    .map((cat) => `${cat.id}:${cat.name}`)
    .join(', ');

  const ingredientNames = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ing: any) =>
        typeof ing === 'string' ? ing : (ing.ingredientName || ing.raw || '')
      )
    : [];

  const instructionTexts = Array.isArray(recipe.instructions)
    ? recipe.instructions.map((instr: any) =>
        typeof instr === 'string' ? instr : (instr.text || '')
      )
    : [];

  const response = await callGenerateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: RECIPE_PROMPTS.categorization(
              recipe.title,
              ingredientNames,
              instructionTexts,
              categoryNames ? categoryNames.split(', ') : []
            ),
          },
        ],
      },
    ],
    config: {
      systemInstruction: instruction,
      responseMimeType: 'application/json',
    },
  });

  const parsed = JSON.parse(sanitizeJson(response.text || '{}'));
  const matchedCategories: string[] = parsed.matchedCategories || [];
  const suggestedNewCategories = parsed.suggestedNewCategories || [];

  const allCategoryIds = [...matchedCategories];

  for (const suggestion of suggestedNewCategories) {
    if (suggestion.confidence >= 0.75) {
      try {
        const newCategory = await createCategory({
          name: suggestion.name,
          description: `AI-suggested from ${recipe.title}`,
          isApproved: false,
          confidence: suggestion.confidence,
          recipeId: recipe.id,
          createdBy: 'system',
        });
        allCategoryIds.push(newCategory.id);
      } catch {
        // Category may already exist (uniqueness check in categories API).
        // Non-fatal: proceed without adding this category ID.
      }
    }
  }

  return allCategoryIds;
}
