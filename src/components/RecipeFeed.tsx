import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Heart, Lock, Search, Star } from 'lucide-react';
import { CategoryStrip } from './CategoryIcon';
import type { Recipe, RecipeCategory } from '../types';

interface RecipeFeedProps {
  recipes: Recipe[];
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  favoriteIds: string[];
  onToggleFavorite: (recipeId: string) => void;
  hasActiveSubscription: boolean;
  unlockedIds?: string[];
  quotaLimit?: number;
  freeUnlockedIds?: string[];
  premiumUnlockedIds?: string[];
  premiumQuotaLimit?: number;
  freeQuotaLimit?: number;
  title?: string;
  categories?: RecipeCategory[];
  hideSearchAndFilters?: boolean;
  hideCategoryStrip?: boolean;
  centerHeading?: boolean;
  categorySlot?: React.ReactNode;
  onSelectCategory?: (categoryName: string) => void;
  pageSize?: number;
  desktopPageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  hidePagination?: boolean;
}

const FILTER_OPTIONS = [
  { id: 'সব', label: 'সব' },
  { id: 'প্রিমিয়াম', label: 'প্রিমিয়াম' },
  { id: 'উৎসব', label: 'উৎসব' },
  { id: 'সহজ', label: 'সহজ' },
  { id: 'বিনামূল্যে', label: 'বিনামূল্যে' },
];

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

