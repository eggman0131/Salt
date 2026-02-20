
import React, { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { DashboardLayout } from './components/Layout';
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
  const [dashboardWeek, setDashboardWeek] = useState<'current' | 'next'>('current');
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
    const [r, i, u, p, s, items, lists, units, aisles, cats] = await Promise.all([
      recipesBackend.getRecipes(),
      inventoryBackend.getInventory(),
      systemBackend.getUsers(),
      plannerBackend.getPlans(),
      systemBackend.getKitchenSettings(),
      kitchenDataBackend.getCanonicalItems(),
      shoppingBackend.getShoppingLists(),
      kitchenDataBackend.getUnits(),
      kitchenDataBackend.getAisles(),
      kitchenDataBackend.getCategories()
    ]);
    
    // Fetch all shopping list items for all lists
    const allShoppingItems: any[] = [];
    for (const list of lists) {
      const items = await shoppingBackend.getShoppingListItems(list.id);
      allShoppingItems.push(...items);
    }
    
    const exportObj = { 
      inventory: i, 
      recipes: r, 
      users: u, 
      plans: p, 
      settings: s,
      canonicalItems: items,
      shoppingLists: lists,
      shoppingListItems: allShoppingItems,
      units: units,
      aisles: aisles,
      categories: cats,
      exportedAt: new Date().toISOString() 
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
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
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      await systemBackend.importSystemState(text);
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
    const activePlan = dashboardWeek === 'current' ? currentPlan : nextPlan;
    const todaysMeal = currentPlan?.days.find(d => d.date === todayStr);

    return (
      <>
        <Toaster position="top-right" />
        <DashboardLayout 
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
          <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card 
                className="lg:col-span-2 p-6 md:p-8 border-l-4 border-l-orange-600 bg-white shadow-md shadow-orange-500/10 cursor-pointer hover:border-orange-300 transition-all flex flex-col justify-between overflow-hidden"
                onClick={() => setActiveTab('planner')}
              >
                <div>
                  <div className="flex justify-between items-start mb-4 md:mb-6">
                    <div>
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Weekly Menu</p>
                      <h3 className="text-xl md:text-2xl font-semibold text-gray-900">
                        {dashboardWeek === 'current' ? "this week's plan" : "next week's plan"}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-orange-50 text-orange-700 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide border border-orange-100 flex items-center gap-1 shadow-sm">
                        {dashboardWeek === 'current' ? 'LIVE' : 'DRAFT'}
                      </div>
                    </div>
                  </div>

                  {activePlan ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-3 md:space-y-4">
                        {activePlan.days.slice(0, 4).map((day, idx) => (
                          <div key={idx} className="flex gap-4">
                            <span className="text-xs font-semibold text-gray-400 uppercase w-12 pt-1">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{day.mealNotes || 'TBC'}</p>
                              <p className="text-xs text-gray-500 font-medium">{allUsers.find(u => u.id === day.cookId)?.displayName || 'TBC'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3 md:space-y-4 hidden sm:block">
                        {activePlan.days.slice(4).map((day, idx) => (
                          <div key={idx} className="flex gap-4">
                            <span className="text-xs font-semibold text-gray-400 uppercase w-12 pt-1">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{day.mealNotes || 'TBC'}</p>
                              <p className="text-xs text-gray-500 font-medium">{allUsers.find(u => u.id === day.cookId)?.displayName || 'TBC'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500 font-medium italic">Empty planner.</p>
                      <Button variant="ghost" className="mt-4 text-sm font-semibold text-orange-700 hover:text-orange-800" onClick={(e) => { e.stopPropagation(); setActiveTab('planner'); }}>Set Menu</Button>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDashboardWeek(dashboardWeek === 'current' ? 'next' : 'current');
                    }}
                    className="text-sm font-semibold text-orange-700 hover:text-orange-800"
                  >
                    {dashboardWeek === 'current' ? 'View Next Week' : 'Back to Current Week'} &rarr;
                  </button>
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="p-6 md:p-8 bg-white border-l-4 border-l-orange-600 shadow-md shadow-orange-500/10 h-full flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Tonight's Service</p>
                      <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-lg shadow-orange-400/60" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2 leading-tight">{todaysMeal?.mealNotes || 'Chef\'s Choice'}</h3>
                    <p className="text-sm text-gray-500">Ready for service.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-6 pt-6 border-t border-gray-50">
                    <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                      {allUsers.find(u => u.id === todaysMeal?.cookId)?.displayName?.[0] || '?'}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block">{allUsers.find(u => u.id === todaysMeal?.cookId)?.displayName || 'Unassigned'}</span>
                      <span className="text-xs uppercase tracking-wide font-medium text-gray-500">Head Chef</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Kitchen Helpers</p>
                <div className="h-px flex-1 bg-gray-100 ml-4" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <button 
                  onClick={() => setShowImportRecipeModal(true)}
                  className="p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 4v16m8-8H4"/></svg>
                  </div>
                  <p className="text-xs font-bold text-gray-900 mb-1">Import MFP Recipe</p>
                  <p className="text-[10px] text-gray-500 font-medium">Quick import</p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 md:p-6 text-center hover:bg-orange-50 cursor-pointer transition-all border-l-4 border-l-orange-600 border-y border-r border-gray-100 shadow-sm" onClick={() => setActiveTab('recipes')}>
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Recipes</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">{recipes.length}</p>
              </Card>
              <Card className="p-4 md:p-6 text-center hover:bg-orange-50 cursor-pointer transition-all border-l-4 border-l-orange-600 border-y border-r border-gray-100 shadow-sm" onClick={() => setActiveTab('inventory')}>
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Equipment</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">{inventory.length}</p>
              </Card>
              <Card className="p-4 md:p-6 text-center hover:bg-orange-50 cursor-pointer transition-all border-l-4 border-l-orange-600 border-y border-r border-gray-100 shadow-sm" onClick={() => setActiveTab('planner')}>
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Planner</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">{currentPlan ? 'Active' : 'Empty'}</p>
              </Card>
            </div>
          </div>
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
      </DashboardLayout>
      </>
    );
  }

  return null;
};

export default App;
