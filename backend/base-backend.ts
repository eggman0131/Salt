/**
 * !!! PROTECTION LOCK !!!
 * FILE: backend/base-backend.ts
 * ROLE: The Brain (AI Orchestration & SDK Logic)
 * 
 * DESIGN PATTERN: Strategy / Template Method.
 * This class houses ALL @google/genai logic and shared business rules.
 * 
 * FOR FUTURE AI UPDATES:
 * 1. Add new AI-driven features HERE (e.g., Grocery extraction).
 * 2. Ensure methods remain 'abstract' for persistence-heavy tasks.
 * 3. NEVER introduce database-specific code (Firebase/LocalStorage) here.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { 
  ISaltBackend, User, Recipe, Equipment, EquipmentCandidate, 
  Accessory, Plan, RecipeHistoryEntry 
} from '../types/contract';
import { SYSTEM_CORE, EQUIPMENT_PROMPTS, RECIPE_PROMPTS } from './prompts';

export abstract class BaseSaltBackend implements ISaltBackend {
  // -- AI CORE --
  protected sanitizeJson(text: string): string {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    // If no structural characters found, return trimmed text
    if (firstBrace === -1 && firstBracket === -1) return text.trim();

    // Determine which structure starts first to find the outer-most shell
    const isArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);

    if (isArray) {
      const lastBracket = text.lastIndexOf(']');
      return lastBracket !== -1 ? text.substring(firstBracket, lastBracket + 1) : text.trim();
    } else {
      const lastBrace = text.lastIndexOf('}');
      return lastBrace !== -1 ? text.substring(firstBrace, lastBrace + 1) : text.trim();
    }
  }

  protected getAI() {
    // Adhering to strict SDK initialization rules
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  // -- INHERITED AI METHODS (The Brain) --
  async searchEquipmentCandidates(query: string): Promise<EquipmentCandidate[]> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: EQUIPMENT_PROMPTS.search(query),
      config: { 
        systemInstruction: `${SYSTEM_CORE}\nYou are an expert kitchen consultant.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              brand: { type: Type.STRING },
              modelName: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { 
                type: Type.STRING,
                enum: ['Complex Appliance', 'Technical Cookware', 'Standard Tool']
              }
            },
            required: ['brand', 'modelName', 'description', 'category']
          }
        }
      }
    });
    const cleaned = this.sanitizeJson(response.text || '[]');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse search results:", e, cleaned);
      return [];
    }
  }

  async generateEquipmentDetails(candidate: EquipmentCandidate): Promise<Partial<Equipment>> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: EQUIPMENT_PROMPTS.details(candidate.brand, candidate.modelName),
      config: { 
        systemInstruction: `${SYSTEM_CORE}\nYou are an expert kitchen specialist.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            upi: { type: Type.STRING },
            brand: { type: Type.STRING },
            modelName: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING },
            class: { type: Type.STRING },
            features: { type: Type.STRING },
            uses: { type: Type.STRING },
            accessories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['standard', 'optional'] },
                  owned: { type: Type.BOOLEAN }
                },
                required: ['name', 'description', 'type', 'owned']
              }
            }
          },
          required: ['upi', 'brand', 'modelName', 'description', 'type', 'class', 'accessories']
        }
      }
    });
    
    const raw = JSON.parse(this.sanitizeJson(response.text || '{}'));
    
    // Salt Protocol: Hydrate accessories with unique IDs immediately after generation
    // to ensure the UI can track selection state before the object is persisted.
    if (raw.accessories && Array.isArray(raw.accessories)) {
      raw.accessories = raw.accessories.map((acc: any) => ({
        ...acc,
        id: acc.id || `acc-${Math.random().toString(36).substr(2, 9)}`
      }));
    }
    
    return raw;
  }

  async validateAccessory(equipmentName: string, accessoryName: string): Promise<Omit<Accessory, 'id'>> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: EQUIPMENT_PROMPTS.validateAccessory(equipmentName, accessoryName),
      config: { 
        systemInstruction: `${SYSTEM_CORE}\nYou are an expert on professional kitchen kit.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['standard', 'optional'] },
            owned: { type: Type.BOOLEAN }
          },
          required: ['name', 'description', 'type', 'owned']
        }
      }
    });
    return JSON.parse(this.sanitizeJson(response.text || '{}'));
  }

  async generateRecipeFromPrompt(consensusDraft: string, currentRecipe?: Recipe): Promise<Partial<Recipe>> {
    const inventory = await this.getInventory();
    const leanInventory = inventory.length === 0 ? 'Standard tools' : inventory.map(i => i.name).join(', ');
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: RECIPE_PROMPTS.synthesis(consensusDraft, leanInventory),
      config: { 
        systemInstruction: `${SYSTEM_CORE}\nYou are the Head Chef.`,
        responseMimeType: "application/json" 
      }
    });
    return JSON.parse(this.sanitizeJson(response.text || '{}'));
  }

  async chatWithRecipe(recipe: Recipe, message: string, history: {role: string, text: string}[], onChunk?: (chunk: string) => void): Promise<string> {
    const ai = this.getAI();
    const inventory = await this.getInventory();
    const leanInventory = inventory.map(i => i.name).join(', ');
    const formattedHistory = history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));
    while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') formattedHistory.shift();

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [...formattedHistory, { role: 'user', parts: [{ text: message }] }] as any,
      config: { systemInstruction: RECIPE_PROMPTS.chatPersona(recipe.title, leanInventory) }
    });
    let fullText = "";
    for await (const chunk of stream) { if (chunk.text) { fullText += chunk.text; onChunk?.(chunk.text); } }
    return fullText;
  }

  async summarizeAgreedRecipe(history: {role: string, text: string}[], currentRecipe?: Recipe): Promise<string> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: RECIPE_PROMPTS.consensusSummary(JSON.stringify(history), JSON.stringify(currentRecipe || {})),
      config: { 
        systemInstruction: `${SYSTEM_CORE}\nYou are the Head Chef summarizing our session.`,
        responseMimeType: "application/json" 
      }
    });
    return response.text || '';
  }

  async chatForDraft(history: {role: string, text: string}[]): Promise<string> {
    const ai = this.getAI();
    const inventory = await this.getInventory();
    const leanInventory = inventory.map(i => i.name).join(', ');
    const formattedHistory = history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));
    while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') formattedHistory.shift();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: formattedHistory as any,
      config: { systemInstruction: RECIPE_PROMPTS.draftingPersona(leanInventory) }
    });
    return response.text || '';
  }

  async generateRecipeImage(title: string): Promise<string> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: RECIPE_PROMPTS.imagePrompt(title) }] },
      config: { imageConfig: { aspectRatio: "4:3" } }
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part ? `data:image/png;base64,${part.inlineData.data}` : '';
  }

  // -- ABSTRACT PERSISTENCE (The Hands) --
  // Implementation of these must be provided by SaltSimulatedBackend or SaltFirebaseBackend.
  abstract login(email: string): Promise<User>;
  abstract logout(): Promise<void>;
  abstract getCurrentUser(): Promise<User | null>;
  abstract getUsers(): Promise<User[]>;
  abstract createUser(userData: Omit<User, 'id'>): Promise<User>;
  abstract deleteUser(id: string): Promise<void>;
  abstract getRecipes(): Promise<Recipe[]>;
  abstract getRecipe(id: string): Promise<Recipe | null>;
  abstract createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy'>): Promise<Recipe>;
  abstract updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe>;
  abstract deleteRecipe(id: string): Promise<void>;
  abstract getInventory(): Promise<Equipment[]>;
  abstract getEquipment(id: string): Promise<Equipment | null>;
  abstract createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>): Promise<Equipment>;
  abstract updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment>;
  abstract deleteEquipment(id: string): Promise<void>;
  abstract getPlans(): Promise<Plan[]>;
  abstract getPlanByDate(date: string): Promise<Plan | null>;
  abstract getPlanIncludingDate(date: string): Promise<Plan | null>;
  abstract createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'>): Promise<Plan>;
  abstract deletePlan(id: string): Promise<void>;
  abstract importSystemState(json: string): Promise<void>;
}