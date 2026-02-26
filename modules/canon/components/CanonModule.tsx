import React from 'react';
import { Stack, CardContainer } from '@/shared/components/primitives';

export const CanonModule: React.FC = () => (
  <Stack spacing="gap-6" className="animate-in fade-in duration-500 h-full">
    <CardContainer>
      <h2 className="text-lg font-semibold">Canon</h2>
      <p className="text-sm text-muted-foreground">
        The item catalogue, units, and aisles will appear here in the next phase.
      </p>
    </CardContainer>
  </Stack>
);
