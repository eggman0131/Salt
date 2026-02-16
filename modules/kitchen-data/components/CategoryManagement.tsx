import React, { useState, useEffect } from 'react';
import { Card, Input, Label } from '../../../components/UI';
import { RecipeCategory } from '../../../types/contract';
import { kitchenDataBackend } from '../backend';
import { saltBackend } from '../../../backend/api';

interface CategoryManagementProps {
  onRefresh: () => void;
  onSuggestionsChanged?: () => void;
}

export const CategoryManagement: React.FC<CategoryManagementProps> = ({ onRefresh, onSuggestionsChanged }) => {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [pendingCategories, setPendingCategories] = useState<RecipeCategory[]>([]);
  const [recipeTitles, setRecipeTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<'review' | 'manage'>('review');
  
  // Form state (used for both create and edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSynonyms, setFormSynonyms] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, pending, recipes] = await Promise.all([
        kitchenDataBackend.getCategories(),
        kitchenDataBackend.getPendingCategories(),
        saltBackend.getRecipes()
      ]);
      
      // Filter to only approved categories for the list
      setCategories(cats.filter(c => c.isApproved !== false));
      setPendingCategories(pending);
      
      const titleMap: Record<string, string> = {};
      recipes.forEach(recipe => {
        titleMap[recipe.id] = recipe.title;
      });
      setRecipeTitles(titleMap);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!formName.trim()) return;
    
    setIsSaving(true);
    try {
      const synonyms = formSynonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const categoryData: any = {
        name: formName,
        createdBy: 'admin',
        isApproved: true  // Manually created categories are approved
      };
      
      if (formDesc.trim()) {
        categoryData.description = formDesc.trim();
      }
      
      if (synonyms.length > 0) {
        categoryData.synonyms = synonyms;
      }

      await kitchenDataBackend.createCategory(categoryData);

      setFormName('');
      setFormDesc('');
      setFormSynonyms('');
      await loadData();
      onRefresh();
      if (onSuggestionsChanged) onSuggestionsChanged();
    } catch (err) {
      console.error('Failed to create category:', err);
      alert('Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprovePendingCategory = async (id: string) => {
    try {
      await kitchenDataBackend.approveCategory(id);
      await loadData();
      onRefresh();
      if (onSuggestionsChanged) onSuggestionsChanged();
    } catch (err) {
      console.error('Failed to approve:', err);
      alert('Failed to approve category');
    }
  };

  const handleRejectPendingCategory = async (id: string) => {
    try {
      await kitchenDataBackend.deleteCategory(id);
      await loadData();
      onRefresh();
      if (onSuggestionsChanged) onSuggestionsChanged();
    } catch (err) {
      console.error('Failed to reject:', err);
      alert('Failed to reject category');
    }
  };

  const handleStartEdit = (category: RecipeCategory) => {
    setEditingId(category.id);
    setFormName(category.name);
    setFormDesc(category.description || '');
    setFormSynonyms(category.synonyms?.join(', ') || '');
  };

  const handleClearForm = () => {
    setEditingId(null);
    setFormName('');
    setFormDesc('');
    setFormSynonyms('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!formName.trim()) return;
    
    setIsSaving(true);
    try {
      const synonyms = formSynonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const updates: any = {
        name: formName
      };
      
      if (formDesc.trim()) {
        updates.description = formDesc.trim();
      }
      
      if (synonyms.length > 0) {
        updates.synonyms = synonyms;
      }

      await kitchenDataBackend.updateCategory(id, updates);

      handleClearForm();
      await loadData();
      onRefresh();
    } catch (err) {
      console.error('Failed to update:', err);
      alert('Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await kitchenDataBackend.deleteCategory(id);
      if (editingId === id) {
        handleClearForm();
      }
      await loadData();
      onRefresh();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete category');
    }
  };

  const handleSubmit = () => {
    if (editingId) {
      handleSaveEdit(editingId);
    } else {
      handleCreateCategory();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = pendingCategories.length;

  return (
    <div className="space-y-6">
      {/* Action Selector - Two Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Review Pending */}
        <button
          onClick={() => setSelectedAction('review')}
          className={`p-4 md:p-6 rounded-lg border-2 transition-all text-left ${
            selectedAction === 'review'
              ? 'border-orange-600 bg-orange-50 shadow-md shadow-orange-500/10'
              : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-gray-900">Review Pending</h3>
            {pendingCount > 0 && (
              <div className="w-6 h-6 flex items-center justify-center bg-orange-600 text-white rounded-full text-xs font-bold">
                {pendingCount}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600">Approve or reject AI suggestions</p>
        </button>

        {/* Manage Categories */}
        <button
          onClick={() => setSelectedAction('manage')}
          className={`p-4 md:p-6 rounded-lg border-2 transition-all text-left ${
            selectedAction === 'manage'
              ? 'border-orange-600 bg-orange-50 shadow-md shadow-orange-500/10'
              : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-gray-900">Manage Categories</h3>
            <span className="text-sm font-semibold text-gray-600">{categories.length}</span>
          </div>
          <p className="text-sm text-gray-600">Create, edit, and delete categories</p>
        </button>
      </div>

      {/* Content Panels */}
      <div>
        {/* REVIEW PENDING */}
        {selectedAction === 'review' && (
          <Card className="p-6 md:p-8 border-l-4 border-l-orange-600 bg-white">
            <div className="space-y-1 mb-6">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">AI Suggestions</p>
              <h2 className="text-2xl font-bold text-gray-900">Review Pending Approvals</h2>
              <p className="text-sm text-gray-600 pt-2">AI detected these categories from your recipes. Approve to activate them or reject to remove.</p>
            </div>

            {pendingCount === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-3 flex justify-center">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No pending suggestions</p>
                <p className="text-sm text-gray-400">All AI-suggested categories have been reviewed!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCategories.map(category => (
                  <div 
                    key={category.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900">{category.name}</h4>
                        {category.recipeId && (
                          <p className="text-sm text-gray-600 mt-1">From: <span className="text-gray-900 font-medium truncate">{recipeTitles[category.recipeId] || 'Unknown Recipe'}</span></p>
                        )}
                        {category.description && (
                          <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                        )}
                      </div>
                      {category.confidence !== undefined && (
                        <div className="shrink-0">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-full">
                            <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L7.414 9l3.293 3.293a1 1 0 01-1.414 1.414l-4-4z" clipRule="evenodd"/>
                            </svg>
                            <span className="text-xs font-semibold text-orange-700">{(category.confidence * 100).toFixed(0)}% match</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovePendingCategory(category.id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors active:scale-95"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectPendingCategory(category.id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors active:scale-95"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* MANAGE CATEGORIES */}
        {selectedAction === 'manage' && (
          <div className="space-y-6">
            {/* Form Section */}
            <Card className="p-6 md:p-8 border-l-4 border-l-orange-600 bg-white">
              <div className="space-y-1 mb-6">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                  {editingId ? 'Edit Category' : 'Create New'}
                </p>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingId ? 'Update Category Details' : 'Add New Category'}
                </h2>
                <p className="text-sm text-gray-600 pt-2">
                  {editingId 
                    ? 'Modify the category details below or click a different chip to edit another.'
                    : 'Click an existing category below to edit, or create a new one here.'}
                </p>
              </div>

              <div className="space-y-4 max-w-2xl">
                <div className="space-y-2">
                  <Label>Category Name *</Label>
                  <Input
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g., Comfort Foods, Quick Weeknight Meals, Desserts"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description <span className="text-gray-500 font-normal">(optional)</span></Label>
                  <textarea
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Describe this category for better organisation..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm resize-none h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Synonyms <span className="text-gray-500 font-normal">(optional)</span></Label>
                  <input
                    value={formSynonyms}
                    onChange={e => setFormSynonyms(e.target.value)}
                    placeholder="Alias names separated by commas (e.g., Fast, Easy, Simple)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                  />
                  <p className="text-xs text-gray-500">These help the AI recognise similar categories</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={!formName.trim() || isSaving}
                    className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors active:scale-95"
                  >
                    {isSaving ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
                  </button>
                  <button
                    onClick={handleClearForm}
                    className="px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
                  >
                    {editingId ? 'Cancel' : 'Clear'}
                  </button>
                </div>
              </div>
            </Card>

            {/* Categories Chips Section */}
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Existing Categories</h3>
                <p className="text-sm text-gray-600">Click a category to edit, or use the delete icon to remove it.</p>
              </div>

              {categories.length === 0 ? (
                <Card className="p-12 text-center bg-white border-l-4 border-l-gray-200">
                  <div className="mb-3 flex justify-center">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">No categories yet</p>
                  <p className="text-sm text-gray-400">Create your first category above to get started</p>
                </Card>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {categories.map(category => (
                    <div
                      key={category.id}
                      className={`inline-flex items-center gap-2 px-4 py-3 border-2 rounded-lg transition-all cursor-pointer group ${
                        editingId === category.id
                          ? 'border-orange-500 bg-orange-50 shadow-sm'
                          : 'border-gray-300 bg-white hover:border-orange-300 hover:shadow-sm'
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (editingId === category.id) {
                            handleClearForm();
                          } else {
                            handleStartEdit(category);
                          }
                        }}
                        className="flex items-center gap-2 text-left"
                      >
                        <span className={`font-semibold ${editingId === category.id ? 'text-orange-700' : 'text-gray-900 group-hover:text-orange-700'}`}>
                          {category.name}
                        </span>
                        {category.synonyms && category.synonyms.length > 0 && (
                          <span className="text-xs text-gray-500">
                            (+{category.synonyms.length})
                          </span>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(category.id);
                        }}
                        className="ml-2 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label="Delete category"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Category</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete <span className="font-semibold text-gray-900">
                    {categories.find(c => c.id === deleteConfirmId)?.name}
                  </span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCategory(deleteConfirmId)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
