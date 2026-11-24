import React, { useEffect, useRef, useState } from 'react';
import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Loader2, Mail, MessageCircle, Send, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import {
  SUPER_ADMIN_EMAIL,
  markDirectThreadRead,
  sendDirectMessageAsUser,
} from '../services/firestoreService';
import type { DirectMessage, UserProfile } from '../types';

interface UserAdminChatPanelProps {
  user: UserProfile;
  siteName?: string;
  adminContactEmail?: string;
  adminPhotoUrl?: string;
  adminDisplayName?: string;
  compact?: boolean;
  fullPage?: boolean;
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

export const UserAdminChatPanel: React.FC<UserAdminChatPanelProps> = ({
  user,
  siteName = 'রান্না শিখুন',
  adminContactEmail,
  adminPhotoUrl,
  adminDisplayName,
  compact = false,
  fullPage = false,
}) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const officialAdminEmail = (adminContactEmail || SUPER_ADMIN_EMAIL).trim();
  const resolvedAdminPhoto = (adminPhotoUrl || '').trim();
  const resolvedAdminTitle = (adminDisplayName || '').trim() || `${siteName} এডমিন সাপোর্ট`;
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'directThreads', user.uid, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DirectMessage, 'id'>),
        }));
        setMessages(list);
        setLoading(false);
        markDirectThreadRead(user.uid, 'user').catch(() => {});
      },
      () => {
        setLoading(false);
      }
    );
    markDirectThreadRead(user.uid, 'user').catch(() => {});
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || sending) return;
    setError(null);
    setSending(true);
    try {
      await sendDirectMessageAsUser({ user, text: clean });
      setDraft('');
    } catch {
      setError('মেসেজ পাঠানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSending(false);
    }
  };

  const renderAdminAvatar = (sizeClass = 'w-11 h-11', iconClass = 'w-5 h-5') => (
    <div className="relative shrink-0">
      {resolvedAdminPhoto ? (
        <div className={`${sizeClass} rounded-full overflow-hidden border border-[#1B4D24]/25 bg-white`}>
          <img
            src={resolvedAdminPhoto}
            alt={resolvedAdminTitle}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-[#1B4D24] text-white flex items-center justify-center`}
        >
          <ShieldCheck className={iconClass} />
        </div>
      )}
      <span
        title="অফিসিয়াল এডমিন সাপোর্ট"
        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"
      />
    </div>
  );

  const renderMessageStream = () => (
    <div
      ref={scrollRef}
      className={`${
        compact
          ? 'max-h-60 min-h-[168px] p-3'
          : fullPage
            ? 'flex-1 min-h-0 p-4 sm:p-5'
            : 'max-h-96 min-h-[220px] p-4'
      } overflow-y-auto bg-[#F8F9FA] space-y-2.5`}
    >
      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#1B4D24]" />
          মেসেজ লোড হচ্ছে...
        </div>
      ) : messages.length === 0 ? (
        <div className="py-10 px-4 text-center space-y-2.5 max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center mx-auto">
            <MessageCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-[#1A1A1A]">
            {resolvedAdminTitle}-এর সাথে চ্যাট শুরু করুন
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            যেকোনো প্রয়োজনে—রেসিপি, পেমেন্ট বা সদস্যপদ সংক্রান্ত যেকোনো প্রশ্নে নিচের বক্সে লিখে সরাসরি এডমিনকে মেসেজ করুন।
          </p>
        </div>
      ) : (
        messages.map((m) => {
          const isFromAdmin = m.senderRole === 'admin';
          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${isFromAdmin ? 'justify-start' : 'justify-end'}`}
            >
              {isFromAdmin &&
                (resolvedAdminPhoto ? (
                  <img
                    src={resolvedAdminPhoto}
                    alt={m.senderName || 'এডমিন'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-[#1B4D24]/25 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1B4D24] text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                ))}
              <div
                className={`max-w-[82%] sm:max-w-[74%] rounded-[20px] px-3.5 py-2.5 ${
                  isFromAdmin
                    ? 'bg-white border border-gray-200/80 text-[#1A1A1A] rounded-bl-sm'
                    : 'bg-[#1B4D24] text-white rounded-br-sm'
                }`}
              >
                {isFromAdmin && (
                  <p className="text-[10.5px] font-bold text-[#1B4D24] mb-0.5">
                    {m.senderName || resolvedAdminTitle}
                  </p>
                )}
                <p className="text-xs sm:text-[13.5px] whitespace-pre-wrap break-words leading-relaxed">
                  {m.text}
                </p>
                <p
                  className={`text-[10px] mt-1 tabular-nums ${
                    isFromAdmin ? 'text-gray-400' : 'text-white/75 text-right'
                  }`}
                >
                  {formatMessageTimeBn(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderComposer = () => (
    <form
      onSubmit={handleSend}
      className={`${compact ? 'p-2.5' : 'p-3 sm:p-3.5'} bg-white border-t border-gray-100 space-y-1.5 shrink-0`}
    >
      {error && <p className="text-[11px] font-semibold text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder="এডমিনকে আপনার মেসেজ লিখুন..."
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
  );

  // Full Messenger Page Mode: 2-column Messenger workspace on desktop, seamless chat on mobile
  if (fullPage) {
    return (
      <div className="bg-white grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-220px)] min-h-[480px] max-h-[700px] overflow-hidden">
        {/* Desktop Left Sidebar: Messenger Conversation List showing Official Admin ID */}
        <aside className="hidden md:flex md:col-span-4 md:flex-col border-r border-gray-200 bg-white min-h-0">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#1A1A1A]">চ্যাট তালিকা</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">অফিশিয়াল এডমিন সাপোর্ট</p>
          </div>

          <div className="p-2 flex-1 overflow-y-auto space-y-2">
            <div className="w-full text-left px-3 py-3 rounded-xl bg-[#EAF5EC] flex items-center gap-3">
              {renderAdminAvatar('w-12 h-12', 'w-5 h-5')}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-[13px] font-bold text-[#1A1A1A] truncate">
                    {resolvedAdminTitle}
                  </p>
                  {lastMsg && (
                    <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
                      {formatMessageTimeBn(lastMsg.createdAt).split(',')[0]}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#1B4D24] font-medium truncate mt-0.5">
                  {lastMsg
                    ? `${lastMsg.senderRole === 'user' ? 'আপনি: ' : ''}${lastMsg.text}`
                    : 'যেকোনো প্রয়োজনে এডমিনকে মেসেজ করুন'}
                </p>
              </div>
            </div>

            <div className="px-3 py-3 text-xs text-gray-600 leading-relaxed space-y-1.5">
              <p className="font-semibold text-[#1A1A1A]">সরাসরি এডমিন আইডি</p>
              <p className="inline-flex items-center gap-1.5 text-[11px] text-[#1B4D24] font-medium break-all">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {officialAdminEmail}
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                যেকোনো প্রয়োজনে, রেসিপি, পেমেন্ট বা সদস্যপদ সংক্রান্ত সাহায্যের জন্য সরাসরি এখানে মেসেজ পাঠান। এডমিন এখান থেকেই উত্তর দেবেন।
              </p>
            </div>
          </div>
        </aside>

        {/* Right Active Messenger Chat Pane */}
        <div className="md:col-span-8 flex flex-col min-h-0 bg-white">
          <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
            {renderAdminAvatar('w-10 h-10', 'w-4 h-4')}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[#1A1A1A] truncate">{resolvedAdminTitle}</p>
                <span className="text-[11px] font-semibold text-[#1B4D24]">· এডমিন আইডি</span>
              </div>
              <p className="text-[11px] text-gray-500 truncate">
                {officialAdminEmail} · যেকোনো প্রয়োজনে এডমিনকে মেসেজ করুন
              </p>
            </div>
          </div>

          {renderMessageStream()}
          {renderComposer()}
        </div>
      </div>
    );
  }

  // Compact Mode (Header Popover) or Standard Embedded Mode
  return (
    <div
      className={
        compact
          ? 'flex flex-col'
          : 'flex flex-col rounded-2xl border border-gray-200 overflow-hidden bg-white'
      }
    >
      {/* Official Admin Identity Card */}
      <div
        className={`${
          compact ? 'px-3.5 py-3' : 'px-4 py-3.5 sm:px-5 sm:py-4'
        } bg-gradient-to-r from-[#EEF6EF] via-[#F7FBF8] to-[#FFFDF5] border-b border-[#1B4D24]/15`}
      >
        <div className="flex items-start gap-3">
          {renderAdminAvatar('w-11 h-11', 'w-5 h-5')}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-[#1A1A1A] truncate">
                {resolvedAdminTitle}
              </p>
              <span className="text-[11px] font-semibold text-[#1B4D24]">· এডমিন আইডি</span>
            </div>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#1B4D24] font-semibold break-all">
              <Mail className="w-3 h-3 shrink-0" />
              {officialAdminEmail}
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-gray-600 leading-relaxed">
              যেকোনো প্রয়োজনে, রেসিপি, পেমেন্ট বা সাবস্ক্রিপশন সংক্রান্ত সাহায্যের জন্য সরাসরি এডমিনকে মেসেজ করুন।
            </p>
          </div>
        </div>
      </div>

      {renderMessageStream()}
      {renderComposer()}
    </div>
  );
};
