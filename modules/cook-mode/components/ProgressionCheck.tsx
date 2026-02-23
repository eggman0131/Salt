/**
 * Progression Check Component
 * 
 * Displays the "before continuing" checklist for each step.
 * User verifies sensory cues before proceeding.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Eye, Volume2, Smile, Hand } from 'lucide-react';

interface ProgressionCheckProps {
  check: string;
  sensoryCues: {
    visual?: string;
    audio?: string;
    aroma?: string;
    texture?: string;
  };
}

export const ProgressionCheck: React.FC<ProgressionCheckProps> = ({ check, sensoryCues }) => {
  const cueIcons = [
    { key: 'visual', icon: Eye, label: 'Look' },
    { key: 'audio', icon: Volume2, label: 'Listen' },
    { key: 'aroma', icon: Smile, label: 'Smell' },
    { key: 'texture', icon: Hand, label: 'Feel' },
  ];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="font-medium text-sm">Before continuing:</p>
            <p className="text-sm text-foreground/80">{check}</p>
          </div>
        </div>

        {/* Sensory Cue Badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          {cueIcons.map(({ key, icon: Icon, label }) => {
            const cue = sensoryCues[key as keyof typeof sensoryCues];
            return cue ? (
              <Badge
                key={key}
                variant="outline"
                className="flex items-center gap-1.5 py-1 px-2"
              >
                <Icon className="h-3 w-3" />
                <span className="text-xs">{label}</span>
              </Badge>
            ) : null;
          })}
        </div>
      </CardContent>
    </Card>
  );
};
