import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileJson,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  downloadBackupJsonFile,
  exportSiteContentBackup,
  parseBackupJsonFile,
  restoreSiteContentBackup,
  type BackupExportProgress,
  type BackupRestoreMode,
  type BackupRestoreProgress,
  type BackupRestoreResult,
  type ParsedBackupPreview,
} from '../services/backupService';
import type { BlogPost, CookingTip, Recipe, RecipeCategory, SiteSettings } from '../types';

interface AdminBackupTabProps {
  recipes: Recipe[];
  blogPosts: BlogPost[];
  tips: CookingTip[];
  categories: RecipeCategory[];
  siteSettings: SiteSettings;
  onNotify: (msg: string) => void;
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

function formatFileSizeBn(bytes: number): string {
  if (bytes < 1024) return `${toBengaliDigits(bytes)} বাইট`;
  if (bytes < 1024 * 1024) return `${toBengaliDigits((bytes / 1024).toFixed(1))} KB`;
  return `${toBengaliDigits((bytes / (1024 * 1024)).toFixed(2))} MB`;
}

function formatDateBn(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AdminBackupTab: React.FC<AdminBackupTabProps> = ({
  recipes,
  blogPosts,
  tips,
  categories,
  siteSettings,
  onNotify,
}) => {
  // Export state
  const [expRecipes, setExpRecipes] = useState(true);
  const [expBlogs, setExpBlogs] = useState(true);
  const [expTips, setExpTips] = useState(true);
  const [expCategories, setExpCategories] = useState(true);
  const [expEmbedImages, setExpEmbedImages] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<BackupExportProgress | null>(null);
  const [lastExportInfo, setLastExportInfo] = useState<{
    filename: string;
    sizeBytes: number;
    recipes: number;
    blogPosts: number;
    tips: number;
    categories: number;
    embeddedImages: number;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import / Restore state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputId = 'admin-content-backup-file-input';
  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedBackupPreview | null>(null);

  const [impRecipes, setImpRecipes] = useState(true);
  const [impBlogs, setImpBlogs] = useState(true);
  const [impTips, setImpTips] = useState(true);
  const [impCategories, setImpCategories] = useState(true);
  const [restoreMode, setRestoreMode] = useState<BackupRestoreMode>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);

  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<BackupRestoreProgress | null>(null);
  const [restoreResult, setRestoreResult] = useState<BackupRestoreResult | null>(null);

  const nothingSelectedForExport = !expRecipes && !expBlogs && !expTips && !expCategories;

  const handleExportBackup = async () => {
    if (nothingSelectedForExport) {
      setExportError('অনুগ্রহ করে ব্যাকআপ নেওয়ার জন্য অন্তত একটি কনটেন্ট ধরন নির্বাচন করুন।');
      return;
    }

    setExportError(null);
    setExporting(true);
    setExportProgress({ stage: 'ব্যাকআপ প্রস্তুত করা হচ্ছে...', completed: 0, total: 1 });

    try {
      const backup = await exportSiteContentBackup(
        {
          includeRecipes: expRecipes,
          includeBlogs: expBlogs,
          includeTips: expTips,
          includeCategories: expCategories,
          embedImages: expEmbedImages,
          siteName: siteSettings.siteName,
        },
        (progress) => setExportProgress(progress)
      );

      const { filename, sizeBytes } = downloadBackupJsonFile(backup);
      setLastExportInfo({
        filename,
        sizeBytes,
        recipes: backup.counts.recipes,
        blogPosts: backup.counts.blogPosts,
        tips: backup.counts.tips,
        categories: backup.counts.categories,
        embeddedImages: backup.counts.embeddedImages,
      });
      onNotify(
        `সফলভাবে ব্যাকআপ ডাউনলোড হয়েছে! (${toBengaliDigits(backup.counts.recipes)} রেসিপি, ${toBengaliDigits(backup.counts.blogPosts)} ব্লগ, ${toBengaliDigits(backup.counts.tips)} টিপস)`
      );
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : 'ব্যাকআপ তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
      );
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setParseError(null);
    setRestoreResult(null);
    setConfirmReplace(false);
    setParsingFile(true);
    try {
      const parsed = await parseBackupJsonFile(file);
      setPreview(parsed);
      setImpRecipes(parsed.backup.recipes.length > 0);
      setImpBlogs(parsed.backup.blogPosts.length > 0);
      setImpTips(parsed.backup.tips.length > 0);
      setImpCategories(parsed.backup.categories.length > 0);
    } catch (err) {
      setPreview(null);
      setParseError(
        err instanceof Error ? err.message : 'ফাইলটি পড়া যায়নি। সঠিক .json ব্যাকআপ ফাইল দিন।'
      );
    } finally {
      setParsingFile(false);
    }
  };

  const handleClearPreview = () => {
    setPreview(null);
    setParseError(null);
    setRestoreResult(null);
    setConfirmReplace(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const nothingSelectedForImport =
    !preview ||
    ((!impRecipes || preview.backup.recipes.length === 0) &&
      (!impBlogs || preview.backup.blogPosts.length === 0) &&
      (!impTips || preview.backup.tips.length === 0) &&
      (!impCategories || preview.backup.categories.length === 0));

  const handleRestoreBackup = async () => {
    if (!preview || nothingSelectedForImport) return;
    if (restoreMode === 'replace' && !confirmReplace) return;

    setRestoring(true);
    setRestoreResult(null);
    setRestoreProgress({ stage: 'ব্যাকআপ রিস্টোর শুরু হচ্ছে...', completed: 0, total: 1 });

    try {
      const res = await restoreSiteContentBackup(
        preview.backup,
        {
          restoreRecipes: impRecipes,
          restoreBlogs: impBlogs,
          restoreTips: impTips,
          restoreCategories: impCategories,
          mode: restoreMode,
        },
        (progress) => setRestoreProgress(progress)
      );
      setRestoreResult(res);

      const totalRestored =
        res.recipes.created +
        res.recipes.updated +
        res.blogPosts.created +
        res.blogPosts.updated +
        res.tips.created +
        res.tips.updated +
        res.categories.created +
        res.categories.updated;

      if (res.errors.length === 0) {
        onNotify(`সফলভাবে ${toBengaliDigits(totalRestored)}টি কনটেন্ট ব্যাকআপ থেকে রিস্টোর হয়েছে!`);
      } else {
        onNotify(
          `রিস্টোর সম্পন্ন হয়েছে (${toBengaliDigits(totalRestored)}টি সফল, ${toBengaliDigits(res.errors.length)}টি ত্রুটি)।`
        );
      }
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'রিস্টোর প্রক্রিয়ায় সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  const exportPercent =
    exportProgress && exportProgress.total > 0
      ? Math.min(100, Math.round((exportProgress.completed / exportProgress.total) * 100))
      : 0;

  const restorePercent =
    restoreProgress && restoreProgress.total > 0
      ? Math.min(100, Math.round((restoreProgress.completed / restoreProgress.total) * 100))
      : 0;

  return (
    <div className="mt-6 space-y-6">
      {/* Intro Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display-bn text-lg sm:text-xl font-bold text-[#1A1A1A]">
                কনটেন্ট ব্যাকআপ ও রিস্টোর সেন্টার
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                আপনার সাইটের সকল <strong>রেসিপি (উপকরণ, ধাপ, কভার ও ধাপের ছবি)</strong>,{' '}
                <strong>ব্লগ (লেখা ও ছবি)</strong>, <strong>রান্নার টিপস</strong> এবং{' '}
                <strong>ক্যাটাগরি</strong> এক ক্লিকে সম্পূর্ণ ব্যাকআপ ফাইল হিসেবে সংরক্ষণ করুন এবং প্রয়োজনে যেকোনো সময় পুনরায় ইনপুট করে ফিরিয়ে আনুন।
              </p>
            </div>
          </div>
        </div>

        {/* Live Content Counts */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#FAFAF8] border border-gray-200/80 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>মোট রেসিপি</span>
              <UtensilsCrossed className="w-4 h-4 text-[#1B4D24]" />
            </div>
            <p className="mt-1.5 text-xl font-bold text-[#1A1A1A] tabular-nums">
              {toBengaliDigits(recipes.length)} টি
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">লেখা + কভার ও ধাপের ছবি</p>
          </div>

          <div className="rounded-xl bg-[#FAFAF8] border border-gray-200/80 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>মোট ব্লগ</span>
              <BookOpen className="w-4 h-4 text-[#B92B27]" />
            </div>
            <p className="mt-1.5 text-xl font-bold text-[#1A1A1A] tabular-nums">
              {toBengaliDigits(blogPosts.length)} টি
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">লেখা + ব্লগ ছবি</p>
          </div>

          <div className="rounded-xl bg-[#FAFAF8] border border-gray-200/80 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>রান্নার টিপস</span>
              <ShieldCheck className="w-4 h-4 text-[#C69214]" />
            </div>
            <p className="mt-1.5 text-xl font-bold text-[#1A1A1A] tabular-nums">
              {toBengaliDigits(tips.length)} টি
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">সম্পূর্ণ টিপস ও কৌশল</p>
          </div>

          <div className="rounded-xl bg-[#FAFAF8] border border-gray-200/80 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>ক্যাটাগরি</span>
              <LayoutGrid className="w-4 h-4 text-[#1B4D24]" />
            </div>
            <p className="mt-1.5 text-xl font-bold text-[#1A1A1A] tabular-nums">
              {toBengaliDigits(categories.length)} টি
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">নাম + আইকন/ছবি</p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout: Left = Backup (Export), Right = Restore (Import) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: EXPORT BACKUP */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#1B4D24] text-white flex items-center justify-center shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  ১. সম্পূর্ণ ব্যাকআপ ডাউনলোড করুন
                </h3>
                <p className="text-xs text-gray-500">
                  সব কনটেন্ট ও ছবি একটি নিরাপদ JSON ফাইলে সেভ করে রাখুন
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-bold text-gray-700">কোন কোন কনটেন্ট ব্যাকআপ নেবেন:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 bg-[#FAFAF8] hover:border-[#1B4D24]/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={expRecipes}
                    onChange={(e) => setExpRecipes(e.target.checked)}
                    disabled={exporting}
                    className="w-4 h-4 accent-[#1B4D24] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1A1A1A]">
                      সকল রেসিপি ({toBengaliDigits(recipes.length)})
                    </p>
                    <p className="text-[11px] text-gray-500">লেখা, উপকরণ, ধাপ ও সব ছবি</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 bg-[#FAFAF8] hover:border-[#1B4D24]/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={expBlogs}
                    onChange={(e) => setExpBlogs(e.target.checked)}
                    disabled={exporting}
                    className="w-4 h-4 accent-[#1B4D24] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1A1A1A]">
                      সকল ব্লগ ({toBengaliDigits(blogPosts.length)})
                    </p>
                    <p className="text-[11px] text-gray-500">সম্পূর্ণ আর্টিকেল ও ছবি</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 bg-[#FAFAF8] hover:border-[#1B4D24]/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={expTips}
                    onChange={(e) => setExpTips(e.target.checked)}
                    disabled={exporting}
                    className="w-4 h-4 accent-[#1B4D24] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1A1A1A]">
                      সকল টিপস ({toBengaliDigits(tips.length)})
                    </p>
                    <p className="text-[11px] text-gray-500">রান্নার টিপস ও কৌশল</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 bg-[#FAFAF8] hover:border-[#1B4D24]/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={expCategories}
                    onChange={(e) => setExpCategories(e.target.checked)}
                    disabled={exporting}
                    className="w-4 h-4 accent-[#1B4D24] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1A1A1A]">
                      ক্যাটাগরি ({toBengaliDigits(categories.length)})
                    </p>
                    <p className="text-[11px] text-gray-500">ক্যাটাগরির নাম ও আইকন ছবি</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Embed Images Option */}
            <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#EEF6EF] border border-[#1B4D24]/20 cursor-pointer">
              <input
                type="checkbox"
                checked={expEmbedImages}
                onChange={(e) => setExpEmbedImages(e.target.checked)}
                disabled={exporting}
                className="w-4 h-4 mt-0.5 accent-[#1B4D24] shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#1B4D24] inline-flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>সকল ছবি ব্যাকআপ ফাইলের ভেতর সংযুক্ত (Embed) রাখুন</span>
                </p>
                <p className="text-[11px] text-[#2F5235] mt-0.5 leading-relaxed">
                  চালু থাকলে আপলোড করা ছবি ও সাইটের ছবি সরাসরি ব্যাকআপ ফাইলের ভেতর সংরক্ষিত থাকবে, ফলে ভবিষ্যতে অফলাইন থেকেও ছবি সহ রিস্টোর করা যাবে।
                </p>
              </div>
            </label>

            {exportProgress && (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#1B4D24]">
                  <span className="truncate">{exportProgress.stage}</span>
                  <span className="tabular-nums shrink-0">{toBengaliDigits(exportPercent)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-[#1B4D24] rounded-full transition-all duration-200"
                    style={{ width: `${exportPercent}%` }}
                  />
                </div>
              </div>
            )}

            {exportError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {exportError}
              </div>
            )}

            {lastExportInfo && !exporting && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1B4D24]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>ব্যাকআপ ফাইল সফলভাবে ডাউনলোড হয়েছে!</span>
                </div>
                <p className="text-[11px] text-emerald-900 break-all">
                  ফাইল: <strong>{lastExportInfo.filename}</strong> ({formatFileSizeBn(lastExportInfo.sizeBytes)})
                </p>
                <p className="text-[11px] text-emerald-800">
                  রেসিপি: {toBengaliDigits(lastExportInfo.recipes)} · ব্লগ:{' '}
                  {toBengaliDigits(lastExportInfo.blogPosts)} · টিপস:{' '}
                  {toBengaliDigits(lastExportInfo.tips)} · ক্যাটাগরি:{' '}
                  {toBengaliDigits(lastExportInfo.categories)} · সংযুক্ত ছবি:{' '}
                  {toBengaliDigits(lastExportInfo.embeddedImages)} টি
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={exporting || nothingSelectedForExport}
            onClick={handleExportBackup}
            className="w-full py-3 px-4 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] disabled:opacity-55 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>ব্যাকআপ তৈরি হচ্ছে...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>সম্পূর্ণ ব্যাকআপ ডাউনলোড করুন (.json)</span>
              </>
            )}
          </button>
        </div>

        {/* CARD 2: IMPORT / RESTORE BACKUP */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#B92B27] text-white flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  ২. ব্যাকআপ ফাইল ইনপুট / রিস্টোর করুন
                </h3>
                <p className="text-xs text-gray-500">
                  আগে ডাউনলোড করা ব্যাকআপ (.json) ফাইল আপলোড করে কনটেন্ট ফিরিয়ে আনুন
                </p>
              </div>
            </div>

            {/* File Picker */}
            <div>
              <input
                id={backupFileInputId}
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelectBackupFile}
                disabled={restoring || parsingFile}
                className="sr-only"
              />
              <label
                htmlFor={backupFileInputId}
                className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed text-center transition-colors ${
                  restoring || parsingFile
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    : 'border-[#1B4D24]/35 bg-[#F8FBF8] hover:bg-[#EEF6EF] hover:border-[#1B4D24]/60 cursor-pointer'
                }`}
              >
                {parsingFile ? (
                  <Loader2 className="w-7 h-7 text-[#1B4D24] animate-spin" />
                ) : (
                  <FileJson className="w-7 h-7 text-[#1B4D24]" />
                )}
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
                    {parsingFile
                      ? 'ব্যাকআপ ফাইল যাচাই করা হচ্ছে...'
                      : preview
                        ? 'অন্য ব্যাকআপ ফাইল নির্বাচন করুন (.json)'
                        : 'ব্যাকআপ ফাইল নির্বাচন করুন (.json)'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    মোবাইল বা কম্পিউটার থেকে সংরক্ষিত ব্যাকআপ ফাইল বাছাই করুন
                  </p>
                </div>
              </label>
            </div>

            {parseError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {parseError}
              </div>
            )}

            {/* Parsed Backup Preview & Restore Controls */}
            {preview && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-gray-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1A1A1A] break-all">
                        ফাইল: {preview.fileName}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        সাইজ: {formatFileSizeBn(preview.fileSizeBytes)} · তৈরির সময়:{' '}
                        {formatDateBn(preview.backup.exportedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={handleClearPreview}
                      aria-label="ফাইল সরান"
                      className="w-7 h-7 rounded-lg hover:bg-gray-200/70 text-gray-500 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-semibold">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[#1B4D24]">
                      রেসিপি: {toBengaliDigits(preview.backup.recipes.length)} টি
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[#B92B27]">
                      ব্লগ: {toBengaliDigits(preview.backup.blogPosts.length)} টি
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[#9A6E04]">
                      টিপস: {toBengaliDigits(preview.backup.tips.length)} টি
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-700">
                      ক্যাটাগরি: {toBengaliDigits(preview.backup.categories.length)} টি
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                      সংযুক্ত ছবি: {toBengaliDigits(preview.embeddedImageCount)} টি
                    </span>
                  </div>
                </div>

                {/* Section selection for import */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-700">ফাইল থেকে কী কী ইনপুট করবেন:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-white cursor-pointer text-xs font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        checked={impRecipes && preview.backup.recipes.length > 0}
                        disabled={restoring || preview.backup.recipes.length === 0}
                        onChange={(e) => setImpRecipes(e.target.checked)}
                        className="w-4 h-4 accent-[#1B4D24]"
                      />
                      <span>রেসিপি ({toBengaliDigits(preview.backup.recipes.length)})</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-white cursor-pointer text-xs font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        checked={impBlogs && preview.backup.blogPosts.length > 0}
                        disabled={restoring || preview.backup.blogPosts.length === 0}
                        onChange={(e) => setImpBlogs(e.target.checked)}
                        className="w-4 h-4 accent-[#1B4D24]"
                      />
                      <span>ব্লগ ({toBengaliDigits(preview.backup.blogPosts.length)})</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-white cursor-pointer text-xs font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        checked={impTips && preview.backup.tips.length > 0}
                        disabled={restoring || preview.backup.tips.length === 0}
                        onChange={(e) => setImpTips(e.target.checked)}
                        className="w-4 h-4 accent-[#1B4D24]"
                      />
                      <span>টিপস ({toBengaliDigits(preview.backup.tips.length)})</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-white cursor-pointer text-xs font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        checked={impCategories && preview.backup.categories.length > 0}
                        disabled={restoring || preview.backup.categories.length === 0}
                        onChange={(e) => setImpCategories(e.target.checked)}
                        className="w-4 h-4 accent-[#1B4D24]"
                      />
                      <span>ক্যাটাগরি ({toBengaliDigits(preview.backup.categories.length)})</span>
                    </label>
                  </div>
                </div>

                {/* Restore Mode Selector */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-700">ইনপুট / রিস্টোর পদ্ধতি:</p>
                  <div className="space-y-1.5">
                    <label
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        restoreMode === 'merge'
                          ? 'border-[#1B4D24] bg-[#F4F8F4]'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="merge"
                        checked={restoreMode === 'merge'}
                        disabled={restoring}
                        onChange={() => {
                          setRestoreMode('merge');
                          setConfirmReplace(false);
                        }}
                        className="mt-0.5 accent-[#1B4D24]"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#1A1A1A]">
                          মার্জ ও আপডেট করুন (প্রস্তাবিত)
                        </p>
                        <p className="text-[11px] text-gray-600">
                          বর্তমান কনটেন্ট রেখে ব্যাকআপের নতুনগুলো যোগ করবে এবং একই আইডি থাকলে আপডেট করবে।
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        restoreMode === 'add-missing'
                          ? 'border-[#1B4D24] bg-[#F4F8F4]'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="add-missing"
                        checked={restoreMode === 'add-missing'}
                        disabled={restoring}
                        onChange={() => {
                          setRestoreMode('add-missing');
                          setConfirmReplace(false);
                        }}
                        className="mt-0.5 accent-[#1B4D24]"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#1A1A1A]">
                          শুধুমাত্র অনুপস্থিতগুলো যোগ করুন
                        </p>
                        <p className="text-[11px] text-gray-600">
                          আগে থেকে থাকা কনটেন্টে কোনো পরিবর্তন করবে না, শুধু মুছে যাওয়া বা নতুনগুলো যোগ করবে।
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        restoreMode === 'replace'
                          ? 'border-[#B92B27] bg-red-50/70'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="replace"
                        checked={restoreMode === 'replace'}
                        disabled={restoring}
                        onChange={() => setRestoreMode('replace')}
                        className="mt-0.5 accent-[#B92B27]"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#B92B27]">
                          সম্পূর্ণ রিপ্লেস করুন (সতর্কতা)
                        </p>
                        <p className="text-[11px] text-gray-600">
                          নির্বাচিত সেকশনের বর্তমান সব কনটেন্ট মুছে ব্যাকআপ ফাইল থেকে নতুন করে বসাবে।
                        </p>
                      </div>
                    </label>
                  </div>

                  {restoreMode === 'replace' && (
                    <label className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmReplace}
                        disabled={restoring}
                        onChange={(e) => setConfirmReplace(e.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-[#B92B27] shrink-0"
                      />
                      <span className="leading-relaxed">
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-700" />
                        আমি নিশ্চিত যে নির্বাচিত সেকশনের বর্তমান কনটেন্ট মুছে এই ব্যাকআপ ফাইল দিয়ে প্রতিস্থাপন করতে চাই।
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {restoreProgress && (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#1B4D24]">
                  <span className="truncate">{restoreProgress.stage}</span>
                  <span className="tabular-nums shrink-0">{toBengaliDigits(restorePercent)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-[#1B4D24] rounded-full transition-all duration-200"
                    style={{ width: `${restorePercent}%` }}
                  />
                </div>
              </div>
            )}

            {restoreResult && !restoring && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1B4D24]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>ব্যাকআপ রিস্টোর সম্পন্ন হয়েছে!</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-emerald-950">
                  <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-emerald-200/70">
                    <strong>রেসিপি:</strong> নতুন {toBengaliDigits(restoreResult.recipes.created)},
                    আপডেট {toBengaliDigits(restoreResult.recipes.updated)}
                    {restoreResult.recipes.skipped > 0
                      ? `, বাদ ${toBengaliDigits(restoreResult.recipes.skipped)}`
                      : ''}
                  </div>
                  <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-emerald-200/70">
                    <strong>ব্লগ:</strong> নতুন {toBengaliDigits(restoreResult.blogPosts.created)},
                    আপডেট {toBengaliDigits(restoreResult.blogPosts.updated)}
                    {restoreResult.blogPosts.skipped > 0
                      ? `, বাদ ${toBengaliDigits(restoreResult.blogPosts.skipped)}`
                      : ''}
                  </div>
                  <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-emerald-200/70">
                    <strong>টিপস:</strong> নতুন {toBengaliDigits(restoreResult.tips.created)}, আপডেট{' '}
                    {toBengaliDigits(restoreResult.tips.updated)}
                    {restoreResult.tips.skipped > 0
                      ? `, বাদ ${toBengaliDigits(restoreResult.tips.skipped)}`
                      : ''}
                  </div>
                  <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-emerald-200/70">
                    <strong>ক্যাটাগরি:</strong> নতুন{' '}
                    {toBengaliDigits(restoreResult.categories.created)}, আপডেট{' '}
                    {toBengaliDigits(restoreResult.categories.updated)}
                    {restoreResult.categories.skipped > 0
                      ? `, বাদ ${toBengaliDigits(restoreResult.categories.skipped)}`
                      : ''}
                  </div>
                </div>

                {restoreResult.errors.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 space-y-1">
                    <p className="font-bold">
                      কিছু আইটেম রিস্টোরে ত্রুটি ({toBengaliDigits(restoreResult.errors.length)}):
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-28 overflow-y-auto">
                      {restoreResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={
              restoring ||
              parsingFile ||
              nothingSelectedForImport ||
              (restoreMode === 'replace' && !confirmReplace)
            }
            onClick={handleRestoreBackup}
            className={`w-full py-3 px-4 rounded-xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 ${
              restoreMode === 'replace'
                ? 'bg-[#B92B27] hover:bg-[#9C221F]'
                : 'bg-[#1B4D24] hover:bg-[#143A1B]'
            }`}
          >
            {restoring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>রিস্টোর চলছে...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>ব্যাকআপ ইনপুট / রিস্টোর শুরু করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
