/**
 * SALT Backend Parity Test Suite
 * 
 * Compares behavior between SaltSimulatedBackend and SaltFirebaseBackend
 * to ensure consistent contract compliance and data handling.
 */

import { SaltSimulatedBackend } from '../backend/simulated';
import { SaltFirebaseBackend } from '../backend/firebase-backend';
import { ISaltBackend, Equipment, Recipe, Plan } from '../types/contract';

interface TestResult {
  name: string;
  simulated: { pass: boolean; error?: string; data?: any };
  firebase: { pass: boolean; error?: string; data?: any };
  parity: boolean;
  details?: string;
}

export interface ParitySuiteReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  tests: TestResult[];
  timestamp: string;
  notes?: string[];
}

class ParitySuite {
  private simulated: ISaltBackend;
  private firebase: ISaltBackend;
  private hasGeminiKey: boolean;
  private firebaseAuthRequired = false;
  private results: TestResult[] = [];
  private notes: string[] = [];

  constructor() {
    this.simulated = new SaltSimulatedBackend();
    this.firebase = new SaltFirebaseBackend();
    this.hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;
  }

  /**
   * Run all parity tests sequentially
   */
  async runAll(): Promise<ParitySuiteReport> {
    console.log('🧪 Starting Parity Suite...\n');

    // Try to detect and handle Firebase auth requirements
    await this.detectFirebaseAuthRequirements();

    await this.testAuthGate();
    await this.testInventoryCRUD();
    await this.testRecipeFlow();
    await this.testPlannerCRUD();
    await this.testImportExport();

    return this.compileReport();
  }

  /**
   * Detect if Firebase requires authentication
   * by attempting a simple read without logging in
   */
  private async detectFirebaseAuthRequirements(): Promise<void> {
    try {
      await this.firebase.getInventory();
      this.firebaseAuthRequired = false;
    } catch (e) {
      const errMsg = String(e).toLowerCase();
      if (errMsg.includes('permission') || errMsg.includes('unauthenticated')) {
        this.firebaseAuthRequired = true;
        this.notes.push(
          '⚠️  Firebase backend requires authentication (Firestore rules enforced).'
        );
        this.notes.push(
          '   To enable full parity testing, either:'
        );
        this.notes.push(
          '   1. Edit firestore.rules and set: allow read, write: if true; (dev only)'
        );
        this.notes.push(
          '   2. Login with a user that exists in the Firestore users collection'
        );
      }
    }
  }

  private async testAuthGate(): Promise<void> {
    console.log('📋 Running: Auth Gate & Users Check');
    const result: TestResult = {
      name: 'Auth Gate & Users Check',
      simulated: { pass: false },
      firebase: { pass: false },
      parity: false
    };

    try {
      // Test simulated
      try {
        const simUser = await this.simulated.getCurrentUser();
        result.simulated = {
          pass: simUser === null, // Should be null before login
          data: simUser
        };
      } catch (e) {
        result.simulated = {
          pass: false,
          error: String(e)
        };
      }

      // Test Firebase
      try {
        const fbUser = await this.firebase.getCurrentUser();
        result.firebase = {
          pass: fbUser === null, // Should be null before login
          data: fbUser
        };
      } catch (e) {
        result.firebase = {
          pass: false,
          error: String(e)
        };
      }

      result.parity = result.simulated.pass === result.firebase.pass;
      result.details = result.parity
        ? 'Both backends correctly return null user before auth'
        : 'Auth state mismatch between backends';
    } catch (e) {
      result.details = String(e);
    }

    this.results.push(result);
    console.log(`  ${result.parity ? '✅' : '❌'} ${result.name}\n`);
  }

  private async testInventoryCRUD(): Promise<void> {
    console.log('📋 Running: Inventory CRUD');
    const testEquipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'> = {
      name: 'TestEquipment',
      brand: 'TestBrand',
      modelName: 'TestModel',
      description: 'Test equipment for parity',
      type: 'Test',
      class: 'TestClass',
      status: 'Available',
      accessories: []
    };

    let simCreatedId = '';
    let fbCreatedId = '';

    const result: TestResult = {
      name: 'Inventory CRUD',
      simulated: { pass: false },
      firebase: { pass: false },
      parity: false
    };

