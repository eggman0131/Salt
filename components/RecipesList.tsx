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
                <div className="relative flex-1">
                  <Input 
                    placeholder="Search recipes..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    className="pl-12 font-sans h-12 text-base shadow-sm border border-gray-200 bg-gray-50 focus:border-orange-500 focus:ring-orange-50 rounded-md cursor-text"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </span>
                </div>
                <button 
                  onClick={onNewRecipe} 
                  className="bg-orange-600 text-white rounded-md h-12 px-4 font-medium hover:bg-orange-700 transition shadow-sm flex items-center justify-center gap-2 shrink-0"
                  title="New Recipe"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  <span className="hidden md:inline">New Recipe</span>
                </button>
              </div>
              <div className="flex gap-2 w-full md:w-auto md:h-12">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(open => !open)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 rounded-md shadow-sm text-sm text-gray-700 flex-1 md:flex-none md:min-w-[150px] md:h-full"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M7 12h10M10 19h4"/></svg>
                  Filters
                </button>
                <div className="relative flex-1 md:flex-none md:min-w-[150px]">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full h-full px-3 py-2 pr-8 rounded-md text-sm font-semibold bg-gray-50 text-gray-700 border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-100 appearance-none"
                  >
                    <option value="newest">Newest</option>
                    <option value="name">A–Z</option>
                    <option value="quick">Quick</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M5.25 7.25L10 12l4.75-4.75" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`${filtersOpen ? 'flex' : 'hidden'} items-center gap-2 flex-wrap bg-gray-50 rounded-md shadow-sm p-4 w-full`}> 
                <div className="flex gap-2 flex-wrap w-full">
                  {(['all', 'Simple', 'Intermediate', 'Advanced'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setComplexityFilter(level as ComplexityFilter)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-all border ${
                        complexityFilter === level
                          ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm'
                          : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {level === 'all' ? 'All' : level}
                    </button>
                  ))}
                </div>

                {/* Category filters */}
                {categories.length > 0 && (
                  <div className="flex gap-2 flex-wrap w-full border-t border-gray-300 pt-3 mt-2">
                    {categories.filter(cat => availableCategoryIds.has(cat.id)).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          selectedCategories.has(cat.id)
                            ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                            : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

              </div>
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 md:mt-0">
          {filtered.map(recipe => (
            <Card 
              key={recipe.id} 
              className="cursor-pointer bg-white border-l-4 border-l-orange-600 border-y border-r border-gray-200 shadow-sm hover:bg-orange-50 transition flex flex-col overflow-hidden hover:shadow-md group"
              onClick={() => onSelectRecipe(recipe)}
            >
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {recipe.imagePath ? (
                  <RemoteImage path={recipe.imagePath} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={recipe.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs uppercase tracking-wide">No Image</div>
                )}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  <span className="inline-block rounded-full bg-orange-100 text-orange-700 text-xs px-3 py-1 font-semibold shadow-sm">
                    {recipe.complexity}
                  </span>
                  <span className="inline-block rounded-full bg-white/90 text-gray-800 text-xs px-3 py-1 font-semibold shadow-sm">
                    {recipe.totalTime}
                  </span>
                </div>
              </div>
              <div className="p-4 md:p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{getRelativeTime(recipe.createdAt)}</span>
                  <span className="inline-flex items-center gap-1 text-orange-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    {formatServings(recipe.servings)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-tight group-hover:text-orange-700 transition-colors">{recipe.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                </div>
                {recipe.categoryIds && recipe.categoryIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 mt-auto">
                    {recipe.categoryIds.slice(0, 3).map(catId => (
                      <button
                        key={catId}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategoryFilter(catId);
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition cursor-pointer ${
                          selectedCategories.has(catId)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                        }`}
                      >
                        {getCategoryName(catId)}
                      </button>
                    ))}
                    {recipe.categoryIds.length > 3 && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        +{recipe.categoryIds.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <svg className="w-24 h-24 mb-6 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            <p className="text-2xl font-medium mb-2">No Recipes Found</p>
            <p className="text-base">Adjust your search or create a new recipe.</p>
          </div>
        )}
      </div>
    </div>
  );
};
