import React, { useState } from 'react';
import { Home, Compass, User as UserIcon, Settings, Plus, BookOpen, Puzzle } from 'lucide-react';
import { V2InventoryModule } from './inventory/V2InventoryModule';
import { V2RecipesModule } from './recipes/V2RecipesModule';
import { getInventory } from '../inventory';
import { Equipment } from '../../types/contract';
import { Button } from './design-system/components/Button';

export const V2App = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventory, setInventory] = useState<Equipment[]>([]);
  const [isDark, setIsDark] = useState(false); // default light mode for V2

  React.useEffect(() => {
    // Add V2 base class
    document.body.classList.add('v2-ui');
    return () => {
      document.body.classList.remove('v2-ui');
    };
  }, []);

  React.useEffect(() => {
    // Sync theme
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const loadData = async () => {
    const data = await getInventory();
    setInventory(data);
  };

  React.useEffect(() => {
    if (activeTab === 'inventory') {
      loadData();
    }
  }, [activeTab]);

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'recipes', icon: BookOpen, label: 'Recipes' },
    { id: 'inventory', icon: Puzzle, label: 'Equipment' },
    { id: 'profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className="relative h-screen w-full overflow-hidden text-[var(--color-v2-foreground)] bg-[var(--color-v2-background)] transition-colors duration-500">
      
      {/* 
        ==============================
        TOP HEADER & ACTIONS
        ==============================
      */}
      <header className="absolute top-0 inset-x-0 p-6 md:p-10 flex items-center justify-between z-30 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto group">
          <div className="h-12 w-12 bg-gradient-to-br from-[var(--color-v2-primary)] to-[var(--color-v2-accent)] rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--color-v2-primary)]/30 group-hover:scale-105 transition-transform duration-300">
            <span className="text-white font-black text-2xl">S</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-3xl font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-br from-[var(--color-v2-foreground)] to-[var(--color-v2-muted-foreground)]">Salt.</h1>
          </div>
        </div>

        <div className="pointer-events-auto">
          <button
            onClick={() => setIsDark(!isDark)}
            className="h-12 w-12 rounded-full border border-[var(--color-v2-border)] bg-[var(--color-v2-card)]/50 backdrop-blur-xl flex items-center justify-center hover:bg-[var(--color-v2-secondary)] transition-colors shadow-sm"
          >
            <Settings className="h-5 w-5 text-[var(--color-v2-muted-foreground)]" />
          </button>
        </div>
      </header>



      {/* 
        ==============================
        MAIN IMMERSIVE CANVAS
        ==============================
      */}
      <main className="absolute inset-x-0 bottom-0 top-[100px] md:top-[120px] overflow-hidden z-10 flex flex-col">
        {/* View Router */}
        <div className="flex-1 overflow-auto px-4 md:px-10 pb-[140px]"> {/* Extra padding for the pill */}
          {activeTab === 'inventory' ? (
            <V2InventoryModule inventory={inventory} onRefresh={loadData} />
          ) : activeTab === 'recipes' ? (
            <V2RecipesModule />
          ) : (
             <div className="flex flex-col items-center justify-center h-full p-6 text-center text-[var(--color-v2-muted-foreground)]">
               <Compass className="h-24 w-24 mb-6 opacity-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
               <h2 className="text-4xl font-black text-[var(--color-v2-foreground)] mb-3 tracking-tight">Under Construction</h2>
               <p className="text-lg">The "{activeTab}" module hasn't been migrated to Project Alpha yet.</p>
             </div>
          )}
        </div>
      </main>

      {/* 
        ==============================
        FLOATING NAVIGATION PILL
        ==============================
      */}
      <div className="absolute bottom-8 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
        <nav className="pointer-events-auto bg-[var(--color-v2-card)]/70 backdrop-blur-2xl border border-[var(--color-v2-border)] shadow-2xl shadow-black/10 rounded-full px-2 py-2 flex items-center gap-1 sm:gap-2 max-w-full overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-full transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-[var(--color-v2-primary)] to-[var(--color-v2-accent)] text-white shadow-lg shadow-[var(--color-v2-primary)]/30 scale-100 font-bold' 
                    : 'text-[var(--color-v2-muted-foreground)] hover:text-[var(--color-v2-foreground)] hover:bg-[var(--color-v2-secondary)] scale-95 hover:scale-100 font-medium'
                }`}
              >
                <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                {isActive && <span className="hidden sm:inline-block tracking-wide">{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </div>
      
    </div>
  );
};
