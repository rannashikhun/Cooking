import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  Globe,
  ImagePlus,
  Search,
  Share2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { resolvePublicAsset, withAppBase } from '../utils/appBase';
import {
  buildRobotsTxt,
  buildSitemapXml,
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_KEYWORDS,
  DEFAULT_SEO_TITLE,
  downloadTextFile,
  extractGoogleVerificationCode,
  extractGoogleVerificationFilename,
  normalizeCanonicalBaseUrl,
  resolveAbsoluteShareImage,
  resolveEffectiveBaseUrl,
} from '../utils/seoMeta';
import type { BlogPost, CookingTip, Recipe, RecipeCategory } from '../types';

interface AdminSocialShareTabProps {
  siteName: string;
  seoTitle: string;
  seoDescription: string;
  canonicalBaseUrl: string;
  socialShareImageUrl: string;
  onChangeSocialShareImageUrl: (v: string) => void;
  socialShareTitle: string;
  onChangeSocialShareTitle: (v: string) => void;
  socialShareDescription: string;
  onChangeSocialShareDescription: (v: string) => void;
  socialShareImageAlt: string;
  onChangeSocialShareImageAlt: (v: string) => void;
  twitterHandle: string;
  onChangeTwitterHandle: (v: string) => void;
  fbAppId: string;
  onChangeFbAppId: (v: string) => void;
  showRecipeShareButton: boolean;
  onToggleRecipeShareButton: () => void;
  togglingRecipeShare?: boolean;
  uploading: boolean;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  recipes: Recipe[];
  blogPosts: BlogPost[];
  onNotify: (msg: string) => void;
}

