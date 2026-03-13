/**
 * SplitCanonAisleDialog
 *
 * Two-step dialog for splitting one aisle into two:
 * Step 1 — define the new aisle (name + sort order).
 * Step 2 — assign: search + checkboxes to pick which canon items move to the new aisle.
 *           Nothing is selected by default; items not ticked stay in the original.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { Aisle } from '@/types/contract';
import { getCanonItems, splitCanonAisle } from '../api';
import type { CanonItem } from '../api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, Loader2, Scissors, Search } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  aisle: Aisle;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'define' | 'assign';

// ── Main component ─────────────────────────────────────────────────────────────

export const SplitCanonAisleDialog: React.FC<Props> = ({ aisle, onSuccess, onCancel }) => {
  const [step, setStep] = useState<Step>('define');

  // Step 1 state
  const [newName, setNewName] = useState('');
  const [newTier2, setNewTier2] = useState(aisle.tier2 ?? '');
  const [newTier3, setNewTier3] = useState(aisle.tier3 ?? '');
  const [newSortOrder, setNewSortOrder] = useState(String((aisle.sortOrder ?? 999) + 1));

  // Step 2 state
  const [items, setItems] = useState<CanonItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load canon items for this aisle when entering assign step
  useEffect(() => {
    if (step !== 'assign') return;
    setIsLoadingItems(true);
    getCanonItems()
      .then(all => setItems(all.filter(i => i.aisleId === aisle.id)))
      .catch(() => softToast.error('Failed to load aisle items'))
      .finally(() => setIsLoadingItems(false));
  }, [step, aisle.id]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(lower));
  }, [items, searchTerm]);

  function toggleItem(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    if (filtered.every(i => selectedIds.has(i.id))) {
      const next = new Set(selectedIds);
      filtered.forEach(i => next.delete(i.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach(i => next.add(i.id));
      setSelectedIds(next);
    }
  }

  function handleDefineNext(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { softToast.error('Name is required'); return; }
    setStep('assign');
  }

  async function handleSplit(e: React.FormEvent) {
    e.preventDefault();
    const sortOrder = parseInt(newSortOrder, 10);
    if (isNaN(sortOrder)) { softToast.error('Sort order must be a number'); return; }

    setIsSubmitting(true);
    try {
      await splitCanonAisle(
        { name: newName.trim(), tier2: newTier2.trim(), tier3: newTier3.trim(), sortOrder },
        Array.from(selectedIds)
      );
      softToast.success(
        selectedIds.size > 0
          ? `Created "${newName.trim()}" and moved ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}`
          : `Created "${newName.trim()}" (no items moved)`
      );
      onSuccess();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Split failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id));

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Split Aisle: {aisle.name}
          </DialogTitle>
          <DialogDescription>
            {step === 'define'
              ? 'Define the new aisle that will be created.'
              : `Choose which items move to the new aisle. Unselected items stay in "${aisle.name}".`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === 'define' ? 'font-medium text-foreground' : ''}>1. Define new aisle</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'assign' ? 'font-medium text-foreground' : ''}>2. Assign items</span>
        </div>

        {/* ── Step 1: Define ── */}
        {step === 'define' && (
          <form onSubmit={handleDefineNext} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="split-aisle-name">New aisle name</Label>
              <Input
                id="split-aisle-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={`e.g. ${aisle.name} (2)`}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="split-aisle-tier3">Category (tier 3)</Label>
              <Input
                id="split-aisle-tier3"
                value={newTier3}
                onChange={e => setNewTier3(e.target.value)}
                placeholder="e.g. food, drink, household"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="split-aisle-tier2">Group (tier 2)</Label>
              <Input
                id="split-aisle-tier2"
                value={newTier2}
                onChange={e => setNewTier2(e.target.value)}
                placeholder="e.g. fresh, frozen, ambient"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="split-aisle-sort">Sort order</Label>
              <Input
                id="split-aisle-sort"
                type="number"
                value={newSortOrder}
                onChange={e => setNewSortOrder(e.target.value)}
                className="w-32"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit" disabled={!newName.trim()}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Step 2: Assign ── */}
        {step === 'assign' && (
          <form onSubmit={handleSplit} className="space-y-3 py-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Selection summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {selectedIds.size} of {items.length} item{items.length !== 1 ? 's' : ''} selected to move
              </span>
              {filtered.length > 0 && (
                <button type="button" onClick={toggleAll} className="hover:text-foreground underline-offset-2 hover:underline">
                  {allFilteredSelected ? 'Deselect all' : 'Select all'} in view
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading items…</span>
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {searchTerm ? 'No items match your search' : 'No items in this aisle'}
                </p>
              ) : (
                filtered.map(item => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <span className="text-sm">{item.name}</span>
                  </label>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('define')} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Splitting…</>
                ) : (
                  <><Scissors className="h-4 w-4 mr-2" />Split Aisle</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
