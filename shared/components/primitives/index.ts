/**
 * Layout Primitives
 * 
 * AI INSTRUCTION:
 * These are the fundamental building blocks for layouts in Salt.
 * Always prefer these primitives over raw <div> elements for structure.
 * 
 * Import Pattern:
 * import { Page, Section, Stack, Inline, CardContainer } from '@/shared/components/primitives';
 * 
 * Hierarchy (typical usage):
 * Page → Section → Stack/Inline → CardContainer
 * 
 * All primitives use design tokens (spacing, colors, radii) for consistency.
 * Override with className prop only when necessary.
 */

export { Page } from './Page';
export { Section } from './Section';
export { Stack, Inline } from './Stack';
export { CardContainer } from './Card';
