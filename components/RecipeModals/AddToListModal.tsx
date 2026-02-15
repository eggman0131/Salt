import React, { useState, useEffect } from 'react';
import { ShoppingList } from '../../types/contract';
import { saltBackend } from '../../backend/api';

interface AddToListModalProps {
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddToListModal: React.FC<AddToListModalProps> = ({ recipeId, recipeTitle, onClose, onSuccess }) => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showNewListForm, setShowNewListForm] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    setIsLoading(true);
    try {
      const data = await saltBackend.getShoppingLists();
      setLists(data);
      
      // Pre-select default list
      const defaultList = data.find(l => l.isDefault);
      if (defaultList) {
        setSelectedListId(defaultList.id);
      } else if (data.length > 0) {
        setSelectedListId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load shopping lists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToList = async () => {
    if (!selectedListId) return;
    
    setIsAdding(true);
    try {
      await saltBackend.addRecipeToShoppingList(recipeId, selectedListId);
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to add recipe to list');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) return;
    
    setIsAdding(true);
    try {
      const newList = await saltBackend.createShoppingList({
        name: newListName.trim(),
        recipeIds: []
      });
      
      await saltBackend.addRecipeToShoppingList(recipeId, newList.id);
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to create list and add recipe');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add to Shopping List</h2>
          <p className="text-sm text-gray-600 mt-1">{recipeTitle}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : showNewListForm ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New List Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Weekend Shopping"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>
              <button
                onClick={() => {
                  setShowNewListForm(false);
                  setNewListName('');
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to existing lists
              </button>
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No shopping lists yet</p>
              <button
                onClick={() => setShowNewListForm(true)}
                className="text-orange-600 font-semibold hover:text-orange-700"
              >
                Create your first list
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    selectedListId === list.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{list.name}</span>
                        {list.isDefault && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
                            Default
                          </span>
                        )}
                      </div>
                      {list.recipeIds.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {list.recipeIds.length} recipe{list.recipeIds.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedListId === list.id
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedListId === list.id && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setShowNewListForm(true)}
                className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-all text-gray-600 hover:text-orange-700 font-semibold"
              >
                + Create New List
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={isAdding}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={showNewListForm ? handleCreateAndAdd : handleAddToList}
            disabled={isAdding || (showNewListForm ? !newListName.trim() : !selectedListId)}
            className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </span>
            ) : showNewListForm ? (
              'Create & Add'
            ) : (
              'Add to List'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
