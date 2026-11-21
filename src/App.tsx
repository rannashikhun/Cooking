import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { AuthPage } from './components/AuthPage';
import { BrandMark } from './components/BrandMark';
import { CategoryStrip } from './components/CategoryIcon';
import { CategoryPage } from './components/CategoryPage';
import { CheckoutPage } from './components/CheckoutPage';
import { Header } from './components/Header';
import { HeroCarousel } from './components/HeroCarousel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PricingSection } from './components/PricingSection';
import { ProfileView } from './components/ProfileView';
import { RecipeDetailPage } from './components/RecipeDetailPage';
import { RecipeFeed } from './components/RecipeFeed';
import {
  BlogDetailPage,
  BlogSection,
  ContactSection,
  TipDetailPage,
  TipsSection,
} from './components/TipsAndBlogSection';
import {
  SEED_BLOGS,
  SEED_CATEGORIES,
  SEED_PLANS,
  SEED_RECIPES,
  SEED_SETTINGS,
  SEED_TIPS,
} from './data/seedData';
import { auth, db, testFirestoreConnection } from './firebase';
import {
  FREE_RECIPE_LIMIT,
  checkAndNotifyPlanExpiry,
  clearUserLocalReads,
  fetchLiveCatalogFromServer,
  getEffectiveUsedRecipeIds,
  getRecipeQuotaLimit,
  getUserFreeUnlockedIds,
  getUserPremiumQuota,
  getUserPremiumUnlockedIds,
  isPaidPlanActive,
  isSuperAdminEmail,
  markAllNotificationsRead,
  markNotificationRead,
  recordCategoryInterestClick,
  recordRecipeInterestSignal,
  seedInitialDatabaseIfNeeded,
  sortByNewestCreatedAt,
  sortByOrderIndexAsc,
  sortRecipesNewestFirst,
  syncUserProfile,
  toggleFavoriteRecipe,
} from './services/firestoreService';
import {
  resolvePublicAsset,
  stripAppBase,
  withAppBase,
} from './utils/appBase';
import { applyRouteSeoMeta } from './utils/seoMeta';
import type {
  ActiveTab,
  BlogPost,
  CookingTip,
  PageRoute,
  Recipe,
  RecipeCategory,
  SiteSettings,
  SubscriptionPlan,
  UserNotification,
  UserProfile,
} from './types';

function parsePathToRoute(pathname: string): PageRoute {
  const stripped = stripAppBase(pathname);
  const clean = stripped.replace(/\/+$/, '') || '/';
  if (clean === '/') return { page: 'home' };
  if (clean === '/recipes') return { page: 'recipes' };
  if (clean.startsWith('/category/')) {
    const rawCat = clean.slice(10);
    if (rawCat) {
      return { page: 'category', categoryName: decodeURIComponent(rawCat) };
    }
    return { page: 'recipes' };
  }
  if (clean.startsWith('/recipe/')) return { page: 'recipe-detail', id: decodeURIComponent(clean.slice(8)) };
  if (clean === '/tips') return { page: 'tips' };
  if (clean.startsWith('/tip/')) return { page: 'tip-detail', id: decodeURIComponent(clean.slice(5)) };
  if (clean === '/pricing') return { page: 'pricing' };
  if (clean.startsWith('/checkout/')) return { page: 'checkout', planId: decodeURIComponent(clean.slice(10)) };
  if (clean === '/blog') return { page: 'blog' };
  if (clean.startsWith('/blog/')) return { page: 'blog-detail', id: decodeURIComponent(clean.slice(6)) };
  if (clean === '/contact') return { page: 'contact' };
  if (clean === '/favorites') return { page: 'favorites' };
  if (clean === '/login') return { page: 'login' };
  if (clean === '/profile') return { page: 'profile' };
  if (clean === '/admin') return { page: 'admin' };
  return { page: 'home' };
}

function routeToPath(route: PageRoute): string {
  switch (route.page) {
    case 'home':
      return '/';
    case 'recipes':
      return '/recipes';
    case 'category':
      return `/category/${encodeURIComponent(route.categoryName)}`;
    case 'recipe-detail':
      return `/recipe/${encodeURIComponent(route.id)}`;
    case 'tips':
      return '/tips';
    case 'tip-detail':
      return `/tip/${encodeURIComponent(route.id)}`;
    case 'pricing':
      return '/pricing';
    case 'checkout':
      return `/checkout/${encodeURIComponent(route.planId)}`;
    case 'blog':
      return '/blog';
    case 'blog-detail':
      return `/blog/${encodeURIComponent(route.id)}`;
    case 'contact':
      return '/contact';
    case 'favorites':
      return '/favorites';
    case 'login':
      return '/login';
    case 'profile':
      return '/profile';
    case 'admin':
      return '/admin';
  }
}

