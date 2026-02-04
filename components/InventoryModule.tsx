
import { Accessory, Equipment, EquipmentCandidate } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { saltBackend } from '../backend/api';

interface InventoryModuleProps {
  inventory: Equipment[];
  onRefresh: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ inventory, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Equipment> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<EquipmentCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false);
  
  const [isAddingManualAcc, setIsAddingManualAcc] = useState(false);
  const [manualAccName, setManualAccName] = useState('');
  const [isValidatingAcc, setIsValidatingAcc] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && !editingItem) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isAdding, editingItem]);

  useEffect(() => {
    if (isAdding || editingItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isAdding, editingItem]);

  const handleSearchCandidates = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setCandidates([]);
    try {
      const results = await saltBackend.searchEquipmentCandidates(searchQuery);
      setCandidates(results || []);
    } catch (err) { 
      console.error(err);
      alert("Search failed."); 
    }
    finally { setIsSearching(false); }
  };

  const handleSelectCandidate = async (candidate: EquipmentCandidate) => {
    setIsGenerating(true);
    try {
      const details = await saltBackend.generateEquipmentDetails(candidate);
      setEditingItem({
        ...details,
        brand: details.brand || candidate.brand,
        modelName: details.modelName || candidate.modelName,
        name: details.brand && details.modelName ? `${details.brand} ${details.modelName}` : `${candidate.brand} ${candidate.modelName}`,
        description: details.description || candidate.description,
        status: 'Available'
      });
      setCandidates([]);
    } catch (err) { alert("Details failed."); }
    finally { setIsGenerating(false); }
  };

  const handleRefreshEquipment = async () => {
    if (!editingItem || !editingItem.brand || !editingItem.modelName) return;
    setIsGenerating(true);
    try {
      const candidate: EquipmentCandidate = {
        brand: editingItem.brand,
        modelName: editingItem.modelName,
        description: '',
        category: (editingItem.class as any) || 'Complex Appliance'
      };
      const details = await saltBackend.generateEquipmentDetails(candidate);
      setEditingItem({
        ...editingItem,
        ...details,
        name: details.brand && details.modelName ? `${details.brand} ${details.modelName}` : editingItem.name,
      });
    } catch (err) {
      alert("Refresh failed. AI could not retrieve updated specs.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!editingItem) return;
    try {
      if (editingItem.id) {
        await saltBackend.updateEquipment(editingItem.id, editingItem);
      } else {
        await saltBackend.createEquipment(editingItem as any);
      }
      setEditingItem(null);
      setIsAdding(false);
      onRefresh();
    } catch (err) { alert("Save failed."); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await saltBackend.deleteEquipment(id);
      setIsDeletingConfirm(false);
      setEditingItem(null);
      setIsAdding(false);
      onRefresh();
    } catch (err) {
      alert("Delete failed.");
    }
  };

  const handleAddManualAcc = async () => {
    if (!editingItem || !manualAccName) return;
    setIsValidatingAcc(true);
    try {
      const validated = await saltBackend.validateAccessory(editingItem.name || editingItem.modelName || '', manualAccName);
      const newAcc: Accessory = {
        ...validated,
        id: `acc-${Math.random().toString(36).substr(2, 5)}`,
      };
      setEditingItem({
        ...editingItem,
        accessories: [...(editingItem.accessories || []), newAcc]
      });
      setIsAddingManualAcc(false);
      setManualAccName('');
    } catch (err) { alert("Validation failed."); }
    finally { setIsValidatingAcc(false); }
  };

  // Simplified filtering logic focusing on text search
  const filtered = useMemo(() => {
    return inventory.filter(i => {
      if (!i) return false;
      const q = search.toLowerCase();
      const accessoryText = i.accessories?.map(a => `${a.name} ${a.description || ''}`).join(' ') || '';
      const fullText = `${i.name} ${i.brand} ${i.modelName} ${i.type} ${i.class} ${i.description} ${accessoryText}`.toLowerCase();
      return fullText.includes(q);
    }).sort((a, b) => (a.brand || '').localeCompare(b.brand || '', 'en', { sensitivity: 'base' }));
  }, [inventory, search]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <header className="flex justify-end items-center pb-3">
        <button 
          onClick={() => { setIsAdding(true); setEditingItem(null); setCandidates([]); setSearchQuery(''); setIsDeletingConfirm(false); }} 
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          title="Add New Equipment"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
        </button>
      </header>

      <div className="relative">
        <Input 
          placeholder="Search equipment or brand..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          className="pl-12 font-sans h-12 text-base shadow-sm border-gray-100 focus:border-[#2563eb] focus:ring-blue-50"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </span>
      </div>

      {(isAdding || editingItem) && (
        <div className="fixed inset-0 bg-gray-900/40 z-[200] overflow-y-auto backdrop-blur-md p-0 sm:p-4 md:p-10 flex justify-center" onClick={() => { setEditingItem(null); setIsAdding(false); setIsDeletingConfirm(false); }}>
          <Card className="w-full max-w-2xl bg-white shadow-2xl border-0 h-fit min-h-screen sm:min-h-0 mb-0 sm:mb-10 rounded-none sm:rounded-lg" onClick={e => e.stopPropagation()}>
            {!editingItem ? (
              <div className="p-6 md:p-10 space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">Search Catalogue</h3>
                  <button onClick={() => setIsAdding(false)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input ref={searchInputRef} placeholder="e.g. Kenwood Mixer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchCandidates()} className="font-sans h-12" />
                  <Button onClick={handleSearchCandidates} disabled={isSearching} className="h-12 w-full sm:w-auto">{isSearching ? 'Searching...' : 'Search'}</Button>
                </div>
                <div className="space-y-4">
                  {candidates.map((c, i) => (
                    <div key={i} className="p-5 md:p-6 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors" onClick={() => !isGenerating && handleSelectCandidate(c)}>
                      <p className="font-bold text-gray-900 text-base">{c.brand} <span className="text-[#2563eb] ml-2 text-xs uppercase tracking-widest">{c.modelName}</span></p>
                      <p className="text-sm text-gray-500 font-sans mt-3 leading-relaxed">{c.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col relative">
                {isGenerating && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-10 text-center space-y-4">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#2563eb]">AI Synthesis in Progress...</p>
                  </div>
                )}
                
                <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-lg z-20 shadow-sm min-h-[72px]">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate mr-2">Equipment Detail</h3>
                  <div className="flex items-center gap-1">
                    {editingItem.id && (
                      <button 
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-[#2563eb] transition-all disabled:opacity-30" 
                        onClick={handleRefreshEquipment} 
                        disabled={isGenerating}
                        title="Refresh Technical Specs"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      </button>
                    )}

                    <button 
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-green-600 transition-all disabled:opacity-30" 
                      onClick={handleSave} 
                      disabled={isGenerating}
                      title="Save Changes"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </button>

                    {editingItem.id && (
                      <div className="relative flex items-center">
                        {isDeletingConfirm ? (
                          <button 
                            className="bg-red-600 hover:bg-red-700 text-white px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-right-1 ml-1" 
                            onClick={(e) => handleDelete(editingItem.id!, e)}
                          >
                            Confirm
                          </button>
                        ) : (
                          <button 
                            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-all" 
                            onClick={() => setIsDeletingConfirm(true)}
                            title="Delete Item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="w-px h-6 bg-gray-100 mx-2" />

                    <button 
                      onClick={() => { setEditingItem(null); if(!editingItem.id) setIsAdding(false); setIsDeletingConfirm(false); }} 
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all"
                      title="Close"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div className="p-6 md:p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><Label>Functional Type</Label><Input value={editingItem.type || ''} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="font-sans h-12" /></div>
                    <div><Label>Placement Class</Label><Input value={editingItem.class || ''} onChange={e => setEditingItem({...editingItem, class: e.target.value})} className="font-sans h-12" /></div>
                  </div>

                  <div>
                    <Label>Technical Overview</Label>
                    <textarea 
                      className="w-full p-4 border border-gray-200 rounded-lg text-base bg-gray-50 h-40 font-sans focus:ring-2 focus:ring-blue-100 outline-none transition-all leading-relaxed" 
                      value={editingItem.description || ''} 
                      onChange={e => setEditingItem({...editingItem, description: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-end border-b border-gray-100 pb-3">
                      <h4 className="font-black text-gray-900 uppercase tracking-[0.2em] text-[10px]">Accessories</h4>
                      <button 
                        onClick={() => setIsAddingManualAcc(true)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-[#2563eb] transition-all"
                        title="Add Accessory"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                      </button>
                    </div>
                    {isAddingManualAcc && (
                      <div className="p-6 bg-gray-50 rounded-lg border border-gray-100 space-y-4 shadow-inner animate-in slide-in-from-top-2">
                        <Input placeholder="Accessory name..." value={manualAccName} onChange={e => setManualAccName(e.target.value)} className="font-sans h-12" />
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => setIsAddingManualAcc(false)} 
                            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-gray-900 shadow-sm"
                            title="Cancel"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                          <button 
                            onClick={handleAddManualAcc} 
                            disabled={isValidatingAcc} 
                            className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/20 disabled:opacity-30"
                            title="Add"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4">
                      {editingItem.accessories?.map(acc => (
                        <div key={acc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-white rounded-lg border border-gray-100 gap-4">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-base flex items-center gap-3">
                              {acc.name} 
                              <span className="text-[8px] border border-gray-100 bg-gray-50 px-1.5 py-0.5 rounded-full uppercase tracking-tighter text-gray-400 font-black">{acc.type}</span>
                            </p>
                            <p className="text-xs text-gray-500 font-sans mt-1 italic">{acc.description}</p>
                          </div>
                          <div className="flex items-center gap-4 w-full sm:w-auto pt-4 sm:pt-0 sm:pl-6 border-t sm:border-t-0 sm:border-l border-gray-50 justify-between sm:justify-end">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${acc.owned ? 'text-[#2563eb]' : 'text-gray-300'}`}>{acc.owned ? 'Owned' : 'Missing'}</span>
                            <input 
                              type="checkbox" 
                              checked={acc.owned} 
                              onChange={() => {
                                const updated = editingItem.accessories?.map(a => a.id === acc.id ? {...a, owned: !a.owned} : a);
                                setEditingItem({...editingItem, accessories: updated});
                              }} 
                              className="w-10 h-10 sm:w-6 sm:h-6 rounded-lg border-gray-300 text-[#2563eb] cursor-pointer" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filtered.map(item => (
          <Card key={item.id} className="p-6 flex flex-col gap-4 cursor-pointer transition-all hover:ring-4 hover:ring-blue-500/5 hover:border-blue-100 active:scale-[0.99] group bg-white border-gray-100" onClick={() => { setEditingItem(item); setIsDeletingConfirm(false); }}>
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-1">
                    <h3 className="font-black text-base md:text-lg text-gray-900 truncate leading-tight">{item.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#2563eb] mt-1">{item.brand}</p>
                  </div>
                </div>
                <p className="text-[13px] text-gray-500 line-clamp-3 font-sans leading-relaxed italic opacity-80 group-hover:opacity-100 transition-opacity">
                  {item.description || "No technical overview available."}
                </p>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-1.5 pt-4 border-t border-gray-50">
                {item.accessories?.filter(a => a.owned).slice(0, 8).map(acc => (
                  <span key={acc.id} className="text-[8px] bg-gray-50 text-gray-400 border border-gray-100 px-2 py-1 rounded font-black uppercase tracking-tighter shadow-sm whitespace-nowrap">{acc.name}</span>
                ))}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <p className="text-sm text-gray-400 font-bold italic">No equipment matches found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
