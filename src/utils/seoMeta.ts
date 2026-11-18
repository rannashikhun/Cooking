import { resolvePublicAsset, withAppBase } from './appBase';
import type {
  BlogPost,
  CookingTip,
  PageRoute,
  Recipe,
  RecipeCategory,
  SiteSettings,
} from '../types';

export const DEFAULT_SEO_TITLE =
  'রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম';
export const DEFAULT_SEO_DESCRIPTION =
  'সম্পূর্ণ বাংলায় রান্না শিখুন — ধাপে ধাপে ছবিসহ দেশি বিদেশী ও চাইনিজ রেসিপি, রান্না শিখার বিশ্বস্ত ঠিকানা।';
export const DEFAULT_SEO_KEYWORDS =
  'বাংলা রান্না, বাঙালি রেসিপি, ঘরোয়া রান্না, সরষে ইলিশ, মাটন কারি, রন্ধন শিল্প, রান্না শিখুন';

export function extractGoogleVerificationCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const contentMatch = trimmed.match(/content\s*=\s*["']([^"']+)["']/i);
  if (contentMatch && contentMatch[1]) {
    return contentMatch[1].trim().slice(0, 140);
  }
  return trimmed.replace(/[<>"']/g, '').slice(0, 140);
}

export function extractGoogleVerificationFilename(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+/, '');
  if (!trimmed) return '';
  if (/^google[a-zA-Z0-9_-]+\.html$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^google[a-zA-Z0-9_-]+$/i.test(trimmed)) {
    return `${trimmed}.html`;
  }
  return trimmed.slice(0, 120);
}

export function normalizeCanonicalBaseUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${pathname}`;
  } catch {
    return '';
  }
}

export function resolveEffectiveBaseUrl(canonicalBaseUrl?: string): string {
  const custom = normalizeCanonicalBaseUrl(canonicalBaseUrl);
  if (custom) return custom;
  if (typeof window !== 'undefined' && window.location.origin) {
    const baseHome = withAppBase('/').replace(/\/+$/, '');
    return `${window.location.origin}${baseHome}`;
  }
  return '';
}

export function resolveAbsoluteShareImage(imageUrl?: string, customBaseUrl?: string): string {
  const effectiveBase = resolveEffectiveBaseUrl(customBaseUrl);
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : '';
  const trimmed = (imageUrl || '').trim();
  if (!trimmed) {
    const fallbackAsset = resolvePublicAsset('assets/og-cover.jpg');
    if (effectiveBase) {
      return `${effectiveBase}/assets/og-cover.jpg`;
    }
    return origin ? `${origin}${fallbackAsset}` : fallbackAsset;
  }
  if (/^(https?:)?\/\//i.test(trimmed)) {
    return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  }
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return origin ? `${origin}${trimmed}` : trimmed;
  }
  const resolved = resolvePublicAsset(trimmed);
  return origin ? `${origin}${resolved}` : resolved;
}

function upsertMetaTag(
  selector: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMetaTag(selector: string): void {
  if (typeof document === 'undefined') return;
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  if (el) el.remove();
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function updateStructuredData(schema: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('rs-structured-data') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'rs-structured-data';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);
}

function ensureGoogleAnalytics(measurementId?: string): void {
  if (typeof document === 'undefined') return;
  const cleanId = (measurementId || '').trim();
  if (!/^G-[A-Z0-9]+$/i.test(cleanId)) return;
  const existing = document.getElementById('rs-ga4-script') as HTMLScriptElement | null;
  if (existing && existing.dataset.gaId === cleanId) return;
  if (existing) existing.remove();
  const inlineExisting = document.getElementById('rs-ga4-inline');
  if (inlineExisting) inlineExisting.remove();

  const srcScript = document.createElement('script');
  srcScript.id = 'rs-ga4-script';
  srcScript.async = true;
  srcScript.dataset.gaId = cleanId;
  srcScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cleanId)}`;
  document.head.appendChild(srcScript);

  const inlineScript = document.createElement('script');
  inlineScript.id = 'rs-ga4-inline';
  inlineScript.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${cleanId}');`;
  document.head.appendChild(inlineScript);
}

