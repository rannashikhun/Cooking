export type DietType = 'ভেজ' | 'নন-ভেজ';
export type DifficultyLevel = 'সহজ' | 'মাঝারি' | 'কঠিন';
export type PlanTier = 'basic' | 'standard' | 'pro';
export type PlanAccent = 'green' | 'gold' | 'red';
export type UserRole = 'member' | 'admin';
export type SubscriptionStatus = 'active' | 'expired';

export type PageRoute =
  | { page: 'home' }
  | { page: 'recipes' }
  | { page: 'category'; categoryName: string }
  | { page: 'recipe-detail'; id: string }
  | { page: 'tips' }
  | { page: 'tip-detail'; id: string }
  | { page: 'pricing' }
  | { page: 'checkout'; planId: string }
  | { page: 'blog' }
  | { page: 'blog-detail'; id: string }
  | { page: 'contact' }
  | { page: 'favorites' }
  | { page: 'login' }
  | { page: 'profile' }
  | { page: 'edit-profile' }
  | { page: 'admin' };

export type ActiveTab =
  | 'home'
  | 'recipes'
  | 'tips'
  | 'pricing'
  | 'blog'
  | 'contact'
  | 'favorites'
  | 'login'
  | 'profile'
  | 'admin';

export interface Recipe {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  cuisine: string;
  dietType: DietType;
  category: string;
  cookTime: string;
  prepTime?: string;
  difficulty: DifficultyLevel;
  servings?: string;
  rating: number;
  ratingCount: number;
  isPremium: boolean;
  isFeatured: boolean;
  orderIndex: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RecipeContent {
  ingredients: string[];
  steps: string[];
  stepImages?: string[];
  chefTip: string;
  updatedAt?: unknown;
}

export interface RecipeCategory {
  id: string;
  name: string;
  iconKey?: string;
  iconImageUrl?: string;
  orderIndex: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RecipeComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoUrl?: string;
  text: string;
  parentCommentId?: string;
  replyToUid?: string;
  replyToName?: string;
  createdAt?: unknown;
}

export interface RecipeHistoryEntry {
  recipeId: string;
  viewedAt: number;
}

export type NotificationType =
  | 'comment_reply'
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_pending'
  | 'free_limit_reached'
  | 'pro_limit_reached'
  | 'plan_expiry_reminder';

export interface UserNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipeId?: string;
  orderId?: string;
  senderUid?: string;
  senderName?: string;
  isRead: boolean;
  createdAt?: unknown;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: PlanTier;
  priceLabel: string;
  priceAmount: number;
  durationLabel: string;
  durationDays: number;
  recipeLimit?: number;
  subtitle?: string;
  features: string[];
  accentColor: PlanAccent;
  isActive: boolean;
  orderIndex: number;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  photoURL?: string;
  address?: string;
  age?: number;
  role: UserRole;
  subscriptionPlan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: unknown;
  lastOrderId?: string;
  favoriteRecipeIds: string[];
  unlockedRecipeIds?: string[];
  freeUnlockedRecipeIds?: string[];
  premiumUnlockedRecipeIds?: string[];
  premiumRecipeQuota?: number;
  viewedHistory?: RecipeHistoryEntry[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SubscriptionOrder {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  planTier: PlanTier;
  durationDays: number;
  recipeLimit?: number;
  amount: number;
  paymentMethod: 'বিকাশ' | 'নগদ' | 'রকেট' | 'ব্যাংক' | 'ফ্রি';
  senderNumber: string;
  transactionId: string;
  status: 'pending' | 'active' | 'rejected' | 'revoked';
  createdAt?: unknown;
}

export interface CookingTip {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  readTime: string;
  isPublished: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  authorName: string;
  category: string;
  readTime: string;
  isPublished: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type RecipeFontKey =
  | 'bensen'
  | 'atma'
  | 'tiro-italic'
  | 'noto-serif'
  | 'tiro'
  | 'hind-siliguri'
  | 'noto-sans';

export type FontSizeKey = 'sm' | 'md' | 'lg' | 'xl';

export interface SiteSettings {
  siteName: string;
  tagline: string;
  announcementText?: string;
  showAnnouncement: boolean;
  paymentBkashNumber?: string;
  paymentNagadNumber?: string;
  paymentInstructions?: string;
  recipeFontDesktop?: RecipeFontKey;
  recipeFontMobile?: RecipeFontKey;
  recipeFontSizeDesktop?: FontSizeKey;
  recipeFontSizeMobile?: FontSizeKey;
  adminFontFamily?: RecipeFontKey;
  adminFontSize?: FontSizeKey;
  profileFontFamily?: RecipeFontKey;
  profileFontSize?: FontSizeKey;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoAuthor?: string;
  canonicalBaseUrl?: string;
  seoRobotsPolicy?: 'index, follow' | 'noindex, nofollow';
  googleSiteVerification?: string;
  googleVerificationFile?: string;
  bingSiteVerification?: string;
  googleAnalyticsId?: string;
  robotsTxtExtra?: string;
  socialShareImageUrl?: string;
  socialShareTitle?: string;
  socialShareDescription?: string;
  socialShareImageAlt?: string;
  twitterHandle?: string;
  fbAppId?: string;
  showRecipeShareButton?: boolean;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerNote?: string;
  updatedAt?: unknown;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'unread' | 'read';
  createdAt?: unknown;
}