export const AdminSocialShareTab: React.FC<AdminSocialShareTabProps> = ({
  siteName,
  seoTitle,
  seoDescription,
  canonicalBaseUrl,
  socialShareImageUrl,
  onChangeSocialShareImageUrl,
  socialShareTitle,
  onChangeSocialShareTitle,
  socialShareDescription,
  onChangeSocialShareDescription,
  socialShareImageAlt,
  onChangeSocialShareImageAlt,
  twitterHandle,
  onChangeTwitterHandle,
  fbAppId,
  onChangeFbAppId,
  showRecipeShareButton,
  onToggleRecipeShareButton,
  togglingRecipeShare = false,
  uploading,
  onUploadImage,
  onSave,
  saving,
  recipes,
  blogPosts,
  onNotify,
}) => {
  const [previewTarget, setPreviewTarget] = useState<string>('home');

  const effectiveBase = resolveEffectiveBaseUrl(canonicalBaseUrl);
  const hostLabel = useMemo(() => {
    try {
      if (effectiveBase) return new URL(effectiveBase).host;
    } catch {
      // ignore
    }
    return typeof window !== 'undefined' ? window.location.host : 'rannashikhun.com';
  }, [effectiveBase]);

  const previewData = useMemo(() => {
    if (previewTarget.startsWith('recipe:')) {
      const id = previewTarget.slice('recipe:'.length);
      const rec = recipes.find((r) => r.id === id);
      if (rec) {
        return {
          badge: 'রেসিপি পোস্ট থাম্বনেইল (স্বয়ংক্রিয়)',
          title: `${rec.title} — ${siteName || 'রান্না শিখুন'}`,
          description: rec.subtitle || seoDescription || DEFAULT_SEO_DESCRIPTION,
          image: rec.imageUrl || resolvePublicAsset('assets/og-cover.jpg'),
          url: effectiveBase
            ? `${effectiveBase}/recipe/${encodeURIComponent(rec.id)}`
            : `${typeof window !== 'undefined' ? window.location.origin : ''}${withAppBase(`/recipe/${encodeURIComponent(rec.id)}`)}`,
        };
      }
    }
    if (previewTarget.startsWith('blog:')) {
      const id = previewTarget.slice('blog:'.length);
      const post = blogPosts.find((p) => p.id === id);
      if (post) {
        return {
          badge: 'ব্লগ পোস্ট থাম্বনেইল (স্বয়ংক্রিয়)',
          title: `${post.title} — ${siteName || 'রান্না শিখুন'}`,
          description: post.excerpt || seoDescription || DEFAULT_SEO_DESCRIPTION,
          image: post.imageUrl || resolvePublicAsset('assets/og-cover.jpg'),
          url: effectiveBase
            ? `${effectiveBase}/blog/${encodeURIComponent(post.id)}`
            : `${typeof window !== 'undefined' ? window.location.origin : ''}${withAppBase(`/blog/${encodeURIComponent(post.id)}`)}`,
        };
      }
    }
    return {
      badge: 'হোমপেজ / মূল সাইট লিংক প্রিভিউ',
      title: socialShareTitle || seoTitle || DEFAULT_SEO_TITLE,
      description: socialShareDescription || seoDescription || DEFAULT_SEO_DESCRIPTION,
      image: socialShareImageUrl || resolvePublicAsset('assets/og-cover.jpg'),
      url: effectiveBase
        ? `${effectiveBase}/`
        : `${typeof window !== 'undefined' ? window.location.origin : ''}${withAppBase('/')}`,
    };
  }, [
    previewTarget,
    recipes,
    blogPosts,
    siteName,
    seoTitle,
    seoDescription,
    socialShareTitle,
    socialShareDescription,
    socialShareImageUrl,
    effectiveBase,
  ]);

  const handleCopyPreviewUrl = async () => {
    try {
      await navigator.clipboard.writeText(previewData.url);
      onNotify('শেয়ার লিংক ক্লিপবোর্ডে কপি করা হয়েছে!');
    } catch {
      onNotify('লিংক কপি করা যায়নি।');
    }
  };

  return (
    <form onSubmit={onSave} className="mt-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A1A]">
              সোশ্যাল মিডিয়া শেয়ার সেটিংস (Facebook · WhatsApp · Messenger · X)
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              আপনার সাইটের লিংক সোশ্যাল মিডিয়ায় শেয়ার করলে যে কভার ইমেজ, শিরোনাম ও বিবরণ দেখাবে তা এখান থেকে নিয়ন্ত্রণ করুন। রেসিপি বা ব্লগ পোস্ট শেয়ার করলে অটোমেটিকভাবে সেই পোস্টের নিজস্ব থাম্বনেইল দেখাবে।
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs sm:text-sm font-bold cursor-pointer shrink-0 disabled:opacity-60"
        >
          {saving ? 'সংরক্ষণ হচ্ছে...' : 'শেয়ার সেটিংস সংরক্ষণ করুন'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Social Meta & Cover Image Controls */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-5">
          {/* Recipe Post Share Button ON/OFF Control */}
          <div className="rounded-xl border border-[#DCE6DC] bg-[#F8FAF8] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-[#1A1A1A]">
                  রেসিপি পোস্টে &quot;শেয়ার করুন&quot; অপশন
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    showRecipeShareButton
                      ? 'bg-[#1B4D24] text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {showRecipeShareButton ? 'চালু (ON)' : 'বন্ধ (OFF)'}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                প্রতিটি রেসিপি পোস্টের উপরে থাকা নতুন &quot;শেয়ার করুন&quot; বাটনটি দেখাবেন নাকি লুকিয়ে রাখবেন তা এখান থেকে অন/অফ করুন।
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={showRecipeShareButton}
              disabled={togglingRecipeShare}
              onClick={onToggleRecipeShareButton}
              className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 transition-colors disabled:opacity-60 ${
                showRecipeShareButton
                  ? 'bg-[#1B4D24] hover:bg-[#143A1B] text-white'
                  : 'bg-gray-700 hover:bg-gray-800 text-white'
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showRecipeShareButton ? 'bg-white/30' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    showRecipeShareButton ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </span>
              <span>
                {togglingRecipeShare
                  ? 'আপডেট হচ্ছে...'
                  : showRecipeShareButton
                    ? 'বন্ধ করুন (OFF)'
                    : 'চালু করুন (ON)'}
              </span>
            </button>
          </div>

          {/* Site Share Cover Image */}
          <div className="space-y-3 pb-5 border-b border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-[#1B4D24]" />
                <label className="text-sm font-bold text-[#1A1A1A]">
                  সাইটের মূল শেয়ার ইমেজ (১২০০×৬৩০ পিক্সেল প্রস্তাবিত)
                </label>
              </div>
              {socialShareImageUrl && (
                <button
                  type="button"
                  onClick={() => onChangeSocialShareImageUrl('')}
                  className="text-xs font-semibold text-[#B92B27] hover:underline cursor-pointer"
                >
                  ডিফল্ট ছবিতে ফিরুন
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>
                  {uploading ? 'ইমেজ প্রস্তুত হচ্ছে...' : 'ডিভাইস থেকে ইমেজ আপলোড করুন'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUploadImage}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-gray-500">
                JPG/PNG/WebP · অটো অপ্টিমাইজড (১৬:৯ বা ১.৯১:১ অনুপাত সেরা)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                অথবা ছবির সরাসরি HTTPS লিংক (Image URL)
              </label>
              <input
                type="text"
                value={socialShareImageUrl.startsWith('data:') ? '' : socialShareImageUrl}
                onChange={(e) => onChangeSocialShareImageUrl(e.target.value)}
                placeholder="https://example.com/my-banner.jpg (খালি রাখলে আপলোডকৃত বা ডিফল্ট ইমেজ থাকবে)"
                className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                শেয়ার ইমেজ Alt টেক্সট (og:image:alt)
              </label>
              <input
                type="text"
                maxLength={160}
                value={socialShareImageAlt}
                onChange={(e) => onChangeSocialShareImageAlt(e.target.value)}
                placeholder="রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম"
                className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          {/* OpenGraph Title & Description */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#1A1A1A]">
                সোশ্যাল মিডিয়া শেয়ার কার্ডের লেখা (OpenGraph ও Twitter Card)
              </h3>
              <button
                type="button"
                onClick={() => {
                  onChangeSocialShareTitle(seoTitle || DEFAULT_SEO_TITLE);
                  onChangeSocialShareDescription(seoDescription || DEFAULT_SEO_DESCRIPTION);
                  onNotify('SEO শিরোনাম ও বিবরণ থেকে কপি করা হয়েছে।');
                }}
                className="text-xs font-semibold text-[#1B4D24] hover:underline cursor-pointer"
              >
                SEO লেখা থেকে কপি করুন
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                শেয়ার শিরোনাম (og:title · সর্বোচ্চ ১২০ অক্ষর)
              </label>
              <input
                type="text"
                maxLength={120}
                value={socialShareTitle}
                onChange={(e) => onChangeSocialShareTitle(e.target.value)}
                placeholder={seoTitle || DEFAULT_SEO_TITLE}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                শেয়ার বিবরণ (og:description · সর্বোচ্চ ৩২০ অক্ষর)
              </label>
              <textarea
                rows={3}
                maxLength={320}
                value={socialShareDescription}
                onChange={(e) => onChangeSocialShareDescription(e.target.value)}
                placeholder={seoDescription || DEFAULT_SEO_DESCRIPTION}
                className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  X (Twitter) ইউজারনেম (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={twitterHandle}
                  onChange={(e) => onChangeTwitterHandle(e.target.value)}
                  placeholder="@rannashikhun"
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Facebook App ID (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={fbAppId}
                  onChange={(e) => onChangeFbAppId(e.target.value)}
                  placeholder="যেমন: 123456789012345"
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'শেয়ার সেটিংস সংরক্ষণ করুন'}
            </button>
          </div>
        </div>

        {/* Right Column: Live Social Link Preview & Recipe/Blog Thumbnail Tester */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#1A1A1A]">
                লাইভ সোশ্যাল মিডিয়া লিংক প্রিভিউ ও থাম্বনেইল পরীক্ষক
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                হোমপেজ অথবা যেকোনো রেসিপি/ব্লগ বেছে নিয়ে Facebook ও WhatsApp প্রিভিউ যাচাই করুন।
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                কোন লিংকের প্রিভিউ দেখবেন?
              </label>
              <select
                value={previewTarget}
                onChange={(e) => setPreviewTarget(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white"
              >
                <option value="home">মূল ওয়েবসাইট (হোমপেজ কভার ছবি)</option>
                <optgroup label="রেসিপি পোস্ট (নিজস্ব থাম্বনেইল)">
                  {recipes.map((r) => (
                    <option key={r.id} value={`recipe:${r.id}`}>
                      রেসিপি: {r.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="ব্লগ পোস্ট (নিজস্ব থাম্বনেইল)">
                  {blogPosts.map((b) => (
                    <option key={b.id} value={`blog:${b.id}`}>
                      ব্লগ: {b.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Simulated Facebook / Messenger / WhatsApp Large Link Card */}
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-xs">
              <div className="px-3 py-1.5 bg-[#F8FAF8] border-b border-gray-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#1B4D24]">
                  {previewData.badge}
                </span>
              </div>
              <div className="aspect-[1.91/1] bg-gray-100 overflow-hidden">
                <img
                  src={previewData.image}
                  alt={previewData.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3.5 bg-[#F2F3F5] border-t border-gray-200 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 truncate">
                  {hostLabel}
                </p>
                <p className="text-sm font-bold text-[#1A1A1A] line-clamp-2 leading-snug">
                  {previewData.title}
                </p>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {previewData.description}
                </p>
              </div>
            </div>

            {/* Share URL Bar & External Debuggers */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={previewData.url}
                  className="flex-1 px-3 py-2 text-[11px] font-mono bg-gray-50 border border-gray-200 rounded-xl text-gray-700"
                />
                <button
                  type="button"
                  onClick={handleCopyPreviewUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  কপি
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(previewData.url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EBF3FF] text-[#1877F2] text-xs font-bold hover:bg-[#DCEBFF]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Facebook Debugger-এ পরীক্ষা করুন
                </a>
                <a
                  href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(previewData.url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  LinkedIn Inspector
                </a>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#78350F] leading-relaxed">
              <strong>GitHub Pages-এ আপডেট নিয়ম:</strong> ছবি বা লেখা পরিবর্তন করে সংরক্ষণ করার পর GitHub রিপোজিটরির <strong>Actions → Deploy to GitHub Pages</strong> ওয়ার্কফ্লো রান করলে Facebook/WhatsApp ক্রলার সাথে সাথেই নতুন ছবি ও থাম্বনেইল দেখতে পাবে।
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

interface AdminSeoSettingsTabProps {
  siteName: string;
  seoTitle: string;
  onChangeSeoTitle: (v: string) => void;
  seoDescription: string;
  onChangeSeoDescription: (v: string) => void;
  seoKeywords: string;
  onChangeSeoKeywords: (v: string) => void;
  seoAuthor: string;
  onChangeSeoAuthor: (v: string) => void;
  canonicalBaseUrl: string;
  onChangeCanonicalBaseUrl: (v: string) => void;
  seoRobotsPolicy: 'index, follow' | 'noindex, nofollow';
  onChangeSeoRobotsPolicy: (v: 'index, follow' | 'noindex, nofollow') => void;
  googleSiteVerification: string;
  onChangeGoogleSiteVerification: (v: string) => void;
  googleVerificationFile: string;
  onChangeGoogleVerificationFile: (v: string) => void;
  bingSiteVerification: string;
  onChangeBingSiteVerification: (v: string) => void;
  googleAnalyticsId: string;
  onChangeGoogleAnalyticsId: (v: string) => void;
  robotsTxtExtra: string;
  onChangeRobotsTxtExtra: (v: string) => void;
  socialShareImageUrl: string;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  recipes: Recipe[];
  blogPosts: BlogPost[];
  tips: CookingTip[];
  categories: RecipeCategory[];
  onNotify: (msg: string) => void;
}

export const AdminSeoSettingsTab: React.FC<AdminSeoSettingsTabProps> = ({
  siteName,
  seoTitle,
  onChangeSeoTitle,
  seoDescription,
  onChangeSeoDescription,
  seoKeywords,
  onChangeSeoKeywords,
  seoAuthor,
  onChangeSeoAuthor,
  canonicalBaseUrl,
  onChangeCanonicalBaseUrl,
  seoRobotsPolicy,
  onChangeSeoRobotsPolicy,
  googleSiteVerification,
  onChangeGoogleSiteVerification,
  googleVerificationFile,
  onChangeGoogleVerificationFile,
  bingSiteVerification,
  onChangeBingSiteVerification,
  googleAnalyticsId,
  onChangeGoogleAnalyticsId,
  robotsTxtExtra,
  onChangeRobotsTxtExtra,
  socialShareImageUrl,
  onSave,
  saving,
  recipes,
  blogPosts,
  tips,
  categories,
  onNotify,
}) => {
  const [showSitemapPreview, setShowSitemapPreview] = useState(false);
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);

  const effectiveBaseUrl = useMemo(() => {
    const resolved = resolveEffectiveBaseUrl(canonicalBaseUrl);
    if (resolved) return resolved;
    return 'https://example.com';
  }, [canonicalBaseUrl]);

  const cleanGscCode = useMemo(
    () => extractGoogleVerificationCode(googleSiteVerification),
    [googleSiteVerification]
  );

  const cleanGscFile = useMemo(
    () => extractGoogleVerificationFilename(googleVerificationFile),
    [googleVerificationFile]
  );

  const sitemapUrl = `${effectiveBaseUrl.replace(/\/+$/, '')}/sitemap.xml`;
  const robotsUrl = `${effectiveBaseUrl.replace(/\/+$/, '')}/robots.txt`;

  const generatedSitemapXml = useMemo(
    () =>
      buildSitemapXml({
        baseUrl: effectiveBaseUrl,
        recipes,
        blogPosts,
        tips,
        categories,
      }),
    [effectiveBaseUrl, recipes, blogPosts, tips, categories]
  );

  const generatedRobotsTxt = useMemo(
    () =>
      buildRobotsTxt({
        baseUrl: effectiveBaseUrl,
        allowIndexing: seoRobotsPolicy !== 'noindex, nofollow',
        extraRules: robotsTxtExtra,
      }),
    [effectiveBaseUrl, seoRobotsPolicy, robotsTxtExtra]
  );

  const totalSitemapUrls =
    6 +
    categories.filter((c) => c.isActive).length +
    recipes.length +
    blogPosts.filter((b) => b.isPublished).length +
    tips.filter((t) => t.isPublished).length;

  const sampleSchemaJson = useMemo(
    () =>
      JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName || 'রান্না শিখুন',
          url: `${effectiveBaseUrl.replace(/\/+$/, '')}/`,
          description: seoDescription || DEFAULT_SEO_DESCRIPTION,
          inLanguage: 'bn',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${effectiveBaseUrl.replace(/\/+$/, '')}/recipes?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        null,
        2
      ),
    [siteName, effectiveBaseUrl, seoDescription]
  );

  const seoChecks = useMemo(() => {
    const titleLen = seoTitle.trim().length;
    const descLen = seoDescription.trim().length;
    return [
      {
        label: 'SEO শিরোনাম (৩০–৭০ অক্ষরের মধ্যে আদর্শ)',
        ok: titleLen >= 25 && titleLen <= 85,
        detail: `${titleLen} অক্ষর`,
      },
      {
        label: 'মেটা বিবরণ (১০০–১৮০ অক্ষরের মধ্যে আদর্শ)',
        ok: descLen >= 80 && descLen <= 220,
        detail: `${descLen} অক্ষর`,
      },
      {
        label: 'ফোকাস কীওয়ার্ড যুক্ত আছে',
        ok: seoKeywords.trim().length >= 5,
        detail: seoKeywords.trim() ? 'সেট করা হয়েছে' : 'খালি',
      },
      {
        label: 'Google Search Console ভেরিফিকেশন কোড/ফাইল',
        ok: Boolean(cleanGscCode || /^google[a-zA-Z0-9_-]+\.html$/i.test(cleanGscFile)),
        detail: cleanGscCode
          ? 'মেটা ট্যাগ যুক্ত'
          : cleanGscFile
            ? 'HTML ফাইল যুক্ত'
            : 'এখনো যুক্ত হয়নি',
      },
      {
        label: 'সার্চ ইঞ্জিন ইনডেক্সিং অনুমোদিত (index, follow)',
        ok: seoRobotsPolicy === 'index, follow',
        detail: seoRobotsPolicy,
      },
      {
        label: 'মূল ডোমেইন / Canonical URL নির্ধারিত',
        ok: Boolean(normalizeCanonicalBaseUrl(canonicalBaseUrl)),
        detail: normalizeCanonicalBaseUrl(canonicalBaseUrl) ? 'নির্ধারিত' : 'অটো ডিটেক্ট',
      },
      {
        label: 'সোশ্যাল শেয়ার কভার ইমেজ প্রস্তুত',
        ok: Boolean(resolveAbsoluteShareImage(socialShareImageUrl, canonicalBaseUrl)),
        detail: socialShareImageUrl ? 'কাস্টম ইমেজ' : 'ডিফল্ট কভার',
      },
    ];
  }, [
    seoTitle,
    seoDescription,
    seoKeywords,
    cleanGscCode,
    cleanGscFile,
    seoRobotsPolicy,
    canonicalBaseUrl,
    socialShareImageUrl,
  ]);

  const passedCount = seoChecks.filter((c) => c.ok).length;
  const seoScore = Math.round((passedCount / seoChecks.length) * 100);

  const handleCopyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(message);
    } catch {
      onNotify('কপি করা যায়নি।');
    }
  };

  return (
    <form onSubmit={onSave} className="mt-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A1A]">
              সম্পূর্ণ SEO ও Google Search Console সেটিংস
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              সার্চ ইঞ্জিনে সাইট র‍্যাংকিং, মেটা ট্যাগ, Canonical URL, Google Search Console ভেরিফিকেশন, Sitemap.xml, Robots.txt ও Schema.org সবকিছু এখান থেকে পরিচালনা করুন।
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs sm:text-sm font-bold cursor-pointer shrink-0 disabled:opacity-60"
        >
          {saving ? 'সংরক্ষণ হচ্ছে...' : 'SEO সেটিংস সংরক্ষণ করুন'}
        </button>
      </div>

      {/* Top Row: SEO Health Audit + Live Google SERP Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Google Search Result Snippet Preview (SERP) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#1B4D24]" />
              <h3 className="text-sm font-bold text-[#1A1A1A]">
                Google সার্চ রেজাল্ট প্রিভিউ (SERP Snippet)
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#EEF5EF] text-[#1B4D24] text-[11px] font-bold">
              লাইভ প্রিভিউ
            </span>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#FAFAFA] p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-[#202124]">
              <span className="w-6 h-6 rounded-full bg-[#1B4D24] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                র
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-xs text-[#202124] truncate">
                  {siteName || 'রান্না শিখুন'}
                </p>
                <p className="text-[11px] text-[#4D5156] truncate">
                  {effectiveBaseUrl}
                </p>
              </div>
            </div>
            <p className="text-base sm:text-lg font-medium text-[#1A0DAB] leading-snug pt-1">
              {seoTitle || DEFAULT_SEO_TITLE}
            </p>
            <p className="text-xs sm:text-[13px] text-[#4D5156] leading-relaxed line-clamp-2">
              {seoDescription || DEFAULT_SEO_DESCRIPTION}
            </p>
          </div>

          <p className="text-[11px] text-gray-500">
            প্রতিটি রেসিপি, ব্লগ পোস্ট, ক্যাটাগরি এবং রান্নার টিপসের জন্য অটোমেটিকভাবে আলাদা Title, Description ও Schema.org JSON-LD তৈরি হয়।
          </p>
        </div>

        {/* Live SEO Health Score & Checklist */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1B4D24]" />
              <h3 className="text-sm font-bold text-[#1A1A1A]">SEO স্বাস্থ্য ও প্রস্তুতি স্কোর</h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${
                seoScore >= 85
                  ? 'bg-[#EEF5EF] text-[#1B4D24]'
                  : seoScore >= 60
                    ? 'bg-[#FFFBEB] text-[#B45309]'
                    : 'bg-red-50 text-[#B92B27]'
              }`}
            >
              {seoScore}% প্রস্তুত
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#1B4D24] transition-all duration-300"
              style={{ width: `${seoScore}%` }}
            />
          </div>

          <div className="space-y-2 pt-1">
            {seoChecks.map((chk) => (
              <div
                key={chk.label}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {chk.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1B4D24] shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                  )}
                  <span className={chk.ok ? 'text-gray-700 truncate' : 'text-gray-900 font-semibold truncate'}>
                    {chk.label}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-gray-500 shrink-0">
                  {chk.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION A: On-Page & Technical SEO Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-[#1A1A1A] pb-3 border-b border-gray-100">
          ১. অন-পেজ ও টেকনিক্যাল SEO মেটা সেটিংস
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-xs font-semibold text-gray-700">
                মূল সাইটের SEO শিরোনাম (&lt;title&gt;)
              </label>
              <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                {seoTitle.length}/120 অক্ষর
              </span>
            </div>
            <input
              type="text"
              maxLength={120}
              value={seoTitle}
              onChange={(e) => onChangeSeoTitle(e.target.value)}
              placeholder={DEFAULT_SEO_TITLE}
              className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              সাইটের লেখক / প্রকাশক (meta author)
            </label>
            <input
              type="text"
              maxLength={100}
              value={seoAuthor}
              onChange={(e) => onChangeSeoAuthor(e.target.value)}
              placeholder={siteName || 'রান্না শিখুন'}
              className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-xs font-semibold text-gray-700">
              মেটা বিবরণ (Meta Description — ১২০–১৬০ অক্ষর প্রস্তাবিত)
            </label>
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
              {seoDescription.length}/320 অক্ষর
            </span>
          </div>
          <textarea
            rows={2}
            maxLength={320}
            value={seoDescription}
            onChange={(e) => onChangeSeoDescription(e.target.value)}
            placeholder={DEFAULT_SEO_DESCRIPTION}
            className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            SEO ফোকাস কীওয়ার্ড (কমা দিয়ে আলাদা করুন)
          </label>
          <input
            type="text"
            maxLength={500}
            value={seoKeywords}
            onChange={(e) => onChangeSeoKeywords(e.target.value)}
            placeholder={DEFAULT_SEO_KEYWORDS}
            className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-xs font-semibold text-gray-700">
                সাইটের স্থায়ী ডোমেইন / Canonical Base URL
              </label>
              {typeof window !== 'undefined' && (
                <button
                  type="button"
                  onClick={() => {
                    const current = `${window.location.origin}${withAppBase('/').replace(/\/+$/, '')}`;
                    onChangeCanonicalBaseUrl(current);
                    onNotify('বর্তমান সাইটের URL বসানো হয়েছে।');
                  }}
                  className="text-[11px] font-bold text-[#1B4D24] hover:underline cursor-pointer"
                >
                  বর্তমান URL বসান
                </button>
              )}
            </div>
            <input
              type="text"
              maxLength={200}
              value={canonicalBaseUrl}
              onChange={(e) => onChangeCanonicalBaseUrl(e.target.value)}
              placeholder="https://username.github.io/ranna-shikhun অথবা https://rannashikhun.com"
              className="w-full px-3.5 py-2 text-xs font-mono border border-gray-200 rounded-xl"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              কাস্টম ডোমেইন বা GitHub Pages URL দিলে Sitemap ও Canonical লিংক ১০০% নিখুঁত থাকে।
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              সার্চ ইঞ্জিন ক্রলার / ইনডেক্স নীতি (meta robots)
            </label>
            <select
              value={seoRobotsPolicy}
              onChange={(e) =>
                onChangeSeoRobotsPolicy(e.target.value as 'index, follow' | 'noindex, nofollow')
              }
              className="w-full px-3.5 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white"
            >
              <option value="index, follow">
                index, follow (সার্চ ইঞ্জিনে সব পাবলিক পেজ দেখান — প্রস্তাবিত)
              </option>
              <option value="noindex, nofollow">
                noindex, nofollow (সার্চ ইঞ্জিন থেকে আপাতত লুকিয়ে রাখুন)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION B: Google Search Console Verification & Webmaster Tools */}
      <div className="bg-white rounded-2xl border border-[#1B4D24]/30 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#1B4D24]">
              ২. Google Search Console ও Webmaster ভেরিফিকেশন
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Google Search Console-এ আপনার সাইট যোগ ও মালিকানা যাচাই (Verify Ownership) করতে নিচের যেকোনো একটি পদ্ধতি ব্যবহার করুন।
            </p>
          </div>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold shrink-0 self-start"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Google Search Console খুলুন
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Method 1: HTML Meta Tag */}
          <div className="p-4 rounded-xl bg-[#F8FAF8] border border-[#DCE6DC] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1B4D24]">
                পদ্ধতি ১: HTML Tag (মেটা ট্যাগ — সবচেয়ে সহজ)
              </span>
              {cleanGscCode && (
                <span className="px-2 py-0.5 rounded-full bg-[#1B4D24] text-white text-[10px] font-bold">
                  সক্রিয়
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Google ভেরিফিকেশন কোড অথবা পুরো &lt;meta&gt; ট্যাগ পেস্ট করুন
              </label>
              <input
                type="text"
                maxLength={140}
                value={googleSiteVerification}
                onChange={(e) => {
                  const extracted = extractGoogleVerificationCode(e.target.value);
                  onChangeGoogleSiteVerification(extracted);
                }}
                placeholder='যেমন: abc123XYZ... অথবা <meta name="google-site-verification" content="..." />'
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl bg-white"
              />
            </div>
            {cleanGscCode && (
              <div className="p-2.5 rounded-lg bg-white border border-gray-200 text-[11px] font-mono text-gray-700 break-all">
                &lt;meta name=&quot;google-site-verification&quot; content=&quot;{cleanGscCode}&quot; /&gt;
              </div>
            )}
          </div>

          {/* Method 2: HTML File Verification */}
          <div className="p-4 rounded-xl bg-[#F8FAF8] border border-[#DCE6DC] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1B4D24]">
                পদ্ধতি ২: HTML File ভেরিফিকেশন (googleXXXX.html)
              </span>
              {/^google[a-zA-Z0-9_-]+\.html$/i.test(cleanGscFile) && (
                <span className="px-2 py-0.5 rounded-full bg-[#1B4D24] text-white text-[10px] font-bold">
                  সক্রিয়
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Google HTML ফাইলের নাম লিখুন
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={120}
                  value={googleVerificationFile}
                  onChange={(e) => onChangeGoogleVerificationFile(e.target.value)}
                  placeholder="যেমন: google1a2b3c4d5e6f7a8b.html"
                  className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl bg-white"
                />
                {/^google[a-zA-Z0-9_-]+\.html$/i.test(cleanGscFile) && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        cleanGscFile,
                        `google-site-verification: ${cleanGscFile}`,
                        'text/html;charset=utf-8'
                      )
                    }
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ডাউনলোড
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                ফাইলের নাম সংরক্ষণ করে GitHub Pages-এ বিল্ড করলেই রুটে <code>/{cleanGscFile || 'googleXXXX.html'}</code> অটো তৈরি হয়ে যাবে।
              </p>
            </div>
          </div>
        </div>

        {/* Bing & GA4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bing Webmaster ভেরিফিকেশন কোড (msvalidate.01 · ঐচ্ছিক)
            </label>
            <input
              type="text"
              maxLength={140}
              value={bingSiteVerification}
              onChange={(e) => onChangeBingSiteVerification(e.target.value)}
              placeholder="যেমন: 9A8B7C6D5E4F..."
              className="w-full px-3.5 py-2 text-xs font-mono border border-gray-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Google Analytics 4 Measurement ID (ঐচ্ছিক)
            </label>
            <input
              type="text"
              maxLength={40}
              value={googleAnalyticsId}
              onChange={(e) => onChangeGoogleAnalyticsId(e.target.value)}
              placeholder="যেমন: G-XXXXXXXXXX"
              className="w-full px-3.5 py-2 text-xs font-mono border border-gray-200 rounded-xl"
            />
          </div>
        </div>

        {/* Step-by-Step Google Search Console Connection Guide */}
        <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
          <p className="text-xs font-bold text-[#92400E]">
            Google Search Console-এ সাইট যোগ করার ৪টি সহজ ধাপ:
          </p>
          <ol className="list-decimal list-inside text-xs text-[#78350F] space-y-1 leading-relaxed">
            <li>
              <strong>Google Search Console</strong> ওপেন করে <strong>Add Property → URL prefix</strong>-এ আপনার সাইটের মূল URL (<code>{effectiveBaseUrl}/</code>) দিন।
            </li>
            <li>
              ভেরিফিকেশন পদ্ধতি হিসেবে <strong>HTML tag</strong> বা <strong>HTML file</strong> বেছে নিয়ে কোড বা ফাইলের নাম উপরের বক্সে বসিয়ে <strong>SEO সেটিংস সংরক্ষণ করুন</strong>।
            </li>
            <li>
              GitHub Pages-এ আপডেট লাইভ করতে GitHub রিপোজিটরির <strong>Actions → Deploy to GitHub Pages</strong> রান করুন, তারপর Google-এ গিয়ে <strong>Verify</strong> চাপুন।
            </li>
            <li>
              ভেরিফাই হওয়ার পর Search Console-এর বাম পাশের মেনু থেকে <strong>Sitemaps</strong>-এ গিয়ে <code>sitemap.xml</code> জমা দিন।
            </li>
          </ol>
        </div>
      </div>

      {/* SECTION C: Sitemap.xml, Robots.txt & Schema.org JSON-LD */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#1B4D24]" />
            <h3 className="text-base font-bold text-[#1A1A1A]">
              ৩. Sitemap.xml, Robots.txt এবং Schema.org স্ট্রাকচার্ড ডেটা
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#EEF5EF] text-[#1B4D24] text-xs font-bold tabular-nums">
            মোট {totalSitemapUrls}টি URL অন্তর্ভুক্ত
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sitemap Box */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3">
            <p className="text-xs font-bold text-[#1A1A1A]">
              স্বয়ংক্রিয় XML Sitemap (গুগলে সাবমিট করার জন্য)
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={sitemapUrl}
                className="flex-1 px-3 py-1.5 text-[11px] font-mono bg-white border border-gray-200 rounded-lg text-gray-700"
              />
              <button
                type="button"
                onClick={() => handleCopyText(sitemapUrl, 'Sitemap URL কপি করা হয়েছে!')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-xs font-bold text-gray-700 cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                কপি
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadTextFile('sitemap.xml', generatedSitemapXml, 'application/xml;charset=utf-8')
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4D24] text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                sitemap.xml ডাউনলোড
              </button>
              <button
                type="button"
                onClick={() => setShowSitemapPreview((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" />
                {showSitemapPreview ? 'XML লুকান' : 'XML কোড দেখুন'}
              </button>
            </div>
            {showSitemapPreview && (
              <pre className="p-3 rounded-lg bg-gray-900 text-gray-100 text-[10px] font-mono overflow-x-auto max-h-52">
                {generatedSitemapXml}
              </pre>
            )}
          </div>

          {/* Robots.txt Box */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#1A1A1A]">robots.txt কনফিগারেশন</p>
              <button
                type="button"
                onClick={() => handleCopyText(robotsUrl, 'robots.txt URL কপি করা হয়েছে!')}
                className="text-[11px] font-bold text-[#1B4D24] hover:underline cursor-pointer"
              >
                URL কপি করুন
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                অতিরিক্ত কাস্টম Robots ডাইরেক্টিভ (ঐচ্ছিক)
              </label>
              <textarea
                rows={2}
                maxLength={800}
                value={robotsTxtExtra}
                onChange={(e) => onChangeRobotsTxtExtra(e.target.value)}
                placeholder="যেমন: Disallow: /private-drafts"
                className="w-full px-3 py-1.5 text-xs font-mono border border-gray-200 rounded-lg bg-white"
              />
            </div>
            <pre className="p-3 rounded-lg bg-white border border-gray-200 text-[11px] font-mono text-gray-700 overflow-x-auto">
              {generatedRobotsTxt}
            </pre>
            <button
              type="button"
              onClick={() =>
                downloadTextFile('robots.txt', generatedRobotsTxt, 'text/plain;charset=utf-8')
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              robots.txt ডাউনলোড
            </button>
          </div>
        </div>

        {/* Schema.org Structured Data */}
        <div className="p-4 rounded-xl border border-gray-200 bg-[#F8FAF8] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#1B4D24]">
                Schema.org রিচ রেজাল্ট (JSON-LD) স্বয়ংক্রিয়ভাবে যুক্ত
              </p>
              <p className="text-[11px] text-gray-600">
                WebSite + SearchAction, Recipe (রেটিং ও রান্নার সময়সহ), BlogPosting ও HowTo স্কিমা সব পেজে অটো এমবেড থাকে।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSchemaPreview((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              {showSchemaPreview ? 'JSON-LD লুকান' : 'JSON-LD প্রিভিউ দেখুন'}
            </button>
          </div>
          {showSchemaPreview && (
            <pre className="p-3 rounded-lg bg-gray-900 text-gray-100 text-[11px] font-mono overflow-x-auto">
              {sampleSchemaJson}
            </pre>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer disabled:opacity-60"
        >
          {saving ? 'সংরক্ষণ হচ্ছে...' : 'SEO সেটিংস সংরক্ষণ করুন'}
        </button>
      </div>
    </form>
  );
};
