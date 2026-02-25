/**
 * Progression Check Component
 * 
 * Displays the "before continuing" checklist for each step.
 * User verifies sensory cues before proceeding.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

interface ProgressionCheckProps {
  check: string;
}

export const ProgressionCheck: React.FC<ProgressionCheckProps> = ({ check, sensoryCues }) => {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="font-medium text-sm">Before continuing:</p>
            <p className="text-sm text-foreground/80">{check}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
