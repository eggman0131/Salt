
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Button, Input, Label } from './UI';
import { ImageEditor } from './ImageEditor';
import { Recipe, Equipment, RecipeHistoryEntry, User } from '../types/contract';
import { saltBackend } from '../backend/api';
import { marked } from 'marked';

interface RecipeDetailProps {
  recipe: Recipe;
  inventory: Equipment[];
  onClose: () => void;
  onRefresh: () => void;
  currentUser: User;
}

// @ts-ignore - EquipmentPreviewCard is defined but might be used in future or as an internal helper
const EquipmentPreviewCard: React.FC<{ equipment: Equipment; onClose: () => void }> = ({ equipment, onClose }) => {
  const accessories = equipment.accessories || [];
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <Card 
        className="w-full max-w-sm bg-white shadow-2xl border-0 overflow-hidden animate-in zoom-in-95 duration-200 p-8 relative" 
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <div className="space-y-4">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#2563eb] mb-1">{equipment.brand} • {equipment.type}</p>
            <h4 className="text-lg font-bold text-gray-900">{equipment.name}</h4>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed font-sans">{equipment.description}</p>
          {accessories.length > 0 && (
            <div className="pt-4 border-t border-gray-50">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Included Accessories</p>
              <div className="flex flex-wrap gap-2">
                {accessories.map(acc => (
                  <span key={acc.id} className={`text-[9px] px-2 py-1 rounded-md border font-bold ${acc.owned ? 'bg-blue-50 border-blue-100 text-[#2563eb]' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                    {acc.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe: initialRecipe, inventory, onClose, onRefresh, currentUser }) => {
  const [recipe, setRecipe] = useState<Recipe>(initialRecipe);
  const [mode, setMode] = useState<'refine' | 'cook'>('refine');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'finalizing' | 'saving'>('idle');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  
  const [currentStep, setCurrentStep] = useState(0); 
  const [preppedIngredients, setPreppedIngredients] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setRecipe(initialRecipe); }, [initialRecipe]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  useEffect(() => {
    if (confirmRestoreId) {
      const timer = setTimeout(() => setConfirmRestoreId(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [confirmRestoreId]);

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
          if (last && last.role === 'ai') {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, text: last.text + chunk };
            return updated;
          }
          return prev;
        });
      });
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev.slice(0, -1), { role: 'ai', text: 'I encountered an issue processing that. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (isUpdating || isTyping || messages.length === 0) return;
    setIsUpdating(true);
    try {
      setUpdateStatus('finalizing');
      const summaryResponse = await saltBackend.summarizeAgreedRecipe(messages, recipe);
      
      const sanitizedSummary = summaryResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedSummary = JSON.parse(sanitizedSummary);
      const { changeSummary, consensusDraft } = parsedSummary;
      
      setUpdateStatus('saving');
      const updatedData = await saltBackend.generateRecipeFromPrompt(consensusDraft, recipe);
      
      // Safety: Never store images in history
      const leanSnapshot = { ...recipe };
      delete (leanSnapshot as any).history;
      delete (leanSnapshot as any).imageUrl;

      const historyEntry: RecipeHistoryEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUser.displayName,
        changeDescription: changeSummary || 'Applied discussed refinements.',
        snapshot: leanSnapshot
      };

      const updated = await saltBackend.updateRecipe(recipe.id, {
        ...updatedData,
        history: [...(recipe.history || []), historyEntry]
      });
      
      setRecipe(updated);
      setMessages(prev => [...prev, { role: 'ai', text: `Changes applied: **${changeSummary}**` }]);
      onRefresh();
    } catch (err) {
      console.error("Update failed:", err);
      alert("Update failed. The system encountered a culinary conflict.");
    } finally {
      setIsUpdating(false);
      setUpdateStatus('idle');
    }
  };

  const handleRestoreVersion = async (entry: RecipeHistoryEntry, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const entryId = `${entry.timestamp}-${entry.userName}`;
    if (confirmRestoreId !== entryId) {
      setConfirmRestoreId(entryId);
      return;
    }

    setIsUpdating(true);
    try {
      // Create a safety snapshot of current state before rolling back
      const leanSnapshot = { ...recipe };
      delete (leanSnapshot as any).history;
      delete (leanSnapshot as any).imageUrl;

      const safetyEntry: RecipeHistoryEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUser.displayName,
        changeDescription: `Rollback point: Snapshot created before restoring ${new Date(entry.timestamp).toLocaleDateString()}.`,
        snapshot: leanSnapshot
      };

      const updated = await saltBackend.updateRecipe(recipe.id, {
        ...entry.snapshot,
        history: [...(recipe.history || []), safetyEntry]
      });
      
      setRecipe(updated);
      setConfirmRestoreId(null);
      setMessages(prev => [...prev, { role: 'ai', text: `Restored version from ${new Date(entry.timestamp).toLocaleDateString()}.` }]);
      onRefresh();
    } catch (err) {
      console.error("Restore failed:", err);
      alert("Restoration failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRegenerateImage = async () => {
    setIsRegeneratingImage(true);
    try {
      const newImageUrl = await saltBackend.generateRecipeImage(recipe.title);
      const updated = await saltBackend.updateRecipe(recipe.id, { imageUrl: newImageUrl });
      setRecipe(updated);
      onRefresh();
    } catch (err) { console.error(err); } finally { setIsRegeneratingImage(false); }
  };

  const renderMarkdown = (text: string) => {
    try { return { __html: marked.parse(text) }; } catch (e) { return { __html: text }; }
  };

  const ingredients = recipe.ingredients || [];
  const instructions = recipe.instructions || [];
  const progress = Math.round(((currentStep + 1) / (instructions.length + 1)) * 100);

  const contextualIngredients = useMemo(() => {
    if (mode !== 'cook' || currentStep === 0) return [];
    return (recipe.stepIngredients?.[currentStep - 1] || []).map(idx => ({ name: ingredients[idx], index: idx }));
  }, [mode, currentStep, recipe.stepIngredients, ingredients]);

  const currentStepAlerts = useMemo(() => {
    if (mode !== 'cook' || currentStep === 0) return [];
    return (recipe.stepAlerts?.[currentStep - 1] || []).map(idx => recipe.workflowAdvice?.technicalWarnings?.[idx]).filter(Boolean);
  }, [mode, currentStep, recipe.stepAlerts, recipe.workflowAdvice]);

  return (
    <div className="fixed inset-0 bg-gray-950/60 z-[200] flex justify-center backdrop-blur-md overflow-hidden" onClick={onClose}>
      <Card className="w-full max-w-7xl bg-white shadow-2xl border-0 h-full flex flex-col md:flex-row rounded-none md:rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex-1 overflow-y-auto bg-white border-r border-gray-100 flex flex-col relative">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-sm z-[50] gap-4">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2563eb]">{mode === 'cook' ? 'Cooking' : 'Recipe Details'}</span>
              <h3 className="text-base font-bold text-gray-900 truncate">{recipe.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setMode('refine')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'refine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Details</button>
                <button onClick={() => { setMode('cook'); setCurrentStep(0); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'cook' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-400'}`}>Cook</button>
              </div>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div className="h-1 bg-gray-50 w-full shrink-0">
            <div className="h-full bg-[#2563eb] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-40">
            {mode === 'cook' ? (
              <div className="space-y-8 max-w-3xl mx-auto">
                {currentStep === 0 ? (
                  <section className="space-y-6">
                    <header className="flex justify-between items-end border-b border-gray-100 pb-4">
                      <h4 className="text-3xl font-black text-gray-900 tracking-tight">Mise en Place</h4>
                      <div className="text-right"><span className="text-3xl font-black text-[#2563eb]">{preppedIngredients.size}</span><span className="text-xs font-bold text-gray-300 ml-1">/ {ingredients.length}</span></div>
                    </header>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ingredients.map((ing, i) => (
                        <Card key={i} onClick={() => { const next = new Set(preppedIngredients); if(next.has(i)) next.delete(i); else next.add(i); setPreppedIngredients(next); }} className={`p-5 flex items-center gap-4 cursor-pointer border-2 transition-all ${preppedIngredients.has(i) ? 'bg-gray-50 border-transparent opacity-40' : 'bg-white border-gray-50 shadow-sm hover:border-blue-100'}`}>
                          <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${preppedIngredients.has(i) ? 'bg-[#2563eb] border-[#2563eb]' : 'bg-white border-gray-200'}`}>{preppedIngredients.has(i) && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>}</div>
                          <span className={`text-base font-bold font-sans ${preppedIngredients.has(i) ? 'line-through text-gray-400' : 'text-gray-900'}`}>{ing}</span>
                        </Card>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#2563eb]">Step {currentStep} of {instructions.length}</span>
                    {contextualIngredients.length > 0 && <div className="flex flex-wrap gap-2">{contextualIngredients.map(item => (<div key={item.index} className="px-3 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100/30"><span className="text-sm font-bold text-blue-900">{item.name}</span></div>))}</div>}
                    <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-blue-900/5 relative overflow-hidden"><span className="absolute -right-4 -bottom-8 text-[120px] font-black text-gray-50 select-none z-0">{currentStep}</span><p className="text-xl md:text-2xl font-bold text-gray-900 leading-relaxed relative z-10 font-sans">{instructions[currentStep - 1]}</p></div>
                    {currentStepAlerts.length > 0 && <div className="space-y-3">{currentStepAlerts.map((w, i) => (<div key={i} className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-start gap-4"><span className="text-2xl">⚠️</span><p className="text-lg font-bold text-red-900 font-sans">{w}</p></div>))}</div>}
                  </section>
                )}
                <div className="fixed bottom-0 left-0 right-0 p-6 z-[60] flex justify-center pointer-events-none"><div className="max-w-xl w-full flex gap-3 pointer-events-auto"><button disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)} className="h-16 px-8 rounded-2xl bg-white border border-gray-200 text-gray-400 font-black uppercase tracking-widest text-[10px] shadow-xl disabled:opacity-30">Back</button><button onClick={() => currentStep < instructions.length ? setCurrentStep(currentStep + 1) : setMode('refine')} className="flex-1 h-16 rounded-2xl bg-[#2563eb] text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-500/30">{currentStep === 0 ? 'Start Cooking' : currentStep < instructions.length ? 'Next' : 'Finish'}</button></div></div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex flex-col lg:flex-row gap-12">
                  <div className="lg:w-1/3 space-y-8">
                    <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm group relative">
                      {recipe.imageUrl ? <img src={recipe.imageUrl} className={`w-full h-full object-cover transition-opacity duration-500 ${isRegeneratingImage ? 'opacity-40' : 'opacity-100'}`} /> : <div className="w-full h-full flex items-center justify-center text-gray-200">No Image</div>}
                      {isRegeneratingImage && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
                      <div className="absolute inset-0 bg-black/40 flex flex-col gap-2 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="primary" className="h-10 text-[10px] uppercase px-4" onClick={() => setIsEditingImage(true)}>Edit Photo</Button><Button variant="secondary" className="h-10 text-[10px] uppercase px-4" onClick={handleRegenerateImage} disabled={isRegeneratingImage}>Regenerate AI</Button></div>
                    </div>
                    {isEditingImage && <div className="fixed inset-0 bg-gray-900/60 z-[400] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setIsEditingImage(false)}><Card className="w-full max-w-lg p-8 bg-white" onClick={e => e.stopPropagation()}><ImageEditor initialImage={recipe.imageUrl} onSave={async (img) => { const updated = await saltBackend.updateRecipe(recipe.id, { imageUrl: img }); setRecipe(updated); setIsEditingImage(false); onRefresh(); }} /></Card></div>}
                    <div className="grid grid-cols-2 gap-3"><div className="bg-gray-50 p-4 rounded-2xl text-center"><p className="text-[9px] font-black uppercase text-gray-400 mb-1">Time</p><p className="font-bold text-gray-900">{recipe.totalTime}</p></div><div className="bg-gray-50 p-4 rounded-2xl text-center"><p className="text-[9px] font-black uppercase text-gray-400 mb-1">Serves</p><p className="font-bold text-gray-900">{recipe.servings}</p></div></div>
                  </div>
                  <div className="flex-1 space-y-12">
                    <section><h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-6 pb-2 border-b border-gray-100">Ingredients</h4><ul className="grid grid-cols-1 md:grid-cols-2 gap-4">{ingredients.map((ing, i) => (<li key={i} className="flex items-center gap-3 text-base text-gray-700 font-sans"><div className="w-1.5 h-1.5 rounded-full bg-blue-100" />{ing}</li>))}</ul></section>
                    <section><h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-8 pb-2 border-b border-gray-100">Method</h4><div className="space-y-10">{instructions.map((inst, i) => (<div key={i} className="flex gap-8 group"><span className="text-4xl font-black text-gray-100 group-hover:text-blue-100 transition-colors">{String(i + 1).padStart(2, '0')}</span><p className="text-lg text-gray-800 font-sans leading-relaxed pt-1">{inst}</p></div>))}</div></section>
                    
                    {/* Version History Display */}
                    <section className="pt-8 border-t border-gray-50">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-8 pb-2 border-b border-gray-100">Version History</h4>
                      <div className="space-y-6">
                        {recipe.history?.length ? (
                          [...recipe.history].reverse().map((entry, idx) => {
                            const entryId = `${entry.timestamp}-${entry.userName}`;
                            const isConfirming = confirmRestoreId === entryId;
                            
                            return (
                              <div key={idx} className="flex gap-6 relative group">
                                {idx !== (recipe.history?.length || 0) - 1 && (
                                  <div className="absolute left-[7px] top-6 bottom-[-24px] w-px bg-gray-100" />
                                )}
                                <div className={`w-4 h-4 rounded-full border-2 transition-colors z-10 mt-1 shrink-0 ${isConfirming ? 'border-red-500 bg-red-500' : 'border-[#2563eb] bg-white group-hover:bg-[#2563eb]'}`} />
                                <div className="flex-1 space-y-1.5 pb-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-gray-900 uppercase tracking-[0.1em]">{entry.userName || 'Chef'}</span>
                                      <span className="text-[10px] text-gray-400 font-medium">
                                        {new Date(entry.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <button 
                                      onClick={(e) => handleRestoreVersion(entry, e)}
                                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded transition-all ${isConfirming ? 'bg-red-500 text-white opacity-100 animate-pulse' : 'text-[#2563eb] hover:bg-blue-50 opacity-0 group-hover:opacity-100'}`}
                                    >
                                      {isConfirming ? 'Confirming Restore...' : 'Restore Version'}
                                    </button>
                                  </div>
                                  <p className="text-sm text-gray-800 font-bold font-sans leading-relaxed italic">{entry.changeDescription}</p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-10 text-center">
                            <p className="text-xs text-gray-300 font-medium italic">Initial version. No previous revisions are indexed.</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`${mode === 'cook' ? 'hidden' : 'flex'} w-full md:w-[380px] flex-col bg-gray-50/50 border-l border-gray-100 shrink-0`}>
          <div className="p-6 border-b border-gray-100 bg-white"><h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#2563eb]">Salt Assistant</h4></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`markdown-body max-w-[85%] p-4 rounded-2xl text-[13px] font-sans leading-relaxed ${m.role === 'user' ? 'user-bubble bg-[#2563eb] text-white rounded-tr-none shadow-sm shadow-blue-500/10' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'}`} dangerouslySetInnerHTML={renderMarkdown(m.text)} />
              </div>
            ))}
            {(isTyping || isUpdating) && <div className="text-[10px] font-black text-blue-400 animate-pulse uppercase tracking-widest">{isUpdating ? (updateStatus === 'finalizing' ? 'Finalizing Adjustments...' : 'Saving Recipe...') : 'Sous-Chef is thinking...'}</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 bg-white border-t border-gray-100 space-y-3">
            {messages.length > 0 && (
              <Button fullWidth variant="secondary" onClick={handleApplyUpdate} disabled={isUpdating || isTyping} className="h-10 text-[9px] uppercase font-black tracking-widest">Update Recipe</Button>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input placeholder="Ask for adjustments..." value={chatInput} onChange={e => setChatInput(e.target.value)} className="h-11 text-sm bg-gray-50 border-0" disabled={isTyping || isUpdating} />
              <button type="submit" disabled={!chatInput || isTyping || isUpdating} className="w-11 h-11 shrink-0 bg-blue-500 text-white rounded-lg flex items-center justify-center disabled:opacity-30">
                <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
              </button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
};

interface RecipesModuleProps {
  recipes: Recipe[];
  inventory: Equipment[];
  onRefresh: () => void;
  currentUser: User;
}

// FIX: Added the missing RecipesModule component required by App.tsx
export const RecipesModule: React.FC<RecipesModuleProps> = ({ recipes, inventory, onRefresh, currentUser }) => {
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 md:space-y-10">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-gray-100 pb-4 md:pb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Recipes</h2>
          <p className="text-sm text-gray-500 font-medium font-sans">Your shared family cookbook.</p>
        </div>
      </header>

      <div className="relative">
        <Input 
          placeholder="Filter recipes..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          className="pl-12 font-sans h-11 text-base"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(recipe => (
          <Card 
            key={recipe.id} 
            className="group cursor-pointer hover:border-blue-200 transition-all overflow-hidden flex flex-col"
            onClick={() => setSelectedRecipe(recipe)}
          >
            <div className="aspect-[4/3] bg-gray-50 overflow-hidden relative">
              {recipe.imageUrl ? (
                <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-200 uppercase font-black text-[10px] tracking-widest">No Image</div>
              )}
            </div>
            <div className="p-6 space-y-3 flex-1">
              <div>
                <p className="text-[9px] font-black text-[#2563eb] uppercase tracking-widest mb-1">{recipe.complexity} • {recipe.totalTime}</p>
                <h3 className="font-bold text-gray-900 group-hover:text-[#2563eb] transition-colors line-clamp-1">{recipe.title}</h3>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 font-sans leading-relaxed">{recipe.description}</p>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="text-sm text-gray-400 font-medium italic">No recipes match your search.</p>
          </div>
        )}
      </div>

      {selectedRecipe && (
        <RecipeDetail 
          recipe={selectedRecipe} 
          inventory={inventory} 
          onClose={() => setSelectedRecipe(null)} 
          onRefresh={onRefresh}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
