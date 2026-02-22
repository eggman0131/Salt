import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Animation Utilities for Salt
 * 
 * AI USAGE:
 * Import these utilities and components for consistent animations
 * All animations use design tokens (200ms duration, spring easing)
 * 
 * SPRING ANIMATION:
 * Use springTransition for bouncy, playful effects
 * 
 * LOADING STATES:
 * Use LoadingSpinner component when waiting for AI or async operations
 * 
 * @example
 * // Spring transition
 * <button className={springTransition('opacity', 'scale')}>
 *   Hover me
 * </button>
 * 
 * // Loading spinner
 * {isLoading && <LoadingSpinner />}
 */

/**
 * Spring Transition - Bouncy, playful animation
 * 
 * AI USAGE:
 * Apply to interactive elements that need spring animation
 * Pass CSS properties to animate (e.g., 'opacity', 'transform', 'colors')
 * 
 * @param properties - CSS properties to animate (default: 'all')
 * @returns Tailwind className string
 * 
 * @example
 * <div className={springTransition('transform', 'opacity')}>
 *   Animated content
 * </div>
 */
export const springTransition = (...properties: string[]): string => {
  const props = properties.length > 0 ? properties.join(',') : 'all';
  return cn(
    'transition-all duration-200',
    // Inline style will be required for custom easing
    '[transition-timing-function:cubic-bezier(0.68,-0.55,0.265,1.55)]'
  );
};

/**
 * Fade In Animation
 * 
 * AI USAGE:
 * Apply to elements that should fade in on mount/show
 * 
 * @example
 * <div className={fadeIn()}>
 *   Content
 * </div>
 */
export const fadeIn = (delay: number = 0): string => {
  return cn(
    'animate-in fade-in',
    delay > 0 && `delay-${delay}`
  );
};

/**
 * Slide In Animation
 * 
 * AI USAGE:
 * Apply to elements that should slide in from a direction
 * 
 * @param direction - 'top' | 'bottom' | 'left' | 'right'
 * @example
 * <div className={slideIn('bottom')}>
 *   Content
 * </div>
 */
export const slideIn = (direction: 'top' | 'bottom' | 'left' | 'right' = 'bottom'): string => {
  const directionMap = {
    top: 'slide-in-from-top',
    bottom: 'slide-in-from-bottom',
    left: 'slide-in-from-left',
    right: 'slide-in-from-right',
  };
  return cn('animate-in', directionMap[direction], 'duration-200');
};

/**
 * Modal Animation Token - Consistent animation for all modals (Dialog, AlertDialog)
 * 
 * AI USAGE:
 * Apply to Dialog and AlertDialog content for consistent modal animations.
 * Single source of truth for all modal enter/exit animations.
 * 
 * TO MODIFY:
 * - Zoom + slide: Add zoom-in-95/zoom-out-95 and slide classes
 * - No animation: Return empty string
 * - Different effect: Modify animation class combination
 * 
 * CURRENT EFFECT:
 * Fade only (duration: 200ms)
 * 
 * @returns Tailwind className string for modal animations
 * 
 * @example
 * <DialogContent className={cn(modalAnimation(), 'other-classes')}>
 *   Modal content
 * </DialogContent>
 */
export const modalAnimation = (): string => {
  return cn(
    'duration-200',
    'data-[state=open]:animate-in',
    'data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0',
    'data-[state=open]:fade-in-0'
  );
};

/**
 * LoadingSpinner Component - Standard AI wait indicator
 * 
 * AI USAGE:
 * Use this component whenever:
 * - Waiting for Gemini AI responses
 * - Async operations in progress
 * - Button loading states
 * 
 * NEVER create custom spinner components - use this standardized one
 * 
 * @example
 * // Standalone
 * {isLoading && <LoadingSpinner />}
 * 
 * // With text
 * {isLoading && <LoadingSpinner text="Generating recipe..." />}
 * 
 * // In button
 * <Button disabled={isLoading}>
 *   {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
 *   Save
 * </Button>
 */

interface LoadingSpinnerProps {
  /** Spinner size - default: 'md' */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Optional loading text */
  text?: string;
  /** Custom className */
  className?: string;
  /** Color variant - default: 'primary' */
  variant?: 'primary' | 'muted' | 'accent';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className,
  variant = 'primary',
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  };

  const variantClasses = {
    primary: 'text-primary',
    muted: 'text-muted-foreground',
    accent: 'text-accent',
  };

  if (text) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Loader2 className={cn(sizeClasses[size], variantClasses[variant], 'animate-spin')} />
        <span className="text-sm text-muted-foreground">{text}</span>
      </div>
    );
  }

  return (
    <Loader2
      className={cn(
        sizeClasses[size],
        variantClasses[variant],
        'animate-spin',
        className
      )}
    />
  );
};

/**
 * AI Loading Indicator - Specialized for Gemini AI waits
 * 
 * AI USAGE:
 * Use specifically for Gemini AI operations
 * Provides consistent "thinking" feedback
 * 
 * @example
 * {isGenerating && <AILoadingIndicator text="Generating recipe..." />}
 */

interface AILoadingIndicatorProps {
  text?: string;
  className?: string;
}

export const AILoadingIndicator: React.FC<AILoadingIndicatorProps> = ({
  text = 'Thinking...',
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-3 p-4 rounded-lg bg-muted/50', className)}>
      <LoadingSpinner variant="primary" />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{text}</span>
        <span className="text-xs text-muted-foreground">This may take a moment</span>
      </div>
    </div>
  );
};
