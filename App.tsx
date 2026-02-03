
import React, { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { DashboardLayout } from './components/Layout';
import { Card, Button } from './components/UI';
import { User, Recipe, Equipment, Plan } from './types/contract';
import { saltBackend } from './backend/api';

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
  const [isImporting, setIsImporting] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('salt_last_sync'));

  const loadData = useCallback(async () => {
    const today = getLocalDateString();
    const [r, i, u, p] = await Promise.all([
      saltBackend.getRecipes(),
      saltBackend.getInventory(),
      saltBackend.getUsers(),
      saltBackend.getPlanIncludingDate(today)
    ]);
    setRecipes(r);
    setInventory(i);
    setAllUsers(u);
    setCurrentPlan(p);
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

  // Refresh data whenever we switch tabs or log in
  useEffect(() => {
    if (view === 'dashboard') {
      loadData();
    }
  }, [view, activeTab, loadData]);

  const handleExportData = async () => {
    const [r, i, u, p] = await Promise.all([
      saltBackend.getRecipes(),
      saltBackend.getInventory(),
      saltBackend.getUsers(),
      saltBackend.getPlans()
    ]);
    const exportObj = { 
      inventory: i, 
      recipes: r, 
      users: u, 
      plans: p, 
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
      alert("Kitchen state restored. Refreshing manifest...");
    } catch (err: any) {
      alert(err.message || "Restore failed. Invalid manifest format.");
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
    const todaysMeal = currentPlan?.days.find(d => d.date === todayStr);

    return (
      <DashboardLayout 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        user={user} 
        onLogout={handleLogout}
      >
        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Home Kitchen</h2>
                <p className="text-sm text-gray-500 font-medium font-sans">Shared family kitchen status and metrics.</p>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card 
                className="lg:col-span-2 p-8 border-l-4 border-l-blue-500 bg-white shadow-lg shadow-blue-500/5 cursor-pointer hover:border-blue-200 transition-all"
                onClick={() => setActiveTab('planner')}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Weekly Plan Summary</p>
                    <h3 className="text-xl font-bold text-gray-900">Menu Highlights</h3>
                  </div>
                  <div className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    {currentPlan ? 'Plan Active' : 'No Plan Set'}
                  </div>
                </div>

                {currentPlan ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {currentPlan.days.slice(0, 4).map((day, idx) => (
                        <div key={idx} className="flex gap-4">
                          <span className="text-[10px] font-black text-gray-300 uppercase w-12 pt-1">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{day.mealNotes || 'TBC'}</p>
                            <p className="text-[10px] text-gray-400 font-medium">Chef: {allUsers.find(u => u.id === day.cookId)?.displayName || 'TBC'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4 hidden sm:block">
                      {currentPlan.days.slice(4).map((day, idx) => (
                        <div key={idx} className="flex gap-4">
                          <span className="text-[10px] font-black text-gray-300 uppercase w-12 pt-1">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{day.mealNotes || 'TBC'}</p>
                            <p className="text-[10px] text-gray-400 font-medium">Chef: {allUsers.find(u => u.id === day.cookId)?.displayName || 'TBC'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-100">
                    <p className="text-sm text-gray-400 font-medium italic">Your kitchen planner is empty for this week.</p>
                    <Button variant="ghost" className="mt-4 text-[10px] font-black uppercase tracking-widest" onClick={() => setActiveTab('planner')}>Start Planning</Button>
                  </div>
                )}
              </Card>

              <div className="space-y-6">
                <Card className="p-8 bg-gray-900 text-white shadow-xl shadow-gray-900/10">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Tonight's Service</p>
                  <h3 className="text-2xl font-bold mb-2">{todaysMeal?.mealNotes || 'Chef\'s Choice'}</h3>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black">
                      {allUsers.find(u => u.id === todaysMeal?.cookId)?.displayName?.[0] || '?'}
                    </div>
                    <span className="text-xs font-bold text-gray-300">{allUsers.find(u => u.id === todaysMeal?.cookId)?.displayName || 'Unassigned'} is cooking</span>
                  </div>
                </Card>
                
                {/* Equipment Portability Card */}
                <Card className="p-6 border-2 border-dashed border-gray-100 bg-white">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Equipment Sync & Backup</p>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-500">Last Local Sync</span>
                      <span className="text-[10px] font-black text-[#2563eb]">{lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="h-9 text-[8px] uppercase font-black" onClick={handleExportData}>Export</Button>
                      <Button variant="secondary" className="h-9 text-[8px] uppercase font-black" onClick={() => setActiveTab('admin')}>Admin</Button>
                    </div>
                    <p className="text-[8px] text-gray-300 font-medium leading-tight">Use these to bridge your online kitchen with your local environment.</p>
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-6 text-center hover:border-blue-100 cursor-pointer transition-colors" onClick={() => setActiveTab('recipes')}>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Recipes</p>
                <p className="text-2xl font-bold text-gray-900">{recipes.length}</p>
              </Card>
              <Card className="p-6 text-center hover:border-blue-100 cursor-pointer transition-colors" onClick={() => setActiveTab('inventory')}>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Equipment</p>
                <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
              </Card>
              <Card className="p-6 text-center hover:border-blue-100 cursor-pointer transition-colors" onClick={() => setActiveTab('planner')}>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Week Cycle</p>
                <p className="text-2xl font-bold text-gray-900">{currentPlan ? 'Active' : 'Empty'}</p>
              </Card>
              <Card className="p-6 text-center hover:border-blue-100 cursor-pointer transition-colors" onClick={() => setActiveTab('admin')}>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Admin</p>
                <p className="text-2xl font-bold text-gray-900">Manage</p>
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
          <RecipesModule recipes={recipes} inventory={inventory} onRefresh={loadData} currentUser={user} />
        )}

        {activeTab === 'admin' && (
          <AdminModule 
            users={allUsers} 
            onRefresh={loadData} 
            onImport={handleImport} 
            onExport={handleExportData}
            isImporting={isImporting}
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
