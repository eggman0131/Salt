/**
 * Canon Items — Full CRUD interface with approval workflow
 *
 * Manage canonical items:
 * - List all items with filtering
 * - Create new items
 * - Edit existing items (inline or modal)
 * - Approve items from review queue with field modification
 * - Link CofID matches with ranked candidates
 * - Bulk approve and assign aisle
 *
 * All data flows through api.ts only — no direct imports from logic or data.
 * Uses Salt design primitives for responsive, consistent layout.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  getCanonItems,
  getCanonAisles,
  getCanonUnits,
  addCanonItem,
  editCanonItem,
  approveItem,
  deleteItem,
  sortItems,
  filterItemsNeedingReview,
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
import type { Aisle, Unit } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Loader2, Plus, Check, Pencil, AlertCircle, Link, Unlink, Sparkles, Trash2, Info, Search, Merge } from 'lucide-react';
import { MergeCanonItemsDialog } from './MergeCanonItemsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { softToast } from '@/lib/soft-toast';
import { useAdminRefresh } from '@/shared/providers';
import { Page, Section, Stack } from '@/shared/components/primitives';

// ── Main Component ────────────────────────────────────────────────────────────

export const CanonItems: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<CanonItem[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<CanonItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [inlineEditing, setInlineEditing] = useState<string | null>(null);
  const [showCofidDialog, setShowCofidDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [detailItem, setDetailItem] = useState<CanonItem | null>(null);
  const [cofidDetail, setCofidDetail] = useState<any | null>(null);
  const [isLoadingCofidDetail, setIsLoadingCofidDetail] = useState(false);
  const [cofidSuggestions, setCofidSuggestions] = useState<{
    bestMatch: SuggestedMatch | null;
    candidates: SuggestedMatch[];
  } | null>(null);
  const [isLoadingCofid, setIsLoadingCofid] = useState(false);

  const getCofidSource = (item: CanonItem) =>
    item.externalSources?.find(source => source.source === 'cofid');

  const hasCofidNutrition = (item: CanonItem): boolean => {
    const properties = getCofidSource(item)?.properties;
    return !!(properties && typeof properties === 'object' && 'nutrition' in properties);
  };

  // ── Search / Filter ──────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lower) ||
      item.normalisedName.toLowerCase().includes(lower)
    );
  }, [items, searchTerm]);

  // Needs-review items always at top, then alphabetical within each group
  const sortedItems = useMemo(() => {
    const needsReview = sortItems(filteredItems.filter(i => i.needsReview));
    const approved = sortItems(filteredItems.filter(i => !i.needsReview));
    return [...needsReview, ...approved];
  }, [filteredItems]);

  const needsReviewCount = filterItemsNeedingReview(items).length;
  const allItemsSelected = sortedItems.length > 0 && selectedItems.size === sortedItems.length;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsData, aislesData, unitsData] = await Promise.all([
        getCanonItems(),
        getCanonAisles(),
        getCanonUnits(),
      ]);
      setItems(itemsData);
      setAisles(aislesData);
      setUnits(unitsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]); // Re-fetch when refresh is triggered from dashboard

  const handleCreate = async (input: {
    name: string;
    aisleId: string;
    preferredUnitId: string;
  }) => {
    try {
      await addCanonItem({ ...input, needsReview: true });
      softToast.success('Item created successfully');
      await loadData();
      setShowCreateDialog(false);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to create item');
    }
  };

  const handleEdit = async (
    id: string,
    updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId'>>
  ) => {
    try {
      await editCanonItem(id, updates);
      softToast.success('Item updated successfully');
      await loadData();
      setShowEditDialog(false);
      setCurrentItem(null);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveItem(id);
      softToast.success('Item approved');
      await loadData();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to approve item');
    }
  };

  // Combined edit + approve in one atomic action — used by ApprovalItemDialog
  // to avoid multiple toasts from the separate handleEdit / handleApprove calls.
  const handleApproveWithEdits = async (
    updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId'>>
  ) => {
    if (!currentItem) return;
    try {
      await editCanonItem(currentItem.id, updates);
      await approveItem(currentItem.id);
      softToast.success('Item approved');
      await loadData();
      setShowApprovalDialog(false);
      setCurrentItem(null);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to approve item');
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

  // PR5: CofID Integration handlers
  const handleSuggestCofid = async (item: CanonItem) => {
    setCurrentItem(item);
    setIsLoadingCofid(true);
    setShowCofidDialog(true);
    try {
      const suggestions = await suggestCofidMatch(item.id);
      setCofidSuggestions(suggestions);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to suggest CofID matches');
      setShowCofidDialog(false);
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleLinkCofid = async (match: SuggestedMatch) => {
    if (!currentItem) return;
    setIsLoadingCofid(true);
    try {
      const matchMetadata = buildCofidMatch(match, 'manual');
      await linkCofidMatch(currentItem.id, match.cofidId, matchMetadata);
      softToast.success(`Linked to ${match.name}`);
      await loadData();
      setShowCofidDialog(false);
      setCofidSuggestions(null);
      setCurrentItem(null);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to link CofID match');
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleUnlinkCofid = async (item: CanonItem) => {
    try {
      await unlinkCofidMatch(item.id);
      softToast.success('CofID link removed');
      await loadData();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to unlink CofID');
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
      await Promise.all(ids.map(id => deleteItem(id)));
      await onCanonItemsDeleted(ids);
      softToast.success(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
      setSelectedItems(new Set());
      setShowBulkDeleteDialog(false);
      await loadData();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to delete items');
    }
  };

  const handleViewDetail = async (item: CanonItem) => {
    setDetailItem(item);
    setShowDetailSheet(true);
    setCofidDetail(null);
    const cofidSource = item.externalSources?.find(s => s.source === 'cofid');
    if (cofidSource?.externalId) {
      setIsLoadingCofidDetail(true);
      try {
        const cofidItem = await getCofidItemById(cofidSource.externalId);
        setCofidDetail(cofidItem);
      } catch {
        // non-critical — detail panel shows what we have
      } finally {
        setIsLoadingCofidDetail(false);
      }
    }
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
              <div className="w-32 text-right">Actions</div>
            </div>

            {/* Item rows */}
            <Stack spacing="gap-1">
              {sortedItems.map(item => {
                const aisle = aisles.find(a => a.id === item.aisleId);
                const unit = units.find(u => u.id === item.preferredUnitId);
                const isLinked = !!getCofidSource(item);
                const hasNutrients = hasCofidNutrition(item);
                const isSelected = selectedItems.has(item.id);

                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    aisle={aisle}
                    unit={unit}
                    isLinked={isLinked}
                    hasNutrients={hasNutrients}
                    isSelected={isSelected}
                    isEditing={inlineEditing === item.id}
                    aisles={aisles}
                    units={units}
                    onToggleSelect={() => toggleItemSelection(item.id)}
                    onViewDetail={() => handleViewDetail(item)}
                    onEdit={() => {
                      setCurrentItem(item);
                      setShowEditDialog(true);
                    }}
                    onApprove={() => {
                      if (item.needsReview) {
                        setCurrentItem(item);
                        setShowApprovalDialog(true);
                      }
                    }}
                    onSuggestCofid={() => handleSuggestCofid(item)}
                    onUnlinkCofid={() => handleUnlinkCofid(item)}
                    onInlineEdit={(fieldName) => setInlineEditing(item.id)}
                    onDelete={() => {
                      setCurrentItem(item);
                      setShowDeleteDialog(true);
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
          units={units}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && currentItem && (
        <EditItemDialog
          item={currentItem}
          aisles={aisles}
          units={units}
          onSubmit={(updates) => handleEdit(currentItem.id, updates)}
          onCancel={() => {
            setShowEditDialog(false);
            setCurrentItem(null);
          }}
        />
      )}

      {/* Approval Dialog (Dedicated workflow) */}
      {showApprovalDialog && currentItem && (
        <ApprovalItemDialog
          item={currentItem}
          aisles={aisles}
          units={units}
          hasNutrients={hasCofidNutrition(currentItem)}
          onSubmit={handleApproveWithEdits}
          onCancel={() => {
            setShowApprovalDialog(false);
            setCurrentItem(null);
          }}
        />
      )}

      {/* CofID Suggestions Dialog */}
      {showCofidDialog && currentItem && (
        <CofidSuggestionsDialog
          item={currentItem}
          aisles={aisles}
          suggestions={cofidSuggestions}
          isLoading={isLoadingCofid}
          onLink={handleLinkCofid}
          onCancel={() => {
            setShowCofidDialog(false);
            setCofidSuggestions(null);
            setCurrentItem(null);
          }}
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
            units={units}
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

      {/* Item Detail Sheet */}
      {detailItem && (
        <ItemDetailSheet
          item={detailItem}
          aisle={aisles.find(a => a.id === detailItem.aisleId)}
          unit={units.find(u => u.id === detailItem.preferredUnitId)}
          cofidDetail={cofidDetail}
          isLoadingCofidDetail={isLoadingCofidDetail}
          open={showDetailSheet}
          onOpenChange={(open) => {
            setShowDetailSheet(open);
            if (!open) { setDetailItem(null); setCofidDetail(null); }
          }}
        />
      )}
    </Page>
  );
};

// ── Approval Item Dialog (Item approval with field modification) ──────────────

interface ApprovalItemDialogProps {
  item: CanonItem;
  aisles: Aisle[];
  units: Unit[];
  hasNutrients: boolean;
  onSubmit: (updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId'>>) => Promise<void>;
  onCancel: () => void;
}

const ApprovalItemDialog: React.FC<ApprovalItemDialogProps> = ({
  item,
  aisles,
  units,
  hasNutrients,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(item.name);
  const [aisleId, setAisleId] = useState(item.aisleId);
  const [preferredUnitId, setPreferredUnitId] = useState(item.preferredUnitId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId || !preferredUnitId) {
      softToast.error('All fields are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: normalizedName, aisleId, preferredUnitId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const aisle = aisles.find(a => a.id === item.aisleId);
  const unit = units.find(u => u.id === item.preferredUnitId);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review & Approve Item</DialogTitle>
          <DialogDescription>
            Review the item details before approving. You can modify any field if needed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Item Summary */}
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <h3 className="font-semibold text-sm mb-3">Item Summary</h3>
              <Stack spacing="gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge>Pending Review</Badge>
                </div>
                {hasNutrients && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Nutrients:</span>
                    <Badge variant="secondary">Available</Badge>
                  </div>
                )}
              </Stack>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Item Details</h3>
              <div className="space-y-2">
                <Label htmlFor="approval-name">Item Name</Label>
                <Input
                  id="approval-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Item name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approval-aisle">Aisle</Label>
                <Select value={aisleId} onValueChange={setAisleId} disabled={isSubmitting}>
                  <SelectTrigger id="approval-aisle">
                    <SelectValue />
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
                <Label htmlFor="approval-unit">Preferred Unit</Label>
                <Select
                  value={preferredUnitId}
                  onValueChange={setPreferredUnitId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="approval-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Info */}
            <div className="rounded-md border border-blue/20 bg-blue/5 p-3 text-xs text-muted-foreground">
              <p>
                Approving this item will set <code className="text-xs font-mono">needsReview: false</code> and make it available to recipes and other modules.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Approving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Approve Item
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


interface ItemRowProps {
  item: CanonItem;
  aisle?: Aisle;
  unit?: Unit;
  isLinked: boolean;
  hasNutrients: boolean;
  isSelected: boolean;
  isEditing: boolean;
  aisles: Aisle[];
  units: Unit[];
  onToggleSelect: () => void;
  onViewDetail: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onSuggestCofid: () => void;
  onUnlinkCofid: () => void;
  onInlineEdit: (fieldName: string) => void;
  onDelete: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({
  item,
  aisle,
  unit,
  isLinked,
  hasNutrients,
  isSelected,
  isEditing,
  aisles,
  units,
  onToggleSelect,
  onViewDetail,
  onEdit,
  onApprove,
  onSuggestCofid,
  onUnlinkCofid,
  onDelete,
}) => {
  const reviewHighlight = item.needsReview
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
                onClick={onViewDetail}
                className="font-semibold text-sm truncate hover:underline text-left block w-full"
              >
                {item.name}
              </button>
              <p className="text-xs text-muted-foreground mt-1">
                {aisle?.name || 'Unknown aisle'} • {unit?.name || 'Unknown unit'}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {item.needsReview && (
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
                {hasNutrients && (
                  <Badge variant="default" className="text-xs">
                    Nutrients
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {item.needsReview && (
            <Button size="sm" onClick={onApprove}>
              <Check className="h-3 w-3 mr-1" />
              Approve
            </Button>
          )}
          {!isLinked && (
            <Button variant="outline" size="sm" onClick={onSuggestCofid}>
              <Sparkles className="h-3 w-3 mr-1" />
              Link CofID
            </Button>
          )}
          {isLinked && (
            <Button variant="outline" size="sm" onClick={onUnlinkCofid}>
              <Unlink className="h-3 w-3 mr-1" />
              Unlink
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" />
            Edit
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
            onClick={onViewDetail}
            className="font-medium text-sm truncate hover:underline text-left block max-w-full"
          >
            {item.name}
          </button>
        </div>
        <div className="w-32 text-xs text-muted-foreground truncate">
          {aisle?.name || 'Unknown'}
        </div>
        <div className="w-24 text-xs text-muted-foreground truncate">
          {unit?.name || 'Unknown'}
        </div>
        <div className="w-20">
          <div className="flex flex-wrap gap-1">
            {item.needsReview && (
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
        <div className="w-32 flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={onViewDetail} title="View details">
            <Info className="h-3 w-3" />
          </Button>
          {item.needsReview && (
            <Button size="sm" variant="outline" onClick={onApprove}>
              <Check className="h-3 w-3 mr-1" />
              Approve
            </Button>
          )}
          {!isLinked && (
            <Button size="sm" variant="ghost" onClick={onSuggestCofid}>
              <Sparkles className="h-3 w-3" />
            </Button>
          )}
          {isLinked && (
            <Button size="sm" variant="ghost" onClick={onUnlinkCofid}>
              <Unlink className="h-3 w-3" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface CreateItemDialogProps {
  aisles: Aisle[];
  units: Unit[];
  onSubmit: (input: { name: string; aisleId: string; preferredUnitId: string }) => Promise<void>;
  onCancel: () => void;
}

const CreateItemDialog: React.FC<CreateItemDialogProps> = ({
  aisles,
  units,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [aisleId, setAisleId] = useState('');
  const [preferredUnitId, setPreferredUnitId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId || !preferredUnitId) {
      softToast.error('All fields are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: normalizedName, aisleId, preferredUnitId });
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
              <Label htmlFor="unit">Preferred Unit</Label>
              <Select
                value={preferredUnitId}
                onValueChange={setPreferredUnitId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
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

// ── Edit Item Dialog ──────────────────────────────────────────────────────────

interface EditItemDialogProps {
  item: CanonItem;
  aisles: Aisle[];
  units: Unit[];
  onSubmit: (
    updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId'>>
  ) => Promise<void>;
  onCancel: () => void;
}

const EditItemDialog: React.FC<EditItemDialogProps> = ({
  item,
  aisles,
  units,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(item.name);
  const [aisleId, setAisleId] = useState(item.aisleId);
  const [preferredUnitId, setPreferredUnitId] = useState(item.preferredUnitId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId || !preferredUnitId) {
      softToast.error('All fields are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: normalizedName, aisleId, preferredUnitId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Canon Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Item Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-aisle">Aisle</Label>
              <Select value={aisleId} onValueChange={setAisleId} disabled={isSubmitting}>
                <SelectTrigger id="edit-aisle">
                  <SelectValue />
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
              <Label htmlFor="edit-unit">Preferred Unit</Label>
              <Select
                value={preferredUnitId}
                onValueChange={setPreferredUnitId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="edit-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Item Detail Sheet ─────────────────────────────────────────────────────────

interface ItemDetailSheetProps {
  item: CanonItem;
  aisle?: Aisle;
  unit?: Unit;
  cofidDetail: any | null;
  isLoadingCofidDetail: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({
  item,
  aisle,
  unit,
  cofidDetail,
  isLoadingCofidDetail,
  open,
  onOpenChange,
}) => {
  const cofidSource = item.externalSources?.find(s => s.source === 'cofid');
  // Prefer live CoFID data (cofidDetail.nutrients) over stored snapshot.
  // Stored snapshot may be absent for items linked before the nutrition-at-link fix.
  const nutrition =
    (cofidDetail?.nutrients && typeof cofidDetail.nutrients === 'object' ? cofidDetail.nutrients : null)
    ?? (cofidSource?.properties && typeof cofidSource.properties === 'object'
        ? (cofidSource.properties as any).nutrition
        : null);

  // CoFID nutrient field names as stored in the database
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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>
            {item.needsReview ? 'Pending review' : 'Approved'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Core fields */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Item</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aisle</span>
                <span className="font-medium">{aisle?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferred unit</span>
                <span className="font-medium">{unit?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staple</span>
                <span>{item.isStaple ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                {item.needsReview
                  ? <Badge variant="outline" className="text-amber-600 border-amber-400">Needs review</Badge>
                  : <Badge variant="secondary">Approved</Badge>
                }
              </div>
            </div>
          </section>

          {/* CoFID link */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">CoFID Link</h3>
            {cofidSource ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CoFID ID</span>
                  <span className="font-mono text-xs">{cofidSource.externalId}</span>
                </div>
                {isLoadingCofidDetail && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Loading CoFID details…</span>
                  </div>
                )}
                {cofidDetail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CoFID name</span>
                    <span className="font-medium text-right max-w-[60%]">{cofidDetail.name ?? '—'}</span>
                  </div>
                )}
                {cofidSource.confidence != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Match confidence</span>
                    <span>{Math.round(cofidSource.confidence * 100)}%</span>
                  </div>
                )}
                {cofidSource.syncedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Synced</span>
                    <span className="text-xs">
                      {new Date(cofidSource.syncedAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No CoFID link — use the Sparkles button to suggest matches.</p>
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
      </SheetContent>
    </Sheet>
  );
};

// ── CofID Suggestions Dialog (PR5) ────────────────────────────────────────────

interface CofidSuggestionsDialogProps {
  item: CanonItem;
  aisles: Aisle[];
  suggestions: {
    bestMatch: SuggestedMatch | null;
    candidates: SuggestedMatch[];
  } | null;
  isLoading: boolean;
  onLink: (match: SuggestedMatch) => Promise<void>;
  onCancel: () => void;
}

const CofidSuggestionsDialog: React.FC<CofidSuggestionsDialogProps> = ({
  item,
  aisles,
  suggestions,
  isLoading,
  onLink,
  onCancel,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<SuggestedMatch | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [allCofidItems, setAllCofidItems] = useState<CofIDItem[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const aisleMap = new Map(aisles.map(a => [a.id, a.name]));

  // Auto-select best match on load
  useEffect(() => {
    if (suggestions?.bestMatch && !selectedMatch) {
      setSelectedMatch(suggestions.bestMatch);
    }
  }, [suggestions, selectedMatch]);

  // Load full CoFID collection once for direct search
  useEffect(() => {
    setIsLoadingAll(true);
    getCanonCofidItems()
      .then(items => setAllCofidItems(items as CofIDItem[]))
      .catch(() => {/* non-critical */})
      .finally(() => setIsLoadingAll(false));
  }, []);

  // Suggestion candidates filtered by search
  const filteredCandidates = useMemo(() => {
    if (!suggestions?.candidates) return [];
    if (!searchFilter.trim()) return suggestions.candidates;
    const lower = searchFilter.toLowerCase();
    return suggestions.candidates.filter(c => c.name.toLowerCase().includes(lower));
  }, [suggestions?.candidates, searchFilter]);

  // Full CoFID search results (only shown when search is active, excludes suggestion hits)
  const dbSearchResults = useMemo(() => {
    if (!searchFilter.trim() || searchFilter.trim().length < 2) return [];
    const lower = searchFilter.toLowerCase();
    const suggestionIds = new Set(suggestions?.candidates?.map(c => c.cofidId) ?? []);
    return allCofidItems
      .filter(c => c.name.toLowerCase().includes(lower) && !suggestionIds.has(c.id))
      .slice(0, 30);
  }, [allCofidItems, searchFilter, suggestions?.candidates]);

  // Convert a raw CofIDItem to the SuggestedMatch shape for onLink
  const cofidItemToMatch = (ci: CofIDItem): SuggestedMatch => ({
    cofidId: ci.id,
    name: ci.name,
    score: 1.0,
    method: 'exact',
    reason: 'Manual selection from CoFID database',
  });

  const hasSuggestions = (suggestions?.candidates?.length ?? 0) > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link CoFID Item: {item.name}</DialogTitle>
          <DialogDescription>
            Algorithm suggestions are shown first. Search to browse the full CoFID database.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-muted-foreground">Finding matches…</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search CoFID database by name…"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
                {isLoadingAll && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
                {/* Algorithm suggestions */}
                {filteredCandidates.length > 0 && (
                  <div className="space-y-1.5">
                    {searchFilter && <p className="text-xs font-medium text-muted-foreground px-1">Suggestions</p>}
                    {filteredCandidates.map((match, idx) => (
                      <CofidMatchButton
                        key={match.cofidId}
                        name={match.name}
                        cofidId={match.cofidId}
                        badge={idx === 0 && !searchFilter && suggestions?.bestMatch?.cofidId === match.cofidId
                          ? <Badge variant="default" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Best match</Badge>
                          : <Badge variant={match.method === 'exact' ? 'default' : 'secondary'} className="text-xs">{match.method}</Badge>
                        }
                        aisleBadge={match.aisleId ? (
                          <Badge variant="outline" className={match.aisleMatches ? 'text-xs text-green-600 border-green-400' : 'text-xs text-muted-foreground'}>
                            {aisleMap.get(match.aisleId) ?? match.aisleId}
                          </Badge>
                        ) : null}
                        sub={`${Math.round(match.score * 100)}% similarity`}
                        isSelected={selectedMatch?.cofidId === match.cofidId}
                        onSelect={() => setSelectedMatch(match)}
                      />
                    ))}
                  </div>
                )}

                {/* No suggestions but have search */}
                {filteredCandidates.length === 0 && hasSuggestions && searchFilter && (
                  <p className="text-xs text-muted-foreground px-1">No suggestions match — see database results below.</p>
                )}

                {/* No suggestions at all and no search */}
                {!hasSuggestions && !searchFilter && (
                  <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed rounded-lg">
                    <AlertCircle className="h-7 w-7 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No automatic matches found.</p>
                    <p className="text-xs text-muted-foreground mt-1">Type above to search the full CoFID database.</p>
                  </div>
                )}

                {/* Full database results */}
                {dbSearchResults.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground px-1">
                      CoFID database ({dbSearchResults.length}{dbSearchResults.length === 30 ? '+' : ''})
                    </p>
                    {dbSearchResults.map(ci => (
                      <CofidMatchButton
                        key={ci.id}
                        name={ci.name}
                        cofidId={ci.id}
                        badge={<Badge variant="outline" className="text-xs text-muted-foreground">Group {ci.group}</Badge>}
                        aisleBadge={null}
                        sub={ci.id}
                        isSelected={selectedMatch?.cofidId === ci.id}
                        onSelect={() => setSelectedMatch(cofidItemToMatch(ci))}
                      />
                    ))}
                  </div>
                )}

                {/* Search hint when results are empty */}
                {searchFilter.trim().length > 0 && searchFilter.trim().length < 2 && (
                  <p className="text-xs text-muted-foreground px-1">Type at least 2 characters to search the database.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => selectedMatch && onLink(selectedMatch)} disabled={!selectedMatch || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Selected Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


// ── CofidMatchButton ─────────────────────────────────────────────────────────

const CofidMatchButton: React.FC<{
  name: string;
  cofidId: string;
  badge: React.ReactNode;
  aisleBadge: React.ReactNode;
  sub: string;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ name, badge, aisleBadge, sub, isSelected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
    }`}
  >
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-medium text-sm">{name}</span>
      {badge}
      {aisleBadge}
    </div>
    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
  </button>
);
