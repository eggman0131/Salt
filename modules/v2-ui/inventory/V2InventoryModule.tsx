import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { Badge } from '../design-system/components/Badge';
import { ScrollArea } from '../design-system/components/ScrollArea';
import { ViewToolbar, SortOption, FilterOption } from '../design-system/components/ViewToolbar';
import { Plus, Settings2, Trash2, Box } from 'lucide-react';
import { Equipment } from '../../../types/contract';
import { AddEquipmentFlow } from './components/AddEquipmentFlow';
import { EditEquipmentSheet } from './components/EditEquipmentSheet';
import { deleteEquipment } from '../../inventory/api';
import { softToast } from '@/lib/soft-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../design-system/components/Dialog';
import { Loader2 } from 'lucide-react';

interface V2InventoryModuleProps {
  inventory: Equipment[];
  onRefresh: () => Promise<void>;
}

export const V2InventoryModule: React.FC<V2InventoryModuleProps> = ({ inventory, onRefresh }) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<Equipment | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ViewToolbar State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('name-asc');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const confirmDelete = async () => {
    if (!equipmentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteEquipment(equipmentToDelete.id);
      await onRefresh();
      softToast.success('Equipment deleted', { description: equipmentToDelete.name });
    } catch (err) {
      console.error('Failed to delete', err);
      softToast.error('Failed to delete equipment');
    } finally {
      setIsDeleting(false);
      setEquipmentToDelete(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'default';
      case 'In Use': return 'secondary';
      case 'Maintenance': return 'destructive';
      default: return 'outline';
    }
  };

  // Configure Sort and Filter Options
  const sortOptions: SortOption[] = [
    { id: 'name-asc', label: 'Name (A-Z)' },
    { id: 'name-desc', label: 'Name (Z-A)' },
    { id: 'class-asc', label: 'Class Type' },
  ];

  const filterOptions: FilterOption[] = [
    { id: 'available', label: 'Available Only' },
    { id: 'in-use', label: 'Currently in Use' },
    { id: 'maintenance', label: 'Needs Maintenance' },
    { id: 'large-appliance', label: 'Large Appliances' },
    { id: 'small-appliance', label: 'Small Appliances' },
    { id: 'tool', label: 'Tools & Gadgets' },
  ];

  // Derive final filtered/sorted inventory
  const processedInventory = useMemo(() => {
    let result = [...inventory];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.brand?.toLowerCase().includes(q) ||
        item.type?.toLowerCase().includes(q)
      );
    }

    // 2. Filter Status/Class
    if (activeFilters.length > 0) {
      result = result.filter(item => {
        return activeFilters.every((filterId: string) => {
          if (filterId === 'available') return item.status === 'Available';
          if (filterId === 'in-use') return item.status === 'In Use';
          if (filterId === 'maintenance') return item.status === 'Maintenance';
          if (filterId === 'large-appliance') return item.class === 'Large Appliance';
          if (filterId === 'small-appliance') return item.class === 'Small Appliance';
          if (filterId === 'tool') return item.class === 'Tool';
          return true;
        });
      });
    }

    // 3. Sorting
    result.sort((a, b) => {
      switch (activeSort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'class-asc':
          return (a.class || '').localeCompare(b.class || '');
        default:
          return 0;
      }
    });

    return result;
  }, [inventory, searchQuery, activeSort, activeFilters]);

  return (
    <div className="p-4 md:p-8 flex flex-col h-full max-w-[1600px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2 xl:mb-0">
        <div className="mb-2 xl:mb-6 shrink-0">
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-br from-[var(--color-v2-foreground)] to-[var(--color-v2-muted-foreground)] bg-clip-text text-transparent">
            Inventory
          </h1>
          <p className="text-[var(--color-v2-muted-foreground)] mt-1 font-medium">
            {processedInventory.length} items found
          </p>
        </div>

        <div className="w-full xl:w-auto flex-1 max-w-full xl:max-w-none">
          <ViewToolbar 
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search equipment..."
        sortOptions={sortOptions}
        activeSortOption={activeSort}
        onSortChange={setActiveSort}
        filterOptions={filterOptions}
        activeFilterOptions={activeFilters}
        onFilterToggle={(id: string) => {
          setActiveFilters(prev => 
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
          );
        }}
        onClearFilters={() => setActiveFilters([])}
        primaryAction={{
          icon: <Plus className="h-4 w-4" />,
          label: "Add Item",
          onClick: () => setShowAddDialog(true)
        }}
      />
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {processedInventory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-v2-border)] rounded-[var(--radius-v2-2xl)] bg-[var(--color-v2-card)]/30 backdrop-blur-sm p-8 text-center">
            <div className="p-5 rounded-full bg-[var(--color-v2-secondary)] mb-4 text-[var(--color-v2-muted-foreground)] shadow-inner">
              <Box className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold mb-2">No equipment found</h3>
            <p className="text-[var(--color-v2-muted-foreground)] mb-6 max-w-sm">
              We couldn't find any equipment matching your current search or filters.
            </p>
            {(searchQuery || activeFilters.length > 0) && (
              <Button 
                onClick={() => { setSearchQuery(''); setActiveFilters([]); }} 
                variant="outline"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full pr-4 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 pb-8">
              {processedInventory.map((item) => (
                <Card key={item.id} glass className="group relative overflow-hidden flex flex-col hover:-translate-y-2 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[var(--color-v2-primary)]/20 transition-all duration-500 will-change-transform min-h-[180px]">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-v2-primary)]/10 via-transparent to-[var(--color-v2-accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <CardHeader className="pb-3 border-b border-[var(--color-v2-border)]/50 bg-[var(--color-v2-secondary)]/20 backdrop-blur-md z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-bold line-clamp-2 leading-tight">{item.name}</CardTitle>
                        <CardDescription className="text-xs uppercase tracking-widest font-medium text-[var(--color-v2-primary)]">{item.brand} {item.modelName}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-4 pb-16 flex-1 space-y-4 text-sm relative z-10 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex gap-2 text-[var(--color-v2-muted-foreground)]">
                        <Badge variant={getStatusColor(item.status) as any} className="shrink-0 rounded-full shadow-sm">{item.status}</Badge>
                        <Badge variant="outline" className="bg-[var(--color-v2-background)]/50 border-[var(--color-v2-border)]/50 backdrop-blur-sm">{item.type || 'N/A'}</Badge>
                      </div>
                      
                      {item.description && (
                        <p className="text-[var(--color-v2-foreground)]/80 text-sm leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    
                    {item.accessories && item.accessories.length > 0 && (
                      <div className="pt-3 mt-auto">
                        <div className="flex items-center gap-2">
                           <div className="h-1 flex-1 bg-[var(--color-v2-secondary)] rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-gradient-to-r from-[var(--color-v2-primary)] to-[var(--color-v2-accent)]" 
                               style={{ width: `${(item.accessories.filter(a => a.owned).length / item.accessories.length) * 100}%` }}
                             />
                           </div>
                           <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-v2-muted-foreground)] whitespace-nowrap">
                             {item.accessories.filter(a => a.owned).length}/{item.accessories.length} Acc
                           </span>
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <div className="absolute right-4 bottom-4 flex items-center gap-2 opacity-100 translate-y-0 xl:opacity-0 xl:translate-y-4 xl:group-hover:opacity-100 xl:group-hover:translate-y-0 transition-all duration-300 z-20">
                    <Button variant="secondary" size="icon" onClick={(e) => { e.stopPropagation(); setEquipmentToEdit(item); }} className="h-10 w-10 rounded-full shadow-xl hover:bg-[var(--color-v2-primary)] hover:text-white transition-colors">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={(e) => { e.stopPropagation(); setEquipmentToDelete(item); }} className="h-10 w-10 rounded-full shadow-xl">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <AddEquipmentFlow 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        onRefresh={onRefresh} 
      />
      
      {equipmentToEdit && (
        <EditEquipmentSheet 
          equipment={equipmentToEdit} 
          onOpenChange={(open) => !open && setEquipmentToEdit(null)} 
          onRefresh={onRefresh} 
        />
      )}

      <Dialog open={!!equipmentToDelete} onOpenChange={(open) => !open && !isDeleting && setEquipmentToDelete(null)}>
        <DialogContent className="max-w-md p-0 flex flex-col xl:rounded-[2rem] overflow-hidden bg-[var(--color-v2-background)] border-[var(--color-v2-border)] shadow-2xl">
          <DialogHeader className="pt-8 px-8 pb-6 bg-[var(--color-v2-card)]/50 border-b border-[var(--color-v2-border)]">
            <DialogTitle className="text-2xl font-black text-[var(--color-v2-foreground)]">Delete Equipment</DialogTitle>
            <DialogDescription className="text-base text-[var(--color-v2-muted-foreground)] mt-2">
              Are you sure you want to delete <strong className="text-[var(--color-v2-foreground)]">{equipmentToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 md:p-8 flex items-center justify-end gap-3 bg-[var(--color-v2-background)]">
            <Button
              variant="outline"
              onClick={() => setEquipmentToDelete(null)}
              disabled={isDeleting}
              className="h-12 px-6 rounded-xl font-semibold border-[var(--color-v2-border)]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="h-12 px-8 rounded-xl font-bold text-white shadow-lg bg-red-600 hover:bg-red-700 shadow-red-500/20 hover:shadow-red-500/40"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
