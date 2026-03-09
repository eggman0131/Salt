import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { updateItemChecked } from '../../api';
import type { ShoppingListItem } from '../../../../types/contract';
import { formatQty } from '../../logic/unit-normalisation';

interface MobileShoppingItemProps {
  item: ShoppingListItem;
  onUpdated: () => void;
}

export const MobileShoppingItem: React.FC<MobileShoppingItemProps> = ({ item, onUpdated }) => {
  const [detailOpen, setDetailOpen] = useState(false);

  const handleTap = async () => {
    try {
      await updateItemChecked(item.id, !item.checked);
      onUpdated();
    } catch {
      // Silent — optimistic update already applied by parent if needed
    }
  };

  const qtyLabel =
    item.displayQty != null && item.displayUnit
      ? `${formatQty(item.displayQty)} ${item.displayUnit}`
      : item.totalBaseQty != null && item.baseUnit
      ? `${formatQty(item.totalBaseQty)} ${item.baseUnit}`
      : null;

  return (
    <>
      <div
        className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors active:bg-muted/50 ${
          item.checked ? 'opacity-40' : ''
        }`}
      >
        {/* Large tap target for check */}
        <button
          onClick={handleTap}
          className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-[44px]"
          aria-label={item.checked ? `Unmark ${item.name}` : `Mark ${item.name} as bought`}
        >
          <div
            className={`h-6 w-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
              item.checked
                ? 'bg-primary border-primary'
                : 'border-muted-foreground'
            }`}
          >
            {item.checked && (
              <svg className="h-3.5 w-3.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-base font-medium leading-tight ${item.checked ? 'line-through' : ''}`}>
              {item.name}
            </p>
            {qtyLabel && (
              <p className="text-sm text-muted-foreground">{qtyLabel}</p>
            )}
          </div>
        </button>

        {/* Detail button — separate tap zone */}
        {item.contributions.length > 0 && (
          <button
            onClick={() => setDetailOpen(true)}
            className="shrink-0 h-11 w-11 flex items-center justify-center text-muted-foreground"
            aria-label={`See details for ${item.name}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[60vh]">
          <SheetHeader className="pb-4">
            <SheetTitle>{item.name}</SheetTitle>
            {qtyLabel && (
              <p className="text-sm text-muted-foreground">{qtyLabel}</p>
            )}
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto">
            {item.contributions.map((c, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-sm font-medium">
                  {c.sourceType === 'recipe' ? c.recipeTitle ?? 'Recipe' : 'Added manually'}
                </p>
                <p className="text-sm text-muted-foreground italic">{c.rawText}</p>
                {c.qty != null && c.unit && (
                  <p className="text-xs text-muted-foreground">
                    {formatQty(c.qty)} {c.unit}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
