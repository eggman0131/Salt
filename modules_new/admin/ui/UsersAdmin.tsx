/**
 * Admin Module — Users Admin Tool
 *
 * Self-contained user management: add, edit, delete, avatar upload,
 * and drag-to-reorder. Fetches its own data via systemBackend.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Trash2, Pencil, GripVertical, Camera, Loader2 } from 'lucide-react';
import { ImageEditor } from '@/shared/components/ImageEditor';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { User, KitchenSettings } from '@/types/contract';
import { systemBackend } from '@/shared/backend/system-backend';
import { getKitchenSettings, updateKitchenSettings } from '../../planner/api';

// ── Sortable row ─────────────────────────────────────────────────────────────

interface SortableUserRowProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onEditAvatar: (user: User) => void;
}

const SortableUserRow: React.FC<SortableUserRowProps> = ({ user, onEdit, onDelete, onEditAvatar }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: user.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Avatar className="h-9 w-9">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
          {user.displayName[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{user.displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          onClick={() => onEditAvatar(user)}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-secondary/10 hover:text-secondary"
        >
          <Camera className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onEdit(user)}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onDelete(user)}
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

// ── Main component ────────────────────────────────────────────────────────────

export const UsersAdmin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<KitchenSettings>({ directives: '' });
  const [isLoading, setIsLoading] = useState(true);

  // Add form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Edit dialog
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Avatar dialog
  const [userToEditAvatar, setUserToEditAvatar] = useState<User | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    const [fetchedUsers, fetchedSettings] = await Promise.all([
      systemBackend.getUsers(),
      getKitchenSettings(),
    ]);
    setUsers(fetchedUsers);
    setSettings(fetchedSettings);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const orderedUsers = useMemo(() => {
    const { userOrder } = settings;
    if (!userOrder?.length) return [...users].sort((a, b) => a.displayName.localeCompare(b.displayName));

    const userMap = new Map(users.map(u => [u.id, u]));
    const ordered: User[] = [];
    const seen = new Set<string>();

    for (const id of userOrder) {
      const u = userMap.get(id);
      if (u) { ordered.push(u); seen.add(id); }
    }

    const remaining = users.filter(u => !seen.has(u.id)).sort((a, b) => a.displayName.localeCompare(b.displayName));
    return [...ordered, ...remaining];
  }, [users, settings.userOrder]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedUsers.findIndex(u => u.id === active.id);
    const newIndex = orderedUsers.findIndex(u => u.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedUsers, oldIndex, newIndex);
    const newOrder = reordered.map(u => u.id);
    const updated = { ...settings, userOrder: newOrder };
    setSettings(updated);
    await updateKitchenSettings(updated);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    await systemBackend.createUser({ displayName: name.trim(), email: email.trim() });
    setName('');
    setEmail('');
    await load();
  };

  const handleEditSave = async () => {
    if (!userToEdit || !editName.trim()) return;
    setIsSaving(true);
    try {
      await systemBackend.updateUser(userToEdit.id, { displayName: editName.trim() });
      setUserToEdit(null);
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await systemBackend.deleteUser(userToDelete.id);
      setUserToDelete(null);
      await load();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAvatarSave = async (imageData: string) => {
    if (!userToEditAvatar) return;
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await systemBackend.uploadUserAvatar(userToEditAvatar.id, imageData);
      await systemBackend.updateUser(userToEditAvatar.id, { avatarUrl });
      setUserToEditAvatar(null);
      await load();
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Authorised Users</CardTitle>
            <p className="text-sm text-muted-foreground">
              {users.length} {users.length === 1 ? 'user' : 'users'} with full access
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-4 md:p-6">
          {/* Add user form */}
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Full Name</Label>
                <Input
                  id="user-name"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email Address</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
            <AddButton type="submit" disabled={!name.trim() || !email.trim()} className="w-full" label="Add User" />
          </form>

          {/* User list */}
          {users.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">No users yet. Add someone above to grant access.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedUsers.map(u => u.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {orderedUsers.map(user => (
                    <SortableUserRow
                      key={user.id}
                      user={user}
                      onEdit={u => { setUserToEdit(u); setEditName(u.displayName); }}
                      onDelete={setUserToDelete}
                      onEditAvatar={setUserToEditAvatar}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Edit name dialog */}
      <Dialog open={!!userToEdit} onOpenChange={() => setUserToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the display name for {userToEdit?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && editName.trim()) handleEditSave(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToEdit(null)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={!editName.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User Access?</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete && (
                <><strong>{userToDelete.displayName}</strong> ({userToDelete.email}) will no longer have access to Salt.</>
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
              {isDeleting ? 'Removing...' : 'Remove User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avatar dialog */}
      <Dialog open={!!userToEditAvatar} onOpenChange={() => setUserToEditAvatar(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle>Edit Avatar</DialogTitle>
            <DialogDescription>Upload or edit avatar for {userToEditAvatar?.displayName}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ImageEditor
              initialImage={userToEditAvatar?.avatarUrl}
              onSave={handleAvatarSave}
              onCancel={() => setUserToEditAvatar(null)}
              width={250}
              height={250}
              isCircle
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
