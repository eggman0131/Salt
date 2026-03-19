/**
 * SplitCanonItemDialog
 *
 * Two-step dialog for splitting one canon item into two:
 * Step 1 — define the new item (name, aisle, unit type).
 * Step 2 — assign: search + checkboxes on recipe ingredient references.
 *           Shows ingredient raw text + recipe title so the user can decide.
 *           Nothing selected by default; unticked references stay on the original item.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { Aisle } from '@/types/contract';
import { type CanonItem, normalizeItemName } from '../api';
import {
  getCanonItemIngredientRefs,
  splitCanonItem,
  type IngredientRef,
} from '../api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronRight, Loader2, Scissors, Search } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  item: CanonItem;
  aisles: Aisle[];
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'define' | 'assign';

// ── Main component ─────────────────────────────────────────────────────────────

export const SplitCanonItemDialog: React.FC<Props> = ({
  item,
  aisles,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>('define');

  // Step 1 state
  const [newName, setNewName] = useState('');
  const [newAisleId, setNewAisleId] = useState(item.aisleId);
  const [newCanonicalUnit, setNewCanonicalUnit] = useState<'g' | 'ml' | 'each'>(
    item.unit?.canonical_unit ?? 'g'
  );

  // Step 2 state
  const [refs, setRefs] = useState<IngredientRef[]>([]);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load recipe refs when entering assign step
  useEffect(() => {
    if (step !== 'assign') return;
    setIsLoadingRefs(true);
    getCanonItemIngredientRefs(item.id)
      .then(setRefs)
      .catch(() => softToast.error('Failed to load ingredient references'))
      .finally(() => setIsLoadingRefs(false));
  }, [step, item.id]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return refs;
    const lower = searchTerm.toLowerCase();
    return refs.filter(
      r =>
        r.ingredientName.toLowerCase().includes(lower) ||
        r.raw.toLowerCase().includes(lower) ||
        r.recipeTitle.toLowerCase().includes(lower)
    );
  }, [refs, searchTerm]);

  function toggleRef(ingredientId: string) {
    const next = new Set(selectedIds);
    if (next.has(ingredientId)) next.delete(ingredientId); else next.add(ingredientId);
    setSelectedIds(next);
  }

  function toggleAllFiltered() {
    if (filtered.every(r => selectedIds.has(r.ingredientId))) {
      const next = new Set(selectedIds);
      filtered.forEach(r => next.delete(r.ingredientId));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach(r => next.add(r.ingredientId));
      setSelectedIds(next);
    }
  }

  function handleDefineNext(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeItemName(newName);
    if (!normalized) { softToast.error('Name is required'); return; }
    if (!newAisleId) { softToast.error('Aisle is required'); return; }
    setStep('assign');
  }

  async function handleSplit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedName = normalizeItemName(newName);
    if (!normalizedName) return;

    setIsSubmitting(true);
    try {
      await splitCanonItem(
        item.id,
        {
          name: normalizedName,
          aisleId: newAisleId,
          unit: { canonical_unit: newCanonicalUnit, density_g_per_ml: null },
        },
        selectedIds
      );
      softToast.success(
        selectedIds.size > 0
          ? `Created "${normalizedName}" and moved ${selectedIds.size} reference${selectedIds.size !== 1 ? 's' : ''}`
          : `Created "${normalizedName}" (no references moved)`
      );
      onSuccess();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Split failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selectedIds.has(r.ingredientId));

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Split: {item.name}
          </DialogTitle>
          <DialogDescription>
            {step === 'define'
              ? 'Define the new canon item that will be created.'
              : `Choose which recipe ingredient references move to the new item. Unselected references stay linked to "${item.name}".`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === 'define' ? 'font-medium text-foreground' : ''}>1. Define new item</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'assign' ? 'font-medium text-foreground' : ''}>2. Assign references</span>
        </div>

        {/* ── Step 1: Define new item ── */}
        {step === 'define' && (
          <form onSubmit={handleDefineNext} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="split-item-name">New item name</Label>
              <Input
                id="split-item-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={`e.g. ${item.name} (variant)`}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Aisle</Label>
              <Select value={newAisleId} onValueChange={setNewAisleId}>
                <SelectTrigger><SelectValue placeholder="Select aisle…" /></SelectTrigger>
                <SelectContent>
                  {aisles.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit type</Label>
              <div className="flex gap-2">
                {(['g', 'ml', 'each'] as const).map(unit => (
                  <Button
                    key={unit}
                    type="button"
                    variant={newCanonicalUnit === unit ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewCanonicalUnit(unit)}
                    className="flex-1"
                  >
                    {unit === 'g' ? 'Mass (g)' : unit === 'ml' ? 'Volume (ml)' : 'Count (each)'}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit" disabled={!newName.trim() || !newAisleId}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Step 2: Assign references ── */}
        {step === 'assign' && (
          <form onSubmit={handleSplit} className="space-y-3 py-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ingredient or recipe…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Selection summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isLoadingRefs
                  ? 'Loading…'
                  : refs.length === 0
                    ? 'No recipe references found'
                    : `${selectedIds.size} of ${refs.length} reference${refs.length !== 1 ? 's' : ''} selected to move`
                }
              </span>
              {filtered.length > 0 && !isLoadingRefs && (
                <button type="button" onClick={toggleAllFiltered} className="hover:text-foreground underline-offset-2 hover:underline">
                  {allFilteredSelected ? 'Deselect all' : 'Select all'} in view
                </button>
              )}
            </div>

            {/* Reference list */}
            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {isLoadingRefs ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Scanning recipes…</span>
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {searchTerm ? 'No references match your search' : 'No recipe references found for this item'}
                </p>
              ) : (
                filtered.map(ref => (
                  <label
                    key={ref.ingredientId}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(ref.ingredientId)}
                      onCheckedChange={() => toggleRef(ref.ingredientId)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm truncate" title={ref.raw}>{ref.raw || ref.ingredientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{ref.recipeTitle}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('define')} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoadingRefs}>
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Splitting…</>
                ) : (
                  <><Scissors className="h-4 w-4 mr-2" />Split Item</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
