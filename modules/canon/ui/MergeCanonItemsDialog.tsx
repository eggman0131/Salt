/**
 * MergeCanonItemsDialog
 *
 * Two-step dialog for merging exactly two Canon Items:
 * Step 1 — choose which item is primary (keeps UUID), see impact counts + collision check.
 * Step 2 — edit the surviving item's fields (name, aisle, unit, synonyms), confirm.
 */

import React, { useEffect, useState } from 'react';
import { CanonItem } from '../logic/items';
import type { Aisle, Unit } from '@/types/contract';
import { normalizeItemName } from '../logic/items';
import {
  getCanonItemMergeImpact,
  mergeCanonItems,
  type CanonItemMergeImpact,
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ChevronRight, Loader2, Merge } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  itemA: CanonItem;
  itemB: CanonItem;
  aisles: Aisle[];
  units: Unit[];
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'select-primary' | 'edit';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getCofidId(item: CanonItem): string | undefined {
  return item.externalSources?.find(s => s.source === 'cofid')?.externalId;
}

function getCofidName(item: CanonItem): string | undefined {
  const src = item.externalSources?.find(s => s.source === 'cofid');
  return (src?.properties as any)?.name as string | undefined;
}

// ── Main component ─────────────────────────────────────────────────────────────

export const MergeCanonItemsDialog: React.FC<Props> = ({
  itemA,
  itemB,
  aisles,
  units,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>('select-primary');
  const [impact, setImpact] = useState<CanonItemMergeImpact | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(true);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit step state — initialised when primary is chosen
  const [name, setName] = useState('');
  const [aisleId, setAisleId] = useState('');
  const [preferredUnitId, setPreferredUnitId] = useState('');
  const [synonymsText, setSynonymsText] = useState('');

  // Load impact on open
  useEffect(() => {
    setIsLoadingImpact(true);
    getCanonItemMergeImpact(itemA.id, itemB.id)
      .then(setImpact)
      .catch(() => softToast.error('Failed to load impact data'))
      .finally(() => setIsLoadingImpact(false));
  }, [itemA.id, itemB.id]);

  const primary = primaryId === itemA.id ? itemA : primaryId === itemB.id ? itemB : null;
  const secondary = primaryId === itemA.id ? itemB : primaryId === itemB.id ? itemA : null;

  const hasCollision = (impact?.collidingShoppingListIds.length ?? 0) > 0;

  function impactFor(item: CanonItem) {
    if (!impact) return null;
    return item.id === itemA.id ? impact.a : impact.b;
  }

  function handleSelectPrimary(id: string) {
    setPrimaryId(id);
  }

  function handleNextStep() {
    if (!primary || !secondary) return;

    // Pre-fill edit form from primary
    setName(primary.name);
    setAisleId(primary.aisleId);
    setPreferredUnitId(primary.preferredUnitId);

    // Union synonyms from both items
    const allSynonyms = Array.from(
      new Set([
        ...(primary.synonyms ?? []),
        ...(secondary.synonyms ?? []),
      ])
    );
    setSynonymsText(allSynonyms.join(', '));

    setStep('edit');
  }

  async function handleMerge(e: React.FormEvent) {
    e.preventDefault();
    if (!primary || !secondary) return;

    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId || !preferredUnitId) {
      softToast.error('All fields are required');
      return;
    }

    const synonyms = synonymsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      await mergeCanonItems(primary, secondary, {
        name: normalizedName,
        aisleId,
        preferredUnitId,
        synonyms,
      });
      softToast.success(`Merged "${secondary.name}" into "${normalizedName}"`);
      onSuccess();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const primaryImpact = primary ? impactFor(primary) : null;
  const secondaryImpact = secondary ? impactFor(secondary) : null;
  const totalRelinked =
    (secondaryImpact?.recipeIngredientCount ?? 0) +
    (secondaryImpact?.shoppingListCount ?? 0);

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-4 w-4" />
            Merge Canon Items
          </DialogTitle>
          <DialogDescription>
            {step === 'select-primary'
              ? 'Choose which item keeps its ID. The other will be deleted after all references are migrated.'
              : 'Edit the details of the surviving item.'}
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
                {hasCollision && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Cannot merge — shopping list collision</p>
                      <p className="text-xs mt-0.5">
                        Both items appear on {impact!.collidingShoppingListIds.length} shopping
                        list{impact!.collidingShoppingListIds.length !== 1 ? 's' : ''}.
                        Remove one from each list before merging.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {[itemA, itemB].map(item => {
                    const imp = impactFor(item);
                    const cofidId = getCofidId(item);
                    const cofidName = getCofidName(item);
                    const aisle = aisles.find(a => a.id === item.aisleId);
                    const unit = units.find(u => u.id === item.preferredUnitId);
                    const isSelected = primaryId === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={hasCollision}
                        onClick={() => handleSelectPrimary(item.id)}
                        className={`text-left rounded-lg border p-4 space-y-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/40'
                        } ${hasCollision ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{item.name}</p>
                          {isSelected && (
                            <Badge className="text-[10px] shrink-0">Primary</Badge>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p><span className="text-foreground">Aisle:</span> {aisle?.name ?? item.aisleId}</p>
                          <p><span className="text-foreground">Unit:</span> {unit?.name ?? item.preferredUnitId}</p>
                          {cofidId && (
                            <p>
                              <span className="text-foreground">CoFID:</span>{' '}
                              {cofidName ?? cofidId}
                            </p>
                          )}
                        </div>

                        {imp && (
                          <div className="flex gap-3 text-xs pt-1 border-t border-border">
                            <span>
                              <span className="font-medium">{imp.recipeIngredientCount}</span>
                              {' '}recipe ref{imp.recipeIngredientCount !== 1 ? 's' : ''}
                            </span>
                            <span>
                              <span className="font-medium">{imp.shoppingListCount}</span>
                              {' '}list item{imp.shoppingListCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {primaryId && secondary && (
                  <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                    {getCofidId(secondary) && !getCofidId(primary!) && (
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠ <strong>{secondary.name}</strong>'s CoFID link will be dropped (primary has none).
                      </p>
                    )}
                    {getCofidId(secondary) && getCofidId(primary!) && (
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠ Both items have CoFID links. <strong>{secondary.name}</strong>'s will be dropped.
                      </p>
                    )}
                    <p>
                      <strong>{secondaryImpact?.recipeIngredientCount ?? 0}</strong> recipe reference
                      {(secondaryImpact?.recipeIngredientCount ?? 0) !== 1 ? 's' : ''} and{' '}
                      <strong>{secondaryImpact?.shoppingListCount ?? 0}</strong> shopping list item
                      {(secondaryImpact?.shoppingListCount ?? 0) !== 1 ? 's' : ''} will be
                      re-linked to <strong>{primary!.name}</strong>.
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
                disabled={!primaryId || hasCollision || isLoadingImpact}
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
              {totalRelinked > 0 ? (
                <p>
                  <strong>{totalRelinked}</strong> reference
                  {totalRelinked !== 1 ? 's' : ''} (
                  {secondaryImpact?.recipeIngredientCount ?? 0} recipe,{' '}
                  {secondaryImpact?.shoppingListCount ?? 0} shopping list) will be
                  re-linked. <strong>{secondary.name}</strong> will be deleted.
                </p>
              ) : (
                <p>
                  <strong>{secondary.name}</strong> has no linked references and will be deleted.
                </p>
              )}
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="merge-name">Item name</Label>
                <Input
                  id="merge-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              {/* Aisle */}
              <div className="space-y-1.5">
                <Label>Aisle</Label>
                <Select value={aisleId} onValueChange={setAisleId} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select aisle…" />
                  </SelectTrigger>
                  <SelectContent>
                    {aisles.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unit */}
              <div className="space-y-1.5">
                <Label>Preferred unit</Label>
                <Select value={preferredUnitId} onValueChange={setPreferredUnitId} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Synonyms */}
              <div className="space-y-1.5">
                <Label htmlFor="merge-synonyms">
                  Synonyms
                  <span className="text-muted-foreground font-normal ml-1">(comma-separated, merged from both)</span>
                </Label>
                <Input
                  id="merge-synonyms"
                  value={synonymsText}
                  onChange={e => setSynonymsText(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. onion, brown onion, spanish onion"
                />
              </div>

              {/* CoFID status */}
              {(getCofidId(primary) || getCofidId(secondary)) && (
                <div className="space-y-1 rounded-md bg-muted/40 border px-3 py-2 text-xs">
                  <p className="font-medium text-muted-foreground">CoFID link</p>
                  {getCofidId(primary) ? (
                    <p className="text-green-600 dark:text-green-400">
                      ✓ Keeping: {getCofidName(primary) ?? getCofidId(primary)}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">Primary has no CoFID link</p>
                  )}
                  {getCofidId(secondary) && (
                    <p className="text-amber-600 dark:text-amber-400">
                      ✗ Dropping: {getCofidName(secondary) ?? getCofidId(secondary)} (from {secondary.name})
                    </p>
                  )}
                </div>
              )}
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
                    Merge Items
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
