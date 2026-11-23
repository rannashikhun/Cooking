import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Edit3,
  ExternalLink,
  Globe,
  HardDrive,
  ImagePlus,
  LayoutGrid,
  Mail,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
  Upload,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { SEED_RECIPES } from '../data/seedData';
import {
  approveSubscriptionOrderAdmin,
  deleteCategoryAdmin,
  deleteMessageAdmin,
  deleteUserAccountAdmin,
  fetchRecipeContent,
  formatRelativePresenceBn,
  formatUserContact,
  FREE_RECIPE_LIMIT,
  getSubscriptionExpiresMillis,
  getUserFreeUnlockedIds,
  getUserPremiumQuota,
  getUserPremiumUnlockedIds,
  isBootstrappedModeratorEmail,
  isPaidPlanActive,
  isSuperAdminEmail,
  isUserOnlineNow,
  markMessageStatusAdmin,
  moveBlogToRecycleBinAdmin,
  moveRecipeToRecycleBinAdmin,
  moveTipToRecycleBinAdmin,
  permanentlyDeleteRecycleBinItemAdmin,
  purgeRecycleBinItemsAdmin,
  rejectSubscriptionOrderAdmin,
  restoreRecycleBinItemAdmin,
  saveBlogAdmin,
  saveCategoryAdmin,
  savePlanAdmin,
  saveRecipeAdmin,
  saveSiteSettingsAdmin,
  saveTipAdmin,
  updateUserByAdmin,
} from '../services/firestoreService';
import { CATEGORY_ICON_PRESETS, CategoryIcon, PresetFoodSvg } from './CategoryIcon';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import {
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_KEYWORDS,
  DEFAULT_SEO_TITLE,
  extractGoogleVerificationCode,
  extractGoogleVerificationFilename,
} from '../utils/seoMeta';
import { AdminSeoSettingsTab, AdminSocialShareTab } from './AdminSocialSeoTabs';
import { AdminBackupTab } from './AdminBackupTab';
import { AdminFontSettingsTab, type FontSettingsValues } from './AdminFontSettingsTab';
import { AdminRecycleBinTab } from './AdminRecycleBinTab';
import { AdminMemberPreviewModal } from './AdminMemberPreviewModal';
import {
  getResponsiveTypographyClass,
  resolveFontKey,
  resolveFontSizeKey,
} from '../utils/typography';
import type {
  BlogPost,
  ContactMessage,
  CookingTip,
  DifficultyLevel,
  DirectMessageThread,
  PageRoute,
  PlanAccent,
  PlanTier,
  Recipe,
  RecipeCategory,
  RecycleBinItem,
  SiteSettings,
  SubscriptionOrder,
  SubscriptionPlan,
  UserProfile,
} from '../types';

interface AdminPanelProps {
  currentUser: UserProfile;
  recipes: Recipe[];
  categories: RecipeCategory[];
  plans: SubscriptionPlan[];
  tips: CookingTip[];
  blogPosts: BlogPost[];
  siteSettings: SiteSettings;
  onSiteSettingsSaved?: (updated: SiteSettings) => void;
  onNavigate?: (route: PageRoute) => void;
}

type AdminTab =
  | 'recipes'
  | 'categories'
  | 'plans'
  | 'content'
  | 'users'
  | 'messages'
  | 'fonts'
  | 'social'
  | 'seo'
  | 'backup'
  | 'recycle-bin'
  | 'settings';
type MemberFilterView = 'all' | 'premium' | 'pending';

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

interface StepDraft {
  text: string;
  imageUrl: string;
}

