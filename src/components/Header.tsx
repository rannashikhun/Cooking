import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Search,
  ShieldCheck,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { BrandMark } from './BrandMark';
import { CategoryIcon } from './CategoryIcon';
import { PHONE_EMAIL_DOMAIN, formatUserContact } from '../services/firestoreService';
import type { ActiveTab, RecipeCategory, UserNotification, UserProfile } from '../types';

interface HeaderProps {
  siteName: string;
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  announcementText?: string;
  showAnnouncement?: boolean;
  notifications?: UserNotification[];
  onNotificationClick?: (notif: UserNotification) => void;
  onMarkAllNotificationsRead?: () => void;
  categories?: RecipeCategory[];
  selectedCategory?: string;
  onSelectCategory?: (categoryName: string) => void;
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

function formatNotifTime(ts: unknown): string {
  try {
    let date: Date | null = null;
    if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      date = (ts as { toDate: () => Date }).toDate();
    }
    if (!date) return 'এইমাত্র';
    return date.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'সাম্প্রতিক';
  }
}

const DESKTOP_NAV: Array<{ id: ActiveTab; label: string }> = [
  { id: 'home', label: 'হোম' },
  { id: 'recipes', label: 'রেসিপি' },
  { id: 'tips', label: 'টিপস' },
  { id: 'pricing', label: 'সদস্যপদ' },
  { id: 'blog', label: 'ব্লগ' },
  { id: 'contact', label: 'যোগাযোগ' },
];

const MOBILE_NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { id: 'pricing', label: 'সদস্যপদ', subtitle: 'প্ল্যান ও সাবস্ক্রিপশন', icon: Crown },
  { id: 'blog', label: 'ব্লগ', subtitle: 'রান্নার গল্প ও টিপস', icon: BookOpen },
  { id: 'contact', label: 'যোগাযোগ', subtitle: 'সরাসরি বার্তা ও সহায়তা', icon: Mail },
];

