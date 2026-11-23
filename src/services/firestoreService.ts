import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  reauthenticateWithPopup,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  SEED_BLOGS,
  SEED_CATEGORIES,
  SEED_PLANS,
  SEED_RECIPES,
  SEED_SETTINGS,
  SEED_TIPS,
} from '../data/seedData';
import type {
  BlogPost,
  ContactMessage,
  CookingTip,
  PlanTier,
  Recipe,
  RecipeCategory,
  RecipeContent,
  RecipeHistoryEntry,
  SiteSettings,
  SubscriptionPlan,
  UserProfile,
} from '../types';

export const SUPER_ADMIN_EMAIL = 'rannashikhun@gmail.com';
export const FREE_RECIPE_LIMIT = 10;
export const GUEST_READS_KEY = 'rs_guest_free_recipes';
export const getUserLocalReadsKey = (uid: string) => `rs_user_reads_${uid}`;
export const getUserFreeLocalReadsKey = (uid: string) => `rs_user_free_reads_${uid}`;
export const getUserPremiumLocalReadsKey = (uid: string) => `rs_user_premium_reads_${uid}`;
export const getUserHistoryKey = (uid: string) => `rs_recipe_history_${uid}`;

export function isSuperAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
}

export function getSubscriptionExpiresMillis(ts: unknown): number | null {
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (ts && typeof (ts as { seconds?: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return null;
}

export function isPaidPlanActive(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.subscriptionStatus !== 'active') return false;
  if (user.subscriptionPlan !== 'standard' && user.subscriptionPlan !== 'pro') return false;
  const expMs = getSubscriptionExpiresMillis(user.subscriptionExpiresAt);
  return expMs === null || expMs > Date.now();
}

export function getLocalRecipeReads(key = GUEST_READS_KEY): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)))
      : [];
  } catch {
    return [];
  }
}

