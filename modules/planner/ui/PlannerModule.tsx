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
import { Calendar, Loader2, Trash2, Search, X, ShoppingCart } from 'lucide-react';
import { User, Plan, DayPlan, Recipe } from '../../../types/contract';
import {
  getPlans,
  getPlanByDate,
  createOrUpdatePlan,
  deletePlan,
  getKitchenSettings,
  getFriday,
  TEMPLATE_ID,
} from '../api';
import { syncPlannerToList, getDefaultShoppingList } from '../../shopping-list';
import { softToast } from '@/lib/soft-toast';

interface PlannerModuleProps {
  users: User[];
  recipes: Recipe[];
  onRefresh: () => void;
}

export const PlannerModule: React.FC<PlannerModuleProps> = ({ users, recipes, onRefresh }) => {
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

  const loadAllPlans = useCallback(async () => {
    const plans = await getPlans();
    setAllPlans(plans);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await getKitchenSettings();
        if (mounted && settings?.userOrder && Array.isArray(settings.userOrder)) {
          setKitchenUserOrder(settings.userOrder as string[]);
        }
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const orderedUsers = useMemo(() => {
    if (!kitchenUserOrder || kitchenUserOrder.length === 0) return users;
    const userMap = new Map(users.map((u) => [u.id, u]));
    const reordered: User[] = [];
    for (const userId of kitchenUserOrder) {
      const user = userMap.get(userId);
      if (user) { reordered.push(user); userMap.delete(userId); }
    }
    for (const user of userMap.values()) reordered.push(user);
    return reordered;
  }, [users, kitchenUserOrder]);

  const loadPlan = useCallback(async () => {
    const isInitialLoadForDate = lastLoadedStartDateRef.current !== startDate;
    if (isInitialLoadForDate) setIsLoading(true);

    try {
      const existing = await getPlanByDate(startDate);
      let targetPlan: Plan;

      if (existing) {
        targetPlan = existing;
      } else {
        const all = await getPlans();
        const template = all.find((p) => p.id === TEMPLATE_ID || p.startDate === 'template');
        const days: DayPlan[] = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(`${startDate}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + i);
          const tDay = template?.days[i];
          return {
            date: d.toISOString().split('T')[0],
            cookId: tDay?.cookId || null,
            presentIds: tDay?.presentIds || orderedUsers.map((u) => u.id),
            userNotes: tDay?.userNotes || {},
            mealNotes: tDay?.mealNotes || '',
            recipeIds: tDay?.recipeIds || [],
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
        const todayIdx = targetPlan.days.findIndex((d) => d.date === todayStr);
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
      const all = await getPlans();
      let template = all.find((p) => p.id === TEMPLATE_ID || p.startDate === 'template');
      if (!template) {
        template = {
          id: TEMPLATE_ID,
          startDate: 'template',
          days: Array.from({ length: 7 }).map((_, i) => ({
            date: `day-${i}`,
            cookId: null,
            presentIds: orderedUsers.map((u) => u.id),
            userNotes: {},
            mealNotes: '',
            recipeIds: [],
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

  // Auto-save with debounce
  useEffect(() => {
    if (!plan || isLoading) return;
    const currentJson = JSON.stringify(plan);
    if (currentJson === lastSavedJsonRef.current) return;

    const isNewUntouched = plan.id === 'new' && plan.days.every((d) => !d.mealNotes && !d.cookId);
    if (isNewUntouched) return;

    setSaveStatus('saving');
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const { id, createdAt, createdBy, ...data } = plan;
        const payload =
          plan.id === TEMPLATE_ID || plan.startDate === 'template'
            ? { ...data, id: TEMPLATE_ID, startDate: 'template' }
            : { ...data, id: plan.id };

        const saved = await createOrUpdatePlan(payload as any);
        if (plan.id === 'new') {
          setPlan((prev) => (prev ? { ...prev, id: saved.id } : null));
        }
        lastSavedJsonRef.current = JSON.stringify(saved);
        setSaveStatus('saved');
        loadAllPlans();
        onRefresh();
      } catch {
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
    if (customDate) { setStartDate(customDate); return; }
    const historical = allPlans.filter((p) => p.id !== TEMPLATE_ID && p.startDate !== 'template');
    if (historical.length === 0) {
      const now = new Date();
      const daysUntilNextOrCurrentFriday = (5 + 7 - now.getDay()) % 7;
      const nextFri = new Date(now);
      nextFri.setDate(now.getDate() + (daysUntilNextOrCurrentFriday === 0 ? 7 : daysUntilNextOrCurrentFriday));
      setStartDate(getFriday(nextFri.toISOString().split('T')[0]));
    } else {
      const latest = historical.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const latestDate = new Date(`${latest.startDate}T00:00:00Z`);
      latestDate.setUTCDate(latestDate.getUTCDate() + 7);
      setStartDate(latestDate.toISOString().split('T')[0]);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await deletePlan(id);
      setDeleteConfirmId(null);
      softToast.success('Plan deleted');
      loadAllPlans();
      onRefresh();
    } catch {
      softToast.error('Failed to delete plan');
    }
  };

  const handleAddWeekToShoppingList = async () => {
    if (!plan) return;
    const allRecipeIds = plan.days.flatMap(d => d.recipeIds || []);
    const uniqueIds = Array.from(new Set(allRecipeIds));
    if (uniqueIds.length === 0) {
      softToast.info('No recipes attached to this week');
      return;
    }
    
    try {
      const list = await getDefaultShoppingList();
      const result = await syncPlannerToList(startDate, list.id);
      softToast.success(`Synced ${result.added} items${result.needsReview > 0 ? `, ${result.needsReview} to review` : ''}`);
    } catch (e) {
      console.error(e);
      softToast.error('Failed to add week to shopping list');
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
  const firstDay = new Date(`${startDate}T00:00:00Z`);
  const planTitle = isTemplateMode
    ? 'Master Template'
    : firstDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const activeDay = plan.days[activeDayIdx];

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
            {!isTemplateMode && (
              <Button onClick={handleAddWeekToShoppingList} className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Add to List</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => setPlansOpen(true)}>
              Plans
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          {isTemplateMode ? (
            <Button
              variant="outline"
              onClick={() => setStartDate(getFriday(new Date().toISOString().split('T')[0]))}
            >
              Back to week
            </Button>
          ) : (
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(getFriday(e.target.value))}
              className="h-8 w-auto text-sm sm:h-9"
            />
          )}
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" title="Saving" />}
            {saveStatus === 'error'  && <div className="h-2 w-2 rounded-full bg-destructive" title="Save failed" />}
            {saveStatus === 'saved'  && <div className="h-2 w-2 rounded-full bg-accent" title="Saved" />}
          </div>
        </div>
      </Stack>

      <WeekHeader
        days={plan.days}
        activeIndex={activeDayIdx}
        users={orderedUsers}
        recipes={recipes}
        onSelect={setActiveDayIdx}
      />

      <DayDetail
        day={activeDay}
        users={orderedUsers}
        recipes={recipes}
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
            const p = allPlans.find((pl) => pl.id === planId);
            if (p) setStartDate(p.startDate);
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

// ── WeekHeader ────────────────────────────────────────────────────────────────

const WeekHeader: React.FC<{
  days: DayPlan[];
  users: User[];
  recipes: Recipe[];
  activeIndex: number;
  onSelect: (index: number) => void;
}> = ({ days, users, recipes, activeIndex, onSelect }) => (
  <div>
    <div className="hidden md:block">
      <Card>
        <CardContent className="grid grid-cols-7 gap-2 p-4">
          {days.map((day, idx) => {
            const date = new Date(`${day.date}T00:00:00Z`);
            const cook = users.find((u) => u.id === day.cookId);
            const firstLine = day.mealNotes.split('\n')[0]?.trim() || '—';
            const isActive = idx === activeIndex;
            return (
              <button
                key={day.date}
                onClick={() => onSelect(idx)}
                className={`flex flex-col items-center gap-1.5 rounded-md border px-3 py-2 transition-colors ${
                  isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-xs text-muted-foreground">
                  {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                <Avatar className="h-8 w-8">
                  {cook?.avatarUrl && <AvatarImage src={cook.avatarUrl} alt={cook.displayName} />}
                  <AvatarFallback className="text-xs">
                    {cook
                      ? cook.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                      : '—'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate max-w-full">
                  {day.recipeIds && day.recipeIds.length > 0 
                    ? `${day.recipeIds.length} recipe${day.recipeIds.length === 1 ? '' : 's'}`
                    : firstLine}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>

    <div className="md:hidden">
      <Tabs value={String(activeIndex)} onValueChange={(v) => onSelect(Number(v))}>
        <TabsList className="w-full flex h-11 bg-muted/50 p-1 border shadow-sm">
          {days.map((day, idx) => {
            const date = new Date(`${day.date}T00:00:00Z`);
            return (
              <TabsTrigger
                key={day.date}
                value={String(idx)}
                className="h-full flex-1 flex items-center justify-center font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm"
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

// ── DayDetail ─────────────────────────────────────────────────────────────────

const DayDetail: React.FC<{
  day: DayPlan;
  users: User[];
  recipes: Recipe[];
  onChange: (updates: Partial<DayPlan>) => void;
}> = ({ day, users, recipes, onChange }) => {
  const date = new Date(`${day.date}T00:00:00Z`);
  const [recipeSearchOpen, setRecipeSearchOpen] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');

  const handleChefSelect = (userId: string | null) => {
    if (userId === null) { onChange({ cookId: null }); return; }
    const nextPresent = day.presentIds.includes(userId)
      ? day.presentIds
      : [...day.presentIds, userId];
    onChange({ cookId: userId, presentIds: nextPresent });
  };

  const handleAddRecipe = (recipeId: string) => {
    const nextRecipeIds = day.recipeIds ? [...day.recipeIds, recipeId] : [recipeId];
    onChange({ recipeIds: nextRecipeIds });
    setRecipeSearchOpen(false);
    setRecipeSearchQuery('');
  };

  const handleRemoveRecipe = (recipeId: string) => {
    if (!day.recipeIds) return;
    onChange({ recipeIds: day.recipeIds.filter(id => id !== recipeId) });
  };

  const currentRecipeIds = day.recipeIds || [];
  const selectedRecipes = currentRecipeIds.map(id => recipes.find(r => r.id === id)).filter(Boolean) as Recipe[];
  const availableRecipes = recipes.filter(r => !currentRecipeIds.includes(r.id) && r.title.toLowerCase().includes(recipeSearchQuery.toLowerCase()));

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
                day.cookId === null ? 'ring-2 ring-primary ring-offset-2' : 'opacity-50 hover:opacity-100'
              }`}
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">—</span>
              </div>
            </button>
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleChefSelect(user.id)}
                className={`rounded-full p-0.5 transition-all ${
                  day.cookId === user.id ? 'ring-2 ring-primary ring-offset-2' : 'opacity-50 hover:opacity-100'
                }`}
              >
                <Avatar className="h-10 w-10">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                  <AvatarFallback className="text-sm">
                    {user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Recipes</Label>
            <Button variant="outline" size="sm" onClick={() => setRecipeSearchOpen(true)}>
              Add Recipe
            </Button>
          </div>
          
          {selectedRecipes.length > 0 ? (
            <div className="grid gap-2">
              {selectedRecipes.map(recipe => (
                <div key={recipe.id} className="flex items-center justify-between p-2 sm:p-3 border rounded-md">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {recipe.imagePath ? (
                      <img src={`/images/${recipe.imagePath}`} alt={recipe.title} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">No img</div>
                    )}
                    <span className="font-medium truncate">{recipe.title}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveRecipe(recipe.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic border-dashed border rounded-md p-4 text-center">
              No recipes attached for this day.
            </div>
          )}
        </div>

        {recipeSearchOpen && (
          <Dialog open={recipeSearchOpen} onOpenChange={setRecipeSearchOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Recipe to Meal</DialogTitle>
                <DialogDescription>Select a recipe from your collection.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recipes..."
                    className="pl-9"
                    value={recipeSearchQuery}
                    onChange={e => setRecipeSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                  {availableRecipes.length > 0 ? (
                    availableRecipes.map(recipe => (
                      <button
                        key={recipe.id}
                        onClick={() => handleAddRecipe(recipe.id)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-md text-left transition-colors border border-transparent hover:border-border"
                      >
                        {recipe.imagePath ? (
                          <img src={`/images/${recipe.imagePath}`} alt={recipe.title} className="w-8 h-8 object-cover rounded shrink-0" />
                        ) : (
                          <div className="w-8 h-8 bg-background border rounded flex items-center justify-center text-[10px] text-muted-foreground shrink-0">Img</div>
                        )}
                        <span className="truncate flex-1 text-sm font-medium">{recipe.title}</span>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-center text-muted-foreground py-4">No matching recipes found.</div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="space-y-2">
          <Label htmlFor="menu-editor">Additional Menus Notes</Label>
          <Textarea
            id="menu-editor"
            placeholder="Add any extra notes for the day"
            className="min-h-20"
            value={day.mealNotes}
            onChange={(e) => onChange({ mealNotes: e.target.value })}
          />
        </div>

        <PeopleForDay
          users={users}
          presentIds={day.presentIds}
          userNotes={day.userNotes}
          onTogglePresence={(userId) => {
            const next = day.presentIds.includes(userId)
              ? day.presentIds.filter((id) => id !== userId)
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

// ── PeopleForDay ──────────────────────────────────────────────────────────────

const PeopleForDay: React.FC<{
  users: User[];
  presentIds: string[];
  userNotes: Record<string, string>;
  onTogglePresence: (userId: string) => void;
  onUpdateNote: (userId: string, note: string) => void;
}> = ({ users, presentIds, userNotes, onTogglePresence, onUpdateNote }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label>People for the day</Label>
      <span className="text-xs text-muted-foreground">{presentIds.length} attending</span>
    </div>
    <div className="space-y-3">
      {users.map((user) => {
        const isPresent = presentIds.includes(user.id);
        return (
          <div key={user.id} className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                  <AvatarFallback className="text-xs">
                    {user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <button
                type="button"
                onClick={() => onTogglePresence(user.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  isPresent
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {isPresent ? 'Attending' : 'Not attending'}
              </button>
            </div>
            <Input
              placeholder="Notes for the day"
              value={userNotes[user.id] || ''}
              onChange={(e) => onUpdateNote(user.id, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  </div>
);

// ── PlansDialog ───────────────────────────────────────────────────────────────

const PlansDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPlans: Plan[];
  onSelectPlan: (planId: string) => void;
  onCreateNextWeek: (customDate?: string) => void;
  onDeletePlan: (planId: string) => void;
}> = ({ open, onOpenChange, allPlans, onSelectPlan, onCreateNextWeek, onDeletePlan }) => {
  const plans = allPlans.filter((p) => p.id !== TEMPLATE_ID && p.startDate !== 'template');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  const getNearestFriday = () => {
    if (plans.length === 0) {
      const now = new Date();
      const daysUntil = (5 + 7 - now.getDay()) % 7;
      const next = new Date(now);
      next.setDate(now.getDate() + (daysUntil === 0 ? 7 : daysUntil));
      return next.toISOString().split('T')[0];
    }
    const latest = [...plans].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    const d = new Date(`${latest.startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const handleOpenDatePicker = () => {
    setSelectedDate(getNearestFriday());
    setDatePickerOpen(true);
  };

  const handleDateChange = (dateStr: string) => {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`);
    if (d.getUTCDay() === 5) {
      setSelectedDate(dateStr);
    } else {
      softToast.error('Please select a Friday');
    }
  };

  const handleCreatePlan = () => {
    if (!selectedDate) { softToast.error('Please select a date'); return; }
    const d = new Date(selectedDate.includes('T') ? selectedDate : `${selectedDate}T00:00:00Z`);
    if (d.getUTCDay() !== 5) { softToast.error('Please select a Friday'); return; }
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
                <Button variant="outline" onClick={() => onSelectPlan(TEMPLATE_ID)}>Open</Button>
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
                {plans.map((plan) => {
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
                          <Button variant="outline" onClick={() => onSelectPlan(plan.id)}>Open</Button>
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
              <p className="text-xs text-muted-foreground">Plans must start on a Friday</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDatePickerOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePlan}>Create plan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
