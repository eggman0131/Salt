import React from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from './DropdownMenu';
import { Badge } from './Badge';

export interface SortOption<T extends string = string> {
  id: T;
  label: string;
}

export interface FilterOption<T extends string = string> {
  id: T;
  label: string;
}

export interface ViewToolbarProps<S extends string = string, F extends string = string> {
  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Sorting
  sortOptions?: SortOption<S>[];
  activeSortOption?: S;
  onSortChange?: (id: S) => void;

  // Filtering
  filterOptions?: FilterOption<F>[];
  activeFilterOptions?: F[];
  onFilterToggle?: (id: F) => void;
  onClearFilters?: () => void;

  // Primary Action (e.g. "Add Element")
  primaryAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };

  // Additional Actions (rendered next to primary)
  children?: React.ReactNode;
}

export const ViewToolbar = <S extends string = string, F extends string = string>({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  sortOptions = [],
  activeSortOption,
  onSortChange,
  filterOptions = [],
  activeFilterOptions = [],
  onFilterToggle,
  onClearFilters,
  primaryAction,
  children,
}: ViewToolbarProps<S, F>) => {
  const activeSortLabel = sortOptions.find(o => o.id === activeSortOption)?.label || "Sort";
  const isFiltering = activeFilterOptions.length > 0;
  const activeFilterLabel = isFiltering ? `${activeFilterOptions.length} Selected` : "Filter";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
      <div className="relative w-full sm:max-w-xs group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-v2-muted-foreground)] group-focus-within:text-[var(--color-v2-primary)] transition-colors" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-11 w-full bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] focus-visible:ring-1 focus-visible:ring-[var(--color-v2-ring)] rounded-xl placeholder:text-[var(--color-v2-muted-foreground)] shadow-sm"
        />
      </div>

      <div className="flex items-center w-full sm:w-auto gap-2 md:gap-3 justify-between sm:justify-end overflow-x-auto no-scrollbar pt-2 -mt-2 pb-2 -mb-2 sm:pb-0 sm:-mb-0 shrink-0">
        <div className="flex items-center gap-2">
          {sortOptions.length > 0 && onSortChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 rounded-xl bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] hover:bg-[var(--color-v2-secondary)] shrink-0 px-3 md:px-4">
                  <ArrowUpDown className="h-4 w-4 md:mr-2 text-[var(--color-v2-muted-foreground)]" />
                  <span className="hidden md:inline-block font-medium truncate max-w-[120px]">{activeSortLabel}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[var(--color-v2-card)] border-[var(--color-v2-border)] z-50 rounded-xl shadow-xl shadow-black/10">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Sort by</div>
                <DropdownMenuSeparator className="bg-[var(--color-v2-border)]" />
                {sortOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => onSortChange(option.id)}
                    className={`cursor-pointer rounded-lg mx-1 my-0.5 ${activeSortOption === option.id ? 'bg-[var(--color-v2-primary)]/10 text-[var(--color-v2-primary)] font-semibold' : 'text-[var(--color-v2-foreground)] hover:bg-[var(--color-v2-secondary)]'}`}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {filterOptions.length > 0 && onFilterToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={`h-11 rounded-xl shrink-0 px-3 md:px-4 transition-colors relative ${isFiltering ? 'bg-[var(--color-v2-primary)]/10 border-[var(--color-v2-primary)]/30 text-[var(--color-v2-primary)]' : 'bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] hover:bg-[var(--color-v2-secondary)]'}`}>
                  <Filter className={`h-4 w-4 md:mr-2 ${isFiltering ? 'text-[var(--color-v2-primary)]' : 'text-[var(--color-v2-muted-foreground)]'}`} />
                  <span className="hidden md:inline-block font-medium truncate max-w-[100px]">{activeFilterLabel}</span>
                  {isFiltering && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-v2-primary)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--color-v2-primary)] shadow-sm"></span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[var(--color-v2-card)] border-[var(--color-v2-border)] z-50 rounded-xl shadow-xl shadow-black/10">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Filter Settings</div>
                <DropdownMenuSeparator className="bg-[var(--color-v2-border)]" />
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    if (onClearFilters) onClearFilters();
                  }} 
                  className={`cursor-pointer rounded-lg mx-1 my-0.5 ${!isFiltering ? 'bg-[var(--color-v2-primary)]/10 text-[var(--color-v2-primary)] font-semibold' : 'text-[var(--color-v2-foreground)] hover:bg-[var(--color-v2-secondary)]'}`}
                >
                  Clear All Filters
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--color-v2-border)]" />
                {filterOptions.map((option) => {
                  const isActive = activeFilterOptions.includes(option.id);
                  return (
                    <DropdownMenuCheckboxItem
                      key={option.id}
                      checked={isActive}
                      onSelect={(e) => {
                        e.preventDefault();
                        onFilterToggle(option.id);
                      }}
                      className={`cursor-pointer rounded-lg mx-1 my-0.5 ${isActive ? 'bg-[var(--color-v2-primary)]/10 text-[var(--color-v2-primary)] font-semibold' : 'text-[var(--color-v2-foreground)] hover:bg-[var(--color-v2-secondary)]'}`}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2 border-l border-[var(--color-v2-border)] pl-2 md:pl-3 ml-1">
          {children}
          {primaryAction && (
            <Button onClick={primaryAction.onClick} className="h-11 rounded-xl shrink-0 gap-2 shadow-lg shadow-[var(--color-v2-primary)]/20 px-3 md:px-5">
              <span className="shrink-0">{primaryAction.icon}</span>
              <span className="hidden md:inline-block font-medium">{primaryAction.label}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
