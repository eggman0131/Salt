import React, { useState, useEffect } from 'react';
import { CategoryManagement } from './CategoryManagement';
import { ItemsManagement } from './ItemsManagement';
import { UnitsManagement } from './UnitsManagement';
import { AislesManagement } from './AislesManagement';
import { kitchenDataBackend } from '../backend';

type Tab = 'categories' | 'items' | 'units' | 'aisles';

interface KitchenDataModuleProps {
  onRefresh: () => void;
  onSuggestionsChanged?: () => void;
}

export const KitchenDataModule: React.FC<KitchenDataModuleProps> = ({ onRefresh, onSuggestionsChanged }) => {
  const [activeTab, setActiveTab] = useState<Tab>('categories');
  const [suggestionsCount, setSuggestionsCount] = useState(0);

  useEffect(() => {
    loadSuggestionsCount();
  }, []);

  const loadSuggestionsCount = async () => {
    try {
      const pending = await kitchenDataBackend.getPendingCategories();
      setSuggestionsCount(pending.length);
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

  const tabs = [
    { id: 'categories' as Tab, label: 'Categories', description: 'Recipe categories and organization' },
    { id: 'items' as Tab, label: 'Items', description: 'Canonical items catalog' },
    { id: 'units' as Tab, label: 'Units', description: 'Measurement units' },
    { id: 'aisles' as Tab, label: 'Aisles', description: 'Shop layout and organization' }
  ];

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 box-border animate-in fade-in duration-500 overflow-hidden">
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 md:py-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900">Kitchen Data</h1>
          {suggestionsCount > 0 && activeTab === 'categories' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
              <span className="text-sm font-semibold text-red-700">{suggestionsCount} to approve</span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {tabs.find(t => t.id === activeTab)?.description}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 md:px-6 shrink-0">
        <nav className="flex gap-4 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6">
          {activeTab === 'categories' && (
            <CategoryManagement onRefresh={handleRefresh} onSuggestionsChanged={handleSuggestionsChanged} />
          )}
          {activeTab === 'items' && (
            <ItemsManagement onRefresh={handleRefresh} />
          )}
          {activeTab === 'units' && (
            <UnitsManagement onRefresh={handleRefresh} />
          )}
          {activeTab === 'aisles' && (
            <AislesManagement onRefresh={handleRefresh} />
          )}
        </div>
      </div>
    </div>
  );
};
