import React from 'react';

interface CofidMatchButtonProps {
  name: string;
  cofidId: string;
  badge: React.ReactNode;
  sub: string;
  isSelected: boolean;
  onSelect: () => void;
}

const CofidMatchButton: React.FC<CofidMatchButtonProps> = ({ name, badge, sub, isSelected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
    }`}
  >
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-medium text-sm">{name}</span>
      {badge}
    </div>
    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
  </button>
);

export default CofidMatchButton;
