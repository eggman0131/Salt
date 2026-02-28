/**
 * Base Recipes Backend
 * 
 * Contains AI-powered recipe generation and processing logic.
 * Subclasses implement persistence (Firebase, Simulation).
 * 
 * THIS IS "THE BRAIN" FOR RECIPES.
 * Domain logic and AI synthesis stay here.
 * Subclasses are "THE HANDS" (persistence only).
 */

import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  Recipe,
  RecipeIngredient,
  RecipeInstruction,
  CanonicalItem,
  Equipment,
  RecipeCategory,
  Unit,
  Aisle,
} from '../../../types/contract';
import { IRecipesBackend } from './recipes-backend.interface';
import { RECIPE_PROMPTS } from '../../../shared/backend/prompts';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { canonBackend } from '../../canon';

export abstract class BaseRecipesBackend implements IRecipesBackend {
  
  // ==================== ABSTRACT METHODS ====================
  // Subclasses MUST implement persistence and AI transport
  
  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;
  protected abstract getSystemInstruction(customContext?: string): Promise<string>;
  protected abstract fetchUrlContent(url: string): Promise<string>;
  
  // Recipe CRUD (persistence layer)
  abstract getRecipes(): Promise<Recipe[]>;
  abstract getRecipe(id: string): Promise<Recipe | null>;
  abstract createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>, imageData?: string): Promise<Recipe>;
  abstract updateRecipe(id: string, updates: Partial<Recipe>, imageData?: string): Promise<Recipe>;
  abstract deleteRecipe(id: string): Promise<void>;
  abstract resolveImagePath(path: string): Promise<string>;

  // Notification Hooks
  async onCanonItemsDeleted(ids: string[]): Promise<void> {
    void ids;
  }
  
  // Dependencies (read from other modules)
  abstract getInventory(): Promise<Equipment[]>;
  abstract getCategories(): Promise<RecipeCategory[]>;
  abstract createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory>;
  abstract getCanonicalItems(): Promise<CanonicalItem[]>;
  abstract getCanonicalItem(id: string): Promise<CanonicalItem | null>;
  abstract getUnits(): Promise<Unit[]>;
  abstract createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit>;
  abstract getAisles(): Promise<Aisle[]>;
  abstract createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle>;
  
  // ==================== AI-POWERED RECIPE GENERATION ====================
  
  async generateRecipeFromPrompt(consensusDraft: string, currentRecipe?: Recipe, history?: {role: string, text: string}[]): Promise<Partial<Recipe>> {
    const leanInventory = await this.getLeanInventoryString();
    let recipeContext = "No original recipe exists.";
    if (currentRecipe) {
      // Extract instruction text from RecipeInstruction objects (or use string directly for legacy)
      const instructionTexts = (currentRecipe.instructions || []).map(instr => 
        typeof instr === 'string' ? instr : instr.text
      );
      recipeContext = `EXISTING RECIPE:\nTITLE: ${currentRecipe.title}\nINGREDIENTS:\n${(currentRecipe.ingredients || []).join('\n')}\nMETHOD:\n${instructionTexts.join('\n')}`;
    }
    const historySummary = history ? `DISCUSSION:\n${history.slice(-30).map(m => `${m.role}: ${m.text}`).join('\n')}` : '';
    const instruction = await this.getSystemInstruction("You are the Head Chef performing synthesis.");
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: `${RECIPE_PROMPTS.synthesis(consensusDraft, leanInventory, recipeContext)}\n\n${historySummary}` }] }],
      config: { 
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });
    const parsed = JSON.parse(this.sanitizeJson(response.text || '{}'));
    return this.normalizeRecipeData(parsed);
  }

  async chatWithRecipe(recipe: Recipe, message: string, history: {role: string, text: string}[], onChunk?: (chunk: string) => void): Promise<string> {
    const leanInventory = await this.getLeanInventoryString();
    const recipeString = `RECIPE: ${recipe.title}\nINGREDIENTS: ${(recipe.ingredients || []).join(', ')}`;
    const pruned = this.pruneHistory(history, 12);
    const formattedHistory = pruned.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));
    const instruction = `${RECIPE_PROMPTS.chatPersona(recipe.title, leanInventory, recipeString)}`;
    const stream = await this.callGenerateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [...formattedHistory, { role: 'user', parts: [{ text: message }] }] as any,
      config: { systemInstruction: instruction }
    });
    let fullText = "";
    for await (const chunk of stream) { 
        const chunkText = chunk.text || chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (chunkText) { fullText += chunkText; onChunk?.(chunkText); } 
    }
    return fullText;
  }

  async summarizeAgreedRecipe(history: {role: string, text: string}[], currentRecipe?: Recipe): Promise<string> {
    const historySummary = history.slice(-20).map(h => `${h.role}: ${h.text}`).join('\n');
    const leanRecipe = currentRecipe ? { title: currentRecipe.title, ingredients: currentRecipe.ingredients } : {};
    const instruction = await this.getSystemInstruction("Head Chef Consensus Summary.");
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: RECIPE_PROMPTS.consensusSummary(historySummary, JSON.stringify(leanRecipe)) }] }],
      config: { 
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });
    return response.text || '';
  }

  async chatForDraft(history: {role: string, text: string}[]): Promise<string> {
    const leanInventory = await this.getLeanInventoryString();
    const formattedHistory = this.pruneHistory(history, 12).map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));
    const instruction = await this.getSystemInstruction(RECIPE_PROMPTS.draftingPersona(leanInventory));
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: formattedHistory as any,
      config: { systemInstruction: instruction }
    });
    return response.text || '';
  }

  async generateRecipeImage(title: string, description?: string): Promise<string> {
    const response = await this.callGenerateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: RECIPE_PROMPTS.imagePrompt(title, description) }] }],
      config: { imageConfig: { aspectRatio: "4:3" } }
    });
    // Fix: Access inline data correctly based on Gemini Node SDK response shape
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part ? `data:image/png;base64,${part.inlineData?.data}` : '';
  }

  async importRecipeFromUrl(url: string): Promise<Partial<Recipe>> {
    // Fetch raw recipe content (Transport - delegated to subclass)
    const rawRecipeData = await this.fetchUrlContent(url);
    
    // Convert to Salt format (Intelligence - stays in base class)
    const leanInventory = await this.getLeanInventoryString();
    const instruction = await this.getSystemInstruction("You are the Head Chef converting an external recipe to Salt format.");
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: RECIPE_PROMPTS.externalRecipe(rawRecipeData, leanInventory) }] }],
      config: { 
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });
    const parsed = JSON.parse(this.sanitizeJson(response.text || '{}'));
    const normalized = this.normalizeRecipeData(parsed);
    // Store the source URL for recipes imported from external sources
    return { ...normalized, source: url };
  }

  // ==================== POST-PROCESSING ====================

  async categorizeRecipe(recipe: Recipe): Promise<string[]> {
    // Post-processing: Auto-categorise recipe after creation/update
    const instruction = await this.getSystemInstruction("You are the Head Chef categorising recipes for the kitchen system.");
    
    // Fetch existing categories to prefer matches
    const existingCategories = await this.getCategories();
    const categoryNames = existingCategories.map(cat => `${cat.id}:${cat.name}`).join(', ');
    
    // Extract ingredient names for categorization
    // Handle both legacy string[] and new RecipeIngredient[] formats
    const ingredientNames = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ing: any) => 
          typeof ing === 'string' ? ing : (ing.ingredientName || ing.raw || '')
        )
      : [];
    
    // Extract instruction texts for categorization
    // Handle both legacy string[] and new RecipeInstruction[] formats
    const instructionTexts = Array.isArray(recipe.instructions)
      ? recipe.instructions.map((instr: any) =>
          typeof instr === 'string' ? instr : (instr.text || '')
        )
      : [];
    
    // Call AI with categorization prompt
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: RECIPE_PROMPTS.categorization(
            recipe.title,
            ingredientNames,
            instructionTexts,
            categoryNames ? categoryNames.split(', ') : []
          )
        }]
      }],
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });

    const parsed = JSON.parse(this.sanitizeJson(response.text || '{}'));
    const matchedCategories: string[] = parsed.matchedCategories || [];
    const suggestedNewCategories = parsed.suggestedNewCategories || [];

    // Collect all categoryIds to attach to recipe (matched + approved suggestions)
    const allCategoryIds = [...matchedCategories];

    // Filter suggestions by confidence threshold (0.75+) and create unapproved categories
    for (const suggestion of suggestedNewCategories) {
      if (suggestion.confidence >= 0.75) {
        // Create unapproved category directly in categories table
        const newCategory = await this.createCategory({
          name: suggestion.name,
          description: `AI-suggested from ${recipe.title}`,
          isApproved: false,
          confidence: suggestion.confidence,
          recipeId: recipe.id,
          createdBy: 'system'
        });
        allCategoryIds.push(newCategory.id);
      }
    }

    return allCategoryIds;
  }

  async processRecipeIngredients(ingredients: string[] | RecipeIngredient[], recipeId: string): Promise<RecipeIngredient[]> {
    if (ingredients.length === 0) {
      return [];
    }

    // Canon owns all ingredient matching and canonical item creation/updating.
    // Recipes only prepares input and applies returned links back onto recipe data.
    if (typeof ingredients[0] !== 'string') {
      const structured = ingredients as RecipeIngredient[];
      const rawIngredients = structured.map((ingredient) => {
        const existingRaw = ingredient.raw?.trim();
        if (existingRaw) {
          return existingRaw;
        }

        const parts: string[] = [];
        if (typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity)) {
          parts.push(String(ingredient.quantity));
        }
        if (ingredient.unit?.trim()) {
          parts.push(ingredient.unit.trim());
        }
        if (ingredient.ingredientName?.trim()) {
          parts.push(ingredient.ingredientName.trim());
        }

        let raw = parts.join(' ').trim();
        if (ingredient.preparation?.trim()) {
          raw = raw ? `${raw}, ${ingredient.preparation.trim()}` : ingredient.preparation.trim();
        }
        return raw;
      });

      const matched = await canonBackend.processIngredients(rawIngredients, recipeId);
      return matched.map((ingredient, idx) => ({
        ...ingredient,
        id: structured[idx]?.id || ingredient.id,
      }));
    }

    return canonBackend.processIngredients(ingredients as string[], recipeId);
  }

  async repairRecipe(
    recipeId: string,
    options: { categorize?: boolean; relinkIngredients?: boolean }
  ): Promise<Recipe> {
    // Fetch the recipe
    const recipe = await this.getRecipe(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const updates: Partial<Recipe> = {};

    // Re-categorize if requested
    if (options.categorize) {
      const categoryIds = await this.categorizeRecipe(recipe);
      if (categoryIds.length > 0) {
        updates.categoryIds = categoryIds;
      }
    }

    // Relink ingredients if requested
    if (options.relinkIngredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
      const processedIngredients = await this.processRecipeIngredients(recipe.ingredients, recipeId);
      updates.ingredients = processedIngredients;

      // Update ingredients in instructions to reference processed versions
      if (Array.isArray(recipe.instructions)) {
        const ingredientMap = new Map(processedIngredients.map(ing => [ing.id, ing]));
        updates.instructions = recipe.instructions.map((instr: RecipeInstruction) => {
          if (instr.ingredients && Array.isArray(instr.ingredients)) {
            return {
              ...instr,
              ingredients: instr.ingredients
                .map((ing: any) => ingredientMap.get(ing.id) || ing)
                .filter((ing: any) => ing !== undefined)
            };
          }
          return instr;
        });
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      return await this.updateRecipe(recipeId, updates);
    }

    return recipe;
  }

  // ==================== HELPER METHODS ====================
  
  protected sanitizeJson(text: string): string {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    if (firstBrace === -1 && firstBracket === -1) return text.trim();
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
   * Convert instructions to RecipeInstruction objects with persistent IDs.
   * Simplified approach: instructions are self-contained with embedded ingredients/warnings.
   * 
   * @param instructions Raw instruction strings or objects
   * @returns Array of RecipeInstruction objects with persistent IDs
   */
  protected normalizeInstructions(instructions: any[]): RecipeInstruction[] {
    if (!Array.isArray(instructions)) {
      return [];
    }

    return instructions.map((instr) => {
      // If already a RecipeInstruction, ensure required fields exist
      if (typeof instr === 'object' && instr !== null && instr.id && instr.text) {
        return {
          id: instr.id,
          text: instr.text,
          ingredients: instr.ingredients || [],
          technicalWarnings: instr.technicalWarnings || [],
        };
      }

      // Convert string to RecipeInstruction
      return {
        id: `step-${crypto.randomUUID()}`,
        text: typeof instr === 'string' ? instr : String(instr),
        ingredients: [],
        technicalWarnings: [],
      };
    });
  }

  /**
   * Issue #57: Convert instructions to RecipeInstruction objects while migrating old format.
   * 
   * Embeds step-specific ingredients and warnings directly in instruction objects.
   * This is called during normalization to capture old format data before it's lost.
   * 
   * @param instructions Raw instruction strings
   * @param allIngredients All ingredients in recipe
   * @param stepIngredients Old format: indices per step
   * @param stepAlerts Old format: indices per step
   * @param technicalWarnings Old format: warning strings
   * @param recipeId Recipe ID for logging
   * @returns Array of RecipeInstruction objects with embedded data
   */
  protected normalizeInstructionsWithMigration(
    instructions: any[],
    allIngredients: any[],
    stepIngredients: any[][],
    stepAlerts: any[][],
    technicalWarnings: string[],
    recipeId: string
  ): RecipeInstruction[] {
    if (!Array.isArray(instructions)) {
      return [];
    }

    const hasLegacyData = stepIngredients.length > 0 || stepAlerts.length > 0;

    return instructions.map((instr, stepIdx) => {
      // Step 1: Ensure instruction is a RecipeInstruction object
      const baseInstruction = typeof instr === 'object' && instr !== null && instr.id && instr.text
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

      // Step 2: Embed step-specific ingredients from old format
      if (stepIngredients[stepIdx] && Array.isArray(stepIngredients[stepIdx])) {
        const stepIngredientIndices = stepIngredients[stepIdx] as number[];
        const embeddedIngredients = stepIngredientIndices
          .map(idx => allIngredients[idx])
          .filter(ing => ing !== undefined);
        
        baseInstruction.ingredients = embeddedIngredients;
      }

      // Step 3: Embed step-specific warnings from old format
      if (stepAlerts[stepIdx] && Array.isArray(stepAlerts[stepIdx])) {
        const stepAlertIndices = stepAlerts[stepIdx] as number[];
        const embeddedWarnings = stepAlertIndices
          .map(idx => technicalWarnings[idx])
          .filter(warning => warning !== undefined);
        
        baseInstruction.technicalWarnings = embeddedWarnings;
      }

      return baseInstruction;
    });
  }

  protected normalizeRecipeData(raw: any): Partial<Recipe> {
    const source = Array.isArray(raw) ? (raw[0] || {}) : (raw || {});
    const normalized: any = { ...source };

    // Standard field mapping
    if (!normalized.title) normalized.title = source.recipeName || source.name || 'Untitled Recipe';
    if (!normalized.description) normalized.description = source.summary || source.recipeDescription || 'No description provided.';
    if (!normalized.ingredients) normalized.ingredients = source.ingredientList || source.items || [];
    if (!normalized.instructions) normalized.instructions = source.method || source.steps || [];
    if (!normalized.equipmentNeeded) normalized.equipmentNeeded = source.equipment || source.tools || [];
    if (!normalized.prepTime) normalized.prepTime = source.prep || source.prep_time || '---';
    if (!normalized.cookTime) normalized.cookTime = source.cook || source.cook_time || '---';
    if (!normalized.totalTime) normalized.totalTime = source.total || source.total_time || '---';
    if (!normalized.servings) normalized.servings = source.serves || source.yield || '---';
    if (!normalized.complexity) normalized.complexity = source.difficulty || 'Intermediate';

    // Ensure instructions is an array
    if (!Array.isArray(normalized.instructions)) {
      normalized.instructions = typeof normalized.instructions === 'string' 
        ? normalized.instructions.split('\n').filter(s => s.trim())
        : [];
    }
    
    // Check if instructions are already migrated RecipeInstruction objects
    const instructionsAreAlreadyMigrated = normalized.instructions.length > 0 && 
      typeof normalized.instructions[0] === 'object' && 
      'id' in normalized.instructions[0] && 
      'text' in normalized.instructions[0] &&
      'ingredients' in normalized.instructions[0];
    
    // CRITICAL: Ensure ingredients have IDs before migration
    // Ingredients can be strings or objects - we need to ensure all have IDs
    if (Array.isArray(normalized.ingredients)) {
      normalized.ingredients = normalized.ingredients.map((ing: any) => {
        // If already an object with an ID, keep it but remove undefined fields
        if (typeof ing === 'object' && ing !== null && ing.id) {
          const cleaned: any = { ...ing };
          // Remove undefined fields
          Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) delete cleaned[key];
          });
          return cleaned;
        }
        // If object without ID, assign one and remove undefined fields
        if (typeof ing === 'object' && ing !== null) {
          const cleaned: any = { ...ing, id: ing.id || crypto.randomUUID() };
          Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) delete cleaned[key];
          });
          return cleaned;
        }
        // If string, create a minimal ingredient object
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
      // (they already have embedded ingredients and warnings)
      return normalized;
    }
    
    // Convert instructions to strings for migration processing
    normalized.instructions = normalized.instructions.map((instr: any) => 
      typeof instr === 'string' ? instr : (instr.text || String(instr))
    );

    // Issue #57: CRITICAL - Migrate old format BEFORE normalizing instructions
    // This preserves stepIngredients and stepAlerts for embedding
    const stepIngredients = normalized.stepIngredients || [];
    const stepAlerts = normalized.stepAlerts || [];
    const technicalWarnings = normalized.workflowAdvice?.technicalWarnings || [];
    
    // Convert string instructions to RecipeInstruction objects with embedded data
    normalized.instructions = this.normalizeInstructionsWithMigration(
      normalized.instructions,
      normalized.ingredients,
      stepIngredients,
      stepAlerts,
      technicalWarnings,
      normalized.id || 'unknown'
    );

    // Clean up legacy fields
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

  protected pruneHistory(history: {role: string, text: string}[], maxTurns = 15): {role: string, text: string}[] {
    const maxMessages = maxTurns * 2;
    if (history.length <= maxMessages) return history;
    const pruned = history.slice(-maxMessages);
    while (pruned.length > 0 && pruned[0].role !== 'user') pruned.shift();
    return pruned;
  }

  protected async getLeanInventoryString(): Promise<string> {
    const inventory = await this.getInventory();
    if (inventory.length === 0) return 'Standard domestic tools only.';
    return inventory.map(i => i.name).join(', ');
  }

}
