/**
 * Cooking Step View Component
 * 
 * Displays a single step with temperature, sensory cues, and progression check.
 * Supports inline editing for manual corrections.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Thermometer, Clock, Pencil, CheckCircle2, X, Info, Eye, Volume2, Smile, Hand } from 'lucide-react';
import { CookingStep } from '../types';
import { ProgressionCheck } from './ProgressionCheck';

interface CookingStepViewProps {
  step: CookingStep;
  totalSteps: number;
  recipeInstruction?: string;
  guideId?: string;
  onStepUpdate?: (guideId: string, stepId: string, updatedStep: Partial<CookingStep>) => Promise<void>;
}

export const CookingStepView: React.FC<CookingStepViewProps> = ({ step, totalSteps, recipeInstruction, guideId, onStepUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStep, setEditedStep] = useState(step);
  const [isSaving, setIsSaving] = useState(false);

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

  if (isEditing) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="p-4 md:p-6 pb-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Edit Step {step.stepNumber}</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
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
                <Textarea
                  placeholder="Visual (what to look for)"
                  value={editedStep.sensoryCues.visual || ''}
                  onChange={(e) => setEditedStep({
                    ...editedStep,
                    sensoryCues: { ...editedStep.sensoryCues, visual: e.target.value || undefined }
                  })}
                  className="h-12"
                />
                <Textarea
                  placeholder="Audio (what to listen for)"
                  value={editedStep.sensoryCues.audio || ''}
                  onChange={(e) => setEditedStep({
                    ...editedStep,
                    sensoryCues: { ...editedStep.sensoryCues, audio: e.target.value || undefined }
                  })}
                  className="h-12"
                />
                <Textarea
                  placeholder="Aroma (what to smell)"
                  value={editedStep.sensoryCues.aroma || ''}
                  onChange={(e) => setEditedStep({
                    ...editedStep,
                    sensoryCues: { ...editedStep.sensoryCues, aroma: e.target.value || undefined }
                  })}
                  className="h-12"
                />
                <Textarea
                  placeholder="Texture/feel"
                  value={editedStep.sensoryCues.texture || ''}
                  onChange={(e) => setEditedStep({
                    ...editedStep,
                    sensoryCues: { ...editedStep.sensoryCues, texture: e.target.value || undefined }
                  })}
                  className="h-12"
                />
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
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditedStep(step);
                  setIsEditing(false);
                }}
                disabled={isSaving}
              >
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
      {/* Step header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              Step {step.stepNumber} of {totalSteps}
            </h2>
            {recipeInstruction && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Recipe Instruction</p>
                    <p className="text-sm leading-relaxed">{recipeInstruction}</p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step.timeEstimate && (
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {step.timeEstimate}
              </Badge>
            )}
            {guideId && onStepUpdate && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsEditing(true)}
                className="ml-2"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Original recipe instruction - REMOVED, now in popover above */}
      <Card>
        <CardContent className="p-4 md:p-6 space-y-4">
          {/* Instruction */}
          <div>
            <p className="text-base md:text-lg font-medium leading-relaxed">{step.instruction}</p>
          </div>

          {/* Container reference */}
          {step.containerReference && (
            <div className="rounded-lg bg-muted/30 border border-muted p-3">
              <p className="text-sm">
                <span className="font-medium">Use: </span>
                <span className="text-foreground font-mono">{step.containerReference}</span>
              </p>
            </div>
          )}

          {/* Temperature setting - only show if it's about heat/oven/hob */}
          {step.temperature && /heat|oven|hob|temperature|°C|fahrenheit|degree/i.test(step.temperature) && (
            <div className="rounded-lg bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200/50 dark:border-orange-800/30 p-3">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <p className="text-sm">
                  <span className="font-medium">Heat to: </span>
                  <span className="font-mono">{step.temperature}</span>
                </p>
              </div>
            </div>
          )}

          {/* Sensory cues grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {step.sensoryCues.visual && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">LOOK FOR</p>
                </div>
                <p className="text-sm">{step.sensoryCues.visual}</p>
              </div>
            )}
            {step.sensoryCues.audio && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">LISTEN FOR</p>
                </div>
                <p className="text-sm">{step.sensoryCues.audio}</p>
              </div>
            )}
            {step.sensoryCues.aroma && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Smile className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">SMELL</p>
                </div>
                <p className="text-sm">{step.sensoryCues.aroma}</p>
              </div>
            )}
            {step.sensoryCues.texture && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Hand className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">TEXTURE/FEEL</p>
                </div>
                <p className="text-sm">{step.sensoryCues.texture}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progression check */}
      <ProgressionCheck check={step.progressionCheck} />
    </div>
  );
};
