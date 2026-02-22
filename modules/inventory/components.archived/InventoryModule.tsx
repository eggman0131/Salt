import React, { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Equipment, EquipmentCandidate } from '../../../types/contract';
import { inventoryBackend } from '../backend';
import { EquipmentListView } from './EquipmentListView';
import { EquipmentDetailView } from './EquipmentDetailView';
import { SearchCandidatesDialog, DeleteConfirmDialog } from './InventoryDialogs';
import { Button } from '../../../components/ui/button';

type ViewMode = 'list' | 'detail';

interface InventoryModuleProps {
  inventory: Equipment[];
  onRefresh: () => void;
}

/**
 * InventoryModule - Main orchestrator for equipment management
 * 
 * Manages:
 * - View mode switching (list/detail)
 * - Equipment selection and editing
 * - Search → Select → Generate → Save workflow
 * - Add/remove accessories
 * - Delete operations
 */
export const InventoryModule: React.FC<InventoryModuleProps> = ({ inventory, onRefresh }) => {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // Dialog states
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Search workflow state
  const [searchCandidates, setSearchCandidates] = useState<EquipmentCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Edited equipment (before save)
  const [editingEquipment, setEditingEquipment] = useState<Partial<Equipment> | null>(null);

  // ============================================================================
  // LIST VIEW HANDLERS
  // ============================================================================

  const handleSelectEquipment = useCallback((equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setEditingEquipment({
      ...equipment,
      accessories: equipment.accessories || [],
    });
    setViewMode('detail');
  }, []);

  const handleAddNew = useCallback(() => {
    setSelectedEquipment(null);
    setEditingEquipment({ accessories: [] });
    setShowSearchDialog(true);
  }, []);

  const handleDeleteEquipment = useCallback((equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setShowDeleteDialog(true);
  }, []);

  // ============================================================================
  // SEARCH WORKFLOW HANDLERS
  // ============================================================================

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchCandidates([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await inventoryBackend.searchEquipmentCandidates(query);
      setSearchCandidates(results || []);
    } catch (err) {
      console.error('Search failed:', err);
      alert('Failed to search catalogue. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectCandidate = useCallback(async (candidate: EquipmentCandidate) => {
    setIsGenerating(true);
    try {
      const details = await inventoryBackend.generateEquipmentDetails(candidate);
      
      // Create new equipment with AI-generated specs
      const newEquipment: Partial<Equipment> = {
        id: uuidv4(),
        name: `${candidate.brand} ${candidate.modelName}`,
        brand: candidate.brand || details.brand || '',
        modelName: candidate.modelName || details.modelName || '',
        type: details.type || '',
        class: details.class || '',
        description: details.description || candidate.description || '',
        status: 'Available',
        accessories: (details.accessories || []).map((acc) => ({
          ...acc,
          id: acc.id || uuidv4(),
        })),
        specifications: details.specifications || {},
        createdAt: new Date().toISOString(),
        createdBy: 'current-user', // Backend will override with actual user
      };

      setEditingEquipment(newEquipment);
      setSearchCandidates([]);
      setShowSearchDialog(false);
      setViewMode('detail');
    } catch (err) {
      console.error('Failed to generate equipment details:', err);
      alert('Failed to generate technical details. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // ============================================================================
  // EQUIPMENT DETAIL HANDLERS
  // ============================================================================

  const handleUpdateEquipment = useCallback((updates: Partial<Equipment>) => {
    setEditingEquipment(prev => prev ? { ...prev, ...updates } : updates);
  }, []);

  const handleRefreshSpecs = useCallback(async () => {
    if (!editingEquipment?.brand || !editingEquipment?.modelName) return;

    setIsGenerating(true);
    try {
      const candidate: EquipmentCandidate = {
        brand: editingEquipment.brand,
        modelName: editingEquipment.modelName,
        description: '',
        category: editingEquipment.class || 'Appliance',
      };

      const details = await inventoryBackend.generateEquipmentDetails(candidate);
      setEditingEquipment(prev =>
        prev ? {
          ...prev,
          ...details,
          name: `${prev.brand} ${prev.modelName}`,
        } : prev
      );
    } catch (err) {
      console.error('Failed to refresh specs:', err);
      alert('Failed to refresh technical details.');
    } finally {
      setIsGenerating(false);
    }
  }, [editingEquipment?.brand, editingEquipment?.modelName, editingEquipment?.class]);

  const handleSaveEquipment = useCallback(async () => {
    if (!editingEquipment) return;

    try {
      if (selectedEquipment?.id) {
        // Update existing
        await inventoryBackend.updateEquipment(selectedEquipment.id, editingEquipment);
      } else {
        // Create new
        await inventoryBackend.createEquipment(editingEquipment as Equipment);
      }

      setViewMode('list');
      setSelectedEquipment(null);
      setEditingEquipment(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to save equipment:', err);
      alert('Failed to save equipment.');
    }
  }, [editingEquipment, selectedEquipment?.id, onRefresh]);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedEquipment(null);
    setEditingEquipment(null);
  }, []);

  // ============================================================================
  // DELETE HANDLER
  // ============================================================================

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedEquipment?.id) return;

    try {
      await inventoryBackend.deleteEquipment(selectedEquipment.id);
      setShowDeleteDialog(false);
      setViewMode('list');
      setSelectedEquipment(null);
      setEditingEquipment(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete equipment:', err);
      alert('Failed to delete equipment.');
    }
  }, [selectedEquipment?.id, onRefresh]);

  // ============================================================================
  // ACCESSORIES HANDLERS
  // ============================================================================

  const handleAddAccessory = useCallback(async (accessoryName: string) => {
    if (!editingEquipment) return;

    try {
      const validated = await inventoryBackend.validateAccessory(
        editingEquipment.name || editingEquipment.brand || 'Equipment',
        accessoryName
      );

      setEditingEquipment(prev =>
        prev ? {
          ...prev,
          accessories: [
            ...(prev.accessories || []),
            {
              ...validated,
              id: uuidv4(),
            },
          ],
        } : prev
      );
    } catch (err) {
      console.error('Failed to validate accessory:', err);
      alert('Failed to add accessory.');
    }
  }, [editingEquipment]);

  const handleRemoveAccessory = useCallback((accessoryId: string) => {
    setEditingEquipment(prev =>
      prev ? {
        ...prev,
        accessories: (prev.accessories || []).filter(a => a.id !== accessoryId),
      } : prev
    );
  }, []);

  const handleToggleAccessoryOwned = useCallback((accessoryId: string) => {
    setEditingEquipment(prev =>
      prev ? {
        ...prev,
        accessories: (prev.accessories || []).map(a =>
          a.id === accessoryId ? { ...a, owned: !a.owned } : a
        ),
      } : prev
    );
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4 py-4 animate-in fade-in duration-300">
      {viewMode === 'list' ? (
        <>
          <EquipmentListView
            equipment={inventory}
            onSelectEquipment={handleSelectEquipment}
            onAddNew={handleAddNew}
            onDeleteEquipment={handleDeleteEquipment}
          />
        </>
      ) : (
        <>
          {editingEquipment && (
            <div className="space-y-4">
              <EquipmentDetailView
                equipment={{
                  ...editingEquipment,
                  accessories: editingEquipment.accessories || [],
                } as Equipment}
                isUpdating={isGenerating}
                isValidatingAccessory={isSearching}
                onUpdate={handleUpdateEquipment}
                onRefreshSpecs={handleRefreshSpecs}
                onBack={handleBackToList}
                onAddAccessory={handleAddAccessory}
                onRemoveAccessory={handleRemoveAccessory}
                onToggleAccessoryOwned={(id, owned) => handleToggleAccessoryOwned(id)}
              />
              
              {/* Action buttons footer */}
              <div className="bg-card border-t border-border p-4 flex gap-3 justify-end max-w-4xl mx-auto">
                <Button
                  variant="outline"
                  onClick={handleBackToList}
                >
                  Cancel
                </Button>
                {selectedEquipment?.id && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  onClick={handleSaveEquipment}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Search Dialog */}
      <SearchCandidatesDialog
        open={showSearchDialog}
        onClose={() => {
          setShowSearchDialog(false);
          setSearchCandidates([]);
        }}
        onSearch={handleSearch}
        candidates={searchCandidates}
        onSelectCandidate={handleSelectCandidate}
        isSearching={isSearching}
      />

      {/* Delete Confirmation Dialog */}
      {selectedEquipment && (
        <DeleteConfirmDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleConfirmDelete}
          equipment={selectedEquipment}
          isDeleting={isGenerating}
        />
      )}
    </div>
  );
};
