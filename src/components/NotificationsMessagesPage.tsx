import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  MessageCircle,
  MessageSquare,
  Search,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import { AdminMessengerPanel } from './AdminMessengerPanel';
import { UserAdminChatPanel } from './UserAdminChatPanel';
import { getResponsiveTypographyClass } from '../utils/typography';
import type { PageRoute, SiteSettings, UserNotification, UserProfile } from '../types';

interface NotificationsMessagesPageProps {
  user: UserProfile | null;
  siteSettings?: SiteSettings;
  notifications: UserNotification[];
  unreadDirectMessagesCount: number;
  activeTab: 'notifications' | 'messages';
  onTabChange: (tab: 'notifications' | 'messages') => void;
  onNotificationClick: (notif: UserNotification) => void;
  onMarkAllNotificationsRead: () => void;
  onNavigate: (route: PageRoute) => void;
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

function formatRelativeNotifTimeBn(ts: unknown): string {
  try {
    let date: Date | null = null;
    if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      date = (ts as { toDate: () => Date }).toDate();
    }
    if (!date) return 'এইমাত্র';
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'এইমাত্র';
    if (diffMin < 60) return `${toBengaliDigits(diffMin)} মি. আগে`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${toBengaliDigits(diffHr)} ঘ. আগে`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay <= 7) return `${toBengaliDigits(diffDay)} দিন আগে`;
    return date.toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'সাম্প্রতিক';
  }
}

function getNotifCategoryLabel(type: UserNotification['type']): string {
  switch (type) {
    case 'comment_reply':
      return 'মন্তব্যের উত্তর';
    case 'payment_approved':
      return 'পেমেন্ট অনুমোদিত';
    case 'payment_rejected':
      return 'পেমেন্ট আপডেট';
    case 'payment_pending':
      return 'পেমেন্ট যাচাই';
    case 'free_limit_reached':
    case 'pro_limit_reached':
      return 'কোটা আপডেট';
    case 'plan_expiry_reminder':
      return 'মেয়াদ রিমাইন্ডার';
    default:
      return 'গুরুত্বপূর্ণ আপডেট';
  }
}

export const NotificationsMessagesPage: React.FC<NotificationsMessagesPageProps> = ({
  user,
  siteSettings,
  notifications,
  unreadDirectMessagesCount,
  activeTab,
  onTabChange,
  onNotificationClick,
  onMarkAllNotificationsRead,
  onNavigate,
}) => {
  const scopeClass = getResponsiveTypographyClass(
    siteSettings?.profileFontFamily,
    siteSettings?.profileFontMobile,
    siteSettings?.profileFontSize,
    siteSettings?.profileFontSizeMobile
  );

  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [notifSearch, setNotifSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'messages') {
      setNotifSearch('');
    }
  }, [activeTab]);

  // Keep only important notifications (exclude direct admin messages)
  const importantNotifications = useMemo(
    () => notifications.filter((n) => n.type !== 'admin_message'),
    [notifications]
  );

  const unreadNotifCount = useMemo(
    () => importantNotifications.filter((n) => !n.isRead).length,
    [importantNotifications]
  );

  const filteredNotifications = useMemo(() => {
    const q = notifSearch.trim().toLowerCase();
    return importantNotifications.filter((n) => {
      if (notifFilter === 'unread' && n.isRead) return false;
      if (!q) return true;
      return `${n.title} ${n.message}`.toLowerCase().includes(q);
    });
  }, [importantNotifications, notifFilter, notifSearch]);

  if (!user) {
    return (
      <section className={`${scopeClass} max-w-lg mx-auto px-4 py-14 text-center`}>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center">
            <UserIcon className="w-7 h-7" />
          </div>
          <h1 className="font-display-bn text-xl font-bold text-[#1A1A1A]">
            নোটিফিকেশন ও মেসেজ দেখতে লগইন করুন
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            আপনার গুরুত্বপূর্ণ নোটিফিকেশন এবং এডমিনের সাথে সরাসরি মেসেজ দেখতে অ্যাকাউন্টে প্রবেশ করুন।
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'login' })}
            className="w-full py-3 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer transition-colors"
          >
            লগইন / নিবন্ধন পেজে যান
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${scopeClass} max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5`}>
      {/* Centered Messenger-style Segmented Tab Bar */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="নোটিফিকেশন ও মেসেজ"
          className="inline-flex items-center gap-1 p-1 rounded-full bg-[#F2F4F3] border border-gray-200/80"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notifications'}
            onClick={() => onTabChange('notifications')}
            className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
              activeTab === 'notifications'
                ? 'bg-[#1B4D24] text-white shadow-xs'
                : 'text-gray-700 hover:text-[#1A1A1A] hover:bg-white/70'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>নোটিফিকেশন</span>
            {unreadNotifCount > 0 && (
              <span
                className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center tabular-nums font-numeral-bn ${
                  activeTab === 'notifications'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#B92B27] text-white'
                }`}
              >
                {unreadNotifCount > 99 ? '৯৯+' : toBengaliDigits(unreadNotifCount)}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'messages'}
            onClick={() => onTabChange('messages')}
            className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
              activeTab === 'messages'
                ? 'bg-[#1B4D24] text-white shadow-xs'
                : 'text-gray-700 hover:text-[#1A1A1A] hover:bg-white/70'
            }`}
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>মেসেজ</span>
            {unreadDirectMessagesCount > 0 && (
              <span
                className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center tabular-nums font-numeral-bn ${
                  activeTab === 'messages'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#B92B27] text-white'
                }`}
              >
                {unreadDirectMessagesCount > 99
                  ? '৯৯+'
                  : toBengaliDigits(unreadDirectMessagesCount)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Single-Elevation Messenger Workspace Surface */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {activeTab === 'messages' ? (
          user.role === 'admin' ? (
            <AdminMessengerPanel
              adminUser={user}
              siteName={siteSettings?.siteName}
              fullPage
            />
          ) : (
            <UserAdminChatPanel
              user={user}
              siteName={siteSettings?.siteName}
              adminContactEmail={siteSettings?.contactEmail}
              adminPhotoUrl={siteSettings?.adminPhotoUrl}
              adminDisplayName={siteSettings?.adminDisplayName}
              fullPage
            />
          )
        ) : (
          <div className="flex flex-col min-h-[480px]">
            {/* Messenger-Style Notifications Header & Controls */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-[#1A1A1A]">নোটিফিকেশন</h1>
                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums font-numeral-bn">
                    মোট {toBengaliDigits(importantNotifications.length)}টি গুরুত্বপূর্ণ নোটিফিকেশন
                    {unreadNotifCount > 0 ? ` · ${toBengaliDigits(unreadNotifCount)}টি অপঠিত` : ''}
                  </p>
                </div>

                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllNotificationsRead}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-[#1B4D24] bg-[#EEF6EF] hover:bg-[#E1EFE3] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <CheckCheck className="w-4 h-4 shrink-0" />
                    সব পড়া হয়েছে
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNotifFilter('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      notifFilter === 'all'
                        ? 'bg-[#1B4D24] text-white'
                        : 'bg-[#F3F4F6] text-gray-700 hover:bg-gray-200/80'
                    }`}
                  >
                    সব ({toBengaliDigits(importantNotifications.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('unread')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      notifFilter === 'unread'
                        ? 'bg-[#1B4D24] text-white'
                        : 'bg-[#F3F4F6] text-gray-700 hover:bg-gray-200/80'
                    }`}
                  >
                    অপঠিত ({toBengaliDigits(unreadNotifCount)})
                  </button>
                </div>

                {importantNotifications.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={notifSearch}
                      onChange={(e) => setNotifSearch(e.target.value)}
                      placeholder="নোটিফিকেশন খুঁজুন..."
                      className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#F3F4F6] border border-transparent focus:border-[#1B4D24]/30 focus:bg-white rounded-full focus:outline-none transition-colors"
                    />
                    {notifSearch && (
                      <button
                        type="button"
                        onClick={() => setNotifSearch('')}
                        aria-label="সার্চ মুছুন"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Messenger-Style Notification Rows */}
            <div className="flex-1 divide-y divide-gray-100">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 px-6 text-center space-y-2.5 max-w-sm mx-auto">
                  <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-gray-400 flex items-center justify-center mx-auto">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#1A1A1A]">
                    {notifFilter === 'unread'
                      ? 'কোনো অপঠিত নোটিফিকেশন নেই'
                      : notifSearch.trim()
                        ? 'খোঁজা অনুযায়ী কোনো নোটিফিকেশন পাওয়া যায়নি'
                        : 'এখনো কোনো নোটিফিকেশন নেই'}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {notifFilter === 'unread'
                      ? 'আপনার সব গুরুত্বপূর্ণ নোটিফিকেশন পড়া সম্পন্ন হয়েছে।'
                      : 'মন্তব্যের উত্তর, পেমেন্ট অনুমোদন, কোটা ও মেয়াদ সংক্রান্ত গুরুত্বপূর্ণ নোটিফিকেশন এখানে দেখা যাবে।'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const hasRecipeAction = Boolean(n.recipeId);
                  const hasPricingAction =
                    n.type === 'payment_rejected' ||
                    n.type === 'free_limit_reached' ||
                    n.type === 'pro_limit_reached' ||
                    n.type === 'plan_expiry_reminder';

                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onNotificationClick(n)}
                      className={`w-full text-left px-4 sm:px-6 py-4 flex items-start gap-3.5 transition-colors cursor-pointer ${
                        n.isRead
                          ? 'bg-white hover:bg-[#F7F8F9]'
                          : 'bg-[#F2F8F3] hover:bg-[#E9F4EC]'
                      }`}
                    >
                      {/* Circular Messenger Avatar Icon */}
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
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
                          <MessageSquare className="w-5 h-5" />
                        ) : n.type === 'payment_approved' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : n.type === 'payment_rejected' ? (
                          <XCircle className="w-5 h-5" />
                        ) : n.type === 'free_limit_reached' ||
                          n.type === 'plan_expiry_reminder' ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : n.type === 'pro_limit_reached' ? (
                          <Crown className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>

                      {/* Content Body */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className={`text-sm leading-snug ${
                              n.isRead ? 'font-semibold text-[#1A1A1A]' : 'font-bold text-[#1A1A1A]'
                            }`}
                          >
                            {n.title}
                          </p>
                          <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0 tabular-nums font-numeral-bn">
                            {formatRelativeNotifTimeBn(n.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs sm:text-[13px] text-gray-600 mt-1 leading-relaxed">
                          {n.message}
                        </p>

                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                          <span>{getNotifCategoryLabel(n.type)}</span>
                          {(hasRecipeAction || hasPricingAction) && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-bold inline-flex items-center gap-0.5 ${
                                  hasPricingAction ? 'text-[#B92B27]' : 'text-[#1B4D24]'
                                }`}
                              >
                                {hasRecipeAction
                                  ? 'রেসিপি পোস্টে যান'
                                  : 'প্ল্যান দেখুন / রিনিউ করুন'}
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Real Unread State Indicator */}
                      {!n.isRead && (
                        <span
                          aria-label="অপঠিত"
                          className="w-2.5 h-2.5 rounded-full bg-[#1B4D24] shrink-0 mt-2"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
