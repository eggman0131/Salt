/**
 * Canon Items Admin — Full CRUD interface
 *
 * Administrative tools for managing canonical items:
 * - List all items with filtering
 * - Create new items
 * - Edit existing items
 * - Approve items from review queue
 *
 * All data flows through api.ts only — no direct imports from logic or data.
 */

import React, { useEffect, useState } from 'react';
import {
  getCanonItems,
  getCanonAisles,
  getCanonUnits,
  addCanonItem,
  editCanonItem,
  approveItem,
  sortItems,
  filterItemsNeedingReview,
  normalizeItemName,
  type CanonItem,
} from '../../api';
import type { Aisle, Unit } from '../../../../types/contract';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Check, Pencil, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ── Main Component ────────────────────────────────────────────────────────────

export const CanonItemsAdmin: React.FC = () => {
  const [items, setItems] = useState<CanonItem[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<CanonItem | null>(null);
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);

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
  }, []);

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Canon Items</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Canon Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const displayItems = filterNeedsReview
    ? filterItemsNeedingReview(items)
    : items;
  const sortedItems = sortItems(displayItems);
  const needsReviewCount = filterItemsNeedingReview(items).length;

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Canon Items</CardTitle>
              <Badge variant="secondary">{items.length}</Badge>
              {needsReviewCount > 0 && (
                <Badge variant="destructive">{needsReviewCount} need review</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterNeedsReview ? 'default' : 'outline'}
                onClick={() => setFilterNeedsReview(!filterNeedsReview)}
                disabled={needsReviewCount === 0}
              >
                <AlertCircle className="h-4 w-4 mr-1" />
                Review Queue
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
              <p className="text-muted-foreground">
                {filterNeedsReview
                  ? 'No items need review'
                  : 'No items yet. Create one to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedItems.map(item => {
                const aisle = aisles.find(a => a.id === item.aisleId);
                const unit = units.find(u => u.id === item.preferredUnitId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 rounded-md border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {item.needsReview && (
                          <Badge variant="outline" className="text-xs">
                            Needs Review
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {aisle?.name || 'Unknown aisle'} • {unit?.name || 'Unknown unit'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.needsReview && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(item.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCurrentItem(item);
                          setShowEditDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
};

// ── Create Item Dialog ────────────────────────────────────────────────────────

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
