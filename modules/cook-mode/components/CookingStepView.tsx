/**
 * Cooking Step View Component
 * 
 * Displays a single step with temperature, sensory cues, and progression check.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Thermometer, Clock } from 'lucide-react';
import { CookingStep } from '../types';
import { ProgressionCheck } from './ProgressionCheck';

interface CookingStepViewProps {
  step: CookingStep;
  totalSteps: number;
}

export const CookingStepView: React.FC<CookingStepViewProps> = ({ step, totalSteps }) => {
  return (
    <div className="space-y-4">
      {/* Step header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Step {step.stepNumber} of {totalSteps}
          </h2>
          {step.timeEstimate && (
            <Badge variant="outline" className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {step.timeEstimate}
            </Badge>
          )}
        </div>
      </div>

      {/* Main instruction card */}
      <Card>
        <CardContent className="p-4 md:p-6 space-y-4">
          {/* Instruction */}
          <div>
            <p className="text-base md:text-lg font-medium leading-relaxed">{step.instruction}</p>
          </div>

          {/* Container reference */}
          {step.containerReference && (
            <div className="rounded-lg bg-accent/5 border border-accent/20 p-3">
              <p className="text-sm">
                <span className="font-medium">Use: </span>
                <span className="text-accent font-mono">{step.containerReference}</span>
              </p>
            </div>
          )}

          {/* Temperature setting */}
          {step.temperature && (
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
                <p className="text-xs font-semibold text-muted-foreground">LOOK FOR</p>
                <p className="text-sm">{step.sensoryCues.visual}</p>
              </div>
            )}
            {step.sensoryCues.audio && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">LISTEN FOR</p>
                <p className="text-sm">{step.sensoryCues.audio}</p>
              </div>
            )}
            {step.sensoryCues.aroma && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">SMELL</p>
                <p className="text-sm">{step.sensoryCues.aroma}</p>
              </div>
            )}
            {step.sensoryCues.texture && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">TEXTURE/FEEL</p>
                <p className="text-sm">{step.sensoryCues.texture}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progression check */}
      <ProgressionCheck check={step.progressionCheck} sensoryCues={step.sensoryCues} />
    </div>
  );
};
