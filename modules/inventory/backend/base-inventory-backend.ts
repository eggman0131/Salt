/**
 * Base Inventory Backend
 * 
 * Contains domain logic for equipment management including:
 * - Equipment discovery and search
 * - AI-powered detail generation from candidates
 * - Accessory compatibility validation
 * 
 * Subclasses (Firebase, Simulation) implement persistence.
 */

import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  Equipment,
  EquipmentCandidate,
  Accessory,
} from '../../../types/contract';
import { IInventoryBackend } from './inventory-backend.interface';

export abstract class BaseInventoryBackend implements IInventoryBackend {
  
  // ==================== ABSTRACT METHODS ====================
  // Subclasses MUST implement persistence and AI transport
  
  protected abstract callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  protected abstract getSystemInstruction(customContext?: string): Promise<string>;
  
  // Equipment CRUD (persistence)
  abstract getInventory(): Promise<Equipment[]>;
  abstract getEquipment(id: string): Promise<Equipment | null>;
  abstract createEquipment(
    equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<Equipment>;
  abstract updateEquipment(
    id: string,
    equipment: Partial<Equipment>
  ): Promise<Equipment>;
  abstract deleteEquipment(id: string): Promise<void>;
  
  // ==================== AI-POWERED EQUIPMENT DISCOVERY ====================
  
  async searchEquipmentCandidates(query: string): Promise<EquipmentCandidate[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    const systemInstruction = await this.getSystemInstruction(
      'You are a kitchen appliance database. Return equipment candidates matching the query in JSON format.'
    );
    
    const response = await this.callGenerateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user' as const,
          parts: [{
            text: `Search for kitchen equipment matching: "${query}"\n\nReturn JSON array of candidates:\n[\n  {\n    "brand": "Brand Name",\n    "modelName": "Model",\n    "description": "Brief description"\n  }\n]\n\nReturn 3-5 realistic candidates. Return valid JSON array only.`
          }]
        }
      ],
      config: { systemInstruction }
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return this.parseEquipmentCandidates(text);
  }
  
  async generateEquipmentDetails(
    candidate: EquipmentCandidate
  ): Promise<Partial<Equipment>> {
    const systemInstruction = await this.getSystemInstruction(
      'You are a kitchen equipment expert. Generate realistic equipment specifications in JSON format.'
    );
    
    const response = await this.callGenerateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user' as const,
          parts: [{
            text: `Generate realistic specifications for this kitchen equipment:\n\nBrand: ${candidate.brand}\nModel: ${candidate.modelName}\nDescription: ${candidate.description || 'Standard kitchen equipment'}\n\nReturn JSON:\n{\n  "name": "Full equipment name",\n  "brand": "${candidate.brand}",\n  "modelName": "${candidate.modelName}",\n  "description": "2-3 sentence description",\n  "category": "Hob|Oven|Mixer|Blender|etc",\n  "estimatedCost": "£XXX-£XXX",\n  "features": ["feature1", "feature2"],\n  "accessories": ["accessory1", "accessory2"],\n  "powerUsage": "XXX watts",\n  "dimensions": "W x H x D in cm",\n  "weight": "XX kg",\n  "warrantyYears": 2\n}\n\nReturn valid JSON only.`
          }]
        }
      ],
      config: { systemInstruction }
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return this.parseEquipmentDetails(text);
  }
  
  async validateAccessory(
    equipmentName: string,
    accessoryName: string
  ): Promise<Omit<Accessory, 'id'>> {
    const systemInstruction = await this.getSystemInstruction(
      'You are a kitchen equipment compatibility expert. Validate accessory compatibility.'
    );
    
    const response = await this.callGenerateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user' as const,
          parts: [{
            text: `Validate if this accessory is compatible with the equipment:\n\nEquipment: ${equipmentName}\nAccessory: ${accessoryName}\n\nReturn JSON:\n{\n  "name": "${accessoryName}",\n  "description": "Compatibility notes and usage info",\n  "owned": true,\n  "type": "standard"\n}\n\nReturn valid JSON only.`
          }]
        }
      ],
      config: { systemInstruction }
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return this.parseAccessoryValidation(text);
  }
  
  // ==================== HELPERS ====================
  
  protected parseEquipmentCandidates(text: string): EquipmentCandidate[] {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to parse equipment candidates:', error);
      return [];
    }
  }
  
  protected parseEquipmentDetails(text: string): Partial<Equipment> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return {};
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.warn('Failed to parse equipment details:', error);
      return {};
    }
  }
  
  protected parseAccessoryValidation(text: string): Omit<Accessory, 'id'> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { name: '', owned: false, type: 'standard' };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name || '',
        description: parsed.description,
        owned: parsed.owned ?? false,
        type: (parsed.type === 'standard' || parsed.type === 'optional') ? parsed.type : 'standard'
      };
    } catch (error) {
      console.warn('Failed to parse accessory validation:', error);
      return { name: '', owned: false, type: 'standard' };
    }
  }
}
