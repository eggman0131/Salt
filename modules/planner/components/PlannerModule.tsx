import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Stack } from '@/shared/components/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddButton } from '@/components/ui/add-button';
import { Calendar, ChevronRight, History, Loader2, Plus, Trash2 } from 'lucide-react';
import { User, Plan, DayPlan } from '../../../types/contract';
import { plannerBackend } from '../backend';
import { softToast } from '@/lib/soft-toast';
import { useAvatarUrl } from '../../../shared/hooks/useAvatarUrl';

interface PlannerModuleProps {
  users: User[];
  onRefresh: () => void;
}

const TEMPLATE_ID = 'plan-template';

export const PlannerModule: React.FC<PlannerModuleProps> = ({ users, onRefresh }) => {
  const [startDate, setStartDate] = useState(getFriday(new Date().toISOString().split('T')[0]));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [plansOpen, setPlansOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [kitchenUserOrder, setKitchenUserOrder] = useState<string[] | null>(null);

  const debounceTimerRef = useRef<number | null>(null);
  const lastSavedJsonRef = useRef<string>('');
  const lastLoadedStartDateRef = useRef<string | null>(null);

  function getFriday(dStr: string) {
    const normalized = dStr.includes('T') ? dStr : `${dStr}T00:00:00Z`;
    const d = new Date(normalized);
    const day = d.getUTCDay();
    const daysToSubtract = (day + 2) % 7;
    d.setUTCDate(d.getUTCDate() - daysToSubtract);
    return d.toISOString().split('T')[0];
  }

  const loadAllPlans = useCallback(async () => {
    const plans = await plannerBackend.getPlans();
    setAllPlans(plans);
  }, []);

  // Load persisted global user order
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await plannerBackend.getKitchenSettings();
        if (mounted && settings?.userOrder && Array.isArray(settings.userOrder)) {
          setKitchenUserOrder(settings.userOrder as string[]);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const orderedUsers = useMemo(() => {
    if (!kitchenUserOrder || kitchenUserOrder.length === 0) {
      return users;
    }

    const userMap = new Map(users.map(u => [u.id, u]));
    const reordered: User[] = [];

    for (const userId of kitchenUserOrder) {
      const user = userMap.get(userId);
      if (user) {
        reordered.push(user);
        userMap.delete(userId);
      }
    }

    for (const user of userMap.values()) {
      reordered.push(user);
    }

    return reordered;
  }, [users, kitchenUserOrder]);

  const loadPlan = useCallback(async () => {
    const isInitialLoadForDate = lastLoadedStartDateRef.current !== startDate;
    if (isInitialLoadForDate) setIsLoading(true);

    try {
      const existing = await plannerBackend.getPlanByDate(startDate);
      let targetPlan: Plan;

      if (existing) {
        targetPlan = existing;
      } else {
        const all = await plannerBackend.getPlans();
        const template = all.find(p => p.id === TEMPLATE_ID || p.startDate === 'template');

        const days: DayPlan[] = Array.from({ length: 7 }).map((_, i) => {
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
      softToast.error('Failed to load plan');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, orderedUsers, loadAllPlans]);

  const loadTemplate = useCallback(async () => {
    const isInitialLoadForDate = lastLoadedStartDateRef.current !== 'template';
    if (isInitialLoadForDate) setIsLoading(true);

    try {
      const all = await plannerBackend.getPlans();
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
      softToast.error('Failed to load template');
    } finally {
      setIsLoading(false);
    }
  }, [orderedUsers]);

  useEffect(() => {
    if (startDate === 'template') {
      loadTemplate();
    } else {
      loadPlan();
    }
  }, [startDate, loadPlan, loadTemplate]);

  // Auto-save debounced
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

        const saved = await plannerBackend.createOrUpdatePlan(payload as any);

        if (plan.id === 'new') {
          setPlan(prev => (prev ? { ...prev, id: saved.id } : null));
        }
        lastSavedJsonRef.current = JSON.stringify(saved);
        setSaveStatus('saved');
        loadAllPlans();
        onRefresh();
      } catch (err) {
        setSaveStatus('error');
        softToast.error('Failed to save plan');
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

  const handleCreateNextCycle = (customDate?: string) => {
    if (customDate) {
      setStartDate(customDate);
      return;
    }
    const historical = allPlans.filter(p => p.id !== TEMPLATE_ID && p.startDate !== 'template');
    if (historical.length === 0) {
      const now = new Date();
      const daysUntilNextOrCurrentFriday = (5 + 7 - now.getDay()) % 7;
      const nextFri = new Date(now);
      nextFri.setDate(now.getDate() + (daysUntilNextOrCurrentFriday === 0 ? 7 : daysUntilNextOrCurrentFriday));
      const nextFriStr = getFriday(nextFri.toISOString().split('T')[0]);
      setStartDate(nextFriStr);
    } else {
      const latest = historical.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const latestDate = new Date(`${latest.startDate}T00:00:00Z`);
      latestDate.setUTCDate(latestDate.getUTCDate() + 7);
      setStartDate(latestDate.toISOString().split('T')[0]);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await plannerBackend.deletePlan(id);
      setDeleteConfirmId(null);
      softToast.success('Plan deleted');
      loadAllPlans();
      onRefresh();
    } catch (err) {
      softToast.error('Failed to delete plan');
    }
  };

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isTemplateMode = plan.id === TEMPLATE_ID || plan.startDate === 'template';
  const weekStart = new Date(`${startDate}T00:00:00Z`);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const activeDay = plan.days[activeDayIdx];
  const firstDay = new Date(`${startDate}T00:00:00Z`);
  const planTitle = isTemplateMode 
    ? 'Master Template' 
    : firstDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  return (
    <Stack spacing="gap-6">
      <Stack spacing="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground truncate">{planTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPlansOpen(true)} className="gap-2">
              <History className="h-4 w-4" />
              Plans
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          {isTemplateMode ? (
            <Button variant="outline" onClick={() => setStartDate(getFriday(new Date().toISOString().split('T')[0]))}>
              Back to week
            </Button>
          ) : (
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(getFriday(e.target.value))}
              className="h-8 w-auto text-sm sm:h-9"
            />
          )}

          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Saving" />}
            {saveStatus === 'error' && <div className="h-2 w-2 rounded-full bg-destructive" title="Save failed" />}
            {saveStatus === 'saved' && <div className="h-2 w-2 rounded-full bg-green-600" title="Saved" />}
          </div>
        </div>
      </Stack>

      <WeekHeader
        days={plan.days}
        activeIndex={activeDayIdx}
        users={orderedUsers}
        onSelect={setActiveDayIdx}
      />

      <DayDetail
        day={activeDay}
        users={orderedUsers}
        onChange={(updates) => handleUpdateDay(activeDayIdx, updates)}
      />

      <PlansDialog
        open={plansOpen}
        onOpenChange={setPlansOpen}
        allPlans={allPlans}
        onSelectPlan={(planId) => {
          if (planId === TEMPLATE_ID) {
            setStartDate('template');
          } else {
            const planToOpen = allPlans.find(p => p.id === planId);
            if (planToOpen) setStartDate(planToOpen.startDate);
          }
          setPlansOpen(false);
        }}
        onCreateNextWeek={handleCreateNextCycle}
        onDeletePlan={(planId) => setDeleteConfirmId(planId)}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete plan?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The plan will be permanently deleted.
          </AlertDialogDescription>
          <div className="flex items-center justify-end gap-2 pt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeletePlan(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Stack>
  );
};

const DayCookAvatar: React.FC<{ user: User | undefined }> = ({ user }) => {
  const avatarUrl = useAvatarUrl(user?.avatarPath);
  return (
    <Avatar className="h-8 w-8">
      {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.displayName} />}
      <AvatarFallback className="text-xs">
        {user ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '—'}
      </AvatarFallback>
    </Avatar>
  );
};

const PeopleAvatarDisplay: React.FC<{ user: User }> = ({ user }) => {
  const avatarUrl = useAvatarUrl(user.avatarPath);
  return (
    <Avatar className="h-9 w-9">
      {avatarUrl && <AvatarImage src={avatarUrl} alt={user.displayName} />}
      <AvatarFallback className="text-xs">
        {user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
};

const WeekHeader: React.FC<{
  days: DayPlan[];
  users: User[];
  activeIndex: number;
  onSelect: (index: number) => void;
}> = ({ days, users, activeIndex, onSelect }) => {
  return (
    <div>
      <div className="hidden md:block">
        <Card>
          <CardContent className="grid grid-cols-7 gap-2 p-4">
            {days.map((day, idx) => {
              const date = new Date(`${day.date}T00:00:00Z`);
              const cook = users.find(u => u.id === day.cookId);
              const firstLine = day.mealNotes.split('\n')[0]?.trim() || '—';
              const isActive = idx === activeIndex;
              return (
                <button
                  key={day.date}
                  onClick={() => onSelect(idx)}
                  className={`flex flex-col items-center gap-1.5 rounded-md border px-3 py-2 transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-xs text-muted-foreground">
                    {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <DayCookAvatar user={cook} />
                  <span className="text-xs text-muted-foreground truncate max-w-full">{firstLine}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden">
        <Tabs value={String(activeIndex)} onValueChange={(value) => onSelect(Number(value))}>
          <TabsList className="w-full flex h-11 bg-muted/50 p-1 border shadow-sm transition-all">
            {days.map((day, idx) => {
              const date = new Date(`${day.date}T00:00:00Z`);
              return (
                <TabsTrigger
                  key={day.date}
                  value={String(idx)}
                  className="h-full flex-1 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};

const DayDetail: React.FC<{
  day: DayPlan;
  users: User[];
  onChange: (updates: Partial<DayPlan>) => void;
}> = ({ day, users, onChange }) => {
  const date = new Date(`${day.date}T00:00:00Z`);

  const handleChefSelect = (userId: string | null) => {
    if (userId === null) {
      onChange({ cookId: null });
      return;
    }
    const nextPresent = day.presentIds.includes(userId)
      ? day.presentIds
      : [...day.presentIds, userId];
    onChange({ cookId: userId, presentIds: nextPresent });
  };

  return (
    <Card className="w-full">
      <CardHeader className="p-4 pb-3 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Day detail</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-4 md:p-6 pt-0 md:pt-0">
        <div className="space-y-2">
          <Label>Chef</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleChefSelect(null)}
              className={`rounded-full p-0.5 transition-all ${
                day.cookId === null
                  ? 'ring-2 ring-primary ring-offset-2'
                  : 'opacity-50 hover:opacity-100'
              }`}
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">—</span>
              </div>
            </button>
            {users.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleChefSelect(user.id)}
                className={`rounded-full p-0.5 transition-all ${
                  day.cookId === user.id
                    ? 'ring-2 ring-primary ring-offset-2'
                    : 'opacity-50 hover:opacity-100'
                }`}
              >
                <DayCookAvatar user={user} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="menu-editor">Menu</Label>
          <Textarea
            id="menu-editor"
            placeholder="Add the menu for the day"
            className="min-h-28"
            value={day.mealNotes}
            onChange={e => onChange({ mealNotes: e.target.value })}
          />
        </div>

        <PeopleForDay
          users={users}
          presentIds={day.presentIds}
          userNotes={day.userNotes}
          onTogglePresence={(userId) => {
            const next = day.presentIds.includes(userId)
              ? day.presentIds.filter(id => id !== userId)
              : [...day.presentIds, userId];
            onChange({ presentIds: next });
          }}
          onUpdateNote={(userId, note) => {
            onChange({ userNotes: { ...day.userNotes, [userId]: note } });
          }}
        />
      </CardContent>
    </Card>
  );
};

const PeopleForDay: React.FC<{
  users: User[];
  presentIds: string[];
  userNotes: Record<string, string>;
  onTogglePresence: (userId: string) => void;
  onUpdateNote: (userId: string, note: string) => void;
}> = ({ users, presentIds, userNotes, onTogglePresence, onUpdateNote }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>People for the day</Label>
        <span className="text-xs text-muted-foreground">{presentIds.length} attending</span>
      </div>
      <div className="space-y-3">
        {users.map(user => {
          const isPresent = presentIds.includes(user.id);
          return (
            <div key={user.id} className="rounded-md border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PeopleAvatarDisplay user={user} />
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePresence(user.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    isPresent
                      ? 'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {isPresent ? 'Attending' : 'Not attending'}
                </button>
              </div>
              <Input
                placeholder="Notes for the day"
                value={userNotes[user.id] || ''}
                onChange={e => onUpdateNote(user.id, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PlansDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPlans: Plan[];
  onSelectPlan: (planId: string) => void;
  onCreateNextWeek: (customDate?: string) => void;
  onDeletePlan: (planId: string) => void;
}> = ({ open, onOpenChange, allPlans, onSelectPlan, onCreateNextWeek, onDeletePlan }) => {
  const plans = allPlans.filter(p => p.id !== TEMPLATE_ID && p.startDate !== 'template');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  // Get nearest Friday for initial value
  const getNearestFriday = () => {
    const historical = plans;
    if (historical.length === 0) {
      const now = new Date();
      const daysUntilNextOrCurrentFriday = (5 + 7 - now.getDay()) % 7;
      const nextFri = new Date(now);
      nextFri.setDate(now.getDate() + (daysUntilNextOrCurrentFriday === 0 ? 7 : daysUntilNextOrCurrentFriday));
      return nextFri.toISOString().split('T')[0];
    } else {
      const latest = historical.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const latestDate = new Date(`${latest.startDate}T00:00:00Z`);
      latestDate.setUTCDate(latestDate.getUTCDate() + 7);
      return latestDate.toISOString().split('T')[0];
    }
  };

  const handleOpenDatePicker = () => {
    setSelectedDate(getNearestFriday());
    setDatePickerOpen(true);
  };

  const handleDateChange = (dateStr: string) => {
    // Ensure proper date parsing with UTC
    const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`;
    const date = new Date(normalized);
    // Check if it's a Friday (5 = Friday in getUTCDay() where 0 = Sunday)
    if (date.getUTCDay() === 5) {
      setSelectedDate(dateStr);
    } else {
      softToast.error('Please select a Friday');
    }
  };

  const handleCreatePlan = () => {
    if (!selectedDate) {
      softToast.error('Please select a date');
      return;
    }
    const normalized = selectedDate.includes('T') ? selectedDate : `${selectedDate}T00:00:00Z`;
    const date = new Date(normalized);
    if (date.getUTCDay() !== 5) {
      softToast.error('Please select a Friday');
      return;
    }
    onCreateNextWeek(selectedDate);
    onOpenChange(false);
    setDatePickerOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Plans</DialogTitle>
            <DialogDescription>Open a plan, create a new week, or manage templates.</DialogDescription>
          </DialogHeader>

          <Stack spacing="gap-4">
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">Master template</p>
                  <p className="text-xs text-muted-foreground">Defaults for new weeks</p>
                </div>
                <Button variant="outline" onClick={() => onSelectPlan(TEMPLATE_ID)}>
                  Open
                </Button>
              </CardContent>
            </Card>

            <Stack spacing="gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Weekly plans</p>
                <AddButton label="Add plan" onClick={handleOpenDatePicker} />
              </div>
              <Stack spacing="gap-2">
                {plans.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No saved plans yet.
                  </div>
                )}
                {plans.map(plan => {
                  const date = new Date(`${plan.startDate}T00:00:00Z`);
                  return (
                    <Card key={plan.id}>
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <p className="text-sm font-medium">
                            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {plan.days[0]?.mealNotes.split('\n')[0] || 'No menu yet'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={() => onSelectPlan(plan.id)}>
                            Open
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onDeletePlan(plan.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select plan start date</DialogTitle>
            <DialogDescription>Choose a Friday to start the new plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="plan-start-date">Start date (Friday)</Label>
              <Input
                id="plan-start-date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Plans must start on a Friday
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDatePickerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePlan}>
                Create plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
