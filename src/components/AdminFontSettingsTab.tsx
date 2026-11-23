import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  Crown,
  Home,
  Loader2,
  LogIn,
  Monitor,
  Newspaper,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Type,
  User as UserIcon,
} from 'lucide-react';
import { FONT_SIZE_OPTIONS, RECIPE_FONT_OPTIONS } from '../data/seedData';
import {
  getFontMeta,
  getFontSizeMeta,
  getPageTypographyClass,
  resolveFontSizeKey,
} from '../utils/typography';
import type { NormalizedFontSizeKey, RecipeFontKey } from '../types';

export interface FontSettingsValues {
  checkoutFontFamily: RecipeFontKey;
  checkoutFontMobile: RecipeFontKey;
  checkoutFontSize: NormalizedFontSizeKey;
  checkoutFontSizeMobile: NormalizedFontSizeKey;
  recipeFontDesktop: RecipeFontKey;
  recipeFontMobile: RecipeFontKey;
  recipeFontSizeDesktop: NormalizedFontSizeKey;
  recipeFontSizeMobile: NormalizedFontSizeKey;
  homeFontFamily: RecipeFontKey;
  homeFontMobile: RecipeFontKey;
  homeFontSize: NormalizedFontSizeKey;
  homeFontSizeMobile: NormalizedFontSizeKey;
  pricingFontFamily: RecipeFontKey;
  pricingFontMobile: RecipeFontKey;
  pricingFontSize: NormalizedFontSizeKey;
  pricingFontSizeMobile: NormalizedFontSizeKey;
  blogTipsFontFamily: RecipeFontKey;
  blogTipsFontMobile: RecipeFontKey;
  blogTipsFontSize: NormalizedFontSizeKey;
  blogTipsFontSizeMobile: NormalizedFontSizeKey;
  authFontFamily: RecipeFontKey;
  authFontMobile: RecipeFontKey;
  authFontSize: NormalizedFontSizeKey;
  authFontSizeMobile: NormalizedFontSizeKey;
  profileFontFamily: RecipeFontKey;
  profileFontMobile: RecipeFontKey;
  profileFontSize: NormalizedFontSizeKey;
  profileFontSizeMobile: NormalizedFontSizeKey;
  adminFontFamily: RecipeFontKey;
  adminFontMobile: RecipeFontKey;
  adminFontSize: NormalizedFontSizeKey;
  adminFontSizeMobile: NormalizedFontSizeKey;
}

interface AdminFontSettingsTabProps {
  values: FontSettingsValues;
  savedValues: FontSettingsValues;
  onChange: <K extends keyof FontSettingsValues>(field: K, value: FontSettingsValues[K]) => void;
  onResetPage: (patch: Partial<FontSettingsValues>) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  justSaved?: boolean;
  saveError?: string | null;
}

type FontPageTab =
  | 'checkout'
  | 'recipe'
  | 'home'
  | 'pricing'
  | 'blogTips'
  | 'auth'
  | 'profile'
  | 'admin';

interface PageTabFieldBinding {
  pcFontField: keyof FontSettingsValues;
  mobileFontField: keyof FontSettingsValues;
  pcSizeField: keyof FontSettingsValues;
  mobileSizeField: keyof FontSettingsValues;
  defaultFont: RecipeFontKey;
}

interface PageTabMeta {
  id: FontPageTab;
  label: string;
  shortScope: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  fields: PageTabFieldBinding;
}

