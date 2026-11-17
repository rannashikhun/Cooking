import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Send,
} from 'lucide-react';
import { submitContactMessage } from '../services/firestoreService';
import type { BlogPost, CookingTip, PageRoute, SiteSettings } from '../types';

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

const getBlogCreatedMillis = (p: BlogPost): number => {
  const ts = p.createdAt as { toMillis?: () => number; seconds?: number } | undefined;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (p.id.startsWith('blog_')) {
    const parsed = Number(p.id.slice(5));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

export const TipsSection: React.FC<{
  tips: CookingTip[];
  onNavigate: (route: PageRoute) => void;
}> = ({ tips, onNavigate }) => {
  const published = tips.filter((t) => t.isPublished);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
          রান্নাঘরের বিশেষজ্ঞ টিপস
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          প্রতিদিনের রান্না সহজ ও আরও সুস্বাদু করার পরীক্ষিত কৌশল
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {published.map((tip) => (
          <article
            key={tip.id}
            onClick={() => onNavigate({ page: 'tip-detail', id: tip.id })}
            className="p-6 rounded-2xl bg-white border border-gray-200 hover:border-[#1B4D24]/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span className="font-semibold text-[#1B4D24]">{tip.category}</span>
                <span>{tip.readTime}</span>
              </div>
              <h2 className="text-lg font-bold text-[#1A1A1A] flex items-start gap-2.5">
                <Lightbulb className="w-5 h-5 text-[#D4A017] shrink-0 mt-0.5" />
                <span>{tip.title}</span>
              </h2>
              <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">{tip.summary}</p>
            </div>

            <span className="mt-4 text-xs font-bold text-[#B92B27] hover:underline self-start">
              সম্পূর্ণ পড়ুন →
            </span>
          </article>
        ))}
      </div>
    </section>
  );
};

export const TipDetailPage: React.FC<{
  tip: CookingTip | undefined;
  onNavigate: (route: PageRoute) => void;
}> = ({ tip, onNavigate }) => {
  if (!tip) {
    return (
      <section className="max-w-2xl mx-auto px-4 py-14 text-center space-y-4">
        <h1 className="font-display-bn text-2xl font-bold">টিপস পাওয়া যায়নি</h1>
        <button
          type="button"
          onClick={() => onNavigate({ page: 'tips' })}
          className="px-5 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
        >
          সব টিপস দেখুন
        </button>
      </section>
    );
  }

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
      <button
        type="button"
        onClick={() => onNavigate({ page: 'tips' })}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#1B4D24] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        সব টিপসে ফিরে যান
      </button>

      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-9 shadow-xs space-y-4">
        <p className="text-xs font-bold text-[#1B4D24]">
          {tip.category} · {tip.readTime}
        </p>
        <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
          {tip.title}
        </h1>
        <p className="text-sm text-gray-500 border-b border-gray-100 pb-4">{tip.summary}</p>
        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-line pt-2">
          {tip.content}
        </div>
      </div>
    </article>
  );
};

const BLOGS_PER_PAGE = 9;

export const BlogSection: React.FC<{
  posts: BlogPost[];
  onNavigate: (route: PageRoute) => void;
}> = ({ posts, onNavigate }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const published = useMemo(() => {
    return posts
      .filter((p) => p.isPublished)
      .sort((a, b) => getBlogCreatedMillis(b) - getBlogCreatedMillis(a));
  }, [posts]);

  const totalPages = Math.max(1, Math.ceil(published.length / BLOGS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPosts = useMemo(() => {
    const start = (safePage - 1) * BLOGS_PER_PAGE;
    return published.slice(start, start + BLOGS_PER_PAGE);
  }, [published, safePage]);

  const handlePageChange = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    setCurrentPage(clamped);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section ref={sectionRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
          রন্ধন শিল্প ও খাদ্য ব্লগ
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          বাঙালি খাদ্যের ইতিহাস, মশলার গল্প ও শেফদের অভিজ্ঞতা
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {paginatedPosts.map((post) => (
          <article
            key={post.id}
            onClick={() => onNavigate({ page: 'blog-detail', id: post.id })}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col"
          >
            <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
              <img
                src={post.imageUrl}
                alt={post.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-[#B92B27]">{post.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="text-lg font-bold text-[#1A1A1A] mt-2 leading-snug">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{post.excerpt}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Minimal Back / Next Pagination Bar (9 blogs per page) */}
      {published.length > 0 && (
        <nav
          aria-label="ব্লগ পেজিনেশন"
          className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => handlePageChange(safePage - 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-[#1A1A1A] hover:border-[#1B4D24] hover:text-[#1B4D24] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ব্যাক পেজ</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAFAF8] border border-gray-200/80 text-xs font-semibold text-gray-600 tabular-nums">
            <span>পৃষ্ঠা</span>
            <span className="text-[#1B4D24] font-bold">{toBengaliDigits(safePage)}</span>
            <span>/</span>
            <span>{toBengaliDigits(totalPages)}</span>
          </div>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => handlePageChange(safePage + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-[#1A1A1A] hover:border-[#1B4D24] hover:text-[#1B4D24] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <span>নেক্সট পেজ</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </section>
  );
};

export const BlogDetailPage: React.FC<{
  post: BlogPost | undefined;
  onNavigate: (route: PageRoute) => void;
}> = ({ post, onNavigate }) => {
  if (!post) {
    return (
      <section className="max-w-2xl mx-auto px-4 py-14 text-center space-y-4">
        <h1 className="font-display-bn text-2xl font-bold">ব্লগ পোস্ট পাওয়া যায়নি</h1>
        <button
          type="button"
          onClick={() => onNavigate({ page: 'blog' })}
          className="px-5 py-2.5 rounded-xl bg-[#1B4D24] text-white text-sm font-bold cursor-pointer"
        >
          সব ব্লগে ফিরে যান
        </button>
      </section>
    );
  }

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
      <button
        type="button"
        onClick={() => onNavigate({ page: 'blog' })}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#1B4D24] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        সব ব্লগে ফিরে যান
      </button>

      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
        <img
          src={post.imageUrl}
          alt={post.title}
          referrerPolicy="no-referrer"
          className="w-full h-64 sm:h-80 object-cover"
        />
        <div className="p-6 sm:p-9 space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <BookOpen className="w-4 h-4 text-[#B92B27]" />
            <span className="font-semibold text-[#B92B27]">{post.category}</span>
            <span aria-hidden="true">·</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{post.readTime}</span>
          </div>
          <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
            {post.title}
          </h1>
          <div className="border-b border-gray-100" />
          <p className="text-base text-gray-800 leading-relaxed whitespace-pre-line pt-1">
            {post.content}
          </p>
        </div>
      </div>
    </article>
  );
};

export const ContactSection: React.FC<{ settings: SiteSettings }> = ({ settings }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitContactMessage({ name, email, subject, message });
      setSent(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch {
      setError('বার্তা পাঠানো যায়নি। অনুগ্রহ করে সব ঘর সঠিকভাবে পূরণ করে আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
        <div className="md:col-span-2 space-y-5">
          <div>
            <h1 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
              যোগাযোগ করুন
            </h1>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              রেসিপি সম্পর্কিত কোনো প্রশ্ন বা সাবস্ক্রিপশন সহায়তার জন্য আমাদের লিখুন।
            </p>
          </div>

          <div className="space-y-4 pt-2 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#1B4D24] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#1A1A1A]">ইমেইল</p>
                <p>{settings.contactEmail}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#B92B27] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#1A1A1A]">ফোন</p>
                <p>{settings.contactPhone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#D4A017] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#1A1A1A]">ঠিকানা</p>
                <p>{settings.contactAddress}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-3 bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-xs">
          {sent ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-lg font-bold text-[#1B4D24]">আপনার বার্তা সফলভাবে পাঠানো হয়েছে!</p>
              <p className="text-sm text-gray-600">আমরা খুব দ্রুত আপনার সাথে যোগাযোগ করব।</p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="px-4 py-2 rounded-xl bg-[#1B4D24] text-white text-xs font-bold cursor-pointer"
              >
                আরেকটি বার্তা পাঠান
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">আপনার নাম</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="আপনার নাম লিখুন"
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">ইমেইল</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">বিষয়</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="যেমন: প্রো মেম্বারশিপ সম্পর্কে জানতে চাই"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">বার্তা</label>
                <textarea
                  required
                  minLength={5}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="আপনার প্রশ্ন বা মতামত বিস্তারিত লিখুন..."
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4D24]"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
