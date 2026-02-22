import React from 'react';
import { cn } from '@/lib/utils';

/**
 * CardContainer Primitive - Structured container with visual separation
 * 
 * AI USAGE:
 * - Encapsulate related information with padding and borders
 * - Use for equipment items, recipe cards, info panels
 * - Provides consistent styling (background, border, shadow, radius)
 * - Optional header and footer sections
 * 
 * WHEN TO USE:
 * - Grouped information that needs visual separation
 * - List items that are interactive
 * - Panels or widgets
 * 
 * WHEN NOT TO USE:
 * - Full page layouts (use Page)
 * - Simple lists without borders (use Stack)
 * 
 * NOTE: Prefer shadcn/ui Card, CardHeader, CardContent, CardFooter
 * This primitive is for one-off custom cards.
 * 
 * @example
 * <CardContainer>
 *   <h3 className="font-semibold">Title</h3>
 *   <p className="text-sm text-muted-foreground">Description</p>
 * </CardContainer>
 */

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Enable hover effect - default: false */
  hoverable?: boolean;
  /** Enable click interaction - default: false */
  clickable?: boolean;
  onClick?: () => void;
}

export const CardContainer: React.FC<CardContainerProps> = ({
  children,
  className,
  hoverable = false,
  clickable = false,
  onClick,
}) => {
  const Component = clickable || onClick ? 'button' : 'div';
  
  return (
    <Component
      onClick={onClick}
      className={cn(
        'bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm',
        hoverable && 'transition-all duration-200 hover:shadow-md hover:scale-[1.02]',
        clickable && 'cursor-pointer transition-all duration-200 hover:bg-muted/50',
        className
      )}
    >
      {children}
    </Component>
  );
};
