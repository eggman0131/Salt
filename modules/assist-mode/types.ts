/**
 * Assist Mode types.
 *
 * Defines the schema for cooking guides with sensory cues.
 * These are derived from recipes and stored separately in Firestore.
 */

export interface PrepGroup {
  id: string;
  container: string;        // e.g. "Medium bowl", "Small pot"
  label: string;            // e.g. "Soffritto: Dice carrot, onion & celery (5mm)"
  ingredients: string[];    // e.g. ["250g onion, diced", "150g carrot, diced"]
  prepInstructions: string; // e.g. "Dice all to ~5mm cubes"
}

export interface SensoryCues {
  visual?: string;   // "Onions translucent, not brown at edges"
  audio?: string;    // "Gentle sizzling like light rain on a window"
  aroma?: string;    // "Sweet, toasted aroma, no burnt smell"
  texture?: string;  // "Soft when pressed with spatula"
}

export interface CookingStep {
  id: string;                   // Persistent ID: survives reordering/deletion
  stepNumber: number;
  instructionIndex?: number;    // Index into recipe.instructions[] for linking
  instruction: string;
  containerReference?: string;  // e.g. "Add the Soffritto to the pan"
  temperature?: string;         // e.g. "Medium-high (7 out of 10 on dial)"
  timeEstimate?: string;        // e.g. "3-5 minutes"
  sensoryCues: SensoryCues;
  progressionCheck: string;     // "Before continuing: ..."
}

export interface CookGuide {
  id: string;
  recipeId: string;       // Links to Recipe (read-only)
  recipeTitle: string;    // Snapshot for display
  recipeVersion: string;  // Hash to detect stale guides
  prepGroups: PrepGroup[];
  steps: CookingStep[];
  generatedAt: string;
  generatedBy: string;
}
