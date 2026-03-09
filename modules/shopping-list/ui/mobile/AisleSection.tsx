import React from 'react';
import type { ShoppingListItem } from '../../../../types/contract';
import { MobileShoppingItem } from './MobileShoppingItem';

interface AisleSectionProps {
  aisleName: string;
  items: ShoppingListItem[];
  onUpdated: () => void;
}

export const AisleSection: React.FC<AisleSectionProps> = ({ aisleName, items, onUpdated }) => {
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const sorted = [...unchecked, ...checked]; // unchecked first

  return (
    <section>
      <div className="px-4 py-2 bg-muted/50 sticky top-0 z-10">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {aisleName}
          <span className="ml-2 font-normal">
            {unchecked.length}/{items.length}
          </span>
        </h2>
      </div>
      <div>
        {sorted.map((item) => (
          <MobileShoppingItem key={item.id} item={item} onUpdated={onUpdated} />
        ))}
      </div>
    </section>
  );
};
