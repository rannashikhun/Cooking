import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { SEED_RECIPES } from '../data/seedData';
import { resolvePublicAsset } from '../utils/appBase';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import type {
  BlogPost,
  CookingTip,
  DietType,
  DifficultyLevel,
  Recipe,
  RecipeCategory,
  RecipeContent,
} from '../types';

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP_SIGNATURE = 'ranna-shikhun-content-backup';

export interface BackupRecipeEntry {
  recipe: Omit<Recipe, 'createdAt' | 'updatedAt'>;
  content: Omit<RecipeContent, 'updatedAt'> & { videoDuration?: string };
}

export interface SiteContentBackupFile {
  signature: typeof BACKUP_APP_SIGNATURE;
  version: number;
  exportedAt: string;
  siteName?: string;
  includesEmbeddedImages: boolean;
  counts: {
    recipes: number;
    blogPosts: number;
    tips: number;
    categories: number;
    embeddedImages: number;
  };
  recipes: BackupRecipeEntry[];
  blogPosts: Array<Omit<BlogPost, 'createdAt' | 'updatedAt'>>;
  tips: Array<Omit<CookingTip, 'createdAt' | 'updatedAt'>>;
  categories: Array<Omit<RecipeCategory, 'createdAt' | 'updatedAt'>>;
}

export interface BackupExportOptions {
  includeRecipes: boolean;
  includeBlogs: boolean;
  includeTips: boolean;
  includeCategories: boolean;
  embedImages: boolean;
  siteName?: string;
}

export interface BackupExportProgress {
  stage: string;
  completed: number;
  total: number;
}

export type BackupRestoreMode = 'merge' | 'add-missing' | 'replace';

export interface BackupRestoreOptions {
  restoreRecipes: boolean;
  restoreBlogs: boolean;
  restoreTips: boolean;
  restoreCategories: boolean;
  mode: BackupRestoreMode;
}

export interface BackupRestoreProgress {
  stage: string;
  completed: number;
  total: number;
}

export interface BackupRestoreSectionStats {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  failed: number;
}

export interface BackupRestoreResult {
  recipes: BackupRestoreSectionStats;
  blogPosts: BackupRestoreSectionStats;
  tips: BackupRestoreSectionStats;
  categories: BackupRestoreSectionStats;
  errors: string[];
}

function emptyStats(): BackupRestoreSectionStats {
  return { created: 0, updated: 0, skipped: 0, deleted: 0, failed: 0 };
}

function isDataImageUrl(value?: string): boolean {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value.trim());
}

async function resolveImageForBackup(
  rawUrl: string | undefined,
  embedImages: boolean,
  compressOpts: { maxWidth: number; maxHeight: number; maxChars: number; quality: number }
): Promise<{ url: string; embedded: boolean }> {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return { url: '', embedded: false };
  if (isDataImageUrl(trimmed)) {
    return { url: trimmed, embedded: true };
  }
  if (!embedImages) {
    return { url: trimmed, embedded: false };
  }

  try {
    const fetchUrl =
      /^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:')
        ? trimmed
        : resolvePublicAsset(trimmed);
    const res = await fetch(fetchUrl, { mode: 'cors' });
    if (!res.ok) {
      return { url: trimmed, embedded: false };
    }
    const blob = await res.blob();
    if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) {
      return { url: trimmed, embedded: false };
    }
    const ext = blob.type?.split('/')[1] || 'jpg';
    const file = new File([blob], `backup-image.${ext}`, {
      type: blob.type || 'image/jpeg',
    });
    const dataUrl = await compressImageFileToDataUrl(file, compressOpts);
    return { url: dataUrl, embedded: true };
  } catch {
    // Keep original URL intact if cross-origin/offline fetch fails
    return { url: trimmed, embedded: false };
  }
}

async function fetchCollectionLive(colName: string) {
  const colRef = collection(db, colName);
  return getDocsFromServer(colRef).catch(() => getDocs(colRef));
}

