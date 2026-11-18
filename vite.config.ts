import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function resolveBasePath(command: 'serve' | 'build'): string {
  if (command === 'serve') return '/';
  const explicit = process.env.VITE_BASE_PATH?.trim();
  if (explicit) {
    if (explicit === './' || explicit === '.') return './';
    const cleaned = explicit.replace(/^\/+|\/+$/g, '');
    return cleaned ? `/${cleaned}/` : '/';
  }
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1] || '';
    if (repoName && !repoName.endsWith('.github.io')) {
      return `/${repoName}/`;
    }
    return '/';
  }
  if (
    process.env.VERCEL === '1' ||
    process.env.NETLIFY === 'true' ||
    process.env.K_SERVICE ||
    process.env.APPLET_ID
  ) {
    return '/';
  }
  return './';
}

function githubPagesSpaPlugin(): Plugin {
  let resolvedBase = '/';
  return {
    name: 'github-pages-spa-404',
    configResolved(config) {
      resolvedBase = config.base || '/';
    },
    generateBundle() {
      const pathSegmentsToKeep =
        resolvedBase === '/' || resolvedBase === './'
          ? 0
          : resolvedBase.split('/').filter(Boolean).length;
      const html = `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <title>রান্না শিখুন</title>
    <script>
      (function () {
        var pathSegmentsToKeep = ${pathSegmentsToKeep};
        var l = window.location;
        if (pathSegmentsToKeep === 0 && l.hostname.endsWith('.github.io')) {
          var segs = l.pathname.split('/').filter(Boolean);
          if (segs.length > 0 && !/^(recipes|category|recipe|tips|tip|pricing|checkout|blog|contact|favorites|login|profile|admin)$/.test(segs[0])) {
            pathSegmentsToKeep = 1;
          }
        }
        l.replace(
          l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
          l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
          l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
          (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
          l.hash
        );
      })();
    </script>
  </head>
  <body></body>
</html>
`;
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: html,
      });
    },
  };
}

function liveVersionManifestPlugin(buildId: string): Plugin {
  const payload = JSON.stringify({ buildId });
  return {
    name: 'live-version-manifest',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.end(payload);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: payload,
      });
    },
  };
}

interface FirestoreFieldVal {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
}

