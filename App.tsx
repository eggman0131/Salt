
import React, { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { AppLayout } from './components/layout/AppLayout';
import { User, Recipe, Equipment, Plan } from './types/contract';
import { systemBackend } from './shared/backend/system-backend';
import { ensureEmulatorAuth } from './shared/backend/auth-emulator';
import { Toaster } from '@/components/ui/sonner';
import { debugLogger } from '@/shared/backend/debug-logger';

// Feature Modules
import { InventoryModule, getInventory } from './modules/inventory';
import {
  AIModule as RecipesAIModule,
  getRecipes,
  RecipesModule,
} from './modules/recipes';
import { PlannerModule, getPlans, getKitchenSettings, findPlanForDate } from './modules/planner';
import { ShoppingListModule } from './modules/shopping-list';
import { CanonItemsWorkspace } from './modules/canon';
import { AdminDashboard } from './modules/admin';
import { ImportMFPRecipeModal } from './components/Helpers/ImportMFPRecipeModal';
import { Dashboard } from './components/Dashboard';

type AppState = 'landing' | 'login' | 'dashboard' | 'loading';

/**
 * Robust helper to get YYYY-MM-DD in local time
 */
const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const App: React.FC = () => {
  const [view, setView] = useState<AppState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [resetKey, setResetKey] = useState(0);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<Equipment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [nextPlan, setNextPlan] = useState<Plan | null>(null);
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);
  const [showImportRecipeModal, setShowImportRecipeModal] = useState(false);

  // Ref for sidebar suggestions counter update
  const suggestionsCountRef = React.useRef<(() => void) | null>(null);
  
  const refreshSuggestionsCount = useCallback(() => {
    if (suggestionsCountRef.current) {
      suggestionsCountRef.current();
    }
  }, []);

  const loadData = useCallback(async () => {
    const today = getLocalDateString();
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = getLocalDateString(nextWeekDate);

    const [r, i, u, plans] = await Promise.all([
      getRecipes(),
      getInventory(),
      systemBackend.getUsers(),
      getPlans(),
    ]);
    setRecipes(r);
    setInventory(i);
    setAllUsers(u);
    setCurrentPlan(findPlanForDate(plans, today));
    setNextPlan(findPlanForDate(plans, nextWeekStr));
  }, []);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Emulator auto-auth (no-op in production)
      await ensureEmulatorAuth();

      try {
        // 1. Check for Redirect Result (Firebase Redirect Flow)
        const redirectUser = await systemBackend.handleRedirectResult();
        if (redirectUser) {
          setUser(redirectUser);
          setView('dashboard');
          return;
        }
      } catch (e) {
        console.error("Auth redirect check failed:", e);
        // Continue to check current user...
      }

      // 2. Check for Existing Session (Firebase Persistence or Simulation)
      const currentUser = await systemBackend.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setView('dashboard');
      } else {
        setView('landing');
      }
    };
    checkAuth();
  }, []);

  // Initialize debug logger from settings on app startup
  useEffect(() => {
    getKitchenSettings().then(settings => {
      debugLogger.setEnabled(settings.debugEnabled || false);
    }).catch(error => {
      console.error('Failed to load kitchen settings:', error);
    });
  }, []);

  // Refresh data whenever we switch tabs or log in
  useEffect(() => {
    if (view === 'dashboard') {
      loadData();
    }
  }, [view, activeTab, loadData]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setView('dashboard');
  };

  const handleLogout = async () => {
    await systemBackend.logout();
    setUser(null);
    setView('landing');
  };

  const handleImportRecipeSubmit = (title: string, servings: string, ingredients: string) => {
    // Create the prompt for AI module with enforced title
    const prompt = `You MUST create a recipe called "${title}". The dish name must remain exactly "${title}". Create a recipe for ${title}, ${servings} servings, use the following ingredients exactly:\n${ingredients}`;
    
    setAiInitialMessage(prompt);
    setShowImportRecipeModal(false);
    setActiveTab('ai');
  };

  if (view === 'loading') return null;
  if (view === 'landing') return (
    <>
      <Toaster position="top-right" />
      <LandingPage onStart={() => setView('login')} />
    </>
  );
  if (view === 'login') return (
    <>
      <Toaster position="top-right" />
      <LoginPage onLoginSuccess={handleLoginSuccess} />
    </>
  );

  if (view === 'dashboard' && user) {
    const todayStr = getLocalDateString();
    const todaysMeal = currentPlan?.days.find(d => d.date === todayStr);

    return (
      <>
        <Toaster position="top-right" />
        <AppLayout 
        activeTab={activeTab} 
        onTabChange={(tabId) => {
          if (tabId !== 'ai') setAiInitialMessage(undefined);
          if (tabId === activeTab) {
            // Same tab clicked - reset the module by incrementing key
            setResetKey(prev => prev + 1);
          } else {
            // Different tab - switch and reset key counter
            setActiveTab(tabId);
            setResetKey(0);
          }
        }} 
        user={user} 
        onLogout={handleLogout}
        suggestionsCountRef={suggestionsCountRef}
      >
        {activeTab === 'dashboard' && (
          <Dashboard
            key={`dashboard-${resetKey}`}
            user={user}
            todaysMeal={todaysMeal}
            currentPlan={currentPlan}
            nextPlan={nextPlan}
            allUsers={allUsers}
            recipes={recipes}
            equipmentCount={inventory.length}
            onTabChange={setActiveTab}
            onShowImportModal={() => setShowImportRecipeModal(true)}
          />
        )}

        {activeTab === 'planner' && (
          <PlannerModule key={`planner-${resetKey}`} users={allUsers} recipes={recipes} onRefresh={loadData} />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListModule key={`shopping-${resetKey}`} />
        )}

        {activeTab === 'inventory' && (
          <InventoryModule key={`inventory-${resetKey}`} inventory={inventory} onRefresh={loadData} />
        )}

        {activeTab === 'recipes' && (
          <RecipesModule key={`recipes-${resetKey}`} onNavigateToChef={() => setActiveTab('ai')} />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard key={`admin-${resetKey}`} />
        )}

        {activeTab === 'canon' && (
          <CanonItemsWorkspace key={`canon-${resetKey}`} />
        )}

        {activeTab === 'ai' && (
          <RecipesAIModule
            key={`ai-${resetKey}`}
            initialUserMessage={aiInitialMessage} 
            onRecipeGenerated={() => { 
              setAiInitialMessage(undefined);
              loadData(); 
              setActiveTab('recipes'); 
            }} 
          />
        )}

        {showImportRecipeModal && (
          <ImportMFPRecipeModal
            onSubmit={handleImportRecipeSubmit}
            onCancel={() => setShowImportRecipeModal(false)}
          />
        )}
      </AppLayout>
      </>
    );
  }

  return null;
};

export default App;
