import React from 'react';

interface RecipeTabNavigationProps {
  activeTab: 'detail' | 'chat' | 'cook';
  onTabChange: (tab: 'detail' | 'chat' | 'cook') => void;
}

export const RecipeTabNavigation: React.FC<RecipeTabNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex px-2 py-1 gap-2">
        {[
          { id: 'detail', label: 'Recipe' },
          { id: 'chat', label: 'Chef' },
          { id: 'cook', label: 'Cook' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as 'detail' | 'chat' | 'cook')}
            className={`flex-1 py-2 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors border ${
              activeTab === tab.id
                ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm'
                : 'bg-gray-100 text-gray-600 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