function fromFirestoreFields(fields: Record<string, FirestoreFieldVal> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) out[k] = Number(v.doubleValue);
  }
  return out;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function socialMetaPagesPlugin(resolvedBase: string): Plugin {
  let outDirAbs = path.resolve(__dirname, 'dist');
  return {
    name: 'social-meta-pages',
    apply: 'build',
    configResolved(config) {
      outDirAbs = path.resolve(__dirname, config.build.outDir || 'dist');
    },
    async closeBundle() {
      try {
        const indexPath = path.join(outDirAbs, 'index.html');
        if (!fs.existsSync(indexPath)) return;
        const baseTemplate = fs.readFileSync(indexPath, 'utf8');

        const assetsDir = path.join(outDirAbs, 'assets');
        const distAssetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

        const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
        let settingsDoc: Record<string, unknown> = {};
        let recipeDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
        let blogDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
        let tipDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
        let categoryDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

        if (fs.existsSync(cfgPath)) {
          try {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as {
              projectId?: string;
              firestoreDatabaseId?: string;
            };
            if (cfg.projectId && cfg.firestoreDatabaseId) {
              const apiRoot = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
              const [sRes, rRes, bRes, tRes, cRes] = await Promise.all([
                fetch(`${apiRoot}/siteSettings/main`, { signal: AbortSignal.timeout(4500) }).catch(() => null),
                fetch(`${apiRoot}/recipes?pageSize=200`, { signal: AbortSignal.timeout(4500) }).catch(() => null),
                fetch(`${apiRoot}/blogPosts?pageSize=200`, { signal: AbortSignal.timeout(4500) }).catch(() => null),
                fetch(`${apiRoot}/tips?pageSize=200`, { signal: AbortSignal.timeout(4500) }).catch(() => null),
                fetch(`${apiRoot}/categories?pageSize=100`, { signal: AbortSignal.timeout(4500) }).catch(() => null),
              ]);
              if (sRes && sRes.ok) {
                const json = (await sRes.json()) as { fields?: Record<string, FirestoreFieldVal> };
                settingsDoc = fromFirestoreFields(json.fields);
              }
              if (rRes && rRes.ok) {
                const json = (await rRes.json()) as {
                  documents?: Array<{ name?: string; fields?: Record<string, FirestoreFieldVal> }>;
                };
                recipeDocs = (json.documents || [])
                  .map((d) => ({
                    id: (d.name || '').split('/').pop() || '',
                    data: fromFirestoreFields(d.fields),
                  }))
                  .filter((d) => /^[a-zA-Z0-9_-]+$/.test(d.id));
              }
              if (bRes && bRes.ok) {
                const json = (await bRes.json()) as {
                  documents?: Array<{ name?: string; fields?: Record<string, FirestoreFieldVal> }>;
                };
                blogDocs = (json.documents || [])
                  .map((d) => ({
                    id: (d.name || '').split('/').pop() || '',
                    data: fromFirestoreFields(d.fields),
                  }))
                  .filter((d) => /^[a-zA-Z0-9_-]+$/.test(d.id) && d.data.isPublished !== false);
              }
              if (tRes && tRes.ok) {
                const json = (await tRes.json()) as {
                  documents?: Array<{ name?: string; fields?: Record<string, FirestoreFieldVal> }>;
                };
                tipDocs = (json.documents || [])
                  .map((d) => ({
                    id: (d.name || '').split('/').pop() || '',
                    data: fromFirestoreFields(d.fields),
                  }))
                  .filter((d) => /^[a-zA-Z0-9_-]+$/.test(d.id) && d.data.isPublished !== false);
              }
              if (cRes && cRes.ok) {
                const json = (await cRes.json()) as {
                  documents?: Array<{ name?: string; fields?: Record<string, FirestoreFieldVal> }>;
                };
                categoryDocs = (json.documents || [])
                  .map((d) => ({
                    id: (d.name || '').split('/').pop() || '',
                    data: fromFirestoreFields(d.fields),
                  }))
                  .filter((d) => d.data.isActive !== false);
              }
            }
          } catch {
            // Gracefully fall back to bundled defaults when offline
          }
        }

        const customCanonicalRaw =
          typeof settingsDoc.canonicalBaseUrl === 'string'
            ? settingsDoc.canonicalBaseUrl.trim().replace(/\/+$/, '')
            : '';
        const explicitSiteUrl = (process.env.VITE_SITE_URL || process.env.APP_URL || '')
          .trim()
          .replace(/\/+$/, '');
        const githubRepo = (process.env.GITHUB_REPOSITORY || '').trim();
        let siteBaseUrl =
          customCanonicalRaw && /^https?:\/\//i.test(customCanonicalRaw)
            ? customCanonicalRaw
            : explicitSiteUrl;
        if (!siteBaseUrl && githubRepo.includes('/')) {
          const [owner] = githubRepo.split('/');
          const cleanBase =
            resolvedBase === '/' || resolvedBase === './' ? '' : resolvedBase.replace(/\/+$/, '');
          if (owner) {
            siteBaseUrl = `https://${owner}.github.io${cleanBase}`;
          }
        }

        const findAssetBySeedSlug = (slug: string): string | null => {
          const match = distAssetFiles.find((f) => f.startsWith(slug));
          return match ? `assets/${match}` : null;
        };

        if (recipeDocs.length === 0) {
          recipeDocs = [
            {
              id: 'mutton-curry',
              data: {
                title: 'একটি দুর্দান্ত মাটন কারি রেসিপি',
                subtitle: 'খাঁটি সরিষার তেল ও বাটা মশলায় ধীর আঁচে কষানো ঐতিহ্যবাহী খাসির মাংসের কারি।',
                imageUrl: findAssetBySeedSlug('recipe_mutton_curry_') || 'assets/og-cover.jpg',
                category: 'মাংসের রেসিপি',
              },
            },
            {
              id: 'chingri-malai-curry',
              data: {
                title: 'চিংড়ি মালাই কারি',
                subtitle: 'নারকেলের ঘন দুধ আর ঘি-গরম মশলার সুগন্ধে তৈরি বাংলার সবচেয়ে জনপ্রিয় উৎসবের পদ।',
                imageUrl: findAssetBySeedSlug('recipe_chingri_malai_') || 'assets/og-cover.jpg',
                category: 'মাছের রেসিপি',
              },
            },
            {
              id: 'chicken-biryani',
              data: {
                title: 'চিকেন বিরিয়ানি',
                subtitle: 'জাফরান, কেওড়া জল ও ঘ্রাণযুক্ত মশলায় দমে রান্না করা ঘরোয়া শাহী চিকেন বিরিয়ানি।',
                imageUrl: findAssetBySeedSlug('recipe_chicken_biryani_') || 'assets/og-cover.jpg',
                category: 'ভাত ও পোলাও',
              },
            },
            {
              id: 'alur-dom',
              data: {
                title: 'নিরামিষ আলুর দম',
                subtitle: 'লুচি বা পরোটার সাথে জমে যাওয়া ভাজা মশলা আর টমেটো-জিরার স্বাদে খাঁটি আলুর দম।',
                imageUrl: findAssetBySeedSlug('recipe_alur_dom_') || 'assets/og-cover.jpg',
                category: 'সবজি রেসিপি',
              },
            },
            {
              id: 'shorshe-ilish',
              data: {
                title: 'ঐতিহ্যবাহী সরষে ইলিশ',
                subtitle: 'সাদা ও কালো সরিষা বাটা, কাঁচা মরিচ আর খাঁটি সরিষার তেলে রান্না করা ভরা বর্ষার ইলিশ।',
                imageUrl: findAssetBySeedSlug('recipe_ilish_shorshe_') || 'assets/og-cover.jpg',
                category: 'মাছের রেসিপি',
              },
            },
            {
              id: 'mishti-doi-rasmalai',
              data: {
                title: 'মাটির হাঁড়ির মিষ্টি দই ও রসমালাই',
                subtitle: 'ঘরেই সহজ উপায়ে ক্যারামেল ঘন দুধে জমানো আসল বগুড়ার স্বাদের মিষ্টি দই।',
                imageUrl: findAssetBySeedSlug('recipe_bengali_mishti_') || 'assets/og-cover.jpg',
                category: 'মিষ্টান্ন',
              },
            },
          ];
        }

        if (blogDocs.length === 0) {
          blogDocs = [
            {
              id: 'blog-bengali-spices',
              data: {
                title: 'বাঙালি হেঁশেলের পাঁচফোড়ন: পাঁচ মশলার আশ্চর্য রসায়ন',
                excerpt: 'মৌরি, মেথি, কালোজিরা, সর্ষে ও রাঁধুনির নিখুঁত অনুপাতে কীভাবে সাধারণ সবজি রান্নাও হয়ে ওঠে অসাধারণ।',
                imageUrl: findAssetBySeedSlug('recipe_alur_dom_') || 'assets/og-cover.jpg',
                category: 'খাদ্য ঐতিহ্য',
              },
            },
            {
              id: 'blog-sunday-mutton',
              data: {
                title: 'রবিবারের দুপুর ও কষা মাংসের চিরন্তন গল্প',
                excerpt: 'বাঙালির ছুটির দিনের সবচেয়ে প্রিয় পদ কষা মাংসের পেছনের ধৈর্য, আঁচ ও মশলার ঐতিহ্যবাহী গল্প।',
                imageUrl: findAssetBySeedSlug('recipe_mutton_curry_') || 'assets/og-cover.jpg',
                category: 'রন্ধন গল্প',
              },
            },
            {
              id: 'blog-hilsa-season',
              data: {
                title: 'বর্ষার ইলিশ: সরষে থেকে ভাপা, রান্নার সেরা দিকনির্দেশনা',
                excerpt: 'তাজা ইলিশ চেনার উপায় এবং মাছের আসল স্বাদ অক্ষুণ্ণ রেখে রান্নার সহজ টিপস।',
                imageUrl: findAssetBySeedSlug('recipe_ilish_shorshe_') || 'assets/og-cover.jpg',
                category: 'মৌসুমী রান্না',
              },
            },
          ];
        }

        const materializeOgImage = (rawUrl: unknown, fileKey: string, depth: number): string => {
          const val = typeof rawUrl === 'string' ? rawUrl.trim() : '';
          let relativeAsset = 'assets/og-cover.jpg';

          if (val) {
            const dataMatch = val.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
            if (dataMatch) {
              const ext = dataMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : dataMatch[1].toLowerCase();
              const outFileName = `og-${fileKey}.${ext}`;
              if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
              fs.writeFileSync(path.join(assetsDir, outFileName), Buffer.from(dataMatch[2], 'base64'));
              relativeAsset = `assets/${outFileName}`;
            } else if (/^https?:\/\//i.test(val)) {
              return val;
            } else {
              const cleaned = val.replace(/^\.?\/+/, '');
              const afterAssets = cleaned.includes('assets/')
                ? cleaned.slice(cleaned.indexOf('assets/'))
                : '';
              if (afterAssets) {
                const candidateName = path.basename(afterAssets);
                if (distAssetFiles.includes(candidateName)) {
                  relativeAsset = `assets/${candidateName}`;
                } else {
                  const stem = candidateName.replace(/-[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i, '');
                  const matched = stem ? distAssetFiles.find((f) => f.startsWith(stem)) : undefined;
                  if (matched) {
                    relativeAsset = `assets/${matched}`;
                  }
                }
              }
            }
          }

          if (siteBaseUrl) {
            return `${siteBaseUrl}/${relativeAsset}`;
          }
          if (resolvedBase.startsWith('/')) {
            return `${resolvedBase.replace(/\/$/, '')}/${relativeAsset}`;
          }
          return `${depth > 0 ? '../'.repeat(depth) : './'}${relativeAsset}`;
        };

        const siteName = String(settingsDoc.siteName || 'রান্না শিখুন');
        const siteSeoTitle = String(
          settingsDoc.seoTitle || 'রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম'
        );
        const siteSeoDesc = String(
          settingsDoc.seoDescription ||
            'সম্পূর্ণ বাংলায় রান্না শিখুন — ধাপে ধাপে ছবিসহ দেশি বিদেশী ও চাইনিজ রেসিপি, রান্না শিখার বিশ্বস্ত ঠিকানা।'
        );
        const siteKeywords = String(
          settingsDoc.seoKeywords ||
            'বাংলা রান্না, বাঙালি রেসিপি, ঘরোয়া রান্না, সরষে ইলিশ, মাটন কারি, রন্ধন শিল্প, রান্না শিখুন'
        );
        const siteAuthor = String(settingsDoc.seoAuthor || siteName);
        const siteRobots = String(settingsDoc.seoRobotsPolicy || 'index, follow');
        const gscCodeRaw = String(settingsDoc.googleSiteVerification || '').trim();
        const gscMatch = gscCodeRaw.match(/content\s*=\s*["']([^"']+)["']/i);
        const gscCode = gscMatch ? gscMatch[1].trim() : gscCodeRaw.replace(/[<>"']/g, '');
        const bingCode = String(settingsDoc.bingSiteVerification || '').trim();
        const ga4Id = String(settingsDoc.googleAnalyticsId || '').trim();
        const twitterHandleRaw = String(settingsDoc.twitterHandle || '').trim();
        const twitterSite = twitterHandleRaw
          ? twitterHandleRaw.startsWith('@')
            ? twitterHandleRaw
            : `@${twitterHandleRaw}`
          : '';
        const fbAppId = String(settingsDoc.fbAppId || '').trim();

        const extraHeadTags: string[] = [];
        if (gscCode) {
          extraHeadTags.push(
            `    <meta name="google-site-verification" content="${escapeHtmlAttr(gscCode)}" />`
          );
        }
        if (bingCode) {
          extraHeadTags.push(`    <meta name="msvalidate.01" content="${escapeHtmlAttr(bingCode)}" />`);
        }
        if (twitterSite) {
          extraHeadTags.push(`    <meta name="twitter:site" content="${escapeHtmlAttr(twitterSite)}" />`);
        }
        if (fbAppId) {
          extraHeadTags.push(`    <meta property="fb:app_id" content="${escapeHtmlAttr(fbAppId)}" />`);
        }
        if (siteBaseUrl) {
          extraHeadTags.push(
            `    <link rel="sitemap" type="application/xml" title="Sitemap" href="${escapeHtmlAttr(siteBaseUrl)}/sitemap.xml" />`
          );
        }
        if (/^G-[A-Z0-9]+$/i.test(ga4Id)) {
          extraHeadTags.push(
            `    <script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}"></script>`
          );
          extraHeadTags.push(
            `    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>`
          );
        }

        const buildMetaHtml = (opts: {
          template: string;
          title: string;
          ogTitle?: string;
          description: string;
          ogDescription?: string;
          ogType: 'website' | 'article';
          canonicalPath: string;
          imageUrl: string;
          imageAlt: string;
          structuredData: Record<string, unknown>;
          depth: number;
        }): string => {
          let html = opts.template;
          if (opts.depth > 0 && resolvedBase === './') {
            const prefix = '../'.repeat(opts.depth);
            html = html
              .replace(/(href|src)="\.\/assets\//g, `$1="${prefix}assets/`)
              .replace(/(href|src)="\.\/"/g, `$1="${prefix}"`);
          }

          const canonicalUrl = siteBaseUrl
            ? opts.canonicalPath === '/'
              ? `${siteBaseUrl}/`
              : `${siteBaseUrl}${opts.canonicalPath}`
            : opts.canonicalPath;

          const effectiveOgTitle = opts.ogTitle || opts.title;
          const effectiveOgDesc = opts.ogDescription || opts.description;

          html = html
            .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlText(opts.title)}</title>`)
            .replace(
              /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="description" content="${escapeHtmlAttr(opts.description)}" />`
            )
            .replace(
              /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="keywords" content="${escapeHtmlAttr(siteKeywords)}" />`
            )
            .replace(
              /<meta\s+name="author"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="author" content="${escapeHtmlAttr(siteAuthor)}" />`
            )
            .replace(
              /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="robots" content="${escapeHtmlAttr(siteRobots)}" />`
            )
            .replace(
              /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/i,
              `<meta property="og:site_name" content="${escapeHtmlAttr(siteName)}" />`
            )
            .replace(
              /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
              `<meta property="og:title" content="${escapeHtmlAttr(effectiveOgTitle)}" />`
            )
            .replace(
              /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
              `<meta property="og:description" content="${escapeHtmlAttr(effectiveOgDesc)}" />`
            )
            .replace(
              /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
              `<meta property="og:type" content="${opts.ogType}" />`
            )
            .replace(
              /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
              `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`
            )
            .replace(
              /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
              `<meta property="og:image" content="${escapeHtmlAttr(opts.imageUrl)}" />`
            )
            .replace(
              /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/i,
              `<meta property="og:image:alt" content="${escapeHtmlAttr(opts.imageAlt)}" />`
            )
            .replace(
              /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="twitter:title" content="${escapeHtmlAttr(effectiveOgTitle)}" />`
            )
            .replace(
              /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="twitter:description" content="${escapeHtmlAttr(effectiveOgDesc)}" />`
            )
            .replace(
              /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="twitter:image" content="${escapeHtmlAttr(opts.imageUrl)}" />`
            )
            .replace(
              /<script\s+id="rs-structured-data"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
              `<script id="rs-structured-data" type="application/ld+json">${JSON.stringify(opts.structuredData)}</script>`
            );

          const injectLines: string[] = [...extraHeadTags];
          if (siteBaseUrl) {
            const canonicalTag = `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`;
            if (/<link\s+rel="canonical"[^>]*>/i.test(html)) {
              html = html.replace(/<link\s+rel="canonical"[^>]*>/i, canonicalTag);
            } else {
              injectLines.push(`    ${canonicalTag}`);
            }
          }
          if (injectLines.length > 0) {
            html = html.replace(/<\/head>/i, `${injectLines.join('\n')}\n  </head>`);
          }

          return html;
        };

        const siteOgImage = materializeOgImage(settingsDoc.socialShareImageUrl, 'site-cover', 0);
        const siteSocialTitle = String(settingsDoc.socialShareTitle || siteSeoTitle);
        const siteSocialDesc = String(settingsDoc.socialShareDescription || siteSeoDesc);
        const siteSocialAlt = String(
          settingsDoc.socialShareImageAlt || `${siteName} — বাঙালি খাবারের রেসিপি`
        );

        const homeHtml = buildMetaHtml({
          template: baseTemplate,
          title: siteSeoTitle,
          ogTitle: siteSocialTitle,
          description: siteSeoDesc,
          ogDescription: siteSocialDesc,
          ogType: 'website',
          canonicalPath: '/',
          imageUrl: siteOgImage,
          imageAlt: siteSocialAlt,
          structuredData: {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: siteName,
            url: siteBaseUrl || '/',
            description: siteSeoDesc,
            inLanguage: 'bn',
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteBaseUrl || ''}/recipes?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          depth: 0,
        });
        fs.writeFileSync(indexPath, homeHtml, 'utf8');

        for (const rec of recipeDocs) {
          const rTitle = String(rec.data.title || siteName);
          const rDesc = String(rec.data.subtitle || siteSeoDesc);
          const fullTitle = `${rTitle} — ${siteName}`;
          const rImage = materializeOgImage(rec.data.imageUrl, `recipe-${rec.id}`, 2);
          const outDir = path.join(outDirAbs, 'recipe', rec.id);
          fs.mkdirSync(outDir, { recursive: true });
          const html = buildMetaHtml({
            template: baseTemplate,
            title: fullTitle,
            description: rDesc,
            ogType: 'article',
            canonicalPath: `/recipe/${rec.id}`,
            imageUrl: rImage,
            imageAlt: rTitle,
            structuredData: {
              '@context': 'https://schema.org',
              '@type': 'Recipe',
              name: rTitle,
              description: rDesc,
              image: rImage,
              recipeCategory: String(rec.data.category || ''),
              inLanguage: 'bn',
            },
            depth: 2,
          });
          fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
        }

        for (const post of blogDocs) {
          const bTitle = String(post.data.title || siteName);
          const bDesc = String(post.data.excerpt || siteSeoDesc);
          const fullTitle = `${bTitle} — ${siteName}`;
          const bImage = materializeOgImage(post.data.imageUrl, `blog-${post.id}`, 2);
          const outDir = path.join(outDirAbs, 'blog', post.id);
          fs.mkdirSync(outDir, { recursive: true });
          const html = buildMetaHtml({
            template: baseTemplate,
            title: fullTitle,
            description: bDesc,
            ogType: 'article',
            canonicalPath: `/blog/${post.id}`,
            imageUrl: bImage,
            imageAlt: bTitle,
            structuredData: {
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: bTitle,
              description: bDesc,
              image: bImage,
              articleSection: String(post.data.category || ''),
              inLanguage: 'bn',
            },
            depth: 2,
          });
          fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
        }

        // Emit Google Search Console HTML verification file if configured
        const gscFile = String(settingsDoc.googleVerificationFile || '').trim().replace(/^\/+/, '');
        if (/^google[a-zA-Z0-9_-]+\.html$/i.test(gscFile)) {
          fs.writeFileSync(
            path.join(outDirAbs, gscFile),
            `google-site-verification: ${gscFile}`,
            'utf8'
          );
        }

        // Emit sitemap.xml & robots.txt for Google Search Console
        const sitemapBase = siteBaseUrl || (resolvedBase === './' ? '' : resolvedBase.replace(/\/+$/, ''));
        if (sitemapBase) {
          const today = new Date().toISOString().split('T')[0];
          const urlEntries: Array<{ loc: string; priority: string; changefreq: string }> = [
            { loc: `${sitemapBase}/`, priority: '1.0', changefreq: 'daily' },
            { loc: `${sitemapBase}/recipes`, priority: '0.9', changefreq: 'daily' },
            { loc: `${sitemapBase}/tips`, priority: '0.8', changefreq: 'weekly' },
            { loc: `${sitemapBase}/blog`, priority: '0.8', changefreq: 'weekly' },
            { loc: `${sitemapBase}/pricing`, priority: '0.7', changefreq: 'monthly' },
            { loc: `${sitemapBase}/contact`, priority: '0.5', changefreq: 'monthly' },
          ];
          for (const cat of categoryDocs) {
            const catName = String(cat.data.name || '').trim();
            if (catName) {
              urlEntries.push({
                loc: `${sitemapBase}/category/${encodeURIComponent(catName)}`,
                priority: '0.7',
                changefreq: 'weekly',
              });
            }
          }
          for (const rec of recipeDocs) {
            urlEntries.push({
              loc: `${sitemapBase}/recipe/${encodeURIComponent(rec.id)}`,
              priority: '0.9',
              changefreq: 'weekly',
            });
          }
          for (const post of blogDocs) {
            urlEntries.push({
              loc: `${sitemapBase}/blog/${encodeURIComponent(post.id)}`,
              priority: '0.8',
              changefreq: 'weekly',
            });
          }
          for (const tip of tipDocs) {
            urlEntries.push({
              loc: `${sitemapBase}/tip/${encodeURIComponent(tip.id)}`,
              priority: '0.7',
              changefreq: 'monthly',
            });
          }

          const xmlNodes = urlEntries
            .map(
              (u) => `  <url>
    <loc>${escapeHtmlText(u.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
            )
            .join('\n');

          fs.writeFileSync(
            path.join(outDirAbs, 'sitemap.xml'),
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlNodes}\n</urlset>\n`,
            'utf8'
          );
        }

        const allowIndexing = !siteRobots.includes('noindex');
        const extraRobots = String(settingsDoc.robotsTxtExtra || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const robotsLines = ['User-agent: *'];
        if (!allowIndexing) {
          robotsLines.push('Disallow: /');
        } else {
          robotsLines.push('Allow: /', 'Disallow: /admin', 'Disallow: /profile', 'Disallow: /login', 'Disallow: /checkout');
        }
        for (const line of extraRobots) {
          robotsLines.push(line);
        }
        if (sitemapBase) {
          robotsLines.push('', `Sitemap: ${sitemapBase}/sitemap.xml`);
        }
        fs.writeFileSync(path.join(outDirAbs, 'robots.txt'), `${robotsLines.join('\n')}\n`, 'utf8');
      } catch (err) {
        console.warn('socialMetaPagesPlugin non-fatal warning:', err);
      }
    },
  };
}

export default defineConfig(({ command }) => {
  const buildId = Date.now().toString(36);
  const base = resolveBasePath(command);
  return {
    base,
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      tailwindcss(),
      liveVersionManifestPlugin(buildId),
      githubPagesSpaPlugin(),
      socialMetaPagesPlugin(base),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
