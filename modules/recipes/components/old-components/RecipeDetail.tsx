import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Button, Input, Label, ErrorBoundary } from '../../../components/UI';
import { ImageEditor } from './ImageEditor';
import { CookMode } from './CookMode';
import { Recipe, Equipment, RecipeHistoryEntry, User, RecipeCategory, RecipeSchema } from '../../../types/contract';
import { recipesBackend } from '../backend';
import { kitchenDataBackend } from '../../kitchen-data';
import { marked } from 'marked';
import { buildManualEditSummary, createHistoryEntry, applyCategoryChange, scaleIngredients } from '../backend/recipe-updates';

// Modal components
import { ProposalModal } from './ProposalModal';
import { RollbackConfirmModal } from './RollbackConfirmModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CategoryPickerModal } from './CategoryPickerModal';
import { HistoryModal } from './HistoryModal';
import { ImageEditorModalWrapper } from './ImageEditorModalWrapper';
import { RepairRecipeModal } from './RepairRecipeModal';

// Section components
import { AtAGlanceSection } from './AtAGlanceSection';
import { RecipeImageCard } from './RecipeImageCard';
import { RecipeIngredientsSection } from './RecipeIngredientsSection';
import { RecipeInstructionsSection } from './RecipeInstructionsSection';
import { RecipeCategoryDisplay } from './RecipeCategoryDisplay';
import { RecipeChefSidebar } from './RecipeChefSidebar';
import { RecipeEditModeBar } from './RecipeEditModeBar';
import { RecipeTabNavigation } from './RecipeTabNavigation';
import { WorkflowAdviceSection } from './WorkflowAdviceSection';
import { RecipeHistorySection } from './RecipeHistorySection';
import { EditableMetadataSection } from './EditableMetadataSection';

export interface RecipeDetailProps {
  recipe: Recipe;
  inventory: Equipment[];
  onClose: () => void;
  onRefresh: () => void;
  currentUser: User;
}

const RemoteImage: React.FC<{ path?: string; className?: string; alt?: string }> = ({ path, className, alt }) => {
  const [src, setSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (path) {
      setIsLoading(true);
      recipesBackend.resolveImagePath(path)
        .then(setSrc)
        .catch(() => setSrc(''))
        .finally(() => setIsLoading(false));
    } else {
      setSrc('');
      setIsLoading(false);
    }
  }, [path]);

  if (isLoading) {
    return (
      <div className={`${className} bg-gray-50 flex items-center justify-center`}>
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`${className} bg-gray-50 flex items-center justify-center text-gray-200 uppercase font-black text-[10px] tracking-widest`}>
        No Image
      </div>
    );
  }

  return <img src={src} className={className} alt={alt} />;
};

const sanitizeJson = (text: string): string => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1) {
    const startArr = text.indexOf('[');
    const endArr = text.lastIndexOf(']');
    return startArr !== -1 && endArr !== -1 ? text.substring(startArr, endArr + 1) : text.trim();
  }
  return start !== -1 && end !== -1 ? text.substring(start, end + 1) : text.trim();
};

