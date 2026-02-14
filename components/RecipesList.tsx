import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Label } from './UI';
import { Recipe, RecipeCategory } from '../types/contract';
import { saltBackend } from '../backend/api';

const RemoteImage: React.FC<{ path?: string; className?: string; alt?: string }> = ({ path, className, alt }) => {
  const [src, setSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (path) {
      setIsLoading(true);
      saltBackend.resolveImagePath(path)
        .then(setSrc)
        .catch(() => setSrc(''))
        .finally(() => setIsLoading(false));
    } else {
      setSrc('');
      setIsLoading(false);
    }
  }, [path]);

  if (isLoading) {
    return (
      <div className={`${className} bg-gray-50 flex items-center justify-center`}>
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`${className} bg-gray-50 flex items-center justify-center text-gray-200 uppercase font-black text-[10px] tracking-widest`}>
        No Image
      </div>
    );
  }

  return <img src={src} className={className} alt={alt} />;
};

export interface RecipesListProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onNewRecipe: () => void;
}

type SortOption = 'newest' | 'name' | 'quick';
type ComplexityFilter = 'all' | 'Simple' | 'Intermediate' | 'Advanced';

export const RecipesList: React.FC<RecipesListProps> = ({ recipes, onSelectRecipe, onNewRecipe }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [complexityFilter, setComplexityFilter] = useState<ComplexityFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 768;
  });
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load categories on mount
    saltBackend.getCategories().then(cats => setCategories(cats)).catch(err => console.error('Failed to load categories:', err));
  }, []);

  const toggleCategoryFilter = (categoryId: string) => {
    setSelectedCategories(prev => {
      const updated = new Set(prev);
      if (updated.has(categoryId)) {
        updated.delete(categoryId);
      } else {
        updated.add(categoryId);
      }
      return updated;
    });
  };

  const getCategoryName = (categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  const parseTimeToMinutes = (timeStr: string): number => {
    let minutes = 0;
    const hourMatch = timeStr.match(/(\d+)\s*hours?/i);
    const minMatch = timeStr.match(/(\d+)(?:\s*mins?)?(?:\s|$)/i);
    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) minutes += parseInt(minMatch[1]);
    return minutes || 0;
  };

  const formatServings = (value: any): string => {
    const str = `${value ?? ''}`.trim();
    if (!str) return '—';
    const hasLetters = /[a-zA-Z]/.test(str);
    return hasLetters ? str : `${str} servings`;
  };

  const filtered = recipes
    .filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || 
                           r.description.toLowerCase().includes(search.toLowerCase());
      const matchesComplexity = complexityFilter === 'all' || r.complexity === complexityFilter;
      // If categories are selected, recipe must match all selected categories
      const matchesCategory = selectedCategories.size === 0 || 
                 (r.categoryIds && Array.from(selectedCategories).every(catId => r.categoryIds?.includes(catId)));
      return matchesSearch && matchesComplexity && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'quick':
          return parseTimeToMinutes(a.totalTime) - parseTimeToMinutes(b.totalTime);
        case 'newest':
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });

  const availableCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    filtered.forEach(r => r.categoryIds?.forEach(catId => ids.add(catId)));
    return ids;
  }, [filtered]);

  const getRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="w-full space-y-6">
        <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-6 sticky top-16 md:top-20 z-20">
          <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-row md:items-center gap-2 w-full">
                <Input
                  placeholder="Search recipes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
                <Button variant="neutral" onClick={onNewRecipe} className="shrink-0 hidden md:inline-flex">
                  New Recipe
                </Button>
              </div>
              <Button 
                variant="neutral" 
                onClick={() => setFiltersOpen(!filtersOpen)} 
                className="md:hidden w-full"
              >
                {filtersOpen ? 'Hide' : 'Show'} Filters
              </Button>
            </div>

            {filtersOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Sort By</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {(['newest', 'name', 'quick'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setSortBy(opt)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          sortBy === opt 
                            ? 'bg-gray-900 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {opt === 'newest' ? 'Newest' : opt === 'name' ? 'Name' : 'Quickest'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Complexity</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {(['all', 'Simple', 'Intermediate', 'Advanced'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setComplexityFilter(opt)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          complexityFilter === opt 
                            ? 'bg-gray-900 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {opt === 'all' ? 'All' : opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {availableCategoryIds.size > 0 && (
              <div>
                <Label>Filter by Category</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {Array.from(availableCategoryIds).map(catId => {
                    const isSelected = selectedCategories.has(catId);
                    return (
                      <button
                        key={catId}
                        onClick={() => toggleCategoryFilter(catId)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          isSelected 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {getCategoryName(catId)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((recipe) => (
            <Card
              key={recipe.id}
              onClick={() => onSelectRecipe(recipe)}
              className="group cursor-pointer transition-transform active:scale-[0.98] flex flex-col"
            >
              <div className="mb-3 relative">
                <div className="aspect-video bg-gray-100 rounded-md overflow-hidden">
                  {recipe.imagePath ? (
                    <RemoteImage 
                      path={recipe.imagePath}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={recipe.title}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold uppercase tracking-widest">
                      No Image
                    </div>
                  )}
                </div>
                {recipe.categoryIds && recipe.categoryIds.length > 0 && (
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {recipe.categoryIds.slice(0, 2).map(catId => (
                      <span 
                        key={catId}
                        className="bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      >
                        {getCategoryName(catId)}
                      </span>
                    ))}
                    {recipe.categoryIds.length > 2 && (
                      <span className="bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        +{recipe.categoryIds.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                {recipe.title}
              </h3>
              
              <p className="text-xs text-gray-600 mb-3 line-clamp-2 flex-1">
                {recipe.description}
              </p>
              
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{recipe.totalTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>{formatServings(recipe.servings)}</span>
                </div>
                <div className="flex items-center gap-1 col-span-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="capitalize">{recipe.complexity}</span>
                  <span className="mx-1">•</span>
                  <span className="text-gray-400">{getRelativeTime(recipe.createdAt)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">No recipes found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}

        <Button 
          variant="neutral" 
          onClick={onNewRecipe} 
          className="md:hidden w-full sticky bottom-4"
        >
          New Recipe
        </Button>
      </div>
    </div>
  );
};
