import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Heart, Home, User as UserIcon } from 'lucide-react';
import {
  getCategoryInterestClicks,
  getRecipeInterestSignals,
  recordCategoryInterestClick,
} from '../services/firestoreService';
import type { ActiveTab, Recipe, RecipeCategory, UserProfile } from '../types';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  showFilterStrip?: boolean;
  categories?: RecipeCategory[];
  recipes?: Recipe[];
  user?: UserProfile | null;
  interestVersion?: number;
}

const TIER_FILTERS = ['প্রিমিয়াম', 'বিনামূল্যে'];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  selectedFilter,
  onFilterChange,
  showFilterStrip = true,
  categories = [],
  recipes = [],
  user = null,
  interestVersion = 0,
}) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dragStateRef = useRef<{
    isMouseDown: boolean;
    startX: number;
    scrollLeft: number;
    didDrag: boolean;
  }>({ isMouseDown: false, startX: 0, scrollLeft: 0, didDrag: false });

  const { mobileFilters, interestedFilters } = useMemo(() => {
    const dynamicNames = categories
      .filter((c) => c.isActive !== false)
      .map((c) => c.name);

    const candidatePool = Array.from(new Set([...TIER_FILTERS, ...dynamicNames]));
    const scores: Record<string, number> = {};
    for (const item of candidatePool) {
      scores[item] = 0;
    }

    const recipeMap = new Map<string, Recipe>();
    for (const r of recipes) {
      recipeMap.set(r.id, r);
    }

    const addRecipeAffinity = (recipe: Recipe | undefined, weight: number) => {
      if (!recipe) return;
      if (recipe.category && scores[recipe.category] !== undefined) {
        scores[recipe.category] += weight;
      } else if (recipe.category === 'মিষ্টি' && scores['মিষ্টান্ন'] !== undefined) {
        scores['মিষ্টান্ন'] += weight;
      }
      if (recipe.cuisine === 'চাইনিজ' && scores['চাইনিজ রেসিপি'] !== undefined) {
        scores['চাইনিজ রেসিপি'] += weight * 0.7;
      }
      const tierKey = recipe.isPremium ? 'প্রিমিয়াম' : 'বিনামূল্যে';
      if (scores[tierKey] !== undefined) {
        scores[tierKey] += weight * 0.45;
      }
    };

    // 1. Merge Firestore viewedHistory + local real-time recipe view signals for this specific user
    const latestByRecipe = new Map<string, number>();
    for (const entry of user?.viewedHistory || []) {
      const prevTs = latestByRecipe.get(entry.recipeId) || 0;
      if (entry.viewedAt > prevTs) latestByRecipe.set(entry.recipeId, entry.viewedAt);
    }
    for (const entry of getRecipeInterestSignals(user?.uid)) {
      const prevTs = latestByRecipe.get(entry.recipeId) || 0;
      if (entry.viewedAt > prevTs) latestByRecipe.set(entry.recipeId, entry.viewedAt);
    }

    const mergedViews = Array.from(latestByRecipe.entries())
      .map(([recipeId, viewedAt]) => ({ recipeId, viewedAt }))
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .slice(0, 25);

    mergedViews.forEach((entry, idx) => {
      const weight = 12 * Math.pow(0.82, idx);
      addRecipeAffinity(recipeMap.get(entry.recipeId), weight);
    });

    // 2. Favorite recipes signal
    for (const favId of user?.favoriteRecipeIds || []) {
      addRecipeAffinity(recipeMap.get(favId), 8);
    }

    // 3. Unlocked recipes signal
    for (const unlockedId of user?.unlockedRecipeIds || []) {
      addRecipeAffinity(recipeMap.get(unlockedId), 4);
    }

    // 4. Recent category filter clicks for this user
    getCategoryInterestClicks(user?.uid).forEach((click, idx) => {
      if (scores[click.name] !== undefined) {
        scores[click.name] += 4 * Math.pow(0.85, idx);
      }
    });

    // 5. Subscription tier context
    if (
      user &&
      user.subscriptionStatus === 'active' &&
      (user.subscriptionPlan === 'standard' || user.subscriptionPlan === 'pro') &&
      scores['প্রিমিয়াম'] !== undefined
    ) {
      scores['প্রিমিয়াম'] += 4;
    }

    const baseIndex = new Map<string, number>();
    candidatePool.forEach((name, idx) => baseIndex.set(name, idx));

    const sortedCandidates = [...candidatePool].sort((a, b) => {
      const diff = (scores[b] || 0) - (scores[a] || 0);
      if (Math.abs(diff) > 0.01) return diff;
      return (baseIndex.get(a) || 0) - (baseIndex.get(b) || 0);
    });

    const topInterested = new Set(
      sortedCandidates.filter((name) => (scores[name] || 0) > 0).slice(0, 3)
    );

    return {
      mobileFilters: ['সব', ...sortedCandidates],
      interestedFilters: topInterested,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categories,
    recipes,
    user?.uid,
    user?.subscriptionPlan,
    user?.subscriptionStatus,
    user?.viewedHistory,
    user?.favoriteRecipeIds,
    user?.unlockedRecipeIds,
    interestVersion,
  ]);

  useEffect(() => {
    const activeEl = pillRefs.current[selectedFilter];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedFilter]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !stripRef.current) return;
    dragStateRef.current = {
      isMouseDown: true,
      startX: e.clientX,
      scrollLeft: stripRef.current.scrollLeft,
      didDrag: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !dragStateRef.current.isMouseDown || !stripRef.current) return;
    const dx = e.clientX - dragStateRef.current.startX;
    if (Math.abs(dx) > 6) {
      dragStateRef.current.didDrag = true;
    }
    stripRef.current.scrollLeft = dragStateRef.current.scrollLeft - dx;
  };

  const handlePointerUpOrCancel = () => {
    dragStateRef.current.isMouseDown = false;
  };

  const navTabs: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    isActive: boolean;
  }> = [
    { id: 'home', label: 'হোম', icon: Home, isActive: activeTab === 'home' },
    { id: 'recipes', label: 'রেসিপি', icon: BookOpen, isActive: activeTab === 'recipes' },
    { id: 'favorites', label: 'প্রিয়', icon: Heart, isActive: activeTab === 'favorites' },
    {
      id: 'profile',
      label: 'প্রোফাইল',
      icon: UserIcon,
      isActive: activeTab === 'profile' || activeTab === 'admin',
    },
  ];

  const isFilterStripVisible = showFilterStrip && (activeTab === 'home' || activeTab === 'recipes');

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200">
      {/* Personalized Horizontal Swipeable Interest & Category Filter Strip */}
      <AnimatePresence initial={false}>
        {isFilterStripVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-gray-100"
          >
            <div
              ref={stripRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
              onPointerLeave={handlePointerUpOrCancel}
              aria-label="আপনার পছন্দ অনুযায়ী রেসিপি ফিল্টার"
              className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain select-none cursor-grab active:cursor-grabbing"
            >
              {mobileFilters.map((f) => {
                const isActive = selectedFilter === f;
                const isPersonalized = f !== 'সব' && interestedFilters.has(f);
                return (
                  <button
                    key={f}
                    ref={(el) => {
                      pillRefs.current[f] = el;
                    }}
                    type="button"
                    onClick={() => {
                      if (dragStateRef.current.didDrag) {
                        dragStateRef.current.didDrag = false;
                        return;
                      }
                      recordCategoryInterestClick(user?.uid, f);
                      onFilterChange(f);
                    }}
                    className={`px-3 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 active:scale-95 ${
                      isActive
                        ? 'bg-[#1B4D24] text-white shadow-2xs'
                        : isPersonalized
                          ? 'bg-[#F4F8F4] text-[#1B4D24] border border-[#1B4D24]/30'
                          : 'bg-white text-gray-700 border border-gray-200'
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4-Tab Thumb Navigation Bar */}
      <nav className="grid grid-cols-4 h-12 items-center" aria-label="মোবাইল ন্যাভিগেশন">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`relative flex flex-col items-center justify-center h-full gap-0.5 transition-colors duration-150 active:scale-92 ${
                tab.isActive ? 'text-[#1B4D24] font-bold' : 'text-gray-500'
              }`}
            >
              {tab.isActive && (
                <motion.span
                  layoutId="mobile-bottom-nav-indicator"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  className="absolute top-0 w-7 h-[2.5px] rounded-b-full bg-[#1B4D24]"
                />
              )}
              <Icon className="w-5 h-5 transition-transform duration-150" strokeWidth={tab.isActive ? 2.4 : 1.8} />
              <span className="text-[11px] leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
