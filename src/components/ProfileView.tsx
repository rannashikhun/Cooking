import React, { useEffect, useRef, useState } from 'react';
import { Timestamp, collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Camera,
  CheckCheck,
  CheckCircle2,
  Clock,
  Crown,
  Heart,
  LogOut,
  MessageSquare,
  ShieldCheck,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { FONT_SIZE_OPTIONS, RECIPE_FONT_OPTIONS } from '../data/seedData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  FREE_RECIPE_LIMIT,
  formatUserContact,
  getRemainingNewPremiumSlots,
  getSubscriptionExpiresMillis,
  getUserFreeUnlockedIds,
  getUserPremiumQuota,
  getUserPremiumUnlockedIds,
  isPaidPlanActive,
  updateUserProfilePhoto,
} from '../services/firestoreService';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import type {
  FontSizeKey,
  PageRoute,
  Recipe,
  RecipeFontKey,
  SiteSettings,
  SubscriptionOrder,
  SubscriptionPlan,
  UserNotification,
  UserProfile,
} from '../types';

interface ProfileViewProps {
  user: UserProfile | null;
  recipes: Recipe[];
  plans?: SubscriptionPlan[];
  siteSettings?: SiteSettings;
  notifications?: UserNotification[];
  onNotificationClick?: (notif: UserNotification) => void;
  onMarkAllNotificationsRead?: () => void;
  onLogout: () => void;
  onNavigate: (route: PageRoute) => void;
  onPhotoUpdated?: (photoURL: string) => void;
}

const VALID_PROFILE_FONT_KEYS = new Set<RecipeFontKey>(
  RECIPE_FONT_OPTIONS.map((opt) => opt.key)
);
const VALID_PROFILE_SIZE_KEYS = new Set<FontSizeKey>(
  FONT_SIZE_OPTIONS.map((opt) => opt.key)
);

function resolveProfileFontKey(key?: string): RecipeFontKey {
  if (key && VALID_PROFILE_FONT_KEYS.has(key as RecipeFontKey)) {
    return key as RecipeFontKey;
  }
  return 'hind-siliguri';
}

function resolveProfileSizeKey(key?: string): FontSizeKey {
  if (key && VALID_PROFILE_SIZE_KEYS.has(key as FontSizeKey)) {
    return key as FontSizeKey;
  }
  return 'md';
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'বেসিক (বিনামূল্যে)',
  standard: 'স্ট্যান্ডার্ড মেম্বার',
  pro: 'প্রো মেম্বার',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'সক্রিয় / অনুমোদিত',
  pending: 'যাচাইয়ের অপেক্ষায় (Pending)',
  rejected: 'বাতিল হয়েছে',
  revoked: 'স্থগিত',
};

function getRemainingSubscriptionDays(user: UserProfile): {
  daysLeft: number | null;
  hoursLeft: number | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  expiresDateLabel: string | null;
} {
  const isPaidTier = user.subscriptionPlan === 'standard' || user.subscriptionPlan === 'pro';
  let expMs = getSubscriptionExpiresMillis(user.subscriptionExpiresAt);
  if (!expMs && user.subscriptionPlan === 'basic') {
    const createdMs = getSubscriptionExpiresMillis(user.createdAt);
    if (createdMs) {
      expMs = createdMs + 30 * 24 * 60 * 60 * 1000;
    }
  }
  if (!expMs) {
    return {
      daysLeft: user.subscriptionStatus === 'active' ? 30 : 0,
      hoursLeft: null,
      isExpiringSoon: false,
      isExpired: user.subscriptionStatus === 'expired',
      expiresDateLabel: null,
    };
  }
  const diffMs = expMs - Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const isExpired = diffMs <= 0 || user.subscriptionStatus === 'expired';
  const isExpiringSoon = isPaidTier && !isExpired && diffMs <= ONE_DAY_MS;
  const daysLeft = Math.max(0, Math.ceil(diffMs / ONE_DAY_MS));
  const hoursLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
  const expiresDateLabel = new Date(expMs).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return { daysLeft, hoursLeft, isExpiringSoon, isExpired, expiresDateLabel };
}

