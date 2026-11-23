import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { ArrowLeft, Lock, Phone, User as UserIcon } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import {
  isSuperAdminEmail,
  resolveAuthIdentifier,
  syncUserProfile,
} from '../services/firestoreService';
import type { PageRoute, SubscriptionPlan, UserProfile } from '../types';
import { BrandMark } from './BrandMark';

interface AuthPageProps {
  siteName: string;
  onNavigate: (route: PageRoute) => void;
  onAuthSuccess?: () => void;
  onProfileSynced?: (profile: UserProfile) => void;
  pendingPlan?: SubscriptionPlan | null;
  returnRoute?: PageRoute | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  siteName,
  onNavigate,
  onAuthSuccess,
  onProfileSynced,
  pendingPlan = null,
  returnRoute = null,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsConsoleEnable, setNeedsConsoleEnable] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSuccessRedirect = (userEmail?: string | null) => {
    if (onAuthSuccess) onAuthSuccess();
    if (pendingPlan) {
      onNavigate({ page: 'checkout', planId: pendingPlan.id });
    } else if (returnRoute && returnRoute.page !== 'login') {
      onNavigate(returnRoute);
    } else if (isSuperAdminEmail(userEmail)) {
      onNavigate({ page: 'admin' });
    } else {
      onNavigate({ page: 'profile' });
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMsg(null);
    setNeedsConsoleEnable(false);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const profile = await syncUserProfile(cred.user);
      onProfileSynced?.(profile);
      handleSuccessRedirect(cred.user.email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed-by-user')) {
        setError('লগইন পপআপ বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } else {
        setError('গুগল দিয়ে লগইন করা যায়নি। অনুগ্রহ করে ব্রাউজার পপআপ অনুমতি দিন।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setNeedsConsoleEnable(false);

    const raw = identifier.trim();
    if (!raw.includes('@')) {
      const digitCount = raw.replace(/\D/g, '').length;
      if (digitCount < 7 || digitCount > 15) {
        setError('সঠিক ইমেইল ঠিকানা অথবা বৈধ ফোন নম্বর লিখুন।');
        return;
      }
    }

    const { authEmail, isPhone, phoneNumber } = resolveAuthIdentifier(raw);
    const isAdminAttempt = !isPhone && isSuperAdminEmail(authEmail) && password === '200696';

    setLoading(true);
    try {
      if (mode === 'signup') {
        const cleanName = name.trim();
        const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName });
        }
        if (!isPhone) {
          sendEmailVerification(cred.user).catch(() => {});
        }
        const profile = await syncUserProfile(cred.user, {
          displayName: cleanName || undefined,
          phoneNumber,
        });
        onProfileSynced?.(profile);
        handleSuccessRedirect(cred.user.email);
      } else {
        try {
          const cred = await signInWithEmailAndPassword(auth, authEmail, password);
          const profile = await syncUserProfile(cred.user, { phoneNumber });
          onProfileSynced?.(profile);
          handleSuccessRedirect(cred.user.email);
        } catch (loginErr: unknown) {
          const code = (loginErr as { code?: string })?.code || '';
          if (isAdminAttempt && (code === 'auth/user-not-found' || code === 'auth/invalid-credential')) {
            const created = await createUserWithEmailAndPassword(auth, authEmail, password);
            await updateProfile(created.user, { displayName: 'এডমিন (রান্না শিখুন)' });
            await sendEmailVerification(created.user);
            setInfoMsg(
              'এডমিন অ্যাকাউন্ট তৈরি হয়েছে এবং ভেরিফিকেশন লিংক আপনার ইমেইলে পাঠানো হয়েছে। অথবা উপরের Google বাটনে ক্লিক করে সরাসরি এডমিন প্যানেলে প্রবেশ করতে পারেন।'
            );
          } else {
            throw loginErr;
          }
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setNeedsConsoleEnable(true);
        setError(
          'Firebase প্রজেক্টে Email/Password সাইন-ইন পদ্ধতিটি এখনো চালু করা হয়নি। উপরের Google বাটন দিয়ে সরাসরি প্রবেশ করুন অথবা নিচের নির্দেশনা অনুযায়ী চালু করুন।'
        );
      } else if (code === 'auth/email-already-in-use') {
        setError('এই ইমেইল বা ফোন নম্বরটি আগে থেকেই নিবন্ধিত। অনুগ্রহ করে লগইন করুন।');
      } else if (code === 'auth/invalid-email') {
        setError('দয়া করে সঠিক ইমেইল ঠিকানা অথবা ফোন নম্বর লিখুন।');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('ইমেইল/ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়।');
      } else if (code === 'auth/weak-password') {
        setError('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।');
      } else {
        setError('লগইন বা নিবন্ধন সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-lg mx-auto px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => onNavigate({ page: 'home' })}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#1B4D24] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        হোমে ফিরে যান
      </button>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <BrandMark siteName={siteName} compact />
          <h1 className="font-display-bn text-2xl font-bold text-[#1A1A1A] mt-3">
            {mode === 'login' ? 'অ্যাকাউন্টে লগইন করুন' : 'নতুন অ্যাকাউন্ট খুলুন'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            ইমেইল ঠিকানা, ফোন নম্বর অথবা Google দিয়ে সহজেই প্রবেশ করুন
          </p>
        </div>

        {pendingPlan && (
          <div className="mb-4 p-3 rounded-xl bg-[#F3F8F4] border border-[#1B4D24]/20 text-xs text-[#1B4D24] text-center font-medium leading-relaxed">
            <span className="font-bold">
              {pendingPlan.name === 'Basic' ? 'বেসিক' : pendingPlan.name} প্ল্যান ({pendingPlan.priceLabel})
            </span>{' '}
            অ্যাক্টিভেট করতে লগইন বা নিবন্ধন করুন—সম্পন্ন হলেই সরাসরি পেমেন্ট পেজে নিয়ে যাওয়া হবে।
          </div>
        )}

        {/* One-Click Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-3 text-sm font-semibold text-[#1A1A1A] transition-colors cursor-pointer disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          Google দিয়ে {mode === 'login' ? 'লগইন করুন' : 'নিবন্ধন করুন'}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <span className="flex-1 h-px bg-gray-200" />
          <span>অথবা ইমেইল / ফোন নম্বর</span>
          <span className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Toggle Login / Sign Up */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-gray-600'
            }`}
          >
            লগইন
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'signup' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-gray-600'
            }`}
          >
            নিবন্ধন (Sign Up)
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed space-y-2">
            <p>{error}</p>
            {needsConsoleEnable && (
              <div className="pt-2 border-t border-red-200/70 text-gray-800 space-y-1">
                <p className="font-bold">Email/Password চালু করার নিয়ম:</p>
                <p>১. Firebase Console → Authentication → Sign-in method-এ যান</p>
                <p>২. Email/Password এডিট করে Enable করুন এবং Save দিন</p>
                <p>৩. এরপর ইমেইল বা ফোন নম্বর দিয়ে সরাসরি লগইন করতে পারবেন।</p>
              </div>
            )}
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">আপনার নাম</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: নুসরাত জাহান"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              ইমেইল ঠিকানা অথবা ফোন নম্বর
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com অথবা 017XXXXXXXX"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">পাসওয়ার্ড</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading
              ? 'অপেক্ষা করুন...'
              : mode === 'login'
                ? pendingPlan
                  ? 'লগইন করে পেমেন্ট পেজে যান'
                  : 'লগইন করুন'
                : pendingPlan
                  ? 'অ্যাকাউন্ট তৈরি করে পেমেন্ট পেজে যান'
                  : returnRoute && returnRoute.page !== 'profile'
                    ? 'অ্যাকাউন্ট তৈরি করুন'
                    : 'অ্যাকাউন্ট তৈরি করুন ও প্রোফাইলে যান'}
          </button>
        </form>
      </div>
    </section>
  );
};
