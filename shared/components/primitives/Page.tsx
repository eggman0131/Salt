import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Page Primitive - Full-page container with consistent padding and max-width
 * 
 * AI USAGE:
 * - Wrap entire page/route content in this component
 * - Provides consistent horizontal padding across breakpoints
 * - Centers content with max-width constraint
 * - Handles vertical spacing with space-y-* utilities
 * 
 * WHEN TO USE:
 * - Top-level page/route components
 * - Full-screen views
 * 
 * WHEN NOT TO USE:
 * - Inside modals or dialogs (they have their own containers)
 * - Nested within other Page components
 * 
 * @example
 * <Page>
 *   <h1>Equipment</h1>
 *   <Section>...</Section>
 * </Page>
 */

interface PageProps {
  children: React.ReactNode;
  className?: string;
  /** Max width constraint - default: max-w-4xl (896px) */
  maxWidth?: 'max-w-2xl' | 'max-w-4xl' | 'max-w-6xl' | 'max-w-7xl';
}

export const Page: React.FC<PageProps> = ({
  children,
  className,
  maxWidth = 'max-w-4xl',
}) => (
  <div
    className={cn(
      'mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16',
      maxWidth,
      className
    )}
  >
    {children}
  </div>
);