function routePathForCanonical(route: PageRoute): string {
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

export function applyRouteSeoMeta(params: {
  route: PageRoute;
  siteSettings: SiteSettings;
  recipes: Recipe[];
  blogPosts: BlogPost[];
  tips: CookingTip[];
}): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const { route, siteSettings, recipes, blogPosts, tips } = params;
  const siteName = (siteSettings.siteName || 'রান্না শিখুন').trim();
  const baseTitle = (siteSettings.seoTitle || DEFAULT_SEO_TITLE).trim();
  const baseDescription = (
    siteSettings.seoDescription ||
    siteSettings.tagline ||
    DEFAULT_SEO_DESCRIPTION
  ).trim();
  const seoKeywords = (siteSettings.seoKeywords || DEFAULT_SEO_KEYWORDS).trim();
  const seoAuthor = (siteSettings.seoAuthor || siteName).trim();
  const robotsPolicy = siteSettings.seoRobotsPolicy || 'index, follow';

  const siteShareImage = resolveAbsoluteShareImage(
    siteSettings.socialShareImageUrl,
    siteSettings.canonicalBaseUrl
  );
  const customBase = normalizeCanonicalBaseUrl(siteSettings.canonicalBaseUrl);
  const routeRel = routePathForCanonical(route);
  const canonicalUrl = customBase
    ? routeRel === '/'
      ? `${customBase}/`
      : `${customBase}${routeRel}`
    : `${window.location.origin}${withAppBase(routeRel)}`;
  const homeUrl = customBase
    ? `${customBase}/`
    : `${window.location.origin}${withAppBase('/')}`;

  let title = baseTitle;
  let description = baseDescription;
  let ogTitle = (siteSettings.socialShareTitle || baseTitle).trim();
  let ogDescription = (siteSettings.socialShareDescription || baseDescription).trim();
  let image = siteShareImage;
  let imageAlt = (siteSettings.socialShareImageAlt || `${siteName} — বাঙালি রান্নার সংগ্রহ`).trim();
  let ogType: 'website' | 'article' = 'website';
  let pageRobots = robotsPolicy;

  let structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: homeUrl,
    description: baseDescription,
    inLanguage: 'bn',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${homeUrl}recipes?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  if (route.page === 'recipe-detail') {
    const recipe = recipes.find((r) => r.id === route.id);
    if (recipe) {
      title = `${recipe.title} — ${siteName}`;
      description = (recipe.subtitle || baseDescription).trim();
      ogTitle = title;
      ogDescription = description;
      image = resolveAbsoluteShareImage(recipe.imageUrl, siteSettings.canonicalBaseUrl) || siteShareImage;
      imageAlt = recipe.title;
      ogType = 'article';
      structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.title,
        description,
        image,
        recipeCategory: recipe.category,
        recipeCuisine: recipe.cuisine || 'Bengali',
        cookTime: recipe.cookTime,
        aggregateRating:
          recipe.ratingCount > 0
            ? {
                '@type': 'AggregateRating',
                ratingValue: recipe.rating,
                ratingCount: recipe.ratingCount,
              }
            : undefined,
        inLanguage: 'bn',
        url: canonicalUrl,
      };
    }
  } else if (route.page === 'blog-detail') {
    const post = blogPosts.find((p) => p.id === route.id);
    if (post) {
      title = `${post.title} — ${siteName}`;
      description = (post.excerpt || baseDescription).trim();
      ogTitle = title;
      ogDescription = description;
      image = resolveAbsoluteShareImage(post.imageUrl, siteSettings.canonicalBaseUrl) || siteShareImage;
      imageAlt = post.title;
      ogType = 'article';
      structuredData = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description,
        image,
        articleSection: post.category,
        publisher: {
          '@type': 'Organization',
          name: siteName,
        },
        inLanguage: 'bn',
        url: canonicalUrl,
      };
    }
  } else if (route.page === 'tip-detail') {
    const tip = tips.find((t) => t.id === route.id);
    if (tip) {
      title = `${tip.title} — ${siteName}`;
      description = (tip.summary || baseDescription).trim();
      ogTitle = title;
      ogDescription = description;
      imageAlt = tip.title;
      ogType = 'article';
      structuredData = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: tip.title,
        description,
        image,
        inLanguage: 'bn',
        url: canonicalUrl,
      };
    }
  } else if (route.page === 'category') {
    title = `${route.categoryName} রেসিপি — ${siteName}`;
    description = `${route.categoryName} ক্যাটাগরির বাছাইকৃত ঘরোয়া বাংলা রেসিপি দেখুন — ${siteName}।`;
    ogTitle = title;
    ogDescription = description;
  } else if (route.page === 'recipes') {
    title = `সকল রেসিপি — ${siteName}`;
    ogTitle = title;
  } else if (route.page === 'blog') {
    title = `রন্ধন শিল্প ও খাদ্য ব্লগ — ${siteName}`;
    ogTitle = title;
  } else if (route.page === 'tips') {
    title = `রান্নার টিপস ও কৌশল — ${siteName}`;
    ogTitle = title;
  } else if (route.page === 'pricing') {
    title = `সদস্যপদ প্ল্যান — ${siteName}`;
    ogTitle = title;
  } else if (route.page === 'contact') {
    title = `যোগাযোগ — ${siteName}`;
    ogTitle = title;
  } else if (route.page === 'admin' || route.page === 'profile' || route.page === 'login' || route.page === 'checkout') {
    pageRobots = 'noindex, nofollow';
  }

  document.title = title;
  upsertCanonicalLink(canonicalUrl);
  upsertMetaTag('meta[name="description"]', 'name', 'description', description);
  upsertMetaTag('meta[name="keywords"]', 'name', 'keywords', seoKeywords);
  upsertMetaTag('meta[name="author"]', 'name', 'author', seoAuthor);
  upsertMetaTag('meta[name="robots"]', 'name', 'robots', pageRobots);

  const gscCode = extractGoogleVerificationCode(siteSettings.googleSiteVerification || '');
  if (gscCode) {
    upsertMetaTag(
      'meta[name="google-site-verification"]',
      'name',
      'google-site-verification',
      gscCode
    );
  } else {
    removeMetaTag('meta[name="google-site-verification"]');
  }

  const bingCode = (siteSettings.bingSiteVerification || '').trim();
  if (bingCode) {
    upsertMetaTag('meta[name="msvalidate.01"]', 'name', 'msvalidate.01', bingCode);
  } else {
    removeMetaTag('meta[name="msvalidate.01"]');
  }

  const fbAppId = (siteSettings.fbAppId || '').trim();
  if (fbAppId) {
    upsertMetaTag('meta[property="fb:app_id"]', 'property', 'fb:app_id', fbAppId);
  } else {
    removeMetaTag('meta[property="fb:app_id"]');
  }

  const twitterHandle = (siteSettings.twitterHandle || '').trim();
  if (twitterHandle) {
    const normalizedHandle = twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}`;
    upsertMetaTag('meta[name="twitter:site"]', 'name', 'twitter:site', normalizedHandle);
  } else {
    removeMetaTag('meta[name="twitter:site"]');
  }

  upsertMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', siteName);
  upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', ogTitle);
  upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', ogDescription);
  upsertMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
  upsertMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  upsertMetaTag('meta[property="og:image"]', 'property', 'og:image', image);
  upsertMetaTag('meta[property="og:image:alt"]', 'property', 'og:image:alt', imageAlt);
  upsertMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', ogTitle);
  upsertMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', ogDescription);
  upsertMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', image);

  updateStructuredData(structuredData);
  ensureGoogleAnalytics(siteSettings.googleAnalyticsId);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemapXml(params: {
  baseUrl: string;
  recipes: Recipe[];
  blogPosts: BlogPost[];
  tips: CookingTip[];
  categories: RecipeCategory[];
}): string {
  const base = params.baseUrl.replace(/\/+$/, '');
  const today = new Date().toISOString().split('T')[0];

  const entries: Array<{ loc: string; priority: string; changefreq: string }> = [
    { loc: `${base}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${base}/recipes`, priority: '0.9', changefreq: 'daily' },
    { loc: `${base}/tips`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${base}/blog`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${base}/pricing`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${base}/contact`, priority: '0.5', changefreq: 'monthly' },
  ];

  for (const cat of params.categories.filter((c) => c.isActive)) {
    entries.push({
      loc: `${base}/category/${encodeURIComponent(cat.name)}`,
      priority: '0.7',
      changefreq: 'weekly',
    });
  }

  for (const r of params.recipes) {
    entries.push({
      loc: `${base}/recipe/${encodeURIComponent(r.id)}`,
      priority: '0.9',
      changefreq: 'weekly',
    });
  }

  for (const p of params.blogPosts.filter((b) => b.isPublished)) {
    entries.push({
      loc: `${base}/blog/${encodeURIComponent(p.id)}`,
      priority: '0.8',
      changefreq: 'weekly',
    });
  }

  for (const t of params.tips.filter((item) => item.isPublished)) {
    entries.push({
      loc: `${base}/tip/${encodeURIComponent(t.id)}`,
      priority: '0.7',
      changefreq: 'monthly',
    });
  }

  const urlNodes = entries
    .map(
      (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>
`;
}

export function buildRobotsTxt(params: {
  baseUrl: string;
  allowIndexing: boolean;
  extraRules?: string;
}): string {
  const base = params.baseUrl.replace(/\/+$/, '');
  const lines = ['User-agent: *'];
  if (!params.allowIndexing) {
    lines.push('Disallow: /');
  } else {
    lines.push('Allow: /');
    lines.push('Disallow: /admin');
    lines.push('Disallow: /profile');
    lines.push('Disallow: /login');
    lines.push('Disallow: /checkout');
  }
  const extra = (params.extraRules || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const rule of extra) {
    lines.push(rule);
  }
  if (base) {
    lines.push('');
    lines.push(`Sitemap: ${base}/sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareCurrentPage(params: {
  title: string;
  text: string;
  url?: string;
}): Promise<'shared' | 'copied' | 'failed'> {
  const shareUrl =
    params.url || (typeof window !== 'undefined' ? window.location.href : '');
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: params.title,
        text: params.text,
        url: shareUrl,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'failed';
      }
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