function formatTimestampBn(ts: unknown): string {
  try {
    let date: Date | null = null;
    if (typeof ts === 'number') {
      date = new Date(ts);
    } else if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      date = (ts as { toDate: () => Date }).toDate();
    }
    if (!date) return 'সাম্প্রতিক';
    return date.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'সাম্প্রতিক';
  }
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  recipes,
  plans = [],
  siteSettings,
  notifications = [],
  onNotificationClick,
  onMarkAllNotificationsRead,
  onLogout,
  onNavigate,
  onPhotoUpdated,
}) => {
  const profileFontKey = resolveProfileFontKey(siteSettings?.profileFontFamily);
  const profileSizeKey = resolveProfileSizeKey(siteSettings?.profileFontSize);
  const profileScopeClass = `profile-typography-scope profile-font-${profileFontKey} profile-size-${profileSizeKey}`;

  const [orders, setOrders] = useState<SubscriptionOrder[]>([]);
  const [activeRecipeTab, setActiveRecipeTab] = useState<'free' | 'premium' | 'favorites'>('free');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    const q = query(collection(db, 'subscriptionOrders'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionOrder, 'id'>) }));
        setOrders(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'subscriptionOrders')
    );
    return () => unsub();
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    setPhotoErr(null);
    setPhotoMsg(null);
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 320,
        maxHeight: 320,
        quality: 0.78,
        maxChars: 140000,
      });
      await updateUserProfilePhoto(user.uid, dataUrl);
      onPhotoUpdated?.(dataUrl);
      setPhotoMsg('প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে!');
      setTimeout(() => setPhotoMsg(null), 3500);
    } catch (err) {
      setPhotoErr(
        err instanceof Error ? err.message : 'প্রোফাইল ছবি আপলোড করা যায়নি। আবার চেষ্টা করুন।'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!user) {
    return (
      <section className={`${profileScopeClass} max-w-lg mx-auto px-4 py-14 text-center`}>
        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-xs space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center">
            <UserIcon className="w-8 h-8" />
          </div>
          <h1 className="font-display-bn text-2xl font-bold text-[#1A1A1A]">
            আপনার প্রোফাইলে স্বাগতম
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            আপনার প্রিয় রেসিপি সংরক্ষণ করতে, প্রিমিয়াম সদস্যপদ নিতে অথবা অ্যাকাউন্ট ব্যবহার করতে অনুগ্রহ করে লগইন বা নিবন্ধন করুন।
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'login' })}
            className="w-full py-3 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer"
          >
            লগইন / নিবন্ধন পেজে যান
          </button>
        </div>
      </section>
    );
  }

  const recipeMap = new Map<string, Recipe>();
  recipes.forEach((r) => recipeMap.set(r.id, r));
  const viewedAtByRecipeId = new Map<string, number>();
  (user.viewedHistory || []).forEach((entry) => {
    if (!viewedAtByRecipeId.has(entry.recipeId)) {
      viewedAtByRecipeId.set(entry.recipeId, entry.viewedAt);
    }
  });

  const favoriteRecipes = recipes.filter((r) => user.favoriteRecipeIds.includes(r.id));

  const freeUnlockedIds = getUserFreeUnlockedIds(user, recipes);
  const premiumUnlockedIds = getUserPremiumUnlockedIds(user, recipes);
  const paidActive = isPaidPlanActive(user);
  const isPaidTier = user.subscriptionPlan === 'standard' || user.subscriptionPlan === 'pro';
  const premiumQuotaTotal = getUserPremiumQuota(user, plans, recipes);
  const remainingNewPremium = getRemainingNewPremiumSlots(user, plans, recipes);
  const freeUsedCount = freeUnlockedIds.length;
  const freeRemainingCount = Math.max(0, FREE_RECIPE_LIMIT - freeUsedCount);

  // Deduplicated Free Recipes Viewed/Unlocked
  const freeTabIds = Array.from(
    new Set([
      ...(user.viewedHistory || [])
        .map((h) => h.recipeId)
        .filter((id) => {
          const rec = recipeMap.get(id);
          return rec && !rec.isPremium;
        }),
      ...freeUnlockedIds.filter((id) => {
        const rec = recipeMap.get(id);
        return rec && !rec.isPremium;
      }),
    ])
  );
  const freeRecipeItems = freeTabIds
    .map((id) => {
      const rec = recipeMap.get(id);
      return rec ? { recipe: rec, viewedAt: viewedAtByRecipeId.get(id) } : null;
    })
    .filter((item): item is { recipe: Recipe; viewedAt: number | undefined } => item !== null);

  // Deduplicated Premium Recipes Permanently Unlocked (plus admin viewed premium recipes)
  const premiumTabIds = Array.from(
    new Set([
      ...premiumUnlockedIds.filter((id) => recipeMap.get(id)?.isPremium),
      ...(user.role === 'admin'
        ? (user.viewedHistory || [])
            .map((h) => h.recipeId)
            .filter((id) => recipeMap.get(id)?.isPremium)
        : []),
    ])
  );
  const premiumRecipeItems = premiumTabIds
    .map((id) => {
      const rec = recipeMap.get(id);
      return rec ? { recipe: rec, viewedAt: viewedAtByRecipeId.get(id) } : null;
    })
    .filter((item): item is { recipe: Recipe; viewedAt: number | undefined } => item !== null);

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const { daysLeft, hoursLeft, isExpiringSoon, isExpired, expiresDateLabel } =
    getRemainingSubscriptionDays(user);
  const displayContact = formatUserContact(user.email, user.phoneNumber);

  return (
    <section className={`${profileScopeClass} max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8`}>
      {/* Plan Expiry / Renewal Warning Banner for Paid Users (<= 1 day left or expired) */}
      {user.role !== 'admin' && isPaidTier && (isExpiringSoon || isExpired) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-950">
                {isExpired
                  ? 'আপনার ১ মাসের প্ল্যানের মেয়াদ শেষ হয়ে গেছে!'
                  : `আপনার প্ল্যানের মেয়াদ আর মাত্র ${
                      hoursLeft && hoursLeft <= 24
                        ? `${toBengaliDigits(hoursLeft)} ঘণ্টা`
                        : '১ দিন'
                    } বাকি!`}
              </p>
              <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                {isExpired
                  ? 'নতুন প্রিমিয়াম রেসিপি আনলক করতে প্ল্যান রিনিউ করুন। তবে আপনার আগে আনলক করা প্রিমিয়াম রেসিপিগুলো সবসময় আনলক থাকবে।'
                  : `আগামী ১ দিনের মধ্যে (${expiresDateLabel || 'শীঘ্রই'}) আপনার মেয়াদ শেষ হবে। নিরবচ্ছিন্নভাবে নতুন রেসিপি দেখতে এখনই প্ল্যান রিনিউ করুন।`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'pricing' })}
            className="px-4 py-2.5 rounded-xl bg-[#B92B27] hover:bg-[#9C221F] text-white text-xs font-bold whitespace-nowrap cursor-pointer shrink-0 self-start sm:self-center"
          >
            এখনই রিনিউ করুন →
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-18 h-18 rounded-full object-cover border-2 border-[#1B4D24]/20"
                />
              ) : (
                <div className="w-18 h-18 rounded-full bg-[#1B4D24] text-white flex items-center justify-center text-2xl font-bold">
                  {user.displayName.charAt(0)}
                </div>
              )}

              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                aria-label="গ্যালারি থেকে প্রোফাইল ছবি দিন"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[#1B4D24] hover:bg-gray-50 cursor-pointer disabled:opacity-60"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A]">{user.displayName}</h1>
              <p className="text-sm text-gray-500">{displayContact}</p>
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 text-xs font-bold text-[#1B4D24] hover:underline cursor-pointer disabled:opacity-60"
              >
                {uploadingPhoto ? 'ছবি আপলোড হচ্ছে...' : 'গ্যালারি থেকে প্রোফাইল ছবি সেট করুন'}
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 text-[#1B4D24]">
                  <Crown className="w-3.5 h-3.5 text-[#D4A017]" />
                  {PLAN_LABELS[user.subscriptionPlan] || user.subscriptionPlan}
                </span>
                <span aria-hidden="true">·</span>
                <span className={!isExpired && (paidActive || !isPaidTier) ? 'text-emerald-700' : 'text-red-600'}>
                  {isPaidTier
                    ? paidActive
                      ? 'সক্রিয় সদস্যপদ (১ মাস)'
                      : 'মেয়াদোত্তীর্ণ'
                    : 'ফ্রি সদস্যপদ'}
                </span>
                {user.role !== 'admin' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#1A1A1A] tabular-nums">
                      <BookOpen className="w-3.5 h-3.5 text-[#1B4D24]" />
                      {paidActive
                        ? `প্রিমিয়াম কোটা: ${toBengaliDigits(premiumUnlockedIds.length)} / ${toBengaliDigits(premiumQuotaTotal)} টি (বাকি ${toBengaliDigits(remainingNewPremium)} টি)`
                        : `ফ্রি কোটা: ${toBengaliDigits(Math.min(freeUsedCount, FREE_RECIPE_LIMIT))} / ${toBengaliDigits(FREE_RECIPE_LIMIT)} টি (বাকি ${toBengaliDigits(freeRemainingCount)} টি)`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate({ page: 'admin' })}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#1B4D24] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                এডমিন প্যানেল
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate({ page: 'pricing' })}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-[#D4A017] text-[#9A7209] hover:bg-[#FFFBEB] text-xs font-bold cursor-pointer"
            >
              প্ল্যান আপগ্রেড
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              লগআউট
            </button>
          </div>
        </div>

        {photoMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#1B4D24]">
            {photoMsg}
          </div>
        )}
        {photoErr && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {photoErr}
          </div>
        )}
      </div>

      {/* User Notifications: Comment Replies & Payment Updates */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#1B4D24]" />
            <h2 className="font-display-bn text-lg font-bold text-[#1A1A1A]">
              নোটিফিকেশন ({toBengaliDigits(notifications.length)})
            </h2>
            {unreadNotifCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#B92B27] text-white text-[11px] font-bold tabular-nums">
                {toBengaliDigits(unreadNotifCount)} নতুন
              </span>
            )}
          </div>
          {unreadNotifCount > 0 && onMarkAllNotificationsRead && (
            <button
              type="button"
              onClick={onMarkAllNotificationsRead}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B4D24] hover:underline cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              সব পড়া হয়েছে চিহ্নিত করুন
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">
            এখনো কোনো নোটিফিকেশন নেই। আপনার মন্তব্যের রিপ্লাই বা পেমেন্ট যাচাইয়ের আপডেট এখানে পাবেন।
          </p>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onNotificationClick?.(n)}
                className={`w-full text-left p-3.5 rounded-2xl border flex items-start gap-3 transition-colors cursor-pointer ${
                  n.isRead
                    ? 'bg-[#FAFAF8] border-gray-100 hover:border-gray-300'
                    : 'bg-[#F2F8F3] border-[#1B4D24]/30 hover:border-[#1B4D24]/50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === 'comment_reply'
                      ? 'bg-[#1B4D24]/12 text-[#1B4D24]'
                      : n.type === 'payment_approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : n.type === 'payment_rejected' || n.type === 'free_limit_reached'
                          ? 'bg-red-100 text-red-600'
                          : n.type === 'pro_limit_reached'
                            ? 'bg-amber-100 text-[#9A6E04]'
                            : n.type === 'plan_expiry_reminder'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {n.type === 'comment_reply' ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : n.type === 'payment_approved' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : n.type === 'payment_rejected' ? (
                    <XCircle className="w-4 h-4" />
                  ) : n.type === 'free_limit_reached' || n.type === 'plan_expiry_reminder' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : n.type === 'pro_limit_reached' ? (
                    <Crown className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#1A1A1A]">{n.title}</p>
                    <span className="text-[11px] text-gray-500">
                      {formatTimestampBn(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  {n.recipeId ? (
                    <p className="text-xs font-bold text-[#1B4D24] mt-1">
                      রেসিপি পোস্টে যান →
                    </p>
                  ) : n.type === 'free_limit_reached' ||
                    n.type === 'pro_limit_reached' ||
                    n.type === 'plan_expiry_reminder' ? (
                    <p className="text-xs font-bold text-[#B92B27] mt-1">
                      প্ল্যান দেখুন / রিনিউ করুন →
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabbed Free Recipes, Permanently Unlocked Premium Recipes & Favorite Recipes */}
      <div className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-7">
        <div className="flex flex-nowrap items-center justify-center md:justify-start gap-1.5 sm:gap-2 border-b border-gray-100 pb-4 mb-5">
          <button
            type="button"
            onClick={() => setActiveRecipeTab('free')}
            className={`inline-flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeRecipeTab === 'free'
                ? 'bg-[#1B4D24] text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>ফ্রি রেসিপি ({toBengaliDigits(freeRecipeItems.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRecipeTab('premium')}
            className={`inline-flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeRecipeTab === 'premium'
                ? 'bg-[#C69214] text-white shadow-xs'
                : 'bg-amber-50 text-[#9A6E04] hover:bg-amber-100/80 border border-amber-200/70'
            }`}
          >
            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>প্রিমিয়াম রেসিপি ({toBengaliDigits(premiumRecipeItems.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRecipeTab('favorites')}
            className={`hidden md:inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeRecipeTab === 'favorites'
                ? 'bg-[#B92B27] text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Heart className="w-4 h-4 shrink-0" />
            <span>প্রিয় রেসিপি ({toBengaliDigits(favoriteRecipes.length)})</span>
          </button>
        </div>

        {activeRecipeTab === 'free' ? (
          <div className="space-y-4">
            {user.role !== 'admin' && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#F4F8F4] border border-[#DCE8DC] text-xs text-[#2D4530]">
                <span>
                  {paidActive
                    ? 'আপনার সক্রিয় প্রো/স্ট্যান্ডার্ড প্ল্যানে সব ফ্রি রেসিপি আনলিমিটেড দেখতে পারবেন।'
                    : `ফ্রি কোটা ব্যবহৃত: ${toBengaliDigits(Math.min(freeUsedCount, FREE_RECIPE_LIMIT))} / ${toBengaliDigits(FREE_RECIPE_LIMIT)} টি (একই রেসিপি বারবার দেখলেও ১ বারই গণনা হয়)`}
                </span>
                {!paidActive && freeRemainingCount === 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'pricing' })}
                    className="font-bold text-[#B92B27] hover:underline cursor-pointer"
                  >
                    প্রো প্ল্যান কিনুন →
                  </button>
                )}
              </div>
            )}

            {freeRecipeItems.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">
                আপনি এখনো কোনো ফ্রি রেসিপি ওপেন করেননি। যেকোনো ফ্রি রেসিপি দেখলে তা এখানে সংরক্ষিত হবে।
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {freeRecipeItems.map(({ recipe, viewedAt }) => (
                  <div
                    key={recipe.id}
                    onClick={() => onNavigate({ page: 'recipe-detail', id: recipe.id })}
                    className="flex items-center gap-3.5 p-3 rounded-2xl border border-gray-100 hover:border-[#1B4D24]/40 cursor-pointer transition-colors"
                  >
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#1A1A1A] truncate">{recipe.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {recipe.cookTime} · বিনামূল্যে
                      </p>
                      <p className="text-[11px] text-[#1B4D24] font-medium mt-0.5">
                        {viewedAt ? `দেখা হয়েছে: ${formatTimestampBn(viewedAt)}` : 'আনলক করা ফ্রি রেসিপি'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeRecipeTab === 'premium' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-[#6B4E08]">
              <span>
                যে প্রিমিয়াম রেসিপি একবার আনলক করবেন, ১ মাসের প্ল্যান শেষ হওয়ার পরও সেটি আপনার জন্য সবসময় আনলক থাকবে।
              </span>
              {user.role !== 'admin' && (
                <span className="font-bold tabular-nums text-[#9A6E04]">
                  আনলকড: {toBengaliDigits(premiumUnlockedIds.length)} / {toBengaliDigits(premiumQuotaTotal)} টি
                </span>
              )}
            </div>

            {premiumRecipeItems.length === 0 ? (
              <div className="py-4 space-y-2.5">
                <p className="text-sm text-gray-500">
                  আপনি এখনো কোনো প্রিমিয়াম রেসিপি আনলক করেননি। প্রো বা স্ট্যান্ডার্ড প্ল্যান নিয়ে প্রিমিয়াম রেসিপি দেখলে তা এখানে চিরস্থায়ীভাবে সংরক্ষিত থাকবে।
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'pricing' })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C69214] hover:bg-[#AE7F0E] text-white text-xs font-bold cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  প্রো প্ল্যান দেখুন
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {premiumRecipeItems.map(({ recipe, viewedAt }) => (
                  <div
                    key={recipe.id}
                    onClick={() => onNavigate({ page: 'recipe-detail', id: recipe.id })}
                    className="flex items-center gap-3.5 p-3 rounded-2xl border border-amber-200/70 bg-amber-50/25 hover:border-amber-400 cursor-pointer transition-colors"
                  >
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-[#1A1A1A] truncate">{recipe.title}</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {recipe.cookTime} · প্রিমিয়াম
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[#1B4D24] text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          চিরস্থায়ী আনলকড
                        </span>
                        {viewedAt && (
                          <span className="text-[10px] text-gray-500">
                            {formatTimestampBn(viewedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : favoriteRecipes.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">
            এখনো কোনো রেসিপি প্রিয় তালিকায় যোগ করা হয়নি। রেসিপির ছবির ওপর লাভ চিহ্নে ক্লিক করে সংরক্ষণ করুন।
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {favoriteRecipes.map((recipe) => (
              <div
                key={recipe.id}
                onClick={() => onNavigate({ page: 'recipe-detail', id: recipe.id })}
                className="flex items-center gap-3.5 p-3 rounded-2xl border border-gray-100 hover:border-gray-300 cursor-pointer transition-colors"
              >
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1A1A1A] truncate">{recipe.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {recipe.cookTime} · {recipe.isPremium ? 'প্রিমিয়াম' : 'বিনামূল্যে'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscription Summary, Remaining Days, Quota, Upgrade & Orders History */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display-bn text-lg font-bold text-[#1A1A1A]">
              সাবস্ক্রিপশন লেনদেন ও যাচাই স্ট্যাটাস
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              বর্তমান প্ল্যান: <span className="font-bold text-[#1B4D24]">{PLAN_LABELS[user.subscriptionPlan] || user.subscriptionPlan}</span>
              {isPaidTier && expiresDateLabel ? ` · মেয়াদ শেষ: ${expiresDateLabel}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ page: 'pricing' })}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold whitespace-nowrap cursor-pointer transition-colors self-start sm:self-auto"
          >
            <Crown className="w-4 h-4 text-[#F4C430]" />
            {paidActive ? 'প্ল্যান আপগ্রেড / কোটা বাড়ান' : 'প্রো প্ল্যান কিনুন / রিনিউ'}
          </button>
        </div>

        {/* Subscription Duration & Separate Free/Premium Recipe Quota Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">সাবস্ক্রিপশনের মেয়াদ</p>
            <p className="mt-1 text-lg font-bold text-[#1A1A1A] tabular-nums">
              {user.role === 'admin'
                ? 'সীমাহীন (এডমিন)'
                : !isPaidTier
                  ? 'ফ্রি অ্যাকাউন্ট'
                  : isExpired
                    ? 'মেয়াদ শেষ'
                    : isExpiringSoon && hoursLeft !== null
                      ? `বাকি ${toBengaliDigits(hoursLeft)} ঘণ্টা`
                      : `বাকি ${toBengaliDigits(daysLeft ?? 30)} দিন`}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">ফ্রি রেসিপি কোটা</p>
            <p className="mt-1 text-lg font-bold text-[#1B4D24] tabular-nums">
              {user.role === 'admin'
                ? 'সীমাহীন'
                : paidActive
                  ? 'আনলিমিটেড (সক্রিয় প্ল্যান)'
                  : `${toBengaliDigits(Math.min(freeUsedCount, FREE_RECIPE_LIMIT))} / ${toBengaliDigits(FREE_RECIPE_LIMIT)} টি`}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">প্রিমিয়াম রেসিপি কোটা</p>
            <p className="mt-1 text-lg font-bold text-[#B92B27] tabular-nums">
              {user.role === 'admin'
                ? 'সীমাহীন'
                : `${toBengaliDigits(premiumUnlockedIds.length)} / ${toBengaliDigits(premiumQuotaTotal)} টি`}
            </p>
            {user.role !== 'admin' && (
              <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                {paidActive
                  ? `নতুন আনলক বাকি: ${toBengaliDigits(remainingNewPremium)} টি`
                  : 'আগে দেখাগুলো চিরস্থায়ী আনলকড'}
              </p>
            )}
          </div>
        </div>

        {user.role !== 'admin' && (
          <div className="space-y-1.5">
            {paidActive ? (
              <>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-[#C69214] rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((premiumUnlockedIds.length / Math.max(1, premiumQuotaTotal)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    প্রিমিয়াম কোটা ব্যবহৃত ({toBengaliDigits(premiumUnlockedIds.length)}/
                    {toBengaliDigits(premiumQuotaTotal)}) · নতুন বাকি {toBengaliDigits(remainingNewPremium)} টি
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'pricing' })}
                    className="font-bold text-[#B92B27] hover:underline cursor-pointer"
                  >
                    একাধিকবার আপগ্রেড করে কোটা বাড়ান →
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-[#1B4D24] rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((Math.min(freeUsedCount, FREE_RECIPE_LIMIT) / FREE_RECIPE_LIMIT) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    ফ্রি রেসিপি ব্যবহৃত ({toBengaliDigits(Math.min(freeUsedCount, FREE_RECIPE_LIMIT))}/
                    {toBengaliDigits(FREE_RECIPE_LIMIT)}) · বাকি {toBengaliDigits(freeRemainingCount)} টি
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'pricing' })}
                    className="font-bold text-[#B92B27] hover:underline cursor-pointer"
                  >
                    প্রো প্ল্যান কিনে আনলক করুন →
                  </button>
                </p>
              </>
            )}
          </div>
        )}

        {/* Orders List */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-700 mb-2.5">লেনদেনের ইতিহাস</p>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              এখনো কোনো পেমেন্ট লেনদেন জমা দেওয়া হয়নি। প্রিমিয়াম রেসিপি ও বেশি কোটা পেতে স্ট্যান্ডার্ড বা প্রো প্ল্যানে আপগ্রেড করুন।
            </p>
          ) : (
            <div className="divide-y divide-gray-100 text-sm">
              {orders.map((ord) => (
                <div key={ord.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">
                      {ord.planName === 'Basic' ? 'বেসিক' : ord.planName} প্ল্যান
                    </p>
                    <p className="text-xs text-gray-500">
                      মাধ্যম: {ord.paymentMethod} · প্রেরক: {ord.senderNumber || '-'} · TxID: {ord.transactionId || '-'}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-bold text-[#1B4D24]">{toBengaliDigits(ord.amount)} টাকা</p>
                    <p
                      className={`text-xs font-semibold ${
                        ord.status === 'active'
                          ? 'text-emerald-700'
                          : ord.status === 'pending'
                            ? 'text-[#B8860B]'
                            : 'text-red-600'
                      }`}
                    >
                      {STATUS_LABELS[ord.status] || ord.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
