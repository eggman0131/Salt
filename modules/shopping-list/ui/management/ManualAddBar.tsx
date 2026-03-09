import React, { useState, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { softToast } from '@/lib/soft-toast';
import { auth } from '../../../../shared/backend/firebase';
import {
  createUnmatchedItem,
  tryMatchManualItem,
} from '../../api';
import type { ShoppingListContribution } from '../../types';

interface ManualAddBarProps {
  listId: string;
  onAdded: () => void;
}

export const ManualAddBar: React.FC<ManualAddBarProps> = ({ listId, onAdded }) => {
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = value.trim();
      if (!text) return;

      setIsAdding(true);
      try {
        const userId = auth.currentUser?.uid ?? 'system';
        const contribution: ShoppingListContribution = {
          sourceType: 'manual',
          rawText: text,
          addedBy: userId,
          addedAt: new Date().toISOString(),
        };

        const itemId = await createUnmatchedItem(listId, contribution, text);
        setValue('');
        onAdded();

        // Non-blocking canon match runs after UI updates
        tryMatchManualItem(listId, itemId, text).then(() => {
          onAdded(); // Refresh again if matched
        });
      } catch {
        softToast.error('Failed to add item');
      } finally {
        setIsAdding(false);
      }
    },
    [value, listId, onAdded]
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Add item (e.g. olive oil, dishwasher tablets…)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isAdding}
        className="flex-1"
      />
      <Button type="submit" disabled={isAdding || !value.trim()}>
        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        <span className="hidden sm:inline ml-2">Add</span>
      </Button>
    </form>
  );
};
