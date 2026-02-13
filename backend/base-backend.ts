
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
  Accessory, Plan, KitchenSettings, RecipeCategory, RecipeTagSuggestion
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
    
    // Call AI with categorization prompt
    const response = await this.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: RECIPE_PROMPTS.categorization(
            recipe.title,
            recipe.ingredients,
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

    // Filter suggestions by confidence threshold (0.75+) and create tag suggestion records
    for (const suggestion of suggestedNewCategories) {
      if (suggestion.confidence >= 0.75) {
        await this.createTagSuggestion({
          name: suggestion.name,
          recipeId: recipe.id,
          confidence: suggestion.confidence,
          status: 'pending'
        });
      }
    }

    return matchedCategories;
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
  abstract createTagSuggestion(suggestion: Omit<RecipeTagSuggestion, 'id' | 'createdAt'>): Promise<RecipeTagSuggestion>;
  abstract getTagSuggestions(): Promise<RecipeTagSuggestion[]>;
  abstract approveTagSuggestion(id: string): Promise<RecipeTagSuggestion>;
  abstract rejectTagSuggestion(id: string): Promise<RecipeTagSuggestion>;
  abstract importSystemState(json: string): Promise<void>;
}