export function saveLocalRecipeRead(
  recipeId: string,
  key = GUEST_READS_KEY,
  maxCap = 25
): string[] {
  const current = getLocalRecipeReads(key);
  if (current.includes(recipeId)) return current;
  const next = [...current, recipeId].slice(0, maxCap);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function syncLocalRecipeReadsList(
  recipeIds: string[],
  key = GUEST_READS_KEY,
  maxCap = 25
): void {
  const clean = Array.from(
    new Set(recipeIds.filter((x): x is string => typeof x === 'string' && x.length > 0))
  ).slice(0, maxCap);
  try {
    localStorage.setItem(key, JSON.stringify(clean));
  } catch {
    // Ignore storage errors
  }
}

export function clearUserLocalReads(uid: string): void {
  try {
    localStorage.removeItem(getUserLocalReadsKey(uid));
  } catch {
    // Ignore storage errors
  }
}

export function getLocalRecipeHistory(uid: string): RecipeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getUserHistoryKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RecipeHistoryEntry =>
          Boolean(x && typeof x.recipeId === 'string' && typeof x.viewedAt === 'number')
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function saveLocalRecipeHistory(uid: string, recipeId: string): RecipeHistoryEntry[] {
  const current = getLocalRecipeHistory(uid);
  const now = Math.round(Date.now());
  const next: RecipeHistoryEntry[] = [
    { recipeId, viewedAt: now },
    ...current.filter((item) => item.recipeId !== recipeId),
  ].slice(0, 50);
  try {
    localStorage.setItem(getUserHistoryKey(uid), JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

const getInterestSignalsKey = (uid?: string) => `rs_interest_signals_${uid || 'guest'}`;
const getCategoryClicksKey = (uid?: string) => `rs_cat_interest_${uid || 'guest'}`;

export function getRecipeInterestSignals(uid?: string): RecipeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getInterestSignalsKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RecipeHistoryEntry =>
          Boolean(x && typeof x.recipeId === 'string' && typeof x.viewedAt === 'number')
      )
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function recordRecipeInterestSignal(
  uid: string | undefined,
  recipeId: string
): RecipeHistoryEntry[] {
  const current = getRecipeInterestSignals(uid);
  const now = Math.round(Date.now());
  const next: RecipeHistoryEntry[] = [
    { recipeId, viewedAt: now },
    ...current.filter((item) => item.recipeId !== recipeId),
  ].slice(0, 40);
  try {
    localStorage.setItem(getInterestSignalsKey(uid), JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function getCategoryInterestClicks(
  uid?: string
): Array<{ name: string; ts: number }> {
  try {
    const raw = localStorage.getItem(getCategoryClicksKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is { name: string; ts: number } =>
          Boolean(x && typeof x.name === 'string' && typeof x.ts === 'number')
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function recordCategoryInterestClick(
  uid: string | undefined,
  categoryName: string
): void {
  if (!categoryName || categoryName === 'সব') return;
  const current = getCategoryInterestClicks(uid);
  const next = [{ name: categoryName, ts: Date.now() }, ...current].slice(0, 30);
  try {
    localStorage.setItem(getCategoryClicksKey(uid), JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
}

export function getUserFreeUnlockedIds(
  user: UserProfile | null,
  allRecipes: Recipe[] = []
): string[] {
  if (!user) {
    return getLocalRecipeReads(GUEST_READS_KEY);
  }
  if (user.role === 'admin') {
    return [];
  }
  const recipeMap = new Map<string, Recipe>();
  for (const r of allRecipes) {
    recipeMap.set(r.id, r);
  }

  const serverFreeIds = Array.isArray(user.freeUnlockedRecipeIds) ? user.freeUnlockedRecipeIds : [];
  const legacyIds = Array.isArray(user.unlockedRecipeIds) ? user.unlockedRecipeIds : [];
  const legacyFreeIds = legacyIds.filter((id) => {
    const rec = recipeMap.get(id);
    if (rec) return !rec.isPremium;
    return user.subscriptionPlan === 'basic';
  });

  const userLocalFreeIds = getLocalRecipeReads(getUserFreeLocalReadsKey(user.uid));
  const paidActive = isPaidPlanActive(user);

  if (!paidActive) {
    const guestIds = getLocalRecipeReads(GUEST_READS_KEY);
    return Array.from(new Set([...serverFreeIds, ...legacyFreeIds, ...userLocalFreeIds, ...guestIds]));
  }
  return Array.from(new Set([...serverFreeIds, ...legacyFreeIds, ...userLocalFreeIds]));
}

export function getUserPremiumUnlockedIds(
  user: UserProfile | null,
  allRecipes: Recipe[] = []
): string[] {
  if (!user || user.role === 'admin') {
    return [];
  }
  const recipeMap = new Map<string, Recipe>();
  for (const r of allRecipes) {
    recipeMap.set(r.id, r);
  }

  const serverPremiumIds = Array.isArray(user.premiumUnlockedRecipeIds)
    ? user.premiumUnlockedRecipeIds
    : [];
  const legacyIds = Array.isArray(user.unlockedRecipeIds) ? user.unlockedRecipeIds : [];
  const legacyPremiumIds = legacyIds.filter((id) => recipeMap.get(id)?.isPremium === true);
  const localPremiumIds = getLocalRecipeReads(getUserPremiumLocalReadsKey(user.uid));

  return Array.from(new Set([...serverPremiumIds, ...legacyPremiumIds, ...localPremiumIds]));
}

export function getUserPremiumQuota(
  user: UserProfile | null,
  plans: SubscriptionPlan[] = [],
  allRecipes: Recipe[] = []
): number {
  if (!user) return 0;
  if (user.role === 'admin') return 9999;

  const unlockedCount = getUserPremiumUnlockedIds(user, allRecipes).length;
  const storedQuota =
    typeof user.premiumRecipeQuota === 'number' && user.premiumRecipeQuota > 0
      ? user.premiumRecipeQuota
      : 0;

  if (isPaidPlanActive(user)) {
    if (storedQuota > 0) {
      return Math.max(storedQuota, unlockedCount);
    }
    return Math.max(getRecipeQuotaLimit(user.subscriptionPlan, plans), unlockedCount);
  }

  return Math.max(storedQuota, unlockedCount);
}

export function getRemainingNewPremiumSlots(
  user: UserProfile | null,
  plans: SubscriptionPlan[] = [],
  allRecipes: Recipe[] = []
): number {
  if (!user) return 0;
  if (user.role === 'admin') return 9999;
  if (!isPaidPlanActive(user)) return 0;
  const totalQuota = getUserPremiumQuota(user, plans, allRecipes);
  const used = getUserPremiumUnlockedIds(user, allRecipes).length;
  return Math.max(0, totalQuota - used);
}

export function getEffectiveUsedRecipeIds(
  user: UserProfile | null,
  _plans: SubscriptionPlan[] = [],
  allRecipes: Recipe[] = []
): string[] {
  if (!user) {
    return getLocalRecipeReads(GUEST_READS_KEY);
  }
  if (user.role === 'admin') {
    return [];
  }
  if (isPaidPlanActive(user)) {
    return getUserPremiumUnlockedIds(user, allRecipes);
  }
  return getUserFreeUnlockedIds(user, allRecipes);
}

export const PHONE_EMAIL_DOMAIN = '@phone.rannashikhun.app';

export function resolveAuthIdentifier(rawInput: string): {
  authEmail: string;
  isPhone: boolean;
  phoneNumber?: string;
} {
  const trimmed = rawInput.trim();
  if (trimmed.includes('@')) {
    return {
      authEmail: trimmed.toLowerCase(),
      isPhone: false,
    };
  }
  const bengaliToEnglish = trimmed.replace(/[০-৯]/g, (d) =>
    String('০১২৩৪৫৬৭৮৯'.indexOf(d))
  );
  let digits = bengaliToEnglish.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    digits = `88${digits}`;
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  const displayPhone =
    digits.startsWith('8801') && digits.length === 13
      ? `0${digits.slice(3)}`
      : trimmed;

  return {
    authEmail: `p${digits}${PHONE_EMAIL_DOMAIN}`,
    isPhone: true,
    phoneNumber: displayPhone,
  };
}

export function formatUserContact(email: string, phoneNumber?: string): string {
  if (phoneNumber && phoneNumber.trim()) {
    return phoneNumber.trim();
  }
  if (email && email.endsWith(PHONE_EMAIL_DOMAIN)) {
    const raw = email.slice(1, email.length - PHONE_EMAIL_DOMAIN.length);
    if (raw.startsWith('8801') && raw.length === 13) {
      return `0${raw.slice(3)}`;
    }
    return `+${raw}`;
  }
  return email;
}

const inFlightProfileSyncs = new Map<string, Promise<UserProfile>>();

export async function syncUserProfile(
  firebaseUser: User,
  overrides?: { displayName?: string; phoneNumber?: string }
): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const hasOverrides = Boolean(overrides?.displayName || overrides?.phoneNumber);
  const existingPromise = inFlightProfileSyncs.get(uid);

  if (existingPromise) {
    if (!hasOverrides) {
      return existingPromise;
    }
    try {
      await existingPromise;
    } catch {
      // Proceed to run a fresh sync with overrides
    }
  }

  const syncPromise = syncUserProfileInternal(firebaseUser, overrides).finally(() => {
    if (inFlightProfileSyncs.get(uid) === syncPromise) {
      inFlightProfileSyncs.delete(uid);
    }
  });
  inFlightProfileSyncs.set(uid, syncPromise);
  return syncPromise;
}

async function syncUserProfileInternal(
  firebaseUser: User,
  overrides?: { displayName?: string; phoneNumber?: string }
): Promise<UserProfile> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const adminCheck = isSuperAdminEmail(firebaseUser.email);
  const isVerifiedSuperAdmin = adminCheck && firebaseUser.emailVerified;

  if (firebaseUser.emailVerified) {
    try {
      await firebaseUser.getIdToken(true);
    } catch {
      // Proceed with existing token if force refresh fails offline
    }
  }

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
  }

  const derivedPhone = (
    overrides?.phoneNumber ||
    (firebaseUser.email?.endsWith(PHONE_EMAIL_DOMAIN)
      ? formatUserContact(firebaseUser.email)
      : undefined)
  )
    ?.trim()
    .slice(0, 40);

  if (!snap.exists()) {
    const carriedGuestReads = isVerifiedSuperAdmin
      ? []
      : Array.from(
          new Set([
            ...getLocalRecipeReads(GUEST_READS_KEY),
            ...getLocalRecipeReads(getUserLocalReadsKey(firebaseUser.uid)),
          ])
        ).slice(0, 10);

    const rawName =
      overrides?.displayName ||
      firebaseUser.displayName ||
      (derivedPhone ? `সদস্য (${derivedPhone})` : firebaseUser.email?.split('@')[0]) ||
      'অতিথি রাঁধুনি';
    const resolvedName = rawName.trim().slice(0, 100) || 'অতিথি রাঁধুনি';
    const safeEmail = (firebaseUser.email || '').slice(0, 160);
    const safePhoto =
      firebaseUser.photoURL && firebaseUser.photoURL.length <= 160000
        ? firebaseUser.photoURL
        : undefined;

    const newProfile: Record<string, unknown> = {
      uid: firebaseUser.uid,
      displayName: resolvedName,
      email: safeEmail,
      role: isVerifiedSuperAdmin ? 'admin' : 'member',
      subscriptionPlan: isVerifiedSuperAdmin ? 'pro' : 'basic',
      subscriptionStatus: 'active',
      favoriteRecipeIds: [],
      unlockedRecipeIds: carriedGuestReads,
      freeUnlockedRecipeIds: carriedGuestReads,
      premiumUnlockedRecipeIds: [],
      premiumRecipeQuota: 0,
      viewedHistory: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (derivedPhone) {
      newProfile.phoneNumber = derivedPhone;
    }
    if (safePhoto) {
      newProfile.photoURL = safePhoto;
    }

    if (!isVerifiedSuperAdmin) {
      syncLocalRecipeReadsList(carriedGuestReads, getUserFreeLocalReadsKey(firebaseUser.uid), FREE_RECIPE_LIMIT);
      syncLocalRecipeReadsList(carriedGuestReads, GUEST_READS_KEY, FREE_RECIPE_LIMIT);
    }

    try {
      await setDoc(userRef, newProfile);
      return {
        uid: firebaseUser.uid,
        displayName: resolvedName,
        email: safeEmail,
        phoneNumber: derivedPhone,
        photoURL: safePhoto,
        role: isVerifiedSuperAdmin ? 'admin' : 'member',
        subscriptionPlan: isVerifiedSuperAdmin ? 'pro' : 'basic',
        subscriptionStatus: 'active',
        favoriteRecipeIds: [],
        unlockedRecipeIds: carriedGuestReads,
        freeUnlockedRecipeIds: carriedGuestReads,
        premiumUnlockedRecipeIds: [],
        premiumRecipeQuota: 0,
        viewedHistory: [],
      };
    } catch (error) {
      // If another tab or concurrent call created the document first, read it instead of failing
      try {
        const retrySnap = await getDoc(userRef);
        if (retrySnap.exists()) {
          snap = retrySnap;
        } else {
          handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`);
        }
      } catch {
        handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`);
      }
    }
  }

  const data = snap.data() as UserProfile;
  let isAdminDoc = false;
  if (firebaseUser.emailVerified) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
      isAdminDoc = adminSnap.exists();
    } catch {
      isAdminDoc = false;
    }
  }

  if (
    isVerifiedSuperAdmin &&
    (data.role !== 'admin' || data.subscriptionPlan !== 'pro' || data.subscriptionStatus !== 'active')
  ) {
    try {
      await updateDoc(userRef, {
        role: 'admin',
        subscriptionPlan: 'pro',
        subscriptionStatus: 'active',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  }

  const effectiveRole =
    isVerifiedSuperAdmin || (firebaseUser.emailVerified && (isAdminDoc || data.role === 'admin'))
      ? 'admin'
      : 'member';

  const existingFreeUnlocked = Array.isArray(data.freeUnlockedRecipeIds)
    ? data.freeUnlockedRecipeIds
    : data.subscriptionPlan === 'basic' && Array.isArray(data.unlockedRecipeIds)
      ? data.unlockedRecipeIds
      : [];
  const existingPremiumUnlocked = Array.isArray(data.premiumUnlockedRecipeIds)
    ? data.premiumUnlockedRecipeIds
    : [];
  let syncedFreeUnlocked = existingFreeUnlocked;

  const paidActiveNow =
    effectiveRole !== 'admin' &&
    data.subscriptionStatus === 'active' &&
    (data.subscriptionPlan === 'standard' || data.subscriptionPlan === 'pro') &&
    (getSubscriptionExpiresMillis(data.subscriptionExpiresAt) === null ||
      (getSubscriptionExpiresMillis(data.subscriptionExpiresAt) as number) > Date.now());

  if (effectiveRole !== 'admin') {
    const localUserFree = getLocalRecipeReads(getUserFreeLocalReadsKey(firebaseUser.uid));
    const guestReads = paidActiveNow ? [] : getLocalRecipeReads(GUEST_READS_KEY);
    const mergedFree =
      existingFreeUnlocked.length >= FREE_RECIPE_LIMIT
        ? existingFreeUnlocked
        : Array.from(new Set([...existingFreeUnlocked, ...localUserFree, ...guestReads])).slice(
            0,
            FREE_RECIPE_LIMIT
          );

    syncedFreeUnlocked = mergedFree;
    syncLocalRecipeReadsList(
      mergedFree,
      getUserFreeLocalReadsKey(firebaseUser.uid),
      Math.max(FREE_RECIPE_LIMIT, mergedFree.length)
    );
    if (!paidActiveNow) {
      syncLocalRecipeReadsList(mergedFree, GUEST_READS_KEY, FREE_RECIPE_LIMIT);
    }

    if (
      mergedFree.length <= FREE_RECIPE_LIMIT &&
      (!Array.isArray(data.freeUnlockedRecipeIds) || mergedFree.length > existingFreeUnlocked.length)
    ) {
      try {
        await updateDoc(userRef, {
          freeUnlockedRecipeIds: mergedFree,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore non-fatal sync update failure
      }
    }
  }

  if (effectiveRole !== 'admin' && existingPremiumUnlocked.length > 0) {
    syncLocalRecipeReadsList(
      existingPremiumUnlocked,
      getUserPremiumLocalReadsKey(firebaseUser.uid),
      500
    );
  }

  const pendingProfilePatches: Record<string, unknown> = {};
  if (overrides?.displayName && overrides.displayName !== data.displayName) {
    pendingProfilePatches.displayName = overrides.displayName;
  }
  if ((overrides?.phoneNumber || derivedPhone) && !data.phoneNumber) {
    pendingProfilePatches.phoneNumber = overrides?.phoneNumber || derivedPhone;
  }
  if (Object.keys(pendingProfilePatches).length > 0) {
    try {
      await updateDoc(userRef, {
        ...pendingProfilePatches,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore non-fatal patch failure
    }
  }

  const mergedHistory =
    Array.isArray(data.viewedHistory) && data.viewedHistory.length > 0
      ? data.viewedHistory
      : getLocalRecipeHistory(firebaseUser.uid);

  return {
    ...data,
    uid: firebaseUser.uid,
    displayName: (pendingProfilePatches.displayName as string) || data.displayName,
    phoneNumber: (pendingProfilePatches.phoneNumber as string) || data.phoneNumber || derivedPhone,
    role: effectiveRole,
    favoriteRecipeIds: Array.isArray(data.favoriteRecipeIds) ? data.favoriteRecipeIds : [],
    unlockedRecipeIds: Array.isArray(data.unlockedRecipeIds) ? data.unlockedRecipeIds : [],
    freeUnlockedRecipeIds: syncedFreeUnlocked,
    premiumUnlockedRecipeIds: existingPremiumUnlocked,
    premiumRecipeQuota: typeof data.premiumRecipeQuota === 'number' ? data.premiumRecipeQuota : 0,
    viewedHistory: mergedHistory,
    subscriptionPlan: isVerifiedSuperAdmin ? 'pro' : data.subscriptionPlan,
    subscriptionStatus: isVerifiedSuperAdmin ? 'active' : data.subscriptionStatus,
  };
}

export async function seedInitialDatabaseIfNeeded(force = false): Promise<boolean> {
  try {
    if (!force) {
      const existingRecipes = await getDocs(collection(db, 'recipes'));
      if (!existingRecipes.empty) {
        // Auto-upgrade legacy plans (899/1499 yearly) to 1-month 0/100/200 plans & stepImages if outdated
        const stdSnap = await getDoc(doc(db, 'subscriptionPlans', 'standard'));
        if (stdSnap.exists() && stdSnap.data()?.priceAmount === 899) {
          const migrateBatch = writeBatch(db);
          for (const plan of SEED_PLANS) {
            const { id: planId, ...planFields } = plan;
            migrateBatch.set(doc(db, 'subscriptionPlans', planId), {
              ...planFields,
              updatedAt: serverTimestamp(),
            });
          }
          for (const item of SEED_RECIPES) {
            migrateBatch.set(doc(db, 'recipes', item.recipe.id, 'content', 'detail'), {
              ...item.content,
              updatedAt: serverTimestamp(),
            });
          }
          await migrateBatch.commit();
        }
        const existingCats = await getDocs(collection(db, 'categories'));
        if (existingCats.empty) {
          const catBatch = writeBatch(db);
          for (const cat of SEED_CATEGORIES) {
            const { id: catId, ...catFields } = cat;
            catBatch.set(doc(db, 'categories', catId), {
              ...catFields,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await catBatch.commit();
        } else if (
          !localStorage.getItem('rs_seeded_chinese_v1') &&
          !existingCats.docs.some((d) => d.id === 'cat-chinese' || d.data()?.name === 'চাইনিজ রেসিপি')
        ) {
          const chineseCat = SEED_CATEGORIES.find((c) => c.id === 'cat-chinese');
          if (chineseCat) {
            const { id: catId, ...catFields } = chineseCat;
            await setDoc(doc(db, 'categories', catId), {
              ...catFields,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            try {
              localStorage.setItem('rs_seeded_chinese_v1', '1');
            } catch {
              // ignore storage errors
            }
          }
        }
        if (!localStorage.getItem('rs_migrated_default_seo_v2')) {
          try {
            const settingsSnap = await getDoc(doc(db, 'siteSettings', 'main'));
            if (settingsSnap.exists()) {
              await updateDoc(doc(db, 'siteSettings', 'main'), {
                seoTitle: SEED_SETTINGS.seoTitle,
                seoDescription: SEED_SETTINGS.seoDescription,
                socialShareTitle: SEED_SETTINGS.socialShareTitle,
                socialShareDescription: SEED_SETTINGS.socialShareDescription,
                socialShareImageAlt: SEED_SETTINGS.socialShareImageAlt,
                socialShareImageUrl: '',
                updatedAt: serverTimestamp(),
              });
            }
            localStorage.setItem('rs_migrated_default_seo_v2', '1');
          } catch {
            // Non-fatal if offline or non-admin
          }
        }
        return false;
      }
    }

    const [existingRecipesSnap, existingCatsSnap, existingTipsSnap, existingBlogsSnap] =
      await Promise.all([
        getDocs(collection(db, 'recipes')),
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'tips')),
        getDocs(collection(db, 'blogPosts')),
      ]);

    const extractCreatedAtMap = (snap: Awaited<ReturnType<typeof getDocs>>) => {
      const map = new Map<string, unknown>();
      snap.forEach((d) => {
        const data = d.data() as { createdAt?: unknown };
        if (data?.createdAt) {
          map.set(d.id, data.createdAt);
        }
      });
      return map;
    };

    const recipeCreatedAtMap = extractCreatedAtMap(existingRecipesSnap);
    const catCreatedAtMap = extractCreatedAtMap(existingCatsSnap);
    const tipCreatedAtMap = extractCreatedAtMap(existingTipsSnap);
    const blogCreatedAtMap = extractCreatedAtMap(existingBlogsSnap);

    const batch = writeBatch(db);

    for (const cat of SEED_CATEGORIES) {
      const { id: catId, ...catFields } = cat;
      batch.set(doc(db, 'categories', catId), {
        ...catFields,
        createdAt: catCreatedAtMap.get(catId) ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const item of SEED_RECIPES) {
      const { id: recipeId, ...recipeFields } = item.recipe;
      const rRef = doc(db, 'recipes', recipeId);
      batch.set(rRef, {
        ...recipeFields,
        createdAt: recipeCreatedAtMap.get(recipeId) ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const cRef = doc(db, 'recipes', recipeId, 'content', 'detail');
      batch.set(cRef, {
        ...item.content,
        updatedAt: serverTimestamp(),
      });
    }

    for (const plan of SEED_PLANS) {
      const { id: planId, ...planFields } = plan;
      batch.set(doc(db, 'subscriptionPlans', planId), {
        ...planFields,
        updatedAt: serverTimestamp(),
      });
    }

    for (const tip of SEED_TIPS) {
      const { id: tipId, ...tipFields } = tip;
      batch.set(doc(db, 'tips', tipId), {
        ...tipFields,
        createdAt: tipCreatedAtMap.get(tipId) ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const post of SEED_BLOGS) {
      const { id: postId, ...blogFields } = post;
      batch.set(doc(db, 'blogPosts', postId), {
        ...blogFields,
        createdAt: blogCreatedAtMap.get(postId) ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'siteSettings', 'main'), {
      ...SEED_SETTINGS,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedInitialDatabase');
  }
}

function getTimestampMillis(ts: unknown, idFallbackPrefix?: string, id?: string): number {
  const obj = ts as { toMillis?: () => number; seconds?: number } | undefined;
  if (obj && typeof obj.toMillis === 'function') return obj.toMillis();
  if (obj && typeof obj.seconds === 'number') return obj.seconds * 1000;
  if (idFallbackPrefix && id && id.startsWith(idFallbackPrefix)) {
    const parsed = Number(id.slice(idFallbackPrefix.length));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

export function sortRecipesNewestFirst(list: Recipe[]): Recipe[] {
  return [...list].sort((a, b) => {
    const diff =
      getTimestampMillis(b.createdAt, 'recipe_', b.id) -
      getTimestampMillis(a.createdAt, 'recipe_', a.id);
    if (Math.abs(diff) > 1000) return diff;
    return (b.orderIndex || 0) - (a.orderIndex || 0);
  });
}

export function sortByOrderIndexAsc<T extends { orderIndex?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));
}

export function sortByNewestCreatedAt<T extends { id: string; createdAt?: unknown }>(
  list: T[],
  idPrefix?: string
): T[] {
  return [...list].sort((a, b) => {
    const diff =
      getTimestampMillis(b.createdAt, idPrefix, b.id) -
      getTimestampMillis(a.createdAt, idPrefix, a.id);
    return diff;
  });
}

export async function fetchLiveCatalogFromServer(): Promise<{
  recipes?: Recipe[];
  categories?: RecipeCategory[];
  plans?: SubscriptionPlan[];
  tips?: CookingTip[];
  blogPosts?: BlogPost[];
  siteSettings?: SiteSettings;
}> {
  const result: {
    recipes?: Recipe[];
    categories?: RecipeCategory[];
    plans?: SubscriptionPlan[];
    tips?: CookingTip[];
    blogPosts?: BlogPost[];
    siteSettings?: SiteSettings;
  } = {};

  const [recipesRes, catsRes, plansRes, tipsRes, blogsRes, settingsRes] =
    await Promise.allSettled([
      getDocsFromServer(collection(db, 'recipes')),
      getDocsFromServer(collection(db, 'categories')),
      getDocsFromServer(collection(db, 'subscriptionPlans')),
      getDocsFromServer(collection(db, 'tips')),
      getDocsFromServer(collection(db, 'blogPosts')),
      getDocFromServer(doc(db, 'siteSettings', 'main')),
    ]);

  if (recipesRes.status === 'fulfilled' && !recipesRes.value.empty) {
    result.recipes = sortRecipesNewestFirst(
      recipesRes.value.docs.map((d) => ({ ...(d.data() as Recipe), id: d.id }))
    );
  }
  if (catsRes.status === 'fulfilled' && !catsRes.value.empty) {
    result.categories = sortByOrderIndexAsc(
      catsRes.value.docs.map((d) => ({ ...(d.data() as RecipeCategory), id: d.id }))
    );
  }
  if (plansRes.status === 'fulfilled' && !plansRes.value.empty) {
    result.plans = sortByOrderIndexAsc(
      plansRes.value.docs.map((d) => ({ ...(d.data() as SubscriptionPlan), id: d.id }))
    );
  }
  if (tipsRes.status === 'fulfilled' && !tipsRes.value.empty) {
    result.tips = sortByNewestCreatedAt(
      tipsRes.value.docs.map((d) => ({ ...(d.data() as CookingTip), id: d.id })),
      'tip_'
    );
  }
  if (blogsRes.status === 'fulfilled' && !blogsRes.value.empty) {
    result.blogPosts = sortByNewestCreatedAt(
      blogsRes.value.docs.map((d) => ({ ...(d.data() as BlogPost), id: d.id })),
      'blog_'
    );
  }
  if (settingsRes.status === 'fulfilled' && settingsRes.value.exists()) {
    result.siteSettings = settingsRes.value.data() as SiteSettings;
  }

  return result;
}

export async function fetchRecipeContent(recipeId: string, isPremium: boolean, hasAccess: boolean): Promise<{ content: RecipeContent | null; locked: boolean }> {
  if (isPremium && !hasAccess) {
    return { content: null, locked: true };
  }

  try {
    const contentRef = doc(db, 'recipes', recipeId, 'content', 'detail');
    let snap;
    try {
      snap = await getDocFromServer(contentRef);
    } catch {
      snap = await getDoc(contentRef);
    }
    if (snap.exists()) {
      return { content: snap.data() as RecipeContent, locked: false };
    }
    const localSeed = SEED_RECIPES.find((r) => r.recipe.id === recipeId);
    if (localSeed) {
      return { content: localSeed.content, locked: false };
    }
    return { content: null, locked: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Missing or insufficient permissions')) {
      return { content: null, locked: true };
    }
    const localSeed = SEED_RECIPES.find((r) => r.recipe.id === recipeId);
    if (localSeed && (!isPremium || hasAccess)) {
      return { content: localSeed.content, locked: false };
    }
    handleFirestoreError(error, OperationType.GET, `recipes/${recipeId}/content/detail`);
  }
}

export function getRecipeQuotaLimit(planTier: PlanTier, plans: SubscriptionPlan[]): number {
  const matched = plans.find((p) => p.tier === planTier);
  if (matched?.recipeLimit && matched.recipeLimit > 0) {
    return matched.recipeLimit;
  }
  return planTier === 'pro' ? 25 : 10;
}

export async function recordFreeRecipeUnlock(
  uid: string,
  currentFreeIds: string[],
  recipeId: string,
  isPaidActive = false
): Promise<string[]> {
  if (currentFreeIds.includes(recipeId) || currentFreeIds.length >= FREE_RECIPE_LIMIT) {
    return currentFreeIds;
  }
  const deduped = Array.from(new Set([...currentFreeIds, recipeId])).slice(0, FREE_RECIPE_LIMIT);
  syncLocalRecipeReadsList(deduped, getUserFreeLocalReadsKey(uid), FREE_RECIPE_LIMIT);
  if (!isPaidActive) {
    syncLocalRecipeReadsList(deduped, GUEST_READS_KEY, FREE_RECIPE_LIMIT);
  }

  if (!auth.currentUser) {
    return deduped;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      freeUnlockedRecipeIds: deduped,
      updatedAt: serverTimestamp(),
    });
    return deduped;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function recordPremiumRecipeUnlock(
  uid: string,
  currentPremiumIds: string[],
  recipeId: string,
  maxPremiumQuota: number
): Promise<string[]> {
  if (currentPremiumIds.includes(recipeId)) {
    return currentPremiumIds;
  }
  const safeCap = Math.min(500, Math.max(maxPremiumQuota, currentPremiumIds.length));
  const deduped = Array.from(new Set([...currentPremiumIds, recipeId])).slice(0, safeCap);
  syncLocalRecipeReadsList(deduped, getUserPremiumLocalReadsKey(uid), 500);

  if (!auth.currentUser) {
    return deduped;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      premiumUnlockedRecipeIds: deduped,
      updatedAt: serverTimestamp(),
    });
    return deduped;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function recordRecipeUnlock(
  uid: string,
  unlockedRecipeIds: string[],
  recipeId: string,
  planTier: PlanTier = 'basic'
): Promise<string[]> {
  return recordFreeRecipeUnlock(uid, unlockedRecipeIds, recipeId, planTier !== 'basic');
}

const inMemoryNotifSent = new Set<string>();

export async function ensureUserSystemNotification(
  uid: string,
  notifId: string,
  payload: {
    type: 'free_limit_reached' | 'pro_limit_reached' | 'plan_expiry_reminder';
    title: string;
    message: string;
    recipeId?: string;
  }
): Promise<boolean> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return false;
  const cacheKey = `rs_sys_notif_${uid}_${notifId}`;
  if (inMemoryNotifSent.has(cacheKey)) return false;
  try {
    if (localStorage.getItem(cacheKey) === '1') {
      inMemoryNotifSent.add(cacheKey);
      return false;
    }
  } catch {
    // ignore storage errors
  }

  const notifRef = doc(db, 'users', uid, 'notifications', notifId);
  try {
    const existingSnap = await getDoc(notifRef);
    if (existingSnap.exists()) {
      inMemoryNotifSent.add(cacheKey);
      try {
        localStorage.setItem(cacheKey, '1');
      } catch {
        // ignore
      }
      return false;
    }

    const docData: Record<string, unknown> = {
      type: payload.type,
      title: payload.title.slice(0, 140),
      message: payload.message.slice(0, 400),
      isRead: false,
      createdAt: serverTimestamp(),
    };
    if (payload.recipeId) {
      docData.recipeId = payload.recipeId;
    }

    await setDoc(notifRef, docData);
    inMemoryNotifSent.add(cacheKey);
    try {
      localStorage.setItem(cacheKey, '1');
    } catch {
      // ignore
    }
    return true;
  } catch {
    return false;
  }
}

export async function notifyFreeLimitReached(uid: string): Promise<boolean> {
  return ensureUserSystemNotification(uid, 'ntf_free_limit_10', {
    type: 'free_limit_reached',
    title: 'ফ্রি রেসিপির লিমিট শেষ হয়েছে',
    message:
      'আপনার সর্বোচ্চ ১০টি ফ্রি রেসিপি দেখার লিমিট শেষ হয়ে গেছে। নতুন প্রিমিয়াম রেসিপি দেখতে প্ল্যান কিনুন বা আপগ্রেড করুন। (প্ল্যান আপগ্রেড করলে শুধু প্রিমিয়াম রেসিপির কোটা বাড়ে; ফ্রি রেসিপি সর্বোচ্চ ১০টিই দেখা যায়।)',
  });
}

export async function notifyProLimitReached(uid: string, totalQuota: number): Promise<boolean> {
  const safeQuota = Math.max(1, Math.round(totalQuota));
  return ensureUserSystemNotification(uid, `ntf_pro_limit_${safeQuota}`, {
    type: 'pro_limit_reached',
    title: 'প্রো প্ল্যানের রেসিপি লিমিট শেষ হয়েছে',
    message:
      'আপনার প্রো প্ল্যানের নির্ধারিত সব প্রিমিয়াম রেসিপি দেখার লিমিট শেষ হয়ে গেছে। আরও নতুন প্রিমিয়াম রেসিপি দেখতে প্ল্যান আপগ্রেড করুন বা নতুন প্যাক কিনুন। (আগে দেখা প্রিমিয়াম রেসিপিগুলো সবসময় আনলক থাকবে।)',
  });
}

export async function checkAndNotifyPlanExpiry(
  user: UserProfile | null
): Promise<{ notified: boolean; isExpired: boolean; isExpiringSoon: boolean; message?: string }> {
  if (!user || user.role === 'admin') {
    return { notified: false, isExpired: false, isExpiringSoon: false };
  }
  if (user.subscriptionPlan !== 'standard' && user.subscriptionPlan !== 'pro') {
    return { notified: false, isExpired: false, isExpiringSoon: false };
  }
  const expMs = getSubscriptionExpiresMillis(user.subscriptionExpiresAt);
  if (expMs === null) {
    return { notified: false, isExpired: false, isExpiringSoon: false };
  }

  const remainingMs = expMs - Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (remainingMs > ONE_DAY_MS) {
    return { notified: false, isExpired: false, isExpiringSoon: false };
  }

  const isExpired = remainingMs <= 0;
  const dayBucket = Math.floor(expMs / ONE_DAY_MS);
  const notifId = isExpired ? `ntf_plan_expired_${dayBucket}` : `ntf_plan_expiring_${dayBucket}`;
  const planLabel = user.subscriptionPlan === 'pro' ? 'প্রো' : 'স্ট্যান্ডার্ড';
  const expDateLabel = new Date(expMs).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const title = isExpired
    ? `${planLabel} প্ল্যানের মেয়াদ শেষ হয়েছে — রিনিউ করুন`
    : `${planLabel} প্ল্যানের মেয়াদ ১ দিনের মধ্যে শেষ হবে`;

  const message = isExpired
    ? `আপনার ${planLabel} প্ল্যানের ১ মাসের মেয়াদ শেষ হয়ে গেছে। নতুন প্রিমিয়াম রেসিপি দেখতে অনুগ্রহ করে প্ল্যান রিনিউ করুন। আপনার আগে দেখা প্রিমিয়াম রেসিপিগুলো সবসময় আনলক থাকবে।`
    : `আপনার ${planLabel} প্ল্যানের ১ মাসের মেয়াদ আগামী ১ দিনের মধ্যে (${expDateLabel}) শেষ হয়ে যাবে। নিরবচ্ছিন্নভাবে নতুন রেসিপি দেখতে এখনই প্ল্যান রিনিউ করুন।`;

  const notified = await ensureUserSystemNotification(user.uid, notifId, {
    type: 'plan_expiry_reminder',
    title,
    message,
  });

  return {
    notified,
    isExpired,
    isExpiringSoon: !isExpired,
    message: notified ? title : undefined,
  };
}

export async function updateUserProfilePhoto(uid: string, photoURL: string): Promise<void> {
  if (!photoURL || photoURL.length > 158000) {
    throw new Error('ছবির সাইজ অনুমোদিত সীমার চেয়ে বড়। অনুগ্রহ করে অন্য ছবি দিন।');
  }
  try {
    await updateDoc(doc(db, 'users', uid), {
      photoURL,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateUserProfileDetails(
  uid: string,
  payload: {
    displayName?: string;
    address?: string;
    age?: number | null;
    photoURL?: string;
  }
): Promise<{
  displayName?: string;
  address?: string;
  age?: number;
  photoURL?: string;
}> {
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  const result: {
    displayName?: string;
    address?: string;
    age?: number;
    photoURL?: string;
  } = {};

  if (payload.displayName !== undefined) {
    const cleanName = payload.displayName.trim().slice(0, 100);
    if (cleanName.length < 1) {
      throw new Error('অনুগ্রহ করে আপনার সঠিক নাম লিখুন।');
    }
    updates.displayName = cleanName;
    result.displayName = cleanName;
  }

  if (payload.address !== undefined) {
    const cleanAddress = payload.address.trim().slice(0, 240);
    if (cleanAddress.length > 0) {
      updates.address = cleanAddress;
      result.address = cleanAddress;
    } else {
      updates.address = deleteField();
      result.address = undefined;
    }
  }

  if (payload.age !== undefined) {
    if (payload.age === null) {
      updates.age = deleteField();
      result.age = undefined;
    } else {
      const parsedAge = Math.round(Number(payload.age));
      if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        throw new Error('বয়স ১ থেকে ১২০ এর মধ্যে লিখুন।');
      }
      updates.age = parsedAge;
      result.age = parsedAge;
    }
  }

  if (payload.photoURL !== undefined) {
    if (!payload.photoURL || payload.photoURL.length > 158000) {
      throw new Error('ছবির সাইজ অনুমোদিত সীমার চেয়ে বড়।');
    }
    updates.photoURL = payload.photoURL;
    result.photoURL = payload.photoURL;
  }

  try {
    await updateDoc(doc(db, 'users', uid), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  if (result.displayName && auth.currentUser && auth.currentUser.uid === uid) {
    try {
      await updateProfile(auth.currentUser, { displayName: result.displayName });
    } catch {
      // Non-fatal if auth profile sync fails while Firestore succeeded
    }
  }

  return result;
}

export async function changeUserPasswordDirect(newPassword: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    throw new Error('পাসওয়ার্ড পরিবর্তন করতে অনুগ্রহ করে লগইন করুন।');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
  }
  if (newPassword.length > 128) {
    throw new Error('পাসওয়ার্ড ১২৮ অক্ষরের বেশি হতে পারবে না।');
  }

  try {
    await updatePassword(fbUser, newPassword);
    return;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    const hasGoogleProvider = fbUser.providerData.some((p) => p.providerId === 'google.com');

    if (code === 'auth/requires-recent-login' && hasGoogleProvider) {
      try {
        await reauthenticateWithPopup(fbUser, googleProvider);
        await updatePassword(fbUser, newPassword);
        return;
      } catch (reauthErr: unknown) {
        const reCode = (reauthErr as { code?: string })?.code || '';
        if (reCode === 'auth/popup-closed-by-user') {
          throw new Error('Google পপআপ বন্ধ করা হয়েছে। আবার চেষ্টা করুন।');
        }
        throw new Error('পাসওয়ার্ড আপডেট করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    }

    if (code === 'auth/requires-recent-login') {
      throw new Error(
        'REQUIRES_RECENT_LOGIN'
      );
    }
    if (code === 'auth/weak-password') {
      throw new Error('পাসওয়ার্ডটি খুবই দুর্বল। অনুগ্রহ করে অন্তত ৬ অক্ষরের শক্তিশালী পাসওয়ার্ড দিন।');
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error('এই প্রজেক্টে Email/Password সাইন-ইন চালু করা নেই।');
    }
    throw new Error('পাসওয়ার্ড পরিবর্তন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }
}

export async function toggleFavoriteRecipe(uid: string, favoriteRecipeIds: string[], recipeId: string): Promise<string[]> {
  const exists = favoriteRecipeIds.includes(recipeId);
  const updated = exists
    ? favoriteRecipeIds.filter((id) => id !== recipeId)
    : [...favoriteRecipeIds, recipeId].slice(0, 100);

  try {
    await updateDoc(doc(db, 'users', uid), {
      favoriteRecipeIds: updated,
      updatedAt: serverTimestamp(),
    });
    return updated;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function recordRecipeViewHistory(
  uid: string,
  currentHistory: RecipeHistoryEntry[] = [],
  recipeId: string
): Promise<RecipeHistoryEntry[]> {
  const existingTop = currentHistory[0];
  const now = Math.round(Date.now());
  if (existingTop && existingTop.recipeId === recipeId && now - existingTop.viewedAt < 60000) {
    return currentHistory;
  }

  saveLocalRecipeHistory(uid, recipeId);
  const next: RecipeHistoryEntry[] = [
    { recipeId, viewedAt: now },
    ...currentHistory.filter((item) => item.recipeId !== recipeId),
  ].slice(0, 50);

  if (!auth.currentUser) {
    return next;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      viewedHistory: next,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if offline or guest preview
  }
  return next;
}

export async function addRecipeComment(
  recipeId: string,
  user: UserProfile,
  text: string,
  replyOptions?: {
    recipeTitle?: string;
    parentCommentId: string;
    replyToUid: string;
    replyToName: string;
  }
): Promise<void> {
  const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanText = text.trim().slice(0, 1000);
  const payload: Record<string, unknown> = {
    authorUid: user.uid,
    authorName: user.displayName || 'সদস্য',
    text: cleanText,
    createdAt: serverTimestamp(),
  };
  if (user.photoURL) {
    payload.authorPhotoUrl = user.photoURL;
  }
  if (replyOptions) {
    payload.parentCommentId = replyOptions.parentCommentId;
    payload.replyToUid = replyOptions.replyToUid;
    payload.replyToName = replyOptions.replyToName.slice(0, 100);
  }

  try {
    await setDoc(doc(db, 'recipes', recipeId, 'comments', commentId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `recipes/${recipeId}/comments/${commentId}`);
  }

  if (replyOptions && replyOptions.replyToUid && replyOptions.replyToUid !== user.uid) {
    const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const senderName = (user.displayName || 'একজন রাঁধুনি').slice(0, 80);
    const dishLabel = (replyOptions.recipeTitle || 'একটি রেসিপি').slice(0, 70);
    const preview = cleanText.slice(0, 120);
    try {
      await setDoc(doc(db, 'users', replyOptions.replyToUid, 'notifications', notifId), {
        type: 'comment_reply',
        title: 'আপনার মন্তব্যে নতুন রিপ্লাই এসেছে',
        message: `${senderName} "${dishLabel}"-এ আপনার মন্তব্যের উত্তর দিয়েছেন: "${preview}"`,
        recipeId,
        senderUid: user.uid,
        senderName,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal if recipe doc was not yet seeded to Firestore
    }
  }
}

export async function deleteRecipeComment(recipeId: string, commentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'recipes', recipeId, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `recipes/${recipeId}/comments/${commentId}`);
  }
}

export async function markNotificationRead(uid: string, notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(uid: string, unreadIds: string[]): Promise<void> {
  if (unreadIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of unreadIds.slice(0, 100)) {
      batch.update(doc(db, 'users', uid, 'notifications', id), { isRead: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/notifications`);
  }
}

export async function submitSubscriptionOrder(params: {
  user: UserProfile;
  plan: SubscriptionPlan;
  paymentMethod: 'বিকাশ' | 'নগদ' | 'রকেট' | 'ব্যাংক' | 'ফ্রি';
  senderNumber: string;
  transactionId: string;
}): Promise<{ status: 'active' | 'pending'; orderId: string }> {
  const { user, plan, paymentMethod, senderNumber, transactionId } = params;
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const isFree = plan.tier === 'basic' && plan.priceAmount === 0;

  try {
    const orderRecipeLimit =
      plan.recipeLimit && plan.recipeLimit > 0
        ? Math.round(plan.recipeLimit)
        : plan.tier === 'pro'
          ? 25
          : 10;

    if (isFree) {
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000)
      );
      const batch = writeBatch(db);
      batch.set(doc(db, 'subscriptionOrders', orderId), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        planId: plan.id,
        planName: plan.name,
        planTier: plan.tier,
        durationDays: plan.durationDays,
        recipeLimit: orderRecipeLimit,
        amount: 0,
        paymentMethod: 'ফ্রি',
        senderNumber: '-',
        transactionId: `FREE_${Date.now()}`,
        status: 'active',
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', user.uid), {
        subscriptionPlan: 'basic',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        lastOrderId: orderId,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return { status: 'active', orderId };
    }

    const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanSender = senderNumber.trim();
    const cleanTxId = transactionId.trim();
    const proofParts: string[] = [];
    if (cleanSender) proofParts.push(`প্রেরক: ${cleanSender}`);
    if (cleanTxId) proofParts.push(`TxID: ${cleanTxId}`);
    const proofSummary = proofParts.join(' · ') || 'ভেরিফিকেশন তথ্য';

    const batch = writeBatch(db);
    batch.set(doc(db, 'subscriptionOrders', orderId), {
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName,
      planId: plan.id,
      planName: plan.name,
      planTier: plan.tier,
      durationDays: plan.durationDays,
      recipeLimit: orderRecipeLimit,
      amount: plan.priceAmount,
      paymentMethod,
      senderNumber: cleanSender,
      transactionId: cleanTxId,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', user.uid, 'notifications', notifId), {
      type: 'payment_pending',
      title: 'পেমেন্ট যাচাইয়ের জন্য জমা হয়েছে',
      message: `${plan.name} প্ল্যান (${plan.priceAmount} টাকা) — ${proofSummary} এডমিন যাচাইয়ের জন্য অপেক্ষমাণ আছে।`,
      orderId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return { status: 'pending', orderId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subscriptionOrders/${orderId}`);
  }
}

export async function approveSubscriptionOrderAdmin(
  order: {
    id: string;
    userId: string;
    planId?: string;
    planTier: PlanTier;
    planName?: string;
    amount?: number;
    durationDays?: number;
    recipeLimit?: number;
  },
  plans: SubscriptionPlan[] = []
): Promise<void> {
  const days = order.durationDays || 30;
  const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const planLabel = order.planName || (order.planTier === 'pro' ? 'প্রো' : 'স্ট্যান্ডার্ড');

  const matchedPlan = plans.find((p) => p.id === order.planId || p.tier === order.planTier);
  const orderRecipeLimit =
    order.recipeLimit && order.recipeLimit > 0
      ? Math.round(order.recipeLimit)
      : matchedPlan?.recipeLimit && matchedPlan.recipeLimit > 0
        ? Math.round(matchedPlan.recipeLimit)
        : order.planTier === 'pro'
          ? 25
          : 10;

  try {
    const userRef = doc(db, 'users', order.userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

    const existingPremiumUnlocked = Array.isArray(userData?.premiumUnlockedRecipeIds)
      ? userData.premiumUnlockedRecipeIds
      : [];
    const existingQuota =
      typeof userData?.premiumRecipeQuota === 'number' && userData.premiumRecipeQuota > 0
        ? userData.premiumRecipeQuota
        : 0;
    const prevExpMs = getSubscriptionExpiresMillis(userData?.subscriptionExpiresAt);
    const prevPaidActive = Boolean(
      userData &&
        userData.subscriptionStatus === 'active' &&
        (userData.subscriptionPlan === 'standard' || userData.subscriptionPlan === 'pro') &&
        (prevExpMs === null || prevExpMs > Date.now())
    );

    const activeRemaining = prevPaidActive
      ? Math.max(0, existingQuota - existingPremiumUnlocked.length)
      : 0;
    const newTotalPremiumQuota = Math.min(
      500,
      existingPremiumUnlocked.length + activeRemaining + orderRecipeLimit
    );
    const newAvailableCount = Math.max(0, newTotalPremiumQuota - existingPremiumUnlocked.length);

    const freshExpiryMs = Date.now() + days * 24 * 60 * 60 * 1000;
    const finalExpiryMs =
      prevPaidActive && prevExpMs && prevExpMs > freshExpiryMs ? prevExpMs : freshExpiryMs;
    const expiresAt = Timestamp.fromDate(new Date(finalExpiryMs));

    const toBn = (n: number) =>
      String(n).replace(/\d/g, (d) => ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'][Number(d)]);

    const batch = writeBatch(db);
    batch.update(doc(db, 'subscriptionOrders', order.id), {
      status: 'active',
    });
    batch.update(userRef, {
      subscriptionPlan: order.planTier,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: expiresAt,
      lastOrderId: order.id,
      premiumRecipeQuota: newTotalPremiumQuota,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', order.userId, 'notifications', notifId), {
      type: 'payment_approved',
      title: 'পেমেন্ট অনুমোদিত হয়েছে!',
      message: `অভিনন্দন! আপনার ${planLabel} প্ল্যান${order.amount ? ` (${toBn(order.amount)} টাকা)` : ''} সক্রিয় করা হয়েছে। নতুন ${toBn(orderRecipeLimit)}টি প্রিমিয়াম রেসিপি যুক্ত হয়ে এখন মোট ${toBn(newAvailableCount)}টি নতুন প্রিমিয়াম রেসিপি আনলক করতে পারবেন।`,
      orderId: order.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subscriptionOrders/${order.id}`);
  }
}

export async function rejectSubscriptionOrderAdmin(order: {
  id: string;
  userId: string;
  planName?: string;
  senderNumber?: string;
  transactionId?: string;
}): Promise<void> {
  const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const planLabel = order.planName || 'সাবস্ক্রিপশন';
  const proofDetail = order.transactionId
    ? ` (TxID: ${order.transactionId})`
    : order.senderNumber
      ? ` (প্রেরক: ${order.senderNumber})`
      : '';

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'subscriptionOrders', order.id), {
      status: 'rejected',
    });
    batch.set(doc(db, 'users', order.userId, 'notifications', notifId), {
      type: 'payment_rejected',
      title: 'পেমেন্ট আবেদন বাতিল হয়েছে',
      message: `আপনার ${planLabel} প্ল্যানের পেমেন্ট আবেদনটি${proofDetail} যাচাইয়ে গ্রহণযোগ্য হয়নি। সঠিক তথ্যসহ আবার চেষ্টা করুন।`,
      orderId: order.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subscriptionOrders/${order.id}`);
  }
}

export const MAX_HERO_RECIPES = 5;

export async function saveRecipeAdmin(
  recipeData: Omit<Recipe, 'createdAt' | 'updatedAt'>,
  contentData: Omit<RecipeContent, 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const { id: recipeId, ...recipeFields } = recipeData;
  const cleanRecipe = Object.fromEntries(
    Object.entries(recipeFields).filter(([, v]) => v !== undefined)
  );
  const cleanContent = Object.fromEntries(
    Object.entries(contentData).filter(([, v]) => v !== undefined)
  );

  try {
    const batch = writeBatch(db);
    const rRef = doc(db, 'recipes', recipeId);
    let shouldCreate = isNew;
    if (!shouldCreate) {
      const existingSnap = await getDoc(rRef);
      if (!existingSnap.exists()) {
        shouldCreate = true;
      }
    }
    if (shouldCreate) {
      batch.set(rRef, {
        ...cleanRecipe,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(rRef, {
        ...cleanRecipe,
        updatedAt: serverTimestamp(),
      });
    }

    // Keep at most 5 hero recipes: when adding/marking a recipe for Hero Slider,
    // automatically unmark the oldest featured recipe(s) beyond 5.
    if (recipeData.isFeatured) {
      const allSnap = await getDocsFromServer(collection(db, 'recipes')).catch(() =>
        getDocs(collection(db, 'recipes'))
      );
      const otherFeatured = allSnap.docs
        .filter((d) => d.id !== recipeId && d.data()?.isFeatured === true)
        .map((d) => ({ id: d.id, data: d.data() as Partial<Recipe> }))
        .sort((a, b) => {
          const aTime = Math.max(
            getTimestampMillis(a.data.updatedAt),
            getTimestampMillis(a.data.createdAt, 'recipe_', a.id)
          );
          const bTime = Math.max(
            getTimestampMillis(b.data.updatedAt),
            getTimestampMillis(b.data.createdAt, 'recipe_', b.id)
          );
          const diff = bTime - aTime;
          if (Math.abs(diff) > 1000) return diff;
          return (b.data.orderIndex || 0) - (a.data.orderIndex || 0);
        });

      const overflow = otherFeatured.slice(MAX_HERO_RECIPES - 1);
      for (const oldItem of overflow) {
        batch.update(doc(db, 'recipes', oldItem.id), {
          isFeatured: false,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const cRef = doc(db, 'recipes', recipeId, 'content', 'detail');
    batch.set(cRef, {
      ...cleanContent,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recipes/${recipeId}`);
  }
}

export async function deleteRecipeAdmin(recipeId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'recipes', recipeId, 'content', 'detail'));
    batch.delete(doc(db, 'recipes', recipeId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `recipes/${recipeId}`);
  }
}

export async function saveCategoryAdmin(
  category: Omit<RecipeCategory, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const { id: catId, ...rest } = category;
  const payload: Record<string, unknown> = {
    name: rest.name.trim().slice(0, 40),
    iconKey: (rest.iconKey || '').trim().slice(0, 40),
    iconImageUrl: (rest.iconImageUrl || '').trim(),
    orderIndex: Math.max(0, Math.round(Number(rest.orderIndex) || 0)),
    isActive: Boolean(rest.isActive),
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = doc(db, 'categories', catId);
    let shouldCreate = isNew;
    if (!shouldCreate) {
      const snap = await getDoc(ref);
      if (!snap.exists()) shouldCreate = true;
    }
    if (shouldCreate) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categories/${catId}`);
  }
}

export async function deleteCategoryAdmin(categoryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${categoryId}`);
  }
}

export async function savePlanAdmin(plan: Omit<SubscriptionPlan, 'updatedAt'>): Promise<void> {
  const { id: planId, ...planFields } = plan;
  const cleanPlan = Object.fromEntries(
    Object.entries({
      ...planFields,
      priceAmount: Math.max(0, Math.round(Number(planFields.priceAmount) || 0)),
    }).filter(([, v]) => v !== undefined)
  );

  try {
    await setDoc(doc(db, 'subscriptionPlans', planId), {
      ...cleanPlan,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subscriptionPlans/${planId}`);
  }
}

export async function saveTipAdmin(tip: Omit<CookingTip, 'createdAt' | 'updatedAt'>, isNew: boolean): Promise<void> {
  const { id: tipId, ...tipFields } = tip;
  try {
    const ref = doc(db, 'tips', tipId);
    let shouldCreate = isNew;
    if (!shouldCreate) {
      const snap = await getDoc(ref);
      if (!snap.exists()) shouldCreate = true;
    }
    if (shouldCreate) {
      await setDoc(ref, { ...tipFields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      await updateDoc(ref, { ...tipFields, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tips/${tipId}`);
  }
}

export async function deleteTipAdmin(tipId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tips', tipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tips/${tipId}`);
  }
}

export async function saveBlogAdmin(post: Omit<BlogPost, 'createdAt' | 'updatedAt'>, isNew: boolean): Promise<void> {
  const { id: postId, ...blogFields } = post;
  try {
    const ref = doc(db, 'blogPosts', postId);
    let shouldCreate = isNew;
    if (!shouldCreate) {
      const snap = await getDoc(ref);
      if (!snap.exists()) shouldCreate = true;
    }
    if (shouldCreate) {
      await setDoc(ref, { ...blogFields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      await updateDoc(ref, { ...blogFields, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `blogPosts/${postId}`);
  }
}

export async function deleteBlogAdmin(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'blogPosts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `blogPosts/${postId}`);
  }
}

export async function updateUserByAdmin(
  targetUid: string,
  updates: {
    subscriptionPlan: PlanTier;
    subscriptionStatus: 'active' | 'expired';
    role: 'member' | 'admin';
    email: string;
    currentAdminUid: string;
  },
  plans: SubscriptionPlan[] = []
): Promise<void> {
  try {
    const userRef = doc(db, 'users', targetUid);
    const snap = await getDoc(userRef);
    const existingData = snap.exists() ? (snap.data() as UserProfile) : null;

    const userPatch: Record<string, unknown> = {
      subscriptionPlan: updates.subscriptionPlan,
      subscriptionStatus: updates.subscriptionStatus,
      role: updates.role,
      updatedAt: serverTimestamp(),
    };

    if (
      updates.subscriptionStatus === 'active' &&
      (updates.subscriptionPlan === 'standard' || updates.subscriptionPlan === 'pro')
    ) {
      const planLimit = getRecipeQuotaLimit(updates.subscriptionPlan, plans);
      const existingPremiumUnlocked = Array.isArray(existingData?.premiumUnlockedRecipeIds)
        ? existingData.premiumUnlockedRecipeIds.length
        : 0;
      const existingQuota =
        typeof existingData?.premiumRecipeQuota === 'number' ? existingData.premiumRecipeQuota : 0;
      const prevExpMs = getSubscriptionExpiresMillis(existingData?.subscriptionExpiresAt);
      const planChanged =
        existingData?.subscriptionPlan !== updates.subscriptionPlan ||
        existingData?.subscriptionStatus !== 'active';

      if (planChanged || existingQuota <= existingPremiumUnlocked) {
        userPatch.premiumRecipeQuota = Math.min(
          500,
          Math.max(existingQuota, existingPremiumUnlocked + planLimit)
        );
      }
      if (!prevExpMs || prevExpMs <= Date.now() || planChanged) {
        userPatch.subscriptionExpiresAt = Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        );
      }
    }

    const batch = writeBatch(db);
    batch.update(userRef, userPatch);
    if (updates.role === 'admin') {
      batch.set(doc(db, 'admins', targetUid), {
        email: updates.email,
        addedBy: updates.currentAdminUid,
        createdAt: serverTimestamp(),
      });
    } else if (!isSuperAdminEmail(updates.email)) {
      batch.delete(doc(db, 'admins', targetUid));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function saveSiteSettingsAdmin(settings: Omit<SiteSettings, 'updatedAt'>): Promise<void> {
  try {
    await setDoc(doc(db, 'siteSettings', 'main'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'siteSettings/main');
  }
}

export async function submitContactMessage(msg: Omit<ContactMessage, 'id' | 'status' | 'createdAt'>): Promise<void> {
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(db, 'contactMessages', id), {
      ...msg,
      status: 'unread',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `contactMessages/${id}`);
  }
}

export async function markMessageStatusAdmin(messageId: string, status: 'unread' | 'read'): Promise<void> {
  try {
    await updateDoc(doc(db, 'contactMessages', messageId), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contactMessages/${messageId}`);
  }
}

export async function deleteMessageAdmin(messageId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'contactMessages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `contactMessages/${messageId}`);
  }
}
