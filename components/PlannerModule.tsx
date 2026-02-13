
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, Button, Input, Label } from './UI';
import { User, Plan, DayPlan } from '../types/contract';
import { saltBackend } from '../backend/api';

interface PlannerModuleProps {
  users: User[];
  onRefresh: () => void;
}

const TEMPLATE_ID = 'plan-template';

export const PlannerModule: React.FC<PlannerModuleProps> = ({ users, onRefresh }) => {
  const [startDate, setStartDate] = useState(getFriday(new Date().toISOString().split('T')[0]));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [activeDayIdx, setActiveDayIdx] = useState(0); 
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [kitchenUserOrder, setKitchenUserOrder] = useState<string[] | null>(null);
  
  const debounceTimerRef = useRef<number | null>(null);
  const lastSavedJsonRef = useRef<string>('');
  const lastLoadedStartDateRef = useRef<string | null>(null);

  function getFriday(dStr: string) {
    // Parse precisely to UTC midnight to avoid timezone-related day shifts
    const normalized = dStr.includes('T') ? dStr : `${dStr}T00:00:00Z`;
    const d = new Date(normalized);
    
    // Use UTC day and date methods for deterministic British/UTC normalization
    const day = d.getUTCDay();
    const daysToSubtract = (day + 2) % 7; 
    d.setUTCDate(d.getUTCDate() - daysToSubtract);
    return d.toISOString().split('T')[0];
  }

  const loadAllPlans = useCallback(async () => {
    const plans = await saltBackend.getPlans();
    setAllPlans(plans);
  }, []);

  // Load persisted global user order (if set) to order planner view
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await saltBackend.getKitchenSettings();
        if (mounted && settings?.userOrder && Array.isArray(settings.userOrder)) {
          setKitchenUserOrder(settings.userOrder as string[]);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const orderedUsers = useMemo(() => {
    if (!kitchenUserOrder || kitchenUserOrder.length === 0) return users;
    const byId = new Map(users.map(u => [u.id, u] as [string, User]));
    const ordered: User[] = [];
    for (const id of kitchenUserOrder) {
      const u = byId.get(id);
      if (u) {
        ordered.push(u);
        byId.delete(id);
      }
    }
    for (const u of users) {
      if (byId.has(u.id)) ordered.push(u);
    }
    return ordered;
  }, [users, kitchenUserOrder]);

  const loadPlan = useCallback(async () => {
    const isInitialLoadForDate = lastLoadedStartDateRef.current !== startDate;
    if (isInitialLoadForDate) setIsLoading(true);
    
    try {
      const existing = await saltBackend.getPlanByDate(startDate);
      let targetPlan: Plan;
      
      if (existing) {
        targetPlan = existing;
      } else {
        const all = await saltBackend.getPlans();
        const template = all.find(p => p.id === TEMPLATE_ID || p.startDate === 'template');

        const days: DayPlan[] = Array.from({ length: 7 }).map((_, i) => {
          // Construct next days precisely in UTC
          const d = new Date(`${startDate}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + i);
          const tDay = template?.days[i];
          
          return {
            date: d.toISOString().split('T')[0],
            cookId: tDay?.cookId || null,
            presentIds: tDay?.presentIds || orderedUsers.map(u => u.id),
            userNotes: tDay?.userNotes || {},
            mealNotes: tDay?.mealNotes || '',
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
      
      if (isInitialLoadForDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayIdx = targetPlan.days.findIndex(d => d.date === todayStr);
        setActiveDayIdx(todayIdx !== -1 ? todayIdx : 0);
        lastLoadedStartDateRef.current = startDate;
      }

      lastSavedJsonRef.current = JSON.stringify(targetPlan);
      setSaveStatus('saved');
      loadAllPlans();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, users, loadAllPlans, orderedUsers]);

  const loadTemplate = useCallback(async () => {
    const isInitialLoadForDate = lastLoadedStartDateRef.current !== 'template';
    if (isInitialLoadForDate) setIsLoading(true);
    
    try {
      const all = await saltBackend.getPlans();
      let template = all.find(p => p.id === TEMPLATE_ID || p.startDate === 'template');
      
      if (!template) {
        template = {
          id: TEMPLATE_ID,
          startDate: 'template',
          days: Array.from({ length: 7 }).map((_, i) => ({
            date: `day-${i}`,
            cookId: null,
            presentIds: orderedUsers.map(u => u.id),
            userNotes: {},
            mealNotes: '',
          })),
          createdAt: new Date().toISOString(),
          createdBy: '',
        };
      }
      setPlan(template);
      
      if (isInitialLoadForDate) {
        setActiveDayIdx(0);
        lastLoadedStartDateRef.current = 'template';
      }

      lastSavedJsonRef.current = JSON.stringify(template);
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [users, orderedUsers]);

  useEffect(() => {
    if (startDate === 'template') {
      loadTemplate();
    } else {
      loadPlan();
    }
  }, [startDate, loadPlan, loadTemplate]);

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
        const payload = plan.id === TEMPLATE_ID || plan.startDate === 'template' 
          ? { ...data, id: TEMPLATE_ID, startDate: 'template' } 
          : { ...data, id: plan.id };
          
        const saved = await saltBackend.createOrUpdatePlan(payload as any);
        
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
  }, [plan, isLoading, onRefresh, loadAllPlans]);

  const handleUpdateDay = (index: number, updates: Partial<DayPlan>) => {
    if (!plan) return;
    const newDays = [...plan.days];
    newDays[index] = { ...newDays[index], ...updates };
    setPlan({ ...plan, days: newDays });
  };

  const handlePlanNextCycle = () => {
    const historical = allPlans.filter(p => p.id !== TEMPLATE_ID && p.startDate !== 'template');
    if (historical.length === 0) {
      const now = new Date();
      // Calculate days to next Friday (Friday is day 5)
      const daysUntilNextOrCurrentFriday = (5 + 7 - now.getDay()) % 7;
      const nextFri = new Date(now);
      nextFri.setDate(now.getDate() + (daysUntilNextOrCurrentFriday === 0 ? 7 : daysUntilNextOrCurrentFriday));
      const nextFriStr = getFriday(nextFri.toISOString().split('T')[0]);
      setStartDate(nextFriStr);
    } else {
      const latest = historical.sort((a,b) => b.startDate.localeCompare(a.startDate))[0]; 
      const latestDate = new Date(`${latest.startDate}T00:00:00Z`);
      latestDate.setUTCDate(latestDate.getUTCDate() + 7);
      setStartDate(latestDate.toISOString().split('T')[0]);
    }
    setShowHistory(false);
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await saltBackend.deletePlan(id);
      setDeletingId(null);
      loadAllPlans();
      onRefresh();
    } catch (err) {
      alert("Failed to delete plan.");
    }
  };

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isTemplateMode = plan.id === TEMPLATE_ID || plan.startDate === 'template';

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 box-border animate-in fade-in duration-500 overflow-hidden">
      <div className="bg-[#fcfcfc] pb-3 w-full min-w-0 box-border border-b border-gray-100 mb-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex-1 max-w-[150px] min-w-0">
            {isTemplateMode ? (
              <div className="h-10 px-4 flex items-center bg-orange-50 text-orange-700 rounded-xl border border-orange-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
                Master Template
              </div>
            ) : (
              <Input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(getFriday(e.target.value))} 
                className="h-10 text-xs font-sans w-full shadow-inner box-border border-gray-100 bg-gray-50/30 rounded-xl"
              />
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${showHistory ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-500/10' : 'bg-white border-gray-100 text-gray-400 hover:text-orange-600 hover:bg-gray-50'}`}
              onClick={() => {
                if (isTemplateMode) setStartDate(getFriday(new Date().toISOString().split('T')[0]));
                setShowHistory(!showHistory);
              }} 
              title="All Weekly Plans"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            </button>
            
            <div className="w-px h-6 bg-gray-100 mx-1" />

            <div className="flex flex-col items-end pr-1">
              <span className={`text-[7px] font-black uppercase tracking-tighter ${saveStatus === 'saving' ? 'text-orange-500 animate-pulse' : 'text-gray-300'}`}>
                {saveStatus === 'saving' ? 'Syncing' : 'Synced'}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
            </div>
          </div>
        </div>

        {!showHistory && (
          <div className="lg:hidden w-full overflow-x-auto no-scrollbar flex gap-2 pt-3 px-0.5 snap-x snap-mandatory box-border">
            {plan.days.map((day, idx) => {
              const isToday = !isTemplateMode && day.date === new Date().toISOString().split('T')[0];
              const isSelected = activeDayIdx === idx;
              
              let dayLabel, dateLabel;
              if (isTemplateMode) {
                const daysOfWeek = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
                dayLabel = daysOfWeek[idx];
                dateLabel = '---';
              } else {
                const d = new Date(day.date);
                dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short' });
                dateLabel = d.getDate();
              }

              return (
                <button 
                  key={idx} 
                  onClick={() => setActiveDayIdx(idx)} 
                  className={`flex flex-col items-center justify-center min-w-[50px] flex-1 h-14 rounded-xl transition-all border snap-center shrink-0 ${
                    isSelected 
                      ? 'bg-orange-600 border-orange-600 text-white shadow-md' 
                      : isToday 
                        ? 'bg-orange-50 border-orange-100 text-orange-700'
                        : 'bg-white text-gray-400 border-gray-100'
                  }`}
                >
                  <span className={`text-[7px] font-black uppercase ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>{dayLabel}</span>
                  <span className="text-sm font-black">{dateLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showHistory ? (
        <div className="space-y-6 pt-2 w-full min-w-0 box-border overflow-hidden">
          <div className="flex justify-between items-center px-1">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Master & History</h4>
             <button 
               onClick={handlePlanNextCycle} 
               className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
               title="Create next weekly plan"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
             </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 box-border">
            <Card 
              className={`p-4 group cursor-pointer box-border border-l-4 transition-all ${startDate === 'template' ? 'bg-orange-50 border-orange-600' : 'bg-white border-l-gray-200 hover:border-l-orange-400'}`}
              onClick={() => { setStartDate('template'); setShowHistory(false); }}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-black text-gray-900 text-[13px] uppercase tracking-wider">Master Template</h4>
                  <p className="text-[9px] text-gray-400 font-bold uppercase">Weekly Defaults</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" /></svg>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 italic">Sets meal notes and assigned chefs for all new weeks.</p>
            </Card>

            {allPlans.filter(p => p.id !== TEMPLATE_ID && p.startDate !== 'template').map(p => {
              const isConfirming = deletingId === p.id;
              return (
                <Card 
                  key={p.id} 
                  className={`p-4 group relative hover:border-orange-200 cursor-pointer bg-white box-border border-l-4 border-l-gray-100 transition-all ${isConfirming ? 'ring-2 ring-red-500' : ''}`} 
                  onClick={() => { if(!isConfirming) { setStartDate(p.startDate); setShowHistory(false); } }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-900 text-[13px]">Fri {new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</h4>
                    </div>
                    {isConfirming ? (
                      <div className="flex gap-1 animate-in slide-in-from-right-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeletePlan(p.id); }}
                          className="bg-red-500 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                          className="bg-gray-100 text-gray-500 px-2 py-1 rounded-lg text-[8px] font-black uppercase"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeletingId(p.id); }}
                        className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        aria-label="Delete plan"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {p.days.slice(0, 3).map((d, i) => (
                      <div key={i} className="flex gap-2 text-[10px] truncate">
                        <span className="text-gray-300 font-bold uppercase w-4 shrink-0">{new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' })[0]}</span>
                        <span className="text-gray-500 font-medium truncate italic">{d.mealNotes || '---'}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 lg:space-y-4 pt-4 w-full min-w-0 box-border overflow-hidden">
          <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-4 box-border">
            {plan.days.map((day, idx) => (
              <DayCard 
                key={isTemplateMode ? `template-${idx}` : day.date} 
                day={day} 
                users={orderedUsers} 
                isTemplate={isTemplateMode}
                onChange={(updates) => handleUpdateDay(idx, updates)} 
              />
            ))}
          </div>

          <div className="lg:hidden w-full min-w-0 pb-12 box-border px-0.5">
            <DayCard 
              day={plan.days[activeDayIdx]} 
              users={orderedUsers} 
              isTemplate={isTemplateMode}
              onChange={(updates) => handleUpdateDay(activeDayIdx, updates)} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

const DayCard: React.FC<{ day: DayPlan; users: User[]; isTemplate: boolean; onChange: (updates: Partial<DayPlan>) => void }> = ({ day, users, isTemplate, onChange }) => {
  const isToday = !isTemplate && day.date === new Date().toISOString().split('T')[0];
  
  let dayName = '';
  let dateString = '';

  if (isTemplate) {
    const days = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const idx = parseInt(day.date.split('-')[1]);
    dayName = days[idx] || 'Unknown';
    dateString = 'Default Schedule';
  } else {
    const d = new Date(day.date);
    dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
    dateString = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const handleUserNoteChange = (userId: string, note: string) => {
    const newUserNotes = { ...day.userNotes, [userId]: note };
    onChange({ userNotes: newUserNotes });
  };

  return (
    <Card className={`flex flex-col bg-white shadow-sm transition-all border-l-4 border-y border-r border-gray-100 w-full max-w-full min-w-0 box-border overflow-hidden ${isToday ? 'ring-2 ring-orange-500/20 border-l-orange-600 border-orange-100' : 'border-l-orange-600/50'}`}>
      <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isToday ? 'bg-orange-50/30 border-orange-50' : (isTemplate ? 'bg-orange-50/10' : 'bg-gray-50/10')}`}>
        <div className="min-w-0 flex-1">
          <h4 className="font-black text-gray-900 text-sm flex items-center gap-2 truncate">
            {dayName}
            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse shrink-0" />}
          </h4>
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{dateString}</p>
        </div>
        {day.cookId && (
          <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center text-white text-[10px] font-black shadow-sm shrink-0 ml-3">
            {users.find(u => u.id === day.cookId)?.displayName?.[0] || '?'}
          </div>
        )}
      </div>

      <div className="p-4 flex-1 space-y-6 flex flex-col min-w-0 box-border">
        <div className="space-y-1.5 min-w-0 box-border">
          <Label className="text-[9px]">{isTemplate ? 'Default Meal' : 'Meal Plan'}</Label>
          <textarea 
            placeholder={isTemplate ? "What's the usual plan for this day?" : "What's for dinner?"}
            className="w-full p-3 border border-gray-100 rounded-xl text-sm font-medium font-sans leading-relaxed focus:ring-2 focus:ring-orange-100/50 outline-none transition-all resize-none h-24 bg-gray-50/30 placeholder:text-gray-200 box-border focus:border-orange-200"
            value={day.mealNotes}
            onChange={e => onChange({ mealNotes: e.target.value })}
          />
        </div>

        {/* Head Chef grid removed. Cook selection moved inline with attendees below. */}

        <div className="space-y-4 pt-4 border-t border-gray-50 min-w-0 box-border">
          <Label className="text-[9px]">Attendees & Notes</Label>
          <div className="space-y-4 min-w-0 box-border">
            {users.map(u => {
              const isPresent = day.presentIds.includes(u.id);
              const isCook = day.cookId === u.id;
              return (
                <div key={u.id} className="min-w-0 space-y-1.5 box-border">
                  <div className="flex items-center gap-2 group w-full min-w-0 box-border">
                    <button 
                      onClick={() => {
                        const next = isPresent ? day.presentIds.filter(id => id !== u.id) : [...day.presentIds, u.id];
                        onChange({ presentIds: next });
                      }} 
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isPresent ? 'bg-emerald-600 border-emerald-600' : 'border-gray-200'}`}>
                        {isPresent && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <span className={`text-xs font-bold truncate flex-1 ${isPresent ? 'text-gray-900' : 'text-gray-300'}`}>
                        {u.displayName}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newCookId = isCook ? null : u.id;
                        const nextPresent = day.presentIds.includes(u.id) ? day.presentIds : [...day.presentIds, u.id];
                        onChange({ cookId: newCookId, presentIds: newCookId ? nextPresent : day.presentIds });
                      }}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isCook ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-gray-200'}`}
                      aria-label={`Toggle cook for ${u.displayName}`}
                      title={isCook ? 'Unset as cook' : 'Set as cook'}
                    >
                      {isCook ? (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <svg className="w-2.5 h-2.5 text-transparent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                      )}
                    </button>
                  </div>
                  <div className="pl-6 w-full min-w-0 box-border">
                    <input 
                      type="text"
                      placeholder="Timing/Special reqs..."
                      className="w-full py-1 text-[11px] font-medium font-sans text-gray-500 border-b border-gray-100 focus:border-orange-300 bg-transparent outline-none placeholder:text-gray-200 transition-colors truncate box-border"
                      value={day.userNotes[u.id] || ''}
                      onChange={e => handleUserNoteChange(u.id, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};