interface Proposal {
  id: string;
  description: string;
  technicalInstruction: string;
  selected: boolean;
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe: initialRecipe, inventory, onClose, onRefresh, currentUser }) => {
  const [recipe, setRecipe] = useState<Recipe>(initialRecipe);
  const [activeTab, setActiveTab] = useState<'detail' | 'chat' | 'cook'>('detail');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'analyzing' | 'saving'>('idle');
  const [pendingProposals, setPendingProposals] = useState<Proposal[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showRollbackConfirmModal, setShowRollbackConfirmModal] = useState(false);
  const [pendingRollbackEntry, setPendingRollbackEntry] = useState<RecipeHistoryEntry | null>(null);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [imageActionsVisible, setImageActionsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState<Recipe | null>(null);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [isServingsChanging, setIsServingsChanging] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairStages, setRepairStages] = useState({
    categorise: true,
    relinkIngredients: true
  });

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const getCategoryName = (categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  useEffect(() => { setRecipe(initialRecipe); }, [initialRecipe]);

  useEffect(() => {
    // Load categories for display
    kitchenDataBackend.getCategories().then(cats => setCategories(cats)).catch(err => console.error('Failed to load categories:', err));
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);



  // Message handlers
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput || isTyping || isUpdating) return;
    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);
    setMessages(prev => [...prev, { role: 'ai', text: '' }]);
    try {
      await recipesBackend.chatWithRecipe(recipe, userMsg, messages, (chunk) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai') {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, text: last.text + chunk };
            return updated;
          }
          return prev;
        });
      });
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev.slice(0, -1), { role: 'ai', text: 'Culinary advice unavailable.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (isUpdating || isTyping || messages.length === 0) return;
    setIsUpdating(true);
    setUpdateStatus('analyzing');
    try {
      const summaryResponse = await recipesBackend.summarizeAgreedRecipe(messages, recipe);
      const { proposals } = JSON.parse(sanitizeJson(summaryResponse));
      setPendingProposals((proposals || []).map((p: any) => ({ ...p, selected: true })));
    } catch (err) {
      console.error(err);
      alert("Analysis failed.");
    } finally {
      setIsUpdating(false);
      setUpdateStatus('idle');
    }
  };

  const commitUpdate = async () => {
    if (!pendingProposals) return;
    const selected = pendingProposals.filter(p => p.selected);
    if (selected.length === 0) {
      setPendingProposals(null);
      return;
    }
    setIsUpdating(true);
    setUpdateStatus('saving');
    try {
      const consolidatedInstructions = selected.map(p => p.technicalInstruction).join("\n");
      const updatedData = await recipesBackend.generateRecipeFromPrompt(consolidatedInstructions, recipe, messages);
      const leanSnapshot = { ...recipe };
      delete (leanSnapshot as any).history;
      const summaryStr = selected.map(p => p.description).join("; ");
      const historyEntry: RecipeHistoryEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUser.displayName,
        changeDescription: summaryStr || 'Applied discussed refinements.',
        snapshot: leanSnapshot
      };
      const updated = await recipesBackend.updateRecipe(recipe.id, {
        ...updatedData,
        history: [...(recipe.history || []), historyEntry]
      });
      setRecipe(updated);
      setMessages(prev => [...prev, { role: 'ai', text: `Changes applied: **${summaryStr}**` }]);
      setPendingProposals(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Save failed.");
    } finally {
      setIsUpdating(false);
      setUpdateStatus('idle');
    }
  };

  const handleRestoreVersion = async (entry: RecipeHistoryEntry) => {
    setIsUpdating(true);
    try {
      const leanSnapshot = { ...recipe };
      delete (leanSnapshot as any).history;
      const safetyEntry: RecipeHistoryEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUser.displayName,
        changeDescription: 'Rollback point: Snapshot created before restoring.',
        snapshot: leanSnapshot
      };
      const updated = await recipesBackend.updateRecipe(recipe.id, {
        ...entry.snapshot,
        history: [...(recipe.history || []), safetyEntry]
      });
      setRecipe(updated);
      setShowHistory(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Restoration failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRegenerateImage = async () => {
    setIsRegeneratingImage(true);
    try {
      const imageData = await recipesBackend.generateRecipeImage(recipe.title, recipe.description);
      const updated = await recipesBackend.updateRecipe(recipe.id, {}, imageData);
      setRecipe(updated);
      
      // Delay the parent refresh to avoid race condition with Firestore cache
      setTimeout(() => {
        onRefresh();
      }, 500);
    } catch (err) {
      console.error(err);
      alert('Failed to regenerate image');
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleImageUpdate = async (imageData: string) => {
    setIsRegeneratingImage(true);
    try {
      const updated = await recipesBackend.updateRecipe(recipe.id, {}, imageData);
      setRecipe(updated);
      setShowImageEditor(false);
      
      // Delay the parent refresh to avoid race condition with Firestore cache
      setTimeout(() => {
        onRefresh();
      }, 500);
    } catch (err) {
      console.error(err);
      alert('Failed to update image');
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel - discard changes
      setEditedRecipe(null);
      setIsEditing(false);
    } else {
      // Start editing - make a copy
      setEditedRecipe({ ...recipe });
      setIsEditing(true);
    }
  };

  const handleMetadataChange = (field: 'prepTime' | 'cookTime' | 'totalTime' | 'servings' | 'complexity', value: string) => {
    if (!editedRecipe) return;
    setEditedRecipe({ ...editedRecipe, [field]: value });
  };

  const handleServingsAdjust = async (newServings: string) => {
    // Scale ingredients and update recipe without creating history entry
    const scaledIngredients = scaleIngredients(recipe.ingredients, recipe.servings, newServings);
    
    setIsServingsChanging(true);
    try {
      const updated = await recipesBackend.updateRecipe(recipe.id, {
        servings: newServings,
        ingredients: scaledIngredients
      });
      setRecipe(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to adjust servings:', err);
      alert('Failed to adjust servings.');
    } finally {
      setIsServingsChanging(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!editedRecipe) return;
    
    setIsUpdating(true);
    try {
      // Validate against contract schema
      const validationResult = RecipeSchema.safeParse(editedRecipe);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        alert(`Validation failed: ${errors}`);
        setIsUpdating(false);
        return;
      }

      // Generate detailed change description
      const editSummary = buildManualEditSummary(recipe, editedRecipe);
      
      // Create history entry
      const historyEntry = createHistoryEntry(recipe, editSummary, currentUser.displayName);

      const updated = await recipesBackend.updateRecipe(recipe.id, {
        ...editedRecipe,
        history: [...(recipe.history || []), historyEntry]
      });
      setRecipe(updated);
      setEditedRecipe(null);
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Save failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRecipe = async () => {
    try {
      await recipesBackend.deleteRecipe(recipe.id);
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  };

  const handleRunRepair = async () => {
    if (!repairStages.categorise && !repairStages.relinkIngredients) return;

    setIsRepairing(true);
    try {
      const updates: Partial<Recipe> = {};

      if (repairStages.relinkIngredients) {
        updates.ingredients = recipe.ingredients || [];
      }

      if (!repairStages.categorise) {
        updates.categoryIds = recipe.categoryIds || [];
      }

      const updated = await recipesBackend.updateRecipe(recipe.id, updates);
      setRecipe(updated);
      setShowRepairModal(false);
      onRefresh();
    } catch (err) {
      console.error('Repair failed:', err);
      alert('Repair failed.');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleRemoveCategory = async (categoryId: string) => {
    if (isEditing && editedRecipe) {
      const updatedCategoryIds = applyCategoryChange(editedRecipe, categoryId, 'remove');
      setEditedRecipe({
        ...editedRecipe,
        categoryIds: updatedCategoryIds
      });
    } else {
      const updatedCategoryIds = applyCategoryChange(recipe, categoryId, 'remove');
      // Update local state immediately for instant UI feedback
      setRecipe({ ...recipe, categoryIds: updatedCategoryIds });
      // Persist in background
      try {
        const updated = await recipesBackend.updateRecipe(recipe.id, { categoryIds: updatedCategoryIds });
        setRecipe(updated);
        onRefresh();
      } catch (err) {
        console.error('Failed to update categories:', err);
        // Revert on error
        setRecipe(recipe);
      }
    }
  };

  const handleAddCategory = async (categoryId: string) => {
    setShowCategorySelector(false);
    
    if (isEditing && editedRecipe) {
      const updatedCategoryIds = applyCategoryChange(editedRecipe, categoryId, 'add');
      // Always update if the helper returned a different array
      if (JSON.stringify(updatedCategoryIds) !== JSON.stringify(editedRecipe.categoryIds)) {
        setEditedRecipe({
          ...editedRecipe,
          categoryIds: updatedCategoryIds
        });
      }
    } else {
      const updatedCategoryIds = applyCategoryChange(recipe, categoryId, 'add');
      // Always update if the helper returned a different array
      if (JSON.stringify(updatedCategoryIds) !== JSON.stringify(recipe.categoryIds)) {
        // Update local state immediately for instant UI feedback
        setRecipe({ ...recipe, categoryIds: updatedCategoryIds });
        // Persist in background
        try {
          const updated = await recipesBackend.updateRecipe(recipe.id, { categoryIds: updatedCategoryIds });
          setRecipe(updated);
          onRefresh();
        } catch (err) {
          console.error('Failed to update categories:', err);
          // Revert on error
          setRecipe(recipe);
        }
      }
    }
  };

  const renderMarkdown = (text: string) => {
    try { 
      const result = marked.parse(text);
      return { __html: typeof result === 'string' ? result : text }; 
    } catch (e) { 
      return { __html: text }; 
    }
  };

  return (
    <div 
      className="fixed inset-0 md:inset-x-0 md:top-16 md:bottom-0 bg-black/40 z-300 flex md:items-center md:justify-center md:px-4 md:py-6" 
      onClick={onClose}
      onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      {/* Proposal Modal */}
      {pendingProposals && (
        <ProposalModal
          proposals={pendingProposals}
          onToggle={(id) => setPendingProposals(prev => prev?.map(item => item.id === id ? { ...item, selected: !item.selected } : item) || [])}
          onApply={commitUpdate}
          onCancel={() => setPendingProposals(null)}
          isLoading={isUpdating}
        />
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirmModal && pendingRollbackEntry && (
        <RollbackConfirmModal
          entry={pendingRollbackEntry}
          onConfirm={async () => {
            await handleRestoreVersion(pendingRollbackEntry);
            setShowRollbackConfirmModal(false);
            setPendingRollbackEntry(null);
          }}
          onCancel={() => {
            setShowRollbackConfirmModal(false);
            setPendingRollbackEntry(null);
          }}
          isLoading={isUpdating}
        />
      )}

      {/* Delete Modal */}
      {showDeleteConfirmModal && (
        <DeleteConfirmModal
          onConfirm={handleDeleteRecipe}
          onCancel={() => setShowDeleteConfirmModal(false)}
        />
      )}

      {/* Category Picker Modal */}
      {showCategorySelector && (
        <CategoryPickerModal
          categories={categories}
          selectedCategoryIds={(isEditing && editedRecipe) ? (editedRecipe.categoryIds || []) : (recipe.categoryIds || [])}
          onAdd={handleAddCategory}
          onClose={() => setShowCategorySelector(false)}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <HistoryModal
          recipe={recipe}
          onClose={() => setShowHistory(false)}
          onRollback={(entry) => {
            setPendingRollbackEntry(entry);
            setShowRollbackConfirmModal(true);
          }}
        />
      )}

      {/* Image Editor Modal */}
      {showImageEditor && (
        <ImageEditorModalWrapper
          onSave={handleImageUpdate}
          onCancel={() => setShowImageEditor(false)}
        />
      )}

      {/* Repair Modal */}
      {showRepairModal && (
        <RepairRecipeModal
          stages={repairStages}
          onToggle={(key) => setRepairStages(prev => ({ ...prev, [key]: !prev[key] }))}
          onRun={handleRunRepair}
          onCancel={() => setShowRepairModal(false)}
          isRunning={isRepairing}
        />
      )}

      {/* Main Detail View */}
      <div
        className="bg-white w-full h-full md:h-auto md:max-h-[calc(100vh-7rem)] md:max-w-6xl md:rounded-2xl flex flex-col overflow-hidden shadow-2xl relative cursor-default"
        onClick={e => e.stopPropagation()}
        style={{ 
          touchAction: 'pan-y', 
          overscrollBehavior: 'contain'
        }}
      >
        {/* Mobile Header */}
        <div className="md:hidden border-b border-gray-200 bg-white px-4 h-16 flex items-center justify-between shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate pr-4">{recipe.title}</h2>
            {activeTab === 'cook' && (recipe.instructions?.length || 0) > 0 && (
              <p className="text-[11px] font-semibold text-orange-600 truncate">Cooking...</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'detail' && (
              <button
                onClick={handleEditToggle}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
                  isEditing ? 'text-gray-600 hover:text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'
                }`}
                aria-label={isEditing ? "Cancel edit" : "Edit recipe"}
                title={isEditing ? "Cancel edit" : "Edit recipe"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowRepairModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-orange-600 hover:text-orange-700 transition-colors shrink-0"
              aria-label="Repair recipe"
              title="Repair recipe"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232a3 3 0 0 1 4.243 4.243l-6.364 6.364a2 2 0 0 1-1.414.586H8.586a1 1 0 0 1-1-1v-2.121a2 2 0 0 1 .586-1.414l6.364-6.364Z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18h6"/>
              </svg>
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-blue-600 hover:text-blue-800 transition-colors shrink-0"
              aria-label="View recipe history"
              title="Rollback to earlier version"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirmModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 transition-colors shrink-0"
              aria-label="Delete recipe"
              title="Delete recipe"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 transition-colors shrink-0"
              aria-label="Close recipe"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden md:flex border-b border-gray-200 bg-white px-6 py-4 items-center justify-between">
          <div className="flex items-center gap-3">
            {[{ id: 'detail', label: 'Recipe' }, { id: 'cook', label: 'Cook' }].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 text-sm font-bold uppercase transition-colors rounded-full border ${
                  activeTab === tab.id
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'text-gray-600 hover:bg-gray-100 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {activeTab === 'cook' && (recipe.instructions?.length || 0) > 0 && (
              <span className="text-xs font-semibold text-orange-600">Cooking...</span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {activeTab === 'detail' && (
              <button
                onClick={handleEditToggle}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
                  isEditing ? 'text-gray-600 hover:text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'
                }`}
                title={isEditing ? "Cancel edit" : "Edit recipe"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowRepairModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-orange-600 hover:text-orange-700 transition-colors shrink-0"
              title="Repair recipe"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232a3 3 0 0 1 4.243 4.243l-6.364 6.364a2 2 0 0 1-1.414.586H8.586a1 1 0 0 1-1-1v-2.121a2 2 0 0 1 .586-1.414l6.364-6.364Z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18h6"/>
              </svg>
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-blue-600 hover:text-blue-800 transition-colors shrink-0"
              title="Rollback to earlier version"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirmModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 transition-colors shrink-0"
              title="Delete recipe"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 transition-colors shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Mobile Title Header */}
        {/* Removed mobile title bar to reduce redundancy */}

        {/* Progress Bar */}
        {activeTab === 'cook' && (
          <div className="h-1 bg-gray-100 w-full overflow-hidden sticky top-0 z-20">
            <div className="h-full bg-orange-600 transition-all duration-500" style={{ width: `${(recipe.instructions?.length || 0) > 0 ? 100 : 0}%` }} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-gray-50 min-h-0">
          {activeTab === 'detail' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-17 md:pb-10 min-h-0">
              <div className="w-full mx-auto space-y-6">
                {/* Heading + CTA */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <h1 className="text-2xl font-bold text-gray-900">{isEditing && editedRecipe ? editedRecipe.title : recipe.title}</h1>
                  {isEditing && editedRecipe ? (
                    <input
                      type="text"
                      value={editedRecipe.title}
                      onChange={(e) => setEditedRecipe({ ...editedRecipe, title: e.target.value })}
                      className="flex-1 text-2xl font-bold border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Recipe title"
                    />
                  ) : null}
                </div>

                {/* Categories Display and Selector */}
                <RecipeCategoryDisplay
                  categoryIds={(isEditing && editedRecipe) ? (editedRecipe.categoryIds || []) : (recipe.categoryIds || [])}
                  categories={categories}
                  onRemove={handleRemoveCategory}
                  onAddClick={() => setShowCategorySelector(true)}
                />

                {/* At a Glance - Desktop */}
                <div className="hidden lg:block mt-3">
                  {isEditing && editedRecipe ? (
                    <EditableMetadataSection
                      editedRecipe={editedRecipe}
                      onMetadataChange={handleMetadataChange}
                    />
                  ) : (
                    <AtAGlanceSection recipe={recipe} onServingsChange={handleServingsAdjust} isServingsChanging={isServingsChanging} />
                  )}
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left column */}
                  <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-2 self-start">
                    <RecipeImageCard
                      recipe={recipe}
                      isRegeneratingImage={isRegeneratingImage}
                      imageActionsVisible={imageActionsVisible}
                      onImageClick={() => setImageActionsVisible(!imageActionsVisible)}
                      onRegenerateImage={handleRegenerateImage}
                      onEditImage={() => setShowImageEditor(true)}
                      RemoteImage={RemoteImage}
                    />

                    {/* At a Glance - Mobile */}
                    <div className="lg:hidden mb-2">
                      {isEditing && editedRecipe ? (
                        <EditableMetadataSection
                          editedRecipe={editedRecipe}
                          onMetadataChange={handleMetadataChange}
                        />
                      ) : (
                        <AtAGlanceSection recipe={recipe} onServingsChange={handleServingsAdjust} isServingsChanging={isServingsChanging} />
                      )}
                    </div>

                    <RecipeIngredientsSection
                      recipe={recipe}
                      editedRecipe={editedRecipe}
                      isEditing={isEditing}
                      onEditIngredient={(index, value) => {
                        if (!editedRecipe) return;
                        const updated = [...(editedRecipe.ingredients || [])];
                        updated[index] = value;
                        setEditedRecipe({ ...editedRecipe, ingredients: updated });
                      }}
                      onDeleteIngredient={(index) => {
                        if (!editedRecipe) return;
                        const updated = (editedRecipe.ingredients || []).filter((_, idx) => idx !== index);
                        setEditedRecipe({ ...editedRecipe, ingredients: updated });
                      }}
                      onAddIngredient={() => {
                        if (!editedRecipe) return;
                        setEditedRecipe({ ...editedRecipe, ingredients: [...(editedRecipe.ingredients || []), ''] });
                      }}
                    />

                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">Equipment Needed</h3>
                      {recipe.equipmentNeeded && recipe.equipmentNeeded.length > 0 ? (
                        <ul className="space-y-2">
                          {recipe.equipmentNeeded.map((eq, idx) => (
                            <li key={idx} className="text-base text-gray-700 flex items-start gap-2">
                              <span className="mt-2 w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                              {eq}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No equipment listed.</p>
                      )}
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="lg:col-span-7 space-y-6">
                    <RecipeInstructionsSection
                      recipe={recipe}
                      editedRecipe={editedRecipe}
                      isEditing={isEditing}
                      onEditInstruction={(index, value) => {
                        if (!editedRecipe) return;
                        const updated = [...(editedRecipe.instructions || [])];
                        updated[index] = value;
                        setEditedRecipe({ ...editedRecipe, instructions: updated });
                      }}
                      onDeleteInstruction={(index) => {
                        if (!editedRecipe) return;
                        const updated = (editedRecipe.instructions || []).filter((_, idx) => idx !== index);
                        setEditedRecipe({ ...editedRecipe, instructions: updated });
                      }}
                      onAddInstruction={() => {
                        if (!editedRecipe) return;
                        setEditedRecipe({ ...editedRecipe, instructions: [...(editedRecipe.instructions || []), ''] });
                      }}
                    />

                    {/* Workflow Advice Overview */}
                    <WorkflowAdviceSection workflowAdvice={recipe.workflowAdvice} />

                    {/* History */}
                    <RecipeHistorySection history={recipe.history} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Mode Save/Cancel Bar - positioned inside detail div */}
          {activeTab === 'detail' && isEditing && (
            <RecipeEditModeBar
              isUpdating={isUpdating}
              onSave={handleSaveEdits}
              onCancel={handleEditToggle}
            />
          )}

          {/* Desktop Chat Sidebar - always visible on desktop when in detail view */}
          {activeTab === 'detail' && !isEditing && (
            <RecipeChefSidebar
              recipe={recipe}
              messages={messages}
              chatInput={chatInput}
              isTyping={isTyping}
              isUpdating={isUpdating}
              pendingProposals={pendingProposals}
              chatScrollRef={chatScrollRef}
              onSendMessage={handleSendMessage}
              onChatInputChange={setChatInput}
              onApplyUpdate={handleApplyUpdate}
              onHistoryClick={() => setShowHistory(true)}
              renderMarkdown={renderMarkdown}
              isMobile={false}
            />
          )}

          {/* Mobile Chat Tab */}
          {activeTab === 'chat' && (
            <RecipeChefSidebar
              recipe={recipe}
              messages={messages}
              chatInput={chatInput}
              isTyping={isTyping}
              isUpdating={isUpdating}
              pendingProposals={pendingProposals}
              chatScrollRef={chatScrollRef}
              onSendMessage={handleSendMessage}
              onChatInputChange={setChatInput}
              onApplyUpdate={handleApplyUpdate}
              onHistoryClick={() => setShowHistory(true)}
              renderMarkdown={renderMarkdown}
              isMobile={true}
            />
          )}

          {activeTab === 'cook' && <CookMode recipe={recipe} inventory={inventory} onClose={() => setActiveTab('detail')} />}
        </div>

        {/* Mobile Tab Navigation */}
        <RecipeTabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
};
