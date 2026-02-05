
import React, { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { DashboardLayout } from './components/Layout';
import { Card, Button } from './components/UI';
import { User, Recipe, Equipment, Plan } from './types/contract';
import { saltBackend } from './backend/api';
import { runParitySuite } from './scripts/parity-suite';

// Feature Modules
import { InventoryModule } from './components/InventoryModule';
import { RecipesModule } from './components/RecipesModule';
import { AdminModule } from './components/AdminModule';
import { AIModule } from './components/AIModule';
import { PlannerModule } from './components/PlannerModule';

type AppState = 'landing' | 'login' | 'dashboard';

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
  const [view, setView] = useState<AppState>('landing');
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

  const loadData = useCallback(async () => {
    const today = getLocalDateString();
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = getLocalDateString(nextWeekDate);

    const [r, i, u, p, nextP] = await Promise.all([
      saltBackend.getRecipes(),
      saltBackend.getInventory(),
      saltBackend.getUsers(),
      saltBackend.getPlanIncludingDate(today),
      saltBackend.getPlanIncludingDate(nextWeekStr)
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
      const currentUser = await saltBackend.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setView('dashboard');
      }
    };
    checkAuth();
  }, []);

  // Dev-only: Run parity suite if ?parity=1 query param is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('parity') === '1') {
      (async () => {
        console.log('🧪 Parity suite requested via query param');
        const report = await runParitySuite();
        (window as any).__SALT_PARITY__ = report;
        console.log('✅ Parity suite complete. Results available at window.__SALT_PARITY__');
      })();
    }
  }, []);

  // Refresh data whenever we switch tabs or log in
  useEffect(() => {
    if (view === 'dashboard') {
      loadData();
    }
  }, [view, activeTab, loadData]);

  const handleExportData = async () => {
    const [r, i, u, p, s] = await Promise.all([
      saltBackend.getRecipes(),
      saltBackend.getInventory(),
      saltBackend.getUsers(),
      saltBackend.getPlans(),
      saltBackend.getKitchenSettings()
    ]);
    const exportObj = { 
      inventory: i, 
      recipes: r, 
      users: u, 
      plans: p, 
      settings: s,
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
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      await saltBackend.importSystemState(text);
      await loadData();
      alert("Kitchen state restored.");
    } catch (err: any) {
      alert(err.message || "Restore failed.");
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
    await saltBackend.logout();
    setUser(null);
    setView('landing');
  };

  if (view === 'landing') return <LandingPage onStart={() => setView('login')} />;
  if (view === 'login') return <LoginPage onLoginSuccess={handleLoginSuccess} />;

  if (view === 'dashboard' && user) {
    const todayStr = getLocalDateString();
    const activePlan = dashboardWeek === 'current' ? currentPlan : nextPlan;
    const todaysMeal = currentPlan?.days.find(d => d.date === todayStr);

    return (
      <DashboardLayout 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        user={user} 
        onLogout={handleLogout}
      >
        {activeTab === 'dashboard' && (
          <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card 
                className="lg:col-span-2 p-6 md:p-8 border-l-4 border-l-blue-500 bg-white shadow-lg shadow-blue-500/5 cursor-pointer hover:border-blue-200 transition-all flex flex-col justify-between"
                onClick={() => setActiveTab('planner')}
              >
                <div>
                  <div className="flex justify-between items-start mb-4 md:mb-6">
                    <div>
                      <p className="text-[10px] font-black text-[#2563eb] uppercase tracking-widest mb-1">Weekly Menu</p>
                      <h3 className="text-xl md:text-2xl font-black text-gray-900">
                        {dashboardWeek === 'current' ? "this week's plan" : "next week's plan"}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100 flex items-center gap-1.5 shadow-sm">
                        {dashboardWeek === 'current' ? 'LIVE' : 'DRAFT'}
                      </div>
                    </div>
                  </div>

                  {activePlan ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-3 md:space-y-4">
                        {activePlan.days.slice(0, 4).map((day, idx) => (
                          <div key={idx} className="flex gap-4">
                            <span className="text-[10px] font-black text-gray-300 uppercase w-12 pt-1">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate leading-tight">{day.mealNotes || 'TBC'}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{allUsers.find(u => u.id === day.cookId)?.displayName || 'TBC'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3 md:space-y-4 hidden sm:block">
                        {activePlan.days.slice(4).map((day, idx) => (
                          <div key={idx} className="flex gap-4">
                            <span className="text-[10px] font-black text-gray-300 uppercase w-12 pt-1">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate leading-tight">{day.mealNotes || 'TBC'}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{allUsers.find(u => u.id === day.cookId)?.displayName || 'TBC'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-100">
                      <p className="text-sm text-gray-400 font-medium italic">Empty planner.</p>
                      <Button variant="ghost" className="mt-4 text-[10px] font-black uppercase tracking-widest" onClick={(e) => { e.stopPropagation(); setActiveTab('planner'); }}>Set Menu</Button>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDashboardWeek(dashboardWeek === 'current' ? 'next' : 'current');
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-[#2563eb] hover:underline"
                  >
                    {dashboardWeek === 'current' ? 'View Next Week' : 'Back to Current Week'} &rarr;
                  </button>
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="p-6 md:p-8 bg-white border-l-4 border-l-indigo-500 shadow-xl shadow-indigo-500/5 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Tonight's Service</p>
                      <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse shadow-lg shadow-indigo-500/50" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-2 leading-tight">{todaysMeal?.mealNotes || 'Chef\'s Choice'}</h3>
                    <p className="text-xs text-gray-400 font-sans italic opacity-60">Ready for service.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-6 pt-6 border-t border-gray-50">
                    <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center text-white text-[10px] font-black shadow-md">
                      {allUsers.find(u => u.id === todaysMeal?.cookId)?.displayName?.[0] || '?'}
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 block">{allUsers.find(u => u.id === todaysMeal?.cookId)?.displayName || 'Unassigned'}</span>
                      <span className="text-[9px] uppercase tracking-widest font-bold text-gray-300">Head Chef</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 md:p-6 text-center hover:border-blue-100 cursor-pointer transition-colors" onClick={() => setActiveTab('recipes')}>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Recipes</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{recipes.length}</p>
              </Card>
              <Card className="p-4 md:p-6 text-center hover:border-blue-100 cursor-pointer transition-colors" onClick={() => setActiveTab('inventory')}>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Equipment</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{inventory.length}</p>
              </Card>
              <Card className="p-4 md:p-6 text-center hover:border-blue-100 cursor-pointer transition-colors" onClick={() => setActiveTab('planner')}>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Planner</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{currentPlan ? 'Active' : 'Empty'}</p>
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

        {activeTab === 'ai' && (
          <AIModule onRecipeGenerated={() => { loadData(); setActiveTab('recipes'); }} />
        )}
      </DashboardLayout>
    );
  }

  return null;
};

export default App;
