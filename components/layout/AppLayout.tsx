import React, { useState, useEffect } from 'react';
import { useMediaQuery } from '@/hooks/use-mobile';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Content } from './Content';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { kitchenDataBackend } from '../../modules/kitchen-data';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (id: string) => void;
  user: { displayName: string };
  onLogout: () => void;
  suggestionsCountRef?: React.MutableRefObject<(() => void) | null>;
}

const getActiveTitle = (tab: string): string => {
  switch (tab) {
    case 'dashboard':
      return 'Home Kitchen';
    case 'planner':
      return 'Planner';
    case 'ai':
      return 'Chef';
    case 'recipes':
      return 'Recipes';
    case 'inventory':
      return 'Equipment';
    case 'shopping':
      return 'Shopping';
    case 'kitchendata':
      return 'Kitchen Data';
    case 'admin':
      return 'Admin';
    default:
      return 'Salt';
  }
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  user,
  onLogout,
  suggestionsCountRef,
}) => {
  const isMd = useMediaQuery('(min-width: 768px)');
  const isXl = useMediaQuery('(min-width: 1280px)');
  const isMobile = !isMd;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [suggestionsCount, setSuggestionsCount] = useState(0);

  const loadSuggestionsCount = async () => {
    try {
      const pending = await kitchenDataBackend.getPendingCategories();
      setSuggestionsCount(pending.length);
    } catch (err) {
      console.error('Failed to load suggestions count:', err);
    }
  };

  useEffect(() => {
    loadSuggestionsCount();
  }, []);

  useEffect(() => {
    if (activeTab === 'kitchendata') {
      loadSuggestionsCount();
    }
  }, [activeTab]);

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

  const showSidebar = isMd && (sidebarOpen || isXl);

  const handleMenuClick = (id: string) => {
    onTabChange(id);
    if (isMobile) setSheetOpen(false);
  };

  const handleToggle = () => {
    if (isMobile) {
      setSheetOpen(true);
    } else {
      setSidebarOpen((prev) => !prev);
    }
  };

  const sidebarContent = (
    <Sidebar
      activeTab={activeTab}
      onTabChange={handleMenuClick}
      user={user}
      onLogout={onLogout}
      suggestionsCount={suggestionsCount}
    />
  );

  return (
    <>
      <div
        className="grid h-screen w-full"
        style={{
          gridTemplateColumns: isMobile
            ? '1fr'
            : showSidebar
              ? '240px 1fr'
              : '0px 1fr',
          gridTemplateRows: '56px 1fr',
          gridTemplateAreas: isMobile
            ? '"navbar" "content"'
            : '"sidebar navbar" "sidebar content"',
          transition: isMobile ? 'none' : 'grid-template-columns 200ms ease',
        }}
      >
        {/* Sidebar — grid column 1, spanning both rows (md+ only) */}
        {isMd && (
          <aside
            className="h-full max-h-screen overflow-hidden border-r bg-sidebar text-sidebar-foreground"
            style={{ gridArea: 'sidebar' }}
          >
            <div className="h-full w-60">{sidebarContent}</div>
          </aside>
        )}

        {/* Navbar */}
        <div style={{ gridArea: 'navbar' }}>
          <Navbar
            title={getActiveTitle(activeTab)}
            onToggle={handleToggle}
            showToggle={!isXl}
          />
        </div>

        {/* Content */}
        <div style={{ gridArea: 'content', overflow: 'auto' }}>
          <Content>{children}</Content>
        </div>
      </div>

      {/* Mobile sheet drawer */}
      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-60 p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="h-full">{sidebarContent}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
};
