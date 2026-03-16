/**
 * Canon Items — Full CRUD interface with approval workflow
 *
 * Manage canonical items:
 * - List all items with filtering
 * - Create new items
 * - Unified detail/edit sheet with CofID linking
 * - Bulk approve and assign aisle
 *
 * All data flows through api.ts only — no direct imports from logic or data.
 * Uses Salt design primitives for responsive, consistent layout.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  getCanonItems,
  getCanonAisles,
  addCanonItem,
  editCanonItem,
  approveItem,
  deleteItem,
  deleteItems,
  sortItems,
  filterUnapprovedItems,
  normalizeItemName,
  suggestCofidMatch,
  linkCofidMatch,
  unlinkCofidMatch,
  buildCofidMatch,
  getCofidItemById,
  getCanonCofidItems,
  type CanonItem,
  type SuggestedMatch,
} from '../api';
import type { CofIDItem } from '../types';
import { onCanonItemsDeleted } from '../../recipes/api';
import type { Aisle } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Loader2, Plus, Check, AlertCircle, Link, Unlink, Sparkles, Trash2, Search, Merge, Scissors, Layers } from 'lucide-react';
import { MergeCanonItemsDialog } from './MergeCanonItemsDialog';
import { SplitCanonItemDialog } from './SplitCanonItemDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { softToast } from '@/lib/soft-toast';
import { useAdminRefresh } from '@/shared/providers';
import { Page, Section, Stack } from '@/shared/components/primitives';

// ── Main Component ────────────────────────────────────────────────────────────

export const CanonItems: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<CanonItem[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitItem, setSplitItem] = useState<CanonItem | null>(null);
  const [currentItem, setCurrentItem] = useState<CanonItem | null>(null);
  const [groupByAisle, setGroupByAisle] = useState(false);

  // Unified detail sheet
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [detailItem, setDetailItem] = useState<CanonItem | null>(null);

  const getCofidSource = (item: CanonItem) =>
    item.externalSources?.find(source => source.source === 'cofid');

  // ── Search / Filter ──────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lower) ||
      item.normalisedName?.toLowerCase().includes(lower)
    );
  }, [items, searchTerm]);

  // Unapproved items always at top, then alphabetical within each group
  const sortedItems = useMemo(() => {
    const unapproved = sortItems(filteredItems.filter(i => !i.approved));
    const approved = sortItems(filteredItems.filter(i => i.approved));
    return [...unapproved, ...approved];
  }, [filteredItems]);

  // Group sorted items by aisle for the grouped view
  const groupedItems = useMemo(() => {
    if (!groupByAisle) return null;
    const groups = new Map<string, { aisle: Aisle | undefined; items: CanonItem[] }>();
    for (const item of sortedItems) {
      if (!groups.has(item.aisleId)) {
        groups.set(item.aisleId, { aisle: aisles.find(a => a.id === item.aisleId), items: [] });
      }
      groups.get(item.aisleId)!.items.push(item);
    }
    return Array.from(groups.values()).sort((a, b) => {
      const t3A = a.aisle?.tier3 ?? 'zzz';
      const t3B = b.aisle?.tier3 ?? 'zzz';
      if (t3A !== t3B) return t3A.localeCompare(t3B);
      const t2A = a.aisle?.tier2 ?? 'zzz';
      const t2B = b.aisle?.tier2 ?? 'zzz';
      if (t2A !== t2B) return t2A.localeCompare(t2B);
      return (a.aisle?.name ?? 'zzz').localeCompare(b.aisle?.name ?? 'zzz');
    });
  }, [groupByAisle, sortedItems, aisles]);

  const needsReviewCount = filterUnapprovedItems(items).length;
  const allItemsSelected = sortedItems.length > 0 && selectedItems.size === sortedItems.length;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsData, aislesData] = await Promise.all([
        getCanonItems(),
        getCanonAisles(),
      ]);
      setItems(itemsData);
      setAisles(aislesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshTrigger, loadData]);

  const handleCreate = async (input: {
    name: string;
    aisleId: string;
    unitType: 'mass' | 'volume' | 'count';
  }) => {
    const canonicalUnit = input.unitType === 'mass' ? 'g' : input.unitType === 'volume' ? 'ml' : 'each';
    try {
      await addCanonItem({
        name: input.name,
        aisleId: input.aisleId,
        unit: { canonical_unit_type: input.unitType, canonical_unit: canonicalUnit, density_g_per_ml: null },
        approved: false,
      });
      softToast.success('Item created successfully');
      await loadData();
      setShowCreateDialog(false);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to create item');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.size === 0) {
      softToast.error('No items selected');
      return;
    }
    try {
      await Promise.all(Array.from(selectedItems).map(id => approveItem(id)));
      softToast.success(`Approved ${selectedItems.size} items`);
      setSelectedItems(new Set());
      await loadData();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to approve items');
    }
  };

  const handleBulkAssignAisle = async (aisleId: string) => {
    if (selectedItems.size === 0) {
      softToast.error('No items selected');
      return;
    }
    try {
      await Promise.all(
        Array.from(selectedItems).map(id => {
          const item = items.find(i => i.id === id);
          if (item) {
            return editCanonItem(id, { aisleId });
          }
          return Promise.resolve();
        })
      );
      softToast.success(`Assigned ${selectedItems.size} items to aisle`);
      setSelectedItems(new Set());
      await loadData();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to assign aisle');
    }
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleAllSelection = (itemsToToggle: CanonItem[]) => {
    if (selectedItems.size === itemsToToggle.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(itemsToToggle.map(i => i.id)));
    }
  };

  const handleDelete = async () => {
    if (!currentItem) return;
    try {
      await deleteItem(currentItem.id);
      await onCanonItemsDeleted([currentItem.id]);
      softToast.success('Item deleted');
      setShowDeleteDialog(false);
      setCurrentItem(null);
      await loadData();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    const ids = Array.from(selectedItems);
    try {
      await deleteItems(ids);
      await onCanonItemsDeleted(ids);
      softToast.success(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
      setSelectedItems(new Set());
      setShowBulkDeleteDialog(false);
      await loadData();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to delete items');
    }
  };

  const handleOpenDetail = (item: CanonItem) => {
    setDetailItem(item);
    setShowDetailSheet(true);
  };

  if (isLoading) {
    return (
      <Page>
        <Section>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </Section>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Section>
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      {/* Header Section */}
      <Section spacing="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Canon Items</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Manage canonical item catalog, approve pending items, and link CofID references
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </Section>

      {/* Stats Section */}
      <Section spacing="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{items.length} total</Badge>
          {needsReviewCount > 0 && (
            <Badge variant="destructive">{needsReviewCount} need review</Badge>
          )}
          {selectedItems.size > 0 && (
            <Badge className="bg-primary/10 text-primary border-primary/20">{selectedItems.size} selected</Badge>
          )}
        </div>
      </Section>

      {/* Search Input */}
      <Section>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search items by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm('')}
            >
              Clear
            </Button>
          )}
          <Button
            variant={groupByAisle ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setGroupByAisle(v => !v)}
            className="gap-2 shrink-0"
          >
            <Layers className="h-4 w-4" />
            Group by aisle
          </Button>
        </div>
        {searchTerm && (
          <p className="text-xs text-muted-foreground mt-2">
            Found {sortedItems.length} of {items.length} items
          </p>
        )}
      </Section>

      {/* Bulk Actions Section (visible when items selected) */}
      {selectedItems.size > 0 && (
        <Section className="rounded-md border border-primary/20 bg-primary/5 p-4" spacing="space-y-3">
          <p className="text-sm font-medium">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <Button variant="default" size="sm" onClick={handleBulkApprove}>
              <Check className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground">Assign aisle:</span>
              <Select onValueChange={handleBulkAssignAisle}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select aisle..." />
                </SelectTrigger>
                <SelectContent>
                  {aisles.map(aisle => (
                    <SelectItem key={aisle.id} value={aisle.id}>
                      {aisle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedItems.size === 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMergeDialog(true)}
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge 2 items
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
              Clear
            </Button>
          </div>
        </Section>
      )}

      {/* Items List Section */}
      <Section>
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-md border-2 border-dashed">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">No canon items found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm ? 'Try a different search term' : 'Create an item to get started'}
            </p>
          </div>
        ) : groupedItems ? (
          <div className="space-y-4">
            {groupedItems.map(({ aisle, items: groupItems }) => (
              <div key={aisle?.id ?? 'uncategorised'} className="border rounded-lg divide-y">
                <div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{aisle?.name ?? 'Uncategorised'}</span>
                    {aisle && (
                      <span className="text-xs text-muted-foreground ml-2">{aisle.tier3} / {aisle.tier2}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{groupItems.length}</span>
                </div>
                <Stack spacing="gap-1">
                  {groupItems.map(item => {
                    const isLinked = !!getCofidSource(item);
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isLinked={isLinked}
                        isSelected={isSelected}
                        onToggleSelect={() => toggleItemSelection(item.id)}
                        onOpenDetail={() => handleOpenDetail(item)}
                        onDelete={() => { setCurrentItem(item); setShowDeleteDialog(true); }}
                        onSplit={() => { setSplitItem(item); setShowSplitDialog(true); }}
                      />
                    );
                  })}
                </Stack>
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {/* Header row */}
            <div className="hidden sm:flex px-4 py-3 bg-muted/30 font-medium text-sm">
              <div className="w-6">
                <Checkbox
                  checked={allItemsSelected}
                  onCheckedChange={() => toggleAllSelection(sortedItems)}
                  aria-label="Select all items"
                />
              </div>
              <div className="flex-1 ml-4">Item Name</div>
              <div className="w-32">Aisle</div>
              <div className="w-24">Unit</div>
              <div className="w-20">Status</div>
              <div className="w-20 text-right">Actions</div>
            </div>

            {/* Item rows */}
            <Stack spacing="gap-1">
              {sortedItems.map(item => {
                const isLinked = !!getCofidSource(item);
                const isSelected = selectedItems.has(item.id);

                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isLinked={isLinked}
                    isSelected={isSelected}
                    onToggleSelect={() => toggleItemSelection(item.id)}
                    onOpenDetail={() => handleOpenDetail(item)}
                    onDelete={() => {
                      setCurrentItem(item);
                      setShowDeleteDialog(true);
                    }}
                    onSplit={() => {
                      setSplitItem(item);
                      setShowSplitDialog(true);
                    }}
                  />
                );
              })}
            </Stack>
          </div>
        )}
      </Section>

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateItemDialog
          aisles={aisles}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Canon Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{currentItem?.name}</strong>?
              <br /><br />
              This action cannot be undone. Any recipes referencing this item will have orphaned references.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCurrentItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Split Dialog */}
      {showSplitDialog && splitItem && (
        <SplitCanonItemDialog
          item={splitItem}
          aisles={aisles}
          onSuccess={() => {
            setShowSplitDialog(false);
            setSplitItem(null);
            loadData();
          }}
          onCancel={() => {
            setShowSplitDialog(false);
            setSplitItem(null);
          }}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && selectedItems.size === 2 && (() => {
        const [idA, idB] = Array.from(selectedItems);
        const itemA = items.find(i => i.id === idA);
        const itemB = items.find(i => i.id === idB);
        if (!itemA || !itemB) return null;
        return (
          <MergeCanonItemsDialog
            itemA={itemA}
            itemB={itemB}
            aisles={aisles}
            onSuccess={() => {
              setShowMergeDialog(false);
              setSelectedItems(new Set());
              loadData();
            }}
            onCancel={() => setShowMergeDialog(false)}
          />
        );
      })()}

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Any recipes referencing these items will have orphaned links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unified Detail / Edit Sheet */}
      {detailItem && (
        <ItemDetailSheet
          item={detailItem}
          aisles={aisles}
          open={showDetailSheet}
          onOpenChange={(open) => {
            setShowDetailSheet(open);
            if (!open) setDetailItem(null);
          }}
          onSaved={loadData}
        />
      )}
    </Page>
  );
};

