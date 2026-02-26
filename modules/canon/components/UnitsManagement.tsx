import React, { useState, useEffect } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Pencil, GripVertical, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Unit } from '../../../types/contract';
import { canonBackend } from '../backend';
import { softToast } from '@/lib/soft-toast';

interface UnitsManagementProps {
  onRefresh: () => void;
}

interface SortableUnitItemProps {
  unit: Unit;
  onEdit: (unit: Unit) => void;
  onDelete: (unit: Unit) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

const SortableUnitItem: React.FC<SortableUnitItemProps> = ({ unit, onEdit, onDelete, isSelected, onToggleSelect }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
    >
      <Checkbox 
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(unit.id)}
        className="shrink-0"
      />
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1">
        <p className="font-medium text-sm">{unit.name}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          onClick={() => onEdit(unit)}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onDelete(unit)}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const UnitsManagement: React.FC<UnitsManagementProps> = ({ onRefresh }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [name, setName] = useState('');
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<Unit | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      const data = await canonBackend.getUnits();
      setUnits(data);
    } catch (err) {
      console.error('Failed to load units', err);
      softToast.error('Failed to load units');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = units.findIndex(u => u.id === active.id);
    const newIndex = units.findIndex(u => u.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(units, oldIndex, newIndex);
    
    // Update sortOrder for all units
    const updates = reordered.map((unit, index) => ({
      ...unit,
      sortOrder: index,
    }));

    setUnits(updates);

    // Save to backend
    try {
      for (const unit of updates) {
        await canonBackend.updateUnit(unit.id, { sortOrder: unit.sortOrder });
      }
      softToast.success('Unit order updated');
      onRefresh();
    } catch (err) {
      console.error('Failed to save unit order', err);
      softToast.error('Failed to update order');
      loadUnits(); // Reload to revert
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await canonBackend.createUnit({
        name: name.trim(),
        sortOrder: units.length,
      });
      setName('');
      await loadUnits();
      softToast.success('Unit added', { description: name.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to create unit', err);
      softToast.error('Failed to add unit');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!unitToDelete) return;
    
    setIsDeleting(true);
    try {
      await canonBackend.deleteUnit(unitToDelete.id);
      await loadUnits();
      softToast.success('Unit deleted', { description: unitToDelete.name });
      onRefresh();
    } catch (err) {
      console.error('Failed to delete unit', err);
      softToast.error('Failed to delete unit');
    } finally {
      setIsDeleting(false);
      setUnitToDelete(null);
    }
  };

  const handleEditClick = (unit: Unit) => {
    setUnitToEdit(unit);
    setEditName(unit.name);
  };

  const handleEditSave = async () => {
    if (!unitToEdit || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      await canonBackend.updateUnit(unitToEdit.id, { name: editName.trim() });
      await loadUnits();
      setUnitToEdit(null);
      setEditName('');
      softToast.success('Unit updated', { description: editName.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to update unit', err);
      softToast.error('Failed to update unit');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredUnits.map(u => u.id)));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(idsToDelete.map(id => canonBackend.deleteUnit(id)));
      await loadUnits();
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      softToast.success(`Deleted ${idsToDelete.length} unit${idsToDelete.length === 1 ? '' : 's'}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to bulk delete units', err);
      softToast.error('Failed to delete units');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const filteredUnits = units.filter(unit =>
    filterText === '' || unit.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <>
      <CardHeader>
        <div className="space-y-1">

          <CardTitle className="text-xl md:text-2xl">Units</CardTitle>
          <p className="text-sm text-muted-foreground">
            {units.length} measurement {units.length === 1 ? 'unit' : 'units'}
            {filterText && ` (${filteredUnits.length} filtered)`}
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col space-y-3 h-full px-0 md:px-6">
        {/* Filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filter units..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selection Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectNone}
              >
                Clear
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}

        {/* Select All/None */}
        {filteredUnits.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectNone}
              className="text-xs"
            >
              Select None
            </Button>
          </div>
        )}

        {/* Add Unit Form */}
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="unit-name">Unit Name</Label>
              <Input 
                id="unit-name"
                placeholder="e.g. g, kg, ml, l"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                disabled={isAdding}
              />
            </div>
            <div className="self-end">
              <AddButton
                type="submit"
                disabled={!name.trim() || isAdding}
                label="Add"
              />
            </div>
          </div>
        </form>

        {/* Unit List */}
        <div className="flex-1 min-h-0">
          {filteredUnits.length === 0 ? (
          <div className="py-12 text-center border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">
              {units.length === 0 ? 'No units yet. Add measurement units above.' : 'No units match your filter.'}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredUnits.map(u => u.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {filteredUnits.map((unit) => (
                  <SortableUnitItem
                    key={unit.id}
                    unit={unit}
                    onEdit={handleEditClick}
                    onDelete={setUnitToDelete}
                    isSelected={selectedIds.has(unit.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
            )}
        </div>

        {/* Edit Unit Dialog */}
        <Dialog open={!!unitToEdit} onOpenChange={() => setUnitToEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Unit</DialogTitle>
              <DialogDescription>
                Update the unit name
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Unit Name</Label>
                <Input 
                  id="edit-name"
                  placeholder="e.g. g, kg, ml, l" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      handleEditSave();
                    }
                  }}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUnitToEdit(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={!editName.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!unitToDelete} onOpenChange={() => setUnitToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Unit?</AlertDialogTitle>
              <AlertDialogDescription>
                {unitToDelete && (
                  <>
                    Are you sure you want to delete <strong>{unitToDelete.name}</strong>? 
                    This action cannot be undone and may affect items using this unit.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Unit'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} Unit{selectedIds.size === 1 ? '' : 's'}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedIds.size} unit{selectedIds.size === 1 ? '' : 's'}? 
                This action cannot be undone and may affect items using these units.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Unit${selectedIds.size === 1 ? '' : 's'}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </>
  );
};
