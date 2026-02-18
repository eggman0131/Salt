/**
 * Shared Components Index
 * 
 * AI INSTRUCTION:
 * This is the primary import point for all shared UI components in Salt.
 * Import from here instead of individual files for consistency.
 * 
 * IMPORT PATTERN:
 * import { Page, Button, LoadingSpinner } from '@/shared/components';
 * 
 * CATEGORIES:
 * 1. Layout Primitives - Page, Section, Stack, Inline, CardContainer
 * 2. shadcn/ui Components - Button, Input, Dialog, Card, etc.
 * 3. Animation Utilities - LoadingSpinner, AILoadingIndicator
 * 
 * HIERARCHY:
 * Layout Primitives → shadcn/ui Components → Animation Components
 * 
 * DO NOT:
 * - Import directly from files (use this barrel export)
 * - Mix component libraries (stick to what's exported here)
 * - Create one-off components (add to design system first)
 */

// ============================================================================
// LAYOUT PRIMITIVES
// ============================================================================
// AI: Use these for structure and layout
// Page wraps entire route/view, Section groups content, Stack/Inline arrange items
export {
  Page,
  Section,
  Stack,
  Inline,
  CardContainer,
} from './primitives';

// ============================================================================
// SHADCN/UI COMPONENTS
// ============================================================================
// AI: Use these for interactive elements
// All follow design system tokens (colors, spacing, radii)

// Buttons & Actions
export { Button } from '@/components/ui/button';

// Forms & Inputs
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Textarea } from '@/components/ui/textarea';
export { Checkbox } from '@/components/ui/checkbox';
export { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
export { Switch } from '@/components/ui/switch';
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';

// Dialogs & Overlays
export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
export { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

// Cards & Containers
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Navigation
export { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
export { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';

// Feedback
export { Alert } from '@/components/ui/alert';
export { Badge } from '@/components/ui/badge';
export { Skeleton } from '@/components/ui/skeleton';
export { Progress } from '@/components/ui/progress';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Layout & Organization
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
export { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Overlays & Popovers
export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// User Identity
export { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Misc
export { Separator } from '@/components/ui/separator';

// ============================================================================
// ANIMATION COMPONENTS
// ============================================================================
// AI: Use these for loading states and transitions
export { LoadingSpinner, AILoadingIndicator } from '@/lib/animations';
