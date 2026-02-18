import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Section Primitive - Logical content grouping with consistent spacing
 * 
 * AI USAGE:
 * - Group related content within a page
 * - Use for semantic sections (equipment list, filters, details)
 * - Provides vertical rhythm via space-y-* utilities
 * - Optional header with consistent styling
 * 
 * WHEN TO USE:
 * - Multiple related items or components
 * - Areas that need visual separation
 * - Content blocks with headers
 * 
 * WHEN NOT TO USE:
 * - Single items (use Card instead)
 * - Heavily nested layouts (use Stack)
 * 
 * @example
 * <Section>
 *   <h2 className="text-lg font-semibold">Equipment</h2>
 *   <div className="space-y-2">
 *     {items.map(...)}
 *   </div>
 * </Section>
 */

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  /** Vertical spacing between children - default: space-y-4 */
  spacing?: 'space-y-2' | 'space-y-3' | 'space-y-4' | 'space-y-6' | 'space-y-8';
}

export const Section: React.FC<SectionProps> = ({
  children,
  className,
  spacing = 'space-y-4',
}) => (
  <section className={cn(spacing, className)}>
    {children}
  </section>
);
