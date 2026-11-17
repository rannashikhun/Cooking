import React, { useMemo } from 'react';
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';
import { CategoryIcon, CategoryStrip } from './CategoryIcon';
import { RecipeFeed } from './RecipeFeed';
import type { PageRoute, Recipe, RecipeCategory } from '../types';

interface CategoryPageProps {
  categorySlug: string;
  categories: RecipeCategory[];
  recipes: Recipe[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onSelectCategory: (categoryName: string) => void;
  onNavigate: (route: PageRoute) => void;
  favoriteIds: string[];
  onToggleFavorite: (recipeId: string) => void;
  hasActiveSubscription: boolean;
  unlockedIds?: string[];
  quotaLimit?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

export const CategoryPage: React.FC<CategoryPageProps> = ({
  categorySlug,
  categories,
  recipes,
  searchQuery,
  onSearchChange,
  onSelectRecipe,
  onSelectCategory,
  onNavigate,
  favoriteIds,
  onToggleFavorite,
  hasActiveSubscription,
  unlockedIds,
  quotaLimit,
  currentPage,
  onPageChange,
}) => {
  const matchedCategory = useMemo(() => {
    const clean = categorySlug.trim();
    return (
      categories.find((c) => c.name.trim() === clean || c.id === clean) || null
    );
  }, [categories, categorySlug]);

  const categoryName = matchedCategory?.name || categorySlug.trim();

  const categoryRecipeCount = useMemo(() => {
    return recipes.filter((r) => {
      if ((r.category || '').trim() === categoryName) return true;
      if (categoryName === 'মিষ্টান্ন' && r.category === 'মিষ্টি') return true;
      if (categoryName === 'মাছের রেসিপি' && (r.title.includes('মাছ') || r.title.includes('ইলিশ') || r.title.includes('চিংড়ি'))) return true;
      if (categoryName === 'মাংসের রেসিপি' && (r.title.includes('মাটন') || r.title.includes('মাংস') || r.title.includes('মুরগি'))) return true;
      if (categoryName === 'ভাত ও পোলাও' && (r.title.includes('ভাত') || r.title.includes('পোলাও') || r.title.includes('বিরিয়ানি'))) return true;
      if (categoryName === 'সবজি রেসিপি' && (r.title.includes('আলু') || r.title.includes('সবজি'))) return true;
      if (categoryName === 'চাইনিজ রেসিপি' && (r.cuisine === 'চাইনিজ' || r.title.includes('চাইনিজ') || r.title.includes('নুডলস') || r.title.includes('ফ্রাইড রাইস'))) return true;
      return false;
    }).length;
  }, [recipes, categoryName]);

  return (
    <div className="pb-10">
      {/* Category Page Hero / Breadcrumb Banner */}
      <section className="bg-gradient-to-b from-[#FDF5F3]/85 to-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-6 md:pt-7 md:pb-7">
          <nav
            aria-label="ব্রেডক্রাম্ব"
            className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-gray-500 mb-4"
          >
            <button
              type="button"
              onClick={() => onNavigate({ page: 'home' })}
              className="hover:text-[#1B4D24] cursor-pointer"
            >
              হোম
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <button
              type="button"
              onClick={() => onNavigate({ page: 'recipes' })}
              className="hover:text-[#1B4D24] cursor-pointer"
            >
              সব রেসিপি
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[#B92B27] font-bold">{categoryName}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-[#E8C6BD]/60 shadow-xs flex items-center justify-center shrink-0">
                <CategoryIcon
                  iconKey={matchedCategory?.iconKey}
                  iconImageUrl={matchedCategory?.iconImageUrl}
                  name={categoryName}
                  size="lg"
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
                    {categoryName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] text-xs font-bold tabular-nums">
                    <BookOpen className="w-3.5 h-3.5" />
                    {toBengaliDigits(categoryRecipeCount)}টি রেসিপি
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {categoryName} ক্যাটাগরির সকল বাছাইকৃত ও ধাপে ধাপে শেখার বাংলা রেসিপি সংগ্রহ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate({ page: 'recipes' })}
              className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white hover:border-[#1B4D24] hover:text-[#1B4D24] text-xs font-bold text-[#1A1A1A] transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              সব রেসিপি দেখুন
            </button>
          </div>
        </div>
      </section>

      {/* Switch Between All Dedicated Category Pages */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-5">
        <CategoryStrip
          embedded
          showAllButton
          categories={categories}
          selectedCategory={categoryName}
          onSelectCategory={onSelectCategory}
        />
      </div>

      {/* Category Recipes Feed (9 per page on Desktop, 10 per page on Mobile) */}
      <RecipeFeed
        recipes={recipes}
        categories={categories}
        selectedFilter={categoryName}
        onFilterChange={(nextFilter) => {
          if (nextFilter === 'সব') {
            onNavigate({ page: 'recipes' });
          } else {
            onSelectCategory(nextFilter);
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onSelectRecipe={onSelectRecipe}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
        hasActiveSubscription={hasActiveSubscription}
        unlockedIds={unlockedIds}
        quotaLimit={quotaLimit}
        title={`${categoryName} — রেসিপি তালিকা`}
        hideSearchAndFilters
        hideCategoryStrip
        centerHeading
        pageSize={10}
        desktopPageSize={9}
        currentPage={currentPage}
        onPageChange={onPageChange}
      />
    </div>
  );
};
