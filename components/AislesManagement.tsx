import React, { useState, useEffect } from 'react';
import { Aisle } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';

interface AislesManagementProps {
  onRefresh?: () => void;
}

export const AislesManagement: React.FC<AislesManagementProps> = ({ onRefresh }) => {
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAisle, setEditingAisle] = useState<Aisle | null>(null);
  const [showNewAisleModal, setShowNewAisleModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aisleToDelete, setAisleToDelete] = useState<Aisle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(999);

  const loadAisles = async () => {
    setIsLoading(true);
    try {
      const data = await saltBackend.getAisles();
      setAisles(data);
    } catch (err) {
      console.error('Failed to load aisles:', err);
      alert('Failed to load aisles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAisles();
  }, []);

  const openNewAisleModal = () => {
    setFormName('');
    setFormSortOrder(aisles.length > 0 ? Math.max(...aisles.map(a => a.sortOrder)) + 10 : 10);
    setEditingAisle(null);
    setShowNewAisleModal(true);
  };

  const openEditModal = (aisle: Aisle) => {
    setFormName(aisle.name);
    setFormSortOrder(aisle.sortOrder);
    setEditingAisle(aisle);
    setShowNewAisleModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      alert('Aisle name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const aisleData = {
        name: formName.trim(),
        sortOrder: formSortOrder
      };

      if (editingAisle) {
        await saltBackend.updateAisle(editingAisle.id, aisleData);
      } else {
        await saltBackend.createAisle(aisleData);
      }

      setShowNewAisleModal(false);
      await loadAisles();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save aisle:', err);
      alert('Failed to save aisle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (aisle: Aisle) => {
    setAisleToDelete(aisle);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!aisleToDelete) return;

    setIsSubmitting(true);
    try {
      await saltBackend.deleteAisle(aisleToDelete.id);
      setShowDeleteConfirm(false);
      setAisleToDelete(null);
      await loadAisles();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete aisle:', err);
      alert('Failed to delete aisle');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading aisles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Aisles help organize shopping lists. Sort order determines display order.
        </p>
        <Button onClick={openNewAisleModal}>Add Aisle</Button>
      </div>

      {/* Aisles List */}
      <div className="grid gap-3">
        {aisles.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            No aisles yet
          </Card>
        ) : (
          aisles.map((aisle) => (
            <Card key={aisle.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{aisle.name}</h3>
                    <span className="text-xs text-gray-500">
                      Sort: {aisle.sortOrder}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => openEditModal(aisle)} className="text-sm">
                    Edit
                  </Button>
                  <Button onClick={() => confirmDelete(aisle)} className="text-sm bg-red-600 hover:bg-red-700">
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* New/Edit Aisle Modal */}
      {showNewAisleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAisle ? 'Edit Aisle' : 'New Aisle'}
              </h2>

              <div>
                <Label htmlFor="name">Aisle Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Produce, Dairy, Bakery"
                  required
                />
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
                  {isSubmitting ? 'Saving...' : editingAisle ? 'Update' : 'Create'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowNewAisleModal(false)}
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
      {showDeleteConfirm && aisleToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Confirm Delete</h2>
            <p className="text-gray-600">
              Are you sure you want to delete the aisle <strong>{aisleToDelete.name}</strong>?
              This may affect items using this aisle.
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
