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
  compact?: boolean;
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
  compact = false,
}) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const officialAdminEmail = (adminContactEmail || SUPER_ADMIN_EMAIL).trim();

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

  return (
    <div className={compact ? 'flex flex-col' : 'flex flex-col rounded-2xl border border-gray-200 overflow-hidden bg-white'}>
      {/* Official Admin Identity Card */}
      <div
        className={`${
          compact ? 'px-3.5 py-3' : 'px-4 py-3.5 sm:px-5 sm:py-4'
        } bg-gradient-to-r from-[#EEF6EF] via-[#F7FBF8] to-[#FFFDF5] border-b border-[#1B4D24]/15`}
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#1B4D24] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span
              title="অফিসিয়াল এডমিন সাপোর্ট"
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-[#1A1A1A] truncate">
                {siteName} এডমিন সাপোর্ট
              </p>
              <span className="px-1.5 py-0.5 rounded bg-[#1B4D24] text-white text-[10px] font-bold">
                এডমিন আইডি
              </span>
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

      {/* Conversation History */}
      <div
        ref={scrollRef}
        className={`${
          compact ? 'max-h-60 min-h-[168px] p-3' : 'max-h-96 min-h-[220px] p-4'
        } overflow-y-auto bg-[#FAFAF8] space-y-2.5`}
      >
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#1B4D24]" />
            মেসেজ লোড হচ্ছে...
          </div>
        ) : messages.length === 0 ? (
          <div className="py-7 px-3 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center mx-auto">
              <MessageCircle className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
              এখনো কোনো কথোপকথন শুরু হয়নি
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
              এডমিনের কোনো বার্তা এখানে দেখা যাবে। নিচের বক্সে লিখে আপনিও সরাসরি এডমিনকে মেসেজ পাঠাতে পারেন।
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isFromAdmin = m.senderRole === 'admin';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isFromAdmin ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                    isFromAdmin
                      ? 'bg-white border border-[#1B4D24]/20 text-[#1A1A1A] rounded-tl-sm'
                      : 'bg-[#1B4D24] text-white rounded-tr-sm'
                  }`}
                >
                  {isFromAdmin && (
                    <p className="text-[10px] font-bold text-[#1B4D24] mb-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {m.senderName || 'এডমিন'}
                    </p>
                  )}
                  <p className="text-xs sm:text-[13px] whitespace-pre-wrap break-words leading-relaxed">
                    {m.text}
                  </p>
                  <p
                    className={`text-[10px] mt-1 ${
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

      {/* Message Input Box */}
      <form
        onSubmit={handleSend}
        className={`${compact ? 'p-2.5' : 'p-3 sm:p-3.5'} bg-white border-t border-gray-100 space-y-1.5`}
      >
        {error && <p className="text-[11px] font-semibold text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            placeholder="এডমিনকে আপনার মেসেজ লিখুন..."
            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-[#FAFAF8] border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24] focus:bg-white transition-colors"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="px-3.5 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
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