export async function exportSiteContentBackup(
  options: BackupExportOptions,
  onProgress?: (progress: BackupExportProgress) => void
): Promise<SiteContentBackupFile> {
  onProgress?.({ stage: 'ডাটাবেস থেকে তথ্য সংগ্রহ করা হচ্ছে...', completed: 0, total: 1 });

  const [recipesSnap, blogsSnap, tipsSnap, categoriesSnap] = await Promise.all([
    options.includeRecipes ? fetchCollectionLive('recipes') : Promise.resolve(null),
    options.includeBlogs ? fetchCollectionLive('blogPosts') : Promise.resolve(null),
    options.includeTips ? fetchCollectionLive('tips') : Promise.resolve(null),
    options.includeCategories ? fetchCollectionLive('categories') : Promise.resolve(null),
  ]);

  const totalItems =
    (recipesSnap?.size || 0) +
    (blogsSnap?.size || 0) +
    (tipsSnap?.size || 0) +
    (categoriesSnap?.size || 0);

  let completed = 0;
  let embeddedImages = 0;

  const report = (stage: string) => {
    onProgress?.({ stage, completed, total: Math.max(1, totalItems) });
  };

  // 1. Recipes + Recipe Contents + Cover & Step Images
  const exportedRecipes: BackupRecipeEntry[] = [];
  if (recipesSnap) {
    for (const d of recipesSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      const recipeId = d.id;
      report(`রেসিপি ব্যাকআপ হচ্ছে: ${String(data.title || recipeId)}`);

      // Fetch full content document from subcollection
      const contentRef = doc(db, 'recipes', recipeId, 'content', 'detail');
      let contentData: Record<string, unknown> | null = null;
      try {
        const cSnap = await getDocFromServer(contentRef).catch(() => getDoc(contentRef));
        if (cSnap.exists()) {
          contentData = cSnap.data() as Record<string, unknown>;
        }
      } catch {
        // Fallback to seed content if available
      }
      if (!contentData) {
        const seedMatch = SEED_RECIPES.find((s) => s.recipe.id === recipeId);
        if (seedMatch) {
          contentData = {
            ingredients: seedMatch.content.ingredients,
            steps: seedMatch.content.steps,
            stepImages: seedMatch.content.stepImages || [],
            chefTip: seedMatch.content.chefTip,
          };
        }
      }

      const coverRes = await resolveImageForBackup(
        typeof data.imageUrl === 'string' ? data.imageUrl : '',
        options.embedImages,
        { maxWidth: 1080, maxHeight: 720, quality: 0.82, maxChars: 240000 }
      );
      if (coverRes.embedded) embeddedImages += 1;

      const rawStepImages = Array.isArray(contentData?.stepImages)
        ? (contentData?.stepImages as unknown[]).map((x) => (typeof x === 'string' ? x : ''))
        : [];
      const resolvedStepImages: string[] = [];
      for (const sImg of rawStepImages) {
        if (!sImg.trim()) {
          resolvedStepImages.push('');
          continue;
        }
        const sRes = await resolveImageForBackup(sImg, options.embedImages, {
          maxWidth: 840,
          maxHeight: 640,
          quality: 0.78,
          maxChars: 130000,
        });
        if (sRes.embedded) embeddedImages += 1;
        resolvedStepImages.push(sRes.url);
      }

      const recipeEntry: Omit<Recipe, 'createdAt' | 'updatedAt'> = {
        id: recipeId,
        title: String(data.title || ''),
        subtitle: String(data.subtitle || ''),
        imageUrl: coverRes.url,
        cuisine: String(data.cuisine || 'বাঙ্গালি'),
        dietType: data.dietType === 'ভেজ' ? 'ভেজ' : 'নন-ভেজ',
        category: String(data.category || 'ভাত ও পোলাও'),
        cookTime: String(data.cookTime || '৩০ মিনিট'),
        ...(typeof data.prepTime === 'string' && data.prepTime.trim()
          ? { prepTime: data.prepTime }
          : {}),
        difficulty:
          data.difficulty === 'মাঝারি' || data.difficulty === 'কঠিন' ? data.difficulty : 'সহজ',
        ...(typeof data.servings === 'string' && data.servings.trim()
          ? { servings: data.servings }
          : {}),
        rating: typeof data.rating === 'number' ? data.rating : 4.8,
        ratingCount: typeof data.ratingCount === 'number' ? Math.round(data.ratingCount) : 0,
        isPremium: Boolean(data.isPremium),
        isFeatured: Boolean(data.isFeatured),
        orderIndex: typeof data.orderIndex === 'number' ? Math.round(data.orderIndex) : 0,
      };

      const contentEntry: Omit<RecipeContent, 'updatedAt'> & { videoDuration?: string } = {
        ingredients: Array.isArray(contentData?.ingredients)
          ? (contentData.ingredients as unknown[]).filter((x): x is string => typeof x === 'string')
          : [],
        steps: Array.isArray(contentData?.steps)
          ? (contentData.steps as unknown[]).filter((x): x is string => typeof x === 'string')
          : [],
        ...(resolvedStepImages.some((s) => s.length > 0) ? { stepImages: resolvedStepImages } : {}),
        chefTip: typeof contentData?.chefTip === 'string' ? contentData.chefTip : '',
        ...(typeof contentData?.videoDuration === 'string' && contentData.videoDuration.trim()
          ? { videoDuration: contentData.videoDuration }
          : {}),
      };

      exportedRecipes.push({ recipe: recipeEntry, content: contentEntry });
      completed += 1;
      report(`রেসিপি সম্পন্ন (${completed}/${Math.max(1, totalItems)})`);
    }
  }

  // 2. Blog Posts + Cover Images
  const exportedBlogs: Array<Omit<BlogPost, 'createdAt' | 'updatedAt'>> = [];
  if (blogsSnap) {
    for (const d of blogsSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      report(`ব্লগ ব্যাকআপ হচ্ছে: ${String(data.title || d.id)}`);
      const imgRes = await resolveImageForBackup(
        typeof data.imageUrl === 'string' ? data.imageUrl : '',
        options.embedImages,
        { maxWidth: 1080, maxHeight: 720, quality: 0.82, maxChars: 240000 }
      );
      if (imgRes.embedded) embeddedImages += 1;

      exportedBlogs.push({
        id: d.id,
        title: String(data.title || ''),
        excerpt: String(data.excerpt || ''),
        content: String(data.content || ''),
        imageUrl: imgRes.url,
        authorName: String(data.authorName || 'রান্না শিখুন টিম'),
        category: String(data.category || 'খাদ্য ঐতিহ্য'),
        readTime: String(data.readTime || '৪ মিনিট'),
        isPublished: data.isPublished !== false,
      });
      completed += 1;
      report(`ব্লগ সম্পন্ন (${completed}/${Math.max(1, totalItems)})`);
    }
  }

  // 3. Cooking Tips
  const exportedTips: Array<Omit<CookingTip, 'createdAt' | 'updatedAt'>> = [];
  if (tipsSnap) {
    for (const d of tipsSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      report(`টিপস ব্যাকআপ হচ্ছে: ${String(data.title || d.id)}`);
      exportedTips.push({
        id: d.id,
        title: String(data.title || ''),
        category: String(data.category || 'মশলা ও কৌশল'),
        summary: String(data.summary || ''),
        content: String(data.content || ''),
        readTime: String(data.readTime || '৩ মিনিট'),
        isPublished: data.isPublished !== false,
      });
      completed += 1;
      report(`টিপস সম্পন্ন (${completed}/${Math.max(1, totalItems)})`);
    }
  }

  // 4. Categories + Category Icon Images
  const exportedCategories: Array<Omit<RecipeCategory, 'createdAt' | 'updatedAt'>> = [];
  if (categoriesSnap) {
    for (const d of categoriesSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      report(`ক্যাটাগরি ব্যাকআপ হচ্ছে: ${String(data.name || d.id)}`);
      const iconRes = await resolveImageForBackup(
        typeof data.iconImageUrl === 'string' ? data.iconImageUrl : '',
        options.embedImages,
        { maxWidth: 256, maxHeight: 256, quality: 0.82, maxChars: 110000 }
      );
      if (iconRes.embedded) embeddedImages += 1;

      exportedCategories.push({
        id: d.id,
        name: String(data.name || ''),
        ...(typeof data.iconKey === 'string' ? { iconKey: data.iconKey } : {}),
        ...(iconRes.url ? { iconImageUrl: iconRes.url } : {}),
        orderIndex: typeof data.orderIndex === 'number' ? Math.round(data.orderIndex) : 0,
        isActive: data.isActive !== false,
      });
      completed += 1;
      report(`ক্যাটাগরি সম্পন্ন (${completed}/${Math.max(1, totalItems)})`);
    }
  }

  return {
    signature: BACKUP_APP_SIGNATURE,
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    siteName: options.siteName || 'রান্না শিখুন',
    includesEmbeddedImages: options.embedImages,
    counts: {
      recipes: exportedRecipes.length,
      blogPosts: exportedBlogs.length,
      tips: exportedTips.length,
      categories: exportedCategories.length,
      embeddedImages,
    },
    recipes: exportedRecipes,
    blogPosts: exportedBlogs,
    tips: exportedTips,
    categories: exportedCategories,
  };
}

