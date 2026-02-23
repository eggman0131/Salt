
import React, { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { AppLayout } from './components/layout/AppLayout';
import { Card, Button } from './components/UI';
import { User, Recipe, Equipment, Plan } from './types/contract';
import { systemBackend } from './shared/backend/system-backend';
import { ensureEmulatorAuth } from './shared/backend/auth-emulator';
import { softToast } from '@/lib/soft-toast';
import { Toaster } from '@/components/ui/sonner';

// Feature Modules
import { InventoryModule } from './modules/inventory';
import { inventoryBackend } from './modules/inventory';
import { RecipesModule } from './modules/recipes';
import { recipesBackend } from './modules/recipes';
import { AdminModule } from './modules/admin';
import { AIModule } from './modules/ai';
import { PlannerModule } from './modules/planner';
import { plannerBackend } from './modules/planner';
import { KitchenDataModule } from './modules/kitchen-data';
import { kitchenDataBackend } from './modules/kitchen-data';
import { ShoppingListModule } from './modules/shopping';
import { shoppingBackend } from './modules/shopping';
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
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<Equipment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [nextPlan, setNextPlan] = useState<Plan | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('salt_last_sync'));
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

    const [r, i, u, p, nextP] = await Promise.all([
      recipesBackend.getRecipes(),
      inventoryBackend.getInventory(),
      systemBackend.getUsers(),
      plannerBackend.getPlanIncludingDate(today),
      plannerBackend.getPlanIncludingDate(nextWeekStr)
    ]);
    setRecipes(r);
    setInventory(i);
    setAllUsers(u);
    setCurrentPlan(p);
    setNextPlan(nextP);
    setLastSync(localStorage.getItem('salt_last_sync'));
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

  // Refresh data whenever we switch tabs or log in
  useEffect(() => {
    if (view === 'dashboard') {
      loadData();
    }
  }, [view, activeTab, loadData]);

  const handleExportData = async () => {
    try {
      const exportData = await systemBackend.exportAllData();
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salt-backup-${getLocalDateString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setLastSync(new Date().toISOString());
      softToast.success('Backup created', {
        description: `Downloaded as salt-backup-${getLocalDateString()}.json`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      softToast.error('Backup failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await systemBackend.importAllData(data);
      await loadData();
      softToast.success('Kitchen state restored', {
        description: 'All data imported successfully',
      });
    } catch (err: any) {
      softToast.error('Restore failed', {
        description: err.message || 'Unable to import backup file',
      });
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = ''; 
    }
  };

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
          setActiveTab(tabId);
        }} 
        user={user} 
        onLogout={handleLogout}
        suggestionsCountRef={suggestionsCountRef}
      >
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            todaysMeal={todaysMeal}
            currentPlan={currentPlan}
            nextPlan={nextPlan}
            allUsers={allUsers}
            recipes={recipes}
            equipmentCount={inventory.length}
            shoppingListsCount={0}
            onTabChange={setActiveTab}
            onShowImportModal={() => setShowImportRecipeModal(true)}
          />
        )}

        {activeTab === 'planner' && (
          <PlannerModule users={allUsers} onRefresh={loadData} />
        )}

        {activeTab === 'inventory' && (
          <InventoryModule inventory={inventory} onRefresh={loadData} />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListModule onRefresh={loadData} />
        )}

        {activeTab === 'recipes' && (
          <RecipesModule recipes={recipes} inventory={inventory} onRefresh={loadData} currentUser={user} onNewRecipe={() => setActiveTab('ai')} />
        )}

        {activeTab === 'admin' && (
          <AdminModule 
            users={allUsers} 
            onRefresh={loadData} 
            onImport={handleImport} 
            onExport={handleExportData}
            isImporting={isImporting}
            lastSync={lastSync}
          />
        )}

        {activeTab === 'kitchendata' && (
          <KitchenDataModule onRefresh={loadData} onSuggestionsChanged={refreshSuggestionsCount} />
        )}

        {activeTab === 'ai' && (
          <AIModule 
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
