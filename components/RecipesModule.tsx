
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Button, Input, Label } from './UI';
import { ImageEditor } from './ImageEditor';
import { Recipe, Equipment, RecipeHistoryEntry, User } from '../types/contract';
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
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
  const [mode, setMode] = useState<'refine' | 'cook'>('refine');
  const [mobileTab, setMobileTab] = useState<'recipe' | 'assistant'>('recipe');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'analyzing' | 'saving'>('idle');
  const [pendingProposals, setPendingProposals] = useState<Proposal[] | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  
  const [currentStep, setCurrentStep] = useState(0); 
  const [preppedIngredients, setPreppedIngredients] = useState<Set<number>>(new Set());
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => { setRecipe(initialRecipe); }, [initialRecipe]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = 'unset';
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, []);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isWakeLockActive && mode === 'cook') {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          console.error(`${err.name}, ${err.message}`);
          setIsWakeLockActive(false);
        }
      } else {
        if (wakeLockRef.current) {
          wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isWakeLockActive, mode]);

  useEffect(() => { 
    if (mobileTab === 'assistant' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, mobileTab]);

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
      const leanSnapshot = { ...recipe };
      delete (leanSnapshot as any).history;
      const safetyEntry: RecipeHistoryEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUser.displayName,
        changeDescription: `Rollback point: Snapshot created before restoring.`,
        snapshot: leanSnapshot
      };
      const updated = await saltBackend.updateRecipe(recipe.id, {
        ...entry.snapshot,
        history: [...(recipe.history || []), safetyEntry]
      });
      setRecipe(updated);
      setConfirmRestoreId(null);
      setMessages(prev => [...prev, { role: 'ai', text: `Restored version.` }]);
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
    <div className="fixed inset-0 bg-gray-950/60 z-[200] flex items-start sm:items-center justify-center backdrop-blur-md overflow-hidden" onClick={onClose}>
      {/* Review Modal Overlay */}
      {pendingProposals && (
        <div className="fixed inset-0 z-[300] bg-gray-950/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={(e) => { e.stopPropagation(); setPendingProposals(null); }}>
          <Card className="w-full max-w-xl bg-white shadow-2xl border-0 overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
             <div className="p-8 space-y-8">
               <div className="space-y-2">
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#2563eb]">Review Changes</span>
                 <h4 className="text-2xl font-black text-gray-900 leading-tight">Verify Refinements</h4>
                 <p className="text-sm text-gray-500 font-sans italic opacity-60">Select which adjustments to apply.</p>
               </div>
               <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                 {pendingProposals.map(p => (
                   <div 
                    key={p.id} 
                    onClick={() => setPendingProposals(prev => prev ? prev.map(item => item.id === p.id ? { ...item, selected: !item.selected } : item) : null)}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${p.selected ? 'bg-blue-50/50 border-blue-500 shadow-sm' : 'bg-white border-gray-100 opacity-60 grayscale'}`}
                   >
                     <div className={`mt-1 w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${p.selected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}>
                       {p.selected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>}
                     </div>
                     <span className={`text-[15px] font-bold font-sans leading-relaxed ${p.selected ? 'text-blue-900' : 'text-gray-400'}`}>{p.description}</span>
                   </div>
                 ))}
               </div>
               <div className="pt-4 flex flex-col sm:flex-row gap-3">
                 <Button onClick={commitUpdate} disabled={isUpdating || pendingProposals.every(p => !p.selected)} className="flex-1 h-14 uppercase font-black tracking-widest">Apply Selected</Button>
                 <Button variant="secondary" onClick={() => setPendingProposals(null)} disabled={isUpdating} className="h-14 px-8 uppercase font-black tracking-widest">Discard</Button>
               </div>
             </div>
          </Card>
        </div>
      )}

      <Card className="w-full max-sm:h-[100dvh] max-w-7xl bg-white shadow-2xl border-0 h-full flex flex-col rounded-none md:rounded-lg overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <div className="h-16 md:h-20 border-b border-gray-100 flex justify-between items-center px-4 bg-white shrink-0 z-50 overflow-hidden flex-none box-border">
          <div className="flex flex-col min-w-0 flex-1 justify-center mr-2">
            <div className="h-4 flex items-center">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2563eb] leading-none">
                {mode === 'cook' ? 'Service' : 'Planning'}
              </span>
            </div>
            <div className="flex items-center gap-2 truncate mt-1">
              <h3 className="text-sm md:text-base font-bold text-gray-900 truncate leading-none">{recipe.title}</h3>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0 h-full py-2">
            <div className="flex items-center bg-gray-50 p-1 rounded-xl shadow-inner border border-gray-200/50 h-full box-border">
              <button 
                onClick={() => { setMode('refine'); setMobileTab('recipe'); }} 
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${mode === 'refine' && mobileTab === 'recipe' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                title="Recipe Documentation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </button>
              <button 
                onClick={() => { setMode('refine'); setMobileTab('assistant'); }} 
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${mode === 'refine' && mobileTab === 'assistant' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                title="Discuss with Sous-Chef"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              </button>
              <button 
                onClick={() => { setMode('cook'); setCurrentStep(0); }} 
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${mode === 'cook' ? 'bg-white text-[#2563eb] shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-[#2563eb]'}`}
                title="Start Service"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.99 7.99 0 0120 13a7.98 7.98 0 01-2.343 5.657z"/></svg>
              </button>
            </div>

            <div className="w-px h-6 bg-gray-100 mx-1" />

            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-colors" title="Close">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="h-1 bg-gray-50 w-full shrink-0 relative overflow-hidden">
          <div className="h-full bg-[#2563eb] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <div className={`flex-1 overflow-y-auto bg-white border-r border-gray-100 ${mode === 'refine' && mobileTab === 'assistant' ? 'hidden md:block' : 'block'}`}>
            <div className="p-6 md:p-12 pb-40">
              {mode === 'cook' ? (
                <div className="space-y-8 max-w-3xl mx-auto">
                  {currentStep === 0 ? (
                    <section className="space-y-6 animate-in fade-in duration-500">
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
                      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-blue-900/5 relative overflow-hidden"><span className="absolute -right-4 -bottom-8 text-[120px] font-black text-gray-50 select-none z-0">{currentStep}</span><p className="text-2xl md:text-3xl font-bold text-gray-900 leading-relaxed relative z-10 font-sans">{instructions[currentStep - 1]}</p></div>
                      {currentStepAlerts.length > 0 && <div className="space-y-3">{currentStepAlerts.map((w, i) => (<div key={i} className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-start gap-4"><span className="text-2xl">⚠️</span><p className="text-xl font-bold text-red-900 font-sans">{w}</p></div>))}</div>}
                    </section>
                  )}
                  <div className="fixed bottom-0 left-0 right-0 p-6 z-[60] flex justify-center pointer-events-none"><div className="max-w-xl w-full flex gap-3 pointer-events-auto"><button disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)} className="h-16 px-8 rounded-2xl bg-white border border-gray-200 text-gray-400 font-black uppercase tracking-widest text-[10px] shadow-xl disabled:opacity-30">Back</button><button onClick={() => currentStep < instructions.length ? setCurrentStep(currentStep + 1) : setMode('refine')} className="flex-1 h-16 rounded-2xl bg-[#2563eb] text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-500/30">{currentStep === 0 ? 'Start Cooking' : currentStep < instructions.length ? 'Next' : 'Finish'}</button></div></div>
                </div>
              ) : (
                <div className="space-y-12">
                  <div className="flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-1/3 space-y-8">
                      <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm group relative">
                        <RemoteImage path={recipe.imagePath} className={`w-full h-full object-cover transition-opacity duration-500 ${isRegeneratingImage ? 'opacity-40' : 'opacity-100'}`} alt={recipe.title} />
                        {isRegeneratingImage && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
                        <div className="absolute inset-0 bg-black/40 flex flex-col gap-2 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4">
                          <Button variant="primary" className="h-11 px-6 uppercase tracking-widest text-[10px] font-black" onClick={() => setIsEditingImage(true)}>Edit Photo</Button>
                          <Button variant="secondary" className="h-11 px-6 uppercase tracking-widest text-[10px] font-black" onClick={handleRegenerateImage} disabled={isRegeneratingImage}>Regenerate</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3"><div className="bg-gray-50 p-4 rounded-2xl text-center"><p className="text-[9px] font-black uppercase text-gray-400 mb-1">Time</p><p className="font-bold text-gray-900">{recipe.totalTime}</p></div><div className="bg-gray-50 p-4 rounded-2xl text-center"><p className="text-[9px] font-black uppercase text-gray-400 mb-1">Serves</p><p className="font-bold text-gray-900">{recipe.servings}</p></div></div>
                    </div>
                    <div className="flex-1 space-y-12">
                      <section><h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-6 pb-2 border-b border-gray-100">Ingredients</h4><ul className="grid grid-cols-1 md:grid-cols-2 gap-4">{ingredients.map((ing, i) => (<li key={i} className="flex items-center gap-3 text-base text-gray-700 font-sans"><div className="w-1.5 h-1.5 rounded-full bg-blue-100" />{ing}</li>))}</ul></section>
                      <section><h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-8 pb-2 border-b border-gray-100">Method</h4><div className="space-y-10">{instructions.map((inst, i) => (<div key={i} className="flex gap-8 group"><span className="text-4xl font-black text-gray-100 group-hover:text-blue-100 transition-colors">{String(i + 1).padStart(2, '0')}</span><p className="text-lg text-gray-800 font-sans leading-relaxed pt-1">{inst}</p></div>))}</div></section>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`${mode === 'cook' ? 'hidden' : (mobileTab === 'assistant' ? 'flex' : 'hidden md:flex')} w-full md:w-[320px] lg:w-[380px] flex-col bg-gray-50/50 md:border-l border-gray-100 shrink-0 h-full overflow-hidden`}>
            <div className="hidden md:flex p-4 md:p-6 border-b border-gray-100 bg-white items-center justify-between shrink-0 h-16 md:h-20">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#2563eb]">Sous-Chef</h4>
              {pendingProposals && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse">Update Ready</span>}
            </div>
            
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 relative">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`markdown-body max-w-[88%] p-3.5 md:p-4 rounded-2xl text-[13px] font-sans leading-relaxed ${m.role === 'user' ? 'user-bubble bg-[#2563eb] text-white rounded-tr-none shadow-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'}`} dangerouslySetInnerHTML={renderMarkdown(m.text)} />
                </div>
              ))}
              {(isTyping || isUpdating) && <div className="text-[10px] font-black text-blue-400 animate-pulse uppercase tracking-widest px-2">{isUpdating ? (updateStatus === 'analyzing' ? 'Refining...' : 'Saving...') : 'Thinking...'}</div>}
            </div>
            
            <div className="p-3 bg-white border-t border-gray-100 space-y-2 shrink-0">
              {messages.length > 0 && !pendingProposals && (
                <button 
                  onClick={handleApplyUpdate} 
                  disabled={isUpdating || isTyping} 
                  className="w-full h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-100 text-gray-400 hover:text-[#2563eb] hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
                  title="Process discussed refinements"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                </button>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2 pb-safe">
                <Input placeholder="Adjustments..." value={chatInput} onChange={e => setChatInput(e.target.value)} className="h-10 text-sm bg-gray-50 border-0 shadow-inner" disabled={isTyping || isUpdating || !!pendingProposals} />
                <button type="submit" disabled={!chatInput || isTyping || isUpdating || !!pendingProposals} className="w-10 h-10 shrink-0 bg-blue-500 text-white rounded-lg flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform shadow-lg shadow-blue-500/20">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>
                </button>
              </form>
            </div>
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
  onNewRecipe: () => void;
}

export const RecipesModule: React.FC<RecipesModuleProps> = ({ recipes, inventory, onRefresh, currentUser, onNewRecipe }) => {
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isDeletingConfirm, setIsDeletingConfirm] = useState<string | null>(null);

  const filtered = recipes.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.description.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeletingConfirm === id) {
      try {
        await saltBackend.deleteRecipe(id);
        setIsDeletingConfirm(null);
        onRefresh();
      } catch (err) {
        alert("Removal failed.");
      }
    } else {
      setIsDeletingConfirm(id);
    }
  };

  return (
    <div className="space-y-6 md:space-y-10">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Input 
            placeholder="Filter recipes..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-12 font-sans h-11 text-base shadow-sm"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
        </div>
        <button 
          onClick={onNewRecipe} 
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all whitespace-nowrap"
          title="Create New Recipe"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(recipe => (
          <Card key={recipe.id} className="group cursor-pointer hover:border-blue-100 transition-all flex flex-col overflow-hidden" onClick={() => setSelectedRecipe(recipe)}>
            <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
              <RemoteImage path={recipe.imagePath} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={recipe.title} />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {isDeletingConfirm === recipe.id ? (
                  <button 
                    onClick={(e) => handleDelete(recipe.id, e)}
                    className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl animate-in slide-in-from-right-1"
                  >
                    Confirm
                  </button>
                ) : (
                  <button 
                    onClick={(e) => handleDelete(recipe.id, e)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-md text-gray-400 hover:text-red-500 transition-colors shadow-sm"
                    title="Delete Recipe"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                )}
              </div>
              <div className="absolute bottom-4 left-4">
                 <span className="text-[9px] font-black uppercase tracking-widest bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-gray-900 border border-gray-100">Level: {recipe.complexity}</span>
              </div>
            </div>
            <div className="p-6 space-y-3 flex-1">
              <h3 className="font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">{recipe.title}</h3>
              <p className="text-xs text-gray-500 line-clamp-2 font-sans leading-relaxed">{recipe.description}</p>
              <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{recipe.totalTime}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{recipe.servings} Servings</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedRecipe && (
        <RecipeDetail 
          recipe={selectedRecipe} 
          inventory={inventory} 
          onClose={() => { setSelectedRecipe(null); setIsDeletingConfirm(null); }} 
          onRefresh={onRefresh} 
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
