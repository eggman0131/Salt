import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  title: string;
  onToggle: () => void;
  showToggle: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ title, onToggle, showToggle }) => {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
      {showToggle && (
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 shrink-0">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      )}
      <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
        {title}
      </h2>
    </header>
  );
};
