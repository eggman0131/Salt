
import React, { useState } from 'react';
import { Button } from './UI';
import { getActiveBackendMode } from '../backend/api';

interface NavItem {
  label: string;
  id: string;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isOpen, onClose }) => {
  const mode = getActiveBackendMode();
  const items: NavItem[] = [
    { label: 'Dashboard', id: 'dashboard' },
    { label: 'Planner', id: 'planner' },
    { label: 'Recipes', id: 'recipes' },
    { label: 'Equipment', id: 'inventory' },
    { label: 'AI Assistant', id: 'ai' },
    { label: 'Admin', id: 'admin' },
  ];

  return (
    <>
      {/* Drawer Overlay for Mobile */}
      <div 
        className={`fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-[100] transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Navigation Drawer/Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[110] w-[280px] bg-white border-r border-gray-100 transform transition-transform duration-300 ease-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-6 pb-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-gray-900">SALT</h1>
            <p className="text-xs text-gray-400 uppercase font-black tracking-widest mt-1">Kitchen Systems</p>
          </div>
          <button 
            onClick={onClose} 
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-gray-900"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                onClose();
              }}
              className={`w-full flex items-center px-4 h-12 rounded-xl text-sm font-bold transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-50 text-[#2563eb]' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        
        {/* Minimal System Footer */}
        <div className="p-6 border-t border-gray-50">
          <div className="px-4 py-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Node</span>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
              mode === 'firebase' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {mode}
            </span>
          </div>
          <div className="mt-4 text-center">
             <p className="text-[0.6rem] text-gray-300 font-black uppercase tracking-[0.3em]">v0.1.0-alpha</p>
          </div>
        </div>
      </div>
    </>
  );
};

interface TopNavProps {
  user: { displayName: string };
  onLogout: () => void;
  onMenuClick: () => void;
}

const TopNav: React.FC<TopNavProps> = ({ user, onLogout, onMenuClick }) => (
  <header className="sticky top-0 h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-10 z-[80]">
    <div className="flex items-center gap-4">
      <button 
        onClick={onMenuClick}
        className="lg:hidden w-10 h-10 flex items-center justify-center -ml-2 text-gray-400 hover:text-gray-900 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7h16M4 12h16m-16 5h16"/></svg>
      </button>
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gray-900 flex items-center justify-center text-white shadow-sm shrink-0">
          <span className="text-xs font-black">{user.displayName ? user.displayName[0] : '?'}</span>
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-bold text-gray-900 block leading-tight">{user.displayName}</span>
          <span className="text-[0.6rem] text-gray-400 font-black uppercase tracking-widest">Kitchen Member</span>
        </div>
      </div>
    </div>

    <Button variant="ghost" onClick={onLogout} className="text-xs font-black uppercase tracking-widest px-4 h-10">
      Sign Out
    </Button>
  </header>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (id: string) => void;
  user: { displayName: string };
  onLogout: () => void;
}

export const DashboardLayout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={onTabChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 lg:ml-[280px] flex flex-col">
        <TopNav 
          user={user} 
          onLogout={onLogout} 
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="p-4 md:p-10">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
