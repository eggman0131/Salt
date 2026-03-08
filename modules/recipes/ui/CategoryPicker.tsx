import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import type { RecipeCategory } from '@/types/contract';

interface CategoryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RecipeCategory[];
  selectedCategoryIds: string[];
  onToggle: (categoryId: string) => void;
}

export function CategoryPicker({
  open,
  onOpenChange,
  categories,
  selectedCategoryIds,
  onToggle,
}: CategoryPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Categories</DialogTitle>
          <DialogDescription>
            Choose categories for this recipe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ScrollArea className="h-75">
            <div className="flex flex-wrap gap-2">
              {filteredCategories.map(category => {
                const isSelected = selectedCategoryIds.includes(category.id);
                return (
                  <Badge
                    key={category.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => onToggle(category.id)}
                  >
                    {category.name}
                    {isSelected && <X className="ml-1 h-3 w-3" />}
                  </Badge>
                );
              })}
            </div>
          </ScrollArea>

          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
