import React, { useState } from 'react';
import { ShoppingList } from '../../../types/contract';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddButton } from '@/components/ui/add-button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Edit2, Trash2, ShoppingCart, Loader2, ChevronRight } from 'lucide-react';

interface ShoppingListsViewProps {
  lists: ShoppingList[];
  onSelectList: (id: string) => void;
  onCreateList: (name: string) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
  onUpdateList: (id: string, updates: Partial<ShoppingList>) => Promise<void>;
}

export const ShoppingListsView: React.FC<ShoppingListsViewProps> = ({
  lists,
  onSelectList,
  onCreateList,
  onDeleteList,
  onUpdateList,
}) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<ShoppingList | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ShoppingList | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await onCreateList(newName.trim());
      setNewName('');
      setCreateOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setIsRenaming(true);
    try {
      await onUpdateList(renameTarget.id, { name: renameValue.trim() });
      setRenameTarget(null);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteList(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Shopping Lists</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lists.length} {lists.length === 1 ? 'list' : 'lists'}
          </p>
        </div>
        <AddButton onClick={() => setCreateOpen(true)} label="New List" />
      </div>

      {/* Empty state */}
      {lists.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg">
          <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No shopping lists yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first list to get started</p>
          <AddButton onClick={() => setCreateOpen(true)} variant="outline" label="New List" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map(list => (
            <Card
              key={list.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="p-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{list.name}</CardTitle>
                  {list.isDefault && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      Default
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {/* Actions */}
                <div className="flex gap-2">
                  {/* Open - Primary action */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 md:flex-1 md:h-8 md:w-auto text-primary hover:bg-primary/10"
                    onClick={() => onSelectList(list.id)}
                    title="Open list"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="hidden md:inline ml-2">Open</span>
                  </Button>
                  
                  {/* Rename */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 md:h-8 md:w-auto"
                    onClick={() => {
                      setRenameTarget(list);
                      setRenameValue(list.name);
                    }}
                    title="Rename list"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span className="hidden md:inline ml-2">Rename</span>
                  </Button>
                  
                  {/* Delete */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 md:h-8 md:w-auto text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(list)}
                    title="Delete list"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden md:inline ml-2">Delete</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Shopping List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="e.g. Weekly Shop"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !newName.trim()}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleRename} disabled={isRenaming || !renameValue.trim()}>
                {isRenaming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo; and all its items? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
