import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Recipe } from '../types';

interface HeroCarouselProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
}

const MAX_HERO_SLIDES = 5;

const toBengaliDigits = (val: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => digits[Number(d)]);
};

const getTimestampMs = (ts: unknown, id?: string): number => {
  const obj = ts as { toMillis?: () => number; seconds?: number } | undefined;
  if (obj && typeof obj.toMillis === 'function') return obj.toMillis();
  if (obj && typeof obj.seconds === 'number') return obj.seconds * 1000;
  if (id && id.startsWith('recipe_')) {
    const parsed = Number(id.slice('recipe_'.length));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const getHeroRecency = (r: Recipe): number =>
  Math.max(getTimestampMs(r.updatedAt, r.id), getTimestampMs(r.createdAt, r.id));

const SLIDE_EASE = [0.22, 1, 0.36, 1] as const;

const centerSlideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 56 : -56,
    opacity: 0,
    scale: 1.03,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -56 : 56,
    opacity: 0,
    scale: 0.985,
  }),
};

const peekVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 28 : -28,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -28 : 28,
    opacity: 0,
  }),
};

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ recipes, onSelectRecipe }) => {
  const slides = useMemo(() => {
    const featured = recipes
      .filter((r) => r.isFeatured)
      .sort((a, b) => {
        const diff = getHeroRecency(b) - getHeroRecency(a);
        if (Math.abs(diff) > 1000) return diff;
        return (b.orderIndex || 0) - (a.orderIndex || 0);
      });

    if (featured.length >= MAX_HERO_SLIDES) {
      return featured.slice(0, MAX_HERO_SLIDES);
    }

    const featuredIds = new Set(featured.map((r) => r.id));
    const fillerRecipes = recipes.filter((r) => !featuredIds.has(r.id));
    return [...featured, ...fillerRecipes].slice(0, MAX_HERO_SLIDES);
  }, [recipes]);

  const [[activeIndex, direction], setSlideState] = useState<[number, number]>([0, 1]);
  const [isPaused, setIsPaused] = useState(false);

  const slideCount = slides.length;
  const topSlideId = slides[0]?.id;
  const prevTopSlideIdRef = useRef<string | undefined>(topSlideId);

  useEffect(() => {
    if (topSlideId && prevTopSlideIdRef.current && prevTopSlideIdRef.current !== topSlideId) {
      setSlideState([0, 1]);
    }
    prevTopSlideIdRef.current = topSlideId;
  }, [topSlideId]);

  useEffect(() => {
    if (slideCount <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setSlideState(([i]) => [(i + 1) % slideCount, 1]);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [slideCount, isPaused]);

  if (slideCount === 0) return null;

  const safeIndex = activeIndex % slideCount;
  const prevIndex = (safeIndex - 1 + slideCount) % slideCount;
  const nextIndex = (safeIndex + 1) % slideCount;

  const current = slides[safeIndex];
  const prev = slides[prevIndex];
  const next = slides[nextIndex];

  const handlePrev = () =>
    setSlideState(([i]) => [(i - 1 + slideCount) % slideCount, -1]);
  const handleNext = () =>
    setSlideState(([i]) => [(i + 1) % slideCount, 1]);
  const handleJump = (targetIdx: number) =>
    setSlideState(([i]) => [targetIdx, targetIdx >= i % slideCount ? 1 : -1]);

  return (
    <section
      className="hidden md:block pt-3.5 pb-3 overflow-hidden bg-white"
      aria-label="বিশেষ রেসিপি"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative max-w-6xl mx-auto px-6">
        <div className="flex items-stretch justify-center gap-4">
          {/* Left Peeking Slide */}
          {slideCount > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="hidden lg:block w-[21%] h-[240px] shrink-0 rounded-2xl overflow-hidden relative group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1B4D24] bg-neutral-900"
              aria-label={`আগের রেসিপি: ${prev.title}`}
            >
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={prev.id}
                  custom={direction}
                  variants={peekVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.55, ease: SLIDE_EASE }}
                  className="absolute inset-0"
                >
                  <img
                    src={prev.imageUrl}
                    alt={prev.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3.5 right-3.5 text-left text-white">
                    <p className="text-sm font-bold line-clamp-1">{prev.title}</p>
                    <div className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E5B83B] text-[#1A1A1A] text-[11px] font-semibold">
                      বিস্তারিত দেখুন
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </button>
          )}

          {/* Center Dominant Hero Slide */}
          <div className="relative w-full lg:w-[56%] h-[220px] lg:h-[240px] shrink-0 rounded-2xl overflow-hidden shadow-md bg-neutral-900">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={current.id}
                custom={direction}
                variants={centerSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.6, ease: SLIDE_EASE }}
                className="absolute inset-0"
              >
                <img
                  src={current.imageUrl}
                  alt={current.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                {/* Top right free/premium marker */}
                <div className="absolute top-3 right-3">
                  {current.isPremium ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5B83B] text-[#1A1A1A] text-[11px] font-bold shadow">
                      <Lock className="w-3 h-3" />
                      প্রিমিয়াম
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#1B4D24] text-white text-[11px] font-bold shadow">
                      বিনামূল্যে
                    </span>
                  )}
                </div>

                {/* Bottom Content Overlay */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08, ease: SLIDE_EASE }}
                  className="absolute bottom-0 left-0 right-0 p-4 lg:p-5 flex items-end justify-between gap-4"
                >
                  <div className="text-white min-w-0">
                    <h1 className="font-display-bn text-xl lg:text-[23px] font-bold leading-snug text-balance drop-shadow-sm line-clamp-1">
                      {current.title}
                    </h1>
                    <div className="mt-1 flex items-center gap-2 text-xs lg:text-sm text-white/90 tabular-nums">
                      <span className="font-semibold">{toBengaliDigits(current.rating.toFixed(1))}</span>
                      <Star className="w-3.5 h-3.5 fill-[#F4C430] text-[#F4C430] -mt-0.5" />
                      <span aria-hidden="true">|</span>
                      <span>{toBengaliDigits(current.ratingCount)} টি রেটিং</span>
                      <span aria-hidden="true">·</span>
                      <span>{current.cookTime}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectRecipe(current)}
                    className="shrink-0 px-4 py-2 rounded-full bg-[#E5B83B] hover:bg-[#D5A728] text-[#1A1A1A] text-xs lg:text-sm font-bold shadow-md transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
                  >
                    বিস্তারিত দেখুন
                  </button>
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Carousel Left/Right Arrows */}
            {slideCount > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="পূর্ববর্তী রেসিপি"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center transition-all duration-200 cursor-pointer backdrop-blur-xs hover:scale-105 active:scale-95"
                >
                  <ChevronLeft className="w-4.5 h-4.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="পরবর্তী রেসিপি"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center transition-all duration-200 cursor-pointer backdrop-blur-xs hover:scale-105 active:scale-95"
                >
                  <ChevronRight className="w-4.5 h-4.5" />
                </button>
              </>
            )}
          </div>

          {/* Right Peeking Slide */}
          {slideCount > 2 && (
            <button
              type="button"
              onClick={handleNext}
              className="hidden lg:block w-[21%] h-[240px] shrink-0 rounded-2xl overflow-hidden relative group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1B4D24] bg-neutral-900"
              aria-label={`পরবর্তী রেসিপি: ${next.title}`}
            >
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={next.id}
                  custom={direction}
                  variants={peekVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.55, ease: SLIDE_EASE }}
                  className="absolute inset-0"
                >
                  <img
                    src={next.imageUrl}
                    alt={next.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3.5 right-3.5 text-left text-white">
                    <p className="text-sm font-bold line-clamp-1">{next.title}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/90 tabular-nums">
                      <span>{toBengaliDigits(next.rating.toFixed(1))}</span>
                      <Star className="w-3 h-3 fill-[#F4C430] text-[#F4C430]" />
                      <span>| {toBengaliDigits(next.ratingCount)} টি রেটিং</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </button>
          )}
        </div>

        {/* Dot Indicators */}
        {slideCount > 1 && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => handleJump(idx)}
                aria-label={`স্লাইড ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === safeIndex ? 'w-6 bg-[#1B4D24]' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