function extractFontSettingsValues(settings: SiteSettings): FontSettingsValues {
  const checkoutPcFont = resolveFontKey(settings.checkoutFontFamily, 'hind-siliguri');
  const checkoutPcSize = resolveFontSizeKey(settings.checkoutFontSize, '100');
  const recipePcFont = resolveFontKey(settings.recipeFontDesktop, 'bensen');
  const recipePcSize = resolveFontSizeKey(settings.recipeFontSizeDesktop, '100');
  const homePcFont = resolveFontKey(settings.homeFontFamily, 'hind-siliguri');
  const homePcSize = resolveFontSizeKey(settings.homeFontSize, '100');
  const pricingPcFont = resolveFontKey(settings.pricingFontFamily, 'hind-siliguri');
  const pricingPcSize = resolveFontSizeKey(settings.pricingFontSize, '100');
  const blogTipsPcFont = resolveFontKey(settings.blogTipsFontFamily, 'hind-siliguri');
  const blogTipsPcSize = resolveFontSizeKey(settings.blogTipsFontSize, '100');
  const authPcFont = resolveFontKey(settings.authFontFamily, 'hind-siliguri');
  const authPcSize = resolveFontSizeKey(settings.authFontSize, '100');
  const profilePcFont = resolveFontKey(settings.profileFontFamily, 'hind-siliguri');
  const profilePcSize = resolveFontSizeKey(settings.profileFontSize, '100');
  const adminPcFont = resolveFontKey(settings.adminFontFamily, 'hind-siliguri');
  const adminPcSize = resolveFontSizeKey(settings.adminFontSize, '100');

  return {
    checkoutFontFamily: checkoutPcFont,
    checkoutFontMobile: resolveFontKey(settings.checkoutFontMobile, checkoutPcFont),
    checkoutFontSize: checkoutPcSize,
    checkoutFontSizeMobile: resolveFontSizeKey(settings.checkoutFontSizeMobile, checkoutPcSize),
    recipeFontDesktop: recipePcFont,
    recipeFontMobile: resolveFontKey(settings.recipeFontMobile, recipePcFont),
    recipeFontSizeDesktop: recipePcSize,
    recipeFontSizeMobile: resolveFontSizeKey(settings.recipeFontSizeMobile, recipePcSize),
    homeFontFamily: homePcFont,
    homeFontMobile: resolveFontKey(settings.homeFontMobile, homePcFont),
    homeFontSize: homePcSize,
    homeFontSizeMobile: resolveFontSizeKey(settings.homeFontSizeMobile, homePcSize),
    pricingFontFamily: pricingPcFont,
    pricingFontMobile: resolveFontKey(settings.pricingFontMobile, pricingPcFont),
    pricingFontSize: pricingPcSize,
    pricingFontSizeMobile: resolveFontSizeKey(settings.pricingFontSizeMobile, pricingPcSize),
    blogTipsFontFamily: blogTipsPcFont,
    blogTipsFontMobile: resolveFontKey(settings.blogTipsFontMobile, blogTipsPcFont),
    blogTipsFontSize: blogTipsPcSize,
    blogTipsFontSizeMobile: resolveFontSizeKey(settings.blogTipsFontSizeMobile, blogTipsPcSize),
    authFontFamily: authPcFont,
    authFontMobile: resolveFontKey(settings.authFontMobile, authPcFont),
    authFontSize: authPcSize,
    authFontSizeMobile: resolveFontSizeKey(settings.authFontSizeMobile, authPcSize),
    profileFontFamily: profilePcFont,
    profileFontMobile: resolveFontKey(settings.profileFontMobile, profilePcFont),
    profileFontSize: profilePcSize,
    profileFontSizeMobile: resolveFontSizeKey(settings.profileFontSizeMobile, profilePcSize),
    adminFontFamily: adminPcFont,
    adminFontMobile: resolveFontKey(settings.adminFontMobile, adminPcFont),
    adminFontSize: adminPcSize,
    adminFontSizeMobile: resolveFontSizeKey(settings.adminFontSizeMobile, adminPcSize),
  };
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  recipes,
  categories,
  plans,
  tips,
  blogPosts,
  siteSettings,
  onSiteSettingsSaved,
  onNavigate,
}) => {
  const isFullAdmin = currentUser.role === 'admin';
  const isModerator =
    currentUser.role === 'moderator' || isBootstrappedModeratorEmail(currentUser.email);
  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    currentUser.role === 'moderator' || isBootstrappedModeratorEmail(currentUser.email)
      ? 'recipes'
      : 'users'
  );
  const [adminView, setAdminView] = useState<'dashboard' | 'customize'>('dashboard');
  const [lastCustomizeTab, setLastCustomizeTab] =
    useState<Exclude<AdminTab, 'users'>>('recipes');
  const [memberFilterView, setMemberFilterView] = useState<MemberFilterView>('all');
  const [membersPage, setMembersPage] = useState(1);

  // Tab-specific filters: All Members
  const [allSearch, setAllSearch] = useState('');
  const [allPlanFilter, setAllPlanFilter] = useState<'all' | PlanTier>('all');
  const [allStatusFilter, setAllStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [allActiveFilter, setAllActiveFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [allQuotaFilter, setAllQuotaFilter] = useState<
    'all' | 'exhausted' | 'remaining' | 'unused'
  >('all');
  const [allSortBy, setAllSortBy] = useState<'newest' | 'oldest' | 'name' | 'most_used'>('newest');

  // Tab-specific filters: Premium Members
  const [premiumSearch, setPremiumSearch] = useState('');
  const [premiumTierFilter, setPremiumTierFilter] = useState<'all' | 'standard' | 'pro'>('all');
  const [premiumActiveFilter, setPremiumActiveFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [premiumHealthFilter, setPremiumHealthFilter] = useState<
    'all' | 'expiring_soon' | 'quota_full' | 'quota_low' | 'healthy'
  >('all');
  const [premiumSortBy, setPremiumSortBy] = useState<
    'expiry_soonest' | 'usage_highest' | 'newest' | 'name'
  >('expiry_soonest');

  // Tab-specific filters: Pending Payments Queue & Members
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingMethodFilter, setPendingMethodFilter] = useState<
    'all' | 'bkash' | 'nagad' | 'other'
  >('all');
  const [pendingTierFilter, setPendingTierFilter] = useState<'all' | 'standard' | 'pro'>('all');
  const [pendingSortBy, setPendingSortBy] = useState<'newest' | 'oldest' | 'amount_desc'>('newest');

  // Paid Orders History filters & pagination (inside Pending Payment tab)
  const [paidHistorySearch, setPaidHistorySearch] = useState('');
  const [paidHistoryStatusFilter, setPaidHistoryStatusFilter] = useState<
    'all' | 'active' | 'pending' | 'rejected'
  >('all');
  const [paidHistoryMethodFilter, setPaidHistoryMethodFilter] = useState<
    'all' | 'bkash' | 'nagad' | 'other'
  >('all');
  const [paidHistoryUpgradeFilter, setPaidHistoryUpgradeFilter] = useState<
    'all' | 'multiple' | 'single'
  >('all');
  const [paidHistorySortBy, setPaidHistorySortBy] = useState<
    'latest' | 'amount_desc' | 'upgrades_desc'
  >('latest');
  const [paidHistoryPage, setPaidHistoryPage] = useState(1);

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [ordersList, setOrdersList] = useState<SubscriptionOrder[]>([]);
  const [messagesList, setMessagesList] = useState<ContactMessage[]>([]);
  const [directThreads, setDirectThreads] = useState<DirectMessageThread[]>([]);
  const [recycleBinItems, setRecycleBinItems] = useState<RecycleBinItem[]>([]);
  const [presenceNowMs, setPresenceNowMs] = useState<number>(() => Date.now());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [previewMemberUid, setPreviewMemberUid] = useState<string | null>(null);
  const [previewFallbackMember, setPreviewFallbackMember] = useState<UserProfile | null>(null);
  const pendingSectionRef = useRef<HTMLDivElement>(null);
  const membersTableRef = useRef<HTMLDivElement>(null);
  const paidHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceNowMs(Date.now());
    }, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMembersPage(1);
  }, [
    memberFilterView,
    allSearch,
    allPlanFilter,
    allStatusFilter,
    allActiveFilter,
    allQuotaFilter,
    allSortBy,
    premiumSearch,
    premiumTierFilter,
    premiumActiveFilter,
    premiumHealthFilter,
    premiumSortBy,
    pendingSearch,
    pendingMethodFilter,
    pendingTierFilter,
    pendingSortBy,
  ]);

  useEffect(() => {
    setPaidHistoryPage(1);
  }, [
    paidHistorySearch,
    paidHistoryStatusFilter,
    paidHistoryMethodFilter,
    paidHistoryUpgradeFilter,
    paidHistorySortBy,
  ]);

  // Recipe Editor State
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [rTitle, setRTitle] = useState('');
  const [rSubtitle, setRSubtitle] = useState('');
  const [rImageUrl, setRImageUrl] = useState('');
  const [rCuisine, setRCuisine] = useState('বাঙ্গালি');
  const [rCategory, setRCategory] = useState(() => categories[0]?.name || 'ভাত ও পোলাও');
  const [rCookTime, setRCookTime] = useState('৩০ মিনিট');
  const [rDifficulty, setRDifficulty] = useState<DifficultyLevel>('সহজ');
  const [rServings, setRServings] = useState('৪ জন');
  const [rIsPremium, setRIsPremium] = useState(false);
  const [rIsFeatured, setRIsFeatured] = useState(false);
  const [rIngredientsText, setRIngredientsText] = useState('');
  const [rSteps, setRSteps] = useState<StepDraft[]>([
    { text: '', imageUrl: '' },
  ]);
  const [rChefTip, setRChefTip] = useState('');
  const [rImageUploading, setRImageUploading] = useState(false);
  const [rStepUploadingIdx, setRStepUploadingIdx] = useState<number | null>(null);

  // Quick Inline Category Creator inside Recipe Form
  const [showQuickCatForm, setShowQuickCatForm] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatIconKey, setQuickCatIconKey] = useState('rice');
  const [quickCatIconUrl, setQuickCatIconUrl] = useState('');
  const [quickCatUploading, setQuickCatUploading] = useState(false);
  const [quickCatSaving, setQuickCatSaving] = useState(false);

  // Category Manager Tab State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catIconKey, setCatIconKey] = useState('rice');
  const [catIconImageUrl, setCatIconImageUrl] = useState('');
  const [catOrderIndex, setCatOrderIndex] = useState<number>(() => categories.length + 1);
  const [catIsActive, setCatIsActive] = useState(true);
  const [catIconUploading, setCatIconUploading] = useState(false);
  const [catSaving, setCatSaving] = useState(false);

  // Tip Editor State
  const [tipTitle, setTipTitle] = useState('');
  const [tipCategory, setTipCategory] = useState('মশলা ও কৌশল');
  const [tipSummary, setTipSummary] = useState('');
  const [tipContent, setTipContent] = useState('');
  const [editingTipId, setEditingTipId] = useState<string | null>(null);

  // Blog Editor State
  const [blogTitle, setBlogTitle] = useState('');
  const [blogCategory, setBlogCategory] = useState('খাদ্য ঐতিহ্য');
  const [blogExcerpt, setBlogExcerpt] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogImage, setBlogImage] = useState('');
  const [blogImageUploading, setBlogImageUploading] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<'recipe' | 'tip' | 'blog' | null>(null);

  // Settings State
  const [sSiteName, setSSiteName] = useState(siteSettings.siteName);
  const [sTagline, setSTagline] = useState(siteSettings.tagline);
  const [sShowAnnounce, setSShowAnnounce] = useState(siteSettings.showAnnouncement);
  const [sAnnounceText, setSAnnounceText] = useState(siteSettings.announcementText || '');
  const [sBkash, setSBkash] = useState(siteSettings.paymentBkashNumber || '');
  const [sNagad, setSNagad] = useState(siteSettings.paymentNagadNumber || '');
  const [sPayInst, setSPayInst] = useState(siteSettings.paymentInstructions || '');
  const [sEmail, setSEmail] = useState(siteSettings.contactEmail);
  const [sPhone, setSPhone] = useState(siteSettings.contactPhone);
  const [sAddress, setSAddress] = useState(siteSettings.contactAddress);
  const [sFooter, setSFooter] = useState(siteSettings.footerNote || '');
  const [sSeoTitle, setSSeoTitle] = useState(
    siteSettings.seoTitle || DEFAULT_SEO_TITLE
  );
  const [sSeoDescription, setSSeoDescription] = useState(
    siteSettings.seoDescription || DEFAULT_SEO_DESCRIPTION
  );
  const [sSeoKeywords, setSSeoKeywords] = useState(
    siteSettings.seoKeywords || DEFAULT_SEO_KEYWORDS
  );
  const [sSeoAuthor, setSSeoAuthor] = useState(
    siteSettings.seoAuthor || siteSettings.siteName || 'রান্না শিখুন'
  );
  const [sCanonicalBaseUrl, setSCanonicalBaseUrl] = useState(
    siteSettings.canonicalBaseUrl || ''
  );
  const [sSeoRobotsPolicy, setSSeoRobotsPolicy] = useState<'index, follow' | 'noindex, nofollow'>(
    siteSettings.seoRobotsPolicy || 'index, follow'
  );
  const [sGoogleVerification, setSGoogleVerification] = useState(
    siteSettings.googleSiteVerification || ''
  );
  const [sGoogleVerificationFile, setSGoogleVerificationFile] = useState(
    siteSettings.googleVerificationFile || ''
  );
  const [sBingVerification, setSBingVerification] = useState(
    siteSettings.bingSiteVerification || ''
  );
  const [sGoogleAnalyticsId, setSGoogleAnalyticsId] = useState(
    siteSettings.googleAnalyticsId || ''
  );
  const [sRobotsTxtExtra, setSRobotsTxtExtra] = useState(
    siteSettings.robotsTxtExtra || ''
  );
  const [sSocialImageUrl, setSSocialImageUrl] = useState(
    siteSettings.socialShareImageUrl || ''
  );
  const [sSocialTitle, setSSocialTitle] = useState(
    siteSettings.socialShareTitle || siteSettings.seoTitle || DEFAULT_SEO_TITLE
  );
  const [sSocialDesc, setSSocialDesc] = useState(
    siteSettings.socialShareDescription ||
      siteSettings.seoDescription ||
      DEFAULT_SEO_DESCRIPTION
  );
  const [sSocialImageAlt, setSSocialImageAlt] = useState(
    siteSettings.socialShareImageAlt || 'রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম'
  );
  const [sTwitterHandle, setSTwitterHandle] = useState(siteSettings.twitterHandle || '');
  const [sFbAppId, setSFbAppId] = useState(siteSettings.fbAppId || '');
  const [sShowRecipeShare, setSShowRecipeShare] = useState<boolean>(
    siteSettings.showRecipeShareButton !== false
  );
  const [togglingRecipeShare, setTogglingRecipeShare] = useState(false);
  const [socialImgUploading, setSocialImgUploading] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);
  const [savingSeo, setSavingSeo] = useState(false);
  const [fontDraft, setFontDraft] = useState<FontSettingsValues>(() =>
    extractFontSettingsValues(siteSettings)
  );
  const lastSyncedFontKeyRef = useRef<string>(
    JSON.stringify(extractFontSettingsValues(siteSettings))
  );
  const [savingFonts, setSavingFonts] = useState(false);
  const [fontsJustSaved, setFontsJustSaved] = useState(false);
  const [fontSaveError, setFontSaveError] = useState<string | null>(null);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setSSiteName(siteSettings.siteName);
    setSTagline(siteSettings.tagline);
    setSShowAnnounce(siteSettings.showAnnouncement);
    setSAnnounceText(siteSettings.announcementText || '');
    setSBkash(siteSettings.paymentBkashNumber || '');
    setSNagad(siteSettings.paymentNagadNumber || '');
    setSPayInst(siteSettings.paymentInstructions || '');
    setSEmail(siteSettings.contactEmail);
    setSPhone(siteSettings.contactPhone);
    setSAddress(siteSettings.contactAddress);
    setSFooter(siteSettings.footerNote || '');
    setSSeoTitle(siteSettings.seoTitle || DEFAULT_SEO_TITLE);
    setSSeoDescription(siteSettings.seoDescription || DEFAULT_SEO_DESCRIPTION);
    setSSeoKeywords(siteSettings.seoKeywords || DEFAULT_SEO_KEYWORDS);
    setSSeoAuthor(siteSettings.seoAuthor || siteSettings.siteName || 'রান্না শিখুন');
    setSCanonicalBaseUrl(siteSettings.canonicalBaseUrl || '');
    setSSeoRobotsPolicy(siteSettings.seoRobotsPolicy || 'index, follow');
    setSGoogleVerification(siteSettings.googleSiteVerification || '');
    setSGoogleVerificationFile(siteSettings.googleVerificationFile || '');
    setSBingVerification(siteSettings.bingSiteVerification || '');
    setSGoogleAnalyticsId(siteSettings.googleAnalyticsId || '');
    setSRobotsTxtExtra(siteSettings.robotsTxtExtra || '');
    setSSocialImageUrl(siteSettings.socialShareImageUrl || '');
    setSSocialTitle(
      siteSettings.socialShareTitle || siteSettings.seoTitle || DEFAULT_SEO_TITLE
    );
    setSSocialDesc(
      siteSettings.socialShareDescription ||
        siteSettings.seoDescription ||
        DEFAULT_SEO_DESCRIPTION
    );
    setSSocialImageAlt(
      siteSettings.socialShareImageAlt || 'রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম'
    );
    setSTwitterHandle(siteSettings.twitterHandle || '');
    setSFbAppId(siteSettings.fbAppId || '');
    setSShowRecipeShare(siteSettings.showRecipeShareButton !== false);

    // Only sync fontDraft when incoming Firestore font values actually differ from the last synced snapshot
    // so background catalog refreshes never erase unsaved edits in the Font Settings tab.
    const nextExtracted = extractFontSettingsValues(siteSettings);
    const nextKey = JSON.stringify(nextExtracted);
    if (nextKey !== lastSyncedFontKeyRef.current) {
      lastSyncedFontKeyRef.current = nextKey;
      setFontDraft(nextExtracted);
    }
  }, [siteSettings]);

  useEffect(() => {
    if (!expandedEditor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedEditor(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedEditor]);

  const isVerifiedEmail = Boolean(auth.currentUser?.emailVerified);

  useEffect(() => {
    if (isModerator && !isFullAdmin && !['recipes', 'categories', 'content'].includes(activeTab)) {
      setActiveTab('recipes');
    }
  }, [isModerator, isFullAdmin, activeTab]);

  useEffect(() => {
    if (!isFullAdmin || !isVerifiedEmail) return;
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsersList(snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );
    const unsubOrders = onSnapshot(
      collection(db, 'subscriptionOrders'),
      (snap) => {
        setOrdersList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionOrder, 'id'>) }))
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'subscriptionOrders')
    );
    const unsubMsgs = onSnapshot(
      collection(db, 'contactMessages'),
      (snap) => {
        setMessagesList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContactMessage, 'id'>) }))
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'contactMessages')
    );
    const unsubRecycle = onSnapshot(
      collection(db, 'recycleBin'),
      (snap) => {
        const allTrash = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RecycleBinItem, 'id'>),
        }));
        const now = Date.now();
        const expiredIds = allTrash
          .filter((item) => {
            const exp = getSubscriptionExpiresMillis(item.expiresAt);
            return exp !== null && exp <= now;
          })
          .map((item) => item.id);
        if (expiredIds.length > 0) {
          purgeRecycleBinItemsAdmin(expiredIds).catch(() => {});
        }
        setRecycleBinItems(allTrash.filter((item) => !expiredIds.includes(item.id)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'recycleBin')
    );
    const unsubDirectThreads = onSnapshot(
      collection(db, 'directThreads'),
      (snap) => {
        setDirectThreads(
          snap.docs.map((d) => ({
            ...(d.data() as DirectMessageThread),
            userId: d.id,
          }))
        );
      },
      () => {
        setDirectThreads([]);
      }
    );
    return () => {
      unsubUsers();
      unsubOrders();
      unsubMsgs();
      unsubRecycle();
      unsubDirectThreads();
    };
  }, [isFullAdmin, isVerifiedEmail]);

  if (isSuperAdminEmail(currentUser.email) && !isVerifiedEmail) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 bg-white rounded-3xl border border-[#D4A017]/50 text-center space-y-4">
        <p className="text-lg font-bold text-[#1A1A1A]">এডমিন ইমেইল ভেরিফিকেশন প্রয়োজন</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          নিরাপত্তার জন্য এডমিন প্যানেল ব্যবহার করার আগে আপনার ইমেইল ({currentUser.email}) ভেরিফাই করা আবশ্যক। ইনবক্সে পাঠানো লিংকে ক্লিক করে নিচের বাটনে চাপ দিন।
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={async () => {
              if (auth.currentUser) {
                await auth.currentUser.reload();
                await auth.currentUser.getIdToken(true);
                window.location.reload();
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-[#1B4D24] text-white text-xs font-bold cursor-pointer"
          >
            ভেরিফিকেশন সম্পন্ন করেছি (রিফ্রেশ)
          </button>
          <button
            type="button"
            onClick={async () => {
              if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser);
                notify('নতুন ভেরিফিকেশন ইমেইল পাঠানো হয়েছে।');
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 cursor-pointer"
          >
            পুনরায় ইমেইল পাঠান
          </button>
        </div>
        {toast && (
          <p className={`text-xs font-semibold ${toast.type === 'error' ? 'text-red-600' : 'text-[#1B4D24]'}`}>
            {toast.msg}
          </p>
        )}
      </div>
    );
  }

  if (!isFullAdmin && !isModerator) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 bg-white rounded-3xl border border-red-200 text-center">
        <p className="text-lg font-bold text-red-700">এডমিন অনুমতি নেই</p>
        <p className="text-sm text-gray-600 mt-1">শুধুমাত্র অনুমোদিত এডমিন বা মোডারেটর এই প্যানেল দেখতে পারবেন।</p>
      </div>
    );
  }

  const MEMBERS_PER_PAGE = 20;
  const PAID_HISTORY_PER_PAGE = 20;
  const nowMs = presenceNowMs;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const getTimestampMs = (ts: unknown): number => {
    const ms = getSubscriptionExpiresMillis(ts);
    return ms ?? 0;
  };

  const normalizePaymentMethod = (method?: string): 'bkash' | 'nagad' | 'other' => {
    const m = (method || '').toLowerCase();
    if (m.includes('বিকাশ') || m.includes('bkash')) return 'bkash';
    if (m.includes('নগদ') || m.includes('nagad')) return 'nagad';
    return 'other';
  };

  const getMemberUsedCount = (u: UserProfile): number => {
    const freeUsed = Math.min(getUserFreeUnlockedIds(u, recipes).length, FREE_RECIPE_LIMIT);
    const premUsed = getUserPremiumUnlockedIds(u, recipes).length;
    return isPaidPlanActive(u) ? premUsed : freeUsed + premUsed;
  };

  const directThreadsByUid = new Map<string, DirectMessageThread>();
  directThreads.forEach((t) => directThreadsByUid.set(t.userId, t));
  const sortedDirectThreads = [...directThreads].sort(
    (a, b) => getTimestampMs(b.updatedAt) - getTimestampMs(a.updatedAt)
  );
  const unreadDirectMessagesTotal = directThreads.reduce(
    (sum, t) => sum + (Number(t.unreadByAdmin) || 0),
    0
  );
  const onlineMembersCount = usersList.filter((u) => isUserOnlineNow(u, nowMs)).length;

  const pendingOrders = ordersList.filter((o) => o.status === 'pending');
  const pendingOrderUserIds = new Set(pendingOrders.map((o) => o.userId));
  const totalMembersCount = usersList.length;
  const premiumMembers = usersList.filter(
    (u) =>
      u.subscriptionStatus === 'active' &&
      (u.subscriptionPlan === 'standard' || u.subscriptionPlan === 'pro')
  );
  const premiumMembersCount = premiumMembers.length;
  const pendingPaymentMembers = usersList.filter((u) => pendingOrderUserIds.has(u.uid));

  // Pending TxID Queue filtered & sorted (used in Pending Payment tab)
  const pendingQuery = pendingSearch.trim().toLowerCase();
  const filteredPendingOrders = pendingOrders
    .filter((o) => {
      if (pendingMethodFilter !== 'all' && normalizePaymentMethod(o.paymentMethod) !== pendingMethodFilter) {
        return false;
      }
      if (pendingTierFilter !== 'all' && o.planTier !== pendingTierFilter) {
        return false;
      }
      if (pendingQuery) {
        const hay = [
          o.userName,
          o.userEmail,
          formatUserContact(o.userEmail),
          o.senderNumber,
          o.transactionId,
          o.planName,
          o.paymentMethod,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(pendingQuery)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (pendingSortBy === 'oldest') return getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt);
      if (pendingSortBy === 'amount_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
    });

  const filteredPendingOrderUserIds = new Set(filteredPendingOrders.map((o) => o.userId));

  // Tab-tailored Members List filtering & sorting
  const filteredMembers = (() => {
    if (memberFilterView === 'premium') {
      const q = premiumSearch.trim().toLowerCase();
      return premiumMembers
        .filter((u) => {
          if (premiumTierFilter !== 'all' && u.subscriptionPlan !== premiumTierFilter) return false;
          if (premiumActiveFilter !== 'all') {
            const online = isUserOnlineNow(u, nowMs);
            if (premiumActiveFilter === 'online' && !online) return false;
            if (premiumActiveFilter === 'offline' && online) return false;
          }
          if (premiumHealthFilter !== 'all') {
            const premUsed = getUserPremiumUnlockedIds(u, recipes).length;
            const premQuota = getUserPremiumQuota(u, plans, recipes);
            const expMs = getSubscriptionExpiresMillis(u.subscriptionExpiresAt);
            const isExpiringSoon = expMs !== null && expMs >= nowMs && expMs - nowMs <= sevenDaysMs;
            const isQuotaFull = premQuota > 0 && premUsed >= premQuota;
            const isQuotaLow = premQuota > 0 && premUsed / premQuota >= 0.8 && !isQuotaFull;
            if (premiumHealthFilter === 'expiring_soon' && !isExpiringSoon) return false;
            if (premiumHealthFilter === 'quota_full' && !isQuotaFull) return false;
            if (premiumHealthFilter === 'quota_low' && !isQuotaLow) return false;
            if (premiumHealthFilter === 'healthy' && (isExpiringSoon || isQuotaFull || isQuotaLow)) {
              return false;
            }
          }
          if (q) {
            const hay = [
              u.displayName,
              u.email,
              u.phoneNumber,
              formatUserContact(u.email, u.phoneNumber),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (premiumSortBy === 'expiry_soonest') {
            const aExp = getSubscriptionExpiresMillis(a.subscriptionExpiresAt) ?? Number.MAX_SAFE_INTEGER;
            const bExp = getSubscriptionExpiresMillis(b.subscriptionExpiresAt) ?? Number.MAX_SAFE_INTEGER;
            return aExp - bExp;
          }
          if (premiumSortBy === 'usage_highest') {
            return (
              getUserPremiumUnlockedIds(b, recipes).length -
              getUserPremiumUnlockedIds(a, recipes).length
            );
          }
          if (premiumSortBy === 'name') {
            return (a.displayName || '').localeCompare(b.displayName || '', 'bn');
          }
          return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
        });
    }

    if (memberFilterView === 'pending') {
      const hasPendingOrderFilter =
        Boolean(pendingQuery) || pendingMethodFilter !== 'all' || pendingTierFilter !== 'all';
      return pendingPaymentMembers
        .filter((u) => {
          if (hasPendingOrderFilter) {
            if (filteredPendingOrderUserIds.has(u.uid)) return true;
            if (pendingMethodFilter === 'all' && pendingTierFilter === 'all' && pendingQuery) {
              const hay = [
                u.displayName,
                u.email,
                u.phoneNumber,
                formatUserContact(u.email, u.phoneNumber),
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return hay.includes(pendingQuery);
            }
            return false;
          }
          return true;
        })
        .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
    }

    // All Members Tab
    const q = allSearch.trim().toLowerCase();
    return usersList
      .filter((u) => {
        if (allPlanFilter !== 'all' && u.subscriptionPlan !== allPlanFilter) return false;
        if (allStatusFilter !== 'all' && u.subscriptionStatus !== allStatusFilter) return false;
        if (allActiveFilter !== 'all') {
          const online = isUserOnlineNow(u, nowMs);
          if (allActiveFilter === 'online' && !online) return false;
          if (allActiveFilter === 'offline' && online) return false;
        }
        if (allQuotaFilter !== 'all') {
          const isAdminAcc = u.role === 'admin';
          const paidActive = isPaidPlanActive(u);
          const freeUsed = Math.min(getUserFreeUnlockedIds(u, recipes).length, FREE_RECIPE_LIMIT);
          const premUsed = getUserPremiumUnlockedIds(u, recipes).length;
          const premQuota = getUserPremiumQuota(u, plans, recipes);
          const isExhausted =
            !isAdminAcc &&
            (paidActive ? premQuota > 0 && premUsed >= premQuota : freeUsed >= FREE_RECIPE_LIMIT);
          const isUnused = freeUsed === 0 && premUsed === 0;
          if (allQuotaFilter === 'exhausted' && !isExhausted) return false;
          if (allQuotaFilter === 'remaining' && (isExhausted || isUnused)) return false;
          if (allQuotaFilter === 'unused' && !isUnused) return false;
        }
        if (q) {
          const hay = [
            u.displayName,
            u.email,
            u.phoneNumber,
            formatUserContact(u.email, u.phoneNumber),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (allSortBy === 'oldest') return getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt);
        if (allSortBy === 'name') {
          return (a.displayName || '').localeCompare(b.displayName || '', 'bn');
        }
        if (allSortBy === 'most_used') return getMemberUsedCount(b) - getMemberUsedCount(a);
        return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
      });
  })();

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE));
  const safeMembersPage = Math.min(membersPage, totalMemberPages);
  const memberStartIdx = (safeMembersPage - 1) * MEMBERS_PER_PAGE;
  const paginatedMembers = filteredMembers.slice(memberStartIdx, memberStartIdx + MEMBERS_PER_PAGE);
  const memberRangeStart = filteredMembers.length === 0 ? 0 : memberStartIdx + 1;
  const memberRangeEnd = Math.min(memberStartIdx + MEMBERS_PER_PAGE, filteredMembers.length);

  const hasActiveAllFilter =
    Boolean(allSearch.trim()) ||
    allPlanFilter !== 'all' ||
    allStatusFilter !== 'all' ||
    allActiveFilter !== 'all' ||
    allQuotaFilter !== 'all' ||
    allSortBy !== 'newest';
  const hasActivePremiumFilter =
    Boolean(premiumSearch.trim()) ||
    premiumTierFilter !== 'all' ||
    premiumActiveFilter !== 'all' ||
    premiumHealthFilter !== 'all' ||
    premiumSortBy !== 'expiry_soonest';
  const hasActivePendingFilter =
    Boolean(pendingSearch.trim()) ||
    pendingMethodFilter !== 'all' ||
    pendingTierFilter !== 'all' ||
    pendingSortBy !== 'newest';

  const handleSelectKpiView = (view: MemberFilterView) => {
    setAdminView('dashboard');
    setActiveTab('users');
    setMemberFilterView(view);
    setMembersPage(1);
    setTimeout(() => {
      const target = view === 'pending' ? pendingSectionRef.current : membersTableRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const totalRevenueAmount = ordersList
    .filter((o) => o.status === 'active')
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const usersByUid = new Map<string, UserProfile>();
  const usersByEmail = new Map<string, UserProfile>();
  usersList.forEach((u) => {
    usersByUid.set(u.uid, u);
    if (u.email) usersByEmail.set(u.email.toLowerCase(), u);
  });

  const paidOrdersOnly = ordersList.filter(
    (o) => o.planTier !== 'basic' && Number(o.amount) > 0
  );

  const getOrderTimeMs = (createdAt: unknown): number => {
    const ms = getSubscriptionExpiresMillis(createdAt);
    return ms ?? 0;
  };

  const groupedPaidOrdersMap = new Map<
    string,
    {
      key: string;
      userProfile?: UserProfile;
      userName: string;
      contact: string;
      photoURL?: string;
      orders: SubscriptionOrder[];
      totalApprovedAmount: number;
      latestOrderMs: number;
    }
  >();

  paidOrdersOnly.forEach((o) => {
    const emailKey = (o.userEmail || '').toLowerCase();
    const matchedUser =
      (o.userId ? usersByUid.get(o.userId) : undefined) ||
      (emailKey ? usersByEmail.get(emailKey) : undefined);
    const groupKey = matchedUser?.uid || o.userId || emailKey || o.id;
    const orderMs = getOrderTimeMs(o.createdAt);
    const existing = groupedPaidOrdersMap.get(groupKey);

    if (existing) {
      existing.orders.push(o);
      if (o.status === 'active') {
        existing.totalApprovedAmount += Number(o.amount) || 0;
      }
      if (orderMs > existing.latestOrderMs) {
        existing.latestOrderMs = orderMs;
      }
    } else {
      groupedPaidOrdersMap.set(groupKey, {
        key: groupKey,
        userProfile: matchedUser,
        userName: matchedUser?.displayName || o.userName || 'সদস্য',
        contact: formatUserContact(matchedUser?.email || o.userEmail, matchedUser?.phoneNumber),
        photoURL: matchedUser?.photoURL,
        orders: [o],
        totalApprovedAmount: o.status === 'active' ? Number(o.amount) || 0 : 0,
        latestOrderMs: orderMs,
      });
    }
  });

  const groupedPaidOrders = Array.from(groupedPaidOrdersMap.values())
    .map((group) => ({
      ...group,
      orders: [...group.orders].sort(
        (a, b) => getOrderTimeMs(a.createdAt) - getOrderTimeMs(b.createdAt)
      ),
    }))
    .sort((a, b) => b.latestOrderMs - a.latestOrderMs)
    .map((group, idx, arr) => ({
      ...group,
      memberSerial: arr.length - idx,
    }));

  const paidHistoryQuery = paidHistorySearch.trim().toLowerCase();
  const filteredGroupedPaidOrders = groupedPaidOrders
    .filter((group) => {
      if (paidHistoryUpgradeFilter === 'multiple' && group.orders.length <= 1) return false;
      if (paidHistoryUpgradeFilter === 'single' && group.orders.length !== 1) return false;
      if (paidHistoryStatusFilter !== 'all') {
        const hasMatchingStatus = group.orders.some((o) =>
          paidHistoryStatusFilter === 'rejected'
            ? o.status !== 'active' && o.status !== 'pending'
            : o.status === paidHistoryStatusFilter
        );
        if (!hasMatchingStatus) return false;
      }
      if (paidHistoryMethodFilter !== 'all') {
        const hasMatchingMethod = group.orders.some(
          (o) => normalizePaymentMethod(o.paymentMethod) === paidHistoryMethodFilter
        );
        if (!hasMatchingMethod) return false;
      }
      if (paidHistoryQuery) {
        const hay = [
          group.userName,
          group.contact,
          ...group.orders.flatMap((o) => [
            o.planName,
            o.paymentMethod,
            o.senderNumber,
            o.transactionId,
          ]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(paidHistoryQuery)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (paidHistorySortBy === 'amount_desc') return b.totalApprovedAmount - a.totalApprovedAmount;
      if (paidHistorySortBy === 'upgrades_desc') return b.orders.length - a.orders.length;
      return b.latestOrderMs - a.latestOrderMs;
    });

  const hasActivePaidHistoryFilter =
    Boolean(paidHistorySearch.trim()) ||
    paidHistoryStatusFilter !== 'all' ||
    paidHistoryMethodFilter !== 'all' ||
    paidHistoryUpgradeFilter !== 'all' ||
    paidHistorySortBy !== 'latest';

  const totalPaidHistoryPages = Math.max(
    1,
    Math.ceil(filteredGroupedPaidOrders.length / PAID_HISTORY_PER_PAGE)
  );
  const safePaidHistoryPage = Math.min(paidHistoryPage, totalPaidHistoryPages);
  const paidHistoryStartIdx = (safePaidHistoryPage - 1) * PAID_HISTORY_PER_PAGE;
  const paginatedGroupedPaidOrders = filteredGroupedPaidOrders.slice(
    paidHistoryStartIdx,
    paidHistoryStartIdx + PAID_HISTORY_PER_PAGE
  );
  const paidHistoryRangeStart =
    filteredGroupedPaidOrders.length === 0 ? 0 : paidHistoryStartIdx + 1;
  const paidHistoryRangeEnd = Math.min(
    paidHistoryStartIdx + PAID_HISTORY_PER_PAGE,
    filteredGroupedPaidOrders.length
  );

  const startEditRecipe = async (recipe: Recipe) => {
    if (!isFullAdmin && recipe.createdByUid !== currentUser.uid) {
      notify('আপনি শুধুমাত্র নিজের তৈরি করা রেসিপি সম্পাদনা করতে পারবেন।', 'error');
      return;
    }
    setEditingRecipeId(recipe.id);
    setRTitle(recipe.title);
    setRSubtitle(recipe.subtitle);
    setRImageUrl(recipe.imageUrl);
    setRCuisine(recipe.cuisine);
    setRCategory(recipe.category);
    setRCookTime(recipe.cookTime);
    setRDifficulty(recipe.difficulty);
    setRServings(recipe.servings || '৪ জন');
    setRIsPremium(recipe.isPremium);
    setRIsFeatured(recipe.isFeatured);

    const { content } = await fetchRecipeContent(recipe.id, recipe.isPremium, true);
    setRIngredientsText(content?.ingredients.join('\n') || '');
    if (content?.steps && content.steps.length > 0) {
      setRSteps(
        content.steps.map((text, idx) => ({
          text,
          imageUrl: content.stepImages?.[idx] || '',
        }))
      );
    } else {
      setRSteps([{ text: '', imageUrl: '' }]);
    }
    setRChefTip(content?.chefTip || '');
  };

  const resetRecipeForm = () => {
    setEditingRecipeId(null);
    setRTitle('');
    setRSubtitle('');
    setRImageUrl('');
    setRCuisine('বাঙ্গালি');
    setRCategory(categories[0]?.name || 'ভাত ও পোলাও');
    setRCookTime('৩০ মিনিট');
    setRDifficulty('সহজ');
    setRServings('৪ জন');
    setRIsPremium(false);
    setRIsFeatured(false);
    setRIngredientsText('');
    setRSteps([{ text: '', imageUrl: '' }]);
    setRChefTip('');
  };

  const resetCategoryForm = () => {
    setEditingCatId(null);
    setCatName('');
    setCatIconKey('rice');
    setCatIconImageUrl('');
    setCatOrderIndex(categories.length + 1);
    setCatIsActive(true);
  };

  const handleCatCustomIconUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'quick' | 'tab'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (target === 'quick') setQuickCatUploading(true);
    else setCatIconUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 256,
        maxHeight: 256,
        quality: 0.85,
        maxChars: 95000,
      });
      if (target === 'quick') {
        setQuickCatIconUrl(dataUrl);
      } else {
        setCatIconImageUrl(dataUrl);
      }
      notify('ক্যাটাগরি আইকন ডিভাইস থেকে আপলোড হয়েছে।');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'আইকন আপলোড করা যায়নি।');
    } finally {
      if (target === 'quick') setQuickCatUploading(false);
      else setCatIconUploading(false);
    }
  };

  const handleSaveQuickCategory = async () => {
    const cleanName = quickCatName.trim();
    if (!cleanName) {
      notify('নতুন ক্যাটাগরির নাম লিখুন।');
      return;
    }
    setQuickCatSaving(true);
    try {
      const newId = `cat_${Date.now()}`;
      await saveCategoryAdmin(
        {
          id: newId,
          name: cleanName,
          iconKey: quickCatIconKey,
          iconImageUrl: quickCatIconUrl,
          orderIndex: categories.length + 1,
          isActive: true,
        },
        true
      );
      notify(`"${cleanName}" ক্যাটাগরি ও তার আলাদা পেজ তৈরি হয়েছে!`);
      setRCategory(cleanName);
      setShowQuickCatForm(false);
      setQuickCatName('');
      setQuickCatIconKey('rice');
      setQuickCatIconUrl('');
    } finally {
      setQuickCatSaving(false);
    }
  };

  const handleSaveCategoryTab = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = catName.trim();
    if (!cleanName) {
      notify('ক্যাটাগরির নাম লিখুন।');
      return;
    }
    setCatSaving(true);
    try {
      const isNew = !editingCatId;
      const catId = editingCatId || `cat_${Date.now()}`;
      await saveCategoryAdmin(
        {
          id: catId,
          name: cleanName,
          iconKey: catIconKey,
          iconImageUrl: catIconImageUrl,
          orderIndex: Number(catOrderIndex) || categories.length + 1,
          isActive: catIsActive,
        },
        isNew
      );
      notify(isNew ? `"${cleanName}" ক্যাটাগরি ও আলাদা পেজ তৈরি হয়েছে!` : 'ক্যাটাগরি আপডেট হয়েছে!');
      resetCategoryForm();
    } finally {
      setCatSaving(false);
    }
  };

  const handleRecipeCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRImageUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 1280,
        maxHeight: 840,
        quality: 0.86,
        maxChars: 280000,
      });
      setRImageUrl(dataUrl);
      notify('রেসিপির মূল ছবি ডিভাইস থেকে যুক্ত হয়েছে।');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'ছবি আপলোড করা যায়নি।');
    } finally {
      setRImageUploading(false);
    }
  };

  const handleStepImageUpload = async (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRStepUploadingIdx(idx);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 1280,
        maxHeight: 720,
        quality: 0.86,
        maxChars: 175000,
      });
      setRSteps((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, imageUrl: dataUrl } : item))
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'ধাপের ছবি আপলোড করা যায়নি।');
    } finally {
      setRStepUploadingIdx(null);
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rImageUrl.trim()) {
      notify('অনুগ্রহ করে ডিভাইস থেকে রেসিপির মূল ছবি আপলোড করুন।', 'error');
      return;
    }
    const isNew = !editingRecipeId;
    const id = editingRecipeId || `recipe_${Date.now()}`;
    const existing = recipes.find((r) => r.id === id);
    if (!isNew && !isFullAdmin && existing?.createdByUid !== currentUser.uid) {
      notify('আপনি শুধুমাত্র নিজের তৈরি করা রেসিপি সম্পাদনা করতে পারবেন।', 'error');
      return;
    }
    const validSteps = rSteps.filter((s) => s.text.trim().length > 0);

    await saveRecipeAdmin(
      {
        id,
        title: rTitle.trim(),
        subtitle: rSubtitle.trim(),
        imageUrl: rImageUrl.trim(),
        cuisine: rCuisine.trim() || 'বাঙ্গালি',
        dietType: existing?.dietType || 'নন-ভেজ',
        category: rCategory.trim() || 'সাধারণ',
        cookTime: rCookTime.trim() || '৩০ মিনিট',
        difficulty: rDifficulty,
        servings: rServings.trim() || '৪ জন',
        rating: existing?.rating ?? 4.8,
        ratingCount: existing?.ratingCount ?? 1,
        isPremium: rIsPremium,
        isFeatured: rIsFeatured,
        orderIndex: existing?.orderIndex ?? recipes.length + 1,
        createdByUid: isNew ? currentUser.uid : existing?.createdByUid,
        createdByName: isNew ? currentUser.displayName : existing?.createdByName,
      },
      {
        ingredients: rIngredientsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        steps: validSteps.map((s) => s.text.trim()),
        stepImages: validSteps.map((s) => s.imageUrl.trim()),
        chefTip: rChefTip.trim(),
      },
      isNew,
      isFullAdmin
    );

    notify(isNew ? 'নতুন রেসিপি যুক্ত করা হয়েছে!' : 'রেসিপি আপডেট করা হয়েছে!');
    resetRecipeForm();
  };

  const handleSavePlan = async (plan: SubscriptionPlan, fieldUpdates: Partial<SubscriptionPlan>) => {
    await savePlanAdmin({
      id: plan.id,
      name: fieldUpdates.name ?? plan.name,
      tier: plan.tier,
      priceLabel: fieldUpdates.priceLabel ?? plan.priceLabel,
      priceAmount: fieldUpdates.priceAmount ?? plan.priceAmount,
      durationLabel: fieldUpdates.durationLabel ?? plan.durationLabel,
      durationDays: fieldUpdates.durationDays ?? plan.durationDays,
      recipeLimit: fieldUpdates.recipeLimit ?? plan.recipeLimit,
      subtitle: fieldUpdates.subtitle ?? plan.subtitle,
      features: fieldUpdates.features ?? plan.features,
      accentColor: (fieldUpdates.accentColor ?? plan.accentColor) as PlanAccent,
      isActive: fieldUpdates.isActive ?? plan.isActive,
      orderIndex: plan.orderIndex,
    });
    notify(`${plan.name} প্ল্যান সংরক্ষণ করা হয়েছে!`);
  };

  const handleBlogImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBlogImageUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 1280,
        maxHeight: 800,
        quality: 0.86,
        maxChars: 280000,
      });
      setBlogImage(dataUrl);
      notify('ব্লগের ছবি ডিভাইস থেকে যুক্ত হয়েছে।');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'ব্লগের ছবি আপলোড করা যায়নি।', 'error');
    } finally {
      setBlogImageUploading(false);
    }
  };

  const handleSaveTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = !editingTipId;
    const id = editingTipId || `tip_${Date.now()}`;
    const existingTip = tips.find((t) => t.id === id);
    if (!isNew && !isFullAdmin && existingTip?.createdByUid !== currentUser.uid) {
      notify('আপনি শুধুমাত্র নিজের তৈরি করা টিপস সম্পাদনা করতে পারবেন।', 'error');
      return;
    }
    await saveTipAdmin(
      {
        id,
        title: tipTitle.trim(),
        category: tipCategory.trim(),
        summary: tipSummary.trim(),
        content: tipContent.trim(),
        readTime: '৩ মিনিট পাঠ',
        isPublished: true,
        createdByUid: isNew ? currentUser.uid : existingTip?.createdByUid,
        createdByName: isNew ? currentUser.displayName : existingTip?.createdByName,
      },
      isNew
    );
    setEditingTipId(null);
    setTipTitle('');
    setTipSummary('');
    setTipContent('');
    notify('টিপস সংরক্ষণ করা হয়েছে!');
  };

  const handleSaveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogImage.trim()) {
      notify('অনুগ্রহ করে ডিভাইস থেকে ব্লগের ছবি আপলোড করুন।', 'error');
      return;
    }
    const isNew = !editingBlogId;
    const id = editingBlogId || `blog_${Date.now()}`;
    const existingBlog = blogPosts.find((b) => b.id === id);
    if (!isNew && !isFullAdmin && existingBlog?.createdByUid !== currentUser.uid) {
      notify('আপনি শুধুমাত্র নিজের তৈরি করা ব্লগ পোস্ট সম্পাদনা করতে পারবেন।', 'error');
      return;
    }
    await saveBlogAdmin(
      {
        id,
        title: blogTitle.trim(),
        category: blogCategory.trim(),
        authorName: existingBlog?.authorName || '',
        excerpt: blogExcerpt.trim(),
        content: blogContent.trim(),
        imageUrl: blogImage.trim(),
        readTime: '৫ মিনিট পাঠ',
        isPublished: true,
        createdByUid: isNew ? currentUser.uid : existingBlog?.createdByUid,
        createdByName: isNew ? currentUser.displayName : existingBlog?.createdByName,
      },
      isNew
    );
    setEditingBlogId(null);
    setBlogTitle('');
    setBlogExcerpt('');
    setBlogContent('');
    setBlogImage('');
    notify('ব্লগ পোস্ট সংরক্ষণ করা হয়েছে!');
  };

  const handleSocialImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSocialImgUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 1200,
        maxHeight: 630,
        quality: 0.84,
        maxChars: 240000,
      });
      setSSocialImageUrl(dataUrl);
      notify('সোশ্যাল শেয়ার ইমেজ যুক্ত হয়েছে! এবার "শেয়ার সেটিংস সংরক্ষণ করুন" বাটনে ক্লিক করুন।');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'ইমেজ আপলোড করতে সমস্যা হয়েছে।');
    } finally {
      setSocialImgUploading(false);
    }
  };

  const buildFullSettingsPayload = (
    overrides?: Partial<Omit<SiteSettings, 'updatedAt'>>
  ): Omit<SiteSettings, 'updatedAt'> => {
    const cleanSiteName = (sSiteName.trim() || siteSettings.siteName || 'রান্না শিখুন').slice(0, 60);
    return {
      siteName: cleanSiteName.length >= 2 ? cleanSiteName : 'রান্না শিখুন',
      tagline: (sTagline.trim() || siteSettings.tagline || '').slice(0, 160),
      showAnnouncement: Boolean(sShowAnnounce),
      announcementText: (sAnnounceText || '').trim().slice(0, 200),
      paymentBkashNumber: (sBkash || '').trim().slice(0, 40),
      paymentNagadNumber: (sNagad || '').trim().slice(0, 40),
      paymentInstructions: (sPayInst || '').trim().slice(0, 400),
      recipeFontDesktop: resolveFontKey(fontDraft.recipeFontDesktop, 'bensen'),
      recipeFontMobile: resolveFontKey(fontDraft.recipeFontMobile, 'bensen'),
      recipeFontSizeDesktop: resolveFontSizeKey(fontDraft.recipeFontSizeDesktop, '100'),
      recipeFontSizeMobile: resolveFontSizeKey(fontDraft.recipeFontSizeMobile, '100'),
      adminFontFamily: resolveFontKey(fontDraft.adminFontFamily, 'hind-siliguri'),
      adminFontMobile: resolveFontKey(fontDraft.adminFontMobile, 'hind-siliguri'),
      adminFontSize: resolveFontSizeKey(fontDraft.adminFontSize, '100'),
      adminFontSizeMobile: resolveFontSizeKey(fontDraft.adminFontSizeMobile, '100'),
      profileFontFamily: resolveFontKey(fontDraft.profileFontFamily, 'hind-siliguri'),
      profileFontMobile: resolveFontKey(fontDraft.profileFontMobile, 'hind-siliguri'),
      profileFontSize: resolveFontSizeKey(fontDraft.profileFontSize, '100'),
      profileFontSizeMobile: resolveFontSizeKey(fontDraft.profileFontSizeMobile, '100'),
      checkoutFontFamily: resolveFontKey(fontDraft.checkoutFontFamily, 'hind-siliguri'),
      checkoutFontMobile: resolveFontKey(fontDraft.checkoutFontMobile, 'hind-siliguri'),
      checkoutFontSize: resolveFontSizeKey(fontDraft.checkoutFontSize, '100'),
      checkoutFontSizeMobile: resolveFontSizeKey(fontDraft.checkoutFontSizeMobile, '100'),
      homeFontFamily: resolveFontKey(fontDraft.homeFontFamily, 'hind-siliguri'),
      homeFontMobile: resolveFontKey(fontDraft.homeFontMobile, 'hind-siliguri'),
      homeFontSize: resolveFontSizeKey(fontDraft.homeFontSize, '100'),
      homeFontSizeMobile: resolveFontSizeKey(fontDraft.homeFontSizeMobile, '100'),
      pricingFontFamily: resolveFontKey(fontDraft.pricingFontFamily, 'hind-siliguri'),
      pricingFontMobile: resolveFontKey(fontDraft.pricingFontMobile, 'hind-siliguri'),
      pricingFontSize: resolveFontSizeKey(fontDraft.pricingFontSize, '100'),
      pricingFontSizeMobile: resolveFontSizeKey(fontDraft.pricingFontSizeMobile, '100'),
      blogTipsFontFamily: resolveFontKey(fontDraft.blogTipsFontFamily, 'hind-siliguri'),
      blogTipsFontMobile: resolveFontKey(fontDraft.blogTipsFontMobile, 'hind-siliguri'),
      blogTipsFontSize: resolveFontSizeKey(fontDraft.blogTipsFontSize, '100'),
      blogTipsFontSizeMobile: resolveFontSizeKey(fontDraft.blogTipsFontSizeMobile, '100'),
      authFontFamily: resolveFontKey(fontDraft.authFontFamily, 'hind-siliguri'),
      authFontMobile: resolveFontKey(fontDraft.authFontMobile, 'hind-siliguri'),
      authFontSize: resolveFontSizeKey(fontDraft.authFontSize, '100'),
      authFontSizeMobile: resolveFontSizeKey(fontDraft.authFontSizeMobile, '100'),
      seoTitle: ((sSeoTitle || '').trim() || DEFAULT_SEO_TITLE).slice(0, 120),
      seoDescription: ((sSeoDescription || '').trim() || DEFAULT_SEO_DESCRIPTION).slice(0, 320),
      seoKeywords: ((sSeoKeywords || '').trim() || DEFAULT_SEO_KEYWORDS).slice(0, 500),
      seoAuthor: ((sSeoAuthor || '').trim() || cleanSiteName || 'রান্না শিখুন').slice(0, 100),
      canonicalBaseUrl: (sCanonicalBaseUrl || '').trim().replace(/\/+$/, '').slice(0, 200),
      seoRobotsPolicy: sSeoRobotsPolicy === 'noindex, nofollow' ? 'noindex, nofollow' : 'index, follow',
      googleSiteVerification: extractGoogleVerificationCode(sGoogleVerification || '').slice(0, 140),
      googleVerificationFile: extractGoogleVerificationFilename(sGoogleVerificationFile || '').slice(0, 120),
      bingSiteVerification: (sBingVerification || '').trim().slice(0, 140),
      googleAnalyticsId: (sGoogleAnalyticsId || '').trim().slice(0, 40),
      robotsTxtExtra: (sRobotsTxtExtra || '').trim().slice(0, 800),
      socialShareImageUrl: (sSocialImageUrl || '').trim().slice(0, 700000),
      socialShareTitle: ((sSocialTitle || '').trim() || (sSeoTitle || '').trim() || DEFAULT_SEO_TITLE).slice(0, 120),
      socialShareDescription: (
        (sSocialDesc || '').trim() ||
        (sSeoDescription || '').trim() ||
        DEFAULT_SEO_DESCRIPTION
      ).slice(0, 320),
      socialShareImageAlt: (sSocialImageAlt || '').trim().slice(0, 160),
      twitterHandle: (sTwitterHandle || '').trim().slice(0, 60),
      fbAppId: (sFbAppId || '').trim().slice(0, 40),
      showRecipeShareButton: Boolean(sShowRecipeShare),
      contactEmail: ((sEmail || '').trim() || siteSettings.contactEmail || '').slice(0, 120),
      contactPhone: ((sPhone || '').trim() || siteSettings.contactPhone || '').slice(0, 40),
      contactAddress: ((sAddress || '').trim() || siteSettings.contactAddress || '').slice(0, 200),
      footerNote: (sFooter || '').trim().slice(0, 240),
      ...overrides,
    };
  };

  const commitSiteSettings = async (
    overrides?: Partial<Omit<SiteSettings, 'updatedAt'>>
  ): Promise<Omit<SiteSettings, 'updatedAt'>> => {
    const payload = buildFullSettingsPayload(overrides);
    await saveSiteSettingsAdmin(payload);
    const syncedSnapshot = extractFontSettingsValues(payload);
    lastSyncedFontKeyRef.current = JSON.stringify(syncedSnapshot);
    onSiteSettingsSaved?.({ ...siteSettings, ...payload });
    return payload;
  };

  const handleToggleRecipeShareButton = async () => {
    const nextVal = !sShowRecipeShare;
    setSShowRecipeShare(nextVal);
    setTogglingRecipeShare(true);
    try {
      await commitSiteSettings({ showRecipeShareButton: nextVal });
      notify(
        nextVal
          ? 'রেসিপি পোস্টে "শেয়ার করুন" অপশন চালু করা হয়েছে!'
          : 'রেসিপি পোস্টে "শেয়ার করুন" অপশন বন্ধ করা হয়েছে!'
      );
    } catch {
      setSShowRecipeShare(!nextVal);
      notify('সেটিংস আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error');
    } finally {
      setTogglingRecipeShare(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await commitSiteSettings();
      notify('সাইট ও পেমেন্ট সেটিংস সফলভাবে আপডেট করা হয়েছে!');
    } catch {
      notify('সেটিংস আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error');
    }
  };

  const handleSaveSocialSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSocial(true);
    try {
      await commitSiteSettings();
      notify('সোশ্যাল মিডিয়া শেয়ার সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!');
    } catch {
      notify('শেয়ার সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error');
    } finally {
      setSavingSocial(false);
    }
  };

  const handleSaveSeoSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSeo(true);
    try {
      await commitSiteSettings();
      notify('SEO ও Google Search Console সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!');
    } catch {
      notify('SEO সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error');
    } finally {
      setSavingSeo(false);
    }
  };

  const handleSaveFontSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFonts(true);
    setFontsJustSaved(false);
    setFontSaveError(null);
    try {
      await commitSiteSettings();
      setFontsJustSaved(true);
      notify('সব পেজের পিসি ও মোবাইল ফন্ট সফলভাবে সংরক্ষণ ও কার্যকর করা হয়েছে!');
    } catch (err) {
      console.error('Failed to save font settings:', err);
      const errMsg =
        'ফন্ট সেটিংস সংরক্ষণ করা যায়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ বা এডমিন সেশন যাচাই করে আবার চেষ্টা করুন।';
      setFontSaveError(errMsg);
      notify(errMsg, 'error');
    } finally {
      setSavingFonts(false);
    }
  };

  const savedFontSettingsValues = extractFontSettingsValues(siteSettings);

  const handleFontFieldChange = <K extends keyof FontSettingsValues>(
    field: K,
    value: FontSettingsValues[K]
  ) => {
    setFontsJustSaved(false);
    setFontSaveError(null);
    setFontDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetFontPage = (patch: Partial<FontSettingsValues>) => {
    setFontsJustSaved(false);
    setFontSaveError(null);
    setFontDraft((prev) => ({ ...prev, ...patch }));
  };

  const adminTypoClass = getResponsiveTypographyClass(
    fontDraft.adminFontFamily,
    fontDraft.adminFontMobile,
    fontDraft.adminFontSize,
    fontDraft.adminFontSizeMobile
  );

  return (
    <section className={`${adminTypoClass} max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#1B4D24]">
            <ShieldCheck className="w-4 h-4" />
            {!isFullAdmin
              ? 'মোডারেটর কন্ট্রোল প্যানেল'
              : adminView === 'customize'
                ? 'সাইট কাস্টমাইজেশন ও সেটিংস'
                : 'এডমিন কন্ট্রোল সেন্টার'}
          </div>
          <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-1">
            {!isFullAdmin
              ? 'কনটেন্ট পরিচালনা করুন'
              : adminView === 'customize'
                ? 'কাস্টমাইজ ও সেটিংস'
                : 'সবকিছু নিয়ন্ত্রণ করুন'}
          </h1>
          {!isFullAdmin && (
            <p className="text-xs text-gray-500 mt-1">
              আপনি নতুন রেসিপি, ক্যাটাগরি, টিপস ও ব্লগ প্রকাশ করতে পারবেন এবং আপনার তৈরি পোস্ট সম্পাদনা করতে পারবেন।
            </p>
          )}
          {isFullAdmin && adminView === 'customize' && (
            <p className="text-xs text-gray-500 mt-1">
              এখান থেকে সাইটের রেসিপি, ক্যাটাগরি, প্ল্যান, ব্লগ, ফন্ট, সোশ্যাল শেয়ার, SEO, ব্যাকআপ এবং সব সেটিংস কাস্টমাইজ করুন।
            </p>
          )}
        </div>

        {isFullAdmin && (
          adminView === 'customize' ? (
            <button
              type="button"
              onClick={() => {
                setExpandedEditor(null);
                setAdminView('dashboard');
                setActiveTab('users');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#1A1A1A] cursor-pointer self-start shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#1B4D24]" />
              ড্যাশবোর্ডে ফিরুন
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setExpandedEditor(null);
                setAdminView('customize');
                setActiveTab(lastCustomizeTab);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold cursor-pointer self-start shadow-xs transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              কাস্টমাইজ
            </button>
          )
        )}
      </div>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-[95] max-w-md px-4 py-3 rounded-xl text-white text-sm font-semibold flex items-center gap-2 shadow-xl ${
            toast.type === 'error' ? 'bg-[#B92B27]' : 'bg-[#1B4D24]'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Admin KPI Summary Metrics (Main Dashboard only — hidden on Customize page) */}
      {isFullAdmin && adminView === 'dashboard' && (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => handleSelectKpiView('all')}
            className={`text-left bg-white rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer hover:shadow-sm ${
              activeTab === 'users' && memberFilterView === 'all'
                ? 'border-[#1B4D24] ring-2 ring-[#1B4D24]/15'
                : 'border-gray-200 hover:border-[#1B4D24]/50'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>মোট সদস্য</span>
              <Users className="w-4 h-4 text-[#1B4D24]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#1A1A1A] tabular-nums">
              {toBengaliDigits(totalMembersCount)} জন
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold">
              <span className="text-[#1B4D24]">সব সদস্য দেখুন →</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold font-numeral-bn tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {toBengaliDigits(onlineMembersCount)} অনলাইন
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectKpiView('premium')}
            className={`text-left bg-white rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer hover:shadow-sm ${
              activeTab === 'users' && memberFilterView === 'premium'
                ? 'border-[#D4A017] ring-2 ring-[#D4A017]/20'
                : 'border-gray-200 hover:border-[#D4A017]/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>প্রিমিয়াম মেম্বার</span>
              <Crown className="w-4 h-4 text-[#D4A017]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#9A7209] tabular-nums">
              {toBengaliDigits(premiumMembersCount)} জন
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-[#9A7209]">
              প্রিমিয়াম তালিকা দেখুন →
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectKpiView('pending')}
            className={`text-left bg-white rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer hover:shadow-sm ${
              activeTab === 'users' && memberFilterView === 'pending'
                ? 'border-[#B92B27] ring-2 ring-[#B92B27]/15'
                : 'border-gray-200 hover:border-[#B92B27]/50'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>অপেক্ষমাণ পেমেন্ট</span>
              <Clock className="w-4 h-4 text-[#B92B27]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#B92B27] tabular-nums">
              {toBengaliDigits(pendingOrders.length)} টি
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-[#B92B27]">
              অপেক্ষমাণ ও পেইড ইতিহাস দেখুন →
            </p>
          </button>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>মোট আয় (অনুমোদিত)</span>
              <Wallet className="w-4 h-4 text-[#1B4D24]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#1B4D24] tabular-nums">
              {toBengaliDigits(totalRevenueAmount)} টাকা
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs — Dedicated Customize Page (Full Admin) OR 3-Tab Scoped Panel (Moderator) */}
      {(adminView === 'customize' || !isFullAdmin) && (
        <div className="mt-6 flex flex-col items-center gap-2.5">
          {isFullAdmin ? (
            <>
              {/* Customize Row 1: Content, Plans & Messages (No member tab here) */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { id: 'recipes', label: `রেসিপি (${toBengaliDigits(recipes.length)})`, icon: UtensilsCrossed },
                  { id: 'categories', label: `ক্যাটাগরি (${toBengaliDigits(categories.length)})`, icon: LayoutGrid },
                  { id: 'plans', label: 'সাবস্ক্রিপশন প্ল্যান', icon: CreditCard },
                  { id: 'content', label: 'টিপস ও ব্লগ', icon: BookOpen },
                  {
                    id: 'messages',
                    label: `বার্তা (${toBengaliDigits(messagesList.length + directThreads.length)})${
                      unreadDirectMessagesTotal > 0
                        ? ` · ${toBengaliDigits(unreadDirectMessagesTotal)} নতুন`
                        : ''
                    }`,
                    icon: Mail,
                  },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        const nextTab = tab.id as Exclude<AdminTab, 'users'>;
                        setExpandedEditor(null);
                        setLastCustomizeTab(nextTab);
                        setActiveTab(nextTab);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#1B4D24] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Customize Row 2: Font, Social Share, SEO, Backup, Recycle Bin & Site/Payment Settings */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { id: 'fonts', label: 'ফন্ট সেটিংস', icon: Type },
                  { id: 'social', label: 'সোশ্যাল মিডিয়া শেয়ার', icon: Share2 },
                  { id: 'seo', label: 'SEO সেটিংস', icon: Globe },
                  { id: 'backup', label: 'ব্যাকআপ ও রিস্টোর', icon: HardDrive },
                  {
                    id: 'recycle-bin',
                    label: `রিসাইকেল বিন (${toBengaliDigits(recycleBinItems.length)})`,
                    icon: Trash2,
                  },
                  { id: 'settings', label: 'সাইট ও পেমেন্ট সেটিংস', icon: Settings },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        const nextTab = tab.id as Exclude<AdminTab, 'users'>;
                        setExpandedEditor(null);
                        setLastCustomizeTab(nextTab);
                        setActiveTab(nextTab);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                        active
                          ? tab.id === 'recycle-bin'
                            ? 'bg-[#B92B27] text-white'
                            : 'bg-[#1B4D24] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Moderator: ONLY 3 tabs — Recipes, Categories, Tips & Blog */
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {[
                { id: 'recipes', label: `রেসিপি (${toBengaliDigits(recipes.length)})`, icon: UtensilsCrossed },
                { id: 'categories', label: `ক্যাটাগরি (${toBengaliDigits(categories.length)})`, icon: LayoutGrid },
                { id: 'content', label: 'টিপস ও ব্লগ', icon: BookOpen },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setExpandedEditor(null);
                      setActiveTab(tab.id as AdminTab);
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#1B4D24] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: PAYMENT VERIFICATION, ORDERS & USERS (Main Dashboard only) */}
      {isFullAdmin && adminView === 'dashboard' && activeTab === 'users' && (
        <div className="mt-6 space-y-8">
          {/* Manual TxID Verification Queue */}
          <div
            ref={pendingSectionRef}
            className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
              memberFilterView === 'pending'
                ? 'border-[#B92B27] shadow-sm'
                : 'border-[#D4A017]/50'
            }`}
          >
            <div className="px-5 py-4 bg-[#FFFBEB] border-b border-[#D4A017]/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#B8860B]" />
                <h2 className="text-base font-bold text-[#1A1A1A] font-numeral-bn">
                  অপেক্ষমাণ ট্রানজেকশন আইডি যাচাই ({toBengaliDigits(
                    memberFilterView === 'pending' ? filteredPendingOrders.length : pendingOrders.length
                  )})
                </h2>
              </div>
              {memberFilterView === 'pending' && hasActivePendingFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingSearch('');
                    setPendingMethodFilter('all');
                    setPendingTierFilter('all');
                    setPendingSortBy('newest');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#B92B27] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  ফিল্টার রিসেট
                </button>
              )}
            </div>

            {/* Pending Payment Tab Specific Filter Bar */}
            {memberFilterView === 'pending' && (
              <div className="px-5 py-3 bg-[#FFFDF5] border-b border-[#D4A017]/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    placeholder="নাম, প্রেরক নম্বর বা TxID খুঁজুন..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#B92B27]"
                  />
                </div>
                <select
                  value={pendingMethodFilter}
                  onChange={(e) =>
                    setPendingMethodFilter(e.target.value as 'all' | 'bkash' | 'nagad' | 'other')
                  }
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#B92B27]"
                >
                  <option value="all">সব পেমেন্ট মাধ্যম</option>
                  <option value="bkash">বিকাশ (bKash)</option>
                  <option value="nagad">নগদ (Nagad)</option>
                  <option value="other">অন্যান্য মাধ্যম</option>
                </select>
                <select
                  value={pendingTierFilter}
                  onChange={(e) =>
                    setPendingTierFilter(e.target.value as 'all' | 'standard' | 'pro')
                  }
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#B92B27]"
                >
                  <option value="all">সব পেইড প্ল্যান</option>
                  <option value="standard">স্ট্যান্ডার্ড প্ল্যান</option>
                  <option value="pro">প্রো প্ল্যান</option>
                </select>
                <select
                  value={pendingSortBy}
                  onChange={(e) =>
                    setPendingSortBy(e.target.value as 'newest' | 'oldest' | 'amount_desc')
                  }
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#B92B27]"
                >
                  <option value="newest">সাজানো: নতুন আবেদন আগে</option>
                  <option value="oldest">সাজানো: পুরোনো আবেদন আগে</option>
                  <option value="amount_desc">সাজানো: বেশি টাকা আগে</option>
                </select>
              </div>
            )}

            {(memberFilterView === 'pending' ? filteredPendingOrders : pendingOrders).length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                {memberFilterView === 'pending' && hasActivePendingFilter
                  ? 'এই ফিল্টারে কোনো অপেক্ষমাণ পেমেন্ট অনুরোধ পাওয়া যায়নি।'
                  : 'কোনো অপেক্ষমাণ পেমেন্ট ভেরিফিকেশন অনুরোধ নেই।'}
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {(memberFilterView === 'pending' ? filteredPendingOrders : pendingOrders).map((o) => (
                  <div
                    key={o.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#1A1A1A]">
                        {o.userName} ({formatUserContact(o.userEmail)})
                      </p>
                      <p className="text-xs text-gray-700">
                        প্ল্যান: <span className="font-bold text-[#1B4D24]">{o.planName}</span> · মূল্য:{' '}
                        <span className="font-bold tabular-nums font-numeral-bn">
                          ৳ {toBengaliDigits(o.amount)} টাকা
                        </span>
                      </p>
                      <p className="text-xs text-gray-700">
                        মাধ্যম: <span className="font-semibold">{o.paymentMethod}</span> · প্রেরক নম্বর:{' '}
                        <span className="font-semibold tabular-nums">{o.senderNumber || '-'}</span> · TxID:{' '}
                        <span className="font-bold text-[#B92B27] select-all">{o.transactionId || '-'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await approveSubscriptionOrderAdmin(o, plans);
                          notify(`${o.userName}-এর ${o.planName} প্ল্যান অনুমোদন ও কোটা যোগ করা হয়েছে!`);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        অনুমোদন করুন
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await rejectSubscriptionOrderAdmin(o);
                          notify('আবেদনটি বাতিল করা হয়েছে এবং সদস্যকে নোটিফিকেশন পাঠানো হয়েছে।');
                        }}
                        className="px-4 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        বাতিল
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registered Users Table */}
          <div ref={membersTableRef} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#1A1A1A] font-numeral-bn">
                {memberFilterView === 'premium'
                  ? `প্রিমিয়াম মেম্বার তালিকা (${toBengaliDigits(filteredMembers.length)} জন)`
                  : memberFilterView === 'pending'
                    ? `অপেক্ষমাণ পেমেন্টের সদস্য (${toBengaliDigits(filteredMembers.length)} জন)`
                    : `সকল নিবন্ধিত সদস্য ও সাবস্ক্রিপশন নিয়ন্ত্রণ (${toBengaliDigits(filteredMembers.length)} জন)`}
              </h2>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all' as MemberFilterView, label: `মোট সদস্য (${toBengaliDigits(totalMembersCount)})` },
                  { id: 'premium' as MemberFilterView, label: `প্রিমিয়াম (${toBengaliDigits(premiumMembersCount)})` },
                  { id: 'pending' as MemberFilterView, label: `অপেক্ষমাণ (${toBengaliDigits(pendingPaymentMembers.length)})` },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMemberFilterView(opt.id);
                      setMembersPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-numeral-bn cursor-pointer transition-colors ${
                      memberFilterView === opt.id
                        ? 'bg-[#1B4D24] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab-Tailored Member Filters */}
            {memberFilterView === 'all' && (
              <div className="px-5 py-3.5 bg-[#FAFAF8] border-b border-gray-100 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={allSearch}
                      onChange={(e) => setAllSearch(e.target.value)}
                      placeholder="নাম, ইমেইল বা ফোন খুঁজুন..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                    />
                  </div>
                  <select
                    value={allActiveFilter}
                    onChange={(e) =>
                      setAllActiveFilter(e.target.value as 'all' | 'online' | 'offline')
                    }
                    className={`px-3 py-2 text-xs bg-white border rounded-xl focus:outline-none focus:border-[#1B4D24] ${
                      allActiveFilter === 'online'
                        ? 'border-emerald-300 text-emerald-800 font-bold bg-emerald-50/40'
                        : 'border-gray-200'
                    }`}
                  >
                    <option value="all">অ্যাক্টিভ: সব ({toBengaliDigits(onlineMembersCount)} অনলাইন)</option>
                    <option value="online">অনলাইন (এখন অ্যাক্টিভ)</option>
                    <option value="offline">অফলাইন</option>
                  </select>
                  <select
                    value={allPlanFilter}
                    onChange={(e) => setAllPlanFilter(e.target.value as 'all' | PlanTier)}
                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                  >
                    <option value="all">প্ল্যান: সব প্ল্যান</option>
                    <option value="basic">ফ্রি / বেসিক</option>
                    <option value="standard">স্ট্যান্ডার্ড</option>
                    <option value="pro">প্রো</option>
                  </select>
                  <select
                    value={allStatusFilter}
                    onChange={(e) =>
                      setAllStatusFilter(e.target.value as 'all' | 'active' | 'expired')
                    }
                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                  >
                    <option value="all">অবস্থা: সব অবস্থা</option>
                    <option value="active">সক্রিয়</option>
                    <option value="expired">মেয়াদোত্তীর্ণ</option>
                  </select>
                  <select
                    value={allQuotaFilter}
                    onChange={(e) =>
                      setAllQuotaFilter(
                        e.target.value as 'all' | 'exhausted' | 'remaining' | 'unused'
                      )
                    }
                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                  >
                    <option value="all">কোটা: সব ব্যবহার</option>
                    <option value="exhausted">কোটা শেষ (লিমিট পূর্ণ)</option>
                    <option value="remaining">কোটা বাকি আছে</option>
                    <option value="unused">একটিও রেসিপি দেখেনি</option>
                  </select>
                  <select
                    value={allSortBy}
                    onChange={(e) =>
                      setAllSortBy(e.target.value as 'newest' | 'oldest' | 'name' | 'most_used')
                    }
                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                  >
                    <option value="newest">সাজানো: নতুন সদস্য আগে</option>
                    <option value="oldest">সাজানো: পুরোনো সদস্য আগে</option>
                    <option value="most_used">সাজানো: বেশি রেসিপি দেখা আগে</option>
                    <option value="name">সাজানো: নাম অনুযায়ী</option>
                  </select>
                </div>
                {hasActiveAllFilter && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-numeral-bn">
                      ফিল্টার ফলাফল: <strong className="text-[#1B4D24]">{toBengaliDigits(filteredMembers.length)}</strong> জন সদস্য
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAllSearch('');
                        setAllActiveFilter('all');
                        setAllPlanFilter('all');
                        setAllStatusFilter('all');
                        setAllQuotaFilter('all');
                        setAllSortBy('newest');
                      }}
                      className="inline-flex items-center gap-1 font-bold text-[#B92B27] hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      সব ফিল্টার রিসেট করুন
                    </button>
                  </div>
                )}
              </div>
            )}

            {memberFilterView === 'premium' && (
              <div className="px-5 py-3.5 bg-[#FFFDF5] border-b border-[#D4A017]/20 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={premiumSearch}
                      onChange={(e) => setPremiumSearch(e.target.value)}
                      placeholder="প্রিমিয়াম সদস্যের নাম, ইমেইল বা ফোন..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#D4A017]"
                    />
                  </div>
                  <select
                    value={premiumActiveFilter}
                    onChange={(e) =>
                      setPremiumActiveFilter(e.target.value as 'all' | 'online' | 'offline')
                    }
                    className={`px-3 py-2 text-xs bg-white border rounded-xl focus:outline-none focus:border-[#D4A017] ${
                      premiumActiveFilter === 'online'
                        ? 'border-emerald-300 text-emerald-800 font-bold bg-emerald-50/40'
                        : 'border-gray-200'
                    }`}
                  >
                    <option value="all">অ্যাক্টিভ: সব প্রিমিয়াম</option>
                    <option value="online">অনলাইন (এখন অ্যাক্টিভ)</option>
                    <option value="offline">অফলাইন</option>
                  </select>
                  <select
                    value={premiumTierFilter}
                    onChange={(e) =>
                      setPremiumTierFilter(e.target.value as 'all' | 'standard' | 'pro')
                    }
                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#D4A017]"
                  >
                    <option value="all">পেইড প্ল্যান: সব প্রিমিয়াম</option>
                    <option value="standard">শুধু স্ট্যান্ডার্ড</option>
                    <option value="pro">শুধু প্রো</option>
                  </select>
                  <select
                    value={premiumHealthFilter}
                    onChange={(e) =>
                      setPremiumHealthFilter(
                        e.target.value as
                          | 'all'
                          | 'expiring_soon'
                          | 'quota_full'
                          | 'quota_low'
                          | 'healthy'
                      )
                    }
                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#D4A017]"
                  >
                    <option value="all">মেয়াদ ও কোটা: সবগুলো</option>
                    <option value="expiring_soon">মেয়াদ শীঘ্রই শেষ (৭ দিনের মধ্যে)</option>
                    <option value="quota_full">প্রিমিয়াম কোটা শেষ</option>
                    <option value="quota_low">কোটা প্রায় শেষ (৮০%+)</option>
                    <option value="healthy">পর্যাপ্ত কোটা ও মেয়াদ আছে</option>
                  </select>
                  <select
                    value={premiumSortBy}
                    onChange={(e) =>
                      setPremiumSortBy(
                        e.target.value as 'expiry_soonest' | 'usage_highest' | 'newest' | 'name'
                      )
                    }
                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#D4A017]"
                  >
                    <option value="expiry_soonest">সাজানো: মেয়াদ আগে শেষ হবে</option>
                    <option value="usage_highest">সাজানো: বেশি কোটা ব্যবহৃত আগে</option>
                    <option value="newest">সাজানো: নতুন সদস্য আগে</option>
                    <option value="name">সাজানো: নাম অনুযায়ী</option>
                  </select>
                </div>
                {hasActivePremiumFilter && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-numeral-bn">
                      ফিল্টার ফলাফল: <strong className="text-[#9A7209]">{toBengaliDigits(filteredMembers.length)}</strong> জন প্রিমিয়াম মেম্বার
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPremiumSearch('');
                        setPremiumActiveFilter('all');
                        setPremiumTierFilter('all');
                        setPremiumHealthFilter('all');
                        setPremiumSortBy('expiry_soonest');
                      }}
                      className="inline-flex items-center gap-1 font-bold text-[#B92B27] hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      ফিল্টার রিসেট করুন
                    </button>
                  </div>
                )}
              </div>
            )}

            {filteredMembers.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                {memberFilterView === 'premium'
                  ? hasActivePremiumFilter
                    ? 'এই ফিল্টারে কোনো প্রিমিয়াম মেম্বার পাওয়া যায়নি।'
                    : 'এই মুহূর্তে কোনো সক্রিয় প্রিমিয়াম মেম্বার নেই।'
                  : memberFilterView === 'pending'
                    ? hasActivePendingFilter
                      ? 'এই ফিল্টারে কোনো অপেক্ষমাণ পেমেন্টের সদস্য পাওয়া যায়নি।'
                      : 'এই মুহূর্তে কোনো সদস্যের পেমেন্ট অপেক্ষমাণ নেই।'
                    : hasActiveAllFilter
                      ? 'এই ফিল্টারে কোনো নিবন্ধিত সদস্য পাওয়া যায়নি।'
                      : 'কোনো নিবন্ধিত সদস্য পাওয়া যায়নি।'}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="py-3 px-4">সদস্য (ছবি, অনলাইন/অফলাইন ও যোগাযোগ)</th>
                        <th className="py-3 px-4">প্ল্যান</th>
                        <th className="py-3 px-4">অবস্থা</th>
                        <th className="py-3 px-4">রেসিপি কোটা</th>
                        <th className="py-3 px-4">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedMembers.map((u) => (
                        <UserControlRow
                          key={u.uid}
                          user={u}
                          plans={plans}
                          recipes={recipes}
                          currentAdminUid={currentUser.uid}
                          allowDeleteAccount={memberFilterView === 'all'}
                          nowMs={nowMs}
                          unreadMessagesCount={directThreadsByUid.get(u.uid)?.unreadByAdmin || 0}
                          onUpdated={() => notify(`${u.displayName}-এর তথ্য আপডেট হয়েছে।`)}
                          onDeleted={() =>
                            notify(`${u.displayName}-এর অ্যাকাউন্ট সফলভাবে ডিলিট করা হয়েছে।`)
                          }
                          onDeleteError={(msg) => notify(msg, 'error')}
                          onPreviewMember={(member) => {
                            setPreviewMemberUid(member.uid);
                            setPreviewFallbackMember(member);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 20-Per-Page Member Pagination Bar */}
                <div className="px-5 py-3.5 bg-[#FAFAF8] border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-gray-600 font-numeral-bn tabular-nums">
                    মোট <strong className="text-[#1A1A1A]">{toBengaliDigits(filteredMembers.length)}</strong> জনের মধ্যে{' '}
                    <strong className="text-[#1B4D24]">
                      {toBengaliDigits(memberRangeStart)}–{toBengaliDigits(memberRangeEnd)}
                    </strong>{' '}
                    জন দেখানো হচ্ছে (প্রতি পেজে ২০ জন)
                  </p>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeMembersPage <= 1}
                      onClick={() => {
                        setMembersPage((p) => Math.max(1, p - 1));
                        membersTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-bold text-gray-700 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      আগের
                    </button>

                    <span className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-[#1A1A1A] font-numeral-bn tabular-nums">
                      পেজ {toBengaliDigits(safeMembersPage)} / {toBengaliDigits(totalMemberPages)}
                    </span>

                    <button
                      type="button"
                      disabled={safeMembersPage >= totalMemberPages}
                      onClick={() => {
                        setMembersPage((p) => Math.min(totalMemberPages, p + 1));
                        membersTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#1B4D24] hover:bg-[#143A1B] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      নেক্সট
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Paid Orders History (Grouped per Paid Member — shown ONLY in Pending Payment tab) */}
          {memberFilterView === 'pending' && (
          <div ref={paidHistoryRef} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1A1A1A]">
                  পেইড সাবস্ক্রিপশন অর্ডার ইতিহাস
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  শুধুমাত্র পেইড প্ল্যানের সদস্যদের তালিকা · একই সদস্যের একাধিক আপগ্রেড একসাথে দেখানো হয়েছে
                </p>
              </div>
              <span className="text-xs font-bold font-numeral-bn text-[#1B4D24] bg-[#EEF6EF] px-3 py-1.5 rounded-lg tabular-nums">
                {toBengaliDigits(filteredGroupedPaidOrders.length)} জন পেইড সদস্য · {toBengaliDigits(paidOrdersOnly.length)} টি অর্ডার
              </span>
            </div>

            {/* Paid Subscription History Filter Bar */}
            <div className="mb-4 p-3 rounded-xl bg-[#FAFAF8] border border-gray-100 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={paidHistorySearch}
                    onChange={(e) => setPaidHistorySearch(e.target.value)}
                    placeholder="নাম, নম্বর বা TxID খুঁজুন..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                  />
                </div>
                <select
                  value={paidHistoryStatusFilter}
                  onChange={(e) =>
                    setPaidHistoryStatusFilter(
                      e.target.value as 'all' | 'active' | 'pending' | 'rejected'
                    )
                  }
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                >
                  <option value="all">স্ট্যাটাস: সবগুলো</option>
                  <option value="active">অনুমোদিত</option>
                  <option value="pending">অপেক্ষমাণ</option>
                  <option value="rejected">বাতিল</option>
                </select>
                <select
                  value={paidHistoryMethodFilter}
                  onChange={(e) =>
                    setPaidHistoryMethodFilter(
                      e.target.value as 'all' | 'bkash' | 'nagad' | 'other'
                    )
                  }
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                >
                  <option value="all">মাধ্যম: সব মাধ্যম</option>
                  <option value="bkash">বিকাশ (bKash)</option>
                  <option value="nagad">নগদ (Nagad)</option>
                  <option value="other">অন্যান্য</option>
                </select>
                <select
                  value={paidHistoryUpgradeFilter}
                  onChange={(e) =>
                    setPaidHistoryUpgradeFilter(e.target.value as 'all' | 'multiple' | 'single')
                  }
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                >
                  <option value="all">ধরন: সব পেইড সদস্য</option>
                  <option value="multiple">একাধিকবার আপগ্রেড করেছে</option>
                  <option value="single">একবার প্ল্যান কিনেছে</option>
                </select>
                <select
                  value={paidHistorySortBy}
                  onChange={(e) =>
                    setPaidHistorySortBy(
                      e.target.value as 'latest' | 'amount_desc' | 'upgrades_desc'
                    )
                  }
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                >
                  <option value="latest">সাজানো: সর্বশেষ অর্ডার আগে</option>
                  <option value="amount_desc">সাজানো: বেশি পরিশোধ আগে</option>
                  <option value="upgrades_desc">সাজানো: বেশি আপগ্রেড আগে</option>
                </select>
              </div>
              {hasActivePaidHistoryFilter && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-numeral-bn">
                    পাওয়া গেছে: <strong className="text-[#1B4D24]">{toBengaliDigits(filteredGroupedPaidOrders.length)}</strong> জন পেইড সদস্য
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPaidHistorySearch('');
                      setPaidHistoryStatusFilter('all');
                      setPaidHistoryMethodFilter('all');
                      setPaidHistoryUpgradeFilter('all');
                      setPaidHistorySortBy('latest');
                    }}
                    className="inline-flex items-center gap-1 font-bold text-[#B92B27] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    ফিল্টার রিসেট করুন
                  </button>
                </div>
              )}
            </div>

            {filteredGroupedPaidOrders.length === 0 ? (
              <p className="text-sm text-gray-500">
                {hasActivePaidHistoryFilter
                  ? 'এই ফিল্টারে কোনো পেইড সাবস্ক্রিপশন অর্ডার পাওয়া যায়নি।'
                  : 'এখনো কোনো পেইড সাবস্ক্রিপশন অর্ডার আসেনি।'}
              </p>
            ) : (
              <>
              <div className="space-y-4">
                {paginatedGroupedPaidOrders.map((group) => {
                  const memberThemes = [
                    {
                      card: 'bg-[#F2F8F3] border-[#C6E2CB] border-l-[#1B4D24]',
                      header: 'bg-[#E5F3E8]/85 border-b-[#CFE7D4]',
                      serial: 'bg-[#1B4D24] text-white',
                      avatarRing: 'border-[#1B4D24]/35 hover:border-[#1B4D24]',
                      avatarFallback: 'bg-[#1B4D24]/15 text-[#1B4D24] border-[#1B4D24]/25',
                      totalPill: 'bg-[#1B4D24] text-white',
                      rowBorder: 'border-[#D7EAD9]',
                    },
                    {
                      card: 'bg-[#FFF9ED] border-[#F2DAA3] border-l-[#C4820E]',
                      header: 'bg-[#FEF1D4]/90 border-b-[#F3DFB0]',
                      serial: 'bg-[#B97A0B] text-white',
                      avatarRing: 'border-[#C4820E]/40 hover:border-[#B97A0B]',
                      avatarFallback: 'bg-[#C4820E]/15 text-[#9A6305] border-[#C4820E]/25',
                      totalPill: 'bg-[#9A6305] text-white',
                      rowBorder: 'border-[#F4E3BC]',
                    },
                    {
                      card: 'bg-[#F2F7FE] border-[#C6DCF9] border-l-[#2563EB]',
                      header: 'bg-[#E5EFFD]/90 border-b-[#CFE1FA]',
                      serial: 'bg-[#2563EB] text-white',
                      avatarRing: 'border-[#2563EB]/35 hover:border-[#2563EB]',
                      avatarFallback: 'bg-[#2563EB]/15 text-[#1D4ED8] border-[#2563EB]/25',
                      totalPill: 'bg-[#1D4ED8] text-white',
                      rowBorder: 'border-[#D6E5FB]',
                    },
                    {
                      card: 'bg-[#FDF4F4] border-[#F2CCCC] border-l-[#B92B27]',
                      header: 'bg-[#FAE8E8]/90 border-b-[#F3D5D5]',
                      serial: 'bg-[#B92B27] text-white',
                      avatarRing: 'border-[#B92B27]/35 hover:border-[#B92B27]',
                      avatarFallback: 'bg-[#B92B27]/15 text-[#B92B27] border-[#B92B27]/25',
                      totalPill: 'bg-[#B92B27] text-white',
                      rowBorder: 'border-[#F5DADA]',
                    },
                    {
                      card: 'bg-[#F5F3FF] border-[#D8CFFA] border-l-[#6D28D9]',
                      header: 'bg-[#ECE7FE]/90 border-b-[#DDD5FB]',
                      serial: 'bg-[#6D28D9] text-white',
                      avatarRing: 'border-[#6D28D9]/35 hover:border-[#6D28D9]',
                      avatarFallback: 'bg-[#6D28D9]/15 text-[#5B21B6] border-[#6D28D9]/25',
                      totalPill: 'bg-[#5B21B6] text-white',
                      rowBorder: 'border-[#E2DCFC]',
                    },
                    {
                      card: 'bg-[#F0FAF8] border-[#BCE6DE] border-l-[#0F766E]',
                      header: 'bg-[#DFF4F0]/90 border-b-[#C7EAE3]',
                      serial: 'bg-[#0F766E] text-white',
                      avatarRing: 'border-[#0F766E]/35 hover:border-[#0F766E]',
                      avatarFallback: 'bg-[#0F766E]/15 text-[#0F766E] border-[#0F766E]/25',
                      totalPill: 'bg-[#0F766E] text-white',
                      rowBorder: 'border-[#CEEBE5]',
                    },
                  ];
                  const memberSerial = group.memberSerial;
                  const theme = memberThemes[(memberSerial - 1) % memberThemes.length];
                  const approvedCount = group.orders.filter((ord) => ord.status === 'active').length;

                  return (
                    <div
                      key={group.key}
                      className={`rounded-2xl border border-l-4 overflow-hidden shadow-2xs transition-shadow hover:shadow-sm ${theme.card}`}
                    >
                      {/* Member Header */}
                      <div
                        className={`px-4 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${theme.header}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg text-xs font-extrabold font-numeral-bn flex items-center justify-center shrink-0 tabular-nums shadow-2xs ${theme.serial}`}
                          >
                            {toBengaliDigits(memberSerial)}
                          </span>
                          {(() => {
                            const groupOnline = isUserOnlineNow(group.userProfile, nowMs);
                            const openGroupMember = () => {
                              const resolvedMember: UserProfile = group.userProfile || {
                                uid: group.orders[0]?.userId || group.key,
                                displayName: group.userName,
                                email: group.orders[0]?.userEmail || '',
                                photoURL: group.photoURL,
                                role: 'member',
                                subscriptionPlan: group.orders[group.orders.length - 1]?.planTier || 'standard',
                                subscriptionStatus: 'active',
                                favoriteRecipeIds: [],
                              };
                              setPreviewMemberUid(resolvedMember.uid);
                              setPreviewFallbackMember(resolvedMember);
                            };
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={openGroupMember}
                                  title="সদস্যের প্রোফাইল প্রিভিউ ও মেসেজ দেখুন"
                                  className="relative group/avatar shrink-0 cursor-pointer"
                                >
                                  {group.photoURL ? (
                                    <div
                                      className={`w-11 h-11 rounded-full overflow-hidden border-2 bg-white transition-all shadow-2xs ${theme.avatarRing}`}
                                    >
                                      <img
                                        src={group.photoURL}
                                        alt={group.userName}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white" />
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      className={`w-11 h-11 rounded-full border flex items-center justify-center font-bold text-sm transition-all ${theme.avatarFallback}`}
                                    >
                                      {(group.userName || 'স').trim().charAt(0)}
                                    </div>
                                  )}
                                  <span
                                    title={groupOnline ? 'অনলাইন' : 'অফলাইন'}
                                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                      groupOnline ? 'bg-emerald-500' : 'bg-gray-400'
                                    }`}
                                  />
                                </button>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={openGroupMember}
                                      className="text-sm font-bold text-[#1A1A1A] hover:text-[#1B4D24] hover:underline truncate cursor-pointer text-left"
                                    >
                                      {group.userName}
                                    </button>
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        groupOnline
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          : 'bg-white/80 text-gray-500 border border-gray-200'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          groupOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                                        }`}
                                      />
                                      {groupOnline ? 'অনলাইন' : 'অফলাইন'}
                                    </span>
                                    {group.orders.length > 1 && (
                                      <span className="px-2 py-0.5 rounded-md bg-white/90 border border-black/10 text-[#1A1A1A] text-[11px] font-bold font-numeral-bn tabular-nums">
                                        {toBengaliDigits(group.orders.length)} বার প্ল্যান আপগ্রেড
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 truncate mt-0.5">
                                    {group.contact}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {group.totalApprovedAmount > 0 && (
                          <div
                            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl shadow-xs shrink-0 ${theme.totalPill}`}
                          >
                            <Wallet className="w-4 h-4 opacity-90 shrink-0" />
                            <div className="leading-tight">
                              <span className="text-[11px] font-semibold font-numeral-bn opacity-95 block">
                                সর্বমোট পরিশোধ ({toBengaliDigits(approvedCount)}টি)
                              </span>
                              <span className="text-base font-extrabold font-numeral-bn tracking-tight tabular-nums">
                                ৳ {toBengaliDigits(group.totalApprovedAmount)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Member's Paid Plan Upgrade Serial List */}
                      <div className="p-3 space-y-2">
                        {group.orders.map((o, orderIdx) => {
                          const orderDateMs = getOrderTimeMs(o.createdAt);
                          const orderDateLabel = orderDateMs
                            ? new Date(orderDateMs).toLocaleDateString('bn-BD', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : null;
                          const isLatestUpgrade =
                            group.orders.length > 1 && orderIdx === group.orders.length - 1;
                          const isApproved = o.status === 'active';
                          const isPending = o.status === 'pending';

                          return (
                            <div
                              key={o.id}
                              className={`px-3.5 py-3 rounded-xl bg-white/90 hover:bg-white border flex flex-wrap items-center justify-between gap-3 text-sm transition-colors ${theme.rowBorder}`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span className="mt-0.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-bold shrink-0 tabular-nums">
                                  #{toBengaliDigits(orderIdx + 1)}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-[#1A1A1A]">
                                      {o.planName}
                                    </span>
                                    {isLatestUpgrade && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-[#1B4D24]/10 text-[#1B4D24] text-[10px] font-bold">
                                        সর্বশেষ
                                      </span>
                                    )}
                                    {orderDateLabel && (
                                      <span className="text-[11px] text-gray-500">
                                        · {orderDateLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1 break-all">
                                    মাধ্যম: <span className="font-semibold text-gray-800">{o.paymentMethod}</span> · নম্বর:{' '}
                                    <span className="font-semibold text-gray-800 tabular-nums">{o.senderNumber || '-'}</span> · TxID:{' '}
                                    <span className="font-bold text-[#B92B27] select-all">
                                      {o.transactionId || '-'}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              {/* Redesigned Status + Taka Amount Display */}
                              <div className="inline-flex items-center gap-2.5 bg-[#FAFAF8] border border-gray-200/90 rounded-xl px-3 py-1.5 shrink-0">
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                    isApproved
                                      ? 'bg-[#E6F4EA] text-[#1B4D24]'
                                      : isPending
                                        ? 'bg-[#FEF3C7] text-[#92400E]'
                                        : 'bg-red-50 text-red-600'
                                  }`}
                                >
                                  {isApproved ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  ) : isPending ? (
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>
                                    {isApproved
                                      ? 'অনুমোদিত'
                                      : isPending
                                        ? 'অপেক্ষমাণ'
                                        : 'বাতিল'}
                                  </span>
                                </span>

                                <span className="w-px h-5 bg-gray-200 shrink-0" aria-hidden="true" />

                                <div
                                  className={`inline-flex items-baseline gap-1 tabular-nums ${
                                    isApproved
                                      ? 'text-[#1A1A1A]'
                                      : isPending
                                        ? 'text-[#92400E]'
                                        : 'text-gray-400 line-through'
                                  }`}
                                >
                                  <span className="text-base font-extrabold leading-none">
                                    ৳ {toBengaliDigits(o.amount)}
                                  </span>
                                  <span className="text-[11px] font-semibold text-gray-500">
                                    টাকা
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paid Order History Pagination (20 per page) */}
              <div className="mt-4 pt-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-600 font-numeral-bn tabular-nums">
                  মোট <strong className="text-[#1A1A1A]">{toBengaliDigits(filteredGroupedPaidOrders.length)}</strong> জন পেইড সদস্যের মধ্যে{' '}
                  <strong className="text-[#1B4D24]">
                    {toBengaliDigits(paidHistoryRangeStart)}–{toBengaliDigits(paidHistoryRangeEnd)}
                  </strong>{' '}
                  জন দেখানো হচ্ছে (প্রতি পেজে ২০ জন)
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePaidHistoryPage <= 1}
                    onClick={() => {
                      setPaidHistoryPage((p) => Math.max(1, p - 1));
                      paidHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-bold text-gray-700 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    আগের
                  </button>
                  <span className="px-2.5 py-1.5 rounded-lg bg-[#FAFAF8] border border-gray-200 text-xs font-bold text-[#1A1A1A] font-numeral-bn tabular-nums">
                    পেজ {toBengaliDigits(safePaidHistoryPage)} / {toBengaliDigits(totalPaidHistoryPages)}
                  </span>
                  <button
                    type="button"
                    disabled={safePaidHistoryPage >= totalPaidHistoryPages}
                    onClick={() => {
                      setPaidHistoryPage((p) => Math.min(totalPaidHistoryPages, p + 1));
                      paidHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#1B4D24] hover:bg-[#143A1B] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    নেক্সট
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              </>
            )}
          </div>
          )}
        </div>
      )}

      {/* TAB 2: RECIPES MANAGEMENT */}
      {activeTab === 'recipes' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div
            className={
              expandedEditor === 'recipe'
                ? 'fixed inset-0 z-[80] bg-[#FAF9F6] overflow-y-auto'
                : 'lg:col-span-5'
            }
          >
            <form
              onSubmit={handleSaveRecipe}
              className={
                expandedEditor === 'recipe'
                  ? 'max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6'
                  : 'bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-3.5 h-fit'
              }
            >
              <div
                className={
                  expandedEditor === 'recipe'
                    ? 'sticky top-0 z-10 bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs'
                    : 'flex items-center justify-between gap-2'
                }
              >
                <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A]">
                  {editingRecipeId ? 'রেসিপি সম্পাদনা করুন' : 'নতুন রেসিপি যোগ করুন'}
                </h2>
                <div className="flex items-center gap-2">
                  {editingRecipeId && (
                    <button
                      type="button"
                      onClick={resetRecipeForm}
                      className="text-xs font-semibold text-[#B92B27] hover:underline cursor-pointer"
                    >
                      নতুন যোগে ফিরুন
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedEditor((prev) => (prev === 'recipe' ? null : 'recipe'))
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      expandedEditor === 'recipe'
                        ? 'bg-[#1B4D24] text-white border-[#1B4D24] hover:bg-[#143A1B]'
                        : 'bg-[#F8F8F5] text-[#1B4D24] border-[#1B4D24]/25 hover:bg-[#1B4D24]/10'
                    }`}
                  >
                    {expandedEditor === 'recipe' ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>ছোট করুন</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>ফুল সাইজ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div
                className={
                  expandedEditor === 'recipe'
                    ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
                    : 'space-y-3.5'
                }
              >
                <div
                  className={
                    expandedEditor === 'recipe'
                      ? 'lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4'
                      : 'space-y-3.5'
                  }
                >
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">রেসিপির নাম</label>
                    <input
                      type="text"
                      required
                      value={rTitle}
                      onChange={(e) => setRTitle(e.target.value)}
                      placeholder="যেমন: কাচ্চি বিরিয়ানি"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">সংক্ষিপ্ত বিবরণ</label>
                    <textarea
                      rows={expandedEditor === 'recipe' ? 3 : 2}
                      required
                      value={rSubtitle}
                      onChange={(e) => setRSubtitle(e.target.value)}
                      placeholder="রেসিপির সংক্ষিপ্ত পরিচয়..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      রেসিপির ছবি (শুধুমাত্র ডিভাইস থেকে আপলোড করুন)
                    </label>

                    {rImageUrl && (
                      <div className="relative mb-2 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img
                          src={rImageUrl}
                          alt="রেসিপির ছবি প্রিভিউ"
                          referrerPolicy="no-referrer"
                          className={`w-full object-cover ${
                            expandedEditor === 'recipe' ? 'h-52' : 'h-36'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setRImageUrl('')}
                          className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-semibold hover:bg-black cursor-pointer"
                        >
                          ছবি সরান
                        </button>
                      </div>
                    )}

                    <label className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-[#1B4D24]/40 hover:border-[#1B4D24] bg-[#FAFAF8] hover:bg-[#1B4D24]/5 text-xs font-bold text-[#1B4D24] flex items-center justify-center gap-2 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4 shrink-0" />
                      <span>
                        {rImageUploading
                          ? 'ছবি প্রস্তুত হচ্ছে...'
                          : rImageUrl
                            ? 'ডিভাইস থেকে নতুন ছবি পরিবর্তন করুন'
                            : 'ডিভাইস থেকে ছবি আপলোড করুন'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleRecipeCoverUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="block text-xs font-semibold text-gray-700">ক্যাটাগরি</label>
                        <button
                          type="button"
                          onClick={() => setShowQuickCatForm((prev) => !prev)}
                          className="text-[11px] font-bold text-[#1B4D24] hover:underline cursor-pointer"
                        >
                          {showQuickCatForm ? 'বন্ধ করুন' : '+ নতুন ক্যাটাগরি'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const matchedCat = categories.find((c) => c.name === rCategory);
                          return (
                            <div className="w-9 h-9 rounded-xl bg-[#FDF5F3] border border-gray-200 flex items-center justify-center shrink-0">
                              <CategoryIcon
                                iconKey={matchedCat?.iconKey}
                                iconImageUrl={matchedCat?.iconImageUrl}
                                name={rCategory}
                                size="sm"
                              />
                            </div>
                          );
                        })()}
                        <select
                          value={rCategory}
                          onChange={(e) => setRCategory(e.target.value)}
                          className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-xl bg-white"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                          {rCategory && !categories.some((c) => c.name === rCategory) && (
                            <option value={rCategory}>{rCategory}</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>

                  {showQuickCatForm && (
                    <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#1B4D24]/25 space-y-3">
                      <p className="text-xs font-bold text-[#1B4D24]">
                        নতুন ক্যাটাগরি ও আইকন যোগ করুন
                      </p>
                      <input
                        type="text"
                        maxLength={40}
                        value={quickCatName}
                        onChange={(e) => setQuickCatName(e.target.value)}
                        placeholder="ক্যাটাগরির নাম (যেমন: সামুদ্রিক মাছ)"
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                      />
                      <div>
                        <p className="text-[11px] font-semibold text-gray-600 mb-1.5">
                          আইকন পছন্দ করুন:
                        </p>
                        <div className="grid grid-cols-7 gap-1.5">
                          {CATEGORY_ICON_PRESETS.map((preset) => (
                            <button
                              key={preset.key}
                              type="button"
                              onClick={() => {
                                setQuickCatIconKey(preset.key);
                                setQuickCatIconUrl('');
                              }}
                              title={preset.label}
                              className={`p-1.5 rounded-lg flex items-center justify-center border cursor-pointer transition-all ${
                                !quickCatIconUrl && quickCatIconKey === preset.key
                                  ? 'bg-[#FDF5F3] border-[#B92B27] ring-1 ring-[#B92B27]'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <PresetFoodSvg iconKey={preset.key} className="w-6 h-6" />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-white text-[11px] font-semibold text-[#1B4D24] cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {quickCatUploading
                              ? 'আপলোড হচ্ছে...'
                              : quickCatIconUrl
                                ? 'কাস্টম আইকন যুক্ত হয়েছে'
                                : 'অথবা ডিভাইস থেকে আইকন'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleCatCustomIconUpload(e, 'quick')}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={quickCatSaving}
                          onClick={handleSaveQuickCategory}
                          className="px-3.5 py-1.5 rounded-lg bg-[#1B4D24] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                        >
                          {quickCatSaving ? 'সংরক্ষণ হচ্ছে...' : 'যোগ করুন'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">সময়</label>
                      <input
                        type="text"
                        value={rCookTime}
                        onChange={(e) => setRCookTime(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">কঠিন্য</label>
                      <select
                        value={rDifficulty}
                        onChange={(e) => setRDifficulty(e.target.value as DifficultyLevel)}
                        className="w-full px-2 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                      >
                        <option value="সহজ">সহজ</option>
                        <option value="মাঝারি">মাঝারি</option>
                        <option value="কঠিন">কঠিন</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">পরিবেশন</label>
                      <input
                        type="text"
                        value={rServings}
                        onChange={(e) => setRServings(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rIsPremium}
                        onChange={(e) => setRIsPremium(e.target.checked)}
                        className="w-4 h-4 accent-[#B92B27]"
                      />
                      প্রিমিয়াম (সাবস্ক্রিপশন প্রয়োজন)
                    </label>

                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rIsFeatured}
                        onChange={(e) => setRIsFeatured(e.target.checked)}
                        className="w-4 h-4 accent-[#1B4D24]"
                      />
                      হিরো স্লাইডার (৫টি — নতুন যোগ হলে পুরানোটি অটো সরবে)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      উপকরণ (প্রতি লাইনে ১টি)
                    </label>
                    <textarea
                      rows={expandedEditor === 'recipe' ? 8 : 3}
                      required
                      value={rIngredientsText}
                      onChange={(e) => setRIngredientsText(e.target.value)}
                      placeholder="বাসমতি চাল — ৫০০ গ্রাম&#10;খাসির মাংস — ১ কেজি"
                      className={`w-full px-3 py-2 border border-gray-200 rounded-xl ${
                        expandedEditor === 'recipe' ? 'text-sm leading-relaxed' : 'text-xs'
                      }`}
                    />
                  </div>
                </div>

                <div
                  className={
                    expandedEditor === 'recipe'
                      ? 'lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4'
                      : 'space-y-3.5'
                  }
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                        প্রস্তুত প্রণালী (প্রতি ধাপে ছবিসহ)
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setRSteps((prev) => [...prev, { text: '', imageUrl: '' }])
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1B4D24] hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        ধাপ যোগ করুন
                      </button>
                    </div>

                    <div
                      className={
                        expandedEditor === 'recipe'
                          ? 'space-y-3.5'
                          : 'space-y-3 max-h-[380px] overflow-y-auto pr-1'
                      }
                    >
                      {rSteps.map((stepItem, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[#FAFAF8] border border-gray-200 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#1B4D24]">
                              ধাপ {toBengaliDigits(idx + 1)}
                            </span>
                            {rSteps.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRSteps((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-[11px] font-semibold text-red-600 hover:underline cursor-pointer"
                              >
                                মুছুন
                              </button>
                            )}
                          </div>

                          <textarea
                            rows={expandedEditor === 'recipe' ? 4 : 2}
                            required
                            value={stepItem.text}
                            onChange={(e) =>
                              setRSteps((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, text: e.target.value } : item
                                )
                              )
                            }
                            placeholder={`ধাপ ${toBengaliDigits(idx + 1)}-এর নির্দেশনা লিখুন...`}
                            className={`w-full px-3 py-2 border border-gray-200 rounded-lg bg-white ${
                              expandedEditor === 'recipe' ? 'text-sm leading-relaxed' : 'text-xs'
                            }`}
                          />

                          <div className="flex items-center gap-2.5">
                            {stepItem.imageUrl && (
                              <div className="relative shrink-0">
                                <img
                                  src={stepItem.imageUrl}
                                  alt={`ধাপ ${toBengaliDigits(idx + 1)}`}
                                  referrerPolicy="no-referrer"
                                  className={`rounded-lg object-cover border border-gray-200 ${
                                    expandedEditor === 'recipe' ? 'w-24 h-16' : 'w-14 h-12'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRSteps((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, imageUrl: '' } : item
                                      )
                                    )
                                  }
                                  aria-label="ধাপের ছবি সরান"
                                  className="mt-1 block w-full text-center text-[10px] font-semibold text-red-600 hover:underline cursor-pointer"
                                >
                                  সরান
                                </button>
                              </div>
                            )}

                            <label className="flex-1 py-2 px-3 rounded-lg border border-dashed border-gray-300 hover:border-[#1B4D24] bg-white text-[11px] font-semibold text-[#1B4D24] flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                              <ImagePlus className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {rStepUploadingIdx === idx
                                  ? 'আপলোড হচ্ছে...'
                                  : stepItem.imageUrl
                                    ? 'ডিভাইস থেকে ধাপের ছবি পরিবর্তন'
                                    : 'ডিভাইস থেকে ধাপের ছবি যোগ করুন'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleStepImageUpload(idx, e)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    {expandedEditor === 'recipe' && (
                      <button
                        type="button"
                        onClick={() =>
                          setRSteps((prev) => [...prev, { text: '', imageUrl: '' }])
                        }
                        className="w-full py-2 rounded-xl border border-dashed border-[#1B4D24]/40 hover:border-[#1B4D24] text-xs font-bold text-[#1B4D24] inline-flex items-center justify-center gap-1.5 cursor-pointer bg-[#FAFAF8]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        আরও একটি ধাপ যোগ করুন
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">শেফের টিপস</label>
                    <textarea
                      rows={expandedEditor === 'recipe' ? 3 : 2}
                      value={rChefTip}
                      onChange={(e) => setRChefTip(e.target.value)}
                      placeholder="বিশেষ কোনো রান্নার কৌশল..."
                      className={`w-full px-3 py-2 border border-gray-200 rounded-xl ${
                        expandedEditor === 'recipe' ? 'text-sm' : 'text-xs'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {editingRecipeId ? 'পরিবর্তন সংরক্ষণ করুন' : 'রেসিপি প্রকাশ করুন'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {recipes.map((r) => {
              const isOwnRecipe = r.createdByUid === currentUser.uid;
              const canEditRecipe = isFullAdmin || isOwnRecipe;
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={r.imageUrl}
                      alt={r.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-14 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-bold text-[#1A1A1A] truncate">{r.title}</h3>
                        {!isFullAdmin && isOwnRecipe && (
                          <span className="px-2 py-0.5 rounded-md bg-[#EEF6EF] text-[#1B4D24] text-[10px] font-bold shrink-0">
                            আপনার পোস্ট
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.category} · {r.isPremium ? 'প্রিমিয়াম' : 'বিনামূল্যে'} · {r.cookTime}
                        {r.isFeatured ? ' · স্লাইডার' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEditRecipe && (
                      <button
                        type="button"
                        onClick={() => startEditRecipe(r)}
                        aria-label="সম্পাদনা"
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {isFullAdmin && (
                      <button
                        type="button"
                        onClick={async () => {
                          await moveRecipeToRecycleBinAdmin(r, {
                            uid: currentUser.uid,
                            name: currentUser.displayName,
                          });
                          if (editingRecipeId === r.id) resetRecipeForm();
                          notify('রেসিপিটি রিসাইকেল বিনে (৩০ দিনের জন্য) সরানো হয়েছে।');
                        }}
                        aria-label="রিসাইকেল বিনে সরান"
                        title="রিসাইকেল বিনে সরান (৩০ দিন থাকবে)"
                        className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2B: CATEGORIES & ICONS MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveCategoryTab}
            className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4 h-fit"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1A1A1A]">
                {editingCatId ? 'ক্যাটাগরি সম্পাদনা করুন' : 'নতুন ক্যাটাগরি খুলুন'}
              </h2>
              {editingCatId && (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="text-xs font-semibold text-[#B92B27] hover:underline cursor-pointer"
                >
                  নতুন যোগে ফিরুন
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ক্যাটাগরির নাম
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="যেমন: ভাত ও পোলাও / সামুদ্রিক মাছ"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">ক্রম নম্বর</label>
                <input
                  type="number"
                  min={1}
                  value={catOrderIndex}
                  onChange={(e) => setCatOrderIndex(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catIsActive}
                    onChange={(e) => setCatIsActive(e.target.checked)}
                    className="w-4 h-4 accent-[#1B4D24]"
                  />
                  হোম ও মেনুতে দেখান
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                ক্যাটাগরি অনুযায়ী আইকন সেট করুন
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {CATEGORY_ICON_PRESETS.map((preset) => {
                  const selected = !catIconImageUrl && catIconKey === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setCatIconKey(preset.key);
                        setCatIconImageUrl('');
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        selected
                          ? 'bg-[#FDF5F3] border-[#B92B27] ring-1.5 ring-[#B92B27]/50'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <PresetFoodSvg iconKey={preset.key} className="w-8 h-8" />
                      <span className="text-[10px] font-semibold text-gray-700 truncate w-full text-center">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                অথবা ডিভাইস থেকে কাস্টম আইকন আপলোড করুন
              </label>
              <div className="flex items-center gap-3">
                {catIconImageUrl && (
                  <div className="relative shrink-0">
                    <img
                      src={catIconImageUrl}
                      alt="কাস্টম আইকন"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-contain border border-gray-200 bg-[#FDF5F3] p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setCatIconImageUrl('')}
                      className="mt-1 block w-full text-center text-[10px] font-semibold text-red-600 hover:underline cursor-pointer"
                    >
                      সরান
                    </button>
                  </div>
                )}
                <label className="flex-1 py-2.5 px-3 rounded-xl border-2 border-dashed border-[#1B4D24]/35 hover:border-[#1B4D24] bg-[#FAFAF8] text-xs font-bold text-[#1B4D24] flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>
                    {catIconUploading
                      ? 'আপলোড হচ্ছে...'
                      : catIconImageUrl
                        ? 'আইকন পরিবর্তন করুন'
                        : 'ডিভাইস থেকে আইকন আপলোড'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCatCustomIconUpload(e, 'tab')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Live Homepage Card Preview */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">
                হোম পেজে যেমন দেখাবে:
              </p>
              <div className="w-32 rounded-xl bg-[#FDF5F3] px-3 py-3.5 flex flex-col items-center justify-center gap-2 border border-gray-100">
                <CategoryIcon
                  iconKey={catIconKey}
                  iconImageUrl={catIconImageUrl}
                  name={catName || 'নতুন ক্যাটাগরি'}
                  size="lg"
                />
                <span className="text-xs font-semibold text-[#1A1A1A] text-center truncate w-full">
                  {catName || 'ক্যাটাগরির নাম'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={catSaving}
              className="w-full py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {catSaving
                ? 'সংরক্ষণ হচ্ছে...'
                : editingCatId
                  ? 'ক্যাটাগরি আপডেট করুন'
                  : 'নতুন ক্যাটাগরি সংরক্ষণ করুন'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-xl bg-[#FDF5F3] flex items-center justify-center shrink-0">
                    <CategoryIcon
                      iconKey={cat.iconKey}
                      iconImageUrl={cat.iconImageUrl}
                      name={cat.name}
                      size="md"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#1A1A1A] truncate">{cat.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ক্রম: {toBengaliDigits(cat.orderIndex)} ·{' '}
                      {cat.isActive !== false ? 'সক্রিয়' : 'লুকানো'} ·{' '}
                      {recipes.filter((r) => r.category === cat.name).length > 0
                        ? `${toBengaliDigits(recipes.filter((r) => r.category === cat.name).length)}টি রেসিপি`
                        : 'রেসিপি যোগ করা যাবে'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: 'category', categoryName: cat.name })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#1B4D24]/25 bg-[#F4F8F4] hover:bg-[#1B4D24] hover:text-white text-[#1B4D24] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>পেজ দেখুন</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(cat.id);
                      setCatName(cat.name);
                      setCatIconKey(cat.iconKey || 'rice');
                      setCatIconImageUrl(cat.iconImageUrl || '');
                      setCatOrderIndex(cat.orderIndex || 1);
                      setCatIsActive(cat.isActive !== false);
                    }}
                    aria-label="সম্পাদনা"
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {isFullAdmin && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteCategoryAdmin(cat.id);
                        if (editingCatId === cat.id) resetCategoryForm();
                        notify(`"${cat.name}" ক্যাটাগরি মুছে ফেলা হয়েছে।`);
                      }}
                      aria-label="মুছুন"
                      className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION PLANS */}
      {isFullAdmin && activeTab === 'plans' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PlanEditorCard key={plan.id} plan={plan} onSave={handleSavePlan} />
          ))}
        </div>
      )}

      {/* TAB 4: TIPS & BLOG */}
      {activeTab === 'content' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div
            className={
              expandedEditor === 'tip'
                ? 'fixed inset-0 z-[80] bg-[#FAF9F6] overflow-y-auto p-4 sm:p-8'
                : 'bg-white rounded-2xl border border-gray-200 p-5 space-y-4 h-fit'
            }
          >
            <div
              className={
                expandedEditor === 'tip'
                  ? 'max-w-5xl mx-auto bg-white rounded-2xl border border-gray-200 p-5 sm:p-8 space-y-5 shadow-sm'
                  : 'space-y-4'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A]">
                  রান্নার টিপস ম্যানেজমেন্ট
                </h2>
                <div className="flex items-center gap-2">
                  {editingTipId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTipId(null);
                        setTipTitle('');
                        setTipSummary('');
                        setTipContent('');
                      }}
                      className="text-xs font-semibold text-[#B92B27] hover:underline cursor-pointer"
                    >
                      নতুন যোগে ফিরুন
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedEditor((prev) => (prev === 'tip' ? null : 'tip'))
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      expandedEditor === 'tip'
                        ? 'bg-[#1B4D24] text-white border-[#1B4D24] hover:bg-[#143A1B]'
                        : 'bg-[#F8F8F5] text-[#1B4D24] border-[#1B4D24]/25 hover:bg-[#1B4D24]/10'
                    }`}
                  >
                    {expandedEditor === 'tip' ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>ছোট করুন</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>ফুল সাইজ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveTip} className="space-y-3.5">
                <div className={expandedEditor === 'tip' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={tipTitle}
                    onChange={(e) => setTipTitle(e.target.value)}
                    placeholder="টিপসের শিরোনাম"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                  />
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={tipCategory}
                    onChange={(e) => setTipCategory(e.target.value)}
                    placeholder="বিভাগ (যেমন: মাছ রান্না)"
                    className={`w-full px-3 py-2 border border-gray-200 rounded-xl ${
                      expandedEditor === 'tip' ? 'text-sm' : 'text-xs'
                    }`}
                  />
                </div>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={tipSummary}
                  onChange={(e) => setTipSummary(e.target.value)}
                  placeholder="সংক্ষিপ্ত সারসংক্ষেপ"
                  className={`w-full px-3 py-2 border border-gray-200 rounded-xl ${
                    expandedEditor === 'tip' ? 'text-sm' : 'text-xs'
                  }`}
                />
                <textarea
                  rows={expandedEditor === 'tip' ? 10 : 3}
                  required
                  maxLength={5000}
                  value={tipContent}
                  onChange={(e) => setTipContent(e.target.value)}
                  placeholder="বিস্তারিত টিপস..."
                  className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl ${
                    expandedEditor === 'tip' ? 'text-sm leading-relaxed' : 'text-xs'
                  }`}
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {editingTipId ? 'টিপস আপডেট করুন' : 'নতুন টিপস যোগ করুন'}
                </button>
              </form>

              <div className="pt-3 border-t border-gray-100 space-y-2.5">
                {tips.map((t) => {
                  const isOwnTip = t.createdByUid === currentUser.uid;
                  const canEditTip = isFullAdmin || isOwnTip;
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-2 text-sm py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{t.title}</span>
                        {!isFullAdmin && isOwnTip && (
                          <span className="px-1.5 py-0.5 rounded bg-[#EEF6EF] text-[#1B4D24] text-[10px] font-bold shrink-0">
                            আপনার পোস্ট
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canEditTip && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTipId(t.id);
                              setTipTitle(t.title);
                              setTipCategory(t.category);
                              setTipSummary(t.summary);
                              setTipContent(t.content);
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isFullAdmin && (
                          <button
                            type="button"
                            onClick={async () => {
                              await moveTipToRecycleBinAdmin(t, {
                                uid: currentUser.uid,
                                name: currentUser.displayName,
                              });
                              if (editingTipId === t.id) {
                                setEditingTipId(null);
                                setTipTitle('');
                                setTipSummary('');
                                setTipContent('');
                              }
                              notify('টিপসটি রিসাইকেল বিনে (৩০ দিনের জন্য) সরানো হয়েছে।');
                            }}
                            title="রিসাইকেল বিনে সরান (৩০ দিন থাকবে)"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className={
              expandedEditor === 'blog'
                ? 'fixed inset-0 z-[80] bg-[#FAF9F6] overflow-y-auto p-4 sm:p-8'
                : 'bg-white rounded-2xl border border-gray-200 p-5 space-y-4 h-fit'
            }
          >
            <div
              className={
                expandedEditor === 'blog'
                  ? 'max-w-5xl mx-auto bg-white rounded-2xl border border-gray-200 p-5 sm:p-8 space-y-5 shadow-sm'
                  : 'space-y-4'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A]">
                  ব্লগ পোস্ট ম্যানেজমেন্ট
                </h2>
                <div className="flex items-center gap-2">
                  {editingBlogId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBlogId(null);
                        setBlogTitle('');
                        setBlogCategory('খাদ্য ঐতিহ্য');
                        setBlogExcerpt('');
                        setBlogContent('');
                        setBlogImage('');
                      }}
                      className="text-xs font-semibold text-[#B92B27] hover:underline cursor-pointer"
                    >
                      নতুন যোগে ফিরুন
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedEditor((prev) => (prev === 'blog' ? null : 'blog'))
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      expandedEditor === 'blog'
                        ? 'bg-[#B92B27] text-white border-[#B92B27] hover:bg-[#9E221F]'
                        : 'bg-[#FDF5F3] text-[#B92B27] border-[#B92B27]/25 hover:bg-[#B92B27]/10'
                    }`}
                  >
                    {expandedEditor === 'blog' ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>ছোট করুন</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>ফুল সাইজ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveBlog} className="space-y-3.5">
                <div className={expandedEditor === 'blog' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={blogTitle}
                    onChange={(e) => setBlogTitle(e.target.value)}
                    placeholder="ব্লগের শিরোনাম"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                  />
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={blogCategory}
                    onChange={(e) => setBlogCategory(e.target.value)}
                    placeholder="বিভাগ (যেমন: খাদ্য ঐতিহ্য)"
                    className={`w-full px-3 py-2 border border-gray-200 rounded-xl ${
                      expandedEditor === 'blog' ? 'text-sm' : 'text-xs'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    ব্লগের ছবি (ডিভাইস থেকে আপলোড করুন)
                  </label>

                  {blogImage && (
                    <div className="relative mb-2 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={blogImage}
                        alt="ব্লগের ছবি প্রিভিউ"
                        referrerPolicy="no-referrer"
                        className={`w-full object-cover ${
                          expandedEditor === 'blog' ? 'h-56' : 'h-36'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setBlogImage('')}
                        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-semibold hover:bg-black cursor-pointer"
                      >
                        ছবি সরান
                      </button>
                    </div>
                  )}

                  <label className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-[#B92B27]/35 hover:border-[#B92B27] bg-[#FAFAF8] hover:bg-[#FDF5F3] text-xs font-bold text-[#B92B27] flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 shrink-0" />
                    <span>
                      {blogImageUploading
                        ? 'ছবি প্রস্তুত হচ্ছে...'
                        : blogImage
                          ? 'ডিভাইস থেকে নতুন ছবি পরিবর্তন করুন'
                          : 'ডিভাইস থেকে ছবি আপলোড করুন'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBlogImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <input
                  type="text"
                  required
                  maxLength={320}
                  value={blogExcerpt}
                  onChange={(e) => setBlogExcerpt(e.target.value)}
                  placeholder="সংক্ষিপ্ত অংশ"
                  className={`w-full px-3 py-2 border border-gray-200 rounded-xl ${
                    expandedEditor === 'blog' ? 'text-sm' : 'text-xs'
                  }`}
                />
                <textarea
                  rows={expandedEditor === 'blog' ? 12 : 4}
                  required
                  maxLength={8000}
                  value={blogContent}
                  onChange={(e) => setBlogContent(e.target.value)}
                  placeholder="ব্লগের সম্পূর্ণ লেখা..."
                  className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl ${
                    expandedEditor === 'blog' ? 'text-sm leading-relaxed' : 'text-xs'
                  }`}
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#B92B27] hover:bg-[#9E221F] text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {editingBlogId ? 'ব্লগ আপডেট করুন' : 'নতুন ব্লগ প্রকাশ করুন'}
                </button>
              </form>

              <div className="pt-3 border-t border-gray-100 space-y-2.5">
                {blogPosts.map((b) => {
                  const isOwnBlog = b.createdByUid === currentUser.uid;
                  const canEditBlog = isFullAdmin || isOwnBlog;
                  return (
                    <div key={b.id} className="flex items-center justify-between gap-2 text-sm py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{b.title}</span>
                        {!isFullAdmin && isOwnBlog && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FDF5F3] text-[#B92B27] text-[10px] font-bold shrink-0">
                            আপনার পোস্ট
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canEditBlog && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBlogId(b.id);
                              setBlogTitle(b.title);
                              setBlogCategory(b.category);
                              setBlogExcerpt(b.excerpt);
                              setBlogContent(b.content);
                              setBlogImage(b.imageUrl);
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isFullAdmin && (
                          <button
                            type="button"
                            onClick={async () => {
                              await moveBlogToRecycleBinAdmin(b, {
                                uid: currentUser.uid,
                                name: currentUser.displayName,
                              });
                              if (editingBlogId === b.id) {
                                setEditingBlogId(null);
                                setBlogTitle('');
                                setBlogCategory('খাদ্য ঐতিহ্য');
                                setBlogExcerpt('');
                                setBlogContent('');
                                setBlogImage('');
                              }
                              notify('ব্লগ পোস্টটি রিসাইকেল বিনে (৩০ দিনের জন্য) সরানো হয়েছে।');
                            }}
                            title="রিসাইকেল বিনে সরান (৩০ দিন থাকবে)"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MESSAGES */}
      {isFullAdmin && activeTab === 'messages' && (
        <div className="mt-6 space-y-6">
          {/* Direct User <-> Admin Chat Threads Inbox */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 bg-[#F4F9F5] border-b border-[#1B4D24]/15 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#1B4D24]" />
                <h2 className="text-base font-bold text-[#1A1A1A]">
                  সদস্যদের সরাসরি মেসেজ ({toBengaliDigits(sortedDirectThreads.length)})
                </h2>
                {unreadDirectMessagesTotal > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#B92B27] text-white text-[11px] font-bold font-numeral-bn tabular-nums">
                    {toBengaliDigits(unreadDirectMessagesTotal)} অপঠিত
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                ক্লিক করে সরাসরি উত্তর দিন ও সদস্যের প্রোফাইল দেখুন
              </span>
            </div>

            {sortedDirectThreads.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                এখনো কোনো সদস্যের সাথে সরাসরি মেসেজ আদান-প্রদান হয়নি। সদস্য তালিকা থেকে যেকোনো সদস্যের প্রোফাইলে ক্লিক করে মেসেজ পাঠাতে পারেন।
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedDirectThreads.map((t) => {
                  const matched = usersByUid.get(t.userId);
                  const online = isUserOnlineNow(matched, nowMs);
                  const unread = Number(t.unreadByAdmin) || 0;
                  const openThreadMember = () => {
                    const resolved: UserProfile = matched || {
                      uid: t.userId,
                      displayName: t.userName,
                      email: t.userContact || '',
                      photoURL: t.userPhotoURL,
                      role: 'member',
                      subscriptionPlan: 'basic',
                      subscriptionStatus: 'active',
                      favoriteRecipeIds: [],
                    };
                    setPreviewMemberUid(resolved.uid);
                    setPreviewFallbackMember(resolved);
                  };
                  return (
                    <div
                      key={t.userId}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        unread > 0 ? 'bg-[#F3F8F4]' : 'bg-white hover:bg-gray-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={openThreadMember}
                          className="relative shrink-0 cursor-pointer"
                        >
                          {matched?.photoURL || t.userPhotoURL ? (
                            <img
                              src={matched?.photoURL || t.userPhotoURL}
                              alt={t.userName}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] border border-[#1B4D24]/20 flex items-center justify-center font-bold text-sm">
                              {(t.userName || 'স').trim().charAt(0)}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                              online ? 'bg-emerald-500' : 'bg-gray-400'
                            }`}
                          />
                        </button>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-[#1A1A1A] truncate">
                              {matched?.displayName || t.userName}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                online
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {online ? 'অনলাইন' : 'অফলাইন'}
                            </span>
                            {unread > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#B92B27] text-white text-[10px] font-bold font-numeral-bn tabular-nums">
                                {toBengaliDigits(unread)} নতুন মেসেজ
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {t.userContact || (matched ? formatUserContact(matched.email, matched.phoneNumber) : '')}
                          </p>
                          <p className="text-xs text-gray-700 mt-1 line-clamp-1">
                            <span className="font-bold text-[#1B4D24]">
                              {t.lastSenderRole === 'admin' ? 'আপনি: ' : 'সদস্য: '}
                            </span>
                            {t.lastMessage}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={openThreadMember}
                        className="px-3.5 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        মেসেজ ও প্রোফাইল খুলুন
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Public Contact Form Messages */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 px-1">
              যোগাযোগ ফর্মের বার্তা ({toBengaliDigits(messagesList.length)})
            </h3>
            {messagesList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">
                কোনো যোগাযোগ বার্তা পাওয়া যায়নি।
              </div>
            ) : (
              messagesList.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-[#1A1A1A]">{m.name}</span>
                      <span className="text-gray-500">({m.email})</span>
                      <span className={m.status === 'unread' ? 'text-[#B92B27] font-bold' : 'text-gray-400'}>
                        · {m.status === 'unread' ? 'নতুন' : 'পঠিত'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#1A1A1A] mt-1">{m.subject}</p>
                    <p className="text-sm text-gray-600 mt-1">{m.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        markMessageStatusAdmin(m.id, m.status === 'unread' ? 'read' : 'unread')
                      }
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold cursor-pointer"
                    >
                      {m.status === 'unread' ? 'পঠিত চিহ্ন দিন' : 'অপঠিত করুন'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMessageAdmin(m.id)}
                      className="p-2 rounded-lg border border-red-200 text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: SITE-WIDE TABBED FONT & FONT SIZE SETTINGS */}
      {isFullAdmin && activeTab === 'fonts' && (
        <AdminFontSettingsTab
          values={fontDraft}
          savedValues={savedFontSettingsValues}
          onChange={handleFontFieldChange}
          onResetPage={handleResetFontPage}
          onSave={handleSaveFontSettings}
          saving={savingFonts}
          justSaved={fontsJustSaved}
          saveError={fontSaveError}
        />
      )}

      {/* TAB 7: SOCIAL MEDIA SHARE SETTINGS */}
      {isFullAdmin && activeTab === 'social' && (
        <AdminSocialShareTab
          siteName={sSiteName}
          seoTitle={sSeoTitle}
          seoDescription={sSeoDescription}
          canonicalBaseUrl={sCanonicalBaseUrl}
          socialShareImageUrl={sSocialImageUrl}
          onChangeSocialShareImageUrl={setSSocialImageUrl}
          socialShareTitle={sSocialTitle}
          onChangeSocialShareTitle={setSSocialTitle}
          socialShareDescription={sSocialDesc}
          onChangeSocialShareDescription={setSSocialDesc}
          socialShareImageAlt={sSocialImageAlt}
          onChangeSocialShareImageAlt={setSSocialImageAlt}
          twitterHandle={sTwitterHandle}
          onChangeTwitterHandle={setSTwitterHandle}
          fbAppId={sFbAppId}
          onChangeFbAppId={setSFbAppId}
          showRecipeShareButton={sShowRecipeShare}
          onToggleRecipeShareButton={handleToggleRecipeShareButton}
          togglingRecipeShare={togglingRecipeShare}
          uploading={socialImgUploading}
          onUploadImage={handleSocialImageUpload}
          onSave={handleSaveSocialSettings}
          saving={savingSocial}
          recipes={recipes}
          blogPosts={blogPosts}
          onNotify={notify}
        />
      )}

      {/* TAB 8: SEO & GOOGLE SEARCH CONSOLE SETTINGS */}
      {isFullAdmin && activeTab === 'seo' && (
        <AdminSeoSettingsTab
          siteName={sSiteName}
          seoTitle={sSeoTitle}
          onChangeSeoTitle={setSSeoTitle}
          seoDescription={sSeoDescription}
          onChangeSeoDescription={setSSeoDescription}
          seoKeywords={sSeoKeywords}
          onChangeSeoKeywords={setSSeoKeywords}
          seoAuthor={sSeoAuthor}
          onChangeSeoAuthor={setSSeoAuthor}
          canonicalBaseUrl={sCanonicalBaseUrl}
          onChangeCanonicalBaseUrl={setSCanonicalBaseUrl}
          seoRobotsPolicy={sSeoRobotsPolicy}
          onChangeSeoRobotsPolicy={setSSeoRobotsPolicy}
          googleSiteVerification={sGoogleVerification}
          onChangeGoogleSiteVerification={setSGoogleVerification}
          googleVerificationFile={sGoogleVerificationFile}
          onChangeGoogleVerificationFile={setSGoogleVerificationFile}
          bingSiteVerification={sBingVerification}
          onChangeBingSiteVerification={setSBingVerification}
          googleAnalyticsId={sGoogleAnalyticsId}
          onChangeGoogleAnalyticsId={setSGoogleAnalyticsId}
          robotsTxtExtra={sRobotsTxtExtra}
          onChangeRobotsTxtExtra={setSRobotsTxtExtra}
          socialShareImageUrl={sSocialImageUrl}
          onSave={handleSaveSeoSettings}
          saving={savingSeo}
          recipes={recipes}
          blogPosts={blogPosts}
          tips={tips}
          categories={categories}
          onNotify={notify}
        />
      )}

      {/* TAB 9: CONTENT BACKUP & RESTORE */}
      {isFullAdmin && activeTab === 'backup' && (
        <AdminBackupTab
          recipes={recipes}
          blogPosts={blogPosts}
          tips={tips}
          categories={categories}
          siteSettings={siteSettings}
          onNotify={notify}
        />
      )}

      {/* TAB 9B: 30-DAY RECYCLE BIN */}
      {isFullAdmin && activeTab === 'recycle-bin' && (
        <AdminRecycleBinTab
          items={recycleBinItems}
          onRestore={async (item) => {
            await restoreRecycleBinItemAdmin(item);
            notify(`"${item.title}" সফলভাবে পুনরুদ্ধার করা হয়েছে!`);
          }}
          onDeleteForever={async (item) => {
            await permanentlyDeleteRecycleBinItemAdmin(item.id);
            notify(`"${item.title}" চিরদিনের জন্য মুছে ফেলা হয়েছে।`);
          }}
          onEmptyBin={async (allItems) => {
            await purgeRecycleBinItemsAdmin(allItems.map((i) => i.id));
            notify('রিসাইকেল বিনের সব পোস্ট চিরদিনের জন্য মুছে ফেলা হয়েছে।');
          }}
        />
      )}

      {/* TAB 10: SITE & PAYMENT SETTINGS */}
      {isFullAdmin && activeTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="mt-6 max-w-2xl bg-white rounded-2xl border border-gray-200 p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-[#1A1A1A]">সাধারণ সাইট ও পেমেন্ট সেটিংস</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">ওয়েবসাইটের নাম</label>
            <input
              type="text"
              required
              value={sSiteName}
              onChange={(e) => setSSiteName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">ট্যাগলাইন</label>
            <input
              type="text"
              required
              value={sTagline}
              onChange={(e) => setSTagline(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>

          <div className="p-4 rounded-xl bg-[#F8F8F5] border border-gray-200 space-y-3">
            <p className="text-xs font-bold text-[#1B4D24]">ম্যানুয়াল পেমেন্ট নম্বর (বিকাশ / নগদ)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">বিকাশ নম্বর</label>
                <input
                  type="text"
                  value={sBkash}
                  onChange={(e) => setSBkash(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">নগদ নম্বর</label>
                <input
                  type="text"
                  value={sNagad}
                  onChange={(e) => setSNagad(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">পেমেন্ট নির্দেশনা</label>
              <textarea
                rows={2}
                value={sPayInst}
                onChange={(e) => setSPayInst(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2.5">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={sShowAnnounce}
                onChange={(e) => setSShowAnnounce(e.target.checked)}
                className="w-4 h-4 accent-[#1B4D24]"
              />
              উপরের ঘোষণা ব্যানার দেখান
            </label>
            <input
              type="text"
              value={sAnnounceText}
              onChange={(e) => setSAnnounceText(e.target.value)}
              placeholder="ঘোষণার লেখা..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">যোগাযোগ ইমেইল</label>
              <input
                type="email"
                required
                value={sEmail}
                onChange={(e) => setSEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">যোগাযোগ ফোন</label>
              <input
                type="text"
                required
                value={sPhone}
                onChange={(e) => setSPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">ঠিকানা</label>
            <input
              type="text"
              required
              value={sAddress}
              onChange={(e) => setSAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">ফুটার লেখা</label>
            <input
              type="text"
              value={sFooter}
              onChange={(e) => setSFooter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer"
          >
            সেটিংস সংরক্ষণ করুন
          </button>
        </form>
      )}

      {/* Rich Member Profile Preview, Login Device/Area, Address & Direct Messaging Modal */}
      {(() => {
        const activePreviewMember =
          (previewMemberUid ? usersByUid.get(previewMemberUid) : undefined) || previewFallbackMember;
        if (!activePreviewMember) return null;
        return (
          <AdminMemberPreviewModal
            member={activePreviewMember}
            adminUser={currentUser}
            nowMs={nowMs}
            onClose={() => {
              setPreviewMemberUid(null);
              setPreviewFallbackMember(null);
            }}
            onMessageSent={(memberName) =>
              notify(`${memberName}-কে মেসেজ ও নোটিফিকেশন পাঠানো হয়েছে।`)
            }
          />
        );
      })()}
    </section>
  );
};

const PlanEditorCard: React.FC<{
  plan: SubscriptionPlan;
  onSave: (plan: SubscriptionPlan, updates: Partial<SubscriptionPlan>) => Promise<void>;
}> = ({ plan, onSave }) => {
  const [name, setName] = useState(plan.name === 'Basic' ? 'বেসিক' : plan.name);
  const [priceLabel, setPriceLabel] = useState(plan.priceLabel);
  const [priceAmount, setPriceAmount] = useState(plan.priceAmount);
  const [durationLabel, setDurationLabel] = useState(plan.durationLabel);
  const [durationDays, setDurationDays] = useState(plan.durationDays || 30);
  const [recipeLimit, setRecipeLimit] = useState(
    plan.recipeLimit || (plan.tier === 'pro' ? 25 : 10)
  );
  const [featuresText, setFeaturesText] = useState(plan.features.join('\n'));
  const [isActive, setIsActive] = useState(plan.isActive);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <h3 className="font-bold text-[#1A1A1A]">{name} ({plan.tier})</h3>
      <div>
        <label className="block text-xs text-gray-600 mb-1">প্ল্যানের নাম</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">মূল্য (টাকা)</label>
          <input
            type="number"
            min={0}
            value={priceAmount}
            onChange={(e) => setPriceAmount(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">মূল্যের লেবেল</label>
          <input
            type="text"
            value={priceLabel}
            onChange={(e) => setPriceLabel(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">রেসিপি সীমা (টি)</label>
          <input
            type="number"
            min={1}
            value={recipeLimit}
            onChange={(e) => setRecipeLimit(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">মেয়াদ (দিন)</label>
          <input
            type="number"
            min={1}
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg tabular-nums"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">মেয়াদের লেখা</label>
        <input
          type="text"
          value={durationLabel}
          onChange={(e) => setDurationLabel(e.target.value)}
          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">সুবিধাসমূহ (প্রতি লাইনে ১টি)</label>
        <textarea
          rows={4}
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
        />
      </div>
      <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 accent-[#1B4D24]"
        />
        সক্রিয় রাখুন
      </label>
      <button
        type="button"
        onClick={() =>
          onSave(plan, {
            name,
            priceLabel,
            priceAmount,
            durationLabel,
            durationDays: Math.max(1, Math.round(durationDays) || 30),
            recipeLimit: Math.max(1, Math.round(recipeLimit) || 10),
            features: featuresText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
            isActive,
          })
        }
        className="w-full py-2 rounded-xl bg-[#1B4D24] text-white text-xs font-bold cursor-pointer"
      >
        সংরক্ষণ করুন
      </button>
    </div>
  );
};

const UserControlRow: React.FC<{
  user: UserProfile;
  plans: SubscriptionPlan[];
  recipes: Recipe[];
  currentAdminUid: string;
  allowDeleteAccount: boolean;
  nowMs: number;
  unreadMessagesCount: number;
  onUpdated: () => void;
  onDeleted: () => void;
  onDeleteError: (msg: string) => void;
  onPreviewMember: (member: UserProfile) => void;
}> = ({
  user,
  plans,
  recipes,
  currentAdminUid,
  allowDeleteAccount,
  nowMs,
  unreadMessagesCount,
  onUpdated,
  onDeleted,
  onDeleteError,
  onPreviewMember,
}) => {
  const [plan, setPlan] = useState<PlanTier>(user.subscriptionPlan);
  const [status, setStatus] = useState<'active' | 'expired' | 'delete'>(user.subscriptionStatus);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showQuotaDetails, setShowQuotaDetails] = useState(false);

  const online = isUserOnlineNow(user, nowMs);
  const presenceTooltip = formatRelativePresenceBn(user, nowMs);
  const isAdminAccount = user.role === 'admin';
  const isModAccount =
    user.role === 'moderator' || isBootstrappedModeratorEmail(user.email);
  const canDeleteThisUser =
    allowDeleteAccount && user.uid !== currentAdminUid && !isSuperAdminEmail(user.email);

  useEffect(() => {
    if (!canDeleteThisUser && status === 'delete') {
      setStatus(user.subscriptionStatus);
      setConfirmDelete(false);
    }
  }, [canDeleteThisUser, status, user.subscriptionStatus]);

  const paidActive = isPaidPlanActive(user);
  const freeUsed = Math.min(getUserFreeUnlockedIds(user, recipes).length, FREE_RECIPE_LIMIT);
  const freeRemaining = Math.max(0, FREE_RECIPE_LIMIT - freeUsed);
  const premiumUsed = getUserPremiumUnlockedIds(user, recipes).length;
  const premiumQuotaTotal = getUserPremiumQuota(user, plans, recipes);
  const premiumRemaining = Math.max(0, premiumQuotaTotal - premiumUsed);
  const primaryPercent = paidActive
    ? premiumQuotaTotal > 0
      ? Math.min(100, Math.round((premiumUsed / premiumQuotaTotal) * 100))
      : 0
    : Math.min(100, Math.round((freeUsed / FREE_RECIPE_LIMIT) * 100));

  const expMs = getSubscriptionExpiresMillis(user.subscriptionExpiresAt);
  const expText = expMs
    ? new Date(expMs).toLocaleDateString('bn-BD', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <tr className="align-top">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3 min-w-[230px]">
          <button
            type="button"
            onClick={() => onPreviewMember(user)}
            title="প্রোফাইল প্রিভিউ, ডিভাইস, এলাকা ও মেসেজ দেখুন"
            className="relative group/avatar shrink-0 cursor-pointer"
          >
            {user.photoURL ? (
              <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 group-hover/avatar:border-[#1B4D24] bg-[#1B4D24]/10 flex items-center justify-center transition-all">
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-3.5 h-3.5 text-white" />
                </span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 group-hover/avatar:border-[#1B4D24] bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center font-bold text-sm transition-all">
                <span>{(user.displayName || 'স').trim().charAt(0)}</span>
              </div>
            )}
            <span
              title={presenceTooltip}
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                online ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPreviewMember(user)}
                className="font-semibold text-[#1A1A1A] hover:text-[#1B4D24] hover:underline truncate max-w-[170px] cursor-pointer text-left"
              >
                {user.displayName}
              </button>
              <span
                title={presenceTooltip}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  online
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                {online ? 'অনলাইন' : 'অফলাইন'}
              </span>
              {isAdminAccount && (
                <span className="px-1.5 py-0.5 rounded bg-[#1B4D24]/10 text-[#1B4D24] text-[10px] font-bold">
                  এডমিন
                </span>
              )}
              {!isAdminAccount && isModAccount && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                  মোডারেটর
                </span>
              )}
              {unreadMessagesCount > 0 && (
                <button
                  type="button"
                  onClick={() => onPreviewMember(user)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#B92B27] text-white text-[10px] font-bold font-numeral-bn cursor-pointer hover:bg-[#991F1C]"
                >
                  <MessageCircle className="w-2.5 h-2.5" />
                  {toBengaliDigits(unreadMessagesCount)} মেসেজ
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate max-w-[220px]">
              {formatUserContact(user.email, user.phoneNumber)}
            </p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanTier)}
          className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
        >
          <option value="basic">বেসিক</option>
          <option value="standard">স্ট্যান্ডার্ড</option>
          <option value="pro">প্রো</option>
        </select>
      </td>
      <td className="py-3 px-4">
        <select
          value={status}
          onChange={(e) => {
            const nextVal = e.target.value as 'active' | 'expired' | 'delete';
            setStatus(nextVal);
            if (nextVal !== 'delete') {
              setConfirmDelete(false);
            }
          }}
          className={`px-2 py-1 text-xs border rounded-lg transition-colors ${
            status === 'delete'
              ? 'border-red-300 bg-red-50 text-red-700 font-bold'
              : 'border-gray-200 bg-white text-[#1A1A1A]'
          }`}
        >
          <option value="active">সক্রিয়</option>
          <option value="expired">মেয়াদোত্তীর্ণ</option>
          {canDeleteThisUser && (
            <option value="delete" className="text-red-700 font-bold">
              অ্যাকাউন্ট ডিলিট
            </option>
          )}
        </select>
      </td>
      <td className="py-3 px-4 min-w-[215px]">
        {isAdminAccount ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEF6EF] text-[#1B4D24] text-xs font-bold">
            সীমাহীন অ্যাক্সেস
          </span>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#1A1A1A] tabular-nums">
                {paidActive
                  ? `প্রিমিয়াম: ${toBengaliDigits(premiumUsed)}/${toBengaliDigits(premiumQuotaTotal)} টি`
                  : `ফ্রি: ${toBengaliDigits(freeUsed)}/${toBengaliDigits(FREE_RECIPE_LIMIT)} টি`}
              </span>
              <button
                type="button"
                onClick={() => setShowQuotaDetails((v) => !v)}
                className="text-[11px] font-bold text-[#1B4D24] hover:underline cursor-pointer shrink-0"
              >
                {showQuotaDetails ? 'সংক্ষিপ্ত' : 'বিস্তারিত'}
              </button>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  primaryPercent >= 100
                    ? 'bg-[#B92B27]'
                    : paidActive
                      ? 'bg-[#D4A017]'
                      : 'bg-[#1B4D24]'
                }`}
                style={{ width: `${primaryPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 tabular-nums">
              {paidActive
                ? `বাকি প্রিমিয়াম: ${toBengaliDigits(premiumRemaining)}টি · ফ্রি: ${toBengaliDigits(freeUsed)}/${toBengaliDigits(FREE_RECIPE_LIMIT)}টি`
                : `বাকি ফ্রি: ${toBengaliDigits(freeRemaining)}টি${premiumUsed > 0 ? ` · পূর্বের প্রিমিয়াম: ${toBengaliDigits(premiumUsed)}টি` : ''}`}
            </p>
            {showQuotaDetails && (
              <div className="mt-1.5 p-2.5 rounded-xl bg-[#FAFAF8] border border-gray-200 text-[11px] space-y-1 text-gray-700 tabular-nums">
                <p>
                  <span className="font-semibold text-[#1B4D24]">ফ্রি রেসিপি:</span>{' '}
                  দেখেছে {toBengaliDigits(freeUsed)}টি · বাকি {toBengaliDigits(freeRemaining)}টি (সর্বোচ্চ ১০টি)
                </p>
                <p>
                  <span className="font-semibold text-[#9A7209]">প্রিমিয়াম কোটা:</span>{' '}
                  দেখেছে {toBengaliDigits(premiumUsed)}টি · মোট কোটা {toBengaliDigits(premiumQuotaTotal)}টি · বাকি{' '}
                  {toBengaliDigits(premiumRemaining)}টি
                </p>
                {expText && (user.subscriptionPlan === 'standard' || user.subscriptionPlan === 'pro') && (
                  <p className="text-gray-500">মেয়াদ: {expText}</p>
                )}
              </div>
            )}
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        {status === 'delete' && canDeleteThisUser ? (
          confirmDelete ? (
            <div className="flex flex-col gap-1.5 min-w-[125px]">
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteUserAccountAdmin(user.uid, user.email);
                    onDeleted();
                  } catch {
                    onDeleteError('অ্যাকাউন্ট ডিলিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
                    setDeleting(false);
                    setConfirmDelete(false);
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#B92B27] hover:bg-[#991F1C] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                {deleting ? 'মুছছে...' : 'নিশ্চিত ডিলিট'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setConfirmDelete(false);
                  setStatus(user.subscriptionStatus);
                }}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg bg-[#B92B27] hover:bg-[#991F1C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              ডিলিট করুন
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={async () => {
              await updateUserByAdmin(
                user.uid,
                {
                  subscriptionPlan: plan,
                  subscriptionStatus: status === 'expired' ? 'expired' : 'active',
                  email: user.email,
                  currentAdminUid,
                },
                plans
              );
              onUpdated();
            }}
            className="px-3 py-1.5 rounded-lg bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold cursor-pointer"
          >
            আপডেট
          </button>
        )}
      </td>
    </tr>
  );
};
