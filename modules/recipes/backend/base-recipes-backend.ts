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
  
  // Dependencies (read from other modules)
  abstract getInventory(): Promise<Equipment[]>;
  abstract getCategories(): Promise<RecipeCategory[]>;
  abstract createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory>;
  abstract getCanonicalItems(): Promise<CanonicalItem[]>;
  abstract getCanonicalItem(id: string): Promise<CanonicalItem | null>;
  abstract createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem>;
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
    // Get all canonical items for fuzzy matching
    const allItems = await this.getCanonicalItems();
    const results: RecipeIngredient[] = [];
    const unmatched: { index: number; parsed: any }[] = [];

    // Step 1: Parse and fuzzy match each ingredient
    for (let idx = 0; idx < ingredients.length; idx++) {
      const ingredient = ingredients[idx];
      
      // Extract or preserve ID
      const existingId = typeof ingredient === 'object' && ingredient !== null ? ingredient.id : undefined;
      const ingredientId = existingId || crypto.randomUUID();
      
      // If already a proper RecipeIngredient with all needed data, use it
      if (typeof ingredient === 'object' && ingredient !== null && 
          ingredient.ingredientName && ingredient.raw) {
        // Skip if already has canonical item or is fully parsed
        if (ingredient.canonicalItemId !== undefined) {
          results.push(ingredient as RecipeIngredient);
          continue;
        }
        // Otherwise proceed to match
      }
      
      const raw = typeof ingredient === 'string' 
        ? ingredient as string 
        : (ingredient as any).raw || '';
      
      // Parse if needed
      const parsed = typeof ingredient === 'object' && (ingredient as any).ingredientName
        ? {
            quantity: (ingredient as any).quantity,
            unit: (ingredient as any).unit,
            ingredientName: (ingredient as any).ingredientName,
            preparation: (ingredient as any).preparation
          }
        : this.parseIngredientString(raw);
      
      // Try fuzzy match to existing canonical items
      let bestMatch: CanonicalItem | null = null;
      let bestScore = 0;
      
      for (const item of allItems) {
        const score = this.fuzzyMatch(parsed.ingredientName.toLowerCase(), item.normalisedName);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
        
        // Also check synonyms
        if (item.synonyms) {
          for (const syn of item.synonyms) {
            const synScore = this.fuzzyMatch(parsed.ingredientName.toLowerCase(), syn.toLowerCase());
            if (synScore > bestScore) {
              bestScore = synScore;
              bestMatch = item;
            }
          }
        }
      }
      
      // If good match found (85%+), use it
      if (bestScore >= 0.85 && bestMatch) {
        results.push({
          id: ingredientId,
          raw,
          ...parsed,
          canonicalItemId: bestMatch.id
        });
      } else {
        // Queue for AI resolution
        results.push({
          id: ingredientId,
          raw,
          ...parsed,
          canonicalItemId: undefined
        });
        unmatched.push({ index: idx, parsed });
      }
    }

    // Step 2: Batch resolve unmatched items via AI
    if (unmatched.length > 0) {
      const resolved = await this.resolveUnmatchedIngredients(unmatched.map(u => u.parsed.ingredientName));
      
      // Get existing units and aisles to check what needs creating
      const [existingUnits, existingAisles] = await Promise.all([
        this.getUnits(),
        this.getAisles()
      ]);
      
      const unitNames = new Set(existingUnits.map(u => u.name.toLowerCase()));
      const aisleNames = new Set(existingAisles.map(a => a.name.toLowerCase()));
      
      // Track existing canonical items to avoid duplicates
      const canonicalItemNames = new Map<string, string>(); // normalized name -> item ID
      for (const item of allItems) {
        canonicalItemNames.set(item.normalisedName, item.id);
      }
      
      let nextUnitSortOrder = existingUnits.length;
      let nextAisleSortOrder = existingAisles.length;
      
      // Create new canonical items and update results
      for (let i = 0; i < unmatched.length; i++) {
        const { index } = unmatched[i];
        const aiResolution = resolved[i];
        
        if (aiResolution) {
          const unitName = aiResolution.preferredUnit || '_item';
          const aisleName = aiResolution.aisle || 'Other';
          const normalizedItemName = aiResolution.name.toLowerCase();
          
          // Ensure unit exists (reuse if found, create if missing)
          if (!unitNames.has(unitName.toLowerCase())) {
            await this.createUnit({
              name: unitName,
              sortOrder: nextUnitSortOrder++
            });
            unitNames.add(unitName.toLowerCase());
          }
          
          // Ensure aisle exists (reuse if found, create if missing)
          if (!aisleNames.has(aisleName.toLowerCase())) {
            await this.createAisle({
              name: aisleName,
              sortOrder: nextAisleSortOrder++
            });
            aisleNames.add(aisleName.toLowerCase());
          }
          
          // Check if canonical item already exists (reuse if found, create if missing)
          let itemId: string;
          if (canonicalItemNames.has(normalizedItemName)) {
            // Reuse existing item
            itemId = canonicalItemNames.get(normalizedItemName)!;
          } else {
            // Create new canonical item
            const newItem = await this.createCanonicalItem({
              name: aiResolution.name,
              normalisedName: normalizedItemName,
              preferredUnit: unitName,
              aisle: aisleName,
              isStaple: aiResolution.isStaple || false,
              synonyms: aiResolution.synonyms || [],
              metadata: {}
            });
            itemId = newItem.id;
            // Track to prevent duplicates within this batch
            canonicalItemNames.set(normalizedItemName, itemId);
          }
          
          // Update the result with canonical link
          results[index].canonicalItemId = itemId;
        }
      }
    }

    return results;
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

  /**
   * Parse a raw ingredient string into structured components.
   * Examples:
   *   "500g beef mince" → {quantity: 500, unit: "g", ingredientName: "beef mince", preparation: null}
   *   "1 red onion, finely diced" → {quantity: 1, unit: "_item", ingredientName: "red onion", preparation: "finely diced"}
   */
  private parseIngredientString(raw: string): Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'> {
    let text = raw.toLowerCase().trim();
    
    // Extract quantity and unit
    const knownUnits = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'];
    const unitPattern = knownUnits.join('|');
    const quantityMatch = text.match(new RegExp(`^(\\d+\\.?\\d*|\\d*\\.\\d+)\\s*(${unitPattern})?\\s+(.+)$`));
    
    let quantity: number | null = null;
    let unit: string | null = null;
    
    if (quantityMatch) {
      quantity = parseFloat(quantityMatch[1]);
      unit = quantityMatch[2] || '_item'; // Default to countable if no unit specified
      text = quantityMatch[3];
    }
    
    // Extract preparation instructions (comma-separated descriptors at end)
    const prepMatch = text.match(/,\s*(.+)$/);
    const preparation = prepMatch ? prepMatch[1].trim() : null;
    if (prepMatch) {
      text = text.substring(0, prepMatch.index).trim();
    }
    
    // Remove size adjectives (non-identity descriptors)
    text = text.replace(/\b(small|medium|large)\b/g, '').trim();
    
    // Basic singularization
    text = text.replace(/ies$/, 'y').replace(/([^s])s$/, '$1');
    
    // Normalize whitespace
    const ingredientName = text.replace(/\s+/g, ' ').trim();
    
    return {
      quantity,
      unit,
      ingredientName,
      preparation: preparation || undefined
    };
  }

  /**
   * Levenshtein distance for fuzzy string matching.
   * Returns similarity score 0.0 - 1.0 (1.0 = exact match)
   */
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

  /**
   * Batch resolve unmatched ingredient names via AI.
   * Sends all unmatched items in ONE prompt to minimize API calls.
   */
  private async resolveUnmatchedIngredients(ingredientNames: string[]): Promise<any[]> {
    if (ingredientNames.length === 0) return [];
    
    const instruction = await this.getSystemInstruction("You are the Head Chef resolving ingredient names to canonical items.");
    
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `Resolve these recipe ingredients to canonical item database entries. Return JSON array with one entry per ingredient.

INGREDIENTS TO RESOLVE:
${ingredientNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

For each ingredient, return:
{
  "name": "Canonical item name (title case)",
  "preferredUnit": "g|kg|ml|l|_item",
  "aisle": "Produce|Meat & Fish|Dairy|Bakery|Pantry|Frozen|Other",
  "isStaple": true/false,
  "synonyms": ["alternate name 1", "alternate name 2"]
}

RULES:
- Use British English (courgette not zucchini, aubergine not eggplant)
- Use metric units only
- Use _item for countable things (eggs, onions, cans)
- Keep culinary identity descriptors (red onion, beef mince, whole milk)
- Remove size adjectives (small, medium, large)

Return JSON array: [item1, item2, ...]`
        }]
      }],
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });

    const parsed = JSON.parse(this.sanitizeJson(response.text || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  }
}