export function downloadBackupJsonFile(backup: SiteContentBackupFile): {
  filename: string;
  sizeBytes: number;
} {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const filename = `ranna-shikhun-backup-${stamp}.json`;

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { filename, sizeBytes: blob.size };
}

export interface ParsedBackupPreview {
  backup: SiteContentBackupFile;
  fileName: string;
  fileSizeBytes: number;
  embeddedImageCount: number;
}

export async function parseBackupJsonFile(file: File): Promise<ParsedBackupPreview> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('ব্যাকআপ ফাইলটি সঠিক JSON ফরম্যাটে নেই। অনুগ্রহ করে সঠিক ব্যাকআপ ফাইল নির্বাচন করুন।');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ফাইলটির গঠন সঠিক নয়।');
  }

  const obj = parsed as Record<string, unknown>;
  const hasKnownSignature = obj.signature === BACKUP_APP_SIGNATURE;
  const hasAnySection =
    Array.isArray(obj.recipes) ||
    Array.isArray(obj.blogPosts) ||
    Array.isArray(obj.tips) ||
    Array.isArray(obj.categories);

  if (!hasKnownSignature && !hasAnySection) {
    throw new Error('এই ফাইলটি রান্না শিখুন সাইটের বৈধ ব্যাকআপ ফাইল নয়।');
  }

  const rawRecipes = Array.isArray(obj.recipes) ? obj.recipes : [];
  const normalizedRecipes: BackupRecipeEntry[] = rawRecipes
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => {
      if (entry.recipe && typeof entry.recipe === 'object') {
        return {
          recipe: entry.recipe as Omit<Recipe, 'createdAt' | 'updatedAt'>,
          content: (entry.content && typeof entry.content === 'object'
            ? entry.content
            : { ingredients: [], steps: [], chefTip: '' }) as Omit<RecipeContent, 'updatedAt'> & {
            videoDuration?: string;
          },
        };
      }
      // Also gracefully accept flat recipe objects if exported by another version
      return {
        recipe: entry as unknown as Omit<Recipe, 'createdAt' | 'updatedAt'>,
        content: {
          ingredients: Array.isArray(entry.ingredients)
            ? (entry.ingredients as string[])
            : [],
          steps: Array.isArray(entry.steps) ? (entry.steps as string[]) : [],
          stepImages: Array.isArray(entry.stepImages) ? (entry.stepImages as string[]) : undefined,
          chefTip: typeof entry.chefTip === 'string' ? entry.chefTip : '',
        },
      };
    });

  const normalizedBlogs = (Array.isArray(obj.blogPosts) ? obj.blogPosts : []).filter(
    (x): x is Omit<BlogPost, 'createdAt' | 'updatedAt'> => Boolean(x && typeof x === 'object')
  );
  const normalizedTips = (Array.isArray(obj.tips) ? obj.tips : []).filter(
    (x): x is Omit<CookingTip, 'createdAt' | 'updatedAt'> => Boolean(x && typeof x === 'object')
  );
  const normalizedCategories = (Array.isArray(obj.categories) ? obj.categories : []).filter(
    (x): x is Omit<RecipeCategory, 'createdAt' | 'updatedAt'> => Boolean(x && typeof x === 'object')
  );

  if (
    normalizedRecipes.length === 0 &&
    normalizedBlogs.length === 0 &&
    normalizedTips.length === 0 &&
    normalizedCategories.length === 0
  ) {
    throw new Error('এই ব্যাকআপ ফাইলে কোনো রেসিপি, ব্লগ, টিপস বা ক্যাটাগরি পাওয়া যায়নি।');
  }

  let embeddedImageCount = 0;
  for (const r of normalizedRecipes) {
    if (isDataImageUrl(r.recipe.imageUrl)) embeddedImageCount += 1;
    if (Array.isArray(r.content.stepImages)) {
      for (const sImg of r.content.stepImages) {
        if (isDataImageUrl(sImg)) embeddedImageCount += 1;
      }
    }
  }
  for (const b of normalizedBlogs) {
    if (isDataImageUrl(b.imageUrl)) embeddedImageCount += 1;
  }
  for (const c of normalizedCategories) {
    if (isDataImageUrl(c.iconImageUrl)) embeddedImageCount += 1;
  }

  const backup: SiteContentBackupFile = {
    signature: BACKUP_APP_SIGNATURE,
    version: typeof obj.version === 'number' ? obj.version : BACKUP_SCHEMA_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    siteName: typeof obj.siteName === 'string' ? obj.siteName : 'রান্না শিখুন',
    includesEmbeddedImages: Boolean(obj.includesEmbeddedImages) || embeddedImageCount > 0,
    counts: {
      recipes: normalizedRecipes.length,
      blogPosts: normalizedBlogs.length,
      tips: normalizedTips.length,
      categories: normalizedCategories.length,
      embeddedImages: embeddedImageCount,
    },
    recipes: normalizedRecipes,
    blogPosts: normalizedBlogs,
    tips: normalizedTips,
    categories: normalizedCategories,
  };

  return {
    backup,
    fileName: file.name,
    fileSizeBytes: file.size,
    embeddedImageCount,
  };
}

