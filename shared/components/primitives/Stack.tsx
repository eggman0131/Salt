import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Stack Primitive - Vertical layout with controlled spacing
 * 
 * AI USAGE:
 * - Compose vertical lists with consistent gaps
 * - Use for lists of items, form fields, content blocks
 * - Replaces manual space-y-* on parent divs
 * 
 * WHEN TO USE:
 * - Lists of similar items (checkboxes, cards, form fields)
 * - Vertical content flow
 * - Any time you need consistent vertical spacing
 * 
 * WHEN NOT TO USE:
 * - Horizontal layouts (use Inline instead)
 * - Complex grids (use Tailwind grid directly)
 * 
 * @example
 * <Stack spacing="gap-3">
 *   <Item />
 *   <Item />
 *   <Item />
 * </Stack>
 */

interface StackProps {
  children: React.ReactNode;
  className?: string;
  /** Vertical gap between items - default: gap-4 */
  spacing?: 'gap-1' | 'gap-2' | 'gap-3' | 'gap-4' | 'gap-6' | 'gap-8';
}

export const Stack: React.FC<StackProps> = ({
  children,
  className,
  spacing = 'gap-4',
}) => (
  <div className={cn('flex flex-col', spacing, className)}>
    {children}
  </div>
);

/**
 * Inline Primitive - Horizontal layout with controlled spacing
 * 
 * AI USAGE:
 * - Compose horizontal layouts (buttons, tags, inline actions)
 * - Use for action bars, button groups, tag lists
 * - Handles alignment and wrapping
 * 
 * WHEN TO USE:
 * - Buttons side-by-side (action bars, form actions)
 * - Tags or badges in a row
 * - Icon + text combinations
 * 
 * WHEN NOT TO USE:
 * - Vertical layouts (use Stack)
 * - Complex multi-row layouts (use grid)
 * 
 * @example
 * <Inline spacing="gap-3" align="items-center">
 *   <Button>Save</Button>
 *   <Button variant="outline">Cancel</Button>
 * </Inline>
 */

interface InlineProps {
  children: React.ReactNode;
  className?: string;
  /** Horizontal gap between items - default: gap-3 */
  spacing?: 'gap-1' | 'gap-2' | 'gap-3' | 'gap-4' | 'gap-6';
  /** Vertical alignment - default: items-start */
  align?: 'items-start' | 'items-center' | 'items-end' | 'items-baseline';
  /** Allow wrapping - default: false */
  wrap?: boolean;
}

export const Inline: React.FC<InlineProps> = ({
  children,
  className,
  spacing = 'gap-3',
  align = 'items-start',
  wrap = false,
}) => (
  <div
    className={cn(
      'flex',
      spacing,
      align,
      wrap && 'flex-wrap',
      className
    )}
  >
    {children}
  </div>
);
