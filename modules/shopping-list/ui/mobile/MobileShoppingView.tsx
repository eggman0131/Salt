import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { softToast } from '@/lib/soft-toast';
import { clearCheckedItems } from '../../api';
import type { ShoppingList, ShoppingListItem } from '../../../../types/contract';
import { AisleSection } from './AisleSection';

interface MobileShoppingViewProps {
  list: ShoppingList;
  items: ShoppingListItem[];
  onRefresh: () => void;
  onExitMobile: () => void;
}

export const MobileShoppingView: React.FC<MobileShoppingViewProps> = ({
  list,
  items,
  onRefresh,
  onExitMobile,
}) => {
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Only show active items in mobile view — needs_review not shown during shopping
  const activeItems = items.filter((i) => i.status === 'active');

  // Group by aisle — items with no aisle go to 'Other'
  const byAisle = activeItems.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const aisle = item.aisle ?? 'Other';
    if (!acc[aisle]) acc[aisle] = [];
    acc[aisle].push(item);
    return acc;
  }, {});

  // Sort aisles alphabetically (without aisle sortOrder data here — good enough for mobile)
  const sortedAisles = Object.keys(byAisle).sort((a, b) =>
    a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)
  );

  const checkedCount = activeItems.filter((i) => i.checked).length;
  const totalCount = activeItems.length;

  const handleClearPurchased = async () => {
    setIsClearing(true);
    try {
      await clearCheckedItems(list.id);
      setClearConfirmOpen(false);
      softToast.success('Cleared purchased items');
      onRefresh();
    } catch {
      softToast.error('Failed to clear purchased items');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
        <div>
          <h1 className="text-base font-semibold">{list.name}</h1>
          <p className="text-xs text-muted-foreground">
            {totalCount - checkedCount} remaining
            {checkedCount > 0 && ` · ${checkedCount} bought`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onExitMobile} aria-label="Exit shopping view">
          <X className="h-5 w-5" />
        </Button>
      </header>

      {/* Scrollable items */}
      <main className="flex-1 overflow-y-auto">
        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-8 text-center">
            <p className="text-sm">Nothing left to buy.</p>
            <Button variant="outline" size="sm" onClick={onExitMobile}>
              Back to list
            </Button>
          </div>
        ) : (
          sortedAisles.map((aisle) => (
            <AisleSection
              key={aisle}
              aisleName={aisle}
              items={byAisle[aisle]}
              onUpdated={onRefresh}
            />
          ))
        )}
      </main>

      {/* Sticky footer — only shown when there are purchased items */}
      {checkedCount > 0 && (
        <footer className="shrink-0 border-t bg-card p-4">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setClearConfirmOpen(true)}
          >
            Clear {checkedCount} purchased item{checkedCount !== 1 ? 's' : ''}
          </Button>
        </footer>
      )}

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Clear purchased items?</AlertDialogTitle>
          <AlertDialogDescription>
            {checkedCount} item{checkedCount !== 1 ? 's' : ''} will be removed from the list.
          </AlertDialogDescription>
          <div className="flex items-center justify-end gap-2 pt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPurchased}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Clear
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
