import React, { useEffect, useState, useMemo } from 'react';
import { CanonicalIngredient } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';

interface IngredientsManagementModuleProps {
  onRefresh?: () => void;
}

type Aisle = CanonicalIngredient['aisle'];
type PreferredUnit = string;

const AISLES: Aisle[] = [
  'Produce',
  'Bakery',
  'Dairy & Eggs',
  'Meat & Fish',
  'Frozen',
  'Tinned Goods',
  'Dry Goods / Baking',
  'Pasta, Rice & Grains',
  'Herbs & Spices',
  'Condiments & Sauces',
  'World Foods',
  'Snacks',
  'Drinks',
  'Household / Cleaning',
  'Miscellaneous'
];

const UNITS: PreferredUnit[] = ['g', 'kg', 'ml', 'l', 'piece', 'tsp', 'tbsp', 'pinch'];

export const IngredientsManagementModule: React.FC<IngredientsManagementModuleProps> = ({ onRefresh }) => {
  const [ingredients, setIngredients] = useState<CanonicalIngredient[]>([]);
  const [search, setSearch] = useState('');
  const [aisleFilter, setAisleFilter] = useState<Aisle | 'all'>('all');
  const [isStapleFilter, setIsStapleFilter] = useState<'all' | 'staple' | 'regular'>('all');
  const [editingItem, setEditingItem] = useState<Partial<CanonicalIngredient> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [newSynonym, setNewSynonym] = useState('');

  const loadIngredients = async () => {
    setIsLoading(true);
    try {
      const data = await saltBackend.getCanonicalIngredients();
      setIngredients(data);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
      alert('Failed to load ingredients');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIngredients();
  }, []);

  const handleSave = async () => {
    if (!editingItem || !editingItem.name) return;
    setIsSaving(true);
    try {
      if (editingItem.id) {
        await saltBackend.updateCanonicalIngredient(editingItem.id, editingItem);
      } else {
        // Creating new ingredient
        const newIngredient: Omit<CanonicalIngredient, 'id' | 'createdAt'> = {
          name: editingItem.name,
          normalisedName: editingItem.name.toLowerCase(),
          aisle: editingItem.aisle || 'Miscellaneous',
          preferredUnit: editingItem.preferredUnit || 'g',
          isStaple: editingItem.isStaple || false,
          synonyms: editingItem.synonyms || [],
          createdBy: 'system',
        };
        await saltBackend.createCanonicalIngredient(newIngredient);
      }
      setEditingItem(null);
      await loadIngredients();
      onRefresh?.();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem?.id) return;
    try {
      await saltBackend.deleteCanonicalIngredient(editingItem.id);
      setShowDeleteConfirmModal(false);
      setEditingItem(null);
      await loadIngredients();
      onRefresh?.();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Delete failed');
    }
  };

  const handleAddSynonym = () => {
    if (!newSynonym.trim() || !editingItem) return;
    const currentSynonyms = editingItem.synonyms || [];
    if (!currentSynonyms.includes(newSynonym.trim())) {
      setEditingItem({
        ...editingItem,
        synonyms: [...currentSynonyms, newSynonym.trim()]
      });
    }
    setNewSynonym('');
  };

  const handleRemoveSynonym = (synonym: string) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      synonyms: (editingItem.synonyms || []).filter(s => s !== synonym)
    });
  };

  const filtered = useMemo(() => {
    return ingredients
      .filter(i => {
        const q = search.toLowerCase();
        const matchesSearch = !q || i.name.toLowerCase().includes(q) || i.normalisedName.includes(q) || (i.synonyms || []).some(s => s.toLowerCase().includes(q));
        const matchesAisle = aisleFilter === 'all' || i.aisle === aisleFilter;
        const matchesStaple = isStapleFilter === 'all' || (isStapleFilter === 'staple' && i.isStaple) || (isStapleFilter === 'regular' && !i.isStaple);
        return matchesSearch && matchesAisle && matchesStaple;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }, [ingredients, search, aisleFilter, isStapleFilter]);

  const groupedByAisle = useMemo(() => {
    const groups: Record<Aisle, CanonicalIngredient[]> = {} as any;
    filtered.forEach(ingredient => {
      if (!groups[ingredient.aisle]) {
        groups[ingredient.aisle] = [];
      }
      groups[ingredient.aisle].push(ingredient);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-6 space-y-4 sticky top-16 md:top-20 z-20">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search ingredients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-12 font-sans h-12 text-base shadow-sm border border-gray-200 bg-gray-50 focus:border-orange-500 focus:ring-orange-50 rounded-md"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </span>
          </div>
          
          <select
            value={aisleFilter}
            onChange={e => setAisleFilter(e.target.value as Aisle | 'all')}
            className="h-12 px-4 border border-gray-200 rounded-md bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
          >
            <option value="all">All Aisles</option>
            {AISLES.map(aisle => (
              <option key={aisle} value={aisle}>{aisle}</option>
            ))}
          </select>

          <select
            value={isStapleFilter}
            onChange={e => setIsStapleFilter(e.target.value as 'all' | 'staple' | 'regular')}
            className="h-12 px-4 border border-gray-200 rounded-md bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
          >
            <option value="all">All Types</option>
            <option value="staple">Staples Only</option>
            <option value="regular">Regular Only</option>
          </select>

          <button
            onClick={() => setEditingItem({ name: '', aisle: 'Miscellaneous', preferredUnit: 'g', isStaple: false, synonyms: [] })}
            className="bg-orange-600 text-white rounded-md h-12 px-4 font-medium hover:bg-orange-700 transition shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            <span className="hidden md:inline">Add Ingredient</span>
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{filtered.length} ingredient{filtered.length !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{filtered.filter(i => i.isStaple).length} staple{filtered.filter(i => i.isStaple).length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByAisle).map(([aisle, items]) => (
            <div key={aisle}>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 sticky top-44 bg-gray-50 py-2 z-10">{aisle}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(ingredient => (
                  <Card
                    key={ingredient.id}
                    className="p-4 cursor-pointer hover:bg-orange-50 transition-all border-l-4 border-l-orange-600 group"
                    onClick={() => setEditingItem(ingredient)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">{ingredient.name}</h4>
                      {ingredient.isStaple && (
                        <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wide font-bold">Staple</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Unit: {ingredient.preferredUnit}</p>
                    {ingredient.synonyms && ingredient.synonyms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ingredient.synonyms.slice(0, 3).map(syn => (
                          <span key={syn} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {syn}
                          </span>
                        ))}
                        {ingredient.synonyms.length > 3 && (
                          <span className="text-xs text-gray-400">+{ingredient.synonyms.length - 3}</span>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 font-bold italic">No ingredients found.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div
          className="fixed inset-0 bg-black/40 z-[200] overflow-y-auto backdrop-blur-sm p-4 flex justify-center"
          onClick={() => { setEditingItem(null); setShowDeleteConfirmModal(false); }}
        >
          <Card className="w-full max-w-2xl bg-white border border-gray-200 shadow-md h-fit mb-10" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-lg z-20 shadow-sm">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">{editingItem.id ? 'Edit Ingredient' : 'New Ingredient'}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editingItem.name}
                  className="inline-flex items-center justify-center px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </button>

                {editingItem.id && (
                  <button
                    onClick={() => setShowDeleteConfirmModal(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                )}

                <div className="w-px h-6 bg-gray-100 mx-2" />

                <button
                  onClick={() => { setEditingItem(null); setShowDeleteConfirmModal(false); }}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 md:p-10 space-y-6">
              <div>
                <Label>Ingredient Name</Label>
                <Input
                  value={editingItem.name || ''}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="e.g. Red Onion"
                  className="font-sans h-12"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Aisle</Label>
                  <select
                    value={editingItem.aisle || 'Other'}
                    onChange={e => setEditingItem({ ...editingItem, aisle: e.target.value as Aisle })}
                    className="w-full h-12 px-4 border border-gray-100 rounded-xl bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  >
                    {AISLES.map(aisle => (
                      <option key={aisle} value={aisle}>{aisle}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Preferred Unit</Label>
                  <select
                    value={editingItem.preferredUnit || 'g'}
                    onChange={e => setEditingItem({ ...editingItem, preferredUnit: e.target.value as PreferredUnit })}
                    className="w-full h-12 px-4 border border-gray-100 rounded-xl bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  >
                    {UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.isStaple || false}
                    onChange={e => setEditingItem({ ...editingItem, isStaple: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Mark as Staple (always in stock)</span>
                </label>
              </div>

              <div>
                <Label>Synonyms (Alternative Names)</Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={newSynonym}
                      onChange={e => setNewSynonym(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddSynonym()}
                      placeholder="e.g. spring onion, scallion"
                      className="font-sans h-12"
                    />
                    <button
                      onClick={handleAddSynonym}
                      className="h-12 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editingItem.synonyms || []).map(syn => (
                      <span
                        key={syn}
                        className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                      >
                        {syn}
                        <button
                          onClick={() => handleRemoveSynonym(syn)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirmModal(false)}
        >
          <Card className="w-full max-w-sm bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-red-600">Delete Ingredient?</h3>
              <p className="text-sm text-gray-600">This action cannot be undone.</p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDelete}
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
    </div>
  );
};
