import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Clock,
  FileText,
  RotateCcw,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { getSubscriptionExpiresMillis } from '../services/firestoreService';
import type { RecycleBinItem, RecycleBinItemType } from '../types';

interface AdminRecycleBinTabProps {
  items: RecycleBinItem[];
  onRestore: (item: RecycleBinItem) => Promise<void>;
  onDeleteForever: (item: RecycleBinItem) => Promise<void>;
  onEmptyBin: (items: RecycleBinItem[]) => Promise<void>;
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

const TYPE_META: Record<
  RecycleBinItemType,
  { label: string; badgeClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  recipe: {
    label: 'রেসিপি',
    badgeClass: 'bg-[#EEF6EF] text-[#1B4D24] border-[#1B4D24]/20',
    Icon: UtensilsCrossed,
  },
  tip: {
    label: 'টিপস',
    badgeClass: 'bg-[#FFFBEB] text-[#9A7209] border-[#D4A017]/30',
    Icon: BookOpen,
  },
  blog: {
    label: 'ব্লগ পোস্ট',
    badgeClass: 'bg-[#FDF5F3] text-[#B92B27] border-[#B92B27]/20',
    Icon: FileText,
  },
};

function extractPreviewImage(item: RecycleBinItem): string | null {
  try {
    const parsed = JSON.parse(item.payloadJson) as {
      recipe?: { imageUrl?: string };
      imageUrl?: string;
    };
    if (item.itemType === 'recipe' && parsed.recipe?.imageUrl) {
      return parsed.recipe.imageUrl;
    }
    if (item.itemType === 'blog' && parsed.imageUrl) {
      return parsed.imageUrl;
    }
  } catch {
    // Ignore malformed payload preview
  }
  return null;
}

function formatBengaliDate(ts: unknown): string {
  const ms = getSubscriptionExpiresMillis(ts);
  if (!ms) return 'সম্প্রতি';
  try {
    return new Date(ms).toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'সম্প্রতি';
  }
}

function getRemainingDays(expiresAt: unknown): number {
  const expMs = getSubscriptionExpiresMillis(expiresAt);
  if (!expMs) return 30;
  const diff = expMs - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export const AdminRecycleBinTab: React.FC<AdminRecycleBinTabProps> = ({
  items,
  onRestore,
  onDeleteForever,
  onEmptyBin,
}) => {
  const [filterType, setFilterType] = useState<'all' | RecycleBinItemType>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);
  const [emptying, setEmptying] = useState(false);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTime = getSubscriptionExpiresMillis(a.deletedAt) || 0;
      const bTime = getSubscriptionExpiresMillis(b.deletedAt) || 0;
      return bTime - aTime;
    });
  }, [items]);

  const counts = useMemo(
    () => ({
      all: sortedItems.length,
      recipe: sortedItems.filter((i) => i.itemType === 'recipe').length,
      tip: sortedItems.filter((i) => i.itemType === 'tip').length,
      blog: sortedItems.filter((i) => i.itemType === 'blog').length,
    }),
    [sortedItems]
  );

  const filteredItems = useMemo(
    () =>
      filterType === 'all'
        ? sortedItems
        : sortedItems.filter((item) => item.itemType === filterType),
    [sortedItems, filterType]
  );

  const handleRestoreClick = async (item: RecycleBinItem) => {
    setBusyId(item.id);
    setConfirmDeleteId(null);
    try {
      await onRestore(item);
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDeleteClick = async (item: RecycleBinItem) => {
    setBusyId(item.id);
    try {
      await onDeleteForever(item);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleEmptyAllClick = async () => {
    setEmptying(true);
    try {
      await onEmptyBin(sortedItems);
      setConfirmEmptyAll(false);
    } finally {
      setEmptying(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {/* Top Info Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#FDF5F3] border border-[#B92B27]/20 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-[#B92B27]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A]">
              রিসাইকেল বিন ({toBengaliDigits(sortedItems.length)}টি পোস্ট)
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 leading-relaxed">
              মুছে ফেলা রেসিপি, টিপস ও ব্লগ পোস্ট এখানে <strong>৩০ দিন</strong> পর্যন্ত সংরক্ষিত থাকে। চাইলে যেকোনো সময় পুনরুদ্ধার (Restore) করতে পারবেন অথবা চিরদিনের জন্য মুছে ফেলতে পারবেন।
            </p>
          </div>
        </div>

        {sortedItems.length > 0 && (
          <div className="shrink-0">
            {confirmEmptyAll ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-red-700">সব চিরতরে মুছবেন?</span>
                <button
                  type="button"
                  disabled={emptying}
                  onClick={handleEmptyAllClick}
                  className="px-2.5 py-1 rounded-lg bg-[#B92B27] hover:bg-[#991F1C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {emptying ? 'মুছছে...' : 'হ্যাঁ, মুছুন'}
                </button>
                <button
                  type="button"
                  disabled={emptying}
                  onClick={() => setConfirmEmptyAll(false)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmEmptyAll(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                রিসাইকেল বিন খালি করুন
              </button>
            )}
          </div>
        )}
      </div>

      {/* Type Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: `সব পোস্ট (${toBengaliDigits(counts.all)})` },
            { id: 'recipe', label: `রেসিপি (${toBengaliDigits(counts.recipe)})` },
            { id: 'tip', label: `টিপস (${toBengaliDigits(counts.tip)})` },
            { id: 'blog', label: `ব্লগ পোস্ট (${toBengaliDigits(counts.blog)})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              filterType === tab.id
                ? 'bg-[#1B4D24] text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-[#1A1A1A]">রিসাইকেল বিন খালি আছে</p>
          <p className="text-xs text-gray-500">
            কোনো রেসিপি, টিপস বা ব্লগ পোস্ট মুছে ফেললে তা ৩০ দিনের জন্য এখানে জমা থাকবে।
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const meta = TYPE_META[item.itemType] || TYPE_META.recipe;
            const Icon = meta.Icon;
            const thumb = extractPreviewImage(item);
            const remainingDays = getRemainingDays(item.expiresAt);
            const isBusy = busyId === item.id;
            const isConfirmingDelete = confirmDeleteId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-14 rounded-xl object-cover shrink-0 border border-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#FAFAF8] border border-gray-200 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#1B4D24]" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {item.category && (
                        <span className="text-[11px] font-semibold text-gray-500">
                          {item.category}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums ${
                          remainingDays <= 5 ? 'text-[#B92B27]' : 'text-amber-700'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {remainingDays > 0
                          ? `আর ${toBengaliDigits(remainingDays)} দিন বাকি`
                          : 'মেয়াদ শেষ — শীঘ্রই মুছে যাবে'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#1A1A1A] truncate">{item.title}</h3>
                    {item.subtitle && (
                      <p className="text-xs text-gray-500 line-clamp-1">{item.subtitle}</p>
                    )}
                    <p className="text-[11px] text-gray-400">
                      মুছেছেন: {item.deletedByName || 'এডমিন'} · তারিখ:{' '}
                      {formatBengaliDate(item.deletedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span className="text-xs font-bold text-red-700">চিরতরে মুছবেন?</span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handlePermanentDeleteClick(item)}
                        className="px-2.5 py-1 rounded-lg bg-[#B92B27] hover:bg-[#991F1C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                      >
                        {isBusy ? 'মুছছে...' : 'হ্যাঁ'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold cursor-pointer"
                      >
                        না
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRestoreClick(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold cursor-pointer disabled:opacity-60 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {isBusy ? 'পুনরুদ্ধার হচ্ছে...' : 'পুনরুদ্ধার করুন'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold cursor-pointer disabled:opacity-60 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        চিরতরে মুছুন
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