const PAGE_TABS: PageTabMeta[] = [
  {
    id: 'checkout',
    label: 'পেমেন্ট ও ভেরিফিকেশন',
    shortScope: 'চেকআউট, বিকাশ/নগদ ও TxID ফর্ম',
    description:
      'প্ল্যান কেনার সময় পেমেন্ট নির্দেশনা, বিকাশ/নগদ নম্বর, প্রেরক নম্বর ও TxID ভেরিফিকেশন পেজের জন্য পিসি ও মোবাইল ফন্ট এবং সাইজ (১০০%–১২০%) আলাদাভাবে ঠিক করুন।',
    icon: CreditCard,
    fields: {
      pcFontField: 'checkoutFontFamily',
      mobileFontField: 'checkoutFontMobile',
      pcSizeField: 'checkoutFontSize',
      mobileSizeField: 'checkoutFontSizeMobile',
      defaultFont: 'hind-siliguri',
    },
  },
  {
    id: 'recipe',
    label: 'রেসিপি পোস্ট',
    shortScope: 'রেসিপি ডায়েরী (PC ও মোবাইল আলাদা)',
    description:
      'মূল রেসিপি পড়ার পেজে কম্পিউটার (PC) ও মোবাইল ভার্সনের জন্য আলাদা বাংলা ফন্ট ও ফন্ট সাইজ (১০০%–১২০%) ঠিক করুন।',
    icon: BookOpen,
    fields: {
      pcFontField: 'recipeFontDesktop',
      mobileFontField: 'recipeFontMobile',
      pcSizeField: 'recipeFontSizeDesktop',
      mobileSizeField: 'recipeFontSizeMobile',
      defaultFont: 'bensen',
    },
  },
  {
    id: 'home',
    label: 'হোম ও রেসিপি ফিড',
    shortScope: 'হোম পেজ, সকল রেসিপি, ক্যাটাগরি ও প্রিয়',
    description:
      'হোম পেজ, সব রেসিপি তালিকা, ক্যাটাগরি পেজ ও সংরক্ষিত প্রিয় রেসিপি তালিকার পিসি ও মোবাইল ফন্ট এবং সাইজ নিয়ন্ত্রণ করুন।',
    icon: Home,
    fields: {
      pcFontField: 'homeFontFamily',
      mobileFontField: 'homeFontMobile',
      pcSizeField: 'homeFontSize',
      mobileSizeField: 'homeFontSizeMobile',
      defaultFont: 'hind-siliguri',
    },
  },
  {
    id: 'pricing',
    label: 'সদস্যপদ প্ল্যান',
    shortScope: 'প্রাইসিং কার্ড ও প্ল্যান ফিচার',
    description:
      'বেসিক, স্ট্যান্ডার্ড ও প্রো সদস্যপদ প্ল্যান পেজের শিরোনাম, মূল্য ও সুবিধাসমূহের পিসি ও মোবাইল ফন্ট এবং সাইজ নির্ধারণ করুন।',
    icon: Crown,
    fields: {
      pcFontField: 'pricingFontFamily',
      mobileFontField: 'pricingFontMobile',
      pcSizeField: 'pricingFontSize',
      mobileSizeField: 'pricingFontSizeMobile',
      defaultFont: 'hind-siliguri',
    },
  },
  {
    id: 'blogTips',
    label: 'ব্লগ ও টিপস',
    shortScope: 'রন্ধন টিপস ও বাংলা ব্লগ আর্টিকেল',
    description:
      'কিচেন টিপস তালিকা, টিপস বিস্তারিত এবং রান্নার ব্লগ ও আর্টিকেল পড়ার পেজের পিসি ও মোবাইল ফন্ট ও সাইজ ঠিক করুন।',
    icon: Newspaper,
    fields: {
      pcFontField: 'blogTipsFontFamily',
      mobileFontField: 'blogTipsFontMobile',
      pcSizeField: 'blogTipsFontSize',
      mobileSizeField: 'blogTipsFontSizeMobile',
      defaultFont: 'hind-siliguri',
    },
  },
  {
    id: 'auth',
    label: 'লগইন ও নিবন্ধন',
    shortScope: 'সাইন ইন, সাইন আপ ও গুগল কানেক্ট',
    description:
      'লগইন, নতুন অ্যাকাউন্ট তৈরি এবং গুগল দিয়ে সাইন-ইন পেজের ফর্ম ও নির্দেশনার পিসি ও মোবাইল ফন্ট এবং সাইজ নির্ধারণ করুন।',
    icon: LogIn,
    fields: {
      pcFontField: 'authFontFamily',
      mobileFontField: 'authFontMobile',
      pcSizeField: 'authFontSize',
      mobileSizeField: 'authFontSizeMobile',
      defaultFont: 'hind-siliguri',
    },
  },
  {
    id: 'profile',
    label: 'ইউজার প্রোফাইল',
    shortScope: 'প্রোফাইল ড্যাশবোর্ড ও প্রোফাইল এডিট',
    description:
      'ব্যবহারকারীর প্রোফাইল, কোটা সারাংশ, পেমেন্ট ইতিহাস এবং প্রোফাইল এডিট পেজের পিসি ও মোবাইল ফন্ট ও সাইজ নির্ধারণ করুন।',
    icon: UserIcon,
    fields: {
      pcFontField: 'profileFontFamily',
      mobileFontField: 'profileFontMobile',
      pcSizeField: 'profileFontSize',
      mobileSizeField: 'profileFontSizeMobile',
      defaultFont: 'hind-siliguri',
    },
  },
  {
    id: 'admin',
    label: 'এডমিন প্যানেল',
    shortScope: 'সম্পূর্ণ এডমিন কন্ট্রোল সেন্টার',
    description:
      'এডমিন প্যানেলের মেনু, ফর্ম, টেবিল ও সব পরিচালনা ট্যাবের পিসি ও মোবাইল বাংলা ফন্ট এবং সাইজ পরিবর্তন করুন।',
    icon: ShieldCheck,
    fields: {
      pcFontField: 'adminFontFamily',
      mobileFontField: 'adminFontMobile',
      pcSizeField: 'adminFontSize',
      mobileSizeField: 'adminFontSizeMobile',
      defaultFont: 'hind-siliguri',
    },
  },
];

