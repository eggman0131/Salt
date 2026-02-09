
import React, { useState } from 'react';
import { Button } from './UI';
import { getActiveBackendMode } from '../backend/api';

interface NavItem {
  label: string;
  id: string;
  icon: React.ReactNode;
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
    { 
      label: 'Home', 
      id: 'dashboard', 
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> 
    },
    { 
      label: 'Planner', 
      id: 'planner', 
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> 
    },
    { 
      label: 'Chef', 
      id: 'ai', 
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg> 
    },
    { 
      label: 'Recipes', 
      id: 'recipes', 
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg> 
    },
    { 
      label: 'Equipment', 
      id: 'inventory', 
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/></svg> 
    },
    { 
      label: 'Admin', 
      id: 'admin', 
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> 
    },
  ];

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <div className={`fixed inset-y-0 left-0 z-[110] w-[280px] bg-white border-r border-gray-200 transform transition-transform duration-300 ease-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-xl lg:shadow-none`}>
        <div className="p-4 pb-8 flex justify-between items-center border-b border-gray-100">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">SALT</h1>
          </div>
          <button 
            onClick={onClose} 
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-md bg-gray-100 text-gray-500 hover:text-gray-900"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 h-11 rounded-md text-sm font-semibold transition-all border ${
                activeTab === item.id 
                  ? 'bg-orange-50 text-orange-700 border-orange-100 shadow-sm' 
                  : 'text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={activeTab === item.id ? 'text-orange-600' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-4 space-y-4 border-t border-gray-100">
          <div className="px-4 py-3 rounded-md bg-gray-50 border border-gray-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
              {user.displayName ? user.displayName[0] : '?'}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-gray-900 block truncate leading-tight">{user.displayName}</span>
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{mode}</span>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
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
  <header className="fixed top-0 left-0 lg:left-[280px] right-0 h-16 md:h-20 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-4 md:px-8 z-[200]">
    <div className="flex items-center gap-4">
      <button 
        onClick={onMenuClick}
        className="lg:hidden w-10 h-10 flex items-center justify-center -ml-2 text-gray-500 hover:text-gray-900 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7h16M4 12h16m-16 5h16"/></svg>
      </button>
      
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">{title}</h2>
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
      case 'ai': return 'Chef';
      case 'recipes': return 'Recipes';
      case 'inventory': return 'Equipment';
      case 'admin': return 'Admin';
      default: return 'Salt';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
        <main className="px-3 pt-16 md:pt-24 pb-6 md:pb-12 md:px-8">
          <div className="max-w-6xl mx-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
