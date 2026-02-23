import React from 'react';

/**
 * Content - Layout container providing responsive padding for module views
 * 
 * Responsive spacing (centralized for consistent updates):
 * - Mobile (0-640px):      px-4 py-8
 * - Tablet (640-1024px):   px-6 py-12
 * - Desktop (1024px+):     px-8 py-16
 * 
 * All module content inherits this spacing. To adjust spacing globally,
 * modify the padding classes below. Changes propagate to all 8 modules automatically.
 */
export const Content: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="overflow-auto">
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      {children}
    </div>
  </main>
);
