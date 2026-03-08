import React, { useState, useEffect } from 'react';
import { getActiveBackendMode } from '../../shared/backend/system-backend';
import { useTheme } from '../../shared/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from '../../types/contract';
import {
  Home,
  Calendar,
  Lightbulb,
  BookOpen,
  Puzzle,
  Settings,
  Moon,
  Sun,
  LogOut,
  Database,
  ShoppingBag,
} from 'lucide-react';

interface NavItem {
  label: string;
  id: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  user: User;
  onLogout: () => void;
  suggestionsCount: number;
}

const menuItems: NavItem[] = [
  { label: 'Home', id: 'dashboard', icon: Home },
  { label: 'Planner', id: 'planner', icon: Calendar },
  { label: 'Recipes', id: 'recipes', icon: BookOpen },
  { label: 'Chef', id: 'ai', icon: Lightbulb },
  { label: 'Equipment', id: 'inventory', icon: Puzzle },
  { label: 'Shopping', id: 'shopping', icon: ShoppingBag },
];


export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  user,
  suggestionsCount,
  onLogout,
}) => {
  const mode = getActiveBackendMode();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-center px-2 py-3 shrink-0">
        <img src="/icons/salt.svg" alt="Salt" className="h-8 w-8" />
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-hidden px-2 py-2">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                  activeTab === item.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="mt-auto shrink-0 border-t border-sidebar-border px-2 py-2 space-y-2">
        {/* Canon Items */}
        <button
          onClick={() => onTabChange('canon')}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
            activeTab === 'canon'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          )}
        >
          <Database className="h-4 w-4 shrink-0" />
          <span>Canon Items</span>
        </button>

        {/* Admin */}
        <button
          onClick={() => onTabChange('admin')}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
            activeTab === 'admin'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Admin</span>
        </button>

        <Separator className="my-1" />

        {/* User section */}
        <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/50 px-2 py-2">
          <Avatar className="h-8 w-8 shrink-0">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
              {user.displayName ? user.displayName[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{user.displayName}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{mode}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 shrink-0">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <Button variant="outline" onClick={onLogout} className="w-full justify-start font-semibold">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};
