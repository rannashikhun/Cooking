import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RecipeCategory } from '../types';

export interface CategoryIconPreset {
  key: string;
  label: string;
}

export const CATEGORY_ICON_PRESETS: CategoryIconPreset[] = [
  { key: 'rice', label: 'ভাত ও পোলাও' },
  { key: 'meat', label: 'মাংস' },
  { key: 'fish', label: 'মাছ' },
  { key: 'veg', label: 'সবজি' },
  { key: 'dal', label: 'ডাল' },
  { key: 'snacks', label: 'নাস্তা' },
  { key: 'dessert', label: 'মিষ্টান্ন' },
  { key: 'drink', label: 'পানীয়' },
  { key: 'chinese', label: 'চাইনিজ' },
  { key: 'biryani', label: 'বিরিয়ানি' },
  { key: 'egg', label: 'ডিম' },
  { key: 'bread', label: 'রুটি ও পরোটা' },
  { key: 'soup', label: 'স্যুপ ও ভর্তা' },
  { key: 'spice', label: 'আচার ও মশলা' },
  { key: 'salad', label: 'সালাদ' },
];

function inferIconKeyFromName(name?: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('চাইনিজ') || n.includes('নুডলস') || n.includes('চাওমিন') || n.includes('স্যুপ')) return 'chinese';
  if (n.includes('ভাত') || n.includes('পোলাও')) return 'rice';
  if (n.includes('বিরিয়ানি') || n.includes('খিচুড়ি')) return 'biryani';
  if (n.includes('মাংস') || n.includes('চিকেন') || n.includes('মাটন') || n.includes('গরু')) return 'meat';
  if (n.includes('মাছ') || n.includes('ইলিশ') || n.includes('চিংড়ি')) return 'fish';
  if (n.includes('সবজি') || n.includes('শাক') || n.includes('আলু')) return 'veg';
  if (n.includes('ডাল')) return 'dal';
  if (n.includes('নাস্তা') || n.includes('স্ন্যাক্স') || n.includes('পিঠা')) return 'snacks';
  if (n.includes('মিষ্টান্ন') || n.includes('মিষ্টি') || n.includes('দই') || n.includes('পায়েস')) return 'dessert';
  if (n.includes('পানীয়') || n.includes('শরবত') || n.includes('চা') || n.includes('জুস')) return 'drink';
  if (n.includes('ডিম')) return 'egg';
  if (n.includes('রুটি') || n.includes('পরোটা') || n.includes('লুচি')) return 'bread';
  if (n.includes('ভর্তা')) return 'soup';
  if (n.includes('আচার') || n.includes('মশলা') || n.includes('চাটনি')) return 'spice';
  if (n.includes('সালাদ')) return 'salad';
  return 'rice';
}

