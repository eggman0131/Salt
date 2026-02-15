import React, { useEffect, useState } from 'react';
import { Unit, Aisle } from '../types/contract';
import { Button, Card, Input, Label } from './UI';
import { saltBackend } from '../backend/api';

interface UnitsAndAislesManagementProps {
  onRefresh?: () => void;
}

export const UnitsAndAislesManagement: React.FC<UnitsAndAislesManagementProps> = ({ onRefresh }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'units' | 'aisles'>('units');
  
  // Unit state
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitName, setEditingUnitName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  
  // Aisle state
  const [editingAisleId, setEditingAisleId] = useState<string | null>(null);
  const [editingAisleName, setEditingAisleName] = useState('');
  const [newAisleName, setNewAisleName] = useState('');
  const [isAddingAisle, setIsAddingAisle] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [unitsData, aislesData] = await Promise.all([
        saltBackend.getUnits(),
        saltBackend.getAisles()
      ]);
      setUnits(unitsData);
      setAisles(aislesData);
    } catch (err) {
      console.error('Failed to load data:', err);
      alert('Failed to load units and aisles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    
    setIsAddingUnit(true);
    try {
      await saltBackend.createUnit({
        name: newUnitName.trim(),
        sortOrder: units.length
      });
      setNewUnitName('');
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Add unit failed:', err);
      alert('Failed to add unit');
    } finally {
      setIsAddingUnit(false);
    }
  };

  const handleUpdateUnit = async (id: string) => {
    if (!editingUnitName.trim()) return;
    
    try {
      await saltBackend.updateUnit(id, { name: editingUnitName.trim() });
      setEditingUnitId(null);
      setEditingUnitName('');
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Update unit failed:', err);
      alert('Failed to update unit');
    }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    if (!confirm(`Delete unit "${name}"? This may affect existing items using this unit.`)) return;
    
    try {
      await saltBackend.deleteUnit(id);
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Delete unit failed:', err);
      alert('Failed to delete unit');
    }
  };

  const handleMoveUnit = async (id: string, direction: 'up' | 'down') => {
    const index = units.findIndex(u => u.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === units.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const otherUnit = units[newIndex];

    try {
      await Promise.all([
        saltBackend.updateUnit(id, { sortOrder: newIndex }),
        saltBackend.updateUnit(otherUnit.id, { sortOrder: index })
      ]);
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Move unit failed:', err);
      alert('Failed to move unit');
    }
  };

  const handleAddAisle = async () => {
    if (!newAisleName.trim()) return;
    
    setIsAddingAisle(true);
    try {
      await saltBackend.createAisle({
        name: newAisleName.trim(),
        sortOrder: aisles.length
      });
      setNewAisleName('');
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Add aisle failed:', err);
      alert('Failed to add aisle');
    } finally {
      setIsAddingAisle(false);
    }
  };

  const handleUpdateAisle = async (id: string) => {
    if (!editingAisleName.trim()) return;
    
    try {
      await saltBackend.updateAisle(id, { name: editingAisleName.trim() });
      setEditingAisleId(null);
      setEditingAisleName('');
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Update aisle failed:', err);
      alert('Failed to update aisle');
    }
  };

  const handleDeleteAisle = async (id: string, name: string) => {
    if (!confirm(`Delete aisle "${name}"? This may affect existing items in this aisle.`)) return;
    
    try {
      await saltBackend.deleteAisle(id);
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Delete aisle failed:', err);
      alert('Failed to delete aisle');
    }
  };

  const handleMoveAisle = async (id: string, direction: 'up' | 'down') => {
    const index = aisles.findIndex(a => a.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === aisles.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const otherAisle = aisles[newIndex];

    try {
      await Promise.all([
        saltBackend.updateAisle(id, { sortOrder: newIndex }),
        saltBackend.updateAisle(otherAisle.id, { sortOrder: index })
      ]);
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Move aisle failed:', err);
      alert('Failed to move aisle');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-6 sticky top-16 md:top-20 z-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Units & Aisles</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('units')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'units'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Units
          </button>
          <button
            onClick={() => setActiveTab('aisles')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'aisles'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Aisles
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'units' ? (
            <>
              {/* Add new unit */}
              <Card className="p-4">
                <div className="flex gap-2">
                  <Input
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="New unit (e.g. kg, bunch, tin)"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddUnit}
                    disabled={isAddingUnit || !newUnitName.trim()}
                    className="whitespace-nowrap"
                  >
                    {isAddingUnit ? 'Adding...' : 'Add Unit'}
                  </Button>
                </div>
              </Card>

              {/* Units list */}
              <div className="space-y-2">
                {units.map((unit, index) => (
                  <Card key={unit.id} className="p-4">
                    {editingUnitId === unit.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editingUnitName}
                          onChange={(e) => setEditingUnitName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateUnit(unit.id)}
                          autoFocus
                          className="flex-1"
                        />
                        <Button onClick={() => handleUpdateUnit(unit.id)}>Save</Button>
                        <Button
                          onClick={() => {
                            setEditingUnitId(null);
                            setEditingUnitName('');
                          }}
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleMoveUnit(unit.id, 'up')}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveUnit(unit.id, 'down')}
                            disabled={index === units.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                          </button>
                        </div>
                        <span className="flex-1 font-medium text-gray-900">{unit.name}</span>
                        <button
                          onClick={() => {
                            setEditingUnitId(unit.id);
                            setEditingUnitName(unit.name);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUnit(unit.id, unit.name)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Add new aisle */}
              <Card className="p-4">
                <div className="flex gap-2">
                  <Input
                    value={newAisleName}
                    onChange={(e) => setNewAisleName(e.target.value)}
                    placeholder="New aisle (e.g. Produce, Bakery)"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAisle()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddAisle}
                    disabled={isAddingAisle || !newAisleName.trim()}
                    className="whitespace-nowrap"
                  >
                    {isAddingAisle ? 'Adding...' : 'Add Aisle'}
                  </Button>
                </div>
              </Card>

              {/* Aisles list */}
              <div className="space-y-2">
                {aisles.map((aisle, index) => (
                  <Card key={aisle.id} className="p-4">
                    {editingAisleId === aisle.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editingAisleName}
                          onChange={(e) => setEditingAisleName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateAisle(aisle.id)}
                          autoFocus
                          className="flex-1"
                        />
                        <Button onClick={() => handleUpdateAisle(aisle.id)}>Save</Button>
                        <Button
                          onClick={() => {
                            setEditingAisleId(null);
                            setEditingAisleName('');
                          }}
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleMoveAisle(aisle.id, 'up')}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveAisle(aisle.id, 'down')}
                            disabled={index === aisles.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                          </button>
                        </div>
                        <span className="flex-1 font-medium text-gray-900">{aisle.name}</span>
                        <button
                          onClick={() => {
                            setEditingAisleId(aisle.id);
                            setEditingAisleName(aisle.name);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteAisle(aisle.id, aisle.name)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