// ── Item Row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: CanonItem;
  isLinked: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenDetail: () => void;
  onDelete: () => void;
  onSplit: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({
  item,
  isLinked,
  isSelected,
  onToggleSelect,
  onOpenDetail,
  onDelete,
  onSplit,
}) => {
  const reviewHighlight = !item.approved
    ? 'border-l-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
    : '';

  return (
    <div className={`border-b last:border-b-0 ${reviewHighlight}`}>
      {/* Mobile card view */}
      <div className="sm:hidden px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="mt-1"
              aria-label={`Select ${item.name}`}
            />
            <div className="flex-1 min-w-0">
              <button
                onClick={onOpenDetail}
                className="font-semibold text-sm truncate hover:underline text-left block w-full"
              >
                {item.name}
              </button>
              <p className="text-xs text-muted-foreground mt-1">
                {item.aisle?.tier1 || 'Unknown aisle'} • {item.unit?.canonical_unit ?? '—'}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {!item.approved && (
                  <Badge variant="outline" className="text-xs">
                    Needs Review
                  </Badge>
                )}
                {isLinked && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Link className="h-2.5 w-2.5" />
                    CofID
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onOpenDetail}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onSplit}>
            <Scissors className="h-3 w-3 mr-1" />
            Split
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Desktop row view */}
      <div className="hidden sm:flex px-4 py-3 items-center gap-4 hover:bg-muted/30 transition-colors">
        <div className="w-6">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${item.name}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <button
            onClick={onOpenDetail}
            className="font-medium text-sm truncate hover:underline text-left block max-w-full"
          >
            {item.name}
          </button>
        </div>
        <div className="w-32 text-xs text-muted-foreground truncate">
          {item.aisle?.tier1 || 'Unknown'}
        </div>
        <div className="w-24 text-xs text-muted-foreground truncate">
          {item.unit?.canonical_unit ?? '—'}
        </div>
        <div className="w-20">
          <div className="flex flex-wrap gap-1">
            {!item.approved && (
              <Badge variant="outline" className="text-xs">
                Pending
              </Badge>
            )}
            {isLinked && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Link className="h-2.5 w-2.5" />
                CofID
              </Badge>
            )}
          </div>
        </div>
        <div className="w-20 flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={onSplit} title="Split item">
            <Scissors className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive" title="Delete item">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Create Item Dialog ────────────────────────────────────────────────────────