export const PresetFoodSvg: React.FC<{ iconKey: string; className?: string }> = ({
  iconKey,
  className = 'w-12 h-12',
}) => {
  switch (iconKey) {
    case 'all':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="52" rx="18" ry="4" fill="#000" fillOpacity="0.08" />
          <circle cx="32" cy="31" r="19" fill="#FFFFFF" stroke="#D8D3CA" strokeWidth="2.2" />
          <circle cx="32" cy="31" r="13.5" fill="#FDF5F3" stroke="#E8C6BD" strokeWidth="1.5" />
          <path d="M24 27c0-3 3.5-5 8-5s8 2 8 5v3H24v-3z" fill="#1B4D24" />
          <path d="M26 33h12c-.8 4.5-3.4 7-6 7s-5.2-2.5-6-7z" fill="#B92B27" />
        </svg>
      );

    case 'chinese':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="53" rx="16" ry="3.8" fill="#000" fillOpacity="0.08" />
          {/* Chopsticks */}
          <path d="M36 25L53 11" stroke="#8C481E" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M40 27L56 16" stroke="#A65A2A" strokeWidth="2.4" strokeLinecap="round" />
          {/* Red & Cream Chinese Bowl */}
          <path d="M12 31c0 12 8.5 19.5 20 19.5S52 43 52 31H12z" fill="#B92B27" />
          <path d="M15 33c1.5 8 7.5 13 17 13s15.5-5 17-13" stroke="#D94A45" strokeWidth="1.8" strokeLinecap="round" />
          <ellipse cx="32" cy="30.5" rx="20" ry="6" fill="#7E1B18" />
          {/* Noodles */}
          <path d="M16 30c3-6 9-9.5 16-9.5s13 3.5 16 9.5c-4 2.5-10 3.5-16 3.5S20 32.5 16 30z" fill="#F8C858" />
          <path d="M19 28c3-3 7-3 10 0s7 3 10 0 5-2 7 0" stroke="#DE9D24" strokeWidth="2" strokeLinecap="round" />
          <path d="M21 24.5c3-2 6-2 9 0s6 2 9 0" stroke="#DE9D24" strokeWidth="1.8" strokeLinecap="round" />
          {/* Garnish */}
          <circle cx="26" cy="26" r="2.2" fill="#E33E2B" />
          <circle cx="37" cy="27" r="2" fill="#4CA63B" />
          <path d="M31 23l3-2" stroke="#4CA63B" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'rice':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="52" rx="16" ry="4" fill="#000" fillOpacity="0.08" />
          <path d="M12 29c0 12.5 8.5 21 20 21s20-8.5 20-21H12z" fill="#A84A17" />
          <path d="M14 29c0 9 7.5 16 18 16s18-7 18-16H14z" fill="#C45C22" />
          <ellipse cx="32" cy="28.5" rx="20" ry="6.5" fill="#7D320C" />
          <path d="M15 28c2-8 9-13 17-13s15 5 17 13c-4 3-11 4.5-17 4.5S19 31 15 28z" fill="#FAF7F0" />
          <path d="M19 25c2-5 7-8 13-8s11 3 13 8" stroke="#E8DFCE" strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx="26" cy="24" rx="2.2" ry="1.1" transform="rotate(-20 26 24)" fill="#EAE2D2" />
          <ellipse cx="37" cy="25" rx="2.2" ry="1.1" transform="rotate(20 37 25)" fill="#EAE2D2" />
          <ellipse cx="31" cy="28" rx="2.4" ry="1.1" fill="#EAE2D2" />
          <ellipse cx="23" cy="28" rx="2" ry="1" transform="rotate(15 23 28)" fill="#EAE2D2" />
          <ellipse cx="40" cy="28" rx="2" ry="1" transform="rotate(-15 40 28)" fill="#EAE2D2" />
          <path d="M32 18c-3-4-7-2.5-6 1 1 2 4 2.5 6 2zm0 0c3-4 7-2.5 6 1-1 2-4 2.5-6 2zm0 1c0-3.5-1.5-6 0-7 1.5 1 0 3.5 0 7z" fill="#4CA63B" />
        </svg>
      );

    case 'meat':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="53" rx="18" ry="4" fill="#000" fillOpacity="0.08" />
          <path d="M11 30c-3.5 0-5 2-4 4.5.8 2 3 2.5 5 2.5M53 30c3.5 0 5 2 4 4.5-.8 2-3 2.5-5 2.5" stroke="#262220" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M13 29c0 12 7.5 21 19 21s19-9 19-21H13z" fill="#2A2624" />
          <path d="M17 31c1 9 6.5 16 15 16" stroke="#3F3A37" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="32" cy="28.5" rx="19.5" ry="6.5" fill="#1C1917" />
          <ellipse cx="32" cy="28.5" rx="17" ry="5" fill="#D94518" />
          <circle cx="25" cy="28" r="4" fill="#9E2708" />
          <circle cx="38" cy="29" r="3.8" fill="#B5310C" />
          <circle cx="32" cy="26" r="4.2" fill="#E96420" />
          <circle cx="32" cy="25.5" r="2.2" fill="#FFFDF8" />
          <path d="M30 22c-2-2.5-5-1.5-4 1s3 2 4 1.5zm4 0c2-2.5 5-1.5 4 1s-3 2-4 1.5z" fill="#4BA83B" />
          <circle cx="32" cy="14" r="2.6" fill="#2A2624" />
          <rect x="30.8" y="15.5" width="2.4" height="3" rx="1" fill="#3D3734" />
        </svg>
      );

    case 'fish':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="33" cy="51" rx="20" ry="3.5" fill="#000" fillOpacity="0.08" />
          <path d="M47 32l11-8.5c-2 4.5-2.5 12.5 0 17L47 32z" fill="#4D789E" />
          <path d="M24 21l6-5.5 6 4.5-12 1z" fill="#5D8AB0" />
          <path d="M28 41l4 4.5 5-4-9-.5z" fill="#6D97BA" />
          <path d="M9 32c6-9.5 17-12.5 27-10.5 7 1.4 11.5 5.5 14 10.5-2.5 5-7 9.1-14 10.5-10 2-21-1-27-10.5z" fill="#93B7D6" />
          <path d="M9 32c6-6 17-8 27-6.5 6.5 1 11 3.5 13.5 6.5-3-4-7.5-7.5-13.5-8.5-10-1.5-21 1.5-27 8.5z" fill="#4F7DA5" />
          <path d="M12 33c7 5 18 6.5 28 3.5 4-1.2 7-3 9-4.5-2.5 3.5-6.5 7-13 8.5-9.5 2-18.5-.5-24-7.5z" fill="#DCE9F5" />
          <path d="M20 26.5c1.8 3.5 1.8 7.5 0 11" stroke="#4D789E" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M24 34c2-1.5 4.5-1 5.5 1-2 .8-4 .4-5.5-1z" fill="#6F9CC2" />
          <circle cx="15" cy="30.5" r="2.2" fill="#FFFFFF" />
          <circle cx="15" cy="30.5" r="1.2" fill="#1C2833" />
        </svg>
      );

    case 'veg':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="52" rx="16" ry="3.8" fill="#000" fillOpacity="0.08" />
          <path d="M13 31c0 11.5 8 19 19 19s19-7.5 19-19H13z" fill="#9A531E" />
          <path d="M16 32c1 8.5 7 14 16 14s15-5.5 16-14H16z" fill="#B66628" />
          <ellipse cx="32" cy="30" rx="19" ry="5.5" fill="#703B14" />
          <circle cx="22" cy="26" r="5" fill="#52A83B" />
          <circle cx="32" cy="22" r="5.5" fill="#67BE48" />
          <circle cx="42" cy="26" r="4.8" fill="#499835" />
          <circle cx="27" cy="29" r="4.2" fill="#E85A26" />
          <circle cx="37" cy="28" r="4.5" fill="#F27929" />
          <circle cx="32" cy="27" r="3" fill="#E33E2B" />
          <circle cx="25" cy="23" r="1.5" fill="#A6E26A" />
          <circle cx="39" cy="23" r="1.5" fill="#A6E26A" />
        </svg>
      );

    case 'dal':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="52" rx="16" ry="3.8" fill="#000" fillOpacity="0.08" />
          <path d="M13 30c0 12 8 19.5 19 19.5S51 42 51 30H13z" fill="#C98A3A" />
          <path d="M15 30c1 9 7.5 15 17 15s16-6 17-15H15z" fill="#DF9F4B" />
          <ellipse cx="32" cy="29" rx="19" ry="6.5" fill="#B57528" />
          <ellipse cx="32" cy="29" rx="16.5" ry="5" fill="#F7B32B" />
          <ellipse cx="32" cy="28.5" rx="12" ry="3" fill="#FBC94A" fillOpacity="0.7" />
          <path d="M32 25c-2.5-2.5-5-1.2-4 1.2s3 1.8 4 1.2zm0 0c2.5-2.5 5-1.2 4 1.2s-3 1.8-4 1.2zm0 .5v-3.5" stroke="#3F9A32" strokeWidth="1.4" fill="#4DB33D" strokeLinecap="round" />
        </svg>
      );

    case 'snacks':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="48" rx="23" ry="6" fill="#000" fillOpacity="0.08" />
          <ellipse cx="32" cy="41" rx="23" ry="9" fill="#EAEAEA" />
          <ellipse cx="32" cy="40" rx="22" ry="8" fill="#FFFFFF" />
          <ellipse cx="32" cy="40" rx="16" ry="5" fill="#F2F2F2" />
          <circle cx="22" cy="36" r="4.8" fill="#E39724" />
          <circle cx="42" cy="36" r="4.5" fill="#DA891A" />
          <circle cx="27" cy="31" r="5" fill="#F0AA35" />
          <circle cx="37" cy="31" r="4.8" fill="#E69B25" />
          <circle cx="32" cy="25" r="5.2" fill="#F6B846" />
          <circle cx="32" cy="36" r="5" fill="#ED9F2B" />
          <ellipse cx="31" cy="23.5" rx="2" ry="1" fill="#FCD678" />
        </svg>
      );

    case 'dessert':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="54" rx="14" ry="3.5" fill="#000" fillOpacity="0.08" />
          <path d="M24 47h16l-2 5H26l-2-5z" fill="#8C481E" />
          <path d="M15 31c0 10.5 7 17 17 17s17-6.5 17-17H15z" fill="#A65828" />
          <ellipse cx="32" cy="30" rx="17" ry="5" fill="#7D3E17" />
          <circle cx="23" cy="28" r="4.5" fill="#F7E4BA" />
          <circle cx="41" cy="28" r="4.5" fill="#F3DCAC" />
          <circle cx="32" cy="29" r="4.8" fill="#FBECC8" />
          <circle cx="27" cy="23" r="4.4" fill="#FDF2D5" />
          <circle cx="37" cy="23" r="4.4" fill="#F8E4B8" />
          <circle cx="32" cy="18" r="3.8" fill="#D12622" />
          <circle cx="30.8" cy="16.8" r="1.1" fill="#F57B78" />
        </svg>
      );

    case 'drink':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="54" rx="12" ry="3.2" fill="#000" fillOpacity="0.08" />
          <path d="M21 15h22l-3.2 36H24.2L21 15z" fill="#E6EEF2" stroke="#B6C8D4" strokeWidth="1.5" />
          <path d="M22.8 24h18.4l-2.6 25H25.4L22.8 24z" fill="#F7941D" />
          <ellipse cx="32" cy="24" rx="9.2" ry="2.2" fill="#FFB833" />
          <ellipse cx="32" cy="15" rx="11" ry="2.6" fill="#F5FAFC" stroke="#B6C8D4" strokeWidth="1.2" />
          <path d="M25.5 21l2 26" stroke="#FFFFFF" strokeWidth="1.8" strokeOpacity="0.55" strokeLinecap="round" />
        </svg>
      );

    case 'biryani':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="53" rx="17" ry="3.8" fill="#000" fillOpacity="0.08" />
          <path d="M13 30c0 12 8 20 19 20s19-8 19-20H13z" fill="#A63A14" />
          <ellipse cx="32" cy="29" rx="19" ry="6" fill="#7D290C" />
          <path d="M16 28.5c2-7 8-11.5 16-11.5s14 4.5 16 11.5c-4 2.8-10 4-16 4s-12-1.2-16-4z" fill="#F6D17A" />
          <path d="M24 25l3-2m7 0l3 2m-8 3h5" stroke="#D1781A" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="20" r="2.2" fill="#4BA83B" />
        </svg>
      );

    case 'egg':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="50" rx="18" ry="4" fill="#000" fillOpacity="0.08" />
          <path d="M16 34c0-9 7-15 16-15s16 6 16 15c0 8-7 12-16 12s-16-4-16-12z" fill="#FFFDF8" stroke="#E5DFD2" strokeWidth="1.8" />
          <circle cx="32" cy="33" r="8" fill="#F7A81B" />
          <circle cx="29.5" cy="30.5" r="2.2" fill="#FFD15C" />
        </svg>
      );

    case 'bread':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="49" rx="20" ry="4.5" fill="#000" fillOpacity="0.08" />
          <circle cx="32" cy="34" r="17" fill="#E8C27A" />
          <circle cx="32" cy="34" r="14" fill="#F2D294" />
          <circle cx="26" cy="29" r="2.5" fill="#BD7B2A" fillOpacity="0.6" />
          <circle cx="37" cy="32" r="3" fill="#BD7B2A" fillOpacity="0.55" />
          <circle cx="30" cy="40" r="2.2" fill="#BD7B2A" fillOpacity="0.5" />
        </svg>
      );

    case 'soup':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="52" rx="16" ry="3.8" fill="#000" fillOpacity="0.08" />
          <path d="M13 30c0 12 8 19.5 19 19.5S51 42 51 30H13z" fill="#D94B2B" />
          <ellipse cx="32" cy="29" rx="19" ry="6" fill="#A93218" />
          <ellipse cx="32" cy="29" rx="16" ry="4.5" fill="#F2852E" />
          <path d="M26 19c-1-3 2-5 1-8M33 18c-1-3 2-5 1-8M40 19c-1-3 2-5 1-8" stroke="#E0B499" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'spice':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="52" rx="15" ry="3.8" fill="#000" fillOpacity="0.08" />
          <rect x="20" y="21" width="24" height="29" rx="5" fill="#C93B28" />
          <rect x="22" y="15" width="20" height="6" rx="2" fill="#8C4B20" />
          <rect x="24" y="29" width="16" height="12" rx="2" fill="#FBE8C8" />
          <circle cx="32" cy="35" r="3" fill="#4BA83B" />
        </svg>
      );

    case 'salad':
    default:
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <ellipse cx="32" cy="52" rx="16" ry="3.8" fill="#000" fillOpacity="0.08" />
          <path d="M13 31c0 11.5 8 19 19 19s19-7.5 19-19H13z" fill="#E6EAE4" />
          <ellipse cx="32" cy="30" rx="19" ry="5.5" fill="#CBD4C8" />
          <circle cx="24" cy="26" r="5" fill="#68BD45" />
          <circle cx="34" cy="23" r="5.5" fill="#4DA336" />
          <circle cx="41" cy="27" r="4.5" fill="#7AD054" />
          <circle cx="29" cy="29" r="3.5" fill="#E83C2E" />
          <circle cx="37" cy="28" r="3" fill="#F7B32B" />
        </svg>
      );
  }
};

