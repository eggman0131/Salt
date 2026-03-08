/**
 * Inventory AI provider.
 *
 * AI-powered equipment discovery: search candidates, generate details, validate accessories.
 * Uses Cloud Function transport (same pattern as recipes ai-transport).
 */

import { auth, functions } from '../../../shared/backend/firebase';
import { httpsCallable } from 'firebase/functions';
import type { Equipment, Accessory } from '../../../types/contract';
import type { EquipmentCandidate } from '../types';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

let cachedIdToken: string | null = null;

async function getFreshIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!cachedIdToken && !user) throw new Error('User not authenticated.');
  if (user) {
    try {
      cachedIdToken = await user.getIdToken(true);
    } catch (e) {
      if (!cachedIdToken) throw e;
    }
  }
  if (!cachedIdToken) throw new Error('Failed to obtain authentication token.');
  return cachedIdToken;
}

async function callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
  const idToken = await getFreshIdToken();
  const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
  const result = await cloudGenerateContent({ idToken, params });
  return result.data as GenerateContentResponse;
}

function parseEquipmentCandidates(text: string): EquipmentCandidate[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseEquipmentDetails(text: string): Partial<Equipment> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

function parseAccessoryValidation(text: string): Omit<Accessory, 'id'> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { name: '', owned: false, type: 'standard' };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name || '',
      description: parsed.description,
      owned: parsed.owned ?? false,
      type: parsed.type === 'optional' ? 'optional' : 'standard',
    };
  } catch {
    return { name: '', owned: false, type: 'standard' };
  }
}

export async function searchEquipmentCandidates(query: string): Promise<EquipmentCandidate[]> {
  if (!query || !query.trim()) return [];

  const systemInstruction =
    'You are a kitchen appliance database. Return equipment candidates matching the query in JSON format.';

  const response = await callGenerateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user' as const,
        parts: [
          {
            text: `Search for kitchen equipment matching: "${query}"\n\nReturn JSON array of candidates:\n[\n  {\n    "brand": "Brand Name",\n    "modelName": "Model",\n    "description": "Brief description"\n  }\n]\n\nReturn 3-5 realistic candidates. Return valid JSON array only.`,
          },
        ],
      },
    ],
    config: { systemInstruction },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseEquipmentCandidates(text);
}

export async function generateEquipmentDetails(
  candidate: EquipmentCandidate
): Promise<Partial<Equipment>> {
  const systemInstruction =
    'You are a kitchen equipment expert. Generate realistic equipment specifications in JSON format.';

  const response = await callGenerateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user' as const,
        parts: [
          {
            text: `Generate realistic specifications for this kitchen equipment:\n\nBrand: ${candidate.brand}\nModel: ${candidate.modelName}\nDescription: ${candidate.description || 'Standard kitchen equipment'}\n\nReturn JSON:\n{\n  "name": "Full equipment name",\n  "brand": "${candidate.brand}",\n  "modelName": "${candidate.modelName}",\n  "description": "2-3 sentence description",\n  "category": "Hob|Oven|Mixer|Blender|etc",\n  "estimatedCost": "£XXX-£XXX",\n  "features": ["feature1", "feature2"],\n  "accessories": ["accessory1", "accessory2"],\n  "powerUsage": "XXX watts",\n  "dimensions": "W x H x D in cm",\n  "weight": "XX kg",\n  "warrantyYears": 2\n}\n\nReturn valid JSON only.`,
          },
        ],
      },
    ],
    config: { systemInstruction },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseEquipmentDetails(text);
}

export async function validateAccessory(
  equipmentName: string,
  accessoryName: string
): Promise<Omit<Accessory, 'id'>> {
  const systemInstruction =
    'You are a kitchen equipment compatibility expert. Validate accessory compatibility.';

  const response = await callGenerateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user' as const,
        parts: [
          {
            text: `Validate if this accessory is compatible with the equipment:\n\nEquipment: ${equipmentName}\nAccessory: ${accessoryName}\n\nReturn JSON:\n{\n  "name": "${accessoryName}",\n  "description": "Compatibility notes and usage info",\n  "owned": true,\n  "type": "standard"\n}\n\nReturn valid JSON only.`,
          },
        ],
      },
    ],
    config: { systemInstruction },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAccessoryValidation(text);
}
