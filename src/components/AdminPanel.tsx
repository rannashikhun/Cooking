import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Database,
  Edit3,
  ExternalLink,
  ImagePlus,
  LayoutGrid,
  Mail,
  Maximize2,
  Minimize2,
  Monitor,
  Plus,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  Type,
  Upload,
  Users,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { RECIPE_FONT_OPTIONS, SEED_RECIPES } from '../data/seedData';
import {
  approveSubscriptionOrderAdmin,
  deleteBlogAdmin,
  deleteCategoryAdmin,
  deleteMessageAdmin,
  deleteRecipeAdmin,
  deleteTipAdmin,
  fetchRecipeContent,
  formatUserContact,
  isSuperAdminEmail,
  markMessageStatusAdmin,
  rejectSubscriptionOrderAdmin,
  saveBlogAdmin,
  saveCategoryAdmin,
  savePlanAdmin,
  saveRecipeAdmin,
  saveSiteSettingsAdmin,
  saveTipAdmin,
  seedInitialDatabaseIfNeeded,
  updateUserByAdmin,
} from '../services/firestoreService';
import { CATEGORY_ICON_PRESETS, CategoryIcon, PresetFoodSvg } from './CategoryIcon';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import type {
  BlogPost,
  ContactMessage,
  CookingTip,
  DifficultyLevel,
  PageRoute,
  PlanAccent,
  PlanTier,
  Recipe,
  RecipeCategory,
  RecipeFontKey,
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
  onNavigate?: (route: PageRoute) => void;
}

type AdminTab = 'recipes' | 'categories' | 'plans' | 'content' | 'users' | 'messages' | 'fonts' | 'settings';
type MemberFilterView = 'all' | 'premium' | 'pending';

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

