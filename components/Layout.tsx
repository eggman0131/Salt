
import React, { useState, useEffect } from 'react';
import { getActiveBackendMode } from '../shared/backend/system-backend';
import { kitchenDataBackend } from '../modules/kitchen-data';
import { useTheme } from '../shared/providers/ThemeProvider';
import { User } from '../types/contract';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Home, 
  Calendar, 
  Lightbulb, 
  BookOpen, 
  Puzzle, 
  ShoppingCart, 
  ClipboardList, 
  Settings,
  Moon, 
  Sun,
  LogOut
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  id: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (id: string) => void;
  user: User;
  onLogout: () => void;
  suggestionsCountRef?: React.MutableRefObject<(() => void) | null>;
}

const menuItems: NavItem[] = [
  { label: 'Home', id: 'dashboard', icon: Home },
  { label: 'Planner', id: 'planner', icon: Calendar },
  { label: 'Chef', id: 'ai', icon: Lightbulb },
  { label: 'Recipes', id: 'recipes', icon: BookOpen },
  { label: 'Equipment', id: 'inventory', icon: Puzzle },
  { label: 'Shopping', id: 'shopping', icon: ShoppingCart },
  { label: 'Kitchen Data', id: 'kitchendata', icon: ClipboardList },
];

const adminItem: NavItem = { label: 'Admin', id: 'admin', icon: Settings };

const AppSidebarContent: React.FC<{
  activeTab: string;
  onTabChange: (id: string) => void;
  user: { displayName: string };
  onLogout: () => void;
  suggestionsCount: number;
}> = ({ activeTab, onTabChange, user, onLogout, suggestionsCount }) => {
  const mode = getActiveBackendMode();
  const { theme, toggleTheme } = useTheme();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleMenuClick = (id: string) => {
    onTabChange(id);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="px-2 py-3">
          <h1 className="text-xl font-semibold tracking-tight">SALT</h1>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => handleMenuClick(item.id)}
                  isActive={activeTab === item.id}
                  className="font-semibold"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.id === 'kitchendata' && suggestionsCount > 0 && (
                    <SidebarMenuBadge className="ml-auto bg-red-600 text-white">
                      {suggestionsCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleMenuClick(adminItem.id)}
              isActive={activeTab === adminItem.id}
              className="font-semibold"
            >
              <adminItem.icon className="h-4 w-4" />
              <span>{adminItem.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <Separator className="my-2" />
        
        <div className="px-2 py-2 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-sidebar-accent/50">
            <Avatar className="h-8 w-8 shrink-0">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {user.displayName ? user.displayName[0].toUpperCase() : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">
                {user.displayName}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {mode}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 shrink-0"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full justify-start font-semibold"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </>
  );
};

export const DashboardLayout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  user, 
  onLogout, 
  suggestionsCountRef 
}) => {
  const [suggestionsCount, setSuggestionsCount] = useState(0);

  // Load suggestions count
  const loadSuggestionsCount = async () => {
    try {
      const pending = await kitchenDataBackend.getPendingCategories();
      setSuggestionsCount(pending.length);
    } catch (err) {
      console.error('Failed to load suggestions count:', err);
    }
  };

  // Initial load
  useEffect(() => {
    loadSuggestionsCount();
  }, []);

  // Refresh count when tab changes
  useEffect(() => {
    if (activeTab === 'kitchendata') {
      loadSuggestionsCount();
    }
  }, [activeTab]);

  // Expose refresh function via ref
  useEffect(() => {
    if (suggestionsCountRef) {
      suggestionsCountRef.current = loadSuggestionsCount;
    }
    return () => {
      if (suggestionsCountRef) {
        suggestionsCountRef.current = null;
      }
    };
  }, [suggestionsCountRef]);

  const getActiveTitle = () => {
    switch(activeTab) {
      case 'dashboard': return 'Home Kitchen';
      case 'planner': return 'Planner';
      case 'ai': return 'Chef';
      case 'recipes': return 'Recipes';
      case 'inventory': return 'Equipment';
      case 'shopping': return 'Shopping';
      case 'kitchendata': return 'Kitchen Data';
      case 'admin': return 'Admin';
      default: return 'Salt';
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar>
        <AppSidebarContent
          activeTab={activeTab}
          onTabChange={onTabChange}
          user={user}
          onLogout={onLogout}
          suggestionsCount={suggestionsCount}
        />
      </Sidebar>
      
      <SidebarInset>
        <header className="sticky top-0 flex h-16 lg:h-20 shrink-0 items-center gap-2 border-b bg-background px-4 lg:px-6 z-10">
          <SidebarTrigger className="lg:hidden" />
          <Separator orientation="vertical" className="h-6 lg:hidden" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="text-xl lg:text-2xl font-semibold tracking-tight truncate">{getActiveTitle()}</h2>
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
