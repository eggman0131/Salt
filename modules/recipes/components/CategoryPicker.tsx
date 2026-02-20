import React, { useState } from 'react';
import { RecipeCategory } from '../../../types/contract';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Search, X } from 'lucide-react';

interface CategoryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RecipeCategory[];
  selectedCategoryIds: string[];
  onToggle: (categoryId: string) => void;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  open,
  onOpenChange,
  categories,
  selectedCategoryIds,
  onToggle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (categoryId: string) => selectedCategoryIds.includes(categoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category Pills */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="flex flex-wrap gap-2">
              {filteredCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center w-full">
                  No categories found
                </p>
              ) : (
                filteredCategories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={isSelected(category.id) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/90 dark:hover:bg-primary/90"
                    onClick={() => onToggle(category.id)}
                  >
                    {category.name}
                    {isSelected(category.id) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Selected Count */}
          {selectedCategoryIds.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'category' : 'categories'} selected
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
