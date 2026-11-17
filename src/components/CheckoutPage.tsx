import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Phone, ShieldCheck } from 'lucide-react';
import { submitSubscriptionOrder } from '../services/firestoreService';
import type { PageRoute, SiteSettings, SubscriptionPlan, UserProfile } from '../types';

interface CheckoutPageProps {
  plan: SubscriptionPlan | undefined;
  user: UserProfile | null;
  siteSettings: SiteSettings;
  onNavigate: (route: PageRoute) => void;
  onRequireAuth?: (planId: string) => void;
  onOrderComplete: (status: 'active' | 'pending', planName: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  plan,
  user,
  siteSettings,
  onNavigate,
  onRequireAuth,
  onOrderComplete,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'বিকাশ' | 'নগদ' | 'রকেট' | 'ব্যাংক'>('বিকাশ');
  const [senderNumber, setSenderNumber] = useState('');
  const [txId, setTxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<'active' | 'pending' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!plan) {
    return (
      <section className="max-w-lg mx-auto px-4 py-14 text-center space-y-4">
        <h1 className="font-display-bn text-2xl font-bold">প্ল্যান পাওয়া যায়নি</h1>
        <button
          type="button"
          onClick={() => onNavigate({ page: 'pricing' })}
          className="px-5 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
        >
          সদস্যপদ পেজে যান
        </button>
      </section>
    );
  }

  const isFree = plan.tier === 'basic' && plan.priceAmount === 0;

  const goToLogin = () => {
    if (onRequireAuth) {
      onRequireAuth(plan.id);
    } else {
      onNavigate({ page: 'login' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      goToLogin();
      return;
    }

    const cleanSender = senderNumber.trim();
    const cleanTx = txId.trim();

    if (!isFree) {
      if (!cleanSender && !cleanTx) {
        setError('অনুগ্রহ করে প্রমাণ হিসেবে প্রেরক নম্বর অথবা ট্রানজেকশন আইডি (TxID)—যেকোনো একটি বা দুটিই লিখুন।');
        return;
      }
      if (cleanSender && cleanSender.length < 6) {
        setError('সঠিক প্রেরক নম্বর লিখুন (কমপক্ষে ৬ অক্ষরের হতে হবে)।');
        return;
      }
      if (cleanTx && cleanTx.length < 3) {
        setError('সঠিক ট্রানজেকশন আইডি (TxID) লিখুন (কমপক্ষে ৩ অক্ষরের হতে হবে)।');
        return;
      }
    }

    setError(null);
    setLoading(true);
    try {
      const result = await submitSubscriptionOrder({
        user,
        plan,
        paymentMethod: isFree ? 'ফ্রি' : paymentMethod,
        senderNumber: isFree ? '-' : cleanSender,
        transactionId: isFree ? `FREE_${Date.now()}` : cleanTx,
      });
      setSubmittedStatus(result.status);
      onOrderComplete(result.status, plan.name);
    } catch {
      setError('আবেদন জমা দেওয়া যায়নি। অনুগ্রহ করে তথ্য যাচাই করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const cleanSenderDisplay = senderNumber.trim();
  const cleanTxDisplay = txId.trim();

  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <button
        type="button"
        onClick={() => onNavigate({ page: 'pricing' })}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#1B4D24] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        সব সদস্যপদ প্ল্যানে ফিরুন
      </button>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="border-b border-gray-100 pb-5">
          <h1 className="font-display-bn text-2xl font-bold text-[#1A1A1A]">
            {plan.name === 'Basic' ? 'বেসিক' : plan.name} প্ল্যান — পেমেন্ট ও ভেরিফিকেশন
          </h1>
          <p className="text-sm text-gray-600 mt-1">{plan.durationLabel}</p>
        </div>

        {submittedStatus === 'pending' && (
          <div className="p-6 rounded-2xl bg-[#FFFBEB] border border-[#D4A017]/50 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#D4A017]/20 text-[#9A7209] flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#1A1A1A]">
              পেমেন্টের প্রমাণ সফলভাবে জমা হয়েছে!
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              আপনার প্রেরিত তথ্য (
              {cleanSenderDisplay && (
                <>
                  প্রেরক নম্বর: <span className="font-bold tabular-nums">{cleanSenderDisplay}</span>
                  {cleanTxDisplay ? ' · ' : ''}
                </>
              )}
              {cleanTxDisplay && (
                <>
                  TxID: <span className="font-bold">{cleanTxDisplay}</span>
                </>
              )}
              ) এডমিন যাচাই করছেন। অনুমোদন হওয়ার সাথে সাথেই আপনার প্রিমিয়াম রেসিপি আনলক হয়ে যাবে।
            </p>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'profile' })}
              className="px-5 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
            >
              প্রোফাইলে স্ট্যাটাস দেখুন
            </button>
          </div>
        )}

        {submittedStatus === 'active' && (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-[#1B4D24]" />
            <h2 className="text-lg font-bold text-[#1B4D24]">
              {plan.name === 'Basic' ? 'বেসিক' : plan.name} প্ল্যান সক্রিয় হয়েছে!
            </h2>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'recipes' })}
              className="px-5 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
            >
              রেসিপি দেখুন
            </button>
          </div>
        )}

        {!submittedStatus && !user && (
          <div className="p-6 rounded-2xl bg-[#FAFAF8] border border-gray-200 text-center space-y-3">
            <p className="text-sm font-medium text-gray-800">
              সাবস্ক্রিপশন আবেদন করার আগে অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন বা নিবন্ধন করুন। লগইন করলেই আবার এই পেমেন্ট পেজে ফিরে আসবেন।
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="px-6 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
            >
              লগইন / নিবন্ধন পেজে যান
            </button>
          </div>
        )}

        {!submittedStatus && user && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isFree && (
              <>
                {/* Admin Payment Instructions Box */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F8F5] border border-gray-200 space-y-2.5 text-sm">
                  <p className="font-bold text-[#1B4D24]">পেমেন্ট পাঠানোর নম্বরসমূহ:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                    <div className="p-3 rounded-xl bg-white border border-gray-200">
                      <p className="text-gray-500 text-xs">বিকাশ (bKash)</p>
                      <p className="font-bold text-[#1A1A1A] mt-0.5 tabular-nums">
                        {siteSettings.paymentBkashNumber || '০১৭১১-০০০০০০ (পার্সোনাল)'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-gray-200">
                      <p className="text-gray-500 text-xs">নগদ (Nagad)</p>
                      <p className="font-bold text-[#1A1A1A] mt-0.5 tabular-nums">
                        {siteSettings.paymentNagadNumber || '০১৭১১-০০০০০০ (পার্সোনাল)'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed pt-1">
                    {siteSettings.paymentInstructions ||
                      'উপরের বিকাশ বা নগদ নম্বরে নির্ধারিত টাকা Send Money করে নিচের ফর্মে আপনার প্রেরক নম্বর অথবা ট্রানজেকশন আইডি (TxID) জমা দিন।'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    যে মাধ্যমে টাকা পাঠিয়েছেন
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['বিকাশ', 'নগদ', 'রকেট', 'ব্যাংক'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                          paymentMethod === method
                            ? 'border-[#1B4D24] bg-[#1B4D24]/10 text-[#1B4D24]'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#F3F8F4] border border-[#1B4D24]/20 text-xs font-medium text-[#1B4D24]">
                    প্রমাণ হিসেবে যে নম্বর থেকে টাকা পাঠিয়েছেন সেই নম্বর অথবা ট্রানজেকশন আইডি (TxID)—যেকোনো একটি বা দুটিই দিতে পারেন।
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        আপনার {paymentMethod} নম্বর <span className="text-gray-400 font-normal">(ঐচ্ছিক)</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={senderNumber}
                          onChange={(e) => setSenderNumber(e.target.value)}
                          placeholder="017XXXXXXXX"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        ট্রানজেকশন আইডি (TxID) <span className="text-gray-400 font-normal">(ঐচ্ছিক)</span>
                      </label>
                      <input
                        type="text"
                        value={txId}
                        onChange={(e) => setTxId(e.target.value)}
                        placeholder="যেমন: BH89K2L01P"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">নির্বাচিত প্ল্যান</span>
                <span className="font-bold text-[#1A1A1A]">
                  {plan.name === 'Basic' ? 'বেসিক' : plan.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">মোট মূল্য</span>
                <span className="font-bold text-[#1B4D24] tabular-nums">{plan.priceLabel}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading
                ? 'জমা হচ্ছে...'
                : isFree
                  ? 'ফ্রি প্ল্যান অ্যাক্টিভেট করুন'
                  : 'ভেরিফিকেশনের জন্য জমা দিন'}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] sm:text-xs text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1B4D24] shrink-0" />
              <span>
                {isFree
                  ? 'বাটনে ক্লিক করলেই আপনার ফ্রি প্ল্যান সাথে সাথে চালু হয়ে যাবে।'
                  : 'তথ্য জমা দিয়ে অনুগ্রহ করে অল্প সময় অপেক্ষা করুন—যাচাই শেষেই আপনার প্ল্যান চালু হয়ে যাবে।'}
              </span>
            </p>
          </form>
        )}
      </div>
    </section>
  );
};
