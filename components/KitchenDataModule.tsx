import React, { useState, useEffect } from 'react';
import { CategoryManagement } from './CategoryManagement';
import { saltBackend } from '../backend/api';

interface KitchenDataModuleProps {
  onRefresh: () => void;
  onSuggestionsChanged?: () => void;
}

export const KitchenDataModule: React.FC<KitchenDataModuleProps> = ({ onRefresh, onSuggestionsChanged }) => {
  const [suggestionsCount, setSuggestionsCount] = useState(0);

  useEffect(() => {
    loadSuggestionsCount();
  }, []);

  const loadSuggestionsCount = async () => {
    try {
      const suggestions = await saltBackend.getTagSuggestions();
      const pendingCount = suggestions.filter(s => s.status === 'pending').length;
      setSuggestionsCount(pendingCount);
    } catch (err) {
      console.error('Failed to load suggestions count:', err);
    }
  };

  const handleRefresh = () => {
    loadSuggestionsCount();
    onRefresh();
  };

  const handleSuggestionsChanged = () => {
    loadSuggestionsCount();
    if (onSuggestionsChanged) {
      onSuggestionsChanged();
    }
  };

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 box-border animate-in fade-in duration-500 overflow-hidden">
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 md:py-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900">Kitchen Data</h1>
          {suggestionsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
              <span className="text-sm font-semibold text-red-700">{suggestionsCount} to approve</span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">Manage categories and recipe organization</p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recipe Categories</h2>
            <CategoryManagement onRefresh={handleRefresh} onSuggestionsChanged={handleSuggestionsChanged} />
          </div>
        </div>
      </div>
    </div>
  );
};