interface CreateItemDialogProps {
  aisles: Aisle[];
  onSubmit: (input: { name: string; aisleId: string; unitType: 'mass' | 'volume' | 'count' }) => Promise<void>;
  onCancel: () => void;
}

const CreateItemDialog: React.FC<CreateItemDialogProps> = ({
  aisles,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [aisleId, setAisleId] = useState('');
  const [unitType, setUnitType] = useState<'mass' | 'volume' | 'count'>('mass');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId) {
      softToast.error('Name and aisle are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: normalizedName, aisleId, unitType });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Canon Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tomatoes"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aisle">Aisle</Label>
              <Select value={aisleId} onValueChange={setAisleId} disabled={isSubmitting}>
                <SelectTrigger id="aisle">
                  <SelectValue placeholder="Select aisle" />
                </SelectTrigger>
                <SelectContent>
                  {aisles.map(aisle => (
                    <SelectItem key={aisle.id} value={aisle.id}>
                      {aisle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitType">Unit type</Label>
              <Select value={unitType} onValueChange={(v) => setUnitType(v as 'mass' | 'volume' | 'count')} disabled={isSubmitting}>
                <SelectTrigger id="unitType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mass">Mass (g)</SelectItem>
                  <SelectItem value="volume">Volume (ml)</SelectItem>
                  <SelectItem value="count">Count (each)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Unified Item Detail / Edit Sheet ──────────────────────────────────────────

interface ItemDetailSheetProps {
  item: CanonItem;
  aisles: Aisle[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({
  item,
  aisles,
  open,
  onOpenChange,
  onSaved,
}) => {
  // ── Edit state ───────────────────────────────────────────────────────────
  const [name, setName] = useState(item.name);
  const [aisleId, setAisleId] = useState(item.aisleId);
  const [unitType, setUnitType] = useState<'mass' | 'volume' | 'count'>(item.unit?.canonical_unit_type ?? 'mass');
  const [density, setDensity] = useState<string>(item.unit?.density_g_per_ml != null ? String(item.unit.density_g_per_ml) : '');
  // Count equivalents
  const [ceSmall, setCeSmall] = useState<string>(item.unit?.count_equivalents?.small != null ? String(item.unit.count_equivalents.small) : '');
  const [ceMedium, setCeMedium] = useState<string>(item.unit?.count_equivalents?.medium != null ? String(item.unit.count_equivalents.medium) : '');
  const [ceLarge, setCeLarge] = useState<string>(item.unit?.count_equivalents?.large != null ? String(item.unit.count_equivalents.large) : '');
  const [ceDefault, setCeDefault] = useState<string>(item.unit?.count_equivalents?.default_each_weight != null ? String(item.unit.count_equivalents.default_each_weight) : '');
  // Volume equivalents
  const [veTsp, setVeTsp] = useState<string>(item.unit?.volume_equivalents?.tsp != null ? String(item.unit.volume_equivalents.tsp) : '');
  const [veTbsp, setVeTbsp] = useState<string>(item.unit?.volume_equivalents?.tbsp != null ? String(item.unit.volume_equivalents.tbsp) : '');
  const [veCup, setVeCup] = useState<string>(item.unit?.volume_equivalents?.cup != null ? String(item.unit.volume_equivalents.cup) : '');
  // Classification
  const [itemType, setItemType] = useState<'ingredient' | 'product' | 'household'>(item.itemType ?? 'ingredient');
  const [isStaple, setIsStaple] = useState(item.isStaple);
  const [synonymsText, setSynonymsText] = useState((item.synonyms ?? []).join(', '));
  const [allergensText, setAllergensText] = useState((item.allergens ?? []).join(', '));
  const [barcodesText, setBarcodesText] = useState((item.barcodes ?? []).join(', '));
  const [notes, setNotes] = useState(item.metadata?.notes ?? '');
  // Shopping
  const [shoppingUnit, setShoppingUnit] = useState<'g' | 'ml' | 'each'>(item.shopping?.shopping_unit ?? 'g');
  const [loose, setLoose] = useState(item.shopping?.loose ?? false);
  const [packSizes, setPackSizes] = useState<Array<{ unit: 'g' | 'ml' | 'each'; size: string; description: string }>>(
    (item.shopping?.pack_sizes ?? []).map(p => ({ unit: p.unit, size: String(p.size), description: p.description }))
  );
  const [hasShoppingData, setHasShoppingData] = useState(!!item.shopping);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── CofID state ──────────────────────────────────────────────────────────
  const [cofidDetail, setCofidDetail] = useState<any>(null);
  const [isLoadingCofidDetail, setIsLoadingCofidDetail] = useState(false);
  const [showCofidSearch, setShowCofidSearch] = useState(false);
  const [cofidSuggestions, setCofidSuggestions] = useState<{
    bestMatch: SuggestedMatch | null;
    candidates: SuggestedMatch[];
  } | null>(null);
  const [isLoadingCofid, setIsLoadingCofid] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<SuggestedMatch | null>(null);
  const [cofidSearchFilter, setCofidSearchFilter] = useState('');
  const [allCofidItems, setAllCofidItems] = useState<CofIDItem[]>([]);
  const [isLoadingAllCofid, setIsLoadingAllCofid] = useState(false);
  // Track the current CofID source locally so unlink updates are immediate
  const [localCofidSource, setLocalCofidSource] = useState(
    item.externalSources?.find(s => s.source === 'cofid') ?? null
  );

  // Reset state when item changes
  useEffect(() => {
    setName(item.name);
    setAisleId(item.aisleId);
    setUnitType(item.unit?.canonical_unit_type ?? 'mass');
    setDensity(item.unit?.density_g_per_ml != null ? String(item.unit.density_g_per_ml) : '');
    setCeSmall(item.unit?.count_equivalents?.small != null ? String(item.unit.count_equivalents.small) : '');
    setCeMedium(item.unit?.count_equivalents?.medium != null ? String(item.unit.count_equivalents.medium) : '');
    setCeLarge(item.unit?.count_equivalents?.large != null ? String(item.unit.count_equivalents.large) : '');
    setCeDefault(item.unit?.count_equivalents?.default_each_weight != null ? String(item.unit.count_equivalents.default_each_weight) : '');
    setVeTsp(item.unit?.volume_equivalents?.tsp != null ? String(item.unit.volume_equivalents.tsp) : '');
    setVeTbsp(item.unit?.volume_equivalents?.tbsp != null ? String(item.unit.volume_equivalents.tbsp) : '');
    setVeCup(item.unit?.volume_equivalents?.cup != null ? String(item.unit.volume_equivalents.cup) : '');
    setItemType(item.itemType ?? 'ingredient');
    setIsStaple(item.isStaple);
    setSynonymsText((item.synonyms ?? []).join(', '));
    setAllergensText((item.allergens ?? []).join(', '));
    setBarcodesText((item.barcodes ?? []).join(', '));
    setNotes(item.metadata?.notes ?? '');
    setShoppingUnit(item.shopping?.shopping_unit ?? 'g');
    setLoose(item.shopping?.loose ?? false);
    setPackSizes((item.shopping?.pack_sizes ?? []).map(p => ({ unit: p.unit, size: String(p.size), description: p.description })));
    setHasShoppingData(!!item.shopping);
    setCofidDetail(null);
    setShowCofidSearch(false);
    setCofidSuggestions(null);
    setSelectedMatch(null);
    setCofidSearchFilter('');
    const source = item.externalSources?.find(s => s.source === 'cofid') ?? null;
    setLocalCofidSource(source);

    // Load CofID detail if linked
    if (source?.externalId) {
      setIsLoadingCofidDetail(true);
      getCofidItemById(source.externalId)
        .then(detail => setCofidDetail(detail))
        .catch(() => { /* non-critical */ })
        .finally(() => setIsLoadingCofidDetail(false));
    }
  }, [item]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId) {
      softToast.error('Name and aisle are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const canonicalUnit = unitType === 'mass' ? 'g' : unitType === 'volume' ? 'ml' : 'each';
      const parsedDensity = density.trim() !== '' ? parseFloat(density) : null;
      const unit: CanonItem['unit'] = {
        canonical_unit_type: unitType,
        canonical_unit: canonicalUnit,
        density_g_per_ml: !isNaN(parsedDensity as number) && parsedDensity !== null ? parsedDensity : null,
        ...(unitType === 'count' && (ceSmall || ceMedium || ceLarge || ceDefault) ? {
          count_equivalents: {
            small: ceSmall.trim() ? parseFloat(ceSmall) || null : null,
            medium: ceMedium.trim() ? parseFloat(ceMedium) || null : null,
            large: ceLarge.trim() ? parseFloat(ceLarge) || null : null,
            default_each_weight: ceDefault.trim() ? parseFloat(ceDefault) || null : null,
          },
        } : {}),
        ...(veTsp || veTbsp || veCup ? {
          volume_equivalents: {
            tsp: veTsp.trim() ? parseFloat(veTsp) || null : null,
            tbsp: veTbsp.trim() ? parseFloat(veTbsp) || null : null,
            cup: veCup.trim() ? parseFloat(veCup) || null : null,
          },
        } : item.unit?.volume_equivalents ? { volume_equivalents: item.unit.volume_equivalents } : {}),
      };

      const synonyms = synonymsText.split(',').map(s => s.trim()).filter(Boolean);
      const allergens = allergensText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const barcodes = barcodesText.split(',').map(s => s.trim()).filter(Boolean);

      const shopping = hasShoppingData ? {
        shopping_unit: shoppingUnit,
        loose,
        pack_sizes: packSizes
          .filter(p => p.size.trim() && p.description.trim())
          .map(p => ({ unit: p.unit, size: parseFloat(p.size) || 0, description: p.description.trim() })),
      } : undefined;

      await editCanonItem(item.id, {
        name: normalizedName,
        aisleId,
        unit,
        itemType,
        isStaple,
        synonyms,
        allergens,
        barcodes,
        ...(shopping !== undefined ? { shopping } : {}),
        ...(notes.trim() ? { metadata: { ...(item.metadata ?? {}), notes: notes.trim() } } : item.metadata ? { metadata: item.metadata } : {}),
      });
      if (!item.approved) {
        await approveItem(item.id);
        softToast.success('Item approved');
      } else {
        softToast.success('Item updated');
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestCofid = async () => {
    setShowCofidSearch(true);
    setIsLoadingCofid(true);
    setCofidSuggestions(null);
    setSelectedMatch(null);
    setCofidSearchFilter('');
    try {
      const [suggestions] = await Promise.all([
        suggestCofidMatch(item.id),
        // Load full CoFID collection for search
        (async () => {
          if (allCofidItems.length === 0) {
            setIsLoadingAllCofid(true);
            try {
              const items = await getCanonCofidItems();
              setAllCofidItems(items as CofIDItem[]);
            } catch { /* non-critical */ }
            finally { setIsLoadingAllCofid(false); }
          }
        })(),
      ]);
      setCofidSuggestions(suggestions);
      if (suggestions.bestMatch) {
        setSelectedMatch(suggestions.bestMatch);
      }
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to suggest CofID matches');
      setShowCofidSearch(false);
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleLinkCofid = async (match: SuggestedMatch) => {
    setIsLoadingCofid(true);
    try {
      const matchMetadata = buildCofidMatch(match, 'manual');
      await linkCofidMatch(item.id, match.cofidId, matchMetadata);
      softToast.success(`Linked to ${match.name}`);
      setShowCofidSearch(false);
      setCofidSuggestions(null);
      setSelectedMatch(null);
      // Update local CofID state
      setLocalCofidSource({
        source: 'cofid',
        externalId: match.cofidId,
      });
      // Load the new CofID detail
      try {
        const detail = await getCofidItemById(match.cofidId);
        setCofidDetail(detail);
      } catch { /* non-critical */ }
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to link CofID match');
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleUnlinkCofid = async () => {
    try {
      await unlinkCofidMatch(item.id);
      softToast.success('CofID link removed');
      setLocalCofidSource(null);
      setCofidDetail(null);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to unlink CofID');
    }
  };

  // ── CofID search filtering ──────────────────────────────────────────────
  const filteredCandidates = useMemo(() => {
    if (!cofidSuggestions?.candidates) return [];
    if (!cofidSearchFilter.trim()) return cofidSuggestions.candidates;
    const lower = cofidSearchFilter.toLowerCase();
    return cofidSuggestions.candidates.filter(c => c.name.toLowerCase().includes(lower));
  }, [cofidSuggestions?.candidates, cofidSearchFilter]);

  const dbSearchResults = useMemo(() => {
    if (!cofidSearchFilter.trim() || cofidSearchFilter.trim().length < 2) return [];
    const lower = cofidSearchFilter.toLowerCase();
    const suggestionIds = new Set(cofidSuggestions?.candidates?.map(c => c.cofidId) ?? []);
    return allCofidItems
      .filter(c => c.name.toLowerCase().includes(lower) && !suggestionIds.has(c.id))
      .slice(0, 30);
  }, [allCofidItems, cofidSearchFilter, cofidSuggestions?.candidates]);

  const cofidItemToMatch = (ci: CofIDItem): SuggestedMatch => ({
    cofidId: ci.id,
    name: ci.name,
    score: 1.0,
    method: 'exact',
    reason: 'Manual selection from CoFID database',
  });

  // ── Nutrition data ──────────────────────────────────────────────────────
  const nutrition =
    (cofidDetail?.nutrients && typeof cofidDetail.nutrients === 'object' ? cofidDetail.nutrients : null)
    ?? (localCofidSource?.properties && typeof localCofidSource.properties === 'object'
        ? (localCofidSource.properties as any).nutrition
        : null);

  const NUTRIENT_LABELS: Record<string, string> = {
    energyKcal: 'Energy (kcal)',
    energyKj: 'Energy (kJ)',
    protein: 'Protein (g)',
    fat: 'Total fat (g)',
    satFatPer100gFood: 'Saturated fat (g)',
    carbs: 'Carbohydrate (g)',
    sugars: 'Sugars (g)',
    fibre: 'Fibre (g)',
    salt: 'Salt (mg)',
    cholesterol: 'Cholesterol (mg)',
    water: 'Water (g)',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>
            {!item.approved ? 'Pending review' : 'Approved'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-24">
          {/* ── Identity ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Item Details</h3>
            <div className="space-y-2">
              <Label htmlFor="detail-name">Name</Label>
              <Input
                id="detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Aisle</Label>
              <Combobox
                options={aisles.map(a => ({ value: a.id, label: a.name }))}
                value={aisleId}
                onValueChange={setAisleId}
                placeholder="Select aisle..."
                searchPlaceholder="Filter aisles..."
                emptyMessage="No aisles found."
                disabled={isSubmitting}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Item type</Label>
              <div className="flex gap-2">
                {(['ingredient', 'product', 'household'] as const).map(t => (
                  <Button
                    key={t}
                    type="button"
                    variant={itemType === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setItemType(t)}
                    disabled={isSubmitting}
                    className="flex-1 capitalize"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="detail-staple">Staple item</Label>
              <Switch
                id="detail-staple"
                checked={isStaple}
                onCheckedChange={setIsStaple}
                disabled={isSubmitting}
              />
            </div>
          </section>

          {/* ── Unit Intelligence ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Unit Intelligence</h3>
            <div className="space-y-2">
              <Label>Unit type</Label>
              <div className="flex gap-2">
                {(['mass', 'volume', 'count'] as const).map(type => (
                  <Button
                    key={type}
                    type="button"
                    variant={unitType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUnitType(type)}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {type === 'mass' ? 'Mass (g)' : type === 'volume' ? 'Volume (ml)' : 'Count (each)'}
                  </Button>
                ))}
              </div>
            </div>
            {(unitType === 'mass' || unitType === 'volume') && (
              <div className="space-y-2">
                <Label htmlFor="detail-density">Density (g/ml)</Label>
                <Input
                  id="detail-density"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="e.g. 0.91 for olive oil"
                  value={density}
                  onChange={e => setDensity(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}
            {unitType === 'count' && (
              <div className="space-y-2">
                <Label>Count equivalents (grams each)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['Small', ceSmall, setCeSmall],
                    ['Medium', ceMedium, setCeMedium],
                    ['Large', ceLarge, setCeLarge],
                    ['Default / each', ceDefault, setCeDefault],
                  ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                    <div key={label} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="g"
                        value={val}
                        onChange={e => setter(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Volume equivalents <span className="font-normal text-muted-foreground">(g or ml)</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['tsp', veTsp, setVeTsp],
                  ['tbsp', veTbsp, setVeTbsp],
                  ['cup', veCup, setVeCup],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="—"
                      value={val}
                      onChange={e => setter(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Synonyms & Classification ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Names & Classification</h3>
            <div className="space-y-2">
              <Label htmlFor="detail-synonyms">
                Synonyms
                <span className="text-xs text-muted-foreground font-normal ml-1">(comma-separated)</span>
              </Label>
              <Input
                id="detail-synonyms"
                placeholder="e.g. Tomatoes, Cherry tomatoes"
                value={synonymsText}
                onChange={e => setSynonymsText(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-allergens">
                Allergens
                <span className="text-xs text-muted-foreground font-normal ml-1">(comma-separated)</span>
              </Label>
              <Input
                id="detail-allergens"
                placeholder="e.g. gluten, nuts, dairy"
                value={allergensText}
                onChange={e => setAllergensText(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </section>

          {/* ── Shopping Intelligence ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Shopping Intelligence</h3>
              <Switch
                checked={hasShoppingData}
                onCheckedChange={setHasShoppingData}
                disabled={isSubmitting}
              />
            </div>
            {hasShoppingData && (
              <>
                <div className="space-y-2">
                  <Label>Shopping unit</Label>
                  <div className="flex gap-2">
                    {(['g', 'ml', 'each'] as const).map(u => (
                      <Button
                        key={u}
                        type="button"
                        variant={shoppingUnit === u ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShoppingUnit(u)}
                        disabled={isSubmitting}
                        className="flex-1"
                      >
                        {u}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Loose (buy individually)</Label>
                  <Switch
                    checked={loose}
                    onCheckedChange={setLoose}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Pack sizes</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPackSizes(ps => [...ps, { unit: shoppingUnit, size: '', description: '' }])}
                      disabled={isSubmitting}
                    >
                      + Add
                    </Button>
                  </div>
                  {packSizes.length === 0 && (
                    <p className="text-xs text-muted-foreground">No pack sizes defined.</p>
                  )}
                  {packSizes.map((ps, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <select
                        value={ps.unit}
                        onChange={e => setPackSizes(prev => prev.map((p, j) => j === i ? { ...p, unit: e.target.value as 'g' | 'ml' | 'each' } : p))}
                        disabled={isSubmitting}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="each">each</option>
                      </select>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="Size"
                        value={ps.size}
                        onChange={e => setPackSizes(prev => prev.map((p, j) => j === i ? { ...p, size: e.target.value } : p))}
                        disabled={isSubmitting}
                        className="w-20"
                      />
                      <Input
                        placeholder="e.g. 1kg bag"
                        value={ps.description}
                        onChange={e => setPackSizes(prev => prev.map((p, j) => j === i ? { ...p, description: e.target.value } : p))}
                        disabled={isSubmitting}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPackSizes(prev => prev.filter((_, j) => j !== i))}
                        disabled={isSubmitting}
                        className="px-2 text-destructive hover:text-destructive"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ── Metadata & Barcodes ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Metadata</h3>
            <div className="space-y-2">
              <Label htmlFor="detail-notes">Notes</Label>
              <textarea
                id="detail-notes"
                rows={2}
                placeholder="Freeform notes about this item..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-barcodes">
                Barcodes
                <span className="text-xs text-muted-foreground font-normal ml-1">(comma-separated)</span>
              </Label>
              <Input
                id="detail-barcodes"
                placeholder="e.g. 5000112637922, 0012345678905"
                value={barcodesText}
                onChange={e => setBarcodesText(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </section>

          {/* CoFID Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">CoFID Link</h3>
            {localCofidSource ? (
              <div className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CoFID ID</span>
                    <span className="font-mono text-xs">{localCofidSource.externalId}</span>
                  </div>
                  {isLoadingCofidDetail && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Loading CoFID details...</span>
                    </div>
                  )}
                  {cofidDetail && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CoFID name</span>
                      <span className="font-medium text-right max-w-[60%]">{cofidDetail.name ?? '—'}</span>
                    </div>
                  )}
                  {localCofidSource.confidence != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Match confidence</span>
                      <span>{Math.round(localCofidSource.confidence * 100)}%</span>
                    </div>
                  )}
                  {localCofidSource.syncedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Synced</span>
                      <span className="text-xs">
                        {new Date(localCofidSource.syncedAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSuggestCofid}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Change Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleUnlinkCofid}>
                    <Unlink className="h-3 w-3 mr-1" />
                    Unlink
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No CoFID link.</p>
                {!showCofidSearch && (
                  <Button variant="outline" size="sm" onClick={handleSuggestCofid}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Find CofID Match
                  </Button>
                )}
              </div>
            )}

            {/* Inline CofID search */}
            {showCofidSearch && (
              <div className="space-y-3 rounded-md border p-3">
                {isLoadingCofid ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Finding matches...</span>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search CoFID database..."
                        value={cofidSearchFilter}
                        onChange={e => setCofidSearchFilter(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                      {isLoadingAllCofid && (
                        <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {/* Algorithm suggestions */}
                      {filteredCandidates.length > 0 && (
                        <div className="space-y-1">
                          {cofidSearchFilter && <p className="text-xs font-medium text-muted-foreground">Suggestions</p>}
                          {filteredCandidates.map((match, idx) => (
                            <CofidMatchButton
                              key={match.cofidId}
                              name={match.name}
                              cofidId={match.cofidId}
                              badge={idx === 0 && !cofidSearchFilter && cofidSuggestions?.bestMatch?.cofidId === match.cofidId
                                ? <Badge variant="default" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Best match</Badge>
                                : <Badge variant={match.method === 'exact' ? 'default' : 'secondary'} className="text-xs">{match.method}</Badge>
                              }
                              sub={`${Math.round(match.score * 100)}% similarity`}
                              isSelected={selectedMatch?.cofidId === match.cofidId}
                              onSelect={() => setSelectedMatch(match)}
                            />
                          ))}
                        </div>
                      )}

                      {filteredCandidates.length === 0 && (cofidSuggestions?.candidates?.length ?? 0) > 0 && cofidSearchFilter && (
                        <p className="text-xs text-muted-foreground">No suggestions match — see database results below.</p>
                      )}

                      {(cofidSuggestions?.candidates?.length ?? 0) === 0 && !cofidSearchFilter && (
                        <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed rounded-lg">
                          <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No automatic matches found.</p>
                          <p className="text-xs text-muted-foreground mt-1">Type above to search the full CoFID database.</p>
                        </div>
                      )}

                      {/* Full database results */}
                      {dbSearchResults.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            CoFID database ({dbSearchResults.length}{dbSearchResults.length === 30 ? '+' : ''})
                          </p>
                          {dbSearchResults.map(ci => (
                            <CofidMatchButton
                              key={ci.id}
                              name={ci.name}
                              cofidId={ci.id}
                              badge={<Badge variant="outline" className="text-xs text-muted-foreground">Group {ci.group}</Badge>}
                              sub={ci.id}
                              isSelected={selectedMatch?.cofidId === ci.id}
                              onSelect={() => setSelectedMatch(cofidItemToMatch(ci))}
                            />
                          ))}
                        </div>
                      )}

                      {cofidSearchFilter.trim().length > 0 && cofidSearchFilter.trim().length < 2 && (
                        <p className="text-xs text-muted-foreground">Type at least 2 characters to search the database.</p>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setShowCofidSearch(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => selectedMatch && handleLinkCofid(selectedMatch)}
                        disabled={!selectedMatch || isLoadingCofid}
                      >
                        {isLoadingCofid ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Selected'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Nutritional data */}
          {nutrition && typeof nutrition === 'object' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Nutritional Data <span className="font-normal text-muted-foreground">(per 100g)</span></h3>
              <div className="rounded-md border divide-y text-sm">
                {Object.entries(NUTRIENT_LABELS).map(([key, label]) => {
                  const val = (nutrition as any)[key];
                  if (val == null) return null;
                  return (
                    <div key={key} className="flex justify-between px-3 py-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono">{typeof val === 'number' ? val.toFixed(1) : val}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Other external sources */}
          {item.externalSources && item.externalSources.filter(s => s.source !== 'cofid').length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Other External Sources</h3>
              <div className="space-y-2">
                {item.externalSources
                  .filter(s => s.source !== 'cofid')
                  .map((src, i) => (
                    <div key={i} className="rounded-md border px-3 py-2 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium capitalize">{src.source}</span>
                        {src.confidence != null && (
                          <span className="text-muted-foreground text-xs">{Math.round(src.confidence * 100)}% confidence</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{src.externalId}</p>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>

        {/* Sticky footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {!item.approved ? 'Approving...' : 'Saving...'}
              </>
            ) : (
              <>
                {!item.approved && <Check className="h-4 w-4 mr-2" />}
                {!item.approved ? 'Approve' : 'Save'}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── CofidMatchButton ─────────────────────────────────────────────────────────

const CofidMatchButton: React.FC<{
  name: string;
  cofidId: string;
  badge: React.ReactNode;
  sub: string;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ name, badge, sub, isSelected, onSelect }) => (
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