function sanitizeDocId(rawId: unknown, prefix: string, index: number): string {
  const cleaned =
    typeof rawId === 'string'
      ? rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128)
      : '';
  if (cleaned.length >= 1 && /^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}_${index}`;
}

function sanitizeTitle(raw: unknown, fallback: string, maxLen: number): string {
  const s = String(raw ?? '').trim().slice(0, maxLen);
  return s.length >= 2 ? s : fallback;
}

function sanitizeRecipePayload(raw: Omit<Recipe, 'createdAt' | 'updatedAt'>, fallbackIndex: number) {
  const dietType: DietType = raw.dietType === 'ভেজ' ? 'ভেজ' : 'নন-ভেজ';
  const difficulty: DifficultyLevel =
    raw.difficulty === 'মাঝারি' || raw.difficulty === 'কঠিন' ? raw.difficulty : 'সহজ';
  const rawImg = String(raw.imageUrl || '').trim();
  const safeImg =
    rawImg.length >= 1 && rawImg.length <= 350000 ? rawImg : '/assets/og-cover.jpg';
  const ratingNum = Number(raw.rating);
  const safeRating = Number.isFinite(ratingNum)
    ? Math.min(5, Math.max(0, Math.round(ratingNum * 10) / 10))
    : 4.8;
  const ratingCountNum = Number(raw.ratingCount);
  const safeRatingCount = Number.isFinite(ratingCountNum)
    ? Math.max(0, Math.round(ratingCountNum))
    : 0;
  const orderNum = Number(raw.orderIndex);
  const safeOrderIndex = Number.isFinite(orderNum)
    ? Math.max(0, Math.round(orderNum))
    : fallbackIndex + 1;

  const payload: Record<string, unknown> = {
    title: sanitizeTitle(raw.title, 'শিরোনামহীন রেসিপি', 140),
    subtitle: String(raw.subtitle || '').trim().slice(0, 260),
    imageUrl: safeImg,
    cuisine: String(raw.cuisine || 'বাঙ্গালি').trim().slice(0, 40) || 'বাঙ্গালি',
    dietType,
    category: String(raw.category || 'ভাত ও পোলাও').trim().slice(0, 40) || 'ভাত ও পোলাও',
    cookTime: String(raw.cookTime || '৩০ মিনিট').trim().slice(0, 40) || '৩০ মিনিট',
    difficulty,
    rating: safeRating,
    ratingCount: safeRatingCount,
    isPremium: Boolean(raw.isPremium),
    isFeatured: Boolean(raw.isFeatured),
    orderIndex: safeOrderIndex,
  };

  if (typeof raw.prepTime === 'string' && raw.prepTime.trim()) {
    payload.prepTime = raw.prepTime.trim().slice(0, 40);
  }
  if (typeof raw.servings === 'string' && raw.servings.trim()) {
    payload.servings = raw.servings.trim().slice(0, 30);
  }

  return payload;
}

function sanitizeRecipeContentPayload(
  raw: Omit<RecipeContent, 'updatedAt'> & { videoDuration?: string }
) {
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, 40);

  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.replace(/\r\n/g, '\n').trim())
    .filter((x) => x.length > 0)
    .slice(0, 40);

  const chefTip = String(raw.chefTip || '').replace(/\r\n/g, '\n').trim().slice(0, 1200);

  // Guard total document size strictly below Firestore's 1MB document limit
  const baseTextBytes = JSON.stringify({ ingredients, steps, chefTip }).length;
  let remainingBudget = Math.max(0, 900000 - baseTextBytes);

  const rawStepImages = Array.isArray(raw.stepImages) ? raw.stepImages : [];
  const stepImages = rawStepImages.slice(0, 40).map((img) => {
    const clean = typeof img === 'string' ? img.trim() : '';
    if (!clean) return '';
    if (clean.length <= remainingBudget) {
      remainingBudget -= clean.length;
      return clean;
    }
    return '';
  });

  const payload: Record<string, unknown> = {
    ingredients,
    steps,
    chefTip,
  };

  if (stepImages.some((s) => s.length > 0)) {
    payload.stepImages = stepImages;
  }
  if (typeof raw.videoDuration === 'string' && raw.videoDuration.trim()) {
    payload.videoDuration = raw.videoDuration.trim().slice(0, 40);
  }

  return payload;
}

function sanitizeBlogPayload(raw: Omit<BlogPost, 'createdAt' | 'updatedAt'>) {
  const rawImg = String(raw.imageUrl || '').trim();
  return {
    title: sanitizeTitle(raw.title, 'শিরোনামহীন ব্লগ', 160),
    excerpt: String(raw.excerpt || '').trim().slice(0, 320),
    content: String(raw.content || '').replace(/\r\n/g, '\n').trim().slice(0, 8000),
    imageUrl: rawImg.length <= 350000 ? rawImg : '',
    authorName: String(raw.authorName || 'রান্না শিখুন টিম').trim().slice(0, 80) || 'রান্না শিখুন টিম',
    category: String(raw.category || 'খাদ্য ঐতিহ্য').trim().slice(0, 50) || 'খাদ্য ঐতিহ্য',
    readTime: String(raw.readTime || '৪ মিনিট').trim().slice(0, 30) || '৪ মিনিট',
    isPublished: raw.isPublished !== false,
  };
}

function sanitizeTipPayload(raw: Omit<CookingTip, 'createdAt' | 'updatedAt'>) {
  return {
    title: sanitizeTitle(raw.title, 'শিরোনামহীন টিপস', 140),
    category: String(raw.category || 'মশলা ও কৌশল').trim().slice(0, 50) || 'মশলা ও কৌশল',
    summary: String(raw.summary || '').trim().slice(0, 300),
    content: String(raw.content || '').replace(/\r\n/g, '\n').trim().slice(0, 5000),
    readTime: String(raw.readTime || '৩ মিনিট').trim().slice(0, 30) || '৩ মিনিট',
    isPublished: raw.isPublished !== false,
  };
}

function sanitizeCategoryPayload(
  raw: Omit<RecipeCategory, 'createdAt' | 'updatedAt'>,
  fallbackIndex: number
) {
  const name = String(raw.name || '').trim().slice(0, 40) || `ক্যাটাগরি ${fallbackIndex + 1}`;
  const orderNum = Number(raw.orderIndex);
  const payload: Record<string, unknown> = {
    name,
    orderIndex: Number.isFinite(orderNum) ? Math.max(0, Math.round(orderNum)) : fallbackIndex + 1,
    isActive: raw.isActive !== false,
  };
  if (typeof raw.iconKey === 'string' && raw.iconKey.trim()) {
    payload.iconKey = raw.iconKey.trim().slice(0, 40);
  }
  if (typeof raw.iconImageUrl === 'string' && raw.iconImageUrl.trim().length <= 160000) {
    payload.iconImageUrl = raw.iconImageUrl.trim();
  }
  return payload;
}

export async function restoreSiteContentBackup(
  backup: SiteContentBackupFile,
  options: BackupRestoreOptions,
  onProgress?: (progress: BackupRestoreProgress) => void
): Promise<BackupRestoreResult> {
  const result: BackupRestoreResult = {
    recipes: emptyStats(),
    blogPosts: emptyStats(),
    tips: emptyStats(),
    categories: emptyStats(),
    errors: [],
  };

  const recipesToProcess = options.restoreRecipes ? backup.recipes : [];
  const blogsToProcess = options.restoreBlogs ? backup.blogPosts : [];
  const tipsToProcess = options.restoreTips ? backup.tips : [];
  const categoriesToProcess = options.restoreCategories ? backup.categories : [];

  const totalWork =
    recipesToProcess.length +
    blogsToProcess.length +
    tipsToProcess.length +
    categoriesToProcess.length;

  let completed = 0;
  const report = (stage: string) => {
    onProgress?.({ stage, completed, total: Math.max(1, totalWork) });
  };

  // Optional Replace Mode: remove existing items in selected collections that have backup items
  if (options.mode === 'replace') {
    if (recipesToProcess.length > 0) {
      report('পুরানো রেসিপি পরিষ্কার করা হচ্ছে...');
      const existingSnap = await fetchCollectionLive('recipes');
      for (const d of existingSnap.docs) {
        try {
          const b = writeBatch(db);
          b.delete(doc(db, 'recipes', d.id, 'content', 'detail'));
          b.delete(doc(db, 'recipes', d.id));
          await b.commit();
          result.recipes.deleted += 1;
        } catch (err) {
          result.errors.push(
            `পুরানো রেসিপি (${d.id}) মুছতে ব্যর্থ: ${err instanceof Error ? err.message : 'ত্রুটি'}`
          );
        }
      }
    }
    if (blogsToProcess.length > 0) {
      report('পুরানো ব্লগ পরিষ্কার করা হচ্ছে...');
      const existingSnap = await fetchCollectionLive('blogPosts');
      for (const d of existingSnap.docs) {
        try {
          await deleteDoc(doc(db, 'blogPosts', d.id));
          result.blogPosts.deleted += 1;
        } catch (err) {
          result.errors.push(
            `পুরানো ব্লগ (${d.id}) মুছতে ব্যর্থ: ${err instanceof Error ? err.message : 'ত্রুটি'}`
          );
        }
      }
    }
    if (tipsToProcess.length > 0) {
      report('পুরানো টিপস পরিষ্কার করা হচ্ছে...');
      const existingSnap = await fetchCollectionLive('tips');
      for (const d of existingSnap.docs) {
        try {
          await deleteDoc(doc(db, 'tips', d.id));
          result.tips.deleted += 1;
        } catch (err) {
          result.errors.push(
            `পুরানো টিপস (${d.id}) মুছতে ব্যর্থ: ${err instanceof Error ? err.message : 'ত্রুটি'}`
          );
        }
      }
    }
    if (categoriesToProcess.length > 0) {
      report('পুরানো ক্যাটাগরি পরিষ্কার করা হচ্ছে...');
      const existingSnap = await fetchCollectionLive('categories');
      for (const d of existingSnap.docs) {
        try {
          await deleteDoc(doc(db, 'categories', d.id));
          result.categories.deleted += 1;
        } catch (err) {
          result.errors.push(
            `পুরানো ক্যাটাগরি (${d.id}) মুছতে ব্যর্থ: ${err instanceof Error ? err.message : 'ত্রুটি'}`
          );
        }
      }
    }
  }

  // 1. Restore Categories first so recipes map to restored categories seamlessly
  for (let i = 0; i < categoriesToProcess.length; i += 1) {
    const cat = categoriesToProcess[i];
    const catId = sanitizeDocId(cat.id, 'cat', i);
    report(`ক্যাটাগরি রিস্টোর হচ্ছে: ${cat.name || catId}`);
    try {
      const ref = doc(db, 'categories', catId);
      const existing = await getDoc(ref);
      if (existing.exists() && options.mode === 'add-missing') {
        result.categories.skipped += 1;
      } else {
        const clean = sanitizeCategoryPayload(cat, i);
        if (existing.exists()) {
          const existingCreatedAt = existing.data()?.createdAt;
          await setDoc(ref, {
            ...clean,
            createdAt: existingCreatedAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.categories.updated += 1;
        } else {
          await setDoc(ref, {
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.categories.created += 1;
        }
      }
    } catch (err) {
      result.categories.failed += 1;
      result.errors.push(
        `ক্যাটাগরি "${cat.name || catId}": ${err instanceof Error ? err.message : 'রিস্টোর ব্যর্থ'}`
      );
    }
    completed += 1;
    report(`রিস্টোর চলছে (${completed}/${Math.max(1, totalWork)})`);
  }

  // 2. Restore Recipes + Recipe Content (including cover image & step images)
  for (let i = 0; i < recipesToProcess.length; i += 1) {
    const entry = recipesToProcess[i];
    const recipeId = sanitizeDocId(entry.recipe.id, 'recipe', i);
    report(`রেসিপি রিস্টোর হচ্ছে: ${entry.recipe.title || recipeId}`);
    try {
      const rRef = doc(db, 'recipes', recipeId);
      const cRef = doc(db, 'recipes', recipeId, 'content', 'detail');
      const existing = await getDoc(rRef);

      if (existing.exists() && options.mode === 'add-missing') {
        result.recipes.skipped += 1;
      } else {
        const cleanRecipe = sanitizeRecipePayload(entry.recipe, i);
        const cleanContent = sanitizeRecipeContentPayload(entry.content);
        const batch = writeBatch(db);

        if (existing.exists()) {
          const existingCreatedAt = existing.data()?.createdAt;
          batch.set(rRef, {
            ...cleanRecipe,
            createdAt: existingCreatedAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.recipes.updated += 1;
        } else {
          batch.set(rRef, {
            ...cleanRecipe,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.recipes.created += 1;
        }

        batch.set(cRef, {
          ...cleanContent,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
      }
    } catch (err) {
      result.recipes.failed += 1;
      result.errors.push(
        `রেসিপি "${entry.recipe.title || recipeId}": ${err instanceof Error ? err.message : 'রিস্টোর ব্যর্থ'}`
      );
    }
    completed += 1;
    report(`রিস্টোর চলছে (${completed}/${Math.max(1, totalWork)})`);
  }

  // 3. Restore Blog Posts (text + images)
  for (let i = 0; i < blogsToProcess.length; i += 1) {
    const post = blogsToProcess[i];
    const postId = sanitizeDocId(post.id, 'blog', i);
    report(`ব্লগ রিস্টোর হচ্ছে: ${post.title || postId}`);
    try {
      const ref = doc(db, 'blogPosts', postId);
      const existing = await getDoc(ref);
      if (existing.exists() && options.mode === 'add-missing') {
        result.blogPosts.skipped += 1;
      } else {
        const clean = sanitizeBlogPayload(post);
        if (existing.exists()) {
          const existingCreatedAt = existing.data()?.createdAt;
          await setDoc(ref, {
            ...clean,
            createdAt: existingCreatedAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.blogPosts.updated += 1;
        } else {
          await setDoc(ref, {
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.blogPosts.created += 1;
        }
      }
    } catch (err) {
      result.blogPosts.failed += 1;
      result.errors.push(
        `ব্লগ "${post.title || postId}": ${err instanceof Error ? err.message : 'রিস্টোর ব্যর্থ'}`
      );
    }
    completed += 1;
    report(`রিস্টোর চলছে (${completed}/${Math.max(1, totalWork)})`);
  }

  // 4. Restore Cooking Tips
  for (let i = 0; i < tipsToProcess.length; i += 1) {
    const tip = tipsToProcess[i];
    const tipId = sanitizeDocId(tip.id, 'tip', i);
    report(`টিপস রিস্টোর হচ্ছে: ${tip.title || tipId}`);
    try {
      const ref = doc(db, 'tips', tipId);
      const existing = await getDoc(ref);
      if (existing.exists() && options.mode === 'add-missing') {
        result.tips.skipped += 1;
      } else {
        const clean = sanitizeTipPayload(tip);
        if (existing.exists()) {
          const existingCreatedAt = existing.data()?.createdAt;
          await setDoc(ref, {
            ...clean,
            createdAt: existingCreatedAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.tips.updated += 1;
        } else {
          await setDoc(ref, {
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.tips.created += 1;
        }
      }
    } catch (err) {
      result.tips.failed += 1;
      result.errors.push(
        `টিপস "${tip.title || tipId}": ${err instanceof Error ? err.message : 'রিস্টোর ব্যর্থ'}`
      );
    }
    completed += 1;
    report(`রিস্টোর চলছে (${completed}/${Math.max(1, totalWork)})`);
  }

  return result;
}
