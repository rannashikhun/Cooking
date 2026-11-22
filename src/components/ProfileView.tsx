import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
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
  Eye,
  Heart,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  ShieldCheck,
  User as UserIcon,
  X,
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

const BN_MONTHS_FULL = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

function formatDayMonthBn(ts: unknown): string | null {
  try {
    let date: Date | null = null;
    if (typeof ts === 'number') {
      date = new Date(ts);
    } else if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      date = (ts as { toDate: () => Date }).toDate();
    }
    if (!date || Number.isNaN(date.getTime())) return null;
    return `${toBengaliDigits(date.getDate())} ${BN_MONTHS_FULL[date.getMonth()]}`;
  } catch {
    return null;
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
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputId = 'profile-view-photo-input';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPhotoMenu(false);
        setShowPhotoViewer(false);
        if (!uploadingPhoto) {
          setPendingPhotoPreview(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uploadingPhoto]);

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

  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    setShowPhotoMenu(false);
    setShowPhotoViewer(false);
    setPhotoErr(null);
    setPhotoMsg(null);
    setPreparingPhoto(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 360,
        maxHeight: 360,
        quality: 0.82,
        maxChars: 135000,
        squareCrop: true,
      });
      setPendingPhotoPreview(dataUrl);
    } catch (err) {
      setPhotoErr(
        err instanceof Error ? err.message : 'প্রোফাইল ছবি প্রসেস করা যায়নি। অন্য ছবি চেষ্টা করুন।'
      );
    } finally {
      setPreparingPhoto(false);
    }
  };

  const handleSavePendingPhoto = async () => {
    if (!user || !pendingPhotoPreview) return;
    setPhotoErr(null);
    setPhotoMsg(null);
    setUploadingPhoto(true);
    try {
      await updateUserProfilePhoto(user.uid, pendingPhotoPreview);
      onPhotoUpdated?.(pendingPhotoPreview);
      setPendingPhotoPreview(null);
      setPhotoMsg('প্রোফাইল ছবি সফলভাবে সেভ হয়েছে!');
      setTimeout(() => setPhotoMsg(null), 3500);
    } catch (err) {
      setPhotoErr(
        err instanceof Error ? err.message : 'প্রোফাইল ছবি সেভ করা যায়নি। আবার চেষ্টা করুন।'
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

      <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={uploadingPhoto || preparingPhoto}
                onClick={() => setShowPhotoMenu(true)}
                aria-label="প্রোফাইল পিক অপশন খুলুন"
                className="relative block rounded-full focus:outline-none focus:ring-2 focus:ring-[#1B4D24]/35 cursor-pointer group disabled:opacity-60"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                    className="w-18 h-18 rounded-full object-cover border-2 border-[#1B4D24]/20 group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-18 h-18 rounded-full bg-[#1B4D24] text-white flex items-center justify-center text-2xl font-bold group-hover:opacity-90 transition-opacity">
                    {user.displayName.charAt(0)}
                  </div>
                )}

                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[#1B4D24] group-hover:bg-gray-50">
                  {uploadingPhoto || preparingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              <input
                id={photoInputId}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onClick={(e) => {
                  e.currentTarget.value = '';
                }}
                onChange={handleAvatarFileSelected}
                className="sr-only"
              />
            </div>

            <div className="min-w-0 pt-2.5 sm:pt-2">
              <h1 className="text-xl font-bold text-[#1A1A1A] leading-snug">{user.displayName}</h1>
              {displayContact && (
                <p className="font-numeral-bn text-[11px] sm:text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1 break-all">
                  {displayContact.includes('@') ? (
                    <Mail className="w-3 h-3 text-[#1B4D24] shrink-0" />
                  ) : (
                    <Phone className="w-3 h-3 text-[#1B4D24] shrink-0" />
                  )}
                  <span>{displayContact}</span>
                </p>
              )}
              {(user.address || user.age) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                  {user.age && (
                    <span className="font-numeral-bn">
                      বয়স: {toBengaliDigits(user.age)} বছর
                    </span>
                  )}
                  {user.age && user.address && <span aria-hidden="true">·</span>}
                  {user.address && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="w-3 h-3 text-[#1B4D24] shrink-0" />
                      <span>{user.address}</span>
                    </span>
                  )}
                </div>
              )}
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

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate({ page: 'admin' })}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1B4D24] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                এডমিন প্যানেল
              </button>
            )}
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onNavigate({ page: 'pricing' })}
                className="flex-auto sm:flex-initial px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-[#D4A017] text-[#9A7209] hover:bg-[#FFFBEB] text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Crown className="w-3.5 h-3.5 text-[#D4A017] shrink-0" />
                <span>প্ল্যান আপগ্রেড</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ page: 'edit-profile' })}
                className="flex-auto sm:flex-initial px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-[#1B4D24]/35 text-[#1B4D24] hover:bg-[#EEF6EF] text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>প্রোফাইল এডিট</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex-auto sm:flex-initial px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[11px] sm:text-xs font-semibold text-gray-700 inline-flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>লগআউট</span>
              </button>
            </div>
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

      {/* Tabbed Free Recipes, Permanently Unlocked Premium Recipes & Favorite Recipes */}
      <div
        className={`bg-white rounded-3xl border p-4 sm:p-6 transition-colors ${
          activeRecipeTab === 'premium'
            ? 'border-[#C69214]/40'
            : activeRecipeTab === 'favorites'
              ? 'border-[#B92B27]/30'
              : 'border-[#1B4D24]/25'
        }`}
      >
        <div className="mb-3.5 text-center">
          <h2 className="font-display-bn text-lg font-bold text-[#1A1A1A]">
            আপনার দেখা রেসিপি গুলো
          </h2>
        </div>

        <div className="flex flex-nowrap items-stretch w-full gap-1.5 p-1 rounded-xl bg-[#F5F4F0] border border-gray-200/70 mb-4">
          <button
            type="button"
            onClick={() => setActiveRecipeTab('free')}
            className={`flex-auto inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-[13px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeRecipeTab === 'free'
                ? 'bg-[#1B4D24] text-white shadow-sm'
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>ফ্রি রেসিপি ({toBengaliDigits(freeRecipeItems.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRecipeTab('premium')}
            className={`flex-auto inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-[13px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeRecipeTab === 'premium'
                ? 'bg-[#C69214] text-white shadow-sm'
                : 'bg-amber-50/90 text-[#9A6E04] hover:bg-amber-100/70'
            }`}
          >
            <Crown className="w-3.5 h-3.5 shrink-0" />
            <span>প্রিমিয়াম রেসিপি ({toBengaliDigits(premiumRecipeItems.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRecipeTab('favorites')}
            className={`hidden md:inline-flex flex-auto items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeRecipeTab === 'favorites'
                ? 'bg-[#B92B27] text-white shadow-sm'
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5 shrink-0" />
            <span>প্রিয় রেসিপি ({toBengaliDigits(favoriteRecipes.length)})</span>
          </button>
        </div>

        {activeRecipeTab === 'free' ? (
          <div className="space-y-3.5">
            {user.role !== 'admin' && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#EEF6EF] border border-[#1B4D24]/20 text-xs text-[#1B4D24]">
                <span className="font-medium leading-relaxed">
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
              <div className="rounded-2xl border border-dashed border-[#1B4D24]/25 bg-[#F7FAF7] px-4 py-6 text-center">
                <p className="text-sm text-[#3A4D3D]">
                  আপনি এখনো কোনো ফ্রি রেসিপি ওপেন করেননি। যেকোনো ফ্রি রেসিপি দেখলে তা এখানে সংরক্ষিত হবে।
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {freeRecipeItems.map(({ recipe, viewedAt }, idx) => (
                  <div
                    key={recipe.id}
                    onClick={() => onNavigate({ page: 'recipe-detail', id: recipe.id })}
                    className="flex items-center gap-3.5 p-3 rounded-2xl border border-[#1B4D24]/18 bg-[#F8FBF8] hover:border-[#1B4D24]/45 hover:bg-[#F0F7F1] cursor-pointer transition-all duration-150 active:scale-[0.985]"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover border border-[#1B4D24]/15"
                      />
                      <span className="font-numeral-bn tabular-nums absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#1B4D24] text-white text-[11px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white">
                        {toBengaliDigits(idx + 1)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#1A1A1A] truncate">{recipe.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] text-[10px] font-bold">
                          ফ্রি রেসিপি
                        </span>
                        <span className="text-xs text-gray-500">{recipe.cookTime}</span>
                      </div>
                      <p className="font-numeral-bn text-[11px] text-[#1B4D24] font-medium mt-1">
                        {viewedAt ? `দেখা হয়েছে: ${formatTimestampBn(viewedAt)}` : 'আনলক করা ফ্রি রেসিপি'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeRecipeTab === 'premium' ? (
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#FFF8E6] border border-[#C69214]/30 text-xs text-[#7A5605]">
              <span className="font-medium leading-relaxed">
                যে প্রিমিয়াম রেসিপি একবার আনলক করবেন, ১ মাসের প্ল্যান শেষ হওয়ার পরও সেটি আপনার জন্য সবসময় আনলক থাকবে।
              </span>
              {user.role !== 'admin' && (
                <span className="font-numeral-bn font-bold tabular-nums text-[#9A6E04]">
                  আনলকড: {toBengaliDigits(premiumUnlockedIds.length)} / {toBengaliDigits(premiumQuotaTotal)} টি
                </span>
              )}
            </div>

            {premiumRecipeItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#C69214]/35 bg-[#FFFDF5] px-4 py-6 text-center space-y-3">
                <p className="text-sm text-[#6B5319]">
                  আপনি এখনো কোনো প্রিমিয়াম রেসিপি আনলক করেননি। প্রো বা স্ট্যান্ডার্ড প্ল্যান নিয়ে প্রিমিয়াম রেসিপি দেখলে তা এখানে চিরস্থায়ীভাবে সংরক্ষিত থাকবে।
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'pricing' })}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#C69214] hover:bg-[#AE7F0E] text-white text-xs font-bold cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  প্রো প্ল্যান দেখুন
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {premiumRecipeItems.map(({ recipe, viewedAt }, idx) => {
                  const seenDateLabel = viewedAt ? formatDayMonthBn(viewedAt) : null;
                  return (
                    <div
                      key={recipe.id}
                      onClick={() => onNavigate({ page: 'recipe-detail', id: recipe.id })}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-[#C69214]/35 bg-gradient-to-br from-[#FFFDF7] to-[#FFF8E6] hover:border-[#C69214]/75 hover:shadow-xs cursor-pointer transition-all duration-150 active:scale-[0.985]"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-xl object-cover ring-1 ring-[#C69214]/30"
                        />
                        <span className="font-numeral-bn tabular-nums absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#C69214] text-white text-[11px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white">
                          {toBengaliDigits(idx + 1)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#1A1A1A] truncate leading-snug">
                          {recipe.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#C69214]/15 text-[#9A6E04] text-[10px] font-bold shrink-0">
                            <Crown className="w-2.5 h-2.5 shrink-0" />
                            প্রিমিয়াম
                          </span>
                          {recipe.cookTime && (
                            <span className="inline-flex items-center gap-1 font-numeral-bn text-[11px] font-medium text-[#6B5319]">
                              <Clock className="w-3 h-3 text-[#B8860B] shrink-0" />
                              <span>{recipe.cookTime}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 pt-1.5 border-t border-[#C69214]/15">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[#1B4D24] text-[10px] font-bold shrink-0">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            চিরস্থায়ী আনলকড
                          </span>
                          {seenDateLabel && (
                            <span className="inline-flex items-center gap-1 font-numeral-bn text-[11px] font-medium text-[#7A5A12] whitespace-nowrap">
                              <Eye className="w-3 h-3 text-[#B8860B] shrink-0" />
                              <span>{seenDateLabel}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : favoriteRecipes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#B92B27]/25 bg-[#FDF7F6] px-4 py-6 text-center">
            <p className="text-sm text-gray-600">
              এখনো কোনো রেসিপি প্রিয় তালিকায় যোগ করা হয়নি। রেসিপির ছবির ওপর লাভ চিহ্নে ক্লিক করে সংরক্ষণ করুন।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {favoriteRecipes.map((recipe, idx) => (
              <div
                key={recipe.id}
                onClick={() => onNavigate({ page: 'recipe-detail', id: recipe.id })}
                className="flex items-center gap-3.5 p-3 rounded-2xl border border-[#B92B27]/18 bg-[#FDF8F7] hover:border-[#B92B27]/45 cursor-pointer transition-all duration-150 active:scale-[0.985]"
              >
                <div className="relative shrink-0">
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover border border-[#B92B27]/15"
                  />
                  <span className="font-numeral-bn tabular-nums absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#B92B27] text-white text-[11px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white">
                    {toBengaliDigits(idx + 1)}
                  </span>
                </div>
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

      {/* Portaled Modals: Always centered on the exact visible mobile/desktop screen */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Profile Picture 2-Option Action Menu */}
            <AnimatePresence>
              {showPhotoMenu && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 h-[100dvh] w-full z-[80] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
                  onClick={() => setShowPhotoMenu(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 6 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-xs bg-white rounded-3xl p-4 shadow-2xl border border-gray-100 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-2 pb-1.5 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-500">প্রোফাইল পিক</span>
                      <button
                        type="button"
                        onClick={() => setShowPhotoMenu(false)}
                        aria-label="বন্ধ করুন"
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer active:scale-90 transition-transform duration-150"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowPhotoMenu(false);
                        setShowPhotoViewer(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-[#F5F7F5] text-left text-sm font-bold text-[#1A1A1A] transition-all duration-150 active:scale-[0.98] cursor-pointer"
                    >
                      <span className="w-9 h-9 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center shrink-0">
                        <Eye className="w-4 h-4" />
                      </span>
                      <span>ভিউ প্রোফাইল পিক</span>
                    </button>

                    <label
                      htmlFor={photoInputId}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-[#F5F7F5] text-left text-sm font-bold text-[#1A1A1A] transition-all duration-150 active:scale-[0.98] cursor-pointer select-none"
                    >
                      <span className="w-9 h-9 rounded-full bg-[#C69214]/15 text-[#9A6E04] flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </span>
                      <span>প্রোফাইল পিক পরিবর্তন করুন</span>
                    </label>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Photo Preview + Save Modal */}
            <AnimatePresence>
              {pendingPhotoPreview && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 h-[100dvh] w-full z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => {
                    if (!uploadingPhoto) setPendingPhotoPreview(null);
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => setPendingPhotoPreview(null)}
                      aria-label="বন্ধ করুন"
                      className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer disabled:opacity-50 active:scale-90 transition-transform duration-150"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div>
                      <h3 className="text-base font-bold text-[#1A1A1A]">প্রোফাইল পিক প্রিভিউ</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ছবিটি পছন্দ হলে নিচের সেভ বাটনে ক্লিক করুন
                      </p>
                    </div>

                    <div className="flex items-center justify-center py-1">
                      <img
                        src={pendingPhotoPreview}
                        alt="নতুন প্রোফাইল ছবি প্রিভিউ"
                        className="w-48 h-48 sm:w-56 sm:h-56 rounded-full object-cover border-4 border-[#1B4D24]/20 shadow-md"
                      />
                    </div>

                    {photoErr && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                        {photoErr}
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        disabled={uploadingPhoto}
                        onClick={handleSavePendingPhoto}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-all duration-150"
                      >
                        {uploadingPhoto ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>{uploadingPhoto ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <label
                          htmlFor={photoInputId}
                          className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer select-none transition-colors ${
                            uploadingPhoto ? 'pointer-events-none opacity-50' : ''
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#1B4D24]" />
                          <span>অন্য ছবি বাছুন</span>
                        </label>
                        <button
                          type="button"
                          disabled={uploadingPhoto}
                          onClick={() => setPendingPhotoPreview(null)}
                          className="py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          বাতিল করুন
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile Picture Lightbox Viewer */}
            <AnimatePresence>
              {showPhotoViewer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 h-[100dvh] w-full z-[80] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => setShowPhotoViewer(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setShowPhotoViewer(false)}
                      aria-label="বন্ধ করুন"
                      className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer active:scale-90 transition-transform duration-150"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <h3 className="text-sm font-bold text-[#1A1A1A]">{user.displayName}</h3>

                    <div className="flex items-center justify-center py-2">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-60 h-60 sm:w-68 sm:h-68 rounded-2xl object-cover border border-gray-200 shadow-md"
                        />
                      ) : (
                        <div className="w-52 h-52 rounded-full bg-[#1B4D24] text-white flex items-center justify-center text-6xl font-bold shadow-md">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                    </div>

                    <label
                      htmlFor={photoInputId}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold cursor-pointer select-none active:scale-[0.98] transition-transform duration-150"
                    >
                      <Camera className="w-4 h-4" />
                      <span>প্রোফাইল পিক পরিবর্তন করুন</span>
                    </label>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}
    </section>
  );
};