const BOOK_FONTS = RECIPE_FONT_OPTIONS.filter((opt) => opt.category === 'book');
const HANDWRITING_FONTS = RECIPE_FONT_OPTIONS.filter((opt) => opt.category === 'handwriting');

interface FontDropdownBoxProps {
  label: string;
  value: RecipeFontKey;
  onChange: (next: RecipeFontKey) => void;
}

const FontDropdownBox: React.FC<FontDropdownBoxProps> = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeMeta = getFontMeta(value);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const renderFontOption = (opt: (typeof RECIPE_FONT_OPTIONS)[number]) => {
    const selected = opt.key === value;
    return (
      <button
        key={opt.key}
        type="button"
        onClick={() => {
          onChange(opt.key);
          setOpen(false);
        }}
        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
          selected ? 'bg-[#1B4D24]/8 text-[#143A1B]' : 'hover:bg-gray-50 text-[#1A1A1A]'
        }`}
      >
        <div className="min-w-0">
          <div
            className={`page-typo-scope typo-font-${opt.key} typo-size-100 text-[15px] font-semibold leading-snug truncate`}
          >
            {opt.label}
          </div>
          <div
            className={`page-typo-scope typo-font-${opt.key} typo-size-100 text-xs text-gray-500 mt-0.5 truncate`}
          >
            সহজ ও খাঁটি বাংলা রান্নার বিশ্বস্ত ঠিকানা
          </div>
        </div>
        {selected && <Check className="w-4 h-4 text-[#1B4D24] shrink-0" />}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-bold text-gray-700 mb-1.5">{label}</label>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border bg-white text-left transition-colors cursor-pointer ${
          open
            ? 'border-[#1B4D24] ring-2 ring-[#1B4D24]/15'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="min-w-0">
          <div
            className={`page-typo-scope typo-font-${activeMeta.key} typo-size-100 text-sm font-bold text-[#1A1A1A] leading-tight truncate`}
          >
            {activeMeta.label}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">
            {activeMeta.categoryLabel}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-[#1B4D24]' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 z-40 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
        >
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
            <div>
              <div className="px-3.5 py-2 bg-[#FAFAF8] text-[11px] font-bold text-gray-500 border-b border-gray-100">
                আধুনিক ও বইয়ের বাংলা ফন্ট ({BOOK_FONTS.length}টি)
              </div>
              <div className="divide-y divide-gray-50">{BOOK_FONTS.map(renderFontOption)}</div>
            </div>
            <div>
              <div className="px-3.5 py-2 bg-[#FAFAF8] text-[11px] font-bold text-gray-500 border-b border-gray-100">
                হাতের লেখা ও শৈল্পিক বাংলা ফন্ট ({HANDWRITING_FONTS.length}টি)
              </div>
              <div className="divide-y divide-gray-50">
                {HANDWRITING_FONTS.map(renderFontOption)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FontSizeDropdownBoxProps {
  label: string;
  value: NormalizedFontSizeKey;
  onChange: (next: NormalizedFontSizeKey) => void;
}

const FontSizeDropdownBox: React.FC<FontSizeDropdownBoxProps> = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedValue = resolveFontSizeKey(value, '100');
  const activeMeta = getFontSizeMeta(normalizedValue);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const samplePxByKey: Record<NormalizedFontSizeKey, string> = {
    '100': 'text-[13px]',
    '105': 'text-[14px]',
    '110': 'text-[15px]',
    '115': 'text-[16px]',
    '120': 'text-[17px]',
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-bold text-gray-700 mb-1.5">{label}</label>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border bg-white text-left transition-colors cursor-pointer ${
          open
            ? 'border-[#1B4D24] ring-2 ring-[#1B4D24]/15'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-[#1A1A1A] leading-tight tabular-nums truncate">
              {activeMeta.label}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">{activeMeta.description}</div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-[#1B4D24]' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 z-40 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden divide-y divide-gray-100"
        >
          {FONT_SIZE_OPTIONS.map((opt) => {
            const selected = opt.key === normalizedValue;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  selected ? 'bg-[#1B4D24]/8 text-[#143A1B]' : 'hover:bg-gray-50 text-[#1A1A1A]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-10 h-8 rounded-lg border border-gray-200 bg-[#FAFAF8] flex items-center justify-center font-bold text-[#1A1A1A] shrink-0 ${samplePxByKey[opt.key]}`}
                  >
                    অআ
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold tabular-nums">{opt.label}</div>
                    <div className="text-[11px] text-gray-500 truncate">{opt.description}</div>
                  </div>
                </div>
                {selected && <Check className="w-4 h-4 text-[#1B4D24] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AdminFontSettingsTab: React.FC<AdminFontSettingsTabProps> = ({
  values,
  savedValues,
  onChange,
  onResetPage,
  onSave,
  saving,
  justSaved = false,
  saveError = null,
}) => {
  const [activePage, setActivePage] = useState<FontPageTab>('checkout');
  const activeTabMeta = PAGE_TABS.find((t) => t.id === activePage) || PAGE_TABS[0];

  const getTabValues = (tab: PageTabMeta) => ({
    pcFont: values[tab.fields.pcFontField] as RecipeFontKey,
    mobileFont: values[tab.fields.mobileFontField] as RecipeFontKey,
    pcSize: values[tab.fields.pcSizeField] as NormalizedFontSizeKey,
    mobileSize: values[tab.fields.mobileSizeField] as NormalizedFontSizeKey,
  });

  const isTabDirty = (tab: PageTabMeta): boolean => {
    const f = tab.fields;
    return (
      values[f.pcFontField] !== savedValues[f.pcFontField] ||
      values[f.mobileFontField] !== savedValues[f.mobileFontField] ||
      values[f.pcSizeField] !== savedValues[f.pcSizeField] ||
      values[f.mobileSizeField] !== savedValues[f.mobileSizeField]
    );
  };

  const hasAnyUnsavedChanges = PAGE_TABS.some((tab) => isTabDirty(tab));
  const activeTabDirty = isTabDirty(activeTabMeta);
  const currentTabValues = getTabValues(activeTabMeta);

  const handleResetCurrentTab = () => {
    const f = activeTabMeta.fields;
    onResetPage({
      [f.pcFontField]: f.defaultFont,
      [f.mobileFontField]: f.defaultFont,
      [f.pcSizeField]: '100',
      [f.mobileSizeField]: '100',
    } as Partial<FontSettingsValues>);
  };

  const handleCopyPcToMobile = () => {
    const f = activeTabMeta.fields;
    onResetPage({
      [f.mobileFontField]: currentTabValues.pcFont,
      [f.mobileSizeField]: currentTabValues.pcSize,
    } as Partial<FontSettingsValues>);
  };

  const renderPreviewSampleBody = (
    pageId: FontPageTab,
    fontKey: RecipeFontKey,
    sizeKey: NormalizedFontSizeKey
  ) => {
    if (pageId === 'recipe') {
      return (
        <div className={`rf-m-${fontKey} rf-size-scope rf-size-m-${sizeKey} space-y-1.5`}>
          <h4 className="font-recipe-diary-heading text-xl text-[#1A1A1A] leading-snug">
            ঐতিহ্যবাহী সরষে ইলিশ
          </h4>
          <p className="font-recipe-diary text-sm text-[#2E251B] leading-relaxed">
            তাজা ইলিশের টুকরোতে হলুদ-লবণ মাখিয়ে কাঁচা সরিষার তেল ও সাদা-কালো সরষে বাটা দিয়ে মৃদু
            আঁচে ১৫ মিনিট রান্না করুন।
          </p>
        </div>
      );
    }

    const scope = getPageTypographyClass(fontKey, sizeKey);

    if (pageId === 'checkout') {
      return (
        <div className={`${scope} space-y-2.5`}>
          <div>
            <h4 className="font-display-bn text-lg font-bold text-[#1A1A1A] leading-snug">
              প্রো প্ল্যান — পেমেন্ট ও ভেরিফিকেশন
            </h4>
            <p className="text-xs text-gray-600 mt-0.5">১ মাস মেয়াদ · ২৫টি প্রিমিয়াম রেসিপি</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
              <div className="text-xs text-gray-500">বিকাশ (পার্সোনাল)</div>
              <div className="text-sm font-bold text-[#1A1A1A] tabular-nums">০১৭১১-০০০০০০</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
              <div className="text-xs text-gray-500">প্রদেয় পরিমাণ</div>
              <div className="text-sm font-bold text-[#B92B27] tabular-nums">২০০ টাকা</div>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            Send Money করে আপনার প্রেরক নম্বর ও ট্রানজেকশন আইডি (TxID) জমা দিন।
          </p>
        </div>
      );
    }

    if (pageId === 'home') {
      return (
        <div className={`${scope} space-y-1.5`}>
          <div className="text-xs font-bold text-[#1B4D24]">নতুন ও বাছাইকৃত রেসিপি</div>
          <h4 className="font-display-bn text-lg font-bold text-[#1A1A1A] leading-snug">
            ঘরোয়া কাচ্চি বিরিয়ানি ও মাটন রেজালা
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            ধাপে ধাপে ছবিসহ সহজ বাংলা নির্দেশনায় আজই শিখে নিন খাঁটি বাঙালি রান্না।
          </p>
        </div>
      );
    }

    if (pageId === 'pricing') {
      return (
        <div className={`${scope} flex items-center justify-between gap-3`}>
          <div>
            <h4 className="font-display-bn text-lg font-bold text-[#1A1A1A]">
              প্রো সদস্যপদ প্ল্যান
            </h4>
            <p className="text-sm text-gray-600 mt-0.5">
              ১ মাসে ২৫টি প্রিমিয়াম রেসিপি আনলক করুন।
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-[#B92B27] tabular-nums">২০০ টাকা</div>
            <div className="text-xs text-gray-500">১ মাস মেয়াদ</div>
          </div>
        </div>
      );
    }

    if (pageId === 'blogTips') {
      return (
        <div className={`${scope} space-y-1.5`}>
          <div className="text-xs font-bold text-[#1B4D24]">কিচেন টিপস ও বাংলা ব্লগ</div>
          <h4 className="font-display-bn text-lg font-bold text-[#1A1A1A] leading-snug">
            মাংস দ্রুত নরম ও রসালো করার ঘরোয়া কৌশল
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            টক দই, কাঁচা পেঁপে বাটা ও সঠিক আঁচে কষালে যেকোনো মাংস সহজেই নরম হয়।
          </p>
        </div>
      );
    }

    if (pageId === 'auth') {
      return (
        <div className={`${scope} space-y-1.5`}>
          <h4 className="font-display-bn text-lg font-bold text-[#1A1A1A]">
            রান্না শিখুন অ্যাকাউন্টে লগইন করুন
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            গুগল অথবা ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করে আপনার সংরক্ষিত রেসিপি ও প্ল্যান দেখুন।
          </p>
        </div>
      );
    }

    if (pageId === 'profile') {
      return (
        <div className={`${scope} space-y-1.5`}>
          <h4 className="font-display-bn text-lg font-bold text-[#1A1A1A]">
            ব্যক্তিগত প্রোফাইল ও সদস্যপদ
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            সক্রিয় প্ল্যান: প্রো · প্রিমিয়াম কোটা: ০/২৫ · ফ্রি রেসিপি কোটা: ৪/১০
          </p>
        </div>
      );
    }

    return (
      <div className={`${scope} space-y-1.5`}>
        <h4 className="font-display-bn text-lg font-bold text-[#1A1A1A]">
          এডমিন কন্ট্রোল সেন্টার
        </h4>
        <p className="text-sm text-gray-600 leading-relaxed">
          রেসিপি ব্যবস্থাপনা, সদস্যপদ অর্ডার অনুমোদন ও সাইট সেটিংস এক জায়গা থেকেই পরিচালনা করুন।
        </p>
      </div>
    );
  };

  return (
    <form noValidate onSubmit={onSave} className="mt-6 space-y-5">
      {/* Top Action Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#1B4D24]">
            <Type className="w-4 h-4" />
            সম্পূর্ণ সাইটের পিসি ও মোবাইল ফন্ট নিয়ন্ত্রণ
          </div>
          <h2 className="text-lg font-bold text-[#1A1A1A] mt-0.5">
            প্রতিটি পেজের পিসি (PC) ও মোবাইলের জন্য আলাদা ফন্ট ও সাইজ (১০০%–১২০%)
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            যেকোনো পেজ ট্যাব নির্বাচন করুন, পিসি ও মোবাইল বক্স থেকে পছন্দের বাংলা ফন্ট ও সাইজ ঠিক
            করে Save Changes এ ক্লিক করুন।
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-xs cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors ${
            hasAnyUnsavedChanges
              ? 'bg-[#B92B27] hover:bg-[#99221F]'
              : 'bg-[#1B4D24] hover:bg-[#143A1B]'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'সংরক্ষণ হচ্ছে...' : 'Save Changes · সংরক্ষণ করুন'}
        </button>
      </div>

      {/* Save Error Banner (if any) */}
      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Workspace Panel with Page Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200">
        {/* Horizontal Page Tabs */}
        <div
          role="tablist"
          aria-label="পেজ অনুযায়ী ফন্ট ট্যাব"
          className="flex items-center gap-1 px-3 pt-3 border-b border-gray-200 overflow-x-auto no-scrollbar"
        >
          {PAGE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activePage === tab.id;
            const dirty = isTabDirty(tab);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActivePage(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer -mb-px ${
                  isActive
                    ? 'border-[#1B4D24] text-[#1B4D24] bg-[#1B4D24]/5 rounded-t-lg'
                    : 'border-transparent text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-50 rounded-t-lg'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {dirty && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                    title="অসংরক্ষিত পরিবর্তন আছে"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Tab Controls — Dual PC & Mobile Cards for EVERY Page */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Active Tab Info + Reset */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1A1A1A]">
                {activeTabMeta.label}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{activeTabMeta.description}</p>
            </div>
            <button
              type="button"
              onClick={handleResetCurrentTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              এই পেজ ডিফল্ট করুন
            </button>
          </div>

          {/* PC & Mobile Separate Selector Cards */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* PC / Desktop Box Group */}
            <div className="rounded-xl border border-gray-200 bg-[#FAFAF8] p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]">
                  <Monitor className="w-4 h-4 text-[#1B4D24]" />
                  কম্পিউটার / পিসি (PC) ভার্সন
                </div>
                <span className="text-[11px] font-semibold text-gray-500">স্ক্রিন ≥ ৭৬৮px</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3.5">
                <FontDropdownBox
                  label="বাংলা ফন্ট নির্বাচন করুন"
                  value={currentTabValues.pcFont}
                  onChange={(v) => onChange(activeTabMeta.fields.pcFontField, v)}
                />
                <FontSizeDropdownBox
                  label="ফন্ট সাইজ (১০০%–১২০%)"
                  value={currentTabValues.pcSize}
                  onChange={(v) => onChange(activeTabMeta.fields.pcSizeField, v)}
                />
              </div>
            </div>

            {/* Mobile Box Group */}
            <div className="rounded-xl border border-gray-200 bg-[#FAFAF8] p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]">
                  <Smartphone className="w-4 h-4 text-[#B92B27]" />
                  মোবাইল ভার্সন
                </div>
                <button
                  type="button"
                  onClick={handleCopyPcToMobile}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1B4D24] hover:underline cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  পিসির মতো করুন
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3.5">
                <FontDropdownBox
                  label="বাংলা ফন্ট নির্বাচন করুন"
                  value={currentTabValues.mobileFont}
                  onChange={(v) => onChange(activeTabMeta.fields.mobileFontField, v)}
                />
                <FontSizeDropdownBox
                  label="ফন্ট সাইজ (১০০%–১২০%)"
                  value={currentTabValues.mobileSize}
                  onChange={(v) => onChange(activeTabMeta.fields.mobileSizeField, v)}
                />
              </div>
            </div>
          </div>

          {/* Dual Live Previews (PC & Mobile Side-by-Side) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">
                লাইভ প্রিভিউ (পিসি ও মোবাইল আলাদাভাবে)
              </span>
              <span className="text-xs text-gray-500">{activeTabMeta.shortScope}</span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* PC Preview Card */}
              <div
                className={`rounded-xl border p-4 space-y-2.5 ${
                  activePage === 'recipe'
                    ? 'border-[#DFD2BA] bg-[#FDF9EF]'
                    : 'border-gray-200 bg-[#FAFAF8]'
                }`}
              >
                <div
                  className={`flex items-center justify-between text-xs font-bold pb-2 border-b ${
                    activePage === 'recipe'
                      ? 'text-[#8A7559] border-[#E8DEC8]'
                      : 'text-[#1B4D24] border-gray-200'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" />
                    পিসি (PC) প্রিভিউ
                  </span>
                  <span className="tabular-nums">
                    {getFontMeta(currentTabValues.pcFont).label} ·{' '}
                    {getFontSizeMeta(currentTabValues.pcSize).scaleLabel}
                  </span>
                </div>
                {renderPreviewSampleBody(
                  activePage,
                  currentTabValues.pcFont,
                  currentTabValues.pcSize
                )}
              </div>

              {/* Mobile Preview Card */}
              <div
                className={`rounded-xl border p-4 space-y-2.5 ${
                  activePage === 'recipe'
                    ? 'border-[#DFD2BA] bg-[#FDF9EF]'
                    : 'border-gray-200 bg-[#FAFAF8]'
                }`}
              >
                <div
                  className={`flex items-center justify-between text-xs font-bold pb-2 border-b ${
                    activePage === 'recipe'
                      ? 'text-[#8A7559] border-[#E8DEC8]'
                      : 'text-[#B92B27] border-gray-200'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" />
                    মোবাইল প্রিভিউ
                  </span>
                  <span className="tabular-nums">
                    {getFontMeta(currentTabValues.mobileFont).label} ·{' '}
                    {getFontSizeMeta(currentTabValues.mobileSize).scaleLabel}
                  </span>
                </div>
                {renderPreviewSampleBody(
                  activePage,
                  currentTabValues.mobileFont,
                  currentTabValues.mobileSize
                )}
              </div>
            </div>
          </div>

          {/* Dedicated Save Changes Action Bar Inside Active Tab */}
          <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-semibold flex items-center gap-2">
              {hasAnyUnsavedChanges ? (
                <span className="inline-flex items-center gap-2 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  {activeTabDirty
                    ? `"${activeTabMeta.label}" পেজে নতুন পরিবর্তন করা হয়েছে — নিচের Save Changes বাটনে ক্লিক করে সংরক্ষণ করুন।`
                    : 'অন্য ট্যাবে অসংরক্ষিত পরিবর্তন আছে — Save Changes ক্লিক করে সংরক্ষণ করুন।'}
                </span>
              ) : justSaved ? (
                <span className="inline-flex items-center gap-1.5 text-[#1B4D24]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  পরিবর্তন সফলভাবে সংরক্ষণ ও কার্যকর করা হয়েছে!
                </span>
              ) : (
                <span className="text-gray-500">
                  ফন্ট বা সাইজ বদলে Save Changes বাটনে ক্লিক করলে সাথে সাথে সাইটে কার্যকর হবে।
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleResetCurrentTab}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ডিফল্ট
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap transition-colors ${
                  hasAnyUnsavedChanges
                    ? 'bg-[#B92B27] hover:bg-[#99221F] shadow-sm'
                    : 'bg-[#1B4D24] hover:bg-[#143A1B]'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'সংরক্ষণ হচ্ছে...' : 'Save Changes (সংরক্ষণ করুন)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Overview Table of All Pages (PC + Mobile) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#1A1A1A]">
            সকল পেজের পিসি ও মোবাইল ফন্ট সারাংশ
          </h3>
          <span className="text-xs text-gray-500">যেকোনো সারিতে ক্লিক করে পরিবর্তন করুন</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFAF8] border-b border-gray-100 text-[11px] font-bold text-gray-500">
                <th className="py-2.5 px-5">পেজ / অংশ</th>
                <th className="py-2.5 px-4">কম্পিউটার / পিসি (PC)</th>
                <th className="py-2.5 px-5 text-right">মোবাইল ভার্সন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
              {PAGE_TABS.map((tab) => {
                const isSelected = activePage === tab.id;
                const Icon = tab.icon;
                const tabVals = getTabValues(tab);
                return (
                  <tr
                    key={tab.id}
                    onClick={() => setActivePage(tab.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#1B4D24]/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-2.5 px-5 font-semibold text-[#1A1A1A] whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Icon
                          className={`w-4 h-4 ${isSelected ? 'text-[#1B4D24]' : 'text-gray-400'}`}
                        />
                        {tab.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap tabular-nums">
                      {getFontMeta(tabVals.pcFont).label}{' '}
                      <span className="text-[#1B4D24] font-bold">
                        ({getFontSizeMeta(tabVals.pcSize).scaleLabel})
                      </span>
                    </td>
                    <td className="py-2.5 px-5 text-right text-gray-700 whitespace-nowrap tabular-nums">
                      {getFontMeta(tabVals.mobileFont).label}{' '}
                      <span className="text-[#B92B27] font-bold">
                        ({getFontSizeMeta(tabVals.mobileSize).scaleLabel})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Save Changes Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'সংরক্ষণ হচ্ছে...' : 'Save Changes · সব পরিবর্তন সংরক্ষণ করুন'}
        </button>
      </div>
    </form>
  );
};
