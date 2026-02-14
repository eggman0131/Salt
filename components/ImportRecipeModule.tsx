import React, { useState } from 'react';
import { ImportMFPRecipeModal } from './RecipeModals/ImportMFPRecipeModal';
import { AIModule } from './AIModule';
import { User, Equipment } from '../types/contract';

interface ImportRecipeModuleProps {
  inventory: Equipment[];
  currentUser: User;
  onRecipeCreated?: () => void;
}

export const ImportRecipeModule: React.FC<ImportRecipeModuleProps> = ({ 
  inventory, 
  currentUser,
  onRecipeCreated 
}) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAIModule, setShowAIModule] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  const handleImportSubmit = (title: string, servings: string, ingredients: string) => {
    // Create the prompt for AI module
    const prompt = `Create a recipe for ${title}, ${servings} servings, use the following ingredients exactly:\n${ingredients}`;
    
    setAiMessage(prompt);
    setShowImportModal(false);
    
    // Switch to AI module
    setShowAIModule(true);
  };

  const handleAIModuleClose = () => {
    setShowAIModule(false);
    setAiMessage('');
  };

  const handleRecipeCreated = () => {
    handleAIModuleClose();
    if (onRecipeCreated) {
      onRecipeCreated();
    }
  };

  return (
    <>
      {/* Dashboard Card - Only show when not in AI module */}
      {!showAIModule && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Import Recipe</h2>
          <p className="text-gray-600">
            Import a recipe by providing basic details and ingredients. Our Head Chef will complete the recipe.
          </p>
          
          <button
            onClick={() => setShowImportModal(true)}
            className="w-full px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors"
          >
            Import Recipe
          </button>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportMFPRecipeModal
          onSubmit={handleImportSubmit}
          onCancel={() => setShowImportModal(false)}
        />
      )}

      {/* AI Module - shown when processing the import */}
      {showAIModule && (
        <AIModule
          initialUserMessage={aiMessage}
          onRecipeGenerated={handleRecipeCreated}
        />
      )}
    </>
  );
};
