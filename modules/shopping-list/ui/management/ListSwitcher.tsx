import React from 'react';
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { ShoppingList } from '../../../../types/contract';

interface ListSwitcherProps {
  lists: ShoppingList[];
  activeListId: string;
  onSelectList: (id: string) => void;
  onCreateList: () => void;
}

export const ListSwitcher: React.FC<ListSwitcherProps> = ({
  lists,
  activeListId,
  onSelectList,
  onCreateList,
}) => (
  <div className="flex items-center gap-2">
    <Select value={activeListId} onValueChange={onSelectList}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select list" />
      </SelectTrigger>
      <SelectContent>
        {lists.map((list) => (
          <SelectItem key={list.id} value={list.id}>
            {list.name}
            {list.isDefault && (
              <span className="ml-1 text-xs text-muted-foreground">(default)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button variant="ghost" size="icon" onClick={onCreateList} title="New list">
      <Plus className="h-4 w-4" />
    </Button>
  </div>
);
