import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Label } from './UI';
import { RecipeCategory, RecipeTagSuggestion } from '../types/contract';
import { saltBackend } from '../backend/api';

interface CategoryManagementProps {
  onRefresh: () => void;
}

export const CategoryManagement: React.FC<CategoryManagementProps> = ({ onRefresh }) => {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [suggestions, setSuggestions] = useState<RecipeTagSuggestion[]>([]);
  const [recipeTitles, setRecipeTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'suggestions'>('suggestions');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategorySynonyms, setNewCategorySynonyms] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, suggs, recipes] = await Promise.all([
        saltBackend.getCategories(),
        saltBackend.getTagSuggestions(),
        saltBackend.getRecipes()
      ]);
      setCategories(cats);
      // Filter to pending suggestions
      setSuggestions(suggs.filter(s => s.status === 'pending'));
      
      // Create recipe ID -> title mapping
      const titleMap: Record<string, string> = {};
      recipes.forEach(recipe => {
        titleMap[recipe.id] = recipe.title;
      });
      setRecipeTitles(titleMap);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    setIsCreating(true);
    try {
      const synonyms = newCategorySynonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await saltBackend.createCategory({
        name: newCategoryName,
        description: newCategoryDesc || undefined,
        synonyms: synonyms.length > 0 ? synonyms : undefined,
        createdBy: 'admin'
      });

      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategorySynonyms('');
      await loadData();
      onRefresh();
    } catch (err) {
      console.error('Failed to create category:', err);
      alert('Failed to create category');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    
    try {
      await saltBackend.deleteCategory(id);
      await loadData();
      onRefresh();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category');
    }
  };

  const handleApproveSuggestion = async (id: string, suggestionName: string) => {
    try {
      // First approve the suggestion
      await saltBackend.approveTagSuggestion(id);
      
      // Check if a category with this exact name already exists
      const existing = categories.find(c => c.name.toLowerCase() === suggestionName.toLowerCase());
      if (!existing) {
        // Create new category from suggestion
        await saltBackend.createCategory({
          name: suggestionName,
          createdBy: 'admin'
        });
      }
      
      await loadData();
      onRefresh();
    } catch (err) {
      console.error('Failed to approve suggestion:', err);
      alert('Failed to approve suggestion');
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      await saltBackend.rejectTagSuggestion(id);
      await loadData();
    } catch (err) {
      console.error('Failed to reject suggestion:', err);
      alert('Failed to reject suggestion');
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 bg-white border border-gray-200 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
            activeTab === 'suggestions'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending Suggestions ({suggestions.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
            activeTab === 'categories'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          All Categories ({categories.length})
        </button>
      </div>

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <Card className="p-6 text-center text-gray-500 bg-gray-50">
              <p>No pending suggestions. AI learner is doing well!</p>
            </Card>
          ) : (
            suggestions.map(suggestion => (
              <Card key={suggestion.id} className="p-4 border border-yellow-200 bg-yellow-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold text-gray-900">{suggestion.name}</h4>
                    <div className="text-sm text-gray-600">
                      <p>Recipe: {recipeTitles[suggestion.recipeId] || suggestion.recipeId}</p>
                      <p>Confidence: {(suggestion.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveSuggestion(suggestion.id, suggestion.name)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium transition active:scale-95"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectSuggestion(suggestion.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium transition active:scale-95"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {/* Create New Category Form */}
          <Card className="p-4 border border-orange-200 bg-orange-50 space-y-3">
            <h4 className="font-semibold text-gray-900">Create New Category</h4>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="e.g. Pasta Dishes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <input
                value={newCategoryDesc}
                onChange={e => setNewCategoryDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Synonyms (comma-separated)</Label>
              <input
                value={newCategorySynonyms}
                onChange={e => setNewCategorySynonyms(e.target.value)}
                placeholder="e.g. Noodles, Italian, Spaghetti"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
              />
            </div>
            <button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || isCreating}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg font-medium transition active:scale-95"
            >
              {isCreating ? 'Creating...' : 'Create Category'}
            </button>
          </Card>

          {/* Categories List */}
          <div className="space-y-3">
            {categories.length === 0 ? (
              <Card className="p-6 text-center text-gray-500 bg-gray-50">
                <p>No categories yet. Create one above to start!</p>
              </Card>
            ) : (
              categories.map(category => (
                <Card key={category.id} className="p-4 border border-gray-200 hover:border-gray-300 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-gray-900">{category.name}</h4>
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                      {category.synonyms && category.synonyms.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {category.synonyms.map((syn, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              {syn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium transition active:scale-95 shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