const getRecipeCreatedMillis = (r: Recipe): number => {
  const ts = r.createdAt as { toMillis?: () => number; seconds?: number } | undefined;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (r.id.startsWith('recipe_')) {
    const parsed = Number(r.id.slice(7));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

export const RecipeFeed: React.FC<RecipeFeedProps> = ({
  recipes,
  selectedFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onSelectRecipe,
  favoriteIds,
  onToggleFavorite,
  hasActiveSubscription,
  unlockedIds,
  quotaLimit,
  freeUnlockedIds,
  premiumUnlockedIds,
  premiumQuotaLimit,
  freeQuotaLimit = 10,
  title = 'সব জনপ্রিয় রেসিপি',
  categories = [],
  hideSearchAndFilters = false,
  hideCategoryStrip = false,
  centerHeading = false,
  categorySlot,
  onSelectCategory,
  pageSize = 10,
  desktopPageSize,
  currentPage: controlledPage,
  onPageChange,
  hidePagination = false,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [internalPage, setInternalPage] = useState(1);
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const effectivePageSize = isDesktop && desktopPageSize ? desktopPageSize : pageSize;
  const currentPage = controlledPage ?? internalPage;

  const isLegacyQuotaFull =
    quotaLimit !== undefined &&
    unlockedIds !== undefined &&
    unlockedIds.length >= quotaLimit;

  const getRecipeAccessVisual = (recipe: Recipe) => {
    const isPermUnlocked = Boolean(recipe.isPremium && premiumUnlockedIds?.includes(recipe.id));
    if (recipe.isPremium) {
      if (isPermUnlocked) {
        return { isBlocked: false, isPermUnlocked: true, ctaLabel: 'বিস্তারিত দেখুন' };
      }
      if (!hasActiveSubscription) {
        return { isBlocked: true, isPermUnlocked: false, ctaLabel: 'আনলক করুন' };
      }
      if (
        premiumQuotaLimit !== undefined &&
        premiumUnlockedIds !== undefined &&
        premiumUnlockedIds.length >= premiumQuotaLimit
      ) {
        return { isBlocked: true, isPermUnlocked: false, ctaLabel: 'কোটা পূর্ণ' };
      }
      return { isBlocked: false, isPermUnlocked: false, ctaLabel: 'বিস্তারিত দেখুন' };
    }

    // Free recipe
    if (hasActiveSubscription) {
      return { isBlocked: false, isPermUnlocked: false, ctaLabel: 'রেসিপি দেখুন' };
    }
    if (freeUnlockedIds !== undefined) {
      if (freeUnlockedIds.includes(recipe.id)) {
        return { isBlocked: false, isPermUnlocked: false, ctaLabel: 'রেসিপি দেখুন' };
      }
      if (freeUnlockedIds.length >= freeQuotaLimit) {
        return { isBlocked: true, isPermUnlocked: false, ctaLabel: 'ফ্রি লিমিট শেষ' };
      }
      return { isBlocked: false, isPermUnlocked: false, ctaLabel: 'রেসিপি দেখুন' };
    }
    const lockedByQuota = Boolean(isLegacyQuotaFull && !unlockedIds?.includes(recipe.id));
    return {
      isBlocked: lockedByQuota,
      isPermUnlocked: false,
      ctaLabel: lockedByQuota ? 'কোটা পূর্ণ' : 'রেসিপি দেখুন',
    };
  };

  const filteredRecipes = useMemo(() => {
    const matched = recipes.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedFilter === 'সব') return true;
      if (selectedFilter === 'প্রিমিয়াম') return r.isPremium;
      if (selectedFilter === 'বিনামূল্যে') return !r.isPremium;
      if (selectedFilter === 'সহজ') return r.difficulty === 'সহজ' || r.category === 'সহজ';
      if ((r.category || '').trim() === selectedFilter.trim()) return true;
      if (selectedFilter === 'মিষ্টান্ন' && r.category === 'মিষ্টি') return true;
      if (selectedFilter === 'মাছের রেসিপি' && (r.title.includes('মাছ') || r.title.includes('ইলিশ') || r.title.includes('চিংড়ি'))) return true;
      if (selectedFilter === 'মাংসের রেসিপি' && (r.title.includes('মাটন') || r.title.includes('মাংস') || r.title.includes('মুরগি'))) return true;
      if (selectedFilter === 'ভাত ও পোলাও' && (r.title.includes('ভাত') || r.title.includes('পোলাও') || r.title.includes('বিরিয়ানি'))) return true;
      if (selectedFilter === 'সবজি রেসিপি' && (r.title.includes('আলু') || r.title.includes('সবজি'))) return true;
      if (selectedFilter === 'চাইনিজ রেসিপি' && (r.cuisine === 'চাইনিজ' || r.title.includes('চাইনিজ') || r.title.includes('নুডলস') || r.title.includes('ফ্রাইড রাইস'))) return true;
      return false;
    });

    // Always surface newest recipes first
    return [...matched].sort((a, b) => {
      const tA = getRecipeCreatedMillis(a);
      const tB = getRecipeCreatedMillis(b);
      if (Math.abs(tB - tA) > 1000) return tB - tA;
      return (b.orderIndex || 0) - (a.orderIndex || 0);
    });
  }, [recipes, searchQuery, selectedFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / effectivePageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecipes = useMemo(() => {
    const start = (safePage - 1) * effectivePageSize;
    return filteredRecipes.slice(start, start + effectivePageSize);
  }, [filteredRecipes, safePage, effectivePageSize]);

  useEffect(() => {
    if (onPageChange) {
      onPageChange(1);
    } else {
      setInternalPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, searchQuery]);

  const handlePageChange = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    if (onPageChange) {
      onPageChange(clamped);
    } else {
      setInternalPage(clamped);
    }
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section ref={sectionRef} className="max-w-6xl mx-auto px-3 sm:px-6 py-4 md:py-10">
      {/* Section Header + Optional Search & Filter Tabs */}
      <div
        className={`${
          centerHeading ? 'flex flex-col items-center text-center' : 'hidden md:flex flex-col lg:flex-row lg:items-center justify-between'
        } gap-4 mb-5 md:mb-6`}
      >
        <div>
          <h2 className="font-display-bn text-xl sm:text-3xl font-bold text-[#1A1A1A]">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            বিনামূল্যের সহজ রেসিপি ও প্রিমিয়াম শেফ স্পেশাল রান্নার সম্পূর্ণ সংগ্রহ
          </p>
        </div>

        {!hideSearchAndFilters && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="রেসিপি খুঁজুন..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#1B4D24] w-56"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFilterChange(f.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selectedFilter === f.id
                      ? 'bg-[#1B4D24] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {categorySlot}

      {/* Arrow-enabled & Touch-swipeable Category Strip on Recipes Page */}
      {!hideCategoryStrip &&
        !categorySlot &&
        categories.filter((c) => c.isActive !== false).length > 0 && (
          <CategoryStrip
            embedded
            showAllButton
            categories={categories}
            selectedCategory={selectedFilter}
            onSelectCategory={onSelectCategory || onFilterChange}
          />
        )}

      {/* Empty State */}
      {filteredRecipes.length === 0 && (
        <div className="text-center py-14 px-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-base font-semibold text-gray-800">কোনো রেসিপি পাওয়া যায়নি</p>
          <p className="text-sm text-gray-500 mt-1">অন্য কোনো ফিল্টার বা শব্দ দিয়ে খুঁজে দেখুন</p>
          <button
            type="button"
            onClick={() => {
              onFilterChange('সব');
              onSearchChange('');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#1B4D24] text-white text-sm font-semibold cursor-pointer"
          >
            সব রেসিপি দেখুন
          </button>
        </div>
      )}

      {/* MOBILE FEED LAYOUT */}
      <div className="md:hidden space-y-5">
        {paginatedRecipes.map((recipe) => {
          const isFav = favoriteIds.includes(recipe.id);
          const { isBlocked, isPermUnlocked, ctaLabel } = getRecipeAccessVisual(recipe);
          return (
            <article key={recipe.id} className="bg-white">
              {/* Image Container */}
              <div
                onClick={() => onSelectRecipe(recipe)}
                className="relative rounded-2xl overflow-hidden shadow-xs cursor-pointer bg-gray-100"
              >
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-44 object-cover"
                />

                {/* Subtle bottom gradient for overlay legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15 pointer-events-none" />

                {/* Top-Right Free/Premium Badge */}
                <div className="absolute top-2.5 right-2.5">
                  {recipe.isPremium ? (
                    isPermUnlocked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold shadow">
                        <CheckCircle2 className="w-3 h-3" />
                        আনলকড
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5B83B] text-[#1A1A1A] text-xs font-bold shadow">
                        <Lock className="w-3 h-3" />
                        প্রিমিয়াম
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#1B4D24] text-white text-xs font-bold shadow">
                      বিনামূল্যে
                    </span>
                  )}
                </div>

                {/* Top-Left Favorite Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(recipe.id);
                  }}
                  aria-label="প্রিয় তালিকায় রাখুন"
                  className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white"
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-[#E53935] text-[#E53935]' : 'text-white'}`} />
                </button>

                {/* Bottom-Left Cuisine & Category Badges (no veg/non-veg badge) */}
                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#1B4D24]/95 text-white text-[11px] font-semibold">
                    {recipe.category}
                  </span>
                </div>

                {/* Bottom-Right Time Badge */}
                <div className="absolute bottom-2.5 right-2.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-medium">
                    {recipe.cookTime}
                  </span>
                </div>
              </div>

              {/* Card Footer Info & Action Button (no recipe numbering on mobile) */}
              <div className="flex items-center justify-between gap-3 pt-2.5 pb-4 border-b border-gray-100">
                <div
                  onClick={() => onSelectRecipe(recipe)}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <h3 className="text-[17px] font-bold text-[#1A1A1A] truncate">
                    {recipe.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-0.5 tabular-nums">
                    <span className="font-semibold text-[#1A1A1A]">{toBengaliDigits(recipe.rating.toFixed(1))}</span>
                    <Star className="w-3.5 h-3.5 fill-[#F4C430] text-[#F4C430]" />
                    <span aria-hidden="true">|</span>
                    <span className="truncate">
                      {recipe.cookTime} • {recipe.difficulty}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectRecipe(recipe)}
                  className={`shrink-0 min-h-[40px] px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap ${
                    isBlocked
                      ? 'bg-[#B92B27] text-white'
                      : 'bg-[#1B4D24] text-white'
                  }`}
                >
                  {isBlocked && <Lock className="w-3.5 h-3.5" />}
                  {ctaLabel}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* DESKTOP 3-COLUMN CATALOG GRID */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-7">
        {paginatedRecipes.map((recipe) => {
          const isFav = favoriteIds.includes(recipe.id);
          const { isBlocked, isPermUnlocked, ctaLabel } = getRecipeAccessVisual(recipe);
          return (
            <article
              key={recipe.id}
              className="group bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div
                onClick={() => onSelectRecipe(recipe)}
                className="relative aspect-[16/10] bg-gray-100 overflow-hidden cursor-pointer"
              >
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(recipe.id);
                  }}
                  aria-label="প্রিয় তালিকায় রাখুন"
                  className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xs flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-[#E53935] text-[#E53935]' : 'text-white'}`} />
                </button>

                <div className="absolute top-3 right-3">
                  {recipe.isPremium ? (
                    isPermUnlocked ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        আনলকড
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E5B83B] text-[#1A1A1A] text-xs font-bold shadow-xs">
                        <Lock className="w-3 h-3" />
                        প্রিমিয়াম
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1B4D24] text-white text-xs font-bold shadow-xs">
                      বিনামূল্যে
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                  <span>{recipe.category}</span>
                  <span className="tabular-nums">{recipe.cookTime}</span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    onClick={() => onSelectRecipe(recipe)}
                    className="text-lg font-bold text-[#1A1A1A] group-hover:text-[#B92B27] transition-colors cursor-pointer line-clamp-1"
                  >
                    {recipe.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {recipe.subtitle}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 tabular-nums">
                    <span className="font-bold text-[#1A1A1A]">{toBengaliDigits(recipe.rating.toFixed(1))}</span>
                    <Star className="w-3.5 h-3.5 fill-[#F4C430] text-[#F4C430]" />
                    <span>({toBengaliDigits(recipe.ratingCount)})</span>
                    <span aria-hidden="true">·</span>
                    <span>{recipe.difficulty}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectRecipe(recipe)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                      isBlocked
                        ? 'bg-[#B92B27] hover:bg-[#9C221F] text-white'
                        : 'bg-[#1B4D24] hover:bg-[#143A1B] text-white'
                    }`}
                  >
                    {isBlocked && <Lock className="w-3.5 h-3.5" />}
                    {ctaLabel}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Minimal Back / Next Pagination Bar (10 recipes per page) */}
      {!hidePagination && filteredRecipes.length > 0 && (
        <nav
          aria-label="রেসিপি পেজিনেশন"
          className="mt-7 pt-5 border-t border-gray-100 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => handlePageChange(safePage - 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-[#1A1A1A] hover:border-[#1B4D24] hover:text-[#1B4D24] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ব্যাক পেজ</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAFAF8] border border-gray-200/80 text-xs font-semibold text-gray-600 tabular-nums">
            <span>পৃষ্ঠা</span>
            <span className="text-[#1B4D24] font-bold">{toBengaliDigits(safePage)}</span>
            <span>/</span>
            <span>{toBengaliDigits(totalPages)}</span>
          </div>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => handlePageChange(safePage + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-[#1A1A1A] hover:border-[#1B4D24] hover:text-[#1B4D24] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <span>নেক্সট পেজ</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </section>
  );
};
