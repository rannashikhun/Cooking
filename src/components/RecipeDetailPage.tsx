import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { FONT_SIZE_OPTIONS, RECIPE_FONT_OPTIONS, SEED_RECIPES } from '../data/seedData';
import {
  ArrowLeft,
  CheckSquare,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerDownRight,
  Crown,
  Heart,
  MessageSquare,
  Reply,
  Send,
  Share2,
  Square,
  Star,
  Trash2,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import { db } from '../firebase';
import {
  GUEST_READS_KEY,
  addRecipeComment,
  deleteRecipeComment,
  fetchRecipeContent,
  getEffectiveUsedRecipeIds,
  getRecipeQuotaLimit,
  recordRecipeUnlock,
  recordRecipeViewHistory,
  saveLocalRecipeRead,
} from '../services/firestoreService';
import { shareCurrentPage } from '../utils/seoMeta';
import type {
  FontSizeKey,
  PageRoute,
  Recipe,
  RecipeComment,
  RecipeContent,
  RecipeFontKey,
  RecipeHistoryEntry,
  SiteSettings,
  SubscriptionPlan,
  UserProfile,
} from '../types';

interface RecipeDetailPageProps {
  recipe: Recipe | undefined;
  allRecipes: Recipe[];
  user: UserProfile | null;
  hasAccess: boolean;
  isFavorite: boolean;
  onToggleFavorite: (recipeId: string) => void;
  onNavigate: (route: PageRoute) => void;
  onRecipeUnlocked: (unlockedIds: string[]) => void;
  onHistoryUpdated?: (history: RecipeHistoryEntry[]) => void;
  plans: SubscriptionPlan[];
  siteSettings?: SiteSettings;
}

const VALID_RECIPE_FONT_KEYS = new Set<RecipeFontKey>(
  RECIPE_FONT_OPTIONS.map((opt) => opt.key)
);

const VALID_FONT_SIZE_KEYS = new Set<FontSizeKey>(
  FONT_SIZE_OPTIONS.map((opt) => opt.key)
);

function resolveRecipeFontKey(key?: string): RecipeFontKey {
  if (key && VALID_RECIPE_FONT_KEYS.has(key as RecipeFontKey)) {
    return key as RecipeFontKey;
  }
  return 'bensen';
}

function resolveFontSizeKey(key?: string): FontSizeKey {
  if (key && VALID_FONT_SIZE_KEYS.has(key as FontSizeKey)) {
    return key as FontSizeKey;
  }
  return 'md';
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

function formatBengaliCommentDate(ts: unknown): string {
  try {
    let date: Date | null = null;
    if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      date = (ts as { toDate: () => Date }).toDate();
    }
    if (!date) return 'এইমাত্র';
    return date.toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'সাম্প্রতিক';
  }
}

export const RecipeDetailPage: React.FC<RecipeDetailPageProps> = ({
  recipe,
  allRecipes,
  user,
  hasAccess,
  isFavorite,
  onToggleFavorite,
  onNavigate,
  onRecipeUnlocked,
  onHistoryUpdated,
  plans,
  siteSettings,
}) => {
  const desktopFontKey = resolveRecipeFontKey(siteSettings?.recipeFontDesktop);
  const mobileFontKey = resolveRecipeFontKey(siteSettings?.recipeFontMobile);
  const desktopFontSizeKey = resolveFontSizeKey(siteSettings?.recipeFontSizeDesktop);
  const mobileFontSizeKey = resolveFontSizeKey(siteSettings?.recipeFontSizeMobile);
  const recipeFontScopeClass = `rf-m-${mobileFontKey} rf-pc-${desktopFontKey} rf-size-scope rf-size-m-${mobileFontSizeKey} rf-size-pc-${desktopFontSizeKey}`;
  const [content, setContent] = useState<RecipeContent | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockReason, setLockReason] = useState<'premium' | 'quota_basic' | 'quota_paid' | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [brokenStepImages, setBrokenStepImages] = useState<Record<number, boolean>>({});
  const [guestTick, setGuestTick] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  // Comments & threaded replies state
  const [comments, setComments] = useState<RecipeComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{
    targetCommentId: string;
    parentCommentId: string;
    replyToUid: string;
    replyToName: string;
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
    label?: string;
    caption?: string;
    stepIdx?: number;
  } | null>(null);
  const [lightboxDirection, setLightboxDirection] = useState<'next' | 'prev' | 'fade'>('fade');

  const isAdmin = user?.role === 'admin';
  const currentQuotaLimit = user
    ? getRecipeQuotaLimit(user.subscriptionPlan, plans)
    : 10;

  const effectiveUsedIds = useMemo(
    () => getEffectiveUsedRecipeIds(user, plans),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.uid, user?.role, user?.subscriptionPlan, user?.unlockedRecipeIds, plans, guestTick]
  );
  const usedQuotaCount = effectiveUsedIds.length;

  useEffect(() => {
    if (!recipe) return;
    let active = true;
    let unsubContent: (() => void) | null = null;
    setLoading(true);
    setCheckedIngredients({});
    setBrokenStepImages({});

    const attachLiveContentListener = (alreadyUnlocked: boolean, currentUsedLen: number, limit: number) => {
      const contentRef = doc(db, 'recipes', recipe.id, 'content', 'detail');
      unsubContent = onSnapshot(
        contentRef,
        (snap) => {
          if (!active) return;
          if (snap.exists()) {
            setContent(snap.data() as RecipeContent);
            setLocked(false);
            setLockReason(null);
          } else {
            const localSeed = SEED_RECIPES.find((r) => r.recipe.id === recipe.id);
            setContent(localSeed ? localSeed.content : null);
            setLocked(false);
            setLockReason(null);
          }
          setLoading(false);
        },
        () => {
          if (!active) return;
          const localSeed = SEED_RECIPES.find((r) => r.recipe.id === recipe.id);
          if (localSeed && (!recipe.isPremium || hasAccess || isAdmin)) {
            setContent(localSeed.content);
            setLocked(false);
            setLockReason(null);
          } else {
            setContent(null);
            setLocked(true);
            setLockReason(
              !alreadyUnlocked && currentUsedLen >= limit
                ? user && user.subscriptionPlan !== 'basic'
                  ? 'quota_paid'
                  : 'quota_basic'
                : 'premium'
            );
          }
          setLoading(false);
        }
      );
    };

    const evaluateAccessAndFetch = async () => {
      // 1. Admin always has unlimited access
      if (isAdmin) {
        setLockReason(null);
        const res = await fetchRecipeContent(recipe.id, recipe.isPremium, true);
        if (!active) return;
        setContent(res.content);
        setLocked(res.locked);
        setLoading(false);
        if (!res.locked && user) {
          recordRecipeViewHistory(user.uid, user.viewedHistory || [], recipe.id).then((hist) => {
            if (active) onHistoryUpdated?.(hist);
          });
        }
        attachLiveContentListener(true, 0, 999);
        return;
      }

      // 2. Check premium access
      if (recipe.isPremium && !hasAccess) {
        setContent(null);
        setLocked(true);
        setLockReason('premium');
        setLoading(false);
        return;
      }

      // 3. Enforce strict 1-month recipe quota (Basic: 10, Standard: 10, Pro: 25)
      const currentUsed = getEffectiveUsedRecipeIds(user, plans);
      const alreadyUnlocked = currentUsed.includes(recipe.id);
      const limit = user ? getRecipeQuotaLimit(user.subscriptionPlan, plans) : 10;

      if (!alreadyUnlocked && currentUsed.length >= limit) {
        setContent(null);
        setLocked(true);
        setLockReason(user && user.subscriptionPlan !== 'basic' ? 'quota_paid' : 'quota_basic');
        setLoading(false);
        return;
      }

      // 4. Record unlock BEFORE fetching protected content so Firestore rules & profile quota stay exact
      if (!alreadyUnlocked) {
        if (user) {
          const updatedIds = await recordRecipeUnlock(
            user.uid,
            currentUsed,
            recipe.id,
            user.subscriptionPlan
          );
          if (!active) return;
          onRecipeUnlocked(updatedIds);
        } else {
          saveLocalRecipeRead(recipe.id, GUEST_READS_KEY, 10);
          if (active) setGuestTick((t) => t + 1);
        }
      }

      const res = await fetchRecipeContent(recipe.id, recipe.isPremium, hasAccess || !recipe.isPremium);
      if (!active) return;

      if (res.locked) {
        setContent(null);
        setLocked(true);
        setLockReason(
          !alreadyUnlocked && currentUsed.length >= limit
            ? user && user.subscriptionPlan !== 'basic'
              ? 'quota_paid'
              : 'quota_basic'
            : 'premium'
        );
        setLoading(false);
        return;
      }

      setContent(res.content);
      setLocked(false);
      setLockReason(null);
      setLoading(false);

      if (user) {
        recordRecipeViewHistory(user.uid, user.viewedHistory || [], recipe.id).then((hist) => {
          if (active) onHistoryUpdated?.(hist);
        });
      }

      attachLiveContentListener(alreadyUnlocked, currentUsed.length, limit);
    };

    evaluateAccessAndFetch().catch(() => {
      if (!active) return;
      setContent(null);
      setLocked(true);
      setLockReason(recipe.isPremium && !hasAccess ? 'premium' : 'quota_basic');
      setLoading(false);
    });

    return () => {
      active = false;
      if (unsubContent) unsubContent();
    };
  }, [recipe?.id, recipe?.isPremium, hasAccess, isAdmin, user?.uid, user?.subscriptionPlan, plans]);

  // Real-time comments listener
  useEffect(() => {
    if (!recipe) {
      setComments([]);
      return;
    }
    const q = query(
      collection(db, 'recipes', recipe.id, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<RecipeComment, 'id'>),
          }))
        );
      },
      () => {
        setComments([]);
      }
    );
    return () => unsub();
  }, [recipe?.id]);

  // Suggest 4 posts in the same category (fill from other recipes if needed)
  const relatedRecipes = useMemo(() => {
    if (!recipe) return [];
    const sameCategory = allRecipes.filter(
      (r) => r.id !== recipe.id && r.category === recipe.category
    );
    const others = allRecipes.filter(
      (r) => r.id !== recipe.id && r.category !== recipe.category
    );
    return [...sameCategory, ...others].slice(0, 4);
  }, [allRecipes, recipe]);

  const threadedComments = useMemo(() => {
    const parentIds = new Set(comments.filter((c) => !c.parentCommentId).map((c) => c.id));
    const topLevel = comments.filter((c) => !c.parentCommentId || !parentIds.has(c.parentCommentId));
    const repliesByParent: Record<string, RecipeComment[]> = {};
    for (const c of comments) {
      if (c.parentCommentId && parentIds.has(c.parentCommentId)) {
        if (!repliesByParent[c.parentCommentId]) {
          repliesByParent[c.parentCommentId] = [];
        }
        repliesByParent[c.parentCommentId].push(c);
      }
    }
    for (const key of Object.keys(repliesByParent)) {
      repliesByParent[key] = [...repliesByParent[key]].reverse();
    }
    return { topLevel, repliesByParent };
  }, [comments]);

  const stepImageGallery = useMemo(() => {
    if (!recipe || !content) return [];
    const items: Array<{ src: string; alt: string; label: string; caption: string; stepIdx: number }> = [];
    content.steps.forEach((step, idx) => {
      const stepImg = content.stepImages?.[idx]?.trim();
      if (stepImg && !brokenStepImages[idx]) {
        items.push({
          src: stepImg,
          alt: `${recipe.title} — ধাপ ${toBengaliDigits(idx + 1)}`,
          label: `ধাপ ${toBengaliDigits(idx + 1)}`,
          caption: step,
          stepIdx: idx,
        });
      }
    });
    return items;
  }, [recipe, content, brokenStepImages]);

  const navigateLightboxStep = (direction: 'next' | 'prev') => {
    if (
      !lightboxImage ||
      lightboxImage.stepIdx === undefined ||
      stepImageGallery.length <= 1
    ) {
      return;
    }
    const currentPos = stepImageGallery.findIndex(
      (item) => item.stepIdx === lightboxImage.stepIdx
    );
    if (currentPos === -1) return;
    const delta = direction === 'next' ? 1 : -1;
    const targetPos = (currentPos + delta + stepImageGallery.length) % stepImageGallery.length;
    setLightboxDirection(direction);
    setLightboxImage(stepImageGallery[targetPos]);
  };

  useEffect(() => {
    if (!lightboxImage || lightboxImage.stepIdx === undefined || stepImageGallery.length <= 1) {
      return;
    }
    const currentPos = stepImageGallery.findIndex(
      (item) => item.stepIdx === lightboxImage.stepIdx
    );
    if (currentPos === -1) return;
    const nextItem = stepImageGallery[(currentPos + 1) % stepImageGallery.length];
    const prevItem =
      stepImageGallery[(currentPos - 1 + stepImageGallery.length) % stepImageGallery.length];
    [nextItem, prevItem].forEach((item) => {
      if (item?.src) {
        const preload = new Image();
        preload.referrerPolicy = 'no-referrer';
        preload.src = item.src;
      }
    });
  }, [lightboxImage, stepImageGallery]);

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      } else if (e.key === 'ArrowRight') {
        navigateLightboxStep('next');
      } else if (e.key === 'ArrowLeft') {
        navigateLightboxStep('prev');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, stepImageGallery]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe || !user) return;
    if (commentText.trim().length < 2) {
      setCommentError('কমপক্ষে ২ অক্ষরের মন্তব্য লিখুন।');
      return;
    }
    setCommentError(null);
    setCommentLoading(true);
    try {
      await addRecipeComment(recipe.id, user, commentText);
      setCommentText('');
    } catch {
      setCommentError('মন্তব্য পোস্ট করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe || !user || !replyTarget) return;
    if (replyText.trim().length < 2) {
      setCommentError('কমপক্ষে ২ অক্ষরের রিপ্লাই লিখুন।');
      return;
    }
    setCommentError(null);
    setReplyLoading(true);
    try {
      await addRecipeComment(recipe.id, user, replyText, {
        recipeTitle: recipe.title,
        parentCommentId: replyTarget.parentCommentId,
        replyToUid: replyTarget.replyToUid,
        replyToName: replyTarget.replyToName,
      });
      setReplyText('');
      setReplyTarget(null);
    } catch {
      setCommentError('রিপ্লাই পাঠানো যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setReplyLoading(false);
    }
  };

  if (!recipe) {
    return (
      <section className="font-book-bn max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display-bn text-2xl font-bold text-[#1A1A1A]">
          রেসিপি খুঁজে পাওয়া যায়নি
        </h1>
        <button
          type="button"
          onClick={() => onNavigate({ page: 'recipes' })}
          className="px-5 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
        >
          সব রেসিপিতে ফিরে যান
        </button>
      </section>
    );
  }

  const paidPlans = plans.filter((p) => p.tier !== 'basic' && p.isActive);

  return (
    <article className={`font-book-bn ${recipeFontScopeClass} max-w-4xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8 space-y-6`}>
      {/* Top Quiet Diary Navigation Row */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'recipes' })}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5A5044] hover:text-[#1B4D24] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>সব রেসিপিতে ফিরুন</span>
        </button>

        <div className="flex items-center gap-2">
          {siteSettings?.showRecipeShareButton !== false && (
            <button
              type="button"
              onClick={async () => {
                const res = await shareCurrentPage({
                  title: recipe.title,
                  text: recipe.subtitle,
                });
                if (res === 'copied') {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2400);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2DAC6] bg-[#FCF9F2] hover:bg-[#F5EFE1] text-[#3D352B] text-xs font-bold cursor-pointer transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#1B4D24]" />
              <span>{shareCopied ? 'লিংক কপি হয়েছে' : 'শেয়ার করুন'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite(recipe.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
              isFavorite
                ? 'border-[#B92B27]/40 bg-[#B92B27]/8 text-[#B92B27]'
                : 'border-[#E2DAC6] bg-[#FCF9F2] hover:bg-[#F5EFE1] text-[#3D352B]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#B92B27] text-[#B92B27]' : ''}`} />
            <span>{isFavorite ? 'প্রিয় তালিকায় আছে' : 'প্রিয়তে রাখুন'}</span>
          </button>
        </div>
      </div>

      {/* Main Minimal Diary Sheet */}
      <div className="relative bg-[#FCF9F2] rounded-2xl sm:rounded-3xl border border-[#E4DCC8] shadow-xs overflow-hidden">
        {/* Subtle Vertical Diary Margin Line (Desktop) */}
        <div
          aria-hidden="true"
          className="hidden sm:block absolute top-0 bottom-0 left-9 w-px bg-[#B92B27]/15 pointer-events-none"
        />

        <div className="px-4 sm:pl-14 sm:pr-9 py-6 sm:py-8 space-y-6">
          {/* Diary Entry Header: Clean Metadata + Title + Subtitle */}
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#6D6254]">
              <button
                type="button"
                onClick={() => onNavigate({ page: 'category', categoryName: recipe.category })}
                className="text-[#1B4D24] hover:underline cursor-pointer"
              >
                {recipe.category}
              </button>
              <span aria-hidden="true" className="text-[#C7BFA9]">·</span>
              <span className={recipe.isPremium ? 'text-[#A66E00]' : 'text-[#1B4D24]'}>
                {recipe.isPremium ? 'প্রিমিয়াম (১০ টাকা)' : 'বিনামূল্যে'}
              </span>
              <span aria-hidden="true" className="text-[#C7BFA9]">·</span>
              <span>{recipe.cuisine || 'বাঙ্গালি'}</span>
              <span aria-hidden="true" className="text-[#C7BFA9]">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums text-[#4A4136]">
                <Star className="w-3.5 h-3.5 fill-[#E5B83B] text-[#E5B83B]" />
                {toBengaliDigits(recipe.rating.toFixed(1))} ({toBengaliDigits(recipe.ratingCount)})
              </span>
            </div>

            <h1 className="font-recipe-diary-heading text-[28px] sm:text-[40px] text-[#1F1A14] leading-[1.35] text-balance">
              {recipe.title}
            </h1>

            {recipe.subtitle && (
              <p className="font-recipe-diary text-[17px] sm:text-[19px] text-[#453C32] leading-[1.9] max-w-2xl">
                {recipe.subtitle}
              </p>
            )}
          </header>

          {/* Mounted Hero Photograph (Unobstructed, clickable for 16:9 Diary Viewer) */}
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-[#F3EDE0] border border-[#E4DCC8] group">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              referrerPolicy="no-referrer"
              loading="eager"
              decoding="async"
              onClick={() => {
                setLightboxDirection('fade');
                setLightboxImage({
                  src: recipe.imageUrl,
                  alt: recipe.title,
                  label: recipe.category,
                  caption: recipe.title,
                });
              }}
              className="w-full h-44 sm:h-56 md:h-64 object-cover block cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
            />
            <button
              type="button"
              onClick={() => {
                setLightboxDirection('fade');
                setLightboxImage({
                  src: recipe.imageUrl,
                  alt: recipe.title,
                  label: recipe.category,
                  caption: recipe.title,
                });
              }}
              aria-label="ছবি বড় করে দেখুন"
              className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/55 hover:bg-black/75 text-white text-[11px] font-semibold backdrop-blur-xs transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ভিউ</span>
            </button>
          </div>

          {/* Minimal Ruled Recipe Summary Strip */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-y border-[#E8E0CD] text-sm">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#1B4D24] shrink-0" />
              <div>
                <dt className="text-[11px] text-[#7A6F60]">রান্নার সময়</dt>
                <dd className="font-semibold text-[#1F1A14]">{recipe.cookTime}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-[#B92B27] shrink-0" />
              <div>
                <dt className="text-[11px] text-[#7A6F60]">পরিবেশন</dt>
                <dd className="font-semibold text-[#1F1A14]">{recipe.servings || '৪ জন'}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <ChefHat className="w-4 h-4 text-[#B8860B] shrink-0" />
              <div>
                <dt className="text-[11px] text-[#7A6F60]">কঠিন্য</dt>
                <dd className="font-semibold text-[#1F1A14]">{recipe.difficulty}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 fill-[#E5B83B] text-[#E5B83B] shrink-0" />
              <div>
                <dt className="text-[11px] text-[#7A6F60]">পাঠক রেটিং</dt>
                <dd className="font-semibold text-[#1F1A14] tabular-nums">
                  {toBengaliDigits(recipe.rating.toFixed(1))} ({toBengaliDigits(recipe.ratingCount)})
                </dd>
              </div>
            </div>
          </dl>

          {/* Quota Status Line for Non-Admins */}
          {!isAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-[#F5EFE1]/80 border border-[#E6DEC8] text-xs text-[#4A4136]">
              <span>
                সদস্যপদ কোটা:{' '}
                <strong className="text-[#1B4D24] tabular-nums">
                  {toBengaliDigits(Math.min(usedQuotaCount, currentQuotaLimit))} / {toBengaliDigits(currentQuotaLimit)}টি রেসিপি
                </strong>{' '}
                ব্যবহৃত (১ মাসের প্যাক)
              </span>
              <button
                type="button"
                onClick={() => onNavigate({ page: 'pricing' })}
                className="font-bold text-[#B92B27] hover:underline cursor-pointer"
              >
                প্ল্যান দেখুন / আপগ্রেড →
              </button>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center text-sm text-[#7A6F60]">
              ডায়েরীর পাতা লোড হচ্ছে...
            </div>
          )}

          {/* Lock Screen: Premium OR Quota Reached */}
          {!loading && locked && (
            <div className="rounded-2xl border border-[#D4A017]/50 bg-[#FFFDF6] p-6 sm:p-9 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#E5B83B]/20 text-[#9A6E04] flex items-center justify-center">
                <Crown className="w-6 h-6" />
              </div>
              <h2 className="font-display-bn text-xl sm:text-2xl font-bold text-[#1F1A14]">
                {lockReason === 'quota_basic'
                  ? 'আপনার ফ্রি ১০টি রেসিপির সীমা পূর্ণ হয়েছে'
                  : lockReason === 'quota_paid'
                    ? 'আপনার এই মাসের রেসিপি কোটা পূর্ণ হয়েছে'
                    : 'এটি একটি প্রিমিয়াম রেসিপি'}
              </h2>
              <p className="text-sm text-[#5A5044] max-w-md mx-auto leading-relaxed">
                {lockReason === 'quota_basic'
                  ? 'বেসিক প্ল্যানে ১০টি রেসিপি ফ্রিতে শেখা যায়। নতুন রেসিপি ওপেন করতে ১ মাসের স্ট্যান্ডার্ড (১০০ টাকা — ১০টি রেসিপি) অথবা প্রো অফার (২০০ টাকা — ২৫টি রেসিপি) প্ল্যান নিন।'
                  : lockReason === 'quota_paid'
                    ? 'আপনার বর্তমান ১ মাসের প্যাকেজের সব রেসিপি ব্যবহার হয়ে গেছে। আরও ২৫টি রেসিপি শিখতে প্রো অফার প্যাকেজ (২০০ টাকা/মাস) বা নতুন প্যাকেজ অ্যাক্টিভেট করুন।'
                    : 'প্রতি প্রিমিয়াম রেসিপি মাত্র ১০ টাকা হিসেবে ছবিসহ ধাপে ধাপে রান্নার নির্দেশনা আনলক করতে স্ট্যান্ডার্ড বা প্রো সাবস্ক্রিপশন নিন।'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 max-w-lg mx-auto">
                {paidPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => onNavigate({ page: 'checkout', planId: plan.id })}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                      plan.tier === 'pro'
                        ? 'border-[#B92B27] bg-[#B92B27] text-white hover:bg-[#9E221F]'
                        : 'border-[#D4A017] bg-[#D4A017] text-[#1A1A1A] hover:bg-[#C39212]'
                    }`}
                  >
                    <p className="text-base font-bold">{plan.name} প্ল্যান (১ মাস)</p>
                    <p className="text-xs opacity-90 mt-0.5 tabular-nums">
                      {plan.priceLabel} · {toBengaliDigits(plan.recipeLimit || (plan.tier === 'pro' ? 25 : 10))}টি রেসিপি
                    </p>
                    <p className="text-xs font-bold underline mt-2">সাবস্ক্রাইব করুন →</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Diary Body: Ingredients (Side-by-Side Above) + Full-Width Step-by-Step Diary Entries */}
          {!loading && !locked && content && (
            <div className="space-y-8 pt-1">
              {/* 01. Ingredients Checklist Section (Side-by-Side Above Steps) */}
              <section className="space-y-3.5">
                <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-dashed border-[#DFD6C0]">
                  <h2 className="font-recipe-diary-heading text-[22px] sm:text-[26px] text-[#1F1A14]">
                    প্রয়োজনীয় উপকরণ
                  </h2>
                  <span className="font-sans text-xs font-medium text-[#7A6F60] tabular-nums">
                    মোট {toBengaliDigits(content.ingredients.length)}টি উপকরণ
                  </span>
                </div>

                <ul className="flex flex-wrap gap-2 sm:gap-2.5">
                  {content.ingredients.map((item, idx) => {
                    const checked = Boolean(checkedIngredients[idx]);
                    return (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={() =>
                            setCheckedIngredients((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className={`inline-flex items-start gap-2 text-left px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#EEF5EF] border-[#1B4D24]/30'
                              : 'bg-[#F6F1E4]/75 hover:bg-[#EFE8D5] border-[#E4DCC8]'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-[#1B4D24] shrink-0 mt-1" />
                          ) : (
                            <Square className="w-4 h-4 text-[#8C8070] shrink-0 mt-1" />
                          )}
                          <span
                            className={`font-recipe-diary text-[16px] sm:text-[17.5px] leading-snug ${
                              checked ? 'line-through text-[#8C8070]' : 'text-[#241E17]'
                            }`}
                          >
                            {item}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* 02. Full-Width Diary Step-by-Step Instructions */}
              <section className="space-y-5">
                <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-dashed border-[#DFD6C0]">
                  <h2 className="font-recipe-diary-heading text-[22px] sm:text-[26px] text-[#1F1A14]">
                    প্রস্তুত প্রণালী (ধাপে ধাপে)
                  </h2>
                  <span className="font-sans text-xs font-medium text-[#7A6F60] tabular-nums">
                    {toBengaliDigits(content.steps.length)}টি ধাপ
                  </span>
                </div>

                <ol className="divide-y divide-dashed divide-[#E3DBC6]">
                  {content.steps.map((step, idx) => {
                    const stepImg = content.stepImages?.[idx]?.trim();
                    const showStepImg = Boolean(stepImg && !brokenStepImages[idx]);

                    return (
                      <li
                        key={idx}
                        className="py-6 first:pt-2 last:pb-2 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-recipe-diary-heading text-base sm:text-lg tracking-wide text-[#1B4D24] tabular-nums">
                            ধাপ {toBengaliDigits(idx + 1)}
                          </span>
                        </div>

                        {showStepImg && (
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxDirection('fade');
                              setLightboxImage({
                                src: stepImg!,
                                alt: `${recipe.title} — ধাপ ${toBengaliDigits(idx + 1)}`,
                                label: `ধাপ ${toBengaliDigits(idx + 1)}`,
                                caption: step,
                                stepIdx: idx,
                              });
                            }}
                            aria-label={`ধাপ ${toBengaliDigits(idx + 1)} ছবি বড় করে দেখুন`}
                            className="group relative block w-full rounded-xl overflow-hidden border border-[#E4DCC8] bg-[#F3EDE0] cursor-zoom-in text-left focus-visible:outline-2 focus-visible:outline-[#1B4D24]"
                          >
                            <img
                              src={stepImg}
                              alt={`${recipe.title} — ধাপ ${toBengaliDigits(idx + 1)}`}
                              referrerPolicy="no-referrer"
                              loading="eager"
                              decoding="async"
                              onError={() =>
                                setBrokenStepImages((prev) => ({ ...prev, [idx]: true }))
                              }
                              className="w-full aspect-video sm:aspect-auto sm:h-56 md:h-64 object-cover block transition-transform duration-300 group-hover:scale-[1.012]"
                            />
                            <span className="font-sans absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/55 group-hover:bg-black/75 text-white text-[11px] font-semibold backdrop-blur-xs shadow-sm transition-colors">
                              <ZoomIn className="w-3 h-3" />
                              <span>ভিউ</span>
                            </span>
                          </button>
                        )}

                        <p className="font-recipe-diary text-[17.5px] sm:text-[19px] font-normal text-[#241E17] leading-[34px] bg-[repeating-linear-gradient(transparent,transparent_33px,#EFE8D6_34px)]">
                          {step}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {/* Chef's Diary Postscript Note */}
              {content.chefTip && (
                <aside className="p-5 sm:p-6 rounded-2xl bg-[#F1F6EF] border border-[#1B4D24]/20 space-y-1.5">
                  <p className="font-recipe-diary-heading text-base text-[#1B4D24]">শেফের বিশেষ টিপস</p>
                  <p className="font-recipe-diary text-[16.5px] sm:text-[18px] text-[#241E17] leading-[1.9]">
                    {content.chefTip}
                  </p>
                </aside>
              )}
            </div>
          )}
        </div>
      </div>

      {/* COMMENTS SECTION BELOW DIARY SHEET */}
      <section className="bg-[#FCF9F2] rounded-2xl sm:rounded-3xl border border-[#E4DCC8] p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-[#E4DCC8]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4.5 h-4.5 text-[#1B4D24]" />
            <h2 className="font-display-bn text-lg sm:text-xl font-bold text-[#1F1A14]">
              মন্তব্য ও মতামত ({toBengaliDigits(comments.length)})
            </h2>
          </div>
        </div>

        {!user ? (
          <div className="p-4 rounded-xl bg-[#F5EFE1]/70 border border-[#E4DCC8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-[#4A4136]">
              এই রেসিপি সম্পর্কে মন্তব্য করতে অনুগ্রহ করে লগইন করুন।
            </p>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'login' })}
              className="px-4 py-2 rounded-xl bg-[#1B4D24] text-white text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              লগইন করুন
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <textarea
              rows={3}
              required
              minLength={2}
              maxLength={1000}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="রেসিপিটি কেমন লাগলো বা কোনো প্রশ্ন থাকলে এখানে লিখুন..."
              className="w-full px-4 py-3 text-sm bg-white/90 border border-[#DFD6C0] rounded-xl focus:outline-none focus:border-[#1B4D24]"
            />
            {commentError && <p className="text-xs text-red-600">{commentError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={commentLoading}
                className="px-5 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                {commentLoading ? 'পোস্ট হচ্ছে...' : 'মন্তব্য পোস্ট করুন'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4 pt-2 border-t border-dashed border-[#E4DCC8]">
          {threadedComments.topLevel.length === 0 ? (
            <p className="text-sm text-[#7A6F60] py-2">
              এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্যটি আপনিই করুন!
            </p>
          ) : (
            threadedComments.topLevel.map((cmt) => {
              const canDelete = user && (user.role === 'admin' || user.uid === cmt.authorUid);
              const replies = threadedComments.repliesByParent[cmt.id] || [];
              const isReplyingHere = replyTarget?.targetCommentId === cmt.id;

              return (
                <div key={cmt.id} className="space-y-2.5">
                  <div className="p-4 rounded-xl bg-white/80 border border-[#E8E0CD] flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {cmt.authorPhotoUrl ? (
                        <img
                          src={cmt.authorPhotoUrl}
                          alt={cmt.authorName}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#1B4D24]/15 text-[#1B4D24] flex items-center justify-center text-sm font-bold shrink-0">
                          {cmt.authorName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-[#1F1A14]">{cmt.authorName}</span>
                          <span aria-hidden="true" className="text-[#B8AE9E]">·</span>
                          <span className="text-[#7A6F60]">{formatBengaliCommentDate(cmt.createdAt)}</span>
                        </div>
                        <p className="text-sm text-[#2D2720] mt-1 leading-relaxed break-words">
                          {cmt.text}
                        </p>
                        {user && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTarget({
                                  targetCommentId: cmt.id,
                                  parentCommentId: cmt.id,
                                  replyToUid: cmt.authorUid,
                                  replyToName: cmt.authorName,
                                });
                                setReplyText('');
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#1B4D24] hover:underline cursor-pointer"
                            >
                              <Reply className="w-3.5 h-3.5" />
                              রিপ্লাই দিন
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteRecipeComment(recipe.id, cmt.id)}
                        aria-label="মন্তব্য মুছুন"
                        className="p-1.5 text-[#8C8070] hover:text-red-600 rounded-lg cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Inline reply composer for top-level comment */}
                  {isReplyingHere && user && (
                    <form
                      onSubmit={handleSubmitReply}
                      className="ml-6 sm:ml-10 p-3.5 rounded-xl bg-[#F1F6EF] border border-[#1B4D24]/20 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-[#1B4D24]">
                        <span>@{replyTarget.replyToName}-কে রিপ্লাই দিচ্ছেন</span>
                        <button
                          type="button"
                          onClick={() => setReplyTarget(null)}
                          className="text-[#6D6254] hover:text-[#1F1A14] p-0.5 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={1000}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="আপনার উত্তর লিখুন..."
                          className="flex-1 px-3.5 py-2 text-sm bg-white border border-[#DFD6C0] rounded-xl focus:outline-none focus:border-[#1B4D24]"
                        />
                        <button
                          type="submit"
                          disabled={replyLoading}
                          className="px-4 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {replyLoading ? 'পাঠানো হচ্ছে...' : 'রিপ্লাই পাঠান'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Threaded replies */}
                  {replies.length > 0 && (
                    <div className="ml-5 sm:ml-10 space-y-2 border-l border-[#1B4D24]/25 pl-3.5 sm:pl-4">
                      {replies.map((rep) => {
                        const canDeleteReply =
                          user && (user.role === 'admin' || user.uid === rep.authorUid);
                        const isReplyingNested = replyTarget?.targetCommentId === rep.id;

                        return (
                          <div key={rep.id} className="space-y-2">
                            <div className="p-3.5 rounded-xl bg-white/85 border border-[#E8E0CD] flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                {rep.authorPhotoUrl ? (
                                  <img
                                    src={rep.authorPhotoUrl}
                                    alt={rep.authorName}
                                    referrerPolicy="no-referrer"
                                    className="w-7 h-7 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-[#B92B27]/12 text-[#B92B27] flex items-center justify-center text-xs font-bold shrink-0">
                                    {rep.authorName.charAt(0)}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="font-bold text-[#1F1A14]">{rep.authorName}</span>
                                    {rep.replyToName && (
                                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#1B4D24]">
                                        <CornerDownRight className="w-3 h-3" />
                                        {rep.replyToName}
                                      </span>
                                    )}
                                    <span aria-hidden="true" className="text-[#B8AE9E]">·</span>
                                    <span className="text-[#7A6F60]">{formatBengaliCommentDate(rep.createdAt)}</span>
                                  </div>
                                  <p className="text-sm text-[#2D2720] mt-1 leading-relaxed break-words">
                                    {rep.text}
                                  </p>
                                  {user && (
                                    <div className="mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReplyTarget({
                                            targetCommentId: rep.id,
                                            parentCommentId: cmt.id,
                                            replyToUid: rep.authorUid,
                                            replyToName: rep.authorName,
                                          });
                                          setReplyText('');
                                        }}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1B4D24] hover:underline cursor-pointer"
                                      >
                                        <Reply className="w-3 h-3" />
                                        রিপ্লাই দিন
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {canDeleteReply && (
                                <button
                                  type="button"
                                  onClick={() => deleteRecipeComment(recipe.id, rep.id)}
                                  aria-label="রিপ্লাই মুছুন"
                                  className="p-1 text-[#8C8070] hover:text-red-600 rounded-lg cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {isReplyingNested && user && (
                              <form
                                onSubmit={handleSubmitReply}
                                className="p-3 rounded-xl bg-[#F1F6EF] border border-[#1B4D24]/20 space-y-2"
                              >
                                <div className="flex items-center justify-between text-xs font-bold text-[#1B4D24]">
                                  <span>@{replyTarget.replyToName}-কে রিপ্লাই দিচ্ছেন</span>
                                  <button
                                    type="button"
                                    onClick={() => setReplyTarget(null)}
                                    className="text-[#6D6254] hover:text-[#1F1A14] p-0.5 cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="text"
                                    required
                                    minLength={2}
                                    maxLength={1000}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="আপনার উত্তর লিখুন..."
                                    className="flex-1 px-3 py-2 text-sm bg-white border border-[#DFD6C0] rounded-xl focus:outline-none focus:border-[#1B4D24]"
                                  />
                                  <button
                                    type="submit"
                                    disabled={replyLoading}
                                    className="px-4 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    {replyLoading ? 'পাঠানো হচ্ছে...' : 'রিপ্লাই পাঠান'}
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 4 RELATED CATEGORY SUGGESTIONS WITH SMALL THUMBNAILS */}
      {relatedRecipes.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-[#DFD6C0]">
            <h2 className="font-display-bn text-lg sm:text-xl font-bold text-[#1F1A14]">
              এই ক্যাটাগরির আরও রেসিপি ({recipe.category})
            </h2>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'category', categoryName: recipe.category })}
              className="text-xs font-bold text-[#1B4D24] hover:underline cursor-pointer whitespace-nowrap"
            >
              সব দেখুন →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {relatedRecipes.map((rel) => (
              <article
                key={rel.id}
                onClick={() => onNavigate({ page: 'recipe-detail', id: rel.id })}
                className="group bg-[#FCF9F2] rounded-2xl border border-[#E4DCC8] p-3 hover:bg-[#F7F2E6] transition-colors cursor-pointer flex items-center gap-3.5"
              >
                <div className="relative w-24 h-20 sm:w-28 sm:h-20 rounded-xl bg-[#F3EDE0] overflow-hidden shrink-0">
                  <img
                    src={rel.imageUrl}
                    alt={rel.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-[#1F1A14] group-hover:text-[#B92B27] line-clamp-2 leading-snug">
                    {rel.title}
                  </h3>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#6D6254]">
                    <span>{rel.cookTime}</span>
                    <span className={`font-bold whitespace-nowrap ${rel.isPremium ? 'text-[#B92B27]' : 'text-[#1B4D24]'}`}>
                      {rel.isPremium ? 'প্রিমিয়াম' : 'বিনামূল্যে'}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Minimal Diary-Page 16:9 Image Viewer */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ডায়েরী পাতায় ছবি প্রদর্শন"
          onClick={() => setLightboxImage(null)}
          className={`fixed inset-0 z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-diary-fade ${recipeFontScopeClass}`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl bg-[#FCF9F2] rounded-2xl sm:rounded-3xl border border-[#E4DCC8] shadow-2xl overflow-hidden my-auto animate-diary-open"
          >
            {/* Minimal Vertical Diary Margin Rule (Desktop) */}
            <div
              aria-hidden="true"
              className="hidden sm:block absolute top-0 bottom-0 left-7 w-px bg-[#B92B27]/15 pointer-events-none"
            />

            {/* Diary Page Header */}
            <div className="px-5 sm:pl-12 sm:pr-7 py-3.5 border-b border-[#EAE2CF] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {lightboxImage.label && (
                  <span
                    key={`label-${lightboxImage.stepIdx ?? 'hero'}`}
                    className="px-2.5 py-0.5 rounded-full bg-[#1B4D24]/10 border border-[#1B4D24]/20 text-[#1B4D24] text-xs font-bold shrink-0 animate-diary-fade"
                  >
                    {lightboxImage.label}
                  </span>
                )}
                <span className="font-recipe-diary-heading text-base sm:text-lg text-[#4A4136] truncate">
                  {recipe.title}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label="বন্ধ করুন"
                className="w-8 h-8 rounded-full border border-[#E2DAC6] bg-white/85 hover:bg-white text-[#3D352B] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Diary Page Body: Strict 16:9 Photo Frame + Minimal Ruled Note */}
            <div className="px-5 sm:pl-12 sm:pr-7 py-5 space-y-4">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#E4DCC8] bg-[#F3EDE0] shadow-xs">
                <div
                  key={`photo-${lightboxImage.stepIdx ?? 'hero'}-${lightboxImage.src}`}
                  className={`w-full h-full ${
                    lightboxDirection === 'next'
                      ? 'animate-diary-next'
                      : lightboxDirection === 'prev'
                        ? 'animate-diary-prev'
                        : 'animate-diary-fade'
                  }`}
                >
                  <img
                    src={lightboxImage.src}
                    alt={lightboxImage.alt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover block"
                  />
                </div>

                {lightboxImage.stepIdx !== undefined && stepImageGallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => navigateLightboxStep('prev')}
                      aria-label="আগের ধাপের ছবি"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FCF9F2]/90 hover:bg-white text-[#2D2720] border border-[#E2DAC6] shadow-sm flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateLightboxStep('next')}
                      aria-label="পরবর্তী ধাপের ছবি"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FCF9F2]/90 hover:bg-white text-[#2D2720] border border-[#E2DAC6] shadow-sm flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {lightboxImage.caption && (
                <div
                  key={`caption-${lightboxImage.stepIdx ?? 'hero'}`}
                  className={`pt-2 border-t border-dashed border-[#E2DAC6] ${
                    lightboxDirection === 'next'
                      ? 'animate-diary-next'
                      : lightboxDirection === 'prev'
                        ? 'animate-diary-prev'
                        : 'animate-diary-fade'
                  }`}
                >
                  <p className="font-recipe-diary text-[16px] sm:text-[17.5px] text-[#2D2720] leading-[30px] bg-[repeating-linear-gradient(transparent,transparent_29px,#EFE8D6_30px)]">
                    {lightboxImage.caption}
                  </p>
                </div>
              )}

              {lightboxImage.stepIdx !== undefined && stepImageGallery.length > 1 && (
                <div className="pt-2 border-t border-[#EAE2CF] flex items-center justify-between text-xs font-semibold text-[#5E5448]">
                  <button
                    type="button"
                    onClick={() => navigateLightboxStep('prev')}
                    className="inline-flex items-center gap-1 hover:text-[#1B4D24] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>আগের পাতা</span>
                  </button>

                  <span className="tabular-nums text-[11px] text-[#7A6F60]">
                    পাতা{' '}
                    {toBengaliDigits(
                      stepImageGallery.findIndex(
                        (item) => item.stepIdx === lightboxImage.stepIdx
                      ) + 1
                    )}{' '}
                    / {toBengaliDigits(stepImageGallery.length)}
                  </span>

                  <button
                    type="button"
                    onClick={() => navigateLightboxStep('next')}
                    className="inline-flex items-center gap-1 hover:text-[#1B4D24] transition-colors cursor-pointer"
                  >
                    <span>পরের পাতা</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
