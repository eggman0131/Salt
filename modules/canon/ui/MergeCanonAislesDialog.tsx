/**
 * MergeCanonAislesDialog
 *
 * Two-step dialog for merging exactly two Canon Aisles:
 * Step 1 — choose which aisle is primary (keeps UUID), see impact counts.
 * Step 2 — edit surviving aisle details (name, sortOrder), confirm.
 *
 * Guard: the 'uncategorised' system aisle cannot be the secondary (deleted) item.
 */

import React, { useEffect, useState } from 'react';
import type { Aisle } from '@/types/contract';
import { UNCATEGORISED_AISLE_ID, getAisleMergeImpact, mergeCanonAisles, type AisleMergeImpact } from '../api';
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
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ChevronRight, Loader2, Merge, Shield } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  aisleA: Aisle;
  aisleB: Aisle;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'select-primary' | 'edit';

// ── Main component ─────────────────────────────────────────────────────────────

export const MergeCanonAislesDialog: React.FC<Props> = ({
  aisleA,
  aisleB,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>('select-primary');
  const [impact, setImpact] = useState<AisleMergeImpact | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(true);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit step state
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  useEffect(() => {
    setIsLoadingImpact(true);
    getAisleMergeImpact(aisleA.id, aisleB.id)
      .then(setImpact)
      .catch(() => softToast.error('Failed to load impact data'))
      .finally(() => setIsLoadingImpact(false));
  }, [aisleA.id, aisleB.id]);

  const primary = primaryId === aisleA.id ? aisleA : primaryId === aisleB.id ? aisleB : null;
  const secondary = primaryId === aisleA.id ? aisleB : primaryId === aisleB.id ? aisleA : null;

  // System aisle protection: uncategorised must not be secondary
  function isValidPrimary(id: string) {
    const other = id === aisleA.id ? aisleB.id : aisleA.id;
    // If the other (secondary) would be uncategorised, this primary is invalid
    return other !== UNCATEGORISED_AISLE_ID;
  }

  function impactFor(aisle: Aisle) {
    if (!impact) return null;
    return aisle.id === aisleA.id ? impact.a : impact.b;
  }

  function handleSelectPrimary(id: string) {
    setPrimaryId(id);
  }

  function handleNextStep() {
    if (!primary) return;
    setName(primary.name);
    setSortOrder(String(primary.sortOrder ?? 999));
    setStep('edit');
  }

  async function handleMerge(e: React.FormEvent) {
    e.preventDefault();
    if (!primary || !secondary) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      softToast.error('Aisle name is required');
      return;
    }
    const parsedSortOrder = parseInt(sortOrder, 10);
    if (isNaN(parsedSortOrder)) {
      softToast.error('Sort order must be a number');
      return;
    }

    setIsSubmitting(true);
    try {
      await mergeCanonAisles(primary.id, secondary.id, {
        name: trimmedName,
        sortOrder: parsedSortOrder,
      });
      softToast.success(`Merged "${secondary.name}" into "${trimmedName}"`);
      onSuccess();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const secondaryImpact = secondary ? impactFor(secondary) : null;
  const primaryImpact = primary ? impactFor(primary) : null;

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-4 w-4" />
            Merge Aisles
          </DialogTitle>
          <DialogDescription>
            {step === 'select-primary'
              ? 'Choose which aisle keeps its ID. All canon items in the other aisle will be moved to the survivor.'
              : 'Edit the details of the surviving aisle.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === 'select-primary' ? 'font-medium text-foreground' : ''}>
            1. Choose primary
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'edit' ? 'font-medium text-foreground' : ''}>
            2. Edit & confirm
          </span>
        </div>

        {/* ── Step 1: Select primary ── */}
        {step === 'select-primary' && (
          <div className="space-y-4 py-2">
            {isLoadingImpact ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading impact data…</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[aisleA, aisleB].map(aisle => {
                    const imp = impactFor(aisle);
                    const isSystem = aisle.id === UNCATEGORISED_AISLE_ID;
                    const isSelected = primaryId === aisle.id;
                    const canBeSelected = isValidPrimary(aisle.id);

                    return (
                      <button
                        key={aisle.id}
                        type="button"
                        disabled={!canBeSelected}
                        onClick={() => handleSelectPrimary(aisle.id)}
                        className={`text-left rounded-lg border p-4 space-y-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/40'
                        } ${!canBeSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{aisle.name}</p>
                            {isSystem && (
                              <Badge variant="secondary" className="text-[10px]">
                                <Shield className="h-2.5 w-2.5 mr-0.5" />
                                System
                              </Badge>
                            )}
                          </div>
                          {isSelected && (
                            <Badge className="text-[10px] shrink-0">Primary</Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <p>Sort order: {aisle.sortOrder}</p>
                        </div>

                        {imp && (
                          <div className="flex gap-3 text-xs pt-1 border-t border-border">
                            <span>
                              <span className="font-medium">{imp.canonItemCount}</span>
                              {' '}canon item{imp.canonItemCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}

                        {!canBeSelected && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3" />
                            <span>Cannot be deleted (system aisle)</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {primaryId && secondary && (
                  <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                    <p>
                      <strong>{secondaryImpact?.canonItemCount ?? 0}</strong> canon item
                      {(secondaryImpact?.canonItemCount ?? 0) !== 1 ? 's' : ''} will be moved
                      from <strong>{secondary.name}</strong> to <strong>{primary!.name}</strong>.
                    </p>
                    <p>
                      <strong>{secondary.name}</strong> will be permanently deleted.
                    </p>
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={!primaryId || isLoadingImpact}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 2: Edit & confirm ── */}
        {step === 'edit' && primary && secondary && (
          <form onSubmit={handleMerge} className="space-y-4 py-2">
            {/* Impact banner */}
            <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
              <p>
                <strong>{secondaryImpact?.canonItemCount ?? 0}</strong> canon item
                {(secondaryImpact?.canonItemCount ?? 0) !== 1 ? 's' : ''} will be re-assigned.{' '}
                <strong>{secondary.name}</strong> will be deleted.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="merge-aisle-name">Aisle name</Label>
              <Input
                id="merge-aisle-name"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {/* Sort order */}
            <div className="space-y-1.5">
              <Label htmlFor="merge-aisle-sort">Sort order</Label>
              <Input
                id="merge-aisle-sort"
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                disabled={isSubmitting}
                className="w-32"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('select-primary')}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Merging…
                  </>
                ) : (
                  <>
                    <Merge className="h-4 w-4 mr-2" />
                    Merge Aisles
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
