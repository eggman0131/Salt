import React, { useState, useCallback } from 'react';
import { Loader2, CheckSquare, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { softToast } from '@/lib/soft-toast';
import { clearCheckedItems, createShoppingList, getShoppingLists } from '../../api';
import type { ShoppingList, ShoppingListItem } from '../../../../types/contract';
import { getFriday } from '../../../planner/api';
import { PlannerSyncPanel } from './PlannerSyncPanel';
import { StapleReviewPanel } from './StapleReviewPanel';
import { ManualAddBar } from './ManualAddBar';
import { ItemRow } from './ItemRow';
import { ListSwitcher } from './ListSwitcher';

interface ManagementViewProps {
  list: ShoppingList;
  lists: ShoppingList[];
  items: ShoppingListItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectList: (id: string) => void;
  onSwitchToMobile: () => void;
  onUpdateItem: (id: string, patch: Partial<ShoppingListItem>) => void;
  onRemoveItem: (id: string) => void;
}

export const ManagementView: React.FC<ManagementViewProps> = ({
  list,
  lists,
  items,
  isLoading,
  onRefresh,
  onSelectList,
  onSwitchToMobile,
  onUpdateItem,
  onRemoveItem,
}) => {
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const weekStartDate = getFriday(new Date().toISOString().split('T')[0]);

  const activeItems = items.filter((i) => i.status === 'active' && !i.checked);
  const checkedItems = items.filter((i) => i.status === 'active' && i.checked);
  const reviewItems = items.filter((i) => i.status === 'needs_review');

  // Group active items by aisle
  const byAisle = activeItems.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const aisle = item.aisle ?? 'Other';
    if (!acc[aisle]) acc[aisle] = [];
    acc[aisle].push(item);
    return acc;
  }, {});
  const sortedAisles = Object.keys(byAisle).sort();

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

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    setIsCreatingList(true);
    try {
      const newList = await createShoppingList(name);
      setNewListName('');
      setNewListOpen(false);
      // Refresh lists then switch to the new one
      onSelectList(newList.id);
    } catch {
      softToast.error('Failed to create list');
    } finally {
      setIsCreatingList(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ListSwitcher
          lists={lists}
          activeListId={list.id}
          onSelectList={onSelectList}
          onCreateList={() => setNewListOpen(true)}
        />
        <div className="flex items-center gap-2">
          {checkedItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearConfirmOpen(true)}
              className="gap-1.5"
            >
              <CheckSquare className="h-4 w-4" />
              Clear {checkedItems.length} purchased
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onSwitchToMobile} className="gap-1.5">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Shopping view</span>
          </Button>
        </div>
      </div>

      {/* Sync from planner */}
      <PlannerSyncPanel
        listId={list.id}
        weekStartDate={weekStartDate}
        onSynced={onRefresh}
      />

      {/* Manual add */}
      <ManualAddBar listId={list.id} onAdded={onRefresh} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Storecupboard review */}
          {reviewItems.length > 0 && (
            <div className="border rounded-lg p-4">
              <StapleReviewPanel items={reviewItems} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} />
            </div>
          )}

          {/* Active items by aisle */}
          {activeItems.length === 0 && reviewItems.length === 0 && checkedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Your shopping list is empty.{' '}
                <button
                  onClick={() => document.querySelector('input')?.focus()}
                  className="underline underline-offset-2"
                >
                  Add an item
                </button>{' '}
                or sync from the planner.
              </p>
            </div>
          ) : (
            sortedAisles.map((aisle) => (
              <section key={aisle} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {aisle}
                </h3>
                <div className="space-y-1.5">
                  {byAisle[aisle].map((item) => (
                    <ItemRow key={item.id} item={item} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} />
                  ))}
                </div>
              </section>
            ))
          )}

          {/* Purchased items */}
          {checkedItems.length > 0 && (
            <section className="space-y-2 opacity-60">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Purchased ({checkedItems.length})
              </h3>
              <div className="space-y-1.5">
                {checkedItems.map((item) => (
                  <ItemRow key={item.id} item={item} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Clear purchased confirm */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Clear purchased items?</AlertDialogTitle>
          <AlertDialogDescription>
            {checkedItems.length} purchased item{checkedItems.length !== 1 ? 's' : ''} will be
            permanently removed from this list.
          </AlertDialogDescription>
          <div className="flex items-center justify-end gap-2 pt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPurchased}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Clear
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* New list dialog */}
      <Dialog open={newListOpen} onOpenChange={setNewListOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New shopping list</DialogTitle>
            <DialogDescription>Create a named list for a specialist shop or order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="list-name">List name</Label>
            <Input
              id="list-name"
              placeholder="e.g. Specialist cheese order"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewListOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={!newListName.trim() || isCreatingList}>
              {isCreatingList ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
