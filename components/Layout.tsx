
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
  user: { displayName: string };
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isOpen, onClose, user, onLogout }) => {
  const mode = getActiveBackendMode();
  const items: NavItem[] = [
    { label: 'Home', id: 'dashboard' },
    { label: 'Planner', id: 'planner' },
    { label: 'Sous-Chef', id: 'ai' },
    { label: 'Recipes', id: 'recipes' },
    { label: 'Equipment', id: 'inventory' },
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
      <div className={`fixed inset-y-0 left-0 z-[110] w-[280px] bg-white border-r border-gray-100 transform transition-transform duration-300 ease-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl lg:shadow-none`}>
        <div className="p-6 pb-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-gray-900">SALT</h1>
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
        
        {/* User & Meta at Bottom */}
        <div className="p-4 space-y-4 border-t border-gray-50">
          <div className="px-4 py-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center text-white text-xs font-black shadow-sm shrink-0">
              {user.displayName ? user.displayName[0] : '?'}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-black text-gray-900 block truncate leading-tight">{user.displayName}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{mode}</span>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full h-11 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
};

interface TopNavProps {
  title: string;
  onMenuClick: () => void;
}

const TopNav: React.FC<TopNavProps> = ({ title, onMenuClick }) => (
  <header className="sticky top-0 h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-10 z-[80]">
    <div className="flex items-center gap-4">
      <button 
        onClick={onMenuClick}
        className="lg:hidden w-10 h-10 flex items-center justify-center -ml-2 text-gray-400 hover:text-gray-900 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7h16M4 12h16m-16 5h16"/></svg>
      </button>
      
      <div>
        <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">{title}</h2>
      </div>
    </div>
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

  const getActiveTitle = () => {
    switch(activeTab) {
      case 'dashboard': return 'Home Kitchen';
      case 'planner': return 'Planner';
      case 'ai': return 'Sous-Chef';
      case 'recipes': return 'Recipes';
      case 'inventory': return 'Equipment';
      case 'admin': return 'Admin';
      default: return 'Salt';
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={onTabChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogout={onLogout}
      />
      <div className="flex-1 lg:ml-[280px] flex flex-col min-w-0">
        <TopNav 
          title={getActiveTitle()} 
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="px-2 py-4 md:p-10">
          <div className="max-w-5xl mx-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
