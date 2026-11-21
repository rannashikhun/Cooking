import React from 'react';
import { Check } from 'lucide-react';
import { SpicePatternBackground } from './BrandMark';
import type { PlanTier, SubscriptionPlan } from '../types';

interface PricingSectionProps {
  plans: SubscriptionPlan[];
  currentTier?: PlanTier;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  showHeading?: boolean;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  plans,
  currentTier,
  onSelectPlan,
  showHeading = false,
}) => {
  const visiblePlans = plans.filter((p) => p.isActive).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <section id="pricing-section" className="relative py-10 md:py-14 px-4 overflow-hidden bg-[#FCFCFA]">
      <SpicePatternBackground />

      <div className="relative max-w-5xl mx-auto">
        <div className={`text-center mb-8 md:mb-10 ${showHeading ? '' : 'md:hidden'}`}>
          <h2 className="font-display-bn text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
            সদস্যপদ ও সাবস্ক্রিপশন প্ল্যান
          </h2>
          <p className="text-sm text-gray-600 mt-1.5">
            প্রতি প্রিমিয়াম রেসিপি মাত্র <span className="font-numeral-bn">১০</span> টাকা হিসেবে আপনার পছন্দমতো{' '}
            <span className="font-numeral-bn">১</span> মাসের প্ল্যান বেছে নিন
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {visiblePlans.map((plan, planIdx) => {
            const isGold = plan.accentColor === 'gold';
            const isRed = plan.accentColor === 'red';
            const isCurrent = currentTier === plan.tier;

            const borderClass = isGold
              ? 'border-2 border-[#D4A017]'
              : isRed
                ? 'border-2 border-[#B92B27]'
                : 'border-2 border-[#1B4D24]';

            const headerClass = isGold
              ? 'bg-gradient-to-r from-[#B8860B] via-[#CFA021] to-[#E2B73B] text-white'
              : isRed
                ? 'bg-gradient-to-r from-[#9E1C19] via-[#B92B27] to-[#D14E28] text-white'
                : 'bg-gradient-to-r from-[#143A1B] via-[#1B4D24] to-[#266832] text-white';

            const checkColor = isGold
              ? 'text-[#C69214]'
              : isRed
                ? 'text-[#B92B27]'
                : 'text-[#1B4D24]';

            const buttonClass = isGold
              ? 'bg-[#C99A22] hover:bg-[#B58817] text-white'
              : isRed
                ? 'bg-[#C84326] hover:bg-[#AF361C] text-white'
                : 'bg-[#1B4D24] hover:bg-[#143A1B] text-white';

            const displayName = plan.name === 'Basic' ? 'বেসিক' : plan.name;

            const renderSubtitle = (text: string) => {
              if (planIdx !== 0 && planIdx !== 1) return text;
              return text.split(/(১০)/g).map((part, i) =>
                part === '১০' ? (
                  <span key={i} className="font-numeral-bn">
                    {part}
                  </span>
                ) : (
                  <React.Fragment key={i}>{part}</React.Fragment>
                )
              );
            };

            const shouldStyleFeatureNumerals = (idx: number) =>
              (planIdx === 0 && idx === 0) ||
              (planIdx === 1 && (idx === 0 || idx === 1 || idx === 3)) ||
              (planIdx === 2 && idx === 3);

            const renderFeatureText = (text: string, idx: number) => {
              if (!shouldStyleFeatureNumerals(idx)) return text;
              return text.split(/([০-৯]+)/g).map((part, i) =>
                /^[০-৯]+$/.test(part) ? (
                  <span key={i} className="font-numeral-bn">
                    {part}
                  </span>
                ) : (
                  <React.Fragment key={i}>{part}</React.Fragment>
                )
              );
            };

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden ${borderClass}`}
              >
                {/* Uniform Gradient Header Bar across all 3 plans */}
                <div className={`px-6 py-4 text-center ${headerClass}`}>
                  <h3 className="text-xl font-bold tracking-tight">{displayName}</h3>
                </div>

                {/* Price & Features Body */}
                <div className="px-6 pt-5 pb-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-center pb-4 border-b border-gray-100">
                      <p className="text-base font-bold text-[#1A1A1A] tabular-nums">
                        {plan.durationLabel}
                      </p>
                      {plan.subtitle && (
                        <p className="text-xs font-medium text-gray-600 mt-1">
                          {renderSubtitle(plan.subtitle)}
                        </p>
                      )}
                    </div>

                    <ul className="mt-5 space-y-3 text-[15px] text-[#2B2B2B]">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className={`w-4 h-4 mt-1 shrink-0 ${checkColor}`} strokeWidth={2.5} />
                          <span>{renderFeatureText(feat, idx)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-7 text-center">
                    {(() => {
                      const isLoggedIn = Boolean(currentTier);
                      const isBasicLocked = plan.tier === 'basic' && isLoggedIn;
                      const label = isBasicLocked
                        ? isCurrent
                          ? 'অ্যাকাউন্টে চালু আছে'
                          : 'বিনামূল্যে অন্তর্ভুক্ত'
                        : isCurrent
                          ? 'প্ল্যান রিনিউ / কোটা বাড়ান'
                          : 'অ্যাক্টিভেট করুন';

                      return (
                        <button
                          type="button"
                          disabled={isBasicLocked}
                          onClick={isBasicLocked ? undefined : () => onSelectPlan(plan)}
                          className={`w-full max-w-[210px] py-2.5 px-5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                            isBasicLocked
                              ? 'bg-[#1B4D24]/10 text-[#1B4D24] border border-[#1B4D24]/25 cursor-default shadow-none'
                              : `shadow-xs active:scale-[0.98] cursor-pointer ${buttonClass}`
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
