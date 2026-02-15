
/**
 * !!! PROTECTION LOCK !!!
 * FILE: backend/base-backend.ts
 * ROLE: The Brain (AI Orchestration & Prompt Logic)
 * 
 * DO NOT MODIFY THIS FILE WITHOUT EXPLICIT USER CONSENT.
 * This class houses the domain logic and AI synthesis engine.
 * Subclasses (The Hands) are only responsible for Persistence and Transport.
 */

import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { 
  ISaltBackend, User, Recipe, Equipment, EquipmentCandidate, 
  Accessory, Plan, KitchenSettings, RecipeCategory,
  CanonicalItem, RecipeIngredient, ShoppingList, ShoppingListItem, Unit, Aisle
} from '../types/contract';
import { SYSTEM_CORE, EQUIPMENT_PROMPTS, RECIPE_PROMPTS } from './prompts';

export abstract class BaseSaltBackend implements ISaltBackend {
  
  // -- ABSTRACT AI TRANSPORT (The Security Bridge) --

  /**
   * Transport Strategy: 
   * Implementation classes MUST instantiate GoogleGenAI using process.env.API_KEY
   * inside these methods. This ensures the backend always uses the latest key
   * provided by the environment or SelectKey dialog.
   */
  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>>;

  // -- SHARED LOGIC (DO NOT RE-IMPLEMENT IN SUBCLASSES) --

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
    const stepCount = normalized.instructions.length;

    // Bridge Step Ingredients
    if (!Array.isArray(normalized.stepIngredients)) {
      normalized.stepIngredients = new Array(stepCount).fill([]);
    } else if (normalized.stepIngredients.length !== stepCount) {
      // Pad or trim to match instructions
      const nextSteps = new Array(stepCount).fill([]);
      normalized.stepIngredients.forEach((val: any, idx: number) => {
        if (idx < stepCount) nextSteps[idx] = val;
      });
      normalized.stepIngredients = nextSteps;
    }

    // Bridge Step Alerts and Workflow Advice (Prompt vs Contract mismatch)
    // Prompt asks for: "stepAlerts": {"0": "Alert text", "1": "Another alert"}
    // Contract expects: stepAlerts: number[][] and workflowAdvice: { technicalWarnings: string[] }
    const rawAlerts = source.stepAlerts;
    if (rawAlerts && typeof rawAlerts === 'object' && !Array.isArray(rawAlerts)) {
      const warnings: string[] = [];
      const alertsIdx: number[][] = new Array(stepCount).fill(null).map(() => []);

      Object.entries(rawAlerts).forEach(([key, value]) => {
        const stepIdx = parseInt(key, 10);
        if (stepIdx >= 0 && stepIdx < stepCount && typeof value === 'string') {
          let warningIdx = warnings.indexOf(value);
          if (warningIdx === -1) {
            warningIdx = warnings.length;
            warnings.push(value);
          }
          alertsIdx[stepIdx].push(warningIdx);
        }
      });

      normalized.stepAlerts = alertsIdx;
      normalized.workflowAdvice = {
        ...(normalized.workflowAdvice || {}),
        technicalWarnings: warnings
      };
    } else if (!Array.isArray(normalized.stepAlerts)) {
      normalized.stepAlerts = new Array(stepCount).fill([]);
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

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    const settings = await this.getKitchenSettings();
    const houseRules = settings.directives ? `\nHOUSE RULES & PREFERENCES:\n${settings.directives}` : '';
    return `${SYSTEM_CORE}${houseRules}${customContext ? `\n\n${customContext}` : ''}`;
  }

  // -- ORCHESTRATED AI METHODS --
  
