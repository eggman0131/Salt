
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Input, Label } from './UI';
import { User, Plan, DayPlan } from '../types/contract';
import { saltBackend } from '../backend/api';

interface PlannerModuleProps {
  users: User[];
  onRefresh: () => void;
}

export const PlannerModule: React.FC<PlannerModuleProps> = ({ users, onRefresh }) => {
  const [startDate, setStartDate] = useState(getFriday(new Date().toISOString().split('T')[0]));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [activeConfirmId, setActiveConfirmId] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0); // For mobile focus view
  
  const debounceTimerRef = useRef<number | null>(null);
  const lastSavedJsonRef = useRef<string>('');

  function getFriday(dStr: string) {
    const d = new Date(dStr);
    const day = d.getDay();
    const daysToSubtract = (day + 2) % 7; 
    const friday = new Date(d.setDate(d.getDate() - daysToSubtract));
    return friday.toISOString().split('T')[0];
  }

  const loadAllPlans = async () => {
    const plans = await saltBackend.getPlans();
    setAllPlans(plans);
  };

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const existing = await saltBackend.getPlanByDate(startDate);
      let targetPlan: Plan;
      
      if (existing) {
        targetPlan = existing;
      } else {
        const days: DayPlan[] = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          return {
            date: d.toISOString().split('T')[0],
            cookId: null,
            presentIds: users.map(u => u.id),
            userNotes: {},
            mealNotes: '',
          };
        });
        targetPlan = {
          id: 'new',
          startDate,
          days,
          createdAt: new Date().toISOString(),
          createdBy: '',
        };
      }

      setPlan(targetPlan);
      lastSavedJsonRef.current = JSON.stringify(targetPlan);
      setSaveStatus('saved');
      loadAllPlans();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, users]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    if (activeConfirmId) {
      const timer = setTimeout(() => setActiveConfirmId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeConfirmId]);

  useEffect(() => {
    if (!plan || isLoading) return;
    const currentJson = JSON.stringify(plan);
    if (currentJson === lastSavedJsonRef.current) return;

    const isNewUntouched = plan.id === 'new' && plan.days.every(d => !d.mealNotes && !d.cookId);
    if (isNewUntouched) return;

    setSaveStatus('saving');
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const { id, createdAt, createdBy, ...data } = plan;
        const saved = await saltBackend.createOrUpdatePlan(data);
        if (plan.id === 'new') {
          setPlan(prev => prev ? { ...prev, id: saved.id } : null);
        }
        lastSavedJsonRef.current = JSON.stringify(saved);
        setSaveStatus('saved');
        loadAllPlans();
        onRefresh();
      } catch (err) {
        setSaveStatus('error');
      }
    }, 1200);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [plan, isLoading, onRefresh]);

  const handleUpdateDay = (index: number, updates: Partial<DayPlan>) => {
    if (!plan) return;
    const newDays = [...plan.days];
    newDays[index] = { ...newDays[index], ...updates };
    setPlan({ ...plan, days: newDays });
  };

  const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeConfirmId === id) {
      await saltBackend.deletePlan(id);
      setActiveConfirmId(null);
      loadAllPlans();
      onRefresh();
      if (plan?.id === id) {
        setPlan(null); 
        loadPlan();
      }
    } else {
      setActiveConfirmId(id);
    }
  };

  const handlePlanNextCycle = () => {
    if (allPlans.length === 0) {
      const nextFri = new Date();
      nextFri.setDate(nextFri.getDate() + (5 + 7 - nextFri.getDay()) % 7);
      if (nextFri.toISOString().split('T')[0] === getFriday(new Date().toISOString().split('T')[0])) {
          nextFri.setDate(nextFri.getDate() + 7);
      }
      setStartDate(getFriday(nextFri.toISOString().split('T')[0]));
      return;
    }
    const latest = allPlans[0]; 
    const latestDate = new Date(latest.startDate);
    latestDate.setDate(latestDate.getDate() + 7);
    setStartDate(latestDate.toISOString().split('T')[0]);
    setShowHistory(false);
  };

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-gray-100 pb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Kitchen Planner</h2>
            <div className="mt-1 shrink-0">
              {saveStatus === 'saving' && (
                <span className="text-[9px] font-black uppercase text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">Syncing...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[9px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Manifest Saved</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Save Failed</span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 font-medium font-sans mt-1">Friday to Thursday planning cycle.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button 
            variant="ghost" 
            onClick={handlePlanNextCycle} 
            className="flex-1 md:flex-none h-10 px-4 text-[9px] font-black uppercase tracking-widest border border-blue-100 text-blue-600 bg-blue-50/30"
          >
            + Next Cycle
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setShowHistory(!showHistory)} 
            className="flex-1 md:flex-none h-10 px-4 text-[9px] font-black uppercase tracking-widest border border-gray-100"
          >
            {showHistory ? 'View Current' : 'History'}
          </Button>
          <div className="w-full md:w-44">
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(getFriday(e.target.value))} 
              className="h-10 text-xs font-sans"
            />
          </div>
        </div>
      </header>

      {showHistory ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
          {allPlans.map(p => (
            <Card key={p.id} className="p-6 group hover:border-blue-200 transition-all cursor-pointer flex flex-col justify-between" onClick={() => { setStartDate(p.startDate); setShowHistory(false); }}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Friday {new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</h4>
                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">7-Day Kitchen Manifest</p>
                  </div>
                  <button 
                    onClick={(e) => handleDeletePlan(p.id, e)}
                    className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-all ${
                      activeConfirmId === p.id 
                        ? 'bg-red-600 text-white shadow-lg' 
                        : 'text-gray-300 hover:text-red-500'
                    }`}
                  >
                    {activeConfirmId === p.id ? 'Confirm' : 'Delete'}
                  </button>
                </div>
                <div className="space-y-1.5 mb-4">
                  {p.days.slice(0, 3).map((d, i) => (
                    <div key={i} className="flex gap-2 text-[11px] truncate">
                      <span className="text-gray-300 font-bold uppercase w-6">{new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' })[0]}</span>
                      <span className="text-gray-600 font-medium truncate">{d.mealNotes || '---'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="secondary" fullWidth className="h-9 text-[8px] uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Load Manifest</Button>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Mobile Day Strip Navigator */}
          <div className="lg:hidden sticky top-16 md:top-20 bg-[#fcfcfc] z-40 py-2 -mx-4 px-4 overflow-x-auto no-scrollbar border-b border-gray-100 flex gap-2">
            {plan.days.map((day, idx) => {
              const d = new Date(day.date);
              const isSelected = activeDayIdx === idx;
              return (
                <button
                  key={day.date}
                  onClick={() => setActiveDayIdx(idx)}
                  className={`flex flex-col items-center justify-center min-w-[56px] h-14 rounded-2xl transition-all border ${
                    isSelected 
                      ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-white border-gray-100 text-gray-400'
                  }`}
                >
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-blue-100' : 'text-gray-300'}`}>
                    {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className="text-sm font-black">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop Grid Layout */}
          <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-6">
            {plan.days.map((day, idx) => (
              <DayCard 
                key={day.date} 
                day={day} 
                users={users} 
                onChange={(updates) => handleUpdateDay(idx, updates)} 
              />
            ))}
          </div>

          {/* Mobile Focused Card */}
          <div className="lg:hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <DayCard 
              day={plan.days[activeDayIdx]} 
              users={users} 
              onChange={(updates) => handleUpdateDay(activeDayIdx, updates)}
              isMobile
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface DayCardProps {
  day: DayPlan;
  users: User[];
  onChange: (updates: Partial<DayPlan>) => void;
  isMobile?: boolean;
}

const DayCard: React.FC<DayCardProps> = ({ day, users, onChange, isMobile = false }) => {
  const dateObj = new Date(day.date);
  const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
  const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  return (
    <Card className={`flex flex-col overflow-hidden bg-white shadow-sm border-gray-100 ${isMobile ? 'min-h-[500px]' : ''}`}>
      <div className="p-5 border-b border-gray-50 bg-gray-50/40">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-black text-gray-900 leading-tight text-lg">{dayName}</h4>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{dateStr}</p>
          </div>
          {day.cookId && (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shadow-sm">
              <span className="text-[9px] font-black text-blue-600 uppercase">Chef</span>
              <span className="text-xs font-bold text-blue-900 truncate max-w-[90px]">
                {users.find(u => u.id === day.cookId)?.displayName}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1">
        <div className="space-y-3">
          <Label>Menu Planning</Label>
          <textarea 
            placeholder="What's for dinner?"
            className="w-full p-5 border border-gray-100 rounded-2xl text-base font-sans focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none h-32 bg-gray-50/50 placeholder:text-gray-300"
            value={day.mealNotes}
            onChange={e => onChange({ mealNotes: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          <Label>Who's Cooking Today?</Label>
          <div className="flex flex-wrap gap-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => onChange({ cookId: day.cookId === u.id ? null : u.id })}
                className={`flex-1 min-w-[80px] px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all border shadow-sm ${
                  day.cookId === u.id 
                    ? 'bg-[#2563eb] border-[#2563eb] text-white' 
                    : 'bg-white border-gray-100 text-gray-400 hover:text-gray-600'
                }`}
              >
                {u.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 pt-6 border-t border-gray-50">
          <Label>Attendance & Family Notes</Label>
          <div className="space-y-4">
            {users.map(u => {
              const isPresent = day.presentIds.includes(u.id);
              return (
                <div key={u.id} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => {
                        const next = isPresent 
                          ? day.presentIds.filter(id => id !== u.id)
                          : [...day.presentIds, u.id];
                        onChange({ presentIds: next });
                      }}
                      className={`flex items-center gap-3 transition-opacity ${isPresent ? 'opacity-100' : 'opacity-30'}`}
                    >
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${isPresent ? 'bg-blue-500 border-blue-500 shadow-md shadow-blue-500/20' : 'border-gray-200'}`}>
                        {isPresent && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <span className={`text-sm font-bold ${isPresent ? 'text-gray-900' : 'text-gray-400'}`}>{u.displayName}</span>
                    </button>
                  </div>
                  {isPresent && (
                    <input 
                      placeholder={`Add dietary notes for ${u.displayName.split(' ')[0]}...`}
                      className="w-full px-4 py-2 text-xs font-sans text-gray-600 border-0 border-l-2 border-blue-100 focus:ring-0 bg-transparent placeholder:text-gray-200 italic"
                      value={day.userNotes[u.id] || ''}
                      onChange={e => onChange({ userNotes: { ...day.userNotes, [u.id]: e.target.value } })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};
