import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Clock,
  Loader2,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { db } from '../firebase';
import {
  formatRelativePresenceBn,
  formatUserContact,
  getSubscriptionExpiresMillis,
  isUserOnlineNow,
  markDirectThreadRead,
  sendDirectMessageAsAdmin,
} from '../services/firestoreService';
import type { DirectMessage, DirectMessageThread, UserProfile } from '../types';

interface AdminMessengerPanelProps {
  adminUser: UserProfile;
  siteName?: string;
  compact?: boolean;
  fullPage?: boolean;
}

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

function formatShortTimeBn(ts: unknown): string {
  try {
    let date: Date | null = null;
    if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      date = (ts as { toDate: () => Date }).toDate();
    }
    if (!date) return 'এইমাত্র';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'এইমাত্র';
    if (diffMin < 60) return `${toBengaliDigits(diffMin)} মি.`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${toBengaliDigits(diffHr)} ঘ.`;
    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function formatMessageTimeBn(ts: unknown): string {
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

export const AdminMessengerPanel: React.FC<AdminMessengerPanelProps> = ({
  adminUser,
  siteName = 'রান্না শিখুন',
  compact = false,
  fullPage = false,
}) => {
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => window.clearInterval(t);
  }, []);

  // Live subscription to all directThreads & users
  useEffect(() => {
    setLoadingThreads(true);
    const unsubThreads = onSnapshot(
      collection(db, 'directThreads'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            ...(d.data() as DirectMessageThread),
            userId: d.id,
          }))
          .filter((t) => t.userId !== adminUser.uid);
        setThreads(list);
        setLoadingThreads(false);
      },
      () => {
        setLoadingThreads(false);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsersList(
          snap.docs
            .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
            .filter((u) => u.uid !== adminUser.uid)
        );
      },
      () => {}
    );

    return () => {
      unsubThreads();
      unsubUsers();
    };
  }, [adminUser.uid]);

  const usersByUid = useMemo(() => {
    const map = new Map<string, UserProfile>();
    usersList.forEach((u) => map.set(u.uid, u));
    return map;
  }, [usersList]);

  const sortedThreads = useMemo(() => {
    const getMs = (ts: unknown) => getSubscriptionExpiresMillis(ts) ?? 0;
    return [...threads].sort((a, b) => getMs(b.updatedAt) - getMs(a.updatedAt));
  }, [threads]);

  // Auto-select latest conversation on desktop full view if none selected
  useEffect(() => {
    if (!compact && !selectedUserId && sortedThreads.length > 0) {
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
        setSelectedUserId(sortedThreads[0].userId);
      }
    }
  }, [compact, selectedUserId, sortedThreads]);

  // Live messages for currently selected conversation
  useEffect(() => {
    if (!selectedUserId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    setLoadingMessages(true);
    setSendError(null);
    const q = query(
      collection(db, 'directThreads', selectedUserId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<DirectMessage, 'id'>),
          }))
        );
        setLoadingMessages(false);
        markDirectThreadRead(selectedUserId, 'admin').catch(() => {});
      },
      () => {
        setLoadingMessages(false);
      }
    );
    markDirectThreadRead(selectedUserId, 'admin').catch(() => {});
    return () => unsub();
  }, [selectedUserId]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, selectedUserId]);

  const qLower = searchTerm.trim().toLowerCase();

  const filteredThreads = useMemo(() => {
    if (!qLower) return sortedThreads;
    return sortedThreads.filter((t) => {
      const matched = usersByUid.get(t.userId);
      const hay = [
        t.userName,
        t.userContact,
        t.lastMessage,
        matched?.displayName,
        matched?.email,
        matched?.phoneNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(qLower);
    });
  }, [sortedThreads, usersByUid, qLower]);

  // Members without an existing thread (shown when Admin searches to start a new chat)
  const newChatSuggestions = useMemo(() => {
    if (!qLower) return [];
    const existingIds = new Set(threads.map((t) => t.userId));
    return usersList
      .filter((u) => !existingIds.has(u.uid))
      .filter((u) => {
        const hay = [
          u.displayName,
          u.email,
          u.phoneNumber,
          formatUserContact(u.email, u.phoneNumber),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(qLower);
      })
      .slice(0, 6);
  }, [qLower, threads, usersList]);

  const activeThread = selectedUserId
    ? threads.find((t) => t.userId === selectedUserId) || null
    : null;
  const activeUserProfile = selectedUserId ? usersByUid.get(selectedUserId) || null : null;

  const activeTargetUser: Pick<
    UserProfile,
    'uid' | 'displayName' | 'email' | 'phoneNumber' | 'photoURL'
  > | null = selectedUserId
    ? activeUserProfile || {
        uid: selectedUserId,
        displayName: activeThread?.userName || 'সদস্য',
        email: activeThread?.userContact || '',
        photoURL: activeThread?.userPhotoURL,
      }
    : null;

  const activeOnline = isUserOnlineNow(activeUserProfile, nowMs);
  const activePresenceLabel = formatRelativePresenceBn(activeUserProfile, nowMs);

  const totalUnread = threads.reduce((sum, t) => sum + (Number(t.unreadByAdmin) || 0), 0);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || sending || !activeTargetUser) return;
    setSendError(null);
    setSending(true);
    try {
      await sendDirectMessageAsAdmin({
        targetUser: activeTargetUser,
        adminUser,
        text: clean,
      });
      setDraft('');
    } catch {
      setSendError('মেসেজ পাঠানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSending(false);
    }
  };

  // --- Conversation List UI ---
  const renderConversationList = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Messenger Header with Admin Profile Picture */}
      <div
        className={`${
          compact ? 'px-3.5 py-2.5' : 'px-4 py-3'
        } bg-gradient-to-r from-[#EEF6EF] via-[#F7FBF8] to-[#FFFDF5] border-b border-[#1B4D24]/15 flex items-center justify-between gap-2.5`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {adminUser.photoURL ? (
              <img
                src={adminUser.photoURL}
                alt={adminUser.displayName}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border-2 border-[#1B4D24]/30 bg-white shadow-2xs"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#1B4D24] text-white flex items-center justify-center shadow-2xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-[#1A1A1A] truncate">
                {siteName} মেসেঞ্জার
              </p>
              <span className="px-1.5 py-0.5 rounded bg-[#1B4D24] text-white text-[9px] font-bold">
                এডমিন
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-numeral-bn">
              মোট {toBengaliDigits(sortedThreads.length)}টি কথোপকথন
              {totalUnread > 0 ? ` · ${toBengaliDigits(totalUnread)} নতুন` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-gray-100 bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="মেসেঞ্জারে সদস্য খুঁজুন..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-[#F3F4F6] border border-transparent focus:border-[#1B4D24]/30 focus:bg-white rounded-full focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Scrollable Conversations */}
      <div
        className={`flex-1 overflow-y-auto p-1.5 space-y-0.5 ${
          compact ? 'max-h-72 min-h-[200px]' : fullPage ? 'min-h-0' : 'max-h-[420px] min-h-[260px]'
        }`}
      >
        {loadingThreads ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#1B4D24]" />
            কথোপকথন লোড হচ্ছে...
          </div>
        ) : filteredThreads.length === 0 && newChatSuggestions.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center mx-auto">
              <MessageCircle className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
              {qLower ? 'কোনো সদস্য পাওয়া যায়নি' : 'এখনো কোনো কথোপকথন নেই'}
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed max-w-[230px] mx-auto">
              {qLower
                ? 'অন্য নাম বা নম্বর দিয়ে খুঁজে দেখুন।'
                : 'যেকোনো সদস্য মেসেজ দিলে বা আপনি মেসেজ পাঠালে এখানে আলাদা আলাদা conversation তৈরি হবে।'}
            </p>
          </div>
        ) : (
          <>
            {filteredThreads.map((t) => {
              const matched = usersByUid.get(t.userId);
              const photo = matched?.photoURL || t.userPhotoURL;
              const name = matched?.displayName || t.userName || 'সদস্য';
              const online = isUserOnlineNow(matched, nowMs);
              const unread = Number(t.unreadByAdmin) || 0;
              const isSelected = selectedUserId === t.userId;

              return (
                <button
                  key={t.userId}
                  type="button"
                  onClick={() => setSelectedUserId(t.userId)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#EAF5EC]'
                      : unread > 0
                        ? 'bg-[#F5FBF6] hover:bg-[#EDF7EF]'
                        : 'bg-white hover:bg-[#F5F6F7]'
                  }`}
                >
                  <div className="relative shrink-0">
                    {photo ? (
                      <img
                        src={photo}
                        alt={name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover border border-gray-200 bg-white"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] border border-[#1B4D24]/20 flex items-center justify-center font-bold text-sm">
                        {name.trim().charAt(0)}
                      </div>
                    )}
                    <span
                      title={online ? 'অনলাইন' : 'অফলাইন'}
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        online ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs sm:text-[13px] truncate ${
                          unread > 0 ? 'font-extrabold text-[#1A1A1A]' : 'font-bold text-[#1A1A1A]'
                        }`}
                      >
                        {name}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 font-numeral-bn">
                        {formatShortTimeBn(t.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-[11px] truncate ${
                          unread > 0 ? 'font-bold text-[#1B4D24]' : 'text-gray-500'
                        }`}
                      >
                        {t.lastSenderRole === 'admin' ? 'আপনি: ' : ''}
                        {t.lastMessage}
                      </p>
                      {unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#B92B27] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 tabular-nums font-numeral-bn">
                          {unread > 9 ? '৯+' : toBengaliDigits(unread)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {newChatSuggestions.length > 0 && (
              <div className="bg-[#FAFAF8]">
                <p className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                  <UserPlus className="w-3 h-3 text-[#1B4D24]" />
                  নতুন কথোপকথন শুরু করুন
                </p>
                {newChatSuggestions.map((u) => {
                  const online = isUserOnlineNow(u, nowMs);
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => setSelectedUserId(u.uid)}
                      className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-white transition-colors cursor-pointer"
                    >
                      <div className="relative shrink-0">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center font-bold text-xs">
                            {(u.displayName || 'স').trim().charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            online ? 'bg-emerald-500' : 'bg-gray-400'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#1A1A1A] truncate">{u.displayName}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {formatUserContact(u.email, u.phoneNumber)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // --- Active Conversation Chat Thread UI ---
  const renderActiveChat = () => {
    if (!activeTargetUser) {
      return (
        <div className="h-full min-h-[360px] flex flex-col items-center justify-center p-6 text-center bg-[#FAFAF8] space-y-2.5">
          <div className="w-12 h-12 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-[#1A1A1A]">যেকোনো একটি কথোপকথন বেছে নিন</p>
          <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
            বাম পাশের তালিকা থেকে সদস্যের নামে ক্লিক করে মেসেঞ্জারের মতো সরাসরি চ্যাট করুন।
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Selected Member Header */}
        <div className="px-3.5 py-2.5 bg-[#F8FAF8] border-b border-gray-200 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedUserId(null)}
            aria-label="সব কথোপকথন"
            className={`${
              compact ? 'inline-flex' : 'inline-flex md:hidden'
            } w-8 h-8 rounded-full hover:bg-gray-200/70 text-gray-700 items-center justify-center shrink-0 cursor-pointer transition-colors`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="relative shrink-0">
            {activeTargetUser.photoURL ? (
              <img
                src={activeTargetUser.photoURL}
                alt={activeTargetUser.displayName}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-gray-200 bg-white"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] border border-[#1B4D24]/20 flex items-center justify-center font-bold text-xs">
                {(activeTargetUser.displayName || 'স').trim().charAt(0)}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                activeOnline ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-[#1A1A1A] truncate">
              {activeTargetUser.displayName}
            </p>
            <p className="text-[11px] flex items-center gap-1 truncate">
              <span
                className={`font-semibold ${
                  activeOnline ? 'text-emerald-700' : 'text-gray-500'
                }`}
              >
                {activeOnline ? 'অনলাইন · এখন অ্যাক্টিভ' : `অফলাইন`}
              </span>
              {!activeOnline && activePresenceLabel !== 'অ্যাক্টিভিটি নেই' && (
                <span className="text-gray-400 inline-flex items-center gap-0.5 font-numeral-bn">
                  · <Clock className="w-2.5 h-2.5 inline" /> {activePresenceLabel}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Messages Feed */}
        <div
          ref={chatScrollRef}
          className={`flex-1 overflow-y-auto bg-[#F8F9FA] space-y-2.5 ${
            compact
              ? 'max-h-60 min-h-[180px] p-3'
              : fullPage
                ? 'min-h-0 p-4 sm:p-5'
                : 'max-h-[340px] min-h-[250px] p-4'
          }`}
        >
          {loadingMessages ? (
            <div className="py-10 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B4D24]" />
              মেসেজ লোড হচ্ছে...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center space-y-1.5">
              <p className="text-xs sm:text-sm font-bold text-gray-700">
                {activeTargetUser.displayName}-এর সাথে নতুন কথোপকথন
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500">
                নিচে মেসেজ লিখে পাঠান — ইউজারের মেসেজ অপশনে সাথে সাথে পৌঁছে যাবে।
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isFromAdmin = m.senderRole === 'admin';
              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${isFromAdmin ? 'justify-end' : 'justify-start'}`}
                >
                  {!isFromAdmin && (
                    <div className="shrink-0">
                      {activeTargetUser.photoURL ? (
                        <img
                          src={activeTargetUser.photoURL}
                          alt={activeTargetUser.displayName}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center text-[10px] font-bold">
                          {(activeTargetUser.displayName || 'স').trim().charAt(0)}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2 shadow-2xs ${
                      isFromAdmin
                        ? 'bg-[#1B4D24] text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-[#1A1A1A] rounded-bl-sm'
                    }`}
                  >
                    <p className="text-xs sm:text-[13px] whitespace-pre-wrap break-words leading-relaxed">
                      {m.text}
                    </p>
                    <p
                      className={`text-[10px] mt-1 ${
                        isFromAdmin ? 'text-white/75 text-right' : 'text-gray-400'
                      }`}
                    >
                      {formatMessageTimeBn(m.createdAt)}
                    </p>
                  </div>

                  {isFromAdmin && adminUser.photoURL && (
                    <img
                      src={adminUser.photoURL}
                      alt={adminUser.displayName}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover border border-[#1B4D24]/30 shrink-0"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className={`${compact ? 'p-2.5' : 'p-3 sm:p-3.5'} bg-white border-t border-gray-100 space-y-1.5 shrink-0`}
        >
          {sendError && <p className="text-[11px] font-semibold text-red-600">{sendError}</p>}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder={`${activeTargetUser.displayName}-কে মেসেজ লিখুন...`}
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-[#F3F4F6] border border-transparent rounded-full focus:outline-none focus:border-[#1B4D24]/35 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="px-4 py-2.5 rounded-full bg-[#1B4D24] hover:bg-[#143A1B] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>পাঠান</span>
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Compact mode (Header Bell Popover): single-pane drill-down Messenger
  if (compact) {
    return (
      <div className="flex flex-col">
        {selectedUserId ? renderActiveChat() : renderConversationList()}
      </div>
    );
  }

  // Full / Page mode: 2-column Messenger on desktop, drill-down on mobile
  return (
    <div
      className={`overflow-hidden bg-white grid grid-cols-1 md:grid-cols-12 ${
        fullPage
          ? 'h-[calc(100vh-220px)] min-h-[480px] max-h-[700px]'
          : 'rounded-2xl border border-gray-200 min-h-[440px]'
      }`}
    >
      <div
        className={`md:col-span-5 lg:col-span-4 md:border-r border-gray-200 min-h-0 ${
          selectedUserId ? 'hidden md:flex md:flex-col' : 'flex flex-col'
        }`}
      >
        {renderConversationList()}
      </div>
      <div
        className={`md:col-span-7 lg:col-span-8 min-h-0 ${
          selectedUserId ? 'flex flex-col' : 'hidden md:flex md:flex-col'
        }`}
      >
        {renderActiveChat()}
      </div>
    </div>
  );
};