export const Header: React.FC<HeaderProps> = ({
  siteName,
  activeTab,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
  searchQuery,
  onSearchChange,
  announcementText,
  showAnnouncement,
  notifications = [],
  onNotificationClick,
  onMarkAllNotificationsRead,
  categories = [],
  selectedCategory = 'সব',
  onSelectCategory,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  const handleMobileNav = (tab: ActiveTab) => {
    onNavigate(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {showAnnouncement && announcementText && (
        <div className="bg-[#1B4D24] text-white text-xs sm:text-sm py-1.5 px-4 text-center font-medium">
          {announcementText}
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        {/* Desktop Header */}
        <div className="hidden md:flex max-w-6xl mx-auto px-6 h-[72px] items-center justify-between gap-4 lg:gap-6">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4D24] rounded-lg shrink-0"
          >
            <BrandMark siteName={siteName} />
          </button>

          <nav className="flex items-center gap-4 lg:gap-6 text-[15px] font-medium text-[#2A2A2A]" aria-label="মূল মেনু">
            {DESKTOP_NAV.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#B92B27] font-semibold'
                      : 'text-[#333333] hover:text-[#B92B27]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 bottom-0 h-[2.5px] bg-[#B92B27] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Desktop Search Box placed directly left of Login / Account */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (activeTab !== 'recipes') {
                  onNavigate('recipes');
                }
              }}
              className="relative"
            >
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  onSearchChange(val);
                  if (val.trim() && activeTab !== 'recipes') {
                    onNavigate('recipes');
                  }
                }}
                placeholder="রেসিপি খুঁজুন..."
                aria-label="রেসিপি খুঁজুন"
                className="w-40 lg:w-52 pl-9 pr-7 py-1.5 text-[13px] bg-[#FAFAF8] border border-gray-200 hover:border-gray-300 focus:border-[#1B4D24] focus:bg-white rounded-full focus:outline-none transition-colors placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="সার্চ মুছুন"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#1B4D24] text-white'
                    : 'bg-[#1B4D24]/10 text-[#1B4D24] hover:bg-[#1B4D24]/20'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                এডমিন প্যানেল
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="নোটিফিকেশন"
                className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                  notifOpen
                    ? 'border-[#1B4D24] bg-[#1B4D24]/10 text-[#1B4D24]'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-[#1A1A1A]'
                }`}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B92B27] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '৯+' : toBengaliDigits(unreadCount)}
                  </span>
                )}
              </button>
            )}

            {user ? (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#D8D3CA] hover:border-[#1B4D24] bg-white text-sm font-medium text-[#1A1A1A] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center text-xs font-bold">
                    {user.displayName.charAt(0)}
                  </span>
                )}
                <span className="max-w-[110px] truncate">{user.displayName}</span>
                {user.subscriptionPlan !== 'basic' && (
                  <Crown className="w-3.5 h-3.5 text-[#D4A017] shrink-0" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className={`text-[14px] font-semibold py-1.5 px-4 rounded-full border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'login'
                    ? 'border-[#B92B27] bg-[#FDF5F3] text-[#B92B27]'
                    : 'border-[#D8D3CA] bg-white text-[#1A1A1A] hover:border-[#1B4D24] hover:text-[#1B4D24]'
                }`}
              >
                লগইন/নিবন্ধন
              </button>
            )}
          </div>
        </div>

        {/* Mobile Header (matches reference mobile top bar) */}
        <div className="flex md:hidden items-center justify-between px-3 h-12">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="মেনু খুলুন"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#1A1A1A] rounded-lg active:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              aria-label="খুঁজুন"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#1A1A1A] rounded-lg active:bg-gray-100"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center justify-center"
          >
            <BrandMark siteName={siteName} compact />
          </button>

          <div className="flex items-center gap-0.5">
            {user && (
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="নোটিফিকেশন"
                className="relative min-w-[40px] min-h-[44px] flex items-center justify-center text-[#1A1A1A] rounded-lg active:bg-gray-100"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#B92B27] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '৯+' : toBengaliDigits(unreadCount)}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => (user ? onNavigate('profile') : onOpenAuth())}
              aria-label="প্রোফাইল"
              className="min-w-[40px] min-h-[44px] flex items-center justify-center text-[#1A1A1A] rounded-lg active:bg-gray-100"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#222222] text-white flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Notifications Popover Dropdown (Desktop & Mobile) */}
        {notifOpen && user && (
          <div
            ref={notifContainerRef}
            className="fixed md:absolute top-13 md:top-[74px] right-2 sm:right-6 left-2 sm:left-auto sm:w-96 z-50 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 bg-[#FAFAF8]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#1B4D24]" />
                <span className="text-sm font-bold text-[#1A1A1A]">
                  নোটিফিকেশন ({toBengaliDigits(unreadCount)} নতুন)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && onMarkAllNotificationsRead && (
                  <button
                    type="button"
                    onClick={onMarkAllNotificationsRead}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1B4D24] hover:underline cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    সব পড়া হয়েছে
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  aria-label="বন্ধ করুন"
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  এখনো কোনো নোটিফিকেশন নেই। আপনার মন্তব্যের রিপ্লাই বা পেমেন্টের আপডেট এখানে দেখা যাবে।
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      onNotificationClick?.(n);
                    }}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-gray-50 ${
                      n.isRead ? 'bg-white' : 'bg-[#F3F8F4]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        n.type === 'comment_reply'
                          ? 'bg-[#1B4D24]/12 text-[#1B4D24]'
                          : n.type === 'payment_approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : n.type === 'payment_rejected' || n.type === 'free_limit_reached'
                              ? 'bg-red-100 text-red-600'
                              : n.type === 'pro_limit_reached'
                                ? 'bg-amber-100 text-[#9A6E04]'
                                : n.type === 'plan_expiry_reminder'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {n.type === 'comment_reply' ? (
                        <MessageSquare className="w-4 h-4" />
                      ) : n.type === 'payment_approved' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : n.type === 'payment_rejected' ? (
                        <XCircle className="w-4 h-4" />
                      ) : n.type === 'free_limit_reached' || n.type === 'plan_expiry_reminder' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : n.type === 'pro_limit_reached' ? (
                        <Crown className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#1A1A1A] truncate">{n.title}</p>
                        {!n.isRead && (
                          <span className="text-[10px] font-bold text-[#B92B27] shrink-0">নতুন</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatNotifTime(n.createdAt)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false);
                  onNavigate('profile');
                }}
                className="text-xs font-bold text-[#1B4D24] hover:underline cursor-pointer"
              >
                প্রোফাইলে সকল নোটিফিকেশন দেখুন →
              </button>
            </div>
          </div>
        )}

        {/* Mobile Expandable Search Bar */}
        {mobileSearchOpen && (
          <div className="md:hidden px-3 pb-3 border-t border-gray-100 bg-white">
            <div className="relative mt-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (activeTab !== 'home' && activeTab !== 'recipes') {
                    onNavigate('recipes');
                  }
                }}
                placeholder="রেসিপি খুঁজুন (যেমন: বিরিয়ানি, ইলিশ)..."
                className="w-full pl-10 pr-9 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-white h-full shadow-2xl flex flex-col justify-between p-5 z-10 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <BrandMark siteName={siteName} compact />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="মেনু বন্ধ করুন"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4">
                <p className="px-1.5 text-[11px] font-bold text-gray-400 tracking-wide mb-2">
                  প্রয়োজনীয় লিংক
                </p>
                <div className="space-y-2">
                  {MOBILE_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleMobileNav(item.id)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border text-left transition-all ${
                          isActive
                            ? 'border-[#1B4D24]/30 bg-[#F3F8F4] text-[#1B4D24]'
                            : 'border-gray-100 bg-[#FAFAF8]/70 hover:bg-[#FAFAF8] hover:border-gray-200 text-[#1A1A1A]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                              isActive
                                ? 'bg-[#1B4D24] border-[#1B4D24] text-white'
                                : 'bg-white border-gray-200/80 text-[#B92B27]'
                            }`}
                          >
                            <Icon className="w-[17px] h-[17px]" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`text-[14.5px] leading-tight ${
                                isActive ? 'font-bold text-[#1B4D24]' : 'font-semibold text-[#1A1A1A]'
                              }`}
                            >
                              {item.label}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#1B4D24]' : 'text-gray-300'
                          }`}
                        />
                      </button>
                    );
                  })}

                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleMobileNav('admin')}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border text-left transition-all ${
                        activeTab === 'admin'
                          ? 'border-[#1B4D24] bg-[#1B4D24] text-white'
                          : 'border-[#1B4D24]/20 bg-[#1B4D24]/8 text-[#1B4D24]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            activeTab === 'admin'
                              ? 'bg-white/15 text-white'
                              : 'bg-white text-[#1B4D24] border border-[#1B4D24]/15'
                          }`}
                        >
                          <ShieldCheck className="w-[17px] h-[17px]" strokeWidth={1.75} />
                        </span>
                        <span className="text-[14.5px] font-semibold">এডমিন প্যানেল</span>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                    </button>
                  )}
                </div>
              </div>

              {categories.filter((c) => c.isActive !== false).length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="px-2 text-xs font-bold text-gray-500 mb-2.5">
                    রেসিপি ক্যাটাগরি
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {categories
                      .filter((c) => c.isActive !== false)
                      .map((cat) => {
                        const isSelected = selectedCategory === cat.name && activeTab === 'recipes';
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              onSelectCategory?.(cat.name);
                            }}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                              isSelected
                                ? 'bg-[#F8EAE6] ring-1 ring-[#B92B27]/50 text-[#B92B27] font-bold'
                                : 'bg-[#FDF5F3] hover:bg-[#F9EAE6] text-[#1A1A1A] font-medium'
                            }`}
                          >
                            <CategoryIcon
                              iconKey={cat.iconKey}
                              iconImageUrl={cat.iconImageUrl}
                              name={cat.name}
                              size="sm"
                            />
                            <span className="text-xs leading-tight line-clamp-1">
                              {cat.name}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 px-2">
                    <div className="w-9 h-9 rounded-full bg-[#1B4D24] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.displayName.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {user.email && !user.email.endsWith(PHONE_EMAIL_DOMAIN)
                          ? user.email
                          : formatUserContact(user.email, user.phoneNumber)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut className="w-4 h-4" />
                    লগআউট করুন
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-semibold"
                >
                  লগইন / নিবন্ধন করুন
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
