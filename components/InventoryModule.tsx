
import { Accessory, Equipment, EquipmentCandidate } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import React, { useEffect, useRef, useState } from 'react';
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
      alert("Catalogue search failed. Try a more specific brand or model name."); 
    }
    finally { setIsSearching(false); }
  };

  const handleSelectCandidate = async (candidate: EquipmentCandidate) => {
    setIsGenerating(true);
    try {
      const details = await saltBackend.generateEquipmentDetails(candidate);
      setEditingItem({
        ...details,
        name: `${details.brand} ${details.modelName}`,
        description: candidate.description,
        status: 'Available'
      });
      setCandidates([]);
    } catch (err) { alert("Specification retrieval failed."); }
    finally { setIsGenerating(false); }
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
    } catch (err) { alert("Update failed."); }
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
      alert("Removal failed.");
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
    } catch (err) { alert("Accessory validation failed."); }
    finally { setIsValidatingAcc(false); }
  };

  const filtered = inventory
    .filter(i => {
      if (!i) return false;
      const q = search.toLowerCase();
      const accessoryText = i.accessories?.map(a => `${a.name} ${a.description || ''}`).join(' ') || '';
      const fullText = `${i.name} ${i.brand} ${i.modelName} ${i.type} ${i.class} ${i.description} ${accessoryText}`.toLowerCase();
      return fullText.includes(q);
    })
    .sort((a, b) => (a.brand || '').localeCompare(b.brand || '', 'en', { sensitivity: 'base' }));

  return (
    <div className="space-y-6 md:space-y-10">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-gray-100 pb-4 md:pb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Equipment</h2>
          <p className="text-sm text-gray-500 font-medium font-sans">Home equipment and verified accessories.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => { setIsAdding(true); setEditingItem(null); setCandidates([]); setSearchQuery(''); setIsDeletingConfirm(false); }} className="flex-1 sm:flex-none h-10 px-8">Add Item</Button>
        </div>
      </header>

      <div className="relative">
        <Input 
          placeholder="Filter your equipment..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-12 font-sans h-11 text-base"
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
                  <h3 className="text-xl font-bold text-gray-900">Catalogue Search</h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 text-gray-400 hover:text-gray-900">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input ref={searchInputRef} placeholder="e.g. Kenwood Mixer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchCandidates()} className="font-sans h-12" />
                  <Button onClick={handleSearchCandidates} disabled={isSearching} className="h-12 w-full sm:w-auto">{isSearching ? 'Searching...' : 'Search Candidates'}</Button>
                </div>
                <div className="space-y-4">
                  {candidates.map((c, i) => (
                    <div key={i} className="p-5 md:p-6 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors" onClick={() => !isGenerating && handleSelectCandidate(c)}>
                      <p className="font-bold text-gray-900 text-base">{c.brand} <span className="text-[#2563eb] ml-2 text-xs uppercase tracking-widest">{c.modelName}</span></p>
                      <p className="text-sm text-gray-500 font-sans mt-3 leading-relaxed">{c.description}</p>
                    </div>
                  ))}
                  {!isSearching && searchQuery && candidates.length === 0 && (
                    <p className="text-center text-xs text-gray-400 font-medium italic py-8">No exact matches found. Try a broader search.</p>
                  )}
                </div>
                {isGenerating && <div className="text-center text-[#2563eb] text-[10px] font-bold uppercase tracking-widest animate-pulse py-4">Extracting specifications...</div>}
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-lg z-20 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900">Equipment</h3>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="px-4 h-11" onClick={() => { setEditingItem(null); if(!editingItem.id) setIsAdding(false); setIsDeletingConfirm(false); }}>Discard</Button>
                    <Button onClick={handleSave} className="px-6 h-11">Save</Button>
                    {editingItem.id && (
                      <div className="relative">
                        {isDeletingConfirm ? (
                          <Button variant="primary" className="bg-red-600 hover:bg-red-700 px-4 h-11 text-xs" onClick={(e) => handleDelete(editingItem.id!, e)}>Confirm Removal</Button>
                        ) : (
                          <Button variant="ghost" className="px-4 h-11 text-red-500" onClick={() => setIsDeletingConfirm(true)}>Delete</Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6 md:p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><Label>Functional Type</Label><Input value={editingItem.type || ''} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="font-sans h-12" /></div>
                    <div><Label>System Class</Label><Input value={editingItem.class || ''} onChange={e => setEditingItem({...editingItem, class: e.target.value})} className="font-sans h-12" /></div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <textarea 
                      className="w-full p-4 border border-gray-200 rounded-lg text-base bg-gray-50 h-40 font-sans focus:ring-2 focus:ring-blue-100 outline-none transition-all leading-relaxed" 
                      value={editingItem.description || ''} 
                      onChange={e => setEditingItem({...editingItem, description: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-end border-b border-gray-100 pb-3">
                      <h4 className="font-bold text-gray-900 uppercase tracking-[0.2em] text-[10px]">Accessories</h4>
                      <Button variant="ghost" className="text-[10px] py-1 h-9 font-black" onClick={() => setIsAddingManualAcc(true)}>+ Add Entry</Button>
                    </div>
                    {isAddingManualAcc && (
                      <div className="p-6 bg-gray-50 rounded-lg border border-gray-100 space-y-4 shadow-inner">
                        <Input placeholder="Accessory name (e.g. Spiralizer)..." value={manualAccName} onChange={e => setManualAccName(e.target.value)} className="font-sans h-12" />
                        <div className="flex gap-2 justify-end">
                          <Button variant="secondary" onClick={() => setIsAddingManualAcc(false)} className="h-11 px-6">Cancel</Button>
                          <Button onClick={handleAddManualAcc} disabled={isValidatingAcc} className="h-11 px-6">{isValidatingAcc ? 'Validating...' : 'Link Entry'}</Button>
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
                            <p className="text-sm text-gray-500 italic font-sans mt-1 leading-relaxed">{acc.description}</p>
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

      {/* Optimized Equipment Grid - No Thumbnails */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(item => (
          <Card key={item.id} className="p-4 flex flex-col gap-3 cursor-pointer transition-all hover:ring-2 hover:ring-blue-50/50 hover:border-blue-100 active:scale-[0.99] group overflow-hidden h-auto md:h-32" onClick={() => { setEditingItem(item); setIsDeletingConfirm(false); }}>
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="min-w-0">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-1">
                    <h3 className="font-bold text-[13px] md:text-sm text-gray-900 truncate leading-tight mb-0.5">{item.name}</h3>
                    <p className="text-[8px] font-black uppercase tracking-wider text-[#2563eb] truncate">{item.brand} <span className="text-gray-300 mx-1">•</span> {item.type}</p>
                  </div>
                </div>
                <p className="text-[10px] md:text-[11px] text-gray-500 line-clamp-2 md:line-clamp-3 italic font-sans leading-tight mt-1">{item.description}</p>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-1">
                {item.accessories?.filter(a => a.owned).slice(0, 5).map(acc => (
                  <span key={acc.id} className="text-[6.5px] bg-white text-gray-400 border border-gray-100 px-1 py-0.5 rounded font-black uppercase tracking-tighter shadow-xs whitespace-nowrap">{acc.name}</span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
