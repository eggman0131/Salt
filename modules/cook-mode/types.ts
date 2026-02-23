/**
 * Cook Mode Types
 * 
 * Defines the schema for Assist Mode cooking guides with sensory cues.
 * These are derived from recipes and stored separately.
 */

export interface PrepGroup {
  id: string;
  container: string;           // "Bowl 1", "Small pot", "Measuring jug"
  label: string;               // "Soffritto", "Dry spices", "Marinade"
  ingredients: string[];       // ["onion", "carrot", "celery"]
  prepInstructions: string;    // "Dice all to ~5mm cubes, can go in same bowl"
}

export interface SensoryCues {
  visual?: string;             // "Onions should be translucent, not brown at edges"
  audio?: string;              // "Gentle sizzling like light rain on a window"
  aroma?: string;              // "Sweet, toasted aroma, no burnt smell"
  texture?: string;            // "Soft when pressed with spatula"
}

export interface CookingStep {
  stepNumber: number;
  instruction: string;
  containerReference?: string; // "Add Bowl 1 (soffritto)" or null for multi-step
  temperature?: string;        // "Medium-high (7 out of 10 on dial)"
  timeEstimate?: string;       // "3-5 minutes"
  sensoryCues: SensoryCues;
  progressionCheck: string;    // "Before continuing: onions soft and translucent, sizzle is quiet and gentle, no browning at edges. If not ready, cook 1-2 more minutes."
}

export interface CookGuide {
  id: string;
  recipeId: string;            // Links to Recipe (read-only)
  recipeTitle: string;         // Snapshot for display
  recipeVersion: string;       // Hash to detect stale guides
  prepGroups: PrepGroup[];
  steps: CookingStep[];
  generatedAt: string;
  generatedBy: string;
}
