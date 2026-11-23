import React, { useEffect, useRef, useState } from 'react';
import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  Crown,
  Globe,
  Loader2,
  MapPin,
  MessageCircle,
  Monitor,
  Send,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
  X,
  ZoomIn,
} from 'lucide-react';
import { db } from '../firebase';
import {
  formatRelativePresenceBn,
  formatUserContact,
  isBootstrappedModeratorEmail,
  isUserOnlineNow,
  markDirectThreadRead,
  sendDirectMessageAsAdmin,
} from '../services/firestoreService';
import type { DirectMessage, UserProfile } from '../types';

interface AdminMemberPreviewModalProps {
  member: UserProfile;
  adminUser: UserProfile;
  nowMs: number;
  onClose: () => void;
  onMessageSent?: (memberName: string) => void;
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'বেসিক (ফ্রি)',
  standard: 'স্ট্যান্ডার্ড',
  pro: 'প্রো',
};

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

function formatMsgTimeBn(ts: unknown): string {
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

export const AdminMemberPreviewModal: React.FC<AdminMemberPreviewModalProps> = ({
  member,
  adminUser,
  nowMs,
  onClose,
  onMessageSent,
}) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const online = isUserOnlineNow(member, nowMs);
  const presenceLabel = formatRelativePresenceBn(member, nowMs);
  const isAdminAcc = member.role === 'admin';
  const isModAcc = member.role === 'moderator' || isBootstrappedModeratorEmail(member.email);
  const isMobileDevice = Boolean(
    member.lastLoginDevice &&
      (member.lastLoginDevice.includes('মোবাইল') ||
        member.lastLoginDevice.includes('আইফোন') ||
        member.lastLoginDevice.includes('Android') ||
        member.lastLoginDevice.includes('iOS'))
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (photoZoomed) setPhotoZoomed(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, photoZoomed]);

  useEffect(() => {
    setLoadingMsgs(true);
    const q = query(
      collection(db, 'directThreads', member.uid, 'messages'),
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
        setLoadingMsgs(false);
        markDirectThreadRead(member.uid, 'admin').catch(() => {});
      },
      () => {
        setLoadingMsgs(false);
      }
    );
    markDirectThreadRead(member.uid, 'admin').catch(() => {});
    return () => unsub();
  }, [member.uid]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || sending) return;
    setSendError(null);
    setSendFeedback(null);
    setSending(true);
    try {
      await sendDirectMessageAsAdmin({
        targetUser: member,
        adminUser,
        text: clean,
      });
      setDraft('');
      setSendFeedback('মেসেজ পাঠানো হয়েছে এবং সদস্যের কাছে নোটিফিকেশন পৌঁছে গেছে।');
      onMessageSent?.(member.displayName || 'সদস্য');
      setTimeout(() => setSendFeedback(null), 3500);
    } catch {
      setSendError('মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="সদস্যের প্রোফাইল প্রিভিউ ও সরাসরি মেসেজ"
    >
      <div
        className="relative max-w-2xl w-full max-h-[92vh] bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Profile Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#EEF6EF] via-[#F9FBF9] to-[#FFFDF5] border-b border-gray-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              {member.photoURL ? (
                <button
                  type="button"
                  onClick={() => setPhotoZoomed(true)}
                  title="প্রোফাইল ছবি বড় করে দেখুন"
                  className="relative group w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#1B4D24]/30 hover:border-[#1B4D24] bg-white shadow-sm cursor-pointer transition-all"
                >
                  <img
                    src={member.photoURL}
                    alt={member.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-4 h-4 text-white" />
                  </span>
                </button>
              ) : (
                <div className="w-16 h-16 rounded-2xl border-2 border-[#1B4D24]/20 bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center font-bold text-2xl">
                  {(member.displayName || 'স').trim().charAt(0)}
                </div>
              )}
              <span
                title={online ? 'অনলাইন' : 'অফলাইন'}
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                  online ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-base sm:text-lg font-bold text-[#1A1A1A] truncate">
                  {member.displayName || 'সদস্য'}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    online
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  {online ? 'অনলাইন' : 'অফলাইন'}
                </span>
                {isAdminAcc && (
                  <span className="px-2 py-0.5 rounded-md bg-[#1B4D24] text-white text-[10px] font-bold inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    এডমিন
                  </span>
                )}
                {!isAdminAcc && isModAcc && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                    মোডারেটর
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-600 truncate">
                {formatUserContact(member.email, member.phoneNumber)}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 font-semibold text-[#1B4D24]">
                  <Crown className="w-3 h-3 text-[#D4A017]" />
                  {PLAN_LABELS[member.subscriptionPlan] || member.subscriptionPlan}
                </span>
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <Clock className="w-3 h-3" />
                  {presenceLabel}
                </span>
                {typeof member.age === 'number' && member.age > 0 && (
                  <span className="inline-flex items-center gap-1 text-gray-500 font-numeral-bn">
                    <UserIcon className="w-3 h-3" />
                    বয়স: {toBengaliDigits(member.age)} বছর
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content: Login Metadata + Direct Chat */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Device, Login Area & Profile Address Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#F8FAF8] border border-[#1B4D24]/15 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center shrink-0">
                {isMobileDevice ? (
                  <Smartphone className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500">লগইন ডিভাইস</p>
                <p className="text-xs font-bold text-[#1A1A1A] mt-0.5 break-words">
                  {member.lastLoginDevice || 'এখনো লগইন ডিভাইস রেকর্ড হয়নি'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#FFFDF5] border border-[#D4A017]/25 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#D4A017]/15 text-[#9A7209] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500">লগইন এলাকা</p>
                <p className="text-xs font-bold text-[#1A1A1A] mt-0.5 break-words">
                  {member.lastLoginLocation || 'এখনো এলাকা রেকর্ড হয়নি'}
                </p>
              </div>
            </div>

            {member.address && member.address.trim() ? (
              <div className="sm:col-span-2 p-3 rounded-2xl bg-[#F3F7FE] border border-blue-200/70 flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-blue-700">প্রোফাইলে দেওয়া ঠিকানা</p>
                  <p className="text-xs font-bold text-[#1A1A1A] mt-0.5 break-words">
                    {member.address}
                  </p>
                </div>
              </div>
            ) : (
              <div className="sm:col-span-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200/70 flex items-center gap-2 text-xs text-gray-500">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>এই সদস্য প্রোফাইলে এখনো কোনো ঠিকানা যুক্ত করেননি।</span>
              </div>
            )}
          </div>

          {/* Direct Admin-to-User Messaging Panel */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-[#FAFAF8] border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#1B4D24]" />
                <p className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
                  সদস্যকে সরাসরি মেসেজ পাঠান
                </p>
              </div>
              <span className="text-[11px] text-gray-500">
                মেসেজ পাঠালে ইউজার নোটিফিকেশন ও মেসেজ ট্যাবে পাবে
              </span>
            </div>

            <div
              ref={chatScrollRef}
              className="max-h-56 min-h-[150px] overflow-y-auto p-3.5 bg-[#FCFCFA] space-y-2.5"
            >
              {loadingMsgs ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1B4D24]" />
                  কথোপকথন লোড হচ্ছে...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-6 text-center space-y-1">
                  <p className="text-xs font-bold text-gray-700">
                    এখনো কোনো মেসেজ আদান-প্রদান হয়নি
                  </p>
                  <p className="text-[11px] text-gray-500">
                    নিচে মেসেজ লিখে পাঠালে {member.displayName}-এর নোটিফিকেশন ও মেসেজ ট্যাবে চলে যাবে।
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isAdminMsg = m.senderRole === 'admin';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-2xs ${
                          isAdminMsg
                            ? 'bg-[#1B4D24] text-white rounded-tr-sm'
                            : 'bg-white border border-gray-200 text-[#1A1A1A] rounded-tl-sm'
                        }`}
                      >
                        <p
                          className={`text-[10px] font-bold mb-0.5 ${
                            isAdminMsg ? 'text-emerald-200' : 'text-[#1B4D24]'
                          }`}
                        >
                          {isAdminMsg ? `এডমিন (${m.senderName || 'আপনি'})` : m.senderName || member.displayName}
                        </p>
                        <p className="text-xs sm:text-[13px] whitespace-pre-wrap break-words leading-relaxed">
                          {m.text}
                        </p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isAdminMsg ? 'text-white/75 text-right' : 'text-gray-400'
                          }`}
                        >
                          {formatMsgTimeBn(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSend}
              className="p-3 bg-white border-t border-gray-100 space-y-2"
            >
              {sendFeedback && (
                <p className="text-xs font-semibold text-[#1B4D24] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  {sendFeedback}
                </p>
              )}
              {sendError && <p className="text-xs font-semibold text-red-600">{sendError}</p>}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={1000}
                  placeholder={`${member.displayName}-কে মেসেজ লিখুন...`}
                  className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-[#FAFAF8] border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24] focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>পাঠান</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Full-Size Photo Zoom Overlay (when clicking profile photo inside preview) */}
      {photoZoomed && member.photoURL && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setPhotoZoomed(false);
          }}
        >
          <div className="relative max-w-lg w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPhotoZoomed(false)}
              aria-label="ছবি জুম বন্ধ করুন"
              className="self-end mb-2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 flex items-center justify-center cursor-pointer shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={member.photoURL}
              alt={member.displayName}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border-2 border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
