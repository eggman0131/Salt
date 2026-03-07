/**
 * Recipe AI workflow provider.
 *
 * Native implementation using ai-transport and normalize-recipe logic,
 * replacing the legacy backend adapter.
 */

import type { Recipe } from '../../../types/contract';
import type { RecipeConversationTurn, RecipeGenerationContext } from '../types';
import { RECIPE_PROMPTS } from '../../../shared/backend/prompts';
import {
  callGenerateContent,
  callGenerateContentStream,
  fetchUrlContent,
  getSystemInstruction,
} from './ai-transport';
import { getLeanInventoryString } from './settings-provider';
import { sanitizeJson, pruneHistory, normalizeRecipeData } from '../logic/normalize-recipe';

export async function generateRecipeFromPromptDraft(
  prompt: string,
  context?: RecipeGenerationContext
): Promise<Partial<Recipe>> {
  const leanInventory = await getLeanInventoryString();

  let recipeContext = 'No original recipe exists.';
  const currentRecipe = context?.currentRecipe;
  if (currentRecipe) {
    const instructionTexts = (currentRecipe.instructions || []).map((instr: any) =>
      typeof instr === 'string' ? instr : instr.text
    );
    recipeContext = `EXISTING RECIPE:\nTITLE: ${currentRecipe.title}\nINGREDIENTS:\n${(currentRecipe.ingredients || []).join('\n')}\nMETHOD:\n${instructionTexts.join('\n')}`;
  }

  const history = context?.history || [];
  const historySummary = history.length
    ? `DISCUSSION:\n${history
        .slice(-30)
        .map((m) => `${m.role}: ${m.text}`)
        .join('\n')}`
    : '';

  const instruction = await getSystemInstruction(
    'You are the Head Chef performing synthesis.'
  );

  const response = await callGenerateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${RECIPE_PROMPTS.synthesis(prompt, leanInventory, recipeContext)}\n\n${historySummary}`,
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
  return normalizeRecipeData(parsed);
}

export async function chatAboutRecipe(
  recipe: Recipe,
  message: string,
  history: RecipeConversationTurn[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  const leanInventory = await getLeanInventoryString();
  const recipeString = `RECIPE: ${recipe.title}\nINGREDIENTS: ${(recipe.ingredients || []).join(', ')}`;
  const pruned = pruneHistory(
    history.map((h) => ({ role: h.role, text: h.text })),
    12
  );
  const formattedHistory = pruned.map((h) => ({
    role: h.role === 'ai' ? 'model' : 'user',
    parts: [{ text: h.text }],
  }));
  const instruction = RECIPE_PROMPTS.chatPersona(recipe.title, leanInventory, recipeString);

  const stream = await callGenerateContentStream({
    model: 'gemini-3-flash-preview',
    contents: [
      ...formattedHistory,
      { role: 'user', parts: [{ text: message }] },
    ] as any,
    config: { systemInstruction: instruction },
  });

  let fullText = '';
  for await (const chunk of stream) {
    const chunkText =
      (chunk as any).text || chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    if (chunkText) {
      fullText += chunkText;
      onChunk?.(chunkText);
    }
  }
  return fullText;
}

export async function summarizeRecipeAgreement(
  history: RecipeConversationTurn[],
  currentRecipe?: Recipe
): Promise<string> {
  const historySummary = history
    .slice(-20)
    .map((h) => `${h.role}: ${h.text}`)
    .join('\n');
  const leanRecipe = currentRecipe
    ? { title: currentRecipe.title, ingredients: currentRecipe.ingredients }
    : {};
  const instruction = await getSystemInstruction('Head Chef Consensus Summary.');

  const response = await callGenerateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: RECIPE_PROMPTS.consensusSummary(
              historySummary,
              JSON.stringify(leanRecipe)
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

  return response.text || '';
}

export async function chatForRecipeDraft(
  history: RecipeConversationTurn[]
): Promise<string> {
  const leanInventory = await getLeanInventoryString();
  const formattedHistory = pruneHistory(
    history.map((h) => ({ role: h.role, text: h.text })),
    12
  ).map((h) => ({
    role: h.role === 'ai' ? 'model' : 'user',
    parts: [{ text: h.text }],
  }));
  const instruction = await getSystemInstruction(
    RECIPE_PROMPTS.draftingPersona(leanInventory)
  );

  const response = await callGenerateContent({
    model: 'gemini-3-flash-preview',
    contents: formattedHistory as any,
    config: { systemInstruction: instruction },
  });

  return response.text || '';
}

export async function generateRecipeImageData(
  recipeTitle: string,
  description?: string
): Promise<string> {
  const response = await callGenerateContent({
    model: 'gemini-2.5-flash-image',
    contents: [
      {
        role: 'user',
        parts: [{ text: RECIPE_PROMPTS.imagePrompt(recipeTitle, description) }],
      },
    ],
    config: { imageConfig: { aspectRatio: '4:3' } },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  );
  return part ? `data:image/png;base64,${(part as any).inlineData?.data}` : '';
}

export async function importRecipeDraftFromUrl(
  url: string
): Promise<Partial<Recipe>> {
  const rawRecipeData = await fetchUrlContent(url);
  const leanInventory = await getLeanInventoryString();
  const instruction = await getSystemInstruction(
    'You are the Head Chef converting an external recipe to Salt format.'
  );

  const response = await callGenerateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: RECIPE_PROMPTS.externalRecipe(rawRecipeData, leanInventory),
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
  const normalized = normalizeRecipeData(parsed);
  return { ...normalized, source: url };
}
