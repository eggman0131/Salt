import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, AlarmClock, Pencil, Trash2, CheckCircle2, X, Eye, Ear, Wind, Hand } from 'lucide-react';
import type { CookingStep } from '../types';
import { ProgressionCheck } from './ProgressionCheck';

interface CookingStepViewProps {
  step: CookingStep;
  totalSteps: number;
  recipeInstruction?: string;
  guideId?: string;
  onStepUpdate?: (guideId: string, stepId: string, updatedStep: Partial<CookingStep>) => Promise<void>;
  onDeleteGuide?: () => void | Promise<void>;
  isDeletingGuide?: boolean;
}

export const CookingStepView: React.FC<CookingStepViewProps> = ({
  step,
  totalSteps,
  recipeInstruction,
  guideId,
  onStepUpdate,
  onDeleteGuide,
  isDeletingGuide,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStep, setEditedStep] = useState(step);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState(false);
  const wakeLockRef = useRef<any>(null);

  const isTimeCritical = Boolean(
    step.timeEstimate &&
      /min|hour|second|cook|simmer|boil|bake|roast|grill|fry|sear|saute|sauté|steam|reduce|rest|chill|prove|rise/i.test(
        `${step.instruction} ${step.temperature ?? ''} ${step.timeEstimate}`
      )
  );

  const handleSave = async () => {
    if (!guideId || !onStepUpdate) return;
    setIsSaving(true);
    try {
      await onStepUpdate(guideId, step.id, editedStep);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update step:', error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    setIsWakeLockSupported(Boolean((navigator as any)?.wakeLock?.request));
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isWakeLockActive) return;

    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.error('Failed to acquire wake lock:', err);
        setIsWakeLockActive(false);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isWakeLockActive]);

  const handleToggleWakeLock = async () => {
    if (!isWakeLockSupported) return;
    if (isWakeLockActive) {
      if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; }
      setIsWakeLockActive(false);
      return;
    }
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      setIsWakeLockActive(true);
    } catch (err) {
      console.error('Failed to acquire wake lock:', err);
      setIsWakeLockActive(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="p-4 md:p-6 pb-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Edit Step {step.stepNumber}</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-3 space-y-4">
            <div className="space-y-2">
              <Label>Instruction</Label>
              <Textarea
                value={editedStep.instruction}
                onChange={(e) => setEditedStep({ ...editedStep, instruction: e.target.value })}
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <Label>Temperature (optional)</Label>
              <Textarea
                value={editedStep.temperature || ''}
                onChange={(e) => setEditedStep({ ...editedStep, temperature: e.target.value || undefined })}
                placeholder="e.g., Medium-high (7 out of 10)"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Time Estimate (optional)</Label>
              <Textarea
                value={editedStep.timeEstimate || ''}
                onChange={(e) => setEditedStep({ ...editedStep, timeEstimate: e.target.value || undefined })}
                placeholder="e.g., 3-5 minutes"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Sensory Cues</Label>
              <div className="space-y-2">
                {(['visual', 'audio', 'aroma', 'texture'] as const).map((sense) => (
                  <Textarea
                    key={sense}
                    placeholder={
                      sense === 'visual' ? 'Visual (what to look for)' :
                      sense === 'audio' ? 'Audio (what to listen for)' :
                      sense === 'aroma' ? 'Aroma (what to smell)' :
                      'Texture/feel'
                    }
                    value={editedStep.sensoryCues[sense] || ''}
                    onChange={(e) =>
                      setEditedStep({
                        ...editedStep,
                        sensoryCues: { ...editedStep.sensoryCues, [sense]: e.target.value || undefined },
                      })
                    }
                    className="h-12"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Progression Check</Label>
              <Textarea
                value={editedStep.progressionCheck}
                onChange={(e) => setEditedStep({ ...editedStep, progressionCheck: e.target.value })}
                placeholder="What to check before moving to the next step"
                className="min-h-16"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => { setEditedStep(step); setIsEditing(false); }} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AlertDialog open={isDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete assist guide?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the current guide for this recipe. You can generate a new guide any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>Keep guide</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { setIsDeleteOpen(false); await onDeleteGuide?.(); }}
              disabled={isDeletingGuide}
            >
              Delete guide
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 md:p-4 space-y-3">
          <div className="flex flex-col gap-2">
            {isTimeCritical && step.timeEstimate && (
              <Badge variant="outline" className="flex w-full items-center gap-1.5 border-primary/30 text-primary">
                <Clock className="h-3 w-3" />
                {step.timeEstimate}
              </Badge>
            )}
            {step.containerReference && (
              <Badge variant="outline" className="flex w-full items-center gap-1.5 border-primary/30 text-primary">
                <span className="font-medium">Use:</span>
                <span className="font-mono">{step.containerReference}</span>
              </Badge>
            )}
          </div>
          <div className="hidden md:flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled aria-label="Set timer">
              <AlarmClock className="h-4 w-4 text-muted-foreground" />
            </Button>
            {guideId && onStepUpdate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 p-0"
                aria-label="Edit step"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {guideId && onDeleteGuide && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteOpen(true)}
                className="h-8 w-8 p-0"
                aria-label="Delete guide"
                disabled={isDeletingGuide}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:hidden">
            <Button
              variant="outline"
              className="h-10 w-full justify-center"
              onClick={handleToggleWakeLock}
              disabled={!isWakeLockSupported}
            >
              <Eye className="mr-2 h-4 w-4" />
              {isWakeLockActive ? 'Screen stays on' : 'Keep screen on'}
            </Button>
            <Button variant="outline" className="h-10 w-full justify-center" disabled>
              <AlarmClock className="mr-2 h-4 w-4" />
              Set timer
            </Button>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">{step.instruction}</h2>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {step.sensoryCues.visual && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-warning" />
                  <p className="text-xs font-semibold text-warning">LOOK FOR</p>
                </div>
                <p className="text-sm">{step.sensoryCues.visual}</p>
              </div>
            )}
            {step.sensoryCues.audio && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Ear className="h-4 w-4 text-warning" />
                  <p className="text-xs font-semibold text-warning">LISTEN FOR</p>
                </div>
                <p className="text-sm">{step.sensoryCues.audio}</p>
              </div>
            )}
            {step.sensoryCues.aroma && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Wind className="h-4 w-4 text-warning" />
                  <p className="text-xs font-semibold text-warning">SMELL</p>
                </div>
                <p className="text-sm">{step.sensoryCues.aroma}</p>
              </div>
            )}
            {step.sensoryCues.texture && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Hand className="h-4 w-4 text-warning" />
                  <p className="text-xs font-semibold text-warning">TEXTURE/FEEL</p>
                </div>
                <p className="text-sm">{step.sensoryCues.texture}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ProgressionCheck check={step.progressionCheck} />
    </div>
  );
};