export const CategoryIcon: React.FC<{
  iconKey?: string;
  iconImageUrl?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ iconKey, iconImageUrl, name, size = 'md', className = '' }) => {
  const sizeClass =
    size === 'sm'
      ? 'w-7 h-7'
      : size === 'lg'
        ? 'w-11 h-11 sm:w-13 sm:h-13'
        : 'w-9 h-9 sm:w-10 sm:h-10';

  if (iconImageUrl) {
    return (
      <img
        src={iconImageUrl}
        alt={name || 'ক্যাটাগরি'}
        referrerPolicy="no-referrer"
        className={`${sizeClass} object-contain shrink-0 ${className}`}
      />
    );
  }

  const resolvedKey = iconKey || inferIconKeyFromName(name);
  return <PresetFoodSvg iconKey={resolvedKey} className={`${sizeClass} shrink-0 ${className}`} />;
};

interface CategoryStripProps {
  categories: RecipeCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryName: string) => void;
  embedded?: boolean;
  compact?: boolean;
  showAllButton?: boolean;
}

export const CategoryStrip: React.FC<CategoryStripProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  embedded = false,
  compact = false,
  showAllButton = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeCategories = categories.filter((c) => c.isActive !== false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(updateScrollState);
    const el = scrollRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateScrollState);
      observer.observe(el);
    }
    window.addEventListener('resize', updateScrollState);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [activeCategories.length, showAllButton, compact, updateScrollState]);

  const handleScrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(200, Math.round(el.clientWidth * 0.65));
    el.scrollBy({
      left: direction === 'right' ? step : -step,
      behavior: 'smooth',
    });
  };

  if (activeCategories.length === 0) return null;

  const tileSizingClass = compact
    ? 'w-[92px] shrink-0 px-2 py-2 gap-1'
    : 'w-[104px] sm:w-[116px] md:w-[calc((100%-70px)/8)] shrink-0 px-2.5 py-3 md:py-3.5 gap-1.5 md:gap-2';

  const content = (
    <div
      className={`relative bg-white rounded-2xl border border-gray-200/80 shadow-xs ${
        compact ? 'p-1.5' : 'p-2 sm:p-3'
      }`}
    >
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScrollBy('left')}
          aria-label="পূর্ববর্তী ক্যাটাগরি"
          className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/95 hover:bg-white border border-gray-200 shadow-md flex items-center justify-center text-[#1A1A1A] hover:text-[#B92B27] transition-all cursor-pointer active:scale-95"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      )}

      {/* Horizontal Touch & Button Scrollable Track (8 visible on desktop, swipeable on mobile) */}
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex items-stretch gap-2 md:gap-2.5 overflow-x-auto scroll-smooth touch-pan-x no-scrollbar"
      >
        {showAllButton && (
          <button
            type="button"
            onClick={() => onSelectCategory('সব')}
            className={`group rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${tileSizingClass} ${
              selectedCategory === 'সব'
                ? 'bg-[#F8EAE6] ring-1.5 ring-[#B92B27]/60'
                : 'bg-[#FDF5F3] hover:bg-[#F9EAE6]'
            }`}
          >
            <div className="transition-transform duration-200 group-hover:scale-105">
              <CategoryIcon iconKey="all" name="সব রেসিপি" size={compact ? 'md' : 'lg'} />
            </div>
            <span
              className={`${
                compact ? 'text-[11px]' : 'text-xs md:text-[13px]'
              } font-semibold text-[#1A1A1A] text-center leading-snug line-clamp-1`}
            >
              সব রেসিপি
            </span>
          </button>
        )}

        {activeCategories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.name)}
              className={`group rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${tileSizingClass} ${
                isSelected
                  ? 'bg-[#F8EAE6] ring-1.5 ring-[#B92B27]/60'
                  : 'bg-[#FDF5F3] hover:bg-[#F9EAE6]'
              }`}
            >
              <div className="transition-transform duration-200 group-hover:scale-105">
                <CategoryIcon
                  iconKey={cat.iconKey}
                  iconImageUrl={cat.iconImageUrl}
                  name={cat.name}
                  size={compact ? 'md' : 'lg'}
                />
              </div>
              <span
                className={`${
                  compact ? 'text-[11px]' : 'text-xs md:text-[13px]'
                } font-semibold text-[#1A1A1A] text-center leading-snug line-clamp-1`}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScrollBy('right')}
          aria-label="পরবর্তী ক্যাটাগরি"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/95 hover:bg-white border border-gray-200 shadow-md flex items-center justify-center text-[#1A1A1A] hover:text-[#B92B27] transition-all cursor-pointer active:scale-95"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div aria-label="রেসিপি ক্যাটাগরি" className={compact ? 'px-3 py-2' : 'mb-7 md:mb-8'}>
        {content}
      </div>
    );
  }

  return (
    <section
      aria-label="রেসিপি ক্যাটাগরি"
      className={compact ? 'px-3 py-2' : 'max-w-6xl mx-auto px-4 sm:px-6 pb-8 pt-2'}
    >
      {content}
    </section>
  );
};