function routeToActiveTab(route: PageRoute): ActiveTab {
  switch (route.page) {
    case 'home':
      return 'home';
    case 'recipes':
    case 'category':
    case 'recipe-detail':
      return 'recipes';
    case 'tips':
    case 'tip-detail':
      return 'tips';
    case 'pricing':
    case 'checkout':
      return 'pricing';
    case 'blog':
    case 'blog-detail':
      return 'blog';
    case 'contact':
      return 'contact';
    case 'favorites':
      return 'favorites';
    case 'login':
      return 'login';
    case 'profile':
      return 'profile';
    case 'admin':
      return 'admin';
  }
}

export default function App() {
  const [route, setRoute] = useState<PageRoute>(() => parsePathToRoute(window.location.pathname));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [recipes, setRecipes] = useState<Recipe[]>(() => SEED_RECIPES.map((s) => s.recipe));
  const [categories, setCategories] = useState<RecipeCategory[]>(() => SEED_CATEGORIES);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => SEED_PLANS);
  const [tips, setTips] = useState<CookingTip[]>(() => SEED_TIPS);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(() => SEED_BLOGS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => SEED_SETTINGS);

  const [selectedFilter, setSelectedFilter] = useState<string>('সব');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recipesPage, setRecipesPage] = useState<number>(1);
  const [categoryPageNum, setCategoryPageNum] = useState<number>(1);
  const [interestVersion, setInterestVersion] = useState<number>(0);
  const [pendingCheckoutPlanId, setPendingCheckoutPlanId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const lastServerSyncRef = useRef<number>(0);
  const lastVersionCheckRef = useRef<number>(0);
  const hasPendingAppUpdateRef = useRef<boolean>(false);
  const routeLoadingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setRecipesPage(1);
    setCategoryPageNum(1);
  }, [selectedFilter, searchQuery]);

  const activeCategorySlug = route.page === 'category' ? route.categoryName : '';
  useEffect(() => {
    setCategoryPageNum(1);
  }, [activeCategorySlug]);

  useEffect(() => {
    applyRouteSeoMeta({
      route,
      siteSettings,
      recipes,
      blogPosts,
      tips,
    });
  }, [route, siteSettings, recipes, blogPosts, tips]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const checkDeployedBuildUpdate = useCallback(async (force = false): Promise<boolean> => {
    if (hasPendingAppUpdateRef.current) return true;
    const now = Date.now();
    if (!force && now - lastVersionCheckRef.current < 15000) {
      return false;
    }
    lastVersionCheckRef.current = now;
    try {
      const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '';
      if (!currentBuildId) return false;
      const versionUrl = `${resolvePublicAsset('version.json')}?t=${now}`;
      const res = await fetch(versionUrl, { cache: 'no-store' });
      if (!res.ok) return false;
      const data = (await res.json()) as { buildId?: string };
      if (data?.buildId && data.buildId !== currentBuildId) {
        hasPendingAppUpdateRef.current = true;
        return true;
      }
    } catch {
      // Ignore transient network errors during version check
    }
    return false;
  }, []);

  const syncCatalogFromServer = useCallback(async (force = false): Promise<void> => {
    const now = Date.now();
    if (!force && now - lastServerSyncRef.current < 4000) return;
    lastServerSyncRef.current = now;
    try {
      const fresh = await fetchLiveCatalogFromServer();
      if (fresh.recipes) setRecipes(fresh.recipes);
      if (fresh.categories) setCategories(fresh.categories);
      if (fresh.plans) setPlans(fresh.plans);
      if (fresh.tips) setTips(fresh.tips);
      if (fresh.blogPosts) setBlogPosts(fresh.blogPosts);
      if (fresh.siteSettings) setSiteSettings(fresh.siteSettings);
    } catch {
      // Keep active snapshot state on transient fetch issue
    }
  }, []);

  const startRouteProgress = useCallback(() => {
    if (routeLoadingTimerRef.current) {
      window.clearTimeout(routeLoadingTimerRef.current);
      routeLoadingTimerRef.current = null;
    }
    setRouteLoading(true);
    return () => {
      routeLoadingTimerRef.current = window.setTimeout(() => {
        setRouteLoading(false);
        routeLoadingTimerRef.current = null;
      }, 260);
    };
  }, []);

  const navigate = (nextRoute: PageRoute) => {
    if (nextRoute.page === 'recipe-detail') {
      recordRecipeInterestSignal(user?.uid, nextRoute.id);
      setInterestVersion((v) => v + 1);
    }
    if (nextRoute.page !== 'login') {
      setPendingCheckoutPlanId(null);
    }

    const targetPath = withAppBase(routeToPath(nextRoute));
    const finishProgress = startRouteProgress();

    // Check if a new site design/build was deployed online — if so, load the fresh build immediately
    if (hasPendingAppUpdateRef.current) {
      window.location.assign(targetPath);
      return;
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Background live sync from server + version check on navigation
    Promise.allSettled([
      checkDeployedBuildUpdate(false).then((hasNewBuild) => {
        if (hasNewBuild && window.location.pathname === targetPath) {
          window.location.assign(targetPath);
        }
      }),
      syncCatalogFromServer(false),
    ]).finally(() => {
      finishProgress();
    });
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) {
      setPendingCheckoutPlanId(plan.id);
      navigate({ page: 'login' });
      return;
    }
    setPendingCheckoutPlanId(null);
    navigate({ page: 'checkout', planId: plan.id });
  };

  const navigateTab = (tab: ActiveTab) => {
    if (tab === 'recipes') {
      setSelectedFilter('সব');
    }
    navigate({ page: tab });
  };

  const navigateToCategory = (catName: string) => {
    const clean = (catName || '').trim();
    if (!clean || clean === 'সব') {
      setSelectedFilter('সব');
      navigate({ page: 'recipes' });
      return;
    }
    recordCategoryInterestClick(user?.uid, clean);
    setInterestVersion((v) => v + 1);
    setCategoryPageNum(1);
    navigate({ page: 'category', categoryName: clean });
  };

  useEffect(() => {
    const handlePopState = () => {
      const finishProgress = startRouteProgress();
      setRoute(parsePathToRoute(window.location.pathname));
      syncCatalogFromServer(false).finally(() => finishProgress());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [startRouteProgress, syncCatalogFromServer]);

  useEffect(() => {
    if (route.page === 'recipe-detail') {
      recordRecipeInterestSignal(user?.uid, route.id);
      setInterestVersion((v) => v + 1);
    }
  }, [route, user?.uid]);

  // 1. Validate Firestore connection & Auth listener
  useEffect(() => {
    testFirestoreConnection();

    let userDocUnsub: (() => void) | null = null;
    let notifUnsub: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }
      if (notifUnsub) {
        notifUnsub();
        notifUnsub = null;
      }

      if (!fbUser) {
        setUser(null);
        setNotifications([]);
        setAuthReady(true);
        return;
      }

      try {
        const profile = await syncUserProfile(fbUser);
        setUser(profile);

        if (profile.role === 'admin' && fbUser.emailVerified) {
          seedInitialDatabaseIfNeeded(false).catch(() => {});
        }

        notifUnsub = onSnapshot(
          query(
            collection(db, 'users', fbUser.uid, 'notifications'),
            orderBy('createdAt', 'desc')
          ),
          (snap) => {
            setNotifications(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<UserNotification, 'id'>),
              }))
            );
          },
          () => {
            setNotifications([]);
          }
        );

        userDocUnsub = onSnapshot(
          doc(db, 'users', fbUser.uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserProfile;
              const verifiedAdmin =
                fbUser.emailVerified &&
                (isSuperAdminEmail(fbUser.email) || data.role === 'admin');
              setUser((prev) => {
                if (
                  prev?.lastOrderId &&
                  data.lastOrderId &&
                  data.lastOrderId !== prev.lastOrderId &&
                  (data.subscriptionPlan === 'standard' || data.subscriptionPlan === 'pro')
                ) {
                  clearUserLocalReads(fbUser.uid);
                }
                return {
                  ...data,
                  uid: fbUser.uid,
                  favoriteRecipeIds: Array.isArray(data.favoriteRecipeIds) ? data.favoriteRecipeIds : [],
                  unlockedRecipeIds: Array.isArray(data.unlockedRecipeIds) ? data.unlockedRecipeIds : [],
                  freeUnlockedRecipeIds: Array.isArray(data.freeUnlockedRecipeIds)
                    ? data.freeUnlockedRecipeIds
                    : prev?.freeUnlockedRecipeIds || [],
                  premiumUnlockedRecipeIds: Array.isArray(data.premiumUnlockedRecipeIds)
                    ? data.premiumUnlockedRecipeIds
                    : prev?.premiumUnlockedRecipeIds || [],
                  premiumRecipeQuota:
                    typeof data.premiumRecipeQuota === 'number'
                      ? data.premiumRecipeQuota
                      : prev?.premiumRecipeQuota || 0,
                  viewedHistory: Array.isArray(data.viewedHistory)
                    ? data.viewedHistory
                    : prev?.viewedHistory || [],
                  role:
                    verifiedAdmin || (fbUser.emailVerified && prev?.role === 'admin')
                      ? 'admin'
                      : 'member',
                };
              });
            }
          },
          () => {}
        );
      } catch {
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (userDocUnsub) userDocUnsub();
      if (notifUnsub) notifUnsub();
    };
  }, []);

  // 2. Real-time public collections listeners + live server sync on mount/focus/reconnect
  useEffect(() => {
    const unsubRecipes = onSnapshot(
      collection(db, 'recipes'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as Recipe), id: d.id }));
          setRecipes(sortRecipesNewestFirst(list));
        }
      },
      (error) => console.error('Recipes snapshot error:', error)
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (!snap.empty) {
          setCategories(
            sortByOrderIndexAsc(
              snap.docs.map((d) => ({ ...(d.data() as RecipeCategory), id: d.id }))
            )
          );
        }
      },
      (error) => console.error('Categories snapshot error:', error)
    );

    const unsubPlans = onSnapshot(
      collection(db, 'subscriptionPlans'),
      (snap) => {
        if (!snap.empty) {
          setPlans(
            sortByOrderIndexAsc(
              snap.docs.map((d) => ({ ...(d.data() as SubscriptionPlan), id: d.id }))
            )
          );
        }
      },
      (error) => console.error('Plans snapshot error:', error)
    );

    const unsubTips = onSnapshot(
      collection(db, 'tips'),
      (snap) => {
        if (!snap.empty) {
          setTips(
            sortByNewestCreatedAt(
              snap.docs.map((d) => ({ ...(d.data() as CookingTip), id: d.id })),
              'tip_'
            )
          );
        }
      },
      (error) => console.error('Tips snapshot error:', error)
    );

    const unsubBlogs = onSnapshot(
      collection(db, 'blogPosts'),
      (snap) => {
        if (!snap.empty) {
          setBlogPosts(
            sortByNewestCreatedAt(
              snap.docs.map((d) => ({ ...(d.data() as BlogPost), id: d.id })),
              'blog_'
            )
          );
        }
      },
      (error) => console.error('BlogPosts snapshot error:', error)
    );

    const unsubSettings = onSnapshot(
      doc(db, 'siteSettings', 'main'),
      (snap) => {
        if (snap.exists()) {
          setSiteSettings(snap.data() as SiteSettings);
        }
      },
      (error) => console.error('SiteSettings snapshot error:', error)
    );

    // Initial server check so live updates are guaranteed right away
    syncCatalogFromServer(true);

    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible') {
        syncCatalogFromServer(false);
        checkDeployedBuildUpdate(false).then((hasNewBuild) => {
          if (hasNewBuild) {
            showToast('সাইটের নতুন আপডেট এসেছে — নতুন পেজে গেলে স্বয়ংক্রিয়ভাবে লোড হবে।');
          }
        });
      }
    };

    const handleOnline = () => {
      syncCatalogFromServer(true);
      checkDeployedBuildUpdate(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    window.addEventListener('online', handleOnline);

    return () => {
      unsubRecipes();
      unsubCategories();
      unsubPlans();
      unsubTips();
      unsubBlogs();
      unsubSettings();
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkDeployedBuildUpdate, showToast, syncCatalogFromServer]);

  // 3. Automatic 1-day-before-expiry renewal notification for Pro/Standard users
  useEffect(() => {
    if (!user || user.role === 'admin') return;
    let active = true;

    const runExpiryCheck = () => {
      checkAndNotifyPlanExpiry(user).then((res) => {
        if (active && res.notified && res.message) {
          showToast(res.message);
        }
      });
    };

    runExpiryCheck();
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        runExpiryCheck();
      }
    };
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', runExpiryCheck);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', runExpiryCheck);
    };
  }, [user, showToast]);

  const hasActivePremiumAccess = isPaidPlanActive(user);

  const isAdminUser = user?.role === 'admin';
  const effectiveUnlockedIds = isAdminUser ? undefined : getEffectiveUsedRecipeIds(user, plans, recipes);
  const effectiveQuotaLimit = isAdminUser
    ? undefined
    : user
      ? getRecipeQuotaLimit(user.subscriptionPlan, plans)
      : FREE_RECIPE_LIMIT;

  const freeUnlockedIds = isAdminUser ? undefined : getUserFreeUnlockedIds(user, recipes);
  const premiumUnlockedIds = isAdminUser ? undefined : getUserPremiumUnlockedIds(user, recipes);
  const premiumQuotaLimit = isAdminUser ? undefined : getUserPremiumQuota(user, plans, recipes);

  const handleLogout = async () => {
    await signOut(auth);
    navigate({ page: 'home' });
    showToast('সফলভাবে লগআউট সম্পন্ন হয়েছে।');
  };

  const handleToggleFavorite = async (recipeId: string) => {
    if (!user) {
      navigate({ page: 'login' });
      showToast('প্রিয় রেসিপি সংরক্ষণ করতে অনুগ্রহ করে লগইন করুন।');
      return;
    }
    const updated = await toggleFavoriteRecipe(user.uid, user.favoriteRecipeIds, recipeId);
    setUser((prev) => (prev ? { ...prev, favoriteRecipeIds: updated } : prev));
    setInterestVersion((v) => v + 1);
  };

  const handleNotificationClick = async (notif: UserNotification) => {
    if (user && !notif.isRead) {
      markNotificationRead(user.uid, notif.id).catch(() => {});
    }
    if (notif.recipeId) {
      navigate({ page: 'recipe-detail', id: notif.recipeId });
    } else if (
      notif.type === 'payment_rejected' ||
      notif.type === 'free_limit_reached' ||
      notif.type === 'pro_limit_reached' ||
      notif.type === 'plan_expiry_reminder'
    ) {
      navigate({ page: 'pricing' });
    } else {
      navigate({ page: 'profile' });
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length > 0) {
      await markAllNotificationsRead(user.uid, unreadIds);
    }
  };

  const activeTab = routeToActiveTab(route);
  const favoriteRecipesList = user
    ? recipes.filter((r) => user.favoriteRecipeIds.includes(r.id))
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1A1A1A] pb-28 md:pb-0">
      {routeLoading && (
        <div
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-[70] h-[3px] bg-[#1B4D24]/15 overflow-hidden pointer-events-none"
        >
          <div className="h-full w-2/5 bg-gradient-to-r from-[#1B4D24] via-[#D4A017] to-[#B92B27] animate-route-slide" />
        </div>
      )}
      <Header
        siteName={siteSettings.siteName}
        activeTab={activeTab}
        onNavigate={navigateTab}
        user={user}
        onOpenAuth={() => {
          setPendingCheckoutPlanId(null);
          navigate({ page: 'login' });
        }}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        announcementText={siteSettings.announcementText}
        showAnnouncement={siteSettings.showAnnouncement}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        categories={categories}
        recipes={recipes}
        selectedCategory={route.page === 'category' ? route.categoryName : selectedFilter}
        onSelectCategory={navigateToCategory}
        freeUsedCount={freeUnlockedIds?.length}
        freeQuotaLimit={FREE_RECIPE_LIMIT}
        premiumUsedCount={premiumUnlockedIds?.length}
        premiumQuotaLimit={premiumQuotaLimit}
      />

      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 max-w-sm px-4 py-3 rounded-2xl bg-[#1B4D24] text-white text-sm font-semibold shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <main className="flex-1">
        {/* PAGE 1: HOME PAGE */}
        {route.page === 'home' && (
          <>
            {/* Mobile Category Strip directly below Top Bar */}
            <div className="md:hidden bg-[#FCFCFA] border-b border-gray-100">
              <CategoryStrip
                compact
                categories={categories}
                selectedCategory={selectedFilter}
                onSelectCategory={navigateToCategory}
              />
            </div>

            <HeroCarousel
              recipes={recipes}
              onSelectRecipe={(r) => navigate({ page: 'recipe-detail', id: r.id })}
            />

            {/* Mobile Primary Recipe Feed (10 newest recipes + 'সকল রেসিপি পেজে যান' button) */}
            <div className="md:hidden pb-5">
              <RecipeFeed
                recipes={recipes}
                selectedFilter={selectedFilter}
                onFilterChange={setSelectedFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectRecipe={(r) => navigate({ page: 'recipe-detail', id: r.id })}
                favoriteIds={user?.favoriteRecipeIds || []}
                onToggleFavorite={handleToggleFavorite}
                hasActiveSubscription={hasActivePremiumAccess}
                unlockedIds={effectiveUnlockedIds}
                quotaLimit={effectiveQuotaLimit}
                freeUnlockedIds={freeUnlockedIds}
                premiumUnlockedIds={premiumUnlockedIds}
                premiumQuotaLimit={premiumQuotaLimit}
                freeQuotaLimit={FREE_RECIPE_LIMIT}
                pageSize={10}
                currentPage={1}
                hidePagination
              />
              <div className="px-4 mt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setRecipesPage(1);
                    navigate({ page: 'recipes' });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
                >
                  সকল রেসিপি পেজে যান
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3-Column Subscription Plans on subtle spice line-art background */}
            <PricingSection
              plans={plans}
              currentTier={user?.subscriptionPlan}
              onSelectPlan={handleSelectPlan}
              showHeading
            />

            {/* Desktop Newest Recipes Feed (9 newest recipes + Minimal Category Strip + 'সকল রেসিপি পেজে যান' button) */}
            <div className="hidden md:block pb-10">
              <RecipeFeed
                recipes={recipes}
                selectedFilter="সব"
                onFilterChange={() => navigate({ page: 'recipes' })}
                searchQuery=""
                onSearchChange={(q) => {
                  setSearchQuery(q);
                  navigate({ page: 'recipes' });
                }}
                onSelectRecipe={(r) => navigate({ page: 'recipe-detail', id: r.id })}
                favoriteIds={user?.favoriteRecipeIds || []}
                onToggleFavorite={handleToggleFavorite}
                hasActiveSubscription={hasActivePremiumAccess}
                unlockedIds={effectiveUnlockedIds}
                quotaLimit={effectiveQuotaLimit}
                freeUnlockedIds={freeUnlockedIds}
                premiumUnlockedIds={premiumUnlockedIds}
                premiumQuotaLimit={premiumQuotaLimit}
                freeQuotaLimit={FREE_RECIPE_LIMIT}
                title="নতুন ও বাছাইকৃত রেসিপি"
                hideSearchAndFilters
                centerHeading
                pageSize={9}
                currentPage={1}
                hidePagination
                categorySlot={
                  <CategoryStrip
                    embedded
                    categories={categories}
                    selectedCategory={selectedFilter}
                    onSelectCategory={navigateToCategory}
                  />
                }
              />
              <div className="max-w-6xl mx-auto px-6 -mt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setRecipesPage(1);
                    navigate({ page: 'recipes' });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
                >
                  সকল রেসিপি পেজে যান
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* PAGE 2: ALL RECIPES PAGE */}
        {route.page === 'recipes' && (
          <RecipeFeed
            recipes={recipes}
            categories={categories}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            onSelectCategory={navigateToCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectRecipe={(r) => navigate({ page: 'recipe-detail', id: r.id })}
            favoriteIds={user?.favoriteRecipeIds || []}
            onToggleFavorite={handleToggleFavorite}
            hasActiveSubscription={hasActivePremiumAccess}
            unlockedIds={effectiveUnlockedIds}
            quotaLimit={effectiveQuotaLimit}
            freeUnlockedIds={freeUnlockedIds}
            premiumUnlockedIds={premiumUnlockedIds}
            premiumQuotaLimit={premiumQuotaLimit}
            freeQuotaLimit={FREE_RECIPE_LIMIT}
            title="সকল রেসিপি সংগ্রহ"
            hideSearchAndFilters
            centerHeading
            pageSize={10}
            desktopPageSize={9}
            currentPage={recipesPage}
            onPageChange={setRecipesPage}
          />
        )}

        {/* PAGE 2B: DEDICATED DYNAMIC CATEGORY PAGE */}
        {route.page === 'category' && (
          <CategoryPage
            categorySlug={route.categoryName}
            categories={categories}
            recipes={recipes}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectRecipe={(r) => navigate({ page: 'recipe-detail', id: r.id })}
            onSelectCategory={navigateToCategory}
            onNavigate={navigate}
            favoriteIds={user?.favoriteRecipeIds || []}
            onToggleFavorite={handleToggleFavorite}
            hasActiveSubscription={hasActivePremiumAccess}
            unlockedIds={effectiveUnlockedIds}
            quotaLimit={effectiveQuotaLimit}
            freeUnlockedIds={freeUnlockedIds}
            premiumUnlockedIds={premiumUnlockedIds}
            premiumQuotaLimit={premiumQuotaLimit}
            freeQuotaLimit={FREE_RECIPE_LIMIT}
            currentPage={categoryPageNum}
            onPageChange={setCategoryPageNum}
          />
        )}

        {/* PAGE 3: INDIVIDUAL RECIPE DETAIL PAGE */}
        {route.page === 'recipe-detail' && (
          <RecipeDetailPage
            recipe={recipes.find((r) => r.id === route.id)}
            allRecipes={recipes}
            user={user}
            hasAccess={hasActivePremiumAccess}
            isFavorite={Boolean(user?.favoriteRecipeIds.includes(route.id))}
            onToggleFavorite={handleToggleFavorite}
            onNavigate={navigate}
            onRecipeUnlocked={(unlockedIds) =>
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      unlockedRecipeIds: unlockedIds,
                    }
                  : prev
              )
            }
            onFreeRecipeUnlocked={(freeIds) =>
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      freeUnlockedRecipeIds: freeIds,
                    }
                  : prev
              )
            }
            onPremiumRecipeUnlocked={(premiumIds) =>
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      premiumUnlockedRecipeIds: premiumIds,
                    }
                  : prev
              )
            }
            onHistoryUpdated={(history) => {
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      viewedHistory: history,
                    }
                  : prev
              );
              setInterestVersion((v) => v + 1);
            }}
            onToast={showToast}
            plans={plans}
            siteSettings={siteSettings}
          />
        )}

        {/* PAGE 4: PRICING / MEMBERSHIP PAGE */}
        {route.page === 'pricing' && (
          <PricingSection
            plans={plans}
            currentTier={user?.subscriptionPlan}
            onSelectPlan={handleSelectPlan}
            showHeading
          />
        )}

        {/* PAGE 5: MANUAL TXID CHECKOUT PAGE */}
        {route.page === 'checkout' && (
          <CheckoutPage
            plan={plans.find((p) => p.id === route.planId)}
            user={user}
            siteSettings={siteSettings}
            onNavigate={navigate}
            onRequireAuth={(planId) => {
              setPendingCheckoutPlanId(planId);
              navigate({ page: 'login' });
            }}
            onOrderComplete={(status, planName) => {
              if (status === 'active') {
                showToast(`অভিনন্দন! ${planName} প্ল্যান সক্রিয় হয়েছে।`);
              } else {
                showToast('পেমেন্টের প্রমাণ জমা হয়েছে! এডমিন অনুমোদনের পর প্ল্যান সক্রিয় হবে।');
              }
            }}
          />
        )}

        {/* PAGE 6: TIPS PAGE */}
        {route.page === 'tips' && <TipsSection tips={tips} onNavigate={navigate} />}

        {/* PAGE 7: INDIVIDUAL TIP PAGE */}
        {route.page === 'tip-detail' && (
          <TipDetailPage
            tip={tips.find((t) => t.id === route.id)}
            onNavigate={navigate}
          />
        )}

        {/* PAGE 8: BLOG PAGE */}
        {route.page === 'blog' && <BlogSection posts={blogPosts} onNavigate={navigate} />}

        {/* PAGE 9: INDIVIDUAL BLOG ARTICLE PAGE */}
        {route.page === 'blog-detail' && (
          <BlogDetailPage
            post={blogPosts.find((p) => p.id === route.id)}
            onNavigate={navigate}
          />
        )}

        {/* PAGE 10: CONTACT PAGE */}
        {route.page === 'contact' && <ContactSection settings={siteSettings} />}

        {/* PAGE 11: FAVORITES PAGE */}
        {route.page === 'favorites' && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-2">
              আপনার প্রিয় রেসিপি
            </h1>
            {!user ? (
              <div className="mt-4 p-8 rounded-2xl bg-gray-50 border border-gray-200 text-center space-y-3">
                <p className="text-sm text-gray-700">
                  আপনার প্রিয় রেসিপি তালিকা দেখতে অনুগ্রহ করে লগইন করুন।
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'login' })}
                  className="px-5 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
                >
                  লগইন / নিবন্ধন পেজে যান
                </button>
              </div>
            ) : (
              <RecipeFeed
                recipes={favoriteRecipesList}
                selectedFilter="সব"
                onFilterChange={() => {}}
                searchQuery=""
                onSearchChange={() => {}}
                onSelectRecipe={(r) => navigate({ page: 'recipe-detail', id: r.id })}
                favoriteIds={user.favoriteRecipeIds}
                onToggleFavorite={handleToggleFavorite}
                hasActiveSubscription={hasActivePremiumAccess}
                unlockedIds={effectiveUnlockedIds}
                quotaLimit={effectiveQuotaLimit}
                freeUnlockedIds={freeUnlockedIds}
                premiumUnlockedIds={premiumUnlockedIds}
                premiumQuotaLimit={premiumQuotaLimit}
                freeQuotaLimit={FREE_RECIPE_LIMIT}
                title="সংরক্ষিত রেসিপি"
              />
            )}
          </section>
        )}

        {/* PAGE 12: LOGIN / SIGN UP PAGE */}
        {route.page === 'login' && (
          <AuthPage
            siteName={siteSettings.siteName}
            onNavigate={navigate}
            onProfileSynced={(profile) => setUser(profile)}
            pendingPlan={
              pendingCheckoutPlanId
                ? plans.find((p) => p.id === pendingCheckoutPlanId) || null
                : null
            }
          />
        )}

        {/* PAGE 13: PROFILE PAGE */}
        {route.page === 'profile' && (
          !authReady ? (
            <div className="min-h-[50vh] flex items-center justify-center px-4">
              <div className="w-8 h-8 rounded-full border-2 border-[#1B4D24]/20 border-t-[#1B4D24] animate-spin" />
            </div>
          ) : (
            <ProfileView
              user={user}
              recipes={recipes}
              plans={plans}
              siteSettings={siteSettings}
              notifications={notifications}
              onNotificationClick={handleNotificationClick}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onLogout={handleLogout}
              onNavigate={navigate}
              onPhotoUpdated={(photoURL) =>
                setUser((prev) => (prev ? { ...prev, photoURL } : prev))
              }
            />
          )
        )}

        {/* PAGE 14: ADMIN PANEL PAGE */}
        {route.page === 'admin' && (
          !authReady ? (
            <div className="min-h-[50vh] flex items-center justify-center px-4">
              <div className="w-8 h-8 rounded-full border-2 border-[#1B4D24]/20 border-t-[#1B4D24] animate-spin" />
            </div>
          ) : !user ? (
            <AuthPage
              siteName={siteSettings.siteName}
              onNavigate={navigate}
              onProfileSynced={(profile) => setUser(profile)}
            />
          ) : (
            <AdminPanel
              currentUser={user}
              recipes={recipes}
              categories={categories}
              plans={plans}
              tips={tips}
              blogPosts={blogPosts}
              siteSettings={siteSettings}
              onNavigate={navigate}
            />
          )
        )}
      </main>

      {/* Desktop Quiet Footer */}
      <footer className="hidden md:block border-t border-gray-100 bg-[#FAFAF8] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <BrandMark siteName={siteSettings.siteName} compact />
            <span className="text-xs text-gray-500">{siteSettings.tagline}</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium text-gray-600">
            <button type="button" onClick={() => navigate({ page: 'recipes' })} className="hover:text-[#B92B27] cursor-pointer">
              রেসিপি
            </button>
            <button type="button" onClick={() => navigate({ page: 'tips' })} className="hover:text-[#B92B27] cursor-pointer">
              টিপস
            </button>
            <button type="button" onClick={() => navigate({ page: 'pricing' })} className="hover:text-[#B92B27] cursor-pointer">
              সদস্যপদ
            </button>
            <button type="button" onClick={() => navigate({ page: 'blog' })} className="hover:text-[#B92B27] cursor-pointer">
              ব্লগ
            </button>
            <button type="button" onClick={() => navigate({ page: 'contact' })} className="hover:text-[#B92B27] cursor-pointer">
              যোগাযোগ
            </button>
          </div>

          <p className="text-xs text-gray-500">
            {siteSettings.footerNote || '© ২০২৬ রান্না শিখুন — সর্বস্বত্ব সংরক্ষিত।'}
          </p>
        </div>
      </footer>

      {/* Mobile Personalized Swipeable Interest Strip + Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onNavigate={navigateTab}
        selectedFilter={route.page === 'category' ? route.categoryName : selectedFilter}
        onFilterChange={(nextFilter) => {
          if (route.page === 'recipes' || route.page === 'category') {
            if (nextFilter === 'সব' || nextFilter === 'প্রিমিয়াম' || nextFilter === 'বিনামূল্যে') {
              setSelectedFilter(nextFilter);
              if (route.page === 'category') {
                navigate({ page: 'recipes' });
              }
            } else {
              navigateToCategory(nextFilter);
            }
          } else {
            setSelectedFilter(nextFilter);
          }
        }}
        showFilterStrip={route.page === 'home' || route.page === 'recipes' || route.page === 'category'}
        categories={categories}
        recipes={recipes}
        user={user}
        interestVersion={interestVersion}
      />
    </div>
  );
}
