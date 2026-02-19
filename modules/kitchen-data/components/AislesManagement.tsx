import React, { useState, useEffect } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Trash2, Pencil, GripVertical } from 'lucide-react';
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
import { Aisle } from '../../../types/contract';
import { kitchenDataBackend } from '../backend';
import { toast } from 'sonner';

interface AislesManagementProps {
  onRefresh: () => void;
}

interface SortableAisleItemProps {
  aisle: Aisle;
  onEdit: (aisle: Aisle) => void;
  onDelete: (aisle: Aisle) => void;
}

const SortableAisleItem: React.FC<SortableAisleItemProps> = ({ aisle, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: aisle.id });

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
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1">
        <p className="font-medium text-sm">{aisle.name}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          onClick={() => onEdit(aisle)}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onDelete(aisle)}
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

export const AislesManagement: React.FC<AislesManagementProps> = ({ onRefresh }) => {
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [name, setName] = useState('');
  const [aisleToDelete, setAisleToDelete] = useState<Aisle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aisleToEdit, setAisleToEdit] = useState<Aisle | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadAisles();
  }, []);

  const loadAisles = async () => {
    try {
      const data = await kitchenDataBackend.getAisles();
      setAisles(data);
    } catch (err) {
      console.error('Failed to load aisles', err);
      toast.error('Failed to load aisles');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = aisles.findIndex(a => a.id === active.id);
    const newIndex = aisles.findIndex(a => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(aisles, oldIndex, newIndex);
    
    // Update sortOrder for all aisles
    const updates = reordered.map((aisle, index) => ({
      ...aisle,
      sortOrder: index,
    }));

    setAisles(updates);

    // Save to backend
    try {
      for (const aisle of updates) {
        await kitchenDataBackend.updateAisle(aisle.id, { sortOrder: aisle.sortOrder });
      }
      toast.success('Aisle order updated');
      onRefresh();
    } catch (err) {
      console.error('Failed to save aisle order', err);
      toast.error('Failed to update order');
      loadAisles(); // Reload to revert
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await kitchenDataBackend.createAisle({
        name: name.trim(),
        sortOrder: aisles.length,
      });
      setName('');
      await loadAisles();
      toast.success('Aisle added', { description: name.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to create aisle', err);
      toast.error('Failed to add aisle');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!aisleToDelete) return;
    
    setIsDeleting(true);
    try {
      await kitchenDataBackend.deleteAisle(aisleToDelete.id);
      await loadAisles();
      toast.success('Aisle deleted', { description: aisleToDelete.name });
      onRefresh();
    } catch (err) {
      console.error('Failed to delete aisle', err);
      toast.error('Failed to delete aisle');
    } finally {
      setIsDeleting(false);
      setAisleToDelete(null);
    }
  };

  const handleEditClick = (aisle: Aisle) => {
    setAisleToEdit(aisle);
    setEditName(aisle.name);
  };

  const handleEditSave = async () => {
    if (!aisleToEdit || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      await kitchenDataBackend.updateAisle(aisleToEdit.id, { name: editName.trim() });
      await loadAisles();
      setAisleToEdit(null);
      setEditName('');
      toast.success('Aisle updated', { description: editName.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to update aisle', err);
      toast.error('Failed to update aisle');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <CardHeader>
        <div className="space-y-1">

          <CardTitle className="text-xl md:text-2xl">Aisles</CardTitle>
          <p className="text-sm text-muted-foreground">
            {aisles.length} shop {aisles.length === 1 ? 'aisle' : 'aisles'}
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col space-y-3 h-full px-0 md:px-6">
        {/* Add Aisle Form */}
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="aisle-name">Aisle Name</Label>
              <Input 
                id="aisle-name"
                placeholder="e.g. Produce, Dairy, Bakery"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                disabled={isAdding}
              />
            </div>
            <div className="self-end">
              <Button 
                type="submit" 
                disabled={!name.trim() || isAdding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Aisle
              </Button>
            </div>
          </div>
        </form>

        {/* Aisle List */}
        <div className="flex-1 min-h-0">
          {aisles.length === 0 ? (
          <div className="py-12 text-center border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">
              No aisles yet. Add shop aisles above.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={aisles.map(a => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {aisles.map((aisle) => (
                  <SortableAisleItem
                    key={aisle.id}
                    aisle={aisle}
                    onEdit={handleEditClick}
                    onDelete={setAisleToDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
            )}
        </div>

        {/* Edit Aisle Dialog */}
        <Dialog open={!!aisleToEdit} onOpenChange={() => setAisleToEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Aisle</DialogTitle>
              <DialogDescription>
                Update the aisle name
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Aisle Name</Label>
                <Input 
                  id="edit-name"
                  placeholder="e.g. Produce, Dairy, Bakery" 
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
                onClick={() => setAisleToEdit(null)}
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
        <AlertDialog open={!!aisleToDelete} onOpenChange={() => setAisleToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Aisle?</AlertDialogTitle>
              <AlertDialogDescription>
                {aisleToDelete && (
                  <>
                    Are you sure you want to delete <strong>{aisleToDelete.name}</strong>? 
                    This action cannot be undone and may affect items in this aisle.
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
                {isDeleting ? 'Deleting...' : 'Delete Aisle'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </>
  );
};
