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
  deleteAllItems,
  sortItems,
  filterItemsNeedingReview,
  normalizeItemName,
  suggestCofidMatch,
  linkCofidMatch,
  unlinkCofidMatch,
  buildCofidMatch,
  getCofidItemById,
  type CanonItem,
  type SuggestedMatch,
} from '../api';
import type { Aisle, Unit } from '../../../../types/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Check, Pencil, AlertCircle, Link, Unlink, Sparkles, Trash2, CheckSquare } from 'lucide-react';
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
import { toast } from 'sonner';
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
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [inlineEditing, setInlineEditing] = useState<string | null>(null);
  const [showCofidDialog, setShowCofidDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
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
  const displayItems = filterNeedsReview ? filterItemsNeedingReview(items) : items;
  const filteredDisplayItems = useMemo(() => {
    if (!searchTerm.trim()) return displayItems;
    const lower = searchTerm.toLowerCase();
    return displayItems.filter(item =>
      item.name.toLowerCase().includes(lower) ||
      item.normalisedName.toLowerCase().includes(lower)
    );
  }, [displayItems, searchTerm]);
  const sortedItems = sortItems(filteredDisplayItems);
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
      toast.success('Item created successfully');
      await loadData();
      setShowCreateDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item');
    }
  };

  const handleEdit = async (
    id: string,
    updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId'>>
  ) => {
    try {
      await editCanonItem(id, updates);
      toast.success('Item updated successfully');
      await loadData();
      setShowEditDialog(false);
      setCurrentItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveItem(id);
      toast.success('Item approved');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve item');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }
    try {
      await Promise.all(Array.from(selectedItems).map(id => approveItem(id)));
      toast.success(`Approved ${selectedItems.size} items`);
      setSelectedItems(new Set());
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve items');
    }
  };

  const handleBulkAssignAisle = async (aisleId: string) => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
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
      toast.success(`Assigned ${selectedItems.size} items to aisle`);
      setSelectedItems(new Set());
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign aisle');
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
      toast.error(err instanceof Error ? err.message : 'Failed to suggest CofID matches');
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
      toast.success(`Linked to ${match.name}`);
      await loadData();
      setShowCofidDialog(false);
      setCofidSuggestions(null);
      setCurrentItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link CofID match');
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleUnlinkCofid = async (item: CanonItem) => {
    try {
      await unlinkCofidMatch(item.id);
      toast.success('CofID link removed');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink CofID');
    }
  };

  const handleDelete = async () => {
    if (!currentItem) return;
    try {
      await deleteItem(currentItem.id);
      toast.success('Item deleted');
      setShowDeleteDialog(false);
      setCurrentItem(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllItems();
      toast.success('All items deleted');
      setShowDeleteAllDialog(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete all items');
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
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateDialog(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
            <Button
              onClick={() => setShowDeleteAllDialog(true)}
              variant="destructive"
              size="lg"
              disabled={items.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          </div>
        </div>
      </Section>

      {/* Filter & Stats Section */}
      <Section spacing="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{items.length} total</Badge>
            {needsReviewCount > 0 && (
              <Badge variant="destructive">{needsReviewCount} pending</Badge>
            )}
            {selectedItems.size > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20">{selectedItems.size} selected</Badge>
            )}
          </div>
          <Button
            variant={filterNeedsReview ? 'default' : 'outline'}
            onClick={() => setFilterNeedsReview(!filterNeedsReview)}
            disabled={needsReviewCount === 0}
            size="sm"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            {filterNeedsReview ? 'All Items' : 'Review Queue'}
          </Button>
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
            Found {sortedItems.length} of {filterNeedsReview ? needsReviewCount : items.length} items
          </p>
        )}
      </Section>

      {/* Bulk Actions Section (visible when items selected) */}
      {selectedItems.size > 0 && (
        <Section className="rounded-md border border-primary/20 bg-primary/5 p-4" spacing="space-y-3">
          <p className="text-sm font-medium">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {filterNeedsReview && (
              <Button
                variant="default"
                size="sm"
                onClick={handleBulkApprove}
              >
                <Check className="h-4 w-4 mr-2" />
                Approve Selected
              </Button>
            )}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedItems(new Set())}
            >
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
            <p className="text-muted-foreground font-medium">
              {filterNeedsReview ? 'No items need review' : 'No canon items yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterNeedsReview
                ? 'All items have been reviewed and approved'
                : 'Create an item to get started'}
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
          onSubmit={async (updates) => {
            await handleEdit(currentItem.id, updates);
            await handleApprove(currentItem.id);
          }}
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

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Canon Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>all {items.length} canon items</strong>?
              <br /><br />
              This is a destructive operation that cannot be undone. All recipes with canon item references will have orphaned links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      toast.error('All fields are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: normalizedName, aisleId, preferredUnitId });
      toast.success('Item approved successfully');
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
  onEdit,
  onApprove,
  onSuggestCofid,
  onUnlinkCofid,
  onDelete,
}) => {
  return (
    <div className="border-b last:border-b-0">
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
              <h3 className="font-semibold text-sm truncate">{item.name}</h3>
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
          <p className="font-medium text-sm truncate">{item.name}</p>
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
      toast.error('All fields are required');
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
      toast.error('All fields are required');
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

// ── CofID Suggestions Dialog (PR5) ────────────────────────────────────────────

interface CofidSuggestionsDialogProps {
  item: CanonItem;
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
  suggestions,
  isLoading,
  onLink,
  onCancel,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<SuggestedMatch | null>(null);

  // Auto-select best match on load
  useEffect(() => {
    if (suggestions?.bestMatch && !selectedMatch) {
      setSelectedMatch(suggestions.bestMatch);
    }
  }, [suggestions, selectedMatch]);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link CofID Item: {item.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-muted-foreground">Finding matches...</span>
            </div>
          ) : suggestions && suggestions.candidates.length > 0 ? (
            <div className="space-y-4">
              <div>
                <Label>Select a CofID item to link:</Label>
                <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                  {suggestions.candidates.map((match, idx) => (
                    <button
                      key={match.cofidId}
                      onClick={() => setSelectedMatch(match)}
                      className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                        selectedMatch?.cofidId === match.cofidId
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{match.name}</span>
                            {idx === 0 && suggestions.bestMatch?.cofidId === match.cofidId && (
                              <Badge variant="default" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Best Match
                              </Badge>
                            )}
                            <Badge
                              variant={match.method === 'exact' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {match.method}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Score: {Math.round(match.score * 100)}% • {match.reason}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                No CofID matches found for "{item.name}"
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting the aisle or item name
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedMatch && onLink(selectedMatch)}
            disabled={!selectedMatch || isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Selected Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