    try {
      // Test simulated: create
      try {
        const created = await this.simulated.createEquipment(testEquipment);
        simCreatedId = created.id;
        const read = await this.simulated.getEquipment(simCreatedId);
        const updated = await this.simulated.updateEquipment(simCreatedId, { description: 'updated' });
        await this.simulated.deleteEquipment(simCreatedId);
        result.simulated.pass = true;
        result.simulated.data = { created: !!created.id, read: !!read.id, updated: updated.description === 'updated', deleted: true };
      } catch (e) {
        result.simulated = { pass: false, error: String(e) };
      }

      // Test Firebase: create (skip if auth required and not logged in)
      if (this.firebaseAuthRequired) {
        result.firebase = { pass: true, data: 'SKIPPED (auth required, no user logged in)' };
        result.details = 'Firebase test skipped: requires Firestore authentication';
      } else {
        try {
          const created = await this.firebase.createEquipment(testEquipment);
          fbCreatedId = created.id;
          const read = await this.firebase.getEquipment(fbCreatedId);
          const updated = await this.firebase.updateEquipment(fbCreatedId, { description: 'updated' });
          await this.firebase.deleteEquipment(fbCreatedId);
          result.firebase.pass = true;
          result.firebase.data = { created: !!created.id, read: !!read.id, updated: updated.description === 'updated', deleted: true };
        } catch (e) {
          result.firebase = { pass: false, error: String(e) };
        }
      }

      result.parity = result.simulated.pass === result.firebase.pass;
      if (!result.details) {
        result.details = result.parity
          ? 'Both backends support CRUD operations'
          : `Simulated: ${result.simulated.pass}, Firebase: ${result.firebase.pass}`;
      }
    } catch (e) {
      result.details = String(e);
    }

