import React, { useState, useMemo } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { UserPlus, Trash2, Pencil, GripVertical } from 'lucide-react';
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
import { User, KitchenSettings } from '../../../types/contract';
import { systemBackend } from '../../../shared/backend/system-backend';

interface UsersModuleProps {
  users: User[];
  kitchenSettings: KitchenSettings;
  onRefresh: () => void;
  onSettingsChange: (settings: KitchenSettings) => void;
}

interface SortableUserItemProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

const SortableUserItem: React.FC<SortableUserItemProps> = ({ user, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: user.id });

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

      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
          {user.displayName[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {user.displayName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {user.email}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
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

export const UsersModule: React.FC<UsersModuleProps> = ({ 
  users, 
  kitchenSettings,
  onRefresh,
  onSettingsChange 
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Apply custom order if available, otherwise sort alphabetically
  const orderedUsers = useMemo(() => {
    const { userOrder } = kitchenSettings;
    
    if (!userOrder || userOrder.length === 0) {
      // No custom order - sort alphabetically
      return [...users].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    // Apply custom order, placing any new users at the end
    const userMap = new Map(users.map(u => [u.id, u]));
    const ordered: User[] = [];
    const seen = new Set<string>();

    // Add users in custom order
    for (const id of userOrder) {
      const user = userMap.get(id);
      if (user) {
        ordered.push(user);
        seen.add(id);
      }
    }

    // Add any new users not in the custom order (alphabetically)
    const newUsers = users.filter(u => !seen.has(u.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    return [...ordered, ...newUsers];
  }, [users, kitchenSettings.userOrder]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = orderedUsers.findIndex(u => u.id === active.id);
    const newIndex = orderedUsers.findIndex(u => u.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedUsers, oldIndex, newIndex);
    const newOrder = reordered.map(u => u.id);

    // Save to backend
    try {
      const updatedSettings = {
        ...kitchenSettings,
        userOrder: newOrder,
      };
      await systemBackend.updateKitchenSettings(updatedSettings);
      onSettingsChange(updatedSettings);
    } catch (err) {
      console.error('Failed to save user order', err);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    
    try {
      await systemBackend.createUser({ displayName: name.trim(), email: email.trim() });
      setName('');
      setEmail('');
      onRefresh();
    } catch (err) {
      console.error('Failed to create user', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    try {
      await systemBackend.deleteUser(userToDelete.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete user', err);
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  const handleEditClick = (user: User) => {
    setUserToEdit(user);
    setEditName(user.displayName);
  };

  const handleEditSave = async () => {
    if (!userToEdit || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      await systemBackend.updateUser(userToEdit.id, { displayName: editName.trim() });
      onRefresh();
      setUserToEdit(null);
      setEditName('');
    } catch (err) {
      console.error('Failed to update user', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="text-xl md:text-2xl">Authorised Users</CardTitle>
          <p className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? 'user' : 'users'} with full access
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add User Form */}
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full Name</Label>
              <Input 
                id="user-name"
                className="pl-3"
                placeholder="e.g. John Doe" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email Address</Label>
              <Input 
                id="user-email"
                type="email"
                className="pl-3"
                placeholder="john@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            disabled={!name.trim() || !email.trim()}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </form>

        {/* User List */}
        {users.length === 0 ? (
          <div className="py-12 text-center border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">
              No users yet. Add someone above to grant access.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedUsers.map(u => u.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {orderedUsers.map((user) => (
                  <SortableUserItem
                    key={user.id}
                    user={user}
                    onEdit={handleEditClick}
                    onDelete={setUserToDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Edit User Dialog */}
        <Dialog open={!!userToEdit} onOpenChange={() => setUserToEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update the display name for {userToEdit?.email}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Display Name</Label>
                <Input 
                  id="edit-name"
                  className="pl-3"
                  placeholder="Full Name" 
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
                onClick={() => setUserToEdit(null)}
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
        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove User Access?</AlertDialogTitle>
              <AlertDialogDescription>
                {userToDelete && (
                  <>
                    <strong>{userToDelete.displayName}</strong> ({userToDelete.email}) will no longer 
                    have access to Salt. This action cannot be undone.
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
                {isDeleting ? 'Removing...' : 'Remove User'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </>
  );
};