  async searchEquipmentCandidates(query: string): Promise<EquipmentCandidate[]> {
    const instruction = await this.getSystemInstruction("You are an expert kitchen consultant.");
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: EQUIPMENT_PROMPTS.search(query) }] }],
      config: { 
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });
    const cleaned = this.sanitizeJson(response.text || '[]');
    try { return JSON.parse(cleaned); } catch (e) { return []; }
  }

  async generateEquipmentDetails(candidate: EquipmentCandidate): Promise<Partial<Equipment>> {
    const instruction = await this.getSystemInstruction("You are an expert kitchen specialist.");
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: EQUIPMENT_PROMPTS.details(candidate.brand, candidate.modelName) }] }],
      config: { 
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });
    const parsed = JSON.parse(this.sanitizeJson(response.text || '{}'));
    const raw = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
    if (raw.accessories && Array.isArray(raw.accessories)) {
      raw.accessories = raw.accessories.map((acc: any) => ({
        ...acc,
        id: acc.id || `acc-${Math.random().toString(36).substr(2, 9)}`
      }));
    }
    return raw;
  }

  async validateAccessory(equipmentName: string, accessoryName: string): Promise<Omit<Accessory, 'id'>> {
    const instruction = await this.getSystemInstruction("You are an expert on professional kitchen equipment.");
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: EQUIPMENT_PROMPTS.validateAccessory(equipmentName, accessoryName) }] }],
      config: { systemInstruction: instruction, responseMimeType: "application/json" }
    });
    const parsed = JSON.parse(this.sanitizeJson(response.text || '{}'));
    return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
  }

  async generateRecipeFromPrompt(consensusDraft: string, currentRecipe?: Recipe, history?: {role: string, text: string}[]): Promise<Partial<Recipe>> {
    const leanInventory = await this.getLeanInventoryString();
    let recipeContext = "No original recipe exists.";
    if (currentRecipe) {
      recipeContext = `EXISTING RECIPE:\nTITLE: ${currentRecipe.title}\nINGREDIENTS:\n${(currentRecipe.ingredients || []).join('\n')}\nMETHOD:\n${(currentRecipe.instructions || []).join('\n')}`;
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

  async generateRecipeImage(title: string): Promise<string> {
    const response = await this.callGenerateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: RECIPE_PROMPTS.imagePrompt(title) }] }],
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
    
    // Call AI with categorization prompt
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: RECIPE_PROMPTS.categorization(
            recipe.title,
            ingredientNames,
            recipe.instructions,
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

  // -- SHOPPING ITEM & RECIPE INGREDIENT PROCESSING --

  /**
   * Process raw recipe ingredient strings into structured RecipeIngredient objects.
   * Uses deterministic parsing + fuzzy matching + batched AI resolution.
   * Post-processing step similar to categorization.
   */
  async processRecipeIngredients(ingredients: string[] | RecipeIngredient[], recipeId: string): Promise<RecipeIngredient[]> {
    // If already structured, return as-is
    if (ingredients.length > 0 && typeof ingredients[0] === 'object') {
      return ingredients as RecipeIngredient[];
    }

    // Get all canonical items for fuzzy matching
    const allItems = await this.getCanonicalItems();
    const results: RecipeIngredient[] = [];
    const unmatched: { index: number; parsed: any }[] = [];

    // Step 1: Parse and fuzzy match each ingredient
    for (let idx = 0; idx < ingredients.length; idx++) {
      const raw = typeof ingredients[idx] === 'string' ? ingredients[idx] as string : '';
      const parsed = this.parseIngredientString(raw);
      
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
          id: `ring-${recipeId}-${idx}`,
          raw,
          ...parsed,
          canonicalItemId: bestMatch.id
        });
      } else {
        // Queue for AI resolution
        results.push({
          id: `ring-${recipeId}-${idx}`,
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
      
      // Create new canonical items and update results
      for (let i = 0; i < unmatched.length; i++) {
        const { index } = unmatched[i];
        const aiResolution = resolved[i];
        
        if (aiResolution) {
          // Create new canonical item
          const newItem = await this.createCanonicalItem({
            name: aiResolution.name,
            normalisedName: aiResolution.name.toLowerCase(),
            preferredUnit: aiResolution.preferredUnit || '_item',
            aisle: aiResolution.aisle || 'Other',
            isStaple: aiResolution.isStaple || false,
            synonyms: aiResolution.synonyms || [],
            metadata: {}
          });
          
          // Update the result with canonical link
          results[index].canonicalItemId = newItem.id;
        }
      }
    }

    return results;
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

  /**
   * Generate a shopping list from selected recipes.
   * This is a placeholder implementation - will be built in subsequent phases
   * Dependencies: Requires lists, items, merging logic
   */
  async generateShoppingList(recipeIds: string[], name: string): Promise<{ list: ShoppingList; items: ShoppingListItem[] }> {
    // TODO: Phase 2 implementation
    const list: ShoppingList = {
      id: `sl-${Date.now()}`,
      name,
      recipeIds,
      createdAt: new Date().toISOString(),
    };
    return { list, items: [] };
  }

  // -- ABSTRACT METHODS (Implemented by Subclasses) --

  protected abstract fetchUrlContent(url: string): Promise<string>;

  abstract login(email: string): Promise<void>;
  abstract handleRedirectResult(): Promise<User | null>;
  abstract logout(): Promise<void>;
  abstract getCurrentUser(): Promise<User | null>;
  abstract getUsers(): Promise<User[]>;
  abstract createUser(userData: Omit<User, 'id'>): Promise<User>;
  abstract deleteUser(id: string): Promise<void>;
  abstract getRecipes(): Promise<Recipe[]>;
  abstract getRecipe(id: string): Promise<Recipe | null>;
  abstract createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>, imageData?: string): Promise<Recipe>;
  abstract updateRecipe(id: string, updates: Partial<Recipe>, imageData?: string): Promise<Recipe>;
  abstract resolveImagePath(path: string): Promise<string>;
  abstract deleteRecipe(id: string): Promise<void>;
  abstract getInventory(): Promise<Equipment[]>;
  abstract getEquipment(id: string): Promise<Equipment | null>;
  abstract createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>): Promise<Equipment>;
  abstract updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment>;
  abstract deleteEquipment(id: string): Promise<void>;
  abstract getKitchenSettings(): Promise<KitchenSettings>;
  abstract updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings>;
  abstract getPlans(): Promise<Plan[]>;
  abstract getPlanByDate(date: string): Promise<Plan | null>;
  abstract getPlanIncludingDate(date: string): Promise<Plan | null>;
  abstract createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'> & { id?: string }): Promise<Plan>;
  abstract deletePlan(id: string): Promise<void>;
  abstract getCategories(): Promise<RecipeCategory[]>;
  abstract getCategory(id: string): Promise<RecipeCategory | null>;
  abstract createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory>;
  abstract updateCategory(id: string, updates: Partial<RecipeCategory>): Promise<RecipeCategory>;
  abstract deleteCategory(id: string): Promise<void>;
  abstract approveCategory(id: string): Promise<void>;
  abstract getPendingCategories(): Promise<RecipeCategory[]>;
  abstract importSystemState(json: string): Promise<void>;

  // Shopping Items (Universal Catalog)
  abstract getCanonicalItems(): Promise<CanonicalItem[]>;
  abstract getCanonicalItem(id: string): Promise<CanonicalItem | null>;
  abstract createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem>;
  abstract updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem>;
  abstract deleteCanonicalItem(id: string): Promise<void>;

  // Shopping Lists
  abstract getShoppingLists(): Promise<ShoppingList[]>;
  abstract getShoppingList(id: string): Promise<ShoppingList | null>;
  abstract getDefaultShoppingList(): Promise<ShoppingList>;
  abstract setDefaultShoppingList(id: string): Promise<void>;
  abstract createShoppingList(list: Omit<ShoppingList, 'id' | 'createdAt' | 'createdBy'>): Promise<ShoppingList>;
  abstract updateShoppingList(id: string, updates: Partial<ShoppingList>): Promise<ShoppingList>;
  abstract deleteShoppingList(id: string): Promise<void>;
  abstract addRecipeToShoppingList(recipeId: string, shoppingListId: string): Promise<void>;
  abstract addManualItemToShoppingList(shoppingListId: string, name: string, quantity: number, unit: string, aisle?: string): Promise<ShoppingListItem>;
  abstract getShoppingListItems(shoppingListId: string): Promise<ShoppingListItem[]>;
  abstract createShoppingListItem(item: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem>;
  abstract updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): Promise<ShoppingListItem>;

  // Units & Aisles Management
  abstract getUnits(): Promise<Unit[]>;
  abstract createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit>;
  abstract updateUnit(id: string, updates: Partial<Unit>): Promise<Unit>;
  abstract deleteUnit(id: string): Promise<void>;
  abstract getAisles(): Promise<Aisle[]>;
  abstract createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle>;
  abstract updateAisle(id: string, updates: Partial<Aisle>): Promise<Aisle>;
  abstract deleteAisle(id: string): Promise<void>;
}