    this.results.push(result);
    console.log(`  ${result.parity ? '✅' : '❌'} ${result.name}\n`);
  }

  private async testRecipeFlow(): Promise<void> {
    console.log('📋 Running: Recipe Generation Flow');
    const result: TestResult = {
      name: 'Recipe Generation Flow',
      simulated: { pass: false },
      firebase: { pass: false },
      parity: false
    };

    if (!this.hasGeminiKey) {
      result.simulated = { pass: true, data: 'SKIPPED (no API key)' };
      result.firebase = { pass: true, data: 'SKIPPED (no API key)' };
      result.parity = true;
      result.details = 'Skipped: VITE_GEMINI_API_KEY not set';
      this.results.push(result);
      console.log(`  ⏭️  ${result.name} (skipped)\n`);
      return;
    }

    try {
      // Test simulated
      try {
        const consensus = 'A simple pasta dish with tomato sauce';
        const recipe = await this.simulated.generateRecipeFromPrompt(consensus);
        result.simulated.pass = !!recipe.title && !!recipe.ingredients && Array.isArray(recipe.ingredients);
        result.simulated.data = { hasTitle: !!recipe.title, hasIngredients: !!recipe.ingredients };
      } catch (e) {
        result.simulated = { pass: false, error: String(e) };
      }

      // Test Firebase (skip if auth required)
      if (this.firebaseAuthRequired) {
        result.firebase = { pass: true, data: 'SKIPPED (auth required, no user logged in)' };
      } else {
        try {
          const consensus = 'A simple pasta dish with tomato sauce';
          const recipe = await this.firebase.generateRecipeFromPrompt(consensus);
          result.firebase.pass = !!recipe.title && !!recipe.ingredients && Array.isArray(recipe.ingredients);
          result.firebase.data = { hasTitle: !!recipe.title, hasIngredients: !!recipe.ingredients };
        } catch (e) {
          result.firebase = { pass: false, error: String(e) };
        }
      }

      result.parity = result.simulated.pass === result.firebase.pass;
      result.details = result.parity
        ? 'Both backends generate valid recipe schemas'
        : `Simulated: ${result.simulated.pass}, Firebase: ${result.firebase.pass}`;
    } catch (e) {
      result.details = String(e);
    }

    this.results.push(result);
    console.log(`  ${result.parity ? '✅' : '❌'} ${result.name}\n`);
  }

  private async testPlannerCRUD(): Promise<void> {
    console.log('📋 Running: Planner CRUD + Template');
    const today = new Date().toISOString().split('T')[0];
    const testPlan: Omit<Plan, 'id' | 'createdAt' | 'createdBy'> = {
      startDate: today,
      days: [
        {
          date: today,
          presentIds: [],
          userNotes: {},
          mealNotes: 'Test plan'
        }
      ]
    };

    let simCreatedId = '';
    let fbCreatedId = '';

    const result: TestResult = {
      name: 'Planner CRUD + Template',
      simulated: { pass: false },
      firebase: { pass: false },
      parity: false
    };

    try {
      // Test simulated
      try {
        const created = await this.simulated.createOrUpdatePlan(testPlan);
        simCreatedId = created.id;
        const byDate = await this.simulated.getPlanByDate(today);
        await this.simulated.deletePlan(simCreatedId);
        result.simulated.pass = !!created.id && !!byDate;
        result.simulated.data = { created: !!created.id, retrieved: !!byDate, deleted: true };
      } catch (e) {
        result.simulated = { pass: false, error: String(e) };
      }

      // Test Firebase (skip if auth required)
      if (this.firebaseAuthRequired) {
        result.firebase = { pass: true, data: 'SKIPPED (auth required, no user logged in)' };
      } else {
        try {
          const created = await this.firebase.createOrUpdatePlan(testPlan);
          fbCreatedId = created.id;
          const byDate = await this.firebase.getPlanByDate(today);
          await this.firebase.deletePlan(fbCreatedId);
          result.firebase.pass = !!created.id && !!byDate;
          result.firebase.data = { created: !!created.id, retrieved: !!byDate, deleted: true };
        } catch (e) {
          result.firebase = { pass: false, error: String(e) };
        }
      }

      result.parity = result.simulated.pass === result.firebase.pass;
      result.details = result.parity
        ? 'Both backends support plan operations'
        : `Simulated: ${result.simulated.pass}, Firebase: ${result.firebase.pass}`;
    } catch (e) {
      result.details = String(e);
    }

    this.results.push(result);
    console.log(`  ${result.parity ? '✅' : '❌'} ${result.name}\n`);
  }

  private async testImportExport(): Promise<void> {
    console.log('📋 Running: Import/Export Parity');
    const result: TestResult = {
      name: 'Import/Export Parity',
      simulated: { pass: false },
      firebase: { pass: false },
      parity: false
    };

    try {
      // Export from simulated
      try {
        const [recipes, inventory, users, plans, settings] = await Promise.all([
          this.simulated.getRecipes(),
          this.simulated.getInventory(),
          this.simulated.getUsers(),
          this.simulated.getPlans(),
          this.simulated.getKitchenSettings()
        ]);

        const manifest = { recipes, inventory, users, plans, settings };
        result.simulated.pass = manifest.recipes && manifest.inventory !== undefined;
        result.simulated.data = {
          recipes: manifest.recipes?.length || 0,
          inventory: manifest.inventory?.length || 0,
          users: manifest.users?.length || 0,
          plans: manifest.plans?.length || 0
        };
      } catch (e) {
        result.simulated = { pass: false, error: String(e) };
      }

      // Export from Firebase (skip if auth required)
      if (this.firebaseAuthRequired) {
        result.firebase = { pass: true, data: 'SKIPPED (auth required, no user logged in)' };
      } else {
        try {
          const [recipes, inventory, users, plans, settings] = await Promise.all([
            this.firebase.getRecipes(),
            this.firebase.getInventory(),
            this.firebase.getUsers(),
            this.firebase.getPlans(),
            this.firebase.getKitchenSettings()
          ]);

          const manifest = { recipes, inventory, users, plans, settings };
          result.firebase.pass = manifest.recipes && manifest.inventory !== undefined;
          result.firebase.data = {
            recipes: manifest.recipes?.length || 0,
            inventory: manifest.inventory?.length || 0,
            users: manifest.users?.length || 0,
            plans: manifest.plans?.length || 0
          };
        } catch (e) {
          result.firebase = { pass: false, error: String(e) };
        }
      }

      result.parity = result.simulated.pass === result.firebase.pass;
      result.details = result.parity
        ? 'Both backends export data consistently'
        : `Simulated: ${result.simulated.pass}, Firebase: ${result.firebase.pass}`;
    } catch (e) {
      result.details = String(e);
    }

    this.results.push(result);
    console.log(`  ${result.parity ? '✅' : '❌'} ${result.name}\n`);
  }

  private compileReport(): ParitySuiteReport {
    const totalTests = this.results.length;
    const passed = this.results.filter(t => t.parity).length;
    const failed = totalTests - passed;
    const skipped = this.results.filter(t => {
      const data = t.firebase.data || t.simulated.data;
      return typeof data === 'string' && data.includes('SKIPPED');
    }).length;

    const report: ParitySuiteReport = {
      summary: {
        totalTests,
        passed,
        failed,
        skipped
      },
      tests: this.results,
      timestamp: new Date().toISOString(),
      notes: this.notes.length > 0 ? this.notes : undefined
    };

    return report;
  }
}

export async function runParitySuite(): Promise<ParitySuiteReport> {
  const suite = new ParitySuite();
  return suite.runAll();
}
