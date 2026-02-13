import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Button, Input, Label, ErrorBoundary } from './UI';
import { ImageEditor } from './ImageEditor';
import { CookMode } from './CookMode';
import { Recipe, Equipment, RecipeHistoryEntry, User, RecipeCategory } from '../types/contract';
import { saltBackend, sanitizeJson } from '../backend/api';
import { marked } from 'marked';

interface RecipeDetailProps {
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
      saltBackend.resolveImagePath(path)
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
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [imageActionsVisible, setImageActionsVisible] = useState(false);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const getCategoryName = (categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  useEffect(() => { setRecipe(initialRecipe); }, [initialRecipe]);

  useEffect(() => {
    // Load categories for display
    saltBackend.getCategories().then(cats => setCategories(cats)).catch(err => console.error('Failed to load categories:', err));
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
      await saltBackend.chatWithRecipe(recipe, userMsg, messages, (chunk) => {
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
      const summaryResponse = await saltBackend.summarizeAgreedRecipe(messages, recipe);
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
      const updatedData = await saltBackend.generateRecipeFromPrompt(consolidatedInstructions, recipe, messages);
      const leanSnapshot = { ...recipe };
      delete (leanSnapshot as any).history;
      const summaryStr = selected.map(p => p.description).join("; ");
      const historyEntry: RecipeHistoryEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUser.displayName,
        changeDescription: summaryStr || 'Applied discussed refinements.',
        snapshot: leanSnapshot
      };
      const updated = await saltBackend.updateRecipe(recipe.id, {
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
    if (!window.confirm('Restore this version?')) return;
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
      const updated = await saltBackend.updateRecipe(recipe.id, {
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
      const imageData = await saltBackend.generateRecipeImage(recipe.title);
      const updated = await saltBackend.updateRecipe(recipe.id, {}, imageData);
      setRecipe(updated);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleImageUpdate = async (imageData: string) => {
    setIsRegeneratingImage(true);
    try {
      const updated = await saltBackend.updateRecipe(recipe.id, {}, imageData);
      setRecipe(updated);
      setShowImageEditor(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleDeleteRecipe = async () => {
    try {
      await saltBackend.deleteRecipe(recipe.id);
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  };


  const renderMarkdown = (text: string) => {
    try { return { __html: marked.parse(text) }; } catch (e) { return { __html: text }; }
  };

  return (
    <div 
      className="fixed inset-0 md:inset-x-0 md:top-16 md:bottom-0 bg-black/40 z-[300] flex md:items-center md:justify-center md:px-4 md:py-6" 
      onClick={onClose}
      onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      {/* Proposal Modal */}
      {pendingProposals && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPendingProposals(null)}
          onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          <Card className="w-full max-w-md bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Review Changes</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pendingProposals.map(p => (
                  <label key={p.id} className={`flex gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    p.selected ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={() => setPendingProposals(prev => prev?.map(item => item.id === p.id ? { ...item, selected: !item.selected } : item) || [])}
                      className="mt-1 w-4 h-4 text-orange-600"
                    />
                    <span className="text-sm font-medium text-gray-900">{p.description}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={commitUpdate}
                  disabled={isUpdating || pendingProposals.every(p => !p.selected)}
                  className="flex-1 h-10 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50"
                >
                  {isUpdating ? 'Processing...' : 'Apply'}
                </button>
                <button
                  onClick={() => setPendingProposals(null)}
                  className="flex-1 h-10 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirmModal(false)}
          onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          <Card className="w-full max-w-sm bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-red-600">Delete Recipe?</h3>
              <p className="text-sm text-gray-600">This action cannot be undone.</p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDeleteRecipe}
                  className="flex-1 h-10 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="flex-1 h-10 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowHistory(false)}
          onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          <Card className="w-full max-w-lg bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Recipe History</h3>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {recipe.history && recipe.history.length > 0 ? (
                  recipe.history.map((entry, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2">
                      <p className="font-medium text-gray-900">{entry.changeDescription}</p>
                      <p className="text-xs text-gray-500">
                        {entry.userName} • {new Date(entry.timestamp).toLocaleDateString()}
                      </p>
                      <button
                        onClick={() => handleRestoreVersion(entry)}
                        className="w-full h-8 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                      >
                        Restore
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-4 text-sm">No history available</p>
                )}
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-full h-10 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Image Editor Modal */}
      {showImageEditor && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowImageEditor(false)}
          onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          <Card className="w-full max-w-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <ImageEditor 
              onSave={handleImageUpdate}
              onCancel={() => setShowImageEditor(false)}
            />
          </Card>
        </div>
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
          <div className="h-1 bg-gray-100 w-full relative overflow-hidden sticky top-0 z-20">
            <div className="h-full bg-orange-600 transition-all duration-500" style={{ width: `${(recipe.instructions?.length || 0) > 0 ? 100 : 0}%` }} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-gray-50 min-h-0">
          {activeTab === 'detail' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-[68px] md:pb-10 min-h-0">
              <div className="w-full mx-auto space-y-6">
                {/* Heading + CTA */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-3">
                      <h1 className="hidden md:block text-2xl font-semibold text-gray-900">{recipe.title}</h1>
                      <p className="text-base text-gray-700 leading-relaxed">{recipe.description}</p>
                      <div className="space-y-2">
                        {recipe.categoryIds && recipe.categoryIds.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {recipe.categoryIds.map(catId => (
                              <span key={catId} className="inline-block px-2.5 py-1 rounded text-xs bg-blue-50 text-blue-700 font-medium border border-blue-100">
                                {getCategoryName(catId)}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Source URL display moved to At a Glance */}
                      </div>
                      <div className="hidden lg:block">
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">At a Glance</h3>
                            {recipe.collection && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                                {recipe.collection}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px] text-gray-700">
                            <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                              <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h8M12 8v8"/></svg>
                                Complexity
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.complexity}</p>
                            </div>
                            <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                              <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-9 4h10m-7 4h4"/></svg>
                                Prep
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.prepTime}</p>
                            </div>
                            <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                              <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2s-2 2-2 5 2 5 2 5 2-2 2-5-2-5-2-5zm5 7c0 4-3 7-5 7s-5-3-5-7"/></svg>
                                Cook
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.cookTime}</p>
                            </div>
                            <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                              <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
                                Total
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.totalTime}</p>
                            </div>
                            <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                              <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="3" strokeWidth="2"/><circle cx="17" cy="9" r="2" strokeWidth="2"/></svg>
                                Servings
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.servings}</p>
                            </div>
                            <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                              <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-9 4h10m-7 4h4"/></svg>
                                Created
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-900">{new Date(recipe.createdAt).toLocaleDateString()}</p>
                            </div>
                            {recipe.source && (() => {
                              let site = '';
                              try {
                                site = new URL(recipe.source).hostname.replace(/^www\./, '');
                              } catch {}
                              return site ? (
                                <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100 sm:col-span-2 lg:col-span-2">
                                  <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8h6m-6 4h6m-6 4h6M6 8h.01M6 12h.01M6 16h.01"/></svg>
                                    Source
                                  </p>
                                  <a
                                    href={recipe.source}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-0.5 inline-block text-xs font-semibold text-orange-600 hover:text-orange-700 underline"
                                  >
                                    {site}
                                  </a>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                  </div>
                  <div className="flex gap-2 flex-wrap" />
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left column */}
                  <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-2 self-start">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <div
                        className="aspect-video bg-gray-100 relative group"
                        onClick={() => setImageActionsVisible(!imageActionsVisible)}
                      >
                        {recipe.imagePath ? (
                          <RemoteImage path={recipe.imagePath} className="w-full h-full object-cover" alt={recipe.title} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs uppercase tracking-wide">No Image</div>
                        )}

                        <div
                          className={`absolute inset-0 flex items-center justify-center gap-3 px-3 transition-opacity duration-200 ${imageActionsVisible ? 'opacity-100' : 'opacity-0'} md:opacity-0 md:group-hover:opacity-100`}
                        >
                          <button
                            onClick={handleRegenerateImage}
                            disabled={isRegeneratingImage}
                            className="px-3 py-2 bg-white/95 text-gray-900 text-xs font-semibold rounded-lg shadow-sm border border-white/70 hover:bg-white disabled:opacity-60"
                          >
                            {isRegeneratingImage ? 'Generating...' : 'Regenerate Image'}
                          </button>
                          <button
                            onClick={() => setShowImageEditor(true)}
                            className="px-3 py-2 bg-white/95 text-gray-900 text-xs font-semibold rounded-lg shadow-sm border border-white/70 hover:bg-white"
                          >
                            Upload & Crop
                          </button>
                        </div>

                        {/* Complexity and time elements moved to At a Glance */}
                      </div>
                      {/* Complexity and time elements moved to At a Glance */}
                    </div>

                    <div className="lg:hidden bg-white border border-gray-200 rounded-xl shadow-sm p-3 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">At a Glance</h3>
                        {recipe.collection && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                            {recipe.collection}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px] text-gray-700">
                        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h8M12 8v8"/></svg>
                            Complexity
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.complexity}</p>
                        </div>
                        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-9 4h10m-7 4h4"/></svg>
                            Prep
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.prepTime}</p>
                        </div>
                        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2s-2 2-2 5 2 5 2 5 2-2 2-5-2-5-2-5zm5 7c0 4-3 7-5 7s-5-3-5-7"/></svg>
                            Cook
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.cookTime}</p>
                        </div>
                        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
                            Total
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.totalTime}</p>
                        </div>
                        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="3" strokeWidth="2"/><circle cx="17" cy="9" r="2" strokeWidth="2"/></svg>
                            Servings
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.servings}</p>
                        </div>
                        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
                          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-9 4h10m-7 4h4"/></svg>
                            Created
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-gray-900">{new Date(recipe.createdAt).toLocaleDateString()}</p>
                        </div>
                        {recipe.source && (() => {
                          let site = '';
                          try {
                            site = new URL(recipe.source).hostname.replace(/^www\./, '');
                          } catch {}
                          return site ? (
                            <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100 sm:col-span-2 lg:col-span-2">
                              <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8h6m-6 4h6m-6 4h6M6 8h.01M6 12h.01M6 16h.01"/></svg>
                                Source
                              </p>
                              <a
                                href={recipe.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-0.5 inline-block text-xs font-semibold text-orange-600 hover:text-orange-700 underline"
                              >
                                {site}
                              </a>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">Ingredients</h3>
                      <ul className="space-y-2">
                        {(recipe.ingredients || []).map((ing, i) => (
                          <li key={i} className="flex items-start gap-3 text-base text-gray-700">
                            <span className="mt-2 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">Equipment Needed</h3>
                      {recipe.equipmentNeeded && recipe.equipmentNeeded.length > 0 ? (
                        <ul className="space-y-2">
                          {recipe.equipmentNeeded.map((eq, idx) => (
                            <li key={idx} className="text-base text-gray-700 flex items-start gap-2">
                              <span className="mt-2 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
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
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">Instructions</h3>
                      <div className="space-y-4">
                        {(recipe.instructions || []).map((inst, i) => (
                          <div key={i} className="flex gap-4">
                            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm">
                              {i + 1}
                            </span>
                            <p className="text-base text-gray-700 leading-relaxed">{inst}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Workflow Advice */}
                    {(recipe.workflowAdvice?.parallelTracks || recipe.workflowAdvice?.technicalWarnings || recipe.workflowAdvice?.optimumToolLogic) && (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
                        <h3 className="text-xl font-semibold text-gray-900">Workflow Advice</h3>
                        {recipe.workflowAdvice?.parallelTracks && (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600 font-semibold">Parallel Tracks</p>
                            <ul className="space-y-1">
                              {recipe.workflowAdvice.parallelTracks.map((track, idx) => (
                                <li key={idx} className="text-base text-gray-700">• {track}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {recipe.workflowAdvice?.technicalWarnings && (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600 font-semibold">Technical Warnings</p>
                            <ul className="space-y-1">
                              {recipe.workflowAdvice.technicalWarnings.map((warn, idx) => (
                                <li key={idx} className="text-base text-gray-700">• {warn}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {recipe.workflowAdvice?.optimumToolLogic && (
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600 font-semibold">Optimum Tool Logic</p>
                            <p className="text-base text-gray-700">{recipe.workflowAdvice.optimumToolLogic}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* History */}
                    {recipe.history && recipe.history.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
                        <h3 className="text-xl font-semibold text-gray-900">History</h3>
                        <div className="space-y-3">
                          {recipe.history.map((entry, idx) => (
                            <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                              <p className="text-sm text-gray-900 font-semibold">{entry.changeDescription}</p>
                              <p className="text-xs text-gray-500">{entry.userName || 'Unknown'} • {new Date(entry.timestamp).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Chat Sidebar - always visible on desktop when in detail view */}
          {activeTab === 'detail' && (
            <div className="hidden md:flex w-full md:w-1/3 flex-col overflow-hidden border-l border-gray-200 bg-gray-50 min-h-0">
              <div className="px-4 md:px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Chef's Advice</h3>
                <button
                  onClick={() => setShowHistory(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="View history"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
                  </svg>
                </button>
              </div>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`markdown-body max-w-xs px-4 py-2 rounded-lg text-sm ${
                        m.role === 'user'
                          ? 'bg-orange-600 text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-900 rounded-bl-none'
                      }`}
                      dangerouslySetInnerHTML={renderMarkdown(m.text)}
                    />
                  </div>
                ))}
                {isTyping && <p className="text-xs text-gray-500 italic px-4">Thinking...</p>}
              </div>

              <div
                className="border-t border-gray-200 bg-gray-50 p-3 md:p-4 space-y-2 mb-16 md:mb-0"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                {messages.length > 0 && !pendingProposals && (
                  <button
                    onClick={handleApplyUpdate}
                    disabled={isUpdating || isTyping}
                    className="w-full h-9 text-sm bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {isUpdating ? 'Processing...' : 'Process Changes'}
                  </button>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask the chef..."
                    className="flex-1 h-10 px-3 rounded-lg bg-white border border-gray-300 text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-100 cursor-text"
                    disabled={isTyping || isUpdating || !!pendingProposals}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput || isTyping || isUpdating || !!pendingProposals}
                    className="w-10 h-10 bg-orange-600 text-white rounded-lg flex items-center justify-center hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.98721575 L3.03521743,10.4282088 C3.03521743,10.5853061 3.34915502,10.7424035 3.50612381,10.7424035 L16.6915026,11.5278905 C16.6915026,11.5278905 17.1624089,11.5278905 17.1624089,12.0031827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/></svg>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Mobile Chat Tab */}
          {activeTab === 'chat' && (
            <div className="md:hidden flex-1 overflow-hidden flex flex-col min-h-0 h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                <h3 className="font-bold text-gray-900 text-sm">Chef's Advice</h3>
                <button
                  onClick={() => setShowHistory(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="View history"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
                  </svg>
                </button>
              </div>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 pb-[120px] md:pb-6">{messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`markdown-body max-w-xs px-4 py-2 rounded-lg text-sm ${
                        m.role === 'user'
                          ? 'bg-orange-600 text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-900 rounded-bl-none'
                      }`}
                      dangerouslySetInnerHTML={renderMarkdown(m.text)}
                    />
                  </div>
                ))}
                {isTyping && <p className="text-xs text-gray-500 italic px-4">Thinking...</p>}
              </div>

              <div
                className="border-t border-gray-200 bg-gray-50 p-3 md:p-4 space-y-2"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', marginBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
              >
                {messages.length > 0 && !pendingProposals && (
                  <button
                    onClick={handleApplyUpdate}
                    disabled={isUpdating || isTyping}
                    className="w-full h-9 text-sm bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {isUpdating ? 'Processing...' : 'Process Changes'}
                  </button>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask the chef..."
                    className="flex-1 h-10 px-3 rounded-lg bg-white border border-gray-300 text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-100 cursor-text"
                    disabled={isTyping || isUpdating || !!pendingProposals}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput || isTyping || isUpdating || !!pendingProposals}
                    className="w-10 h-10 bg-orange-600 text-white rounded-lg flex items-center justify-center hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.98721575 L3.03521743,10.4282088 C3.03521743,10.5853061 3.34915502,10.7424035 3.50612381,10.7424035 L16.6915026,11.5278905 C16.6915026,11.5278905 17.1624089,11.5278905 17.1624089,12.0031827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/></svg>
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'cook' && <CookMode recipe={recipe} inventory={inventory} onClose={() => setActiveTab('detail')} />}
        </div>

        {/* Mobile Tab Navigation */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex px-2 py-1 gap-2">
            {[
              { id: 'detail', label: 'Recipe' },
              { id: 'chat', label: 'Chef' },
              { id: 'cook', label: 'Cook' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
      </div>
    </div>
  );
};

interface RecipesModuleProps {
  recipes: Recipe[];
  inventory: Equipment[];
  onRefresh: () => void;
  currentUser: User;
  onNewRecipe: () => void;
}

type SortOption = 'newest' | 'name' | 'quick';
type ComplexityFilter = 'all' | 'Simple' | 'Intermediate' | 'Advanced';

export const RecipesModule: React.FC<RecipesModuleProps> = ({ recipes, inventory, onRefresh, currentUser, onNewRecipe }) => {
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [complexityFilter, setComplexityFilter] = useState<ComplexityFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 768;
  });
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load categories on mount
    saltBackend.getCategories().then(cats => setCategories(cats)).catch(err => console.error('Failed to load categories:', err));
  }, []);

  const toggleCategoryFilter = (categoryId: string) => {
    setSelectedCategories(prev => {
      const updated = new Set(prev);
      if (updated.has(categoryId)) {
        updated.delete(categoryId);
      } else {
        updated.add(categoryId);
      }
      return updated;
    });
  };

  const getCategoryName = (categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  const parseTimeToMinutes = (timeStr: string): number => {
    let minutes = 0;
    const hourMatch = timeStr.match(/(\d+)\s*hours?/i);
    const minMatch = timeStr.match(/(\d+)(?:\s*mins?)?(?:\s|$)/i);
    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) minutes += parseInt(minMatch[1]);
    return minutes || 0;
  };

  const formatServings = (value: any): string => {
    const str = `${value ?? ''}`.trim();
    if (!str) return '—';
    const hasLetters = /[a-zA-Z]/.test(str);
    return hasLetters ? str : `${str} servings`;
  };

  const filtered = recipes
    .filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || 
                           r.description.toLowerCase().includes(search.toLowerCase());
      const matchesComplexity = complexityFilter === 'all' || r.complexity === complexityFilter;
      // If categories are selected, recipe must match all selected categories
      const matchesCategory = selectedCategories.size === 0 || 
                 (r.categoryIds && Array.from(selectedCategories).every(catId => r.categoryIds?.includes(catId)));
      return matchesSearch && matchesComplexity && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'quick':
          return parseTimeToMinutes(a.totalTime) - parseTimeToMinutes(b.totalTime);
        case 'newest':
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });

  const availableCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    filtered.forEach(r => r.categoryIds?.forEach(catId => ids.add(catId)));
    return ids;
  }, [filtered]);

  const getRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="w-full space-y-6">
        <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-6 sticky top-16 md:top-20 z-20">
          <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-row md:items-center gap-2 w-full">
                <div className="relative flex-1">
                  <Input 
                    placeholder="Search recipes..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    className="pl-12 font-sans h-12 text-base shadow-sm border border-gray-200 bg-gray-50 focus:border-orange-500 focus:ring-orange-50 rounded-md cursor-text"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </span>
                </div>
                <button 
                  onClick={onNewRecipe} 
                  className="bg-orange-600 text-white rounded-md h-12 px-4 font-medium hover:bg-orange-700 transition shadow-sm flex items-center justify-center gap-2 shrink-0"
                  title="New Recipe"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  <span className="hidden md:inline">New Recipe</span>
                </button>
              </div>
              <div className="flex gap-2 w-full md:w-auto md:h-12">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(open => !open)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 rounded-md shadow-sm text-sm text-gray-700 flex-1 md:flex-none md:min-w-[150px] md:h-full"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M7 12h10M10 19h4"/></svg>
                  Filters
                </button>
                <div className="relative flex-1 md:flex-none md:min-w-[150px]">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full h-full px-3 py-2 pr-8 rounded-md text-sm font-semibold bg-gray-50 text-gray-700 border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-100 appearance-none"
                  >
                    <option value="newest">Newest</option>
                    <option value="name">A–Z</option>
                    <option value="quick">Quick</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M5.25 7.25L10 12l4.75-4.75" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`${filtersOpen ? 'flex' : 'hidden'} items-center gap-2 flex-wrap bg-gray-50 rounded-md shadow-sm p-4 w-full`}> 
                <div className="flex gap-2 flex-wrap w-full">
                  {(['all', 'Simple', 'Intermediate', 'Advanced'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setComplexityFilter(level as ComplexityFilter)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-all border ${
                        complexityFilter === level
                          ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm'
                          : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {level === 'all' ? 'All' : level}
                    </button>
                  ))}
                </div>

                {/* Category filters */}
                {categories.length > 0 && (
                  <div className="flex gap-2 flex-wrap w-full border-t border-gray-300 pt-3 mt-2">
                    {categories.filter(cat => availableCategoryIds.has(cat.id)).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          selectedCategories.has(cat.id)
                            ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                            : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

              </div>
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 md:mt-0">
          {filtered.map(recipe => (
            <Card 
              key={recipe.id} 
              className="cursor-pointer bg-white border-l-4 border-l-orange-600 border-y border-r border-gray-200 shadow-sm hover:bg-orange-50 transition flex flex-col overflow-hidden hover:shadow-md group"
              onClick={() => setSelectedRecipe(recipe)}
            >
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {recipe.imagePath ? (
                  <RemoteImage path={recipe.imagePath} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={recipe.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs uppercase tracking-wide">No Image</div>
                )}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  <span className="inline-block rounded-full bg-orange-100 text-orange-700 text-xs px-3 py-1 font-semibold shadow-sm">
                    {recipe.complexity}
                  </span>
                  <span className="inline-block rounded-full bg-white/90 text-gray-800 text-xs px-3 py-1 font-semibold shadow-sm">
                    {recipe.totalTime}
                  </span>
                </div>
              </div>
              <div className="p-4 md:p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{getRelativeTime(recipe.createdAt)}</span>
                  <span className="inline-flex items-center gap-1 text-orange-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    {formatServings(recipe.servings)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-tight group-hover:text-orange-700 transition-colors">{recipe.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                </div>
                {recipe.categoryIds && recipe.categoryIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 mt-auto">
                    {recipe.categoryIds.slice(0, 3).map(catId => (
                      <button
                        key={catId}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategoryFilter(catId);
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition cursor-pointer ${
                          selectedCategories.has(catId)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                        }`}
                      >
                        {getCategoryName(catId)}
                      </button>
                    ))}
                    {recipe.categoryIds.length > 3 && (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-medium">
                        +{recipe.categoryIds.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {selectedRecipe && (
          <ErrorBoundary 
            fallback={
              <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center space-y-4">
                  <div className="text-4xl">🍳</div>
                  <h2 className="text-xl font-bold text-gray-900">Recipe Malfunction</h2>
                  <p className="text-sm text-gray-600">This recipe data is causing a critical error. The Head Chef has been notified (metaphorically).</p>
                  <Button variant="primary" fullWidth onClick={() => setSelectedRecipe(null)}>Close Recipe</Button>
                </Card>
              </div>
            }
          >
            <RecipeDetail 
              recipe={selectedRecipe} 
              inventory={inventory} 
              onClose={() => setSelectedRecipe(null)} 
              onRefresh={onRefresh} 
              currentUser={currentUser}
            />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
};
