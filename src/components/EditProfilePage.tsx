import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  User as UserIcon,
  X,
} from 'lucide-react';
import { FONT_SIZE_OPTIONS, RECIPE_FONT_OPTIONS } from '../data/seedData';
import {
  changeUserPasswordDirect,
  formatUserContact,
  updateUserProfileDetails,
  updateUserProfilePhoto,
} from '../services/firestoreService';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import type {
  FontSizeKey,
  PageRoute,
  RecipeFontKey,
  SiteSettings,
  UserProfile,
} from '../types';

interface EditProfilePageProps {
  user: UserProfile | null;
  siteSettings?: SiteSettings;
  onNavigate: (route: PageRoute) => void;
  onProfileUpdated: (patch: Partial<UserProfile>) => void;
  onLogout: () => void;
  onToast?: (msg: string) => void;
}

const VALID_PROFILE_FONT_KEYS = new Set<RecipeFontKey>(
  RECIPE_FONT_OPTIONS.map((opt) => opt.key)
);
const VALID_PROFILE_SIZE_KEYS = new Set<FontSizeKey>(
  FONT_SIZE_OPTIONS.map((opt) => opt.key)
);

function resolveProfileFontKey(key?: string): RecipeFontKey {
  if (key && VALID_PROFILE_FONT_KEYS.has(key as RecipeFontKey)) {
    return key as RecipeFontKey;
  }
  return 'hind-siliguri';
}

function resolveProfileSizeKey(key?: string): FontSizeKey {
  if (key && VALID_PROFILE_SIZE_KEYS.has(key as FontSizeKey)) {
    return key as FontSizeKey;
  }
  return 'md';
}

function bengaliToEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
}