interface StepDraft {
  text: string;
  imageUrl: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  recipes,
  categories,
  plans,
  tips,
  blogPosts,
  siteSettings,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [memberFilterView, setMemberFilterView] = useState<MemberFilterView>('all');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [ordersList, setOrdersList] = useState<SubscriptionOrder[]>([]);
  const [messagesList, setMessagesList] = useState<ContactMessage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [syncingSeed, setSyncingSeed] = useState(false);
  const pendingSectionRef = useRef<HTMLDivElement>(null);
  const membersTableRef = useRef<HTMLDivElement>(null);

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
  const [sFontDesktop, setSFontDesktop] = useState<RecipeFontKey>(
    siteSettings.recipeFontDesktop || 'bensen'
  );
  const [sFontMobile, setSFontMobile] = useState<RecipeFontKey>(
    siteSettings.recipeFontMobile || 'bensen'
  );
  const [savingFonts, setSavingFonts] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
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
    setSFontDesktop(siteSettings.recipeFontDesktop || 'bensen');
    setSFontMobile(siteSettings.recipeFontMobile || 'bensen');
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
    if (currentUser.role !== 'admin' || !isVerifiedEmail) return;
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
    return () => {
      unsubUsers();
      unsubOrders();
      unsubMsgs();
    };
  }, [currentUser.role, isVerifiedEmail]);

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
        {toast && <p className="text-xs font-semibold text-[#1B4D24]">{toast}</p>}
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 bg-white rounded-3xl border border-red-200 text-center">
        <p className="text-lg font-bold text-red-700">এডমিন অনুমতি নেই</p>
        <p className="text-sm text-gray-600 mt-1">শুধুমাত্র অনুমোদিত এডমিন এই প্যানেল দেখতে পারবেন।</p>
      </div>
    );
  }

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
  const displayedMembers =
    memberFilterView === 'premium'
      ? premiumMembers
      : memberFilterView === 'pending'
        ? pendingPaymentMembers
        : usersList;

  const handleSelectKpiView = (view: MemberFilterView) => {
    setActiveTab('users');
    setMemberFilterView(view);
    setTimeout(() => {
      const target = view === 'pending' ? pendingSectionRef.current : membersTableRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const totalRevenueAmount = ordersList
    .filter((o) => o.status === 'active')
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const startEditRecipe = async (recipe: Recipe) => {
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
      notify('অনুগ্রহ করে ডিভাইস থেকে রেসিপির মূল ছবি আপলোড করুন।');
      return;
    }
    const isNew = !editingRecipeId;
    const id = editingRecipeId || `recipe_${Date.now()}`;
    const existing = recipes.find((r) => r.id === id);
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
      isNew
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
      notify(err instanceof Error ? err.message : 'ব্লগের ছবি আপলোড করা যায়নি।');
    } finally {
      setBlogImageUploading(false);
    }
  };

  const handleSaveTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = !editingTipId;
    const id = editingTipId || `tip_${Date.now()}`;
    await saveTipAdmin(
      {
        id,
        title: tipTitle.trim(),
        category: tipCategory.trim(),
        summary: tipSummary.trim(),
        content: tipContent.trim(),
        readTime: '৩ মিনিট পাঠ',
        isPublished: true,
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
      notify('অনুগ্রহ করে ডিভাইস থেকে ব্লগের ছবি আপলোড করুন।');
      return;
    }
    const isNew = !editingBlogId;
    const id = editingBlogId || `blog_${Date.now()}`;
    await saveBlogAdmin(
      {
        id,
        title: blogTitle.trim(),
        category: blogCategory.trim(),
        authorName: '',
        excerpt: blogExcerpt.trim(),
        content: blogContent.trim(),
        imageUrl: blogImage.trim(),
        readTime: '৫ মিনিট পাঠ',
        isPublished: true,
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSiteSettingsAdmin({
      siteName: sSiteName.trim(),
      tagline: sTagline.trim(),
      showAnnouncement: sShowAnnounce,
      announcementText: sAnnounceText.trim(),
      paymentBkashNumber: sBkash.trim(),
      paymentNagadNumber: sNagad.trim(),
      paymentInstructions: sPayInst.trim(),
      recipeFontDesktop: sFontDesktop,
      recipeFontMobile: sFontMobile,
      contactEmail: sEmail.trim(),
      contactPhone: sPhone.trim(),
      contactAddress: sAddress.trim(),
      footerNote: sFooter.trim(),
    });
    notify('সাইটের সেটিংস সফলভাবে আপডেট করা হয়েছে!');
  };

  const handleSaveFontSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFonts(true);
    try {
      await saveSiteSettingsAdmin({
        siteName: siteSettings.siteName,
        tagline: siteSettings.tagline,
        showAnnouncement: siteSettings.showAnnouncement,
        announcementText: siteSettings.announcementText || '',
        paymentBkashNumber: siteSettings.paymentBkashNumber || '',
        paymentNagadNumber: siteSettings.paymentNagadNumber || '',
        paymentInstructions: siteSettings.paymentInstructions || '',
        recipeFontDesktop: sFontDesktop,
        recipeFontMobile: sFontMobile,
        contactEmail: siteSettings.contactEmail,
        contactPhone: siteSettings.contactPhone,
        contactAddress: siteSettings.contactAddress,
        footerNote: siteSettings.footerNote || '',
      });
      notify('PC ও মোবাইল ভার্সনের রেসিপি ফন্ট সফলভাবে সংরক্ষণ করা হয়েছে!');
    } finally {
      setSavingFonts(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#1B4D24]">
            <ShieldCheck className="w-4 h-4" />
            এডমিন কন্ট্রোল সেন্টার
          </div>
          <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-1">
            সবকিছু নিয়ন্ত্রণ করুন
          </h1>
        </div>

        <button
          type="button"
          disabled={syncingSeed}
          onClick={async () => {
            setSyncingSeed(true);
            try {
              await seedInitialDatabaseIfNeeded(true);
              notify('প্রাথমিক ডেটা ডাটাবেসে সিঙ্ক করা হয়েছে!');
            } catch {
              notify('ডেটা সিঙ্ক করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
            } finally {
              setSyncingSeed(false);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-xs font-bold text-gray-700 cursor-pointer self-start"
        >
          <Database className="w-4 h-4 text-[#1B4D24]" />
          {syncingSeed ? 'সিঙ্ক হচ্ছে...' : 'ডিফল্ট ডেটা সিঙ্ক করুন'}
        </button>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-[95] max-w-md px-4 py-3 rounded-xl bg-[#1B4D24] text-white text-sm font-semibold flex items-center gap-2 shadow-xl">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Admin KPI Summary Metrics */}
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
          <p className="mt-1.5 text-[11px] font-semibold text-[#1B4D24]">
            সব সদস্য দেখুন →
          </p>
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
            অপেক্ষমাণ সদস্য দেখুন →
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

      {/* Admin Navigation Tabs */}
      <div className="mt-6 flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {[
          {
            id: 'users',
            label: `পেমেন্ট যাচাই ও সদস্য (${pendingOrders.length} অপেক্ষমাণ)`,
            icon: Users,
          },
          { id: 'recipes', label: `রেসিপি (${recipes.length})`, icon: UtensilsCrossed },
          { id: 'categories', label: `ক্যাটাগরি (${categories.length})`, icon: LayoutGrid },
          { id: 'plans', label: 'সাবস্ক্রিপশন প্ল্যান', icon: CreditCard },
          { id: 'content', label: 'টিপস ও ব্লগ', icon: BookOpen },
          { id: 'messages', label: `বার্তা (${messagesList.length})`, icon: Mail },
          { id: 'fonts', label: 'ফন্ট সেটিংস', icon: Type },
          { id: 'settings', label: 'সাইট ও পেমেন্ট সেটিংস', icon: Settings },
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
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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

      {/* TAB 1: PAYMENT VERIFICATION, ORDERS & USERS */}
      {activeTab === 'users' && (
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
            <div className="px-5 py-4 bg-[#FFFBEB] border-b border-[#D4A017]/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#B8860B]" />
                <h2 className="text-base font-bold text-[#1A1A1A]">
                  অপেক্ষমাণ ট্রানজেকশন আইডি যাচাই ({toBengaliDigits(pendingOrders.length)})
                </h2>
              </div>
            </div>

            {pendingOrders.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                কোনো অপেক্ষমাণ পেমেন্ট ভেরিফিকেশন অনুরোধ নেই।
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingOrders.map((o) => (
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
                        <span className="font-bold tabular-nums">{o.amount} টাকা</span>
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
                          await approveSubscriptionOrderAdmin(o);
                          notify(`${o.userName}-এর ${o.planName} প্ল্যান অনুমোদন ও সক্রিয় করা হয়েছে!`);
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
              <h2 className="text-base font-bold text-[#1A1A1A]">
                {memberFilterView === 'premium'
                  ? `প্রিমিয়াম মেম্বার তালিকা (${toBengaliDigits(displayedMembers.length)} জন)`
                  : memberFilterView === 'pending'
                    ? `অপেক্ষমাণ পেমেন্টের সদস্য (${toBengaliDigits(displayedMembers.length)} জন)`
                    : `সকল নিবন্ধিত সদস্য ও সাবস্ক্রিপশন নিয়ন্ত্রণ (${toBengaliDigits(displayedMembers.length)} জন)`}
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
                    onClick={() => setMemberFilterView(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
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

            {displayedMembers.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                {memberFilterView === 'premium'
                  ? 'এই মুহূর্তে কোনো সক্রিয় প্রিমিয়াম মেম্বার নেই।'
                  : memberFilterView === 'pending'
                    ? 'এই মুহূর্তে কোনো সদস্যের পেমেন্ট অপেক্ষমাণ নেই।'
                    : 'কোনো নিবন্ধিত সদস্য পাওয়া যায়নি।'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="py-3 px-4">নাম ও ইমেইল / ফোন</th>
                      <th className="py-3 px-4">প্ল্যান</th>
                      <th className="py-3 px-4">অবস্থা</th>
                      <th className="py-3 px-4">ভূমিকা</th>
                      <th className="py-3 px-4">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedMembers.map((u) => (
                      <UserControlRow
                        key={u.uid}
                        user={u}
                        currentAdminUid={currentUser.uid}
                        onUpdated={() => notify(`${u.displayName}-এর তথ্য আপডেট হয়েছে।`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* All Orders History */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-base font-bold text-[#1A1A1A] mb-3">সকল সাবস্ক্রিপশন অর্ডার ইতিহাস</h2>
            {ordersList.length === 0 ? (
              <p className="text-sm text-gray-500">এখনো কোনো সাবস্ক্রিপশন অর্ডার আসেনি।</p>
            ) : (
              <div className="divide-y divide-gray-100 text-sm">
                {ordersList.map((o) => (
                  <div key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {o.userName} ({formatUserContact(o.userEmail)})
                      </p>
                      <p className="text-xs text-gray-500">
                        প্ল্যান: {o.planName} · মাধ্যম: {o.paymentMethod} · নম্বর: {o.senderNumber || '-'} · TxID:{' '}
                        {o.transactionId || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#1B4D24] tabular-nums block">
                        {o.amount} টাকা
                      </span>
                      <span className="text-xs text-gray-500">
                        {o.status === 'active'
                          ? 'অনুমোদিত'
                          : o.status === 'pending'
                            ? 'অপেক্ষমাণ'
                            : 'বাতিল'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                      rows={expandedEditor === 'recipe' ? 3 : 1}
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
            {recipes.map((r) => (
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
                    <h3 className="text-sm font-bold text-[#1A1A1A] truncate">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.category} · {r.isPremium ? 'প্রিমিয়াম' : 'বিনামূল্যে'} · {r.cookTime}
                      {r.isFeatured ? ' · স্লাইডার' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditRecipe(r)}
                    aria-label="সম্পাদনা"
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteRecipeAdmin(r.id);
                      notify('রেসিপি মুছে ফেলা হয়েছে।');
                    }}
                    aria-label="মুছুন"
                    className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION PLANS */}
      {activeTab === 'plans' && (
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
                {tips.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm py-1.5">
                    <span className="font-medium truncate">{t.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
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
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteTipAdmin(t.id);
                          notify('টিপস মুছে ফেলা হয়েছে।');
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
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
                {blogPosts.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 text-sm py-1.5">
                    <span className="font-medium truncate">{b.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
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
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteBlogAdmin(b.id);
                          notify('ব্লগ পোস্ট মুছে ফেলা হয়েছে।');
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MESSAGES */}
      {activeTab === 'messages' && (
        <div className="mt-6 space-y-3">
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
      )}

      {/* TAB 6: RECIPE FONT SETTINGS (PC & MOBILE SEPARATELY) */}
      {activeTab === 'fonts' && (
        <form onSubmit={handleSaveFontSettings} className="mt-6 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1A1A1A]">
                রেসিপি পোস্টের ফন্ট সেটিংস (PC ও মোবাইল আলাদা)
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                রেসিপি পোস্টের শিরোনাম, নিচের বর্ণনা, উপকরণ এবং ধাপে ধাপে নির্দেশনার জন্য PC ও মোবাইল ভার্সনে আলাদা বাংলা ফন্ট বেছে নিন।
              </p>
            </div>
            <button
              type="submit"
              disabled={savingFonts}
              className="px-5 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs sm:text-sm font-bold cursor-pointer shrink-0 disabled:opacity-60"
            >
              {savingFonts ? 'সংরক্ষণ হচ্ছে...' : 'ফন্ট সেটিংস সংরক্ষণ করুন'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(
              [
                {
                  device: 'pc' as const,
                  title: 'PC / ল্যাপটপ ভার্সন ফন্ট',
                  subtitle: 'বড় স্ক্রিন (ডেস্কটপ ও ট্যাবলেট) রেসিপি পাতায় ব্যবহৃত হবে',
                  icon: Monitor,
                  value: sFontDesktop,
                  onChange: setSFontDesktop,
                },
                {
                  device: 'mobile' as const,
                  title: 'মোবাইল ভার্সন ফন্ট',
                  subtitle: 'স্মার্টফোন স্ক্রিনের রেসিপি পাতায় ব্যবহৃত হবে',
                  icon: Smartphone,
                  value: sFontMobile,
                  onChange: setSFontMobile,
                },
              ]
            ).map((panel) => {
              const DeviceIcon = panel.icon;
              const handwritingFonts = RECIPE_FONT_OPTIONS.filter(
                (f) => f.category === 'handwriting'
              );
              const bookFonts = RECIPE_FONT_OPTIONS.filter((f) => f.category === 'book');
              const selectedMeta =
                RECIPE_FONT_OPTIONS.find((f) => f.key === panel.value) ||
                RECIPE_FONT_OPTIONS[0];

              return (
                <div
                  key={panel.device}
                  className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-5"
                >
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center shrink-0">
                        <DeviceIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#1A1A1A]">
                          {panel.title}
                        </h3>
                        <p className="text-xs text-gray-500">{panel.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Live Diary Preview Card for Selected Font */}
                  <div
                    className={`rf-m-${panel.value} rounded-2xl bg-[#FCF9F2] border border-[#E4DCC8] p-4 sm:p-5 space-y-1.5`}
                  >
                    <p className="text-[11px] font-semibold text-[#7A6F60]">
                      নির্বাচিত প্রিভিউ: {selectedMeta.label}
                    </p>
                    <p className="font-recipe-diary-heading text-xl sm:text-2xl text-[#1F1A14] leading-snug">
                      শাহী কাচ্চি বিরিয়ানি
                    </p>
                    <p className="font-recipe-diary text-sm sm:text-base text-[#453C32] leading-relaxed">
                      খাসির মাংস ও সুগন্ধি বাসমতী চালের ঐতিহ্যবাহী ঘরোয়া রান্না।
                    </p>
                  </div>

                  {/* Group 1: Handwriting Fonts */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold text-[#B92B27] tracking-wide">
                      হাতের লেখার মতো ফন্ট
                    </p>
                    <div className="space-y-2">
                      {handwritingFonts.map((opt) => {
                        const isSelected = panel.value === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => panel.onChange(opt.key)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#1B4D24] bg-[#EEF5EF]/70 ring-2 ring-[#1B4D24]/15'
                                : 'border-gray-200 hover:border-[#1B4D24]/40 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[#1A1A1A]">
                                {opt.label}
                              </span>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? 'bg-[#1B4D24] text-white'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {isSelected ? 'নির্বাচিত' : 'বাছাই করুন'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                            <p
                              className={`rf-m-${opt.key} font-recipe-diary text-base text-[#241E17] mt-2 pt-2 border-t border-dashed border-gray-200`}
                            >
                              নমুনা: রান্নাঘরের ডায়েরীতে আজকের রেসিপি লিখছি।
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group 2: Normal Book Fonts */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold text-[#1B4D24] tracking-wide">
                      নরমাল বইয়ের লেখার মতো ফন্ট
                    </p>
                    <div className="space-y-2">
                      {bookFonts.map((opt) => {
                        const isSelected = panel.value === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => panel.onChange(opt.key)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#1B4D24] bg-[#EEF5EF]/70 ring-2 ring-[#1B4D24]/15'
                                : 'border-gray-200 hover:border-[#1B4D24]/40 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[#1A1A1A]">
                                {opt.label}
                              </span>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? 'bg-[#1B4D24] text-white'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {isSelected ? 'নির্বাচিত' : 'বাছাই করুন'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                            <p
                              className={`rf-m-${opt.key} font-recipe-diary text-base text-[#241E17] mt-2 pt-2 border-t border-dashed border-gray-200`}
                            >
                              নমুনা: রান্নাঘরের ডায়েরীতে আজকের রেসিপি লিখছি।
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingFonts}
              className="px-6 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {savingFonts ? 'সংরক্ষণ হচ্ছে...' : 'ফন্ট সেটিংস সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 7: SITE & PAYMENT SETTINGS */}
      {activeTab === 'settings' && (
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
  currentAdminUid: string;
  onUpdated: () => void;
}> = ({ user, currentAdminUid, onUpdated }) => {
  const [plan, setPlan] = useState<PlanTier>(user.subscriptionPlan);
  const [status, setStatus] = useState<'active' | 'expired'>(user.subscriptionStatus);
  const [role, setRole] = useState<'member' | 'admin'>(user.role);

  return (
    <tr>
      <td className="py-3 px-4">
        <p className="font-semibold text-[#1A1A1A]">{user.displayName}</p>
        <p className="text-xs text-gray-500">
          {formatUserContact(user.email, user.phoneNumber)}
        </p>
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
          onChange={(e) => setStatus(e.target.value as 'active' | 'expired')}
          className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
        >
          <option value="active">সক্রিয়</option>
          <option value="expired">মেয়াদোত্তীর্ণ</option>
        </select>
      </td>
      <td className="py-3 px-4">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
          className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
        >
          <option value="member">সদস্য</option>
          <option value="admin">এডমিন</option>
        </select>
      </td>
      <td className="py-3 px-4">
        <button
          type="button"
          onClick={async () => {
            await updateUserByAdmin(user.uid, {
              subscriptionPlan: plan,
              subscriptionStatus: status,
              role,
              email: user.email,
              currentAdminUid,
            });
            onUpdated();
          }}
          className="px-3 py-1.5 rounded-lg bg-[#1B4D24] text-white text-xs font-bold cursor-pointer"
        >
          আপডেট
        </button>
      </td>
    </tr>
  );
};
