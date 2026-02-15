import React, { useState, useEffect } from 'react';
import { Unit } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';

interface UnitsManagementProps {
  onRefresh?: () => void;
}

export const UnitsManagement: React.FC<UnitsManagementProps> = ({ onRefresh }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [showNewUnitModal, setShowNewUnitModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(999);

  const loadUnits = async () => {
    setIsLoading(true);
    try {
      const data = await saltBackend.getUnits();
      setUnits(data);
    } catch (err) {
      console.error('Failed to load units:', err);
      alert('Failed to load units');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const openNewUnitModal = () => {
    setFormName('');
    setFormSortOrder(units.length > 0 ? Math.max(...units.map(u => u.sortOrder)) + 10 : 10);
    setEditingUnit(null);
    setShowNewUnitModal(true);
  };

  const openEditModal = (unit: Unit) => {
    setFormName(unit.name);
    setFormSortOrder(unit.sortOrder);
    setEditingUnit(unit);
    setShowNewUnitModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      alert('Unit name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const unitData = {
        name: formName.trim(),
        sortOrder: formSortOrder
      };

      if (editingUnit) {
        await saltBackend.updateUnit(editingUnit.id, unitData);
      } else {
        await saltBackend.createUnit(unitData);
      }

      setShowNewUnitModal(false);
      await loadUnits();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save unit:', err);
      alert('Failed to save unit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (unit: Unit) => {
    setUnitToDelete(unit);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!unitToDelete) return;

    setIsSubmitting(true);
    try {
      await saltBackend.deleteUnit(unitToDelete.id);
      setShowDeleteConfirm(false);
      setUnitToDelete(null);
      await loadUnits();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete unit:', err);
      alert('Failed to delete unit');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading units...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Units are used for measuring items. Sort order determines display order.
        </p>
        <Button onClick={openNewUnitModal}>Add Unit</Button>
      </div>

      {/* Units List */}
      <div className="grid gap-3">
        {units.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            No units yet
          </Card>
        ) : (
          units.map((unit) => (
            <Card key={unit.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                    <span className="text-xs text-gray-500">
                      Sort: {unit.sortOrder}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => openEditModal(unit)} className="text-sm">
                    Edit
                  </Button>
                  <Button onClick={() => confirmDelete(unit)} className="text-sm bg-red-600 hover:bg-red-700">
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* New/Edit Unit Modal */}
      {showNewUnitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUnit ? 'Edit Unit' : 'New Unit'}
              </h2>

              <div>
                <Label htmlFor="name">Unit Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., g, kg, ml, l"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use metric units (g, kg, ml, l). Special unit: <code className="bg-gray-100 px-1 rounded">_item</code> for natural counting
                </p>
              </div>

              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value))}
                  placeholder="10"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers appear first in lists
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Saving...' : editingUnit ? 'Update' : 'Create'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowNewUnitModal(false)}
                  disabled={isSubmitting}
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && unitToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Confirm Delete</h2>
            <p className="text-gray-600">
              Are you sure you want to delete the unit <strong>{unitToDelete.name}</strong>?
              This may affect items using this unit.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
                className="bg-gray-500 hover:bg-gray-600"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
