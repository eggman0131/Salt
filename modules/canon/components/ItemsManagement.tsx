import React, { useState, useEffect } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Trash2, Pencil, X, Search, PlusCircle } from 'lucide-react';
import { CanonicalItem, Unit, Aisle } from '../../../types/contract';
import { canonBackend } from '../backend';
import { softToast } from '@/lib/soft-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';

interface ItemsManagementProps {
  onRefresh: () => void;
}

export const ItemsManagement: React.FC<ItemsManagementProps> = ({ onRefresh }) => {
  const [items, setItems] = useState<CanonicalItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [itemToDelete, setItemToDelete] = useState<CanonicalItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CanonicalItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [groupBy, setGroupBy] = useState<'none' | 'aisle' | 'staple'>('none');
  const [isProcessingDrag, setIsProcessingDrag] = useState(false);
  const [showBulkAisleDialog, setShowBulkAisleDialog] = useState(false);
  const [bulkAisleTarget, setBulkAisleTarget] = useState<string>('none');
  const [isBulkChangingAisle, setIsBulkChangingAisle] = useState(false);

  // Impact assessment & healing
  const [impactAssessment, setImpactAssessment] = useState<{ itemIds: string[]; affectedRecipes: { id: string; title: string; ingredientCount: number }[] } | null>(null);
  const [showImpactDialog, setShowImpactDialog] = useState(false);
  const [isAssessingImpact, setIsAssessingImpact] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [healingResult, setHealingResult] = useState<{
    recipesFixed: number;
    ingredientsProcessed: number;
    ingredientsRematched: number;
    ingredientsUnmatched: number;
    newCanonicalItemsCreated: Array<{ name: string; id: string; aisle: string; unit: string }>;
  } | null>(null);
  const [showHealingResult, setShowHealingResult] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [isStaple, setIsStaple] = useState(false);
  const [aisleId, setAisleId] = useState<string>('none');
  const [unitId, setUnitId] = useState<string>('none');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [synonymInput, setSynonymInput] = useState('');

  // Drag and drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragSynonym, setActiveDragSynonym] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to start drag
      },
    })
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsData, unitsData, aislesData] = await Promise.all([
        canonBackend.getCanonicalItems(),
        canonBackend.getUnits(),
        canonBackend.getAisles(),
      ]);
      setItems(itemsData);
      setUnits(unitsData);
      setAisles(aislesData);
    } catch (err) {
      console.error('Failed to load data', err);
      softToast.error('Failed to load items');
    }
  };

  const handleAddClick = () => {
    setName('');
    setIsStaple(false);
    setAisleId('none');
    setUnitId('none');
    setSynonyms([]);
    setSynonymInput('');
    setShowAddDialog(true);
  };

  const handleAddSynonym = () => {
    const trimmed = synonymInput.trim().toLowerCase();
    if (trimmed && !synonyms.includes(trimmed)) {
      setSynonyms([...synonyms, trimmed]);
      setSynonymInput('');
    }
  };

  const handleRemoveSynonym = (syn: string) => {
    setSynonyms(synonyms.filter(s => s !== syn));
  };

  const handleRemoveSynonymFromItem = async (item: CanonicalItem, synToRemove: string) => {
    try {
      const updatedSynonyms = (item.synonyms || []).filter(s => s !== synToRemove);
      await canonBackend.updateCanonicalItem(item.id, {
        synonyms: updatedSynonyms,
      });
      await loadData();
      softToast.success('Synonym removed', { description: synToRemove });
      onRefresh();
    } catch (err) {
      console.error('Failed to remove synonym', err);
      softToast.error('Failed to remove synonym');
    }
  };

  const handleDragStart = (event: DragEndEvent) => {
    setActiveDragId(event.active.id as string);
    const dragData = event.active.data.current;
    if (dragData && dragData.type === 'synonym') {
      setActiveDragSynonym(dragData.synonym);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setActiveDragSynonym(null);

    if (!over || active.id === over.id) {
      return;
    }

    try {
      // Get drag data from the draggable
      const dragData = active.data.current;
      if (!dragData || dragData.type !== 'synonym') {
        return;
      }

      const sourceItemId = dragData.itemId;
      const synonym = dragData.synonym;
      const sourceItem = items.find(i => i.id === sourceItemId);
      
      if (!sourceItem) {
        return;
      }

      // Check if dropped on "create new" zone
      if (over.id === 'create-new-item') {
        setIsProcessingDrag(true);
        softToast.info('Creating new item...', { description: 'Analyzing with AI' });

        // Remove synonym from source item FIRST (before validation runs on new item creation)
        const updatedSynonyms = (sourceItem.synonyms || []).filter(s => s !== synonym);
        await canonBackend.updateCanonicalItem(sourceItem.id, {
          synonyms: updatedSynonyms,
        });

        // Enrich item with AI (proper capitalization, aisle, unit)
        const enriched = await canonBackend.enrichCanonicalItem(synonym);

        // Create new item with enriched data
        await canonBackend.createCanonicalItem({
          name: enriched.name,
          normalisedName: enriched.name.toLowerCase(),
          preferredUnit: enriched.preferredUnit,
          aisle: enriched.aisle,
          isStaple: enriched.isStaple,
          synonyms: enriched.synonyms,
        });

        await loadData();
        setIsProcessingDrag(false);
        softToast.success('Item created', { description: enriched.name });
        onRefresh();
        return;
      }

      // Get drop target data
      const overData = over.data.current;
      
      // Check if dropped on an item's title (swap synonym with title)
      if (overData && overData.type === 'title') {
        const targetItemId = overData.itemId;
        
        // Only allow swapping within the same item
        if (sourceItemId === targetItemId) {
          setIsProcessingDrag(true);
          softToast.info('Swapping title...', { description: 'Analyzing with AI' });

          const oldTitle = sourceItem.name;
          // Capitalize the synonym when promoting to title
          const enriched = await canonBackend.enrichCanonicalItem(synonym);
          const newTitle = enriched.name;
          
          // Remove synonym from list and add old title as synonym
          const updatedSynonyms = (sourceItem.synonyms || [])
            .filter(s => s !== synonym)
            .concat(oldTitle);
          
          await canonBackend.updateCanonicalItem(sourceItem.id, {
            name: newTitle,
            normalisedName: newTitle.toLowerCase(),
            synonyms: updatedSynonyms,
          });
          
          await loadData();
          setIsProcessingDrag(false);
          softToast.success('Title swapped', { 
            description: `"${newTitle}" is now the main name` 
          });
          onRefresh();
        }
        return;
      }

      // Check if dropped on another item
      if (!overData || overData.type !== 'item') {
        return;
      }

      const targetItemId = overData.itemId;
      const targetItem = items.find(i => i.id === targetItemId);

      if (!targetItem) {
        return;
      }
      
      if (sourceItemId === targetItemId) {
        softToast.info('Drop on title to swap, or on a different item to move');
        return;
      }

      setIsProcessingDrag(true);

      // Move synonym from source to target
      const sourceSynonyms = (sourceItem.synonyms || []).filter(s => s !== synonym);
      const targetSynonyms = [...(targetItem.synonyms || []), synonym];

      await Promise.all([
        canonBackend.updateCanonicalItem(sourceItem.id, {
          synonyms: sourceSynonyms,
        }),
        canonBackend.updateCanonicalItem(targetItem.id, {
          synonyms: targetSynonyms,
        }),
      ]);

      await loadData();
      setIsProcessingDrag(false);
      softToast.success('Synonym moved', { 
        description: `"${synonym}" moved to ${targetItem.name}` 
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to move synonym', err);
      setIsProcessingDrag(false);
      softToast.error('Failed to move synonym');
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await canonBackend.createCanonicalItem({
        name: name.trim(),
        normalisedName: name.trim().toLowerCase(),
        isStaple,
        aisle: aisleId && aisleId !== 'none' ? aisleId : undefined,
        preferredUnit: unitId && unitId !== 'none' ? unitId : undefined,
        synonyms: synonyms.length > 0 ? synonyms : [],
      });
      
      await loadData();
      setShowAddDialog(false);
      softToast.success('Item added', { description: name.trim() });
      onRefresh();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Failed to add item';
      console.error('Failed to create item', err);
      softToast.error(errMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteClick = async (item: CanonicalItem) => {
    // Skip the old confirmation dialog and go straight to impact assessment
    setItemToDelete(item);
    setIsAssessingImpact(true);
    try {
      console.log('🔍 Assessing impact for single item deletion:', item.id);
      const assessment = await canonBackend.assessItemDeletion([item.id]);
      console.log('✅ Impact assessment complete:', assessment);
      setImpactAssessment(assessment);
      setShowImpactDialog(true);
    } catch (err) {
      console.error('❌ Failed to assess impact', err);
      softToast.error('Failed to assess deletion impact');
      setItemToDelete(null);
    } finally {
      setIsAssessingImpact(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    try {
      setIsBulkDeleting(true); // Reuse bulk deleting state
      const idToDelete = itemToDelete.id;
      
      // Delete the item using bulk method
      console.log('🗑️ Deleting item:', idToDelete);
      await canonBackend.deleteCanonicalItems([idToDelete]);
      
      // Heal references
      setIsHealing(true);
      console.log('🔧 Healing recipe references...');
      const result = await canonBackend.healRecipeReferences([idToDelete], impactAssessment!);
      console.log('✅ Healing complete:', result);
      setHealingResult(result);
      setShowHealingResult(true);
      
      // Cleanup
      await loadData();
      setItemToDelete(null);
      setImpactAssessment(null);
      setShowImpactDialog(false);
      softToast.success('Item deleted & fixed', { description: itemToDelete.name });
      onRefresh();
    } catch (err) {
      console.error('❌ Failed to delete item', err);
      softToast.error('Failed to delete item');
    } finally {
      setIsBulkDeleting(false);
      setIsHealing(false);
    }
  };

  const handleEditClick = (item: CanonicalItem) => {
    setItemToEdit(item);
    setName(item.name);
    setIsStaple(item.isStaple);
    setAisleId(item.aisle || 'none');
    setUnitId(item.preferredUnit || 'none');
    setSynonyms(item.synonyms || []);
    setSynonymInput('');
  };

  const handleEditSave = async () => {
    if (!itemToEdit || !name.trim()) return;
    
    setIsSaving(true);
    try {
      await canonBackend.updateCanonicalItem(itemToEdit.id, {
        name: name.trim(),
        normalisedName: name.trim().toLowerCase(),
        isStaple,
        aisle: aisleId && aisleId !== 'none' ? aisleId : undefined,
        preferredUnit: unitId && unitId !== 'none' ? unitId : undefined,
        synonyms: synonyms,
      });
      
      await loadData();
      setItemToEdit(null);
      softToast.success('Item updated', { description: name.trim() });
      onRefresh();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Failed to update item';
      console.error('Failed to update item', err);
      softToast.error(errMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const getAisleName = (aisleNameOrId?: string) => {
    if (!aisleNameOrId) return 'None';
    // Try to find by ID first (for backwards compatibility)
    const byId = aisles.find(a => a.id === aisleNameOrId);
    if (byId) return byId.name;
    // Then try by name (current schema)
    const byName = aisles.find(a => a.name.toLowerCase() === aisleNameOrId.toLowerCase());
    if (byName) return byName.name;
    // If not found, return the value itself (it's likely already a name)
    return aisleNameOrId;
  };

  const getUnitName = (unitNameOrId?: string) => {
    if (!unitNameOrId) return 'None';
    // Try to find by ID first (for backwards compatibility)
    const byId = units.find(u => u.id === unitNameOrId);
    if (byId) return byId.name;
    // Then try by name (current schema)
    const byName = units.find(u => u.name.toLowerCase() === unitNameOrId.toLowerCase());
    if (byName) return byName.name;
    // If not found, return the value itself (it's likely already a name)
    return unitNameOrId;
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredItems.map(i => i.id)));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDeleteClick = async () => {
    // Step 1: Assess impact
    setIsAssessingImpact(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      console.log('🔍 Assessing impact for deletion of:', idsToDelete);
      const assessment = await canonBackend.assessItemDeletion(idsToDelete);
      console.log('✅ Impact assessment complete:', assessment);
      setImpactAssessment(assessment);
      setShowBulkDeleteDialog(false);
      setShowImpactDialog(true);
    } catch (err) {
      console.error('❌ Failed to assess impact', err);
      softToast.error('Failed to assess deletion impact');
    } finally {
      setIsAssessingImpact(false);
    }
  };

  const handleConfirmDelete = async () => {
    // Step 2: Delete items
    setIsBulkDeleting(true);
    try {
      const idsToDelete = impactAssessment?.itemIds || Array.from(selectedIds);
      // Use new bulk delete method to avoid race conditions
      await canonBackend.deleteCanonicalItems(idsToDelete);
      
      // Step 3: Heal references
      setShowImpactDialog(false);
      setIsHealing(true);
      const result = await canonBackend.healRecipeReferences(idsToDelete, impactAssessment!);
      setHealingResult(result);
      setShowHealingResult(true);
      
      // Cleanup
      await loadData();
      setSelectedIds(new Set());
      setImpactAssessment(null);
      softToast.success(`Deleted ${idsToDelete.length} item${idsToDelete.length === 1 ? '' : 's'}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete and heal', err);
      softToast.error('Failed to delete items');
    } finally {
      setIsBulkDeleting(false);
      setIsHealing(false);
    }
  };

  const handleBulkAisleChange = async () => {
    if (bulkAisleTarget === 'none') {
      softToast.error('Please select an aisle');
      return;
    }

    setIsBulkChangingAisle(true);
    try {
      const idsToUpdate = Array.from(selectedIds);
      const targetAisle = aisles.find(a => a.name === bulkAisleTarget)?.name;
      
      await Promise.all(
        idsToUpdate.map(id => 
          canonBackend.updateCanonicalItem(id, {
            aisle: targetAisle
          })
        )
      );
      
      await loadData();
      setSelectedIds(new Set());
      setShowBulkAisleDialog(false);
      setBulkAisleTarget('none');
      softToast.success(`Moved ${idsToUpdate.length} item${idsToUpdate.length === 1 ? '' : 's'} to ${targetAisle}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to bulk change aisle', err);
      softToast.error('Failed to change aisle');
    } finally {
      setIsBulkChangingAisle(false);
    }
  };

  // Helper component for draggable synonyms
  const DraggableSynonym: React.FC<{
    synonym: string;
    itemId: string;
    onRemove: () => void;
  }> = ({ synonym, itemId, onRemove }) => {
    const dragId = `synonym-${itemId}-${synonym}`;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: dragId,
      data: {
        type: 'synonym',
        itemId,
        synonym,
      },
    });

    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      opacity: isDragging ? 0.5 : 1,
    } : undefined;

    return (
      <Badge 
        ref={setNodeRef}
        variant="outline" 
        className="text-xs pl-2 pr-1 flex items-center gap-1 cursor-grab active:cursor-grabbing"
        style={style}
        {...attributes}
        {...listeners}
      >
        <span>{synonym}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-muted-foreground hover:text-destructive transition-colors ml-1"
          title={`Remove synonym "${synonym}"`}
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag from starting
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    );
  };

  // Helper component for droppable title (to swap with synonyms)
  const DroppableTitle: React.FC<{
    itemId: string;
    title: string;
  }> = ({ itemId, title }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `title-${itemId}`,
      data: {
        type: 'title',
        itemId,
      },
    });

    return (
      <p 
        ref={setNodeRef}
        className={`font-medium text-sm transition-all ${
          isOver ? 'ring-2 ring-primary ring-offset-1 rounded px-1 -mx-1' : ''
        }`}
      >
        {title}
      </p>
    );
  };

  // Helper component for droppable items
  const DroppableItem: React.FC<{
    item: CanonicalItem;
    children: React.ReactNode;
  }> = ({ item, children }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `item-${item.id}`,
      data: {
        type: 'item',
        itemId: item.id,
      },
    });

    return (
      <div
        ref={setNodeRef}
        className={`flex items-start gap-3 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-all ${
          isOver ? 'ring-2 ring-primary ring-offset-2' : ''
        }`}
      >
        {children}
      </div>
    );
  };

  // Helper component for "Create New Item" drop zone
  const NewItemDropZone: React.FC = () => {
    const { setNodeRef, isOver } = useDroppable({
      id: 'create-new-item',
    });

    return (
      <div
        ref={setNodeRef}
        className={`p-4 border-2 border-dashed rounded-lg transition-all mb-2 ${
          isOver 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/30 bg-muted/30'
        }`}
      >
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <PlusCircle className="h-4 w-4" />
          <span>Drop synonym here to create new item</span>
        </div>
      </div>
    );
  };

  const filteredItems = items.filter(item =>
    filterText === '' || 
    item.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (item.synonyms && item.synonyms.some(syn => syn.toLowerCase().includes(filterText.toLowerCase())))
  );

  // Group items based on groupBy setting
  const groupedItems = React.useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: null, items: filteredItems }];
    }

    if (groupBy === 'aisle') {
      const groups = new Map<string, CanonicalItem[]>();
      
      filteredItems.forEach(item => {
        const aisleName = getAisleName(item.aisle) || 'No Aisle';
        if (!groups.has(aisleName)) {
          groups.set(aisleName, []);
        }
        groups.get(aisleName)!.push(item);
      });

      // Sort groups by aisle name
      const sortedGroups = Array.from(groups.entries())
        .sort(([a], [b]) => {
          if (a === 'No Aisle') return 1;
          if (b === 'No Aisle') return -1;
          return a.localeCompare(b);
        });

      return sortedGroups.map(([aisleName, items]) => ({
        key: aisleName,
        label: aisleName,
        items,
      }));
    }

    if (groupBy === 'staple') {
      const staples = filteredItems.filter(item => item.isStaple);
      const nonStaples = filteredItems.filter(item => !item.isStaple);
      
      const groups = [];
      if (staples.length > 0) {
        groups.push({ key: 'staples', label: 'Staples', items: staples });
      }
      if (nonStaples.length > 0) {
        groups.push({ key: 'non-staples', label: 'Non-Staples', items: nonStaples });
      }
      return groups;
    }

    return [{ key: 'all', label: null, items: filteredItems }];
  }, [filteredItems, groupBy, aisles]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Canonical Items</CardTitle>
            <p className="text-sm text-muted-foreground">
              {items.length} canonical {items.length === 1 ? 'item' : 'items'}
              {filterText && ` (${filteredItems.length} filtered)`}
            </p>
          </div>
          <AddButton onClick={handleAddClick} className="shrink-0" label="Add" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col space-y-3 h-full px-0 md:px-6">
        {/* Filter and Group Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter items by name or synonym..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger>
              <SelectValue placeholder="Group by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="aisle">Group by Aisle</SelectItem>
              <SelectItem value="staple">Group by Staple</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selection Actions */}
        {selectedIds.size > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectNone}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkAisleDialog(true)}
              >
                Change Aisle ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteClick}
                disabled={isAssessingImpact}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}

        {/* Select All/None */}
        {filteredItems.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectNone}
              className="text-xs"
            >
              Select None
            </Button>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 min-h-0 relative">
          {/* Loading Overlay */}
          {isProcessingDrag && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
              <div className="text-center space-y-2">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Processing...</p>
              </div>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                {items.length === 0 ? 'No canonical items yet. Add items above.' : 'No items match your filter.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <NewItemDropZone />
              <div className="space-y-4">
                {groupedItems.map((group) => (
                  <div key={group.key}>
                    {group.label && (
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
                        {group.label} ({group.items.length})
                      </h3>
                    )}
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <DroppableItem key={item.id} item={item}>
                  <Checkbox 
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => handleToggleSelect(item.id)}
                    className="shrink-0 mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <DroppableTitle itemId={item.id} title={item.name} />
                      {item.isStaple && (
                        <Badge variant="secondary" className="text-xs">
                          Staple
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium">Aisle:</span> {getAisleName(item.aisle)}
                        {' · '}
                        <span className="font-medium">Unit:</span> {getUnitName(item.preferredUnit)}
                      </p>
                      
                      {item.synonyms && item.synonyms.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.synonyms.map((syn) => (
                            <DraggableSynonym
                              key={syn}
                              synonym={syn}
                              itemId={item.id}
                              onRemove={() => handleRemoveSynonymFromItem(item, syn)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      onClick={() => handleEditClick(item)}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteClick(item)}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </DroppableItem>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Add Item Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add Canonical Item</DialogTitle>
              <DialogDescription>
                Create a new standard ingredient for recipes
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pl-3 pr-1 md:px-6">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Item Name</Label>
                  <Input 
                    id="add-name"
                    placeholder="e.g. Chicken Breast" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="add-staple"
                    checked={isStaple}
                    onCheckedChange={(checked) => setIsStaple(checked as boolean)}
                  />
                  <Label htmlFor="add-staple" className="cursor-pointer">
                    Mark as staple ingredient
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aisle</Label>
                    <Select value={aisleId} onValueChange={setAisleId}>
                      <SelectTrigger>
                        <SelectValue>{getAisleName(aisleId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {aisles.map((aisle) => (
                          <SelectItem key={aisle.id} value={aisle.id}>
                            {aisle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Unit</Label>
                    <Select value={unitId} onValueChange={setUnitId}>
                      <SelectTrigger>
                        <SelectValue>{getUnitName(unitId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Synonyms</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add synonym"
                      value={synonymInput}
                      onChange={(e) => setSynonymInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSynonym();
                        }
                      }}
                    />
                    <AddButton type="button" onClick={handleAddSynonym} variant="outline" label="Add" />
                  </div>
                  
                  {synonyms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {synonyms.map((syn) => (
                        <Badge key={syn} variant="secondary" className="text-xs">
                          {syn}
                          <button
                            onClick={() => handleRemoveSynonym(syn)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <AddButton
                onClick={handleAdd}
                disabled={!name.trim() || isAdding}
                label={isAdding ? 'Adding...' : 'Add Item'}
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={!!itemToEdit} onOpenChange={() => setItemToEdit(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
            <div className="pl-3 pr-1 md:px-6 pt-6 shrink-0">
              <DialogHeader>
                <DialogTitle>Edit Canonical Item</DialogTitle>
                <DialogDescription>
                  Update the item details
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 py-4 pl-3 pr-1 md:px-6 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Item Name</Label>
                  <Input 
                    id="edit-name"
                    placeholder="e.g. Chicken Breast" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="edit-staple"
                    checked={isStaple}
                    onCheckedChange={(checked) => setIsStaple(checked as boolean)}
                  />
                  <Label htmlFor="edit-staple" className="cursor-pointer">
                    Mark as staple ingredient
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aisle</Label>
                    <Select value={aisleId} onValueChange={setAisleId}>
                      <SelectTrigger>
                        <SelectValue>{getAisleName(aisleId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {aisles.map((aisle) => (
                          <SelectItem key={aisle.id} value={aisle.id}>
                            {aisle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Unit</Label>
                    <Select value={unitId} onValueChange={setUnitId}>
                      <SelectTrigger>
                        <SelectValue>{getUnitName(unitId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Synonyms</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add synonym"
                      value={synonymInput}
                      onChange={(e) => setSynonymInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSynonym();
                        }
                      }}
                    />
                    <AddButton type="button" onClick={handleAddSynonym} variant="outline" label="Add" />
                  </div>
                  
                  {synonyms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {synonyms.map((syn) => (
                        <Badge key={syn} variant="secondary" className="text-xs">
                          {syn}
                          <button
                            onClick={() => handleRemoveSynonym(syn)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pl-3 pr-1 md:px-6 pt-6 pb-6 border-t shrink-0">
              <Button
                variant="outline"
                onClick={() => setItemToEdit(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={!name.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog - DISABLED, use impact assessment flow instead */}
        <AlertDialog open={false} onOpenChange={() => setItemToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Item?</AlertDialogTitle>
              <AlertDialogDescription>
                {itemToDelete && (
                  <>
                    Are you sure you want to delete <strong>{itemToDelete.name}</strong>? 
                    This action cannot be undone and may affect recipes using this item.
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
                {isDeleting ? 'Deleting...' : 'Delete Item'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Impact Assessment Dialog */}
        <AlertDialog open={showImpactDialog} onOpenChange={setShowImpactDialog}>
          <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Impact Assessment</AlertDialogTitle>
              <AlertDialogDescription>
                {impactAssessment && impactAssessment.affectedRecipes.length === 0
                  ? 'Good news! No recipes are using these items.'
                  : `${impactAssessment?.affectedRecipes.length} recipe${impactAssessment?.affectedRecipes.length === 1 ? '' : 's'} will be affected by this deletion.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {impactAssessment && impactAssessment.affectedRecipes.length > 0 && (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  The following recipes use these items:
                </p>
                <ScrollArea className="max-h-48 border rounded-lg p-3">
                  <div className="space-y-2">
                    {impactAssessment.affectedRecipes.map((recipe) => (
                      <div key={recipe.id} className="text-sm border-l-2 border-destructive pl-3 py-1">
                        <p className="font-medium">{recipe.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {recipe.ingredientCount} ingredient{recipe.ingredientCount === 1 ? '' : 's'} affected
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-sm font-medium text-destructive">
                  Affected ingredients will be unlinked and automatically re-matched to similar items. 
                  Any unmatched ingredients will remain in your recipes for manual review.
                </p>
              </div>
            )}
            
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkDeleting || isHealing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isBulkDeleting || isHealing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isBulkDeleting || isHealing ? 'Processing...' : 'Delete & Fix'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Healing Result Dialog */}
        <Dialog open={showHealingResult} onOpenChange={setShowHealingResult}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>✅ Deletion Complete & Fixed</DialogTitle>
              <DialogDescription>
                Your recipes have been automatically healed.
              </DialogDescription>
            </DialogHeader>
            
            {healingResult && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-green-600">{healingResult.recipesFixed}</p>
                    <p className="text-xs text-muted-foreground">Recipes Fixed</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-blue-600">{healingResult.ingredientsRematched}</p>
                    <p className="text-xs text-muted-foreground">Rematched</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-orange-600">{healingResult.ingredientsUnmatched}</p>
                    <p className="text-xs text-muted-foreground">Unmatched</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-purple-600">{healingResult.ingredientsProcessed}</p>
                    <p className="text-xs text-muted-foreground">Total Processed</p>
                  </div>
                </div>
                
                {healingResult.ingredientsUnmatched > 0 && (
                  <div className="p-3 border border-orange-200 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                      ⚠️ {healingResult.ingredientsUnmatched} ingredient{healingResult.ingredientsUnmatched === 1 ? '' : 's'} could not be automatically matched.
                    </p>
                    <p className="text-xs text-orange-800 dark:text-orange-300 mt-1">
                      These ingredients remain unlinked in your recipes. You can manually link them or leave them as-is.
                    </p>
                  </div>
                )}
                
                {healingResult.ingredientsRematched > 0 && (
                  <div className="p-3 border border-green-200 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="text-sm font-medium text-green-900 dark:text-green-200">
                      ✓ {healingResult.ingredientsRematched} ingredient{healingResult.ingredientsRematched === 1 ? '' : 's'} successfully re-matched to similar items.
                    </p>
                  </div>
                )}
                
                {healingResult.recipesWithUnlinkedItems && healingResult.recipesWithUnlinkedItems.length > 0 && (
                  <div className="p-3 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
                      ⚠️ {healingResult.recipesWithUnlinkedItems.length} recipe{healingResult.recipesWithUnlinkedItems.length === 1 ? '' : 's'} have unlinked items
                    </p>
                    <ul className="space-y-1">
                      {healingResult.recipesWithUnlinkedItems.map(recipe => (
                        <li key={recipe.id} className="text-xs text-amber-800 dark:text-amber-300">
                          • <strong>{recipe.title}</strong> ({recipe.unlinkedCount} unlinked)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button
                onClick={() => {
                  setShowHealingResult(false);
                  setHealingResult(null);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Aisle Change Dialog */}
        <Dialog open={showBulkAisleDialog} onOpenChange={setShowBulkAisleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Aisle for {selectedIds.size} Item{selectedIds.size === 1 ? '' : 's'}</DialogTitle>
              <DialogDescription>
                Select the aisle to move {selectedIds.size} selected item{selectedIds.size === 1 ? '' : 's'} to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-aisle">Target Aisle</Label>
                <Select
                  value={bulkAisleTarget}
                  onValueChange={setBulkAisleTarget}
                >
                  <SelectTrigger id="bulk-aisle">
                    <SelectValue placeholder="Select aisle..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select aisle...</SelectItem>
                    {aisles.map((aisle) => (
                      <SelectItem key={aisle.id} value={aisle.name}>
                        {aisle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkAisleDialog(false);
                  setBulkAisleTarget('none');
                }}
                disabled={isBulkChangingAisle}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAisleChange}
                disabled={isBulkChangingAisle || bulkAisleTarget === 'none'}
              >
                {isBulkChangingAisle ? 'Moving...' : `Move ${selectedIds.size} Item${selectedIds.size === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragSynonym ? (
          <Badge variant="outline" className="text-xs pl-2 pr-1">
            {activeDragSynonym}
          </Badge>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
