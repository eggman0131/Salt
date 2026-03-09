import React, { useState } from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { softToast } from '@/lib/soft-toast';
import { updateItemStatus, deleteItem } from '../../api';
import type { ShoppingListItem } from '../../../../types/contract';
import { formatQty } from '../../logic/unit-normalisation';

interface StapleReviewPanelProps {
  items: ShoppingListItem[];
  onUpdated: () => void;
}

export const StapleReviewPanel: React.FC<StapleReviewPanelProps> = ({ items, onUpdated }) => {
  const [open, setOpen] = useState(true);

  if (items.length === 0) return null;

  const handleApprove = async (item: ShoppingListItem) => {
    try {
      await updateItemStatus(item.id, 'active');
      onUpdated();
    } catch {
      softToast.error('Failed to approve item');
    }
  };

  const handleDismiss = async (item: ShoppingListItem) => {
    try {
      await deleteItem(item.id);
      onUpdated();
    } catch {
      softToast.error('Failed to dismiss item');
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <div className="flex items-center gap-2">
          <span>Storecupboard — check stock</span>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-2 pt-2 pb-4">
          {items.map((item) => {
            const qtyLabel =
              item.totalBaseQty != null && item.baseUnit
                ? `${formatQty(item.totalBaseQty)} ${item.baseUnit}`
                : null;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 border rounded-md bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {qtyLabel && (
                    <p className="text-xs text-muted-foreground">{qtyLabel}</p>
                  )}
                  {item.aisle && (
                    <p className="text-xs text-muted-foreground">{item.aisle}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApprove(item)}
                    className="gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Need it
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDismiss(item)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
