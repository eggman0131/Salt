import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GripVertical, Trash2 } from 'lucide-react';
import { User } from '../../../types/contract';
import { systemBackend } from '../../../shared/backend/system-backend';

interface UsersModuleProps {
  users: User[];
  onRefresh: () => void;
}

export const UsersModule: React.FC<UsersModuleProps> = ({ users, onRefresh }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [activeConfirmId, setActiveConfirmId] = useState<string | null>(null);
  const [userOrder, setUserOrder] = useState<string[] | null>(null);

  // Auto-reset confirmation state after 3 seconds
  useEffect(() => {
    if (activeConfirmId) {
      const timer = setTimeout(() => setActiveConfirmId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeConfirmId]);

  // Load manual user order from backend or localStorage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await systemBackend.getKitchenSettings();
        if (mounted && settings?.userOrder && Array.isArray(settings.userOrder)) {
          setUserOrder(settings.userOrder as string[]);
          return;
        }
      } catch (e) {
        // Ignore backend errors and fall back to localStorage
      }

      try {
        const raw = localStorage.getItem('salt_user_order');
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed) && mounted) setUserOrder(parsed);
        }
      } catch (e) {
        console.error('Failed to load user order', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Persist order helper
  const persistOrder = (order: string[]) => {
    try {
      localStorage.setItem('salt_user_order', JSON.stringify(order));
      // Persist backend-wide as kitchen setting
      (async () => {
        try {
          const current = await systemBackend.getKitchenSettings();
          const merged = { ...current, userOrder: order } as any;
          await systemBackend.updateKitchenSettings(merged);
        } catch (e) {
          console.error('Failed to persist user order to backend', e);
        }
      })();
    } catch (e) {
      console.error('Failed to save user order', e);
    }
  };

  // Compute ordered users: follow userOrder then append any new users
  const orderedUsers = useMemo(() => {
    if (!userOrder || userOrder.length === 0) return users;
    const byId = new Map(users.map(u => [u.id, u] as [string, User]));
    const ordered: User[] = [];
    for (const id of userOrder) {
      const u = byId.get(id);
      if (u) {
        ordered.push(u);
        byId.delete(id);
      }
    }
    // Append any users not in stored order (newly added)
    for (const u of users) {
      if (byId.has(u.id)) ordered.push(u);
    }
    return ordered;
  }, [users, userOrder]);

  const resetOrder = () => {
    setUserOrder(null);
    try { 
      localStorage.removeItem('salt_user_order'); 
    } catch(e){}
  };

  // Drag & drop state and helpers
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const onHandleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const onHandleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const onItemDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverId !== id) setDragOverId(id);
  };

  const onItemDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === id) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const base = userOrder && userOrder.length ? [...userOrder] : users.map(u => u.id);
    // Ensure draggedId exists
    if (!base.includes(draggedId)) base.push(draggedId);
    const from = base.indexOf(draggedId);
    const to = base.indexOf(id);
    if (from === -1 || to === -1) return;
    base.splice(from, 1);
    base.splice(to, 0, draggedId);
    setUserOrder(base);
    persistOrder(base);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    await systemBackend.createUser({ displayName: name, email });
    setName('');
    setEmail('');
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (activeConfirmId === id) {
      await systemBackend.deleteUser(id);
      setActiveConfirmId(null);
      onRefresh();
    } else {
      setActiveConfirmId(id);
    }
  };

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Access Control</p>
            <CardTitle className="text-xl md:text-2xl">Authorised Users</CardTitle>
          </div>
          <Button
            onClick={resetOrder}
            variant="outline"
            size="sm"
          >
            Reset Order
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-6 overflow-hidden flex flex-col min-h-0">
        {/* User List - Scrollable */}
        <div className="flex-1 min-h-0 space-y-3 overflow-y-auto">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current Access List ({users.length})
          </Label>
          
          <div className="space-y-3">
            {orderedUsers.map((u) => (
              <div 
                key={u.id}
                onDragOver={(e) => onItemDragOver(e, u.id)}
                onDrop={(e) => onItemDrop(e, u.id)}
                className={`flex items-center gap-3 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors ${
                  dragOverId === u.id ? 'ring-2 ring-primary' : ''
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-foreground text-background font-semibold">
                    {u.displayName[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {u.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => onHandleDragStart(e, u.id)}
                    onDragEnd={onHandleDragEnd}
                  >
                    <GripVertical className="h-4 w-4" />
                  </Button>

                  {activeConfirmId === u.id ? (
                    <Button
                      onClick={() => handleDelete(u.id)}
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleDelete(u.id)}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="py-12 text-center border border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">
                  No authorised users found.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Add User Form - Fixed at Bottom */}
        <div className="pt-6 border-t space-y-4">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Full Name
                </Label>
                <Input 
                  id="user-name"
                  placeholder="e.g. John Doe" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <Input 
                  id="user-email"
                  type="email"
                  placeholder="john@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 flex gap-2 items-center text-xs text-primary bg-primary/10 p-3 rounded-lg border border-primary/20">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>Full read/write permissions for catalogue and schedule.</span>
              </div>
              <Button 
                type="submit" 
                disabled={!name || !email}
                className="w-full md:w-auto"
              >
                Grant Access
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </>
  );
};