export const EditProfilePage: React.FC<EditProfilePageProps> = ({
  user,
  siteSettings,
  onNavigate,
  onProfileUpdated,
  onLogout,
  onToast,
}) => {
  const profileFontKey = resolveProfileFontKey(siteSettings?.profileFontFamily);
  const profileSizeKey = resolveProfileSizeKey(siteSettings?.profileFontSize);
  const profileScopeClass = `profile-typography-scope profile-font-${profileFontKey} profile-size-${profileSizeKey}`;

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [address, setAddress] = useState(user?.address || '');
  const [ageInput, setAgeInput] = useState(user?.age ? String(user.age) : '');

  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [needsRecentLogin, setNeedsRecentLogin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputId = 'edit-profile-photo-input';

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || '');
    setAddress(user.address || '');
    setAgeInput(user.age ? String(user.age) : '');
  }, [user?.uid, user?.displayName, user?.address, user?.age]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPhotoMenu(false);
        setShowPhotoViewer(false);
        if (!uploadingPhoto) {
          setPendingPhotoPreview(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uploadingPhoto]);

  if (!user) {
    return (
      <section className={`${profileScopeClass} max-w-lg mx-auto px-4 py-14 text-center`}>
        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-xs space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center">
            <UserIcon className="w-8 h-8" />
          </div>
          <h1 className="font-display-bn text-2xl font-bold text-[#1A1A1A]">Edit Profile</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            আপনার প্রোফাইল তথ্য এডিট করতে অনুগ্রহ করে লগইন করুন।
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'login' })}
            className="w-full py-3 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer"
          >
            লগইন / নিবন্ধন পেজে যান
          </button>
        </div>
      </section>
    );
  }

  const displayContact = formatUserContact(user.email, user.phoneNumber);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setShowPhotoMenu(false);
    setShowPhotoViewer(false);
    setPhotoErr(null);
    setPhotoMsg(null);
    setPreparingPhoto(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 360,
        maxHeight: 360,
        quality: 0.82,
        maxChars: 135000,
        squareCrop: true,
      });
      setPendingPhotoPreview(dataUrl);
    } catch (err) {
      setPhotoErr(
        err instanceof Error ? err.message : 'প্রোফাইল ছবি প্রসেস করা যায়নি। অন্য ছবি চেষ্টা করুন।'
      );
    } finally {
      setPreparingPhoto(false);
    }
  };

  const handleSavePendingPhoto = async () => {
    if (!pendingPhotoPreview) return;
    setPhotoErr(null);
    setPhotoMsg(null);
    setUploadingPhoto(true);
    try {
      await updateUserProfilePhoto(user.uid, pendingPhotoPreview);
      onProfileUpdated({ photoURL: pendingPhotoPreview });
      setPendingPhotoPreview(null);
      setPhotoMsg('প্রোফাইল ছবি সফলভাবে সেভ হয়েছে!');
      onToast?.('প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে!');
      setTimeout(() => setPhotoMsg(null), 4000);
    } catch (err) {
      setPhotoErr(
        err instanceof Error ? err.message : 'প্রোফাইল ছবি সেভ করা যায়নি। আবার চেষ্টা করুন।'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoErr(null);
    setInfoMsg(null);

    const cleanName = displayName.trim();
    if (!cleanName) {
      setInfoErr('অনুগ্রহ করে আপনার নাম লিখুন।');
      return;
    }

    const rawAgeStr = bengaliToEnglishDigits(ageInput).trim();
    let parsedAge: number | null = null;
    if (rawAgeStr.length > 0) {
      if (!/^\d+$/.test(rawAgeStr)) {
        setInfoErr('বয়স শুধুমাত্র সংখ্যায় লিখুন (যেমন: ২৫ বা 25)।');
        return;
      }
      const num = Number(rawAgeStr);
      if (!Number.isInteger(num) || num < 1 || num > 120) {
        setInfoErr('বয়স ১ থেকে ১২০ এর মধ্যে লিখুন।');
        return;
      }
      parsedAge = num;
    }

    setSavingInfo(true);
    try {
      const updated = await updateUserProfileDetails(user.uid, {
        displayName: cleanName,
        address: address.trim(),
        age: parsedAge,
      });
      onProfileUpdated({
        displayName: updated.displayName ?? cleanName,
        address: updated.address,
        age: updated.age,
      });
      setInfoMsg('আপনার প্রোফাইল তথ্য সফলভাবে সংরক্ষণ হয়েছে!');
      onToast?.('প্রোফাইল তথ্য আপডেট হয়েছে!');
      setTimeout(() => setInfoMsg(null), 4000);
    } catch (err) {
      setInfoErr(
        err instanceof Error ? err.message : 'তথ্য সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
      );
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErr(null);
    setPasswordMsg(null);
    setNeedsRecentLogin(false);

    if (newPassword.length < 6) {
      setPasswordErr('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }

    setSavingPassword(true);
    try {
      await changeUserPasswordDirect(newPassword);
      setNewPassword('');
      setPasswordMsg('নতুন পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!');
      onToast?.('নতুন পাসওয়ার্ড সফলভাবে সেভ হয়েছে!');
      setTimeout(() => setPasswordMsg(null), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'REQUIRES_RECENT_LOGIN') {
        setNeedsRecentLogin(true);
        setPasswordErr(
          'আপনি অনেক আগে লগইন করেছিলেন। নিরাপত্তার জন্য একবার পুনরায় লগইন করে নিলেই নতুন পাসওয়ার্ড সেট করতে পারবেন।'
        );
      } else {
        setPasswordErr(msg || 'পাসওয়ার্ড পরিবর্তন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className={`${profileScopeClass} max-w-2xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-6`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'profile' })}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs sm:text-sm font-bold text-[#1A1A1A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#1B4D24]" />
          <span>প্রোফাইলে ফিরে যান</span>
        </button>

        <h1 className="font-display-bn text-lg sm:text-xl font-bold text-[#1A1A1A]">
          Edit Profile
        </h1>
      </div>

      {/* Hidden File Input (sr-only for reliable mobile gallery picker) */}
      <input
        id={photoInputId}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onClick={(e) => {
          e.currentTarget.value = '';
        }}
        onChange={handlePhotoFileChange}
        className="sr-only"
      />

      {/* Card 1: Profile Picture */}
      <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative shrink-0">
            <button
              type="button"
              disabled={uploadingPhoto || preparingPhoto}
              onClick={() => setShowPhotoMenu(true)}
              aria-label="প্রোফাইল পিক অপশন দেখুন"
              className="relative block rounded-full focus:outline-none focus:ring-2 focus:ring-[#1B4D24]/40 cursor-pointer group disabled:opacity-60"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#1B4D24]/25 group-hover:opacity-90 transition-opacity"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#1B4D24] text-white flex items-center justify-center text-3xl font-bold group-hover:opacity-90 transition-opacity">
                  {user.displayName.charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[#1B4D24]">
                {uploadingPhoto || preparingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </span>
            </button>
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A] truncate">
              {user.displayName}
            </h2>
            {displayContact && (
              <p className="font-numeral-bn text-[11px] sm:text-xs text-gray-500 mt-1 inline-flex items-center justify-center sm:justify-start gap-1.5 break-all">
                {displayContact.includes('@') ? (
                  <Mail className="w-3.5 h-3.5 text-[#1B4D24] shrink-0" />
                ) : (
                  <Phone className="w-3.5 h-3.5 text-[#1B4D24] shrink-0" />
                )}
                <span>{displayContact}</span>
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <label
                htmlFor={photoInputId}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold transition-colors cursor-pointer select-none ${
                  uploadingPhoto || preparingPhoto ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {uploadingPhoto || preparingPhoto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                <span>
                  {uploadingPhoto
                    ? 'সেভ হচ্ছে...'
                    : preparingPhoto
                      ? 'প্রস্তুত হচ্ছে...'
                      : 'প্রোফাইল পিক পরিবর্তন করুন'}
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowPhotoViewer(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#1B4D24]" />
                <span>ভিউ প্রোফাইল পিক</span>
              </button>
            </div>
          </div>
        </div>

        {photoMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#1B4D24] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{photoMsg}</span>
          </div>
        )}
        {photoErr && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {photoErr}
          </div>
        )}
      </div>

      {/* Card 2: Personal Information (Name, Address, Age) */}
      <form
        onSubmit={handleSaveInfo}
        className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-7 shadow-xs space-y-4"
      >
        <div className="border-b border-gray-100 pb-3">
          <h2 className="font-display-bn text-base sm:text-lg font-bold text-[#1A1A1A]">
            ব্যক্তিগত তথ্য
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            আপনার নাম, ঠিকানা এবং বয়স এখানে সেট বা আপডেট করতে পারবেন।
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="edit-profile-name"
              className="block text-xs font-bold text-gray-700 mb-1.5"
            >
              আপনার নাম
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="edit-profile-name"
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="আপনার পূর্ণ নাম লিখুন"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-[#FAFAF8] focus:bg-white focus:outline-none focus:border-[#1B4D24] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="edit-profile-address"
                className="block text-xs font-bold text-gray-700 mb-1.5"
              >
                ঠিকানা
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  id="edit-profile-address"
                  type="text"
                  maxLength={240}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="যেমন: ধানমন্ডি, ঢাকা"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-[#FAFAF8] focus:bg-white focus:outline-none focus:border-[#1B4D24] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-profile-age"
                className="block text-xs font-bold text-gray-700 mb-1.5"
              >
                বয়স (বছর)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="edit-profile-age"
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={ageInput}
                  onChange={(e) => setAgeInput(e.target.value)}
                  placeholder="যেমন: ২৫"
                  className="font-numeral-bn w-full pl-10 pr-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-[#FAFAF8] focus:bg-white focus:outline-none focus:border-[#1B4D24] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {infoMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#1B4D24] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}
        {infoErr && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {infoErr}
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={savingInfo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-60"
          >
            {savingInfo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{savingInfo ? 'সংরক্ষণ হচ্ছে...' : 'তথ্য সংরক্ষণ করুন'}</span>
          </button>
        </div>
      </form>

      {/* Card 3: Direct Password Change (No old password or verification required) */}
      <form
        onSubmit={handleChangePassword}
        className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-7 shadow-xs space-y-4"
      >
        <div className="border-b border-gray-100 pb-3">
          <h2 className="font-display-bn text-base sm:text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#C69214]" />
            <span>পাসওয়ার্ড পরিবর্তন করুন</span>
          </h2>
          <p className="text-xs text-[#1B4D24] font-medium mt-1 leading-relaxed">
            এখানে নতুন পাসওয়ার্ড লিখুন, পুরাতন পাসওয়ার্ড মনে না থাকলেও চলবে
          </p>
        </div>

        <div>
          <label
            htmlFor="edit-profile-new-password"
            className="block text-xs font-bold text-gray-700 mb-1.5"
          >
            নতুন পাসওয়ার্ড
          </label>
          <div className="relative">
            <KeyRound className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="edit-profile-new-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="এখানে নতুন পাসওয়ার্ড লিখুন (কমপক্ষে ৬ অক্ষর)"
              className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm placeholder:text-[10.5px] sm:placeholder:text-xs border border-gray-200 rounded-xl bg-[#FAFAF8] focus:bg-white focus:outline-none focus:border-[#1B4D24] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {passwordMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#1B4D24] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordMsg}</span>
          </div>
        )}
        {passwordErr && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 space-y-2">
            <p>{passwordErr}</p>
            {needsRecentLogin && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B92B27] hover:bg-[#9C221F] text-white text-xs font-bold cursor-pointer"
              >
                লগআউট করে পুনরায় লগইন করুন
              </button>
            )}
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={savingPassword}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#C69214] hover:bg-[#AE7F0E] text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-60"
          >
            {savingPassword ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>{savingPassword ? 'আপডেট হচ্ছে...' : 'নতুন পাসওয়ার্ড সেভ করুন'}</span>
          </button>
        </div>
      </form>

      {/* Portaled Modals: Always centered on the exact visible mobile/desktop screen */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Profile Photo Action Menu Modal */}
            <AnimatePresence>
              {showPhotoMenu && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 h-[100dvh] w-full z-[80] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
                  onClick={() => setShowPhotoMenu(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 6 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-xs bg-white rounded-3xl p-4 shadow-2xl border border-gray-100 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-2 pb-1.5 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-500">প্রোফাইল ছবি</span>
                      <button
                        type="button"
                        onClick={() => setShowPhotoMenu(false)}
                        aria-label="বন্ধ করুন"
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer active:scale-90 transition-transform duration-150"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowPhotoMenu(false);
                        setShowPhotoViewer(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-[#F5F7F5] text-left text-sm font-bold text-[#1A1A1A] transition-all duration-150 active:scale-[0.98] cursor-pointer"
                    >
                      <span className="w-9 h-9 rounded-full bg-[#1B4D24]/10 text-[#1B4D24] flex items-center justify-center shrink-0">
                        <Eye className="w-4 h-4" />
                      </span>
                      <span>ভিউ প্রোফাইল পিক</span>
                    </button>

                    <label
                      htmlFor={photoInputId}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-[#F5F7F5] text-left text-sm font-bold text-[#1A1A1A] transition-all duration-150 active:scale-[0.98] cursor-pointer select-none"
                    >
                      <span className="w-9 h-9 rounded-full bg-[#C69214]/15 text-[#9A6E04] flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </span>
                      <span>প্রোফাইল পিক পরিবর্তন করুন</span>
                    </label>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Photo Preview + Save Modal */}
            <AnimatePresence>
              {pendingPhotoPreview && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 h-[100dvh] w-full z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => {
                    if (!uploadingPhoto) setPendingPhotoPreview(null);
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => setPendingPhotoPreview(null)}
                      aria-label="বন্ধ করুন"
                      className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer disabled:opacity-50 active:scale-90 transition-transform duration-150"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div>
                      <h3 className="text-base font-bold text-[#1A1A1A]">প্রোফাইল পিক প্রিভিউ</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ছবিটি পছন্দ হলে নিচের সেভ বাটনে ক্লিক করুন
                      </p>
                    </div>

                    <div className="flex items-center justify-center py-1">
                      <img
                        src={pendingPhotoPreview}
                        alt="নতুন প্রোফাইল ছবি প্রিভিউ"
                        className="w-48 h-48 sm:w-56 sm:h-56 rounded-full object-cover border-4 border-[#1B4D24]/20 shadow-md"
                      />
                    </div>

                    {photoErr && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                        {photoErr}
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        disabled={uploadingPhoto}
                        onClick={handleSavePendingPhoto}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-all duration-150"
                      >
                        {uploadingPhoto ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>{uploadingPhoto ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <label
                          htmlFor={photoInputId}
                          className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer select-none transition-colors ${
                            uploadingPhoto ? 'pointer-events-none opacity-50' : ''
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#1B4D24]" />
                          <span>অন্য ছবি বাছুন</span>
                        </label>
                        <button
                          type="button"
                          disabled={uploadingPhoto}
                          onClick={() => setPendingPhotoPreview(null)}
                          className="py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          বাতিল করুন
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Full Profile Photo Lightbox Viewer */}
            <AnimatePresence>
              {showPhotoViewer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 h-[100dvh] w-full z-[80] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => setShowPhotoViewer(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setShowPhotoViewer(false)}
                      aria-label="বন্ধ করুন"
                      className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer active:scale-90 transition-transform duration-150"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <h3 className="text-sm font-bold text-[#1A1A1A]">{user.displayName}</h3>

                    <div className="flex items-center justify-center py-2">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-60 h-60 sm:w-68 sm:h-68 rounded-2xl object-cover border border-gray-200 shadow-md"
                        />
                      ) : (
                        <div className="w-52 h-52 rounded-full bg-[#1B4D24] text-white flex items-center justify-center text-6xl font-bold shadow-md">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                    </div>

                    <label
                      htmlFor={photoInputId}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-xs font-bold cursor-pointer select-none active:scale-[0.98] transition-transform duration-150"
                    >
                      <Camera className="w-4 h-4" />
                      <span>প্রোফাইল পিক পরিবর্তন করুন</span>
                    </label>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}
    </section>
  );
};
