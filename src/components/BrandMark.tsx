import React from 'react';
import { resolvePublicAsset } from '../utils/appBase';

interface BrandMarkProps {
  siteName?: string;
  compact?: boolean;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ siteName = 'রান্না শিখুন', compact = false }) => {
  const words = siteName.trim().split(/\s+/);
  const firstLine = words[0] || 'রান্না';
  const secondLine = words.slice(1).join(' ') || '';

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
      <img
        src={resolvePublicAsset('assets/logo-icon.png')}
        alt={siteName}
        className={compact ? 'h-8 w-auto object-contain shrink-0' : 'h-11 w-auto object-contain shrink-0'}
      />

      <div className="flex items-baseline gap-1.5 leading-none">
        <span
          className={`font-display-bn ${
            compact ? 'text-[17px]' : 'text-[22px]'
          } font-bold tracking-tight text-[#2C1108] whitespace-nowrap`}
        >
          {firstLine}
        </span>
        {secondLine && (
          <span
            className={`font-display-bn ${
              compact ? 'text-[17px]' : 'text-[22px]'
            } font-bold tracking-tight text-[#1B4D24] whitespace-nowrap`}
          >
            {secondLine}
          </span>
        )}
      </div>
    </div>
  );
};

export const SpicePatternBackground: React.FC = () => (
  <div
    className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06]"
    aria-hidden="true"
  >
    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="spice-motif" width="180" height="180" patternUnits="userSpaceOnUse">
          {/* Chili pepper */}
          <path d="M26 24C34 18 46 24 44 38C42 46 34 52 26 50C32 42 32 32 26 24Z" stroke="#3B2F2F" strokeWidth="1.6" fill="none" />
          <path d="M26 24C24 20 21 19 18 20" stroke="#3B2F2F" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* Rolling pin */}
          <rect x="92" y="24" width="46" height="12" rx="4" transform="rotate(-18 92 24)" stroke="#3B2F2F" strokeWidth="1.6" fill="none" />
          <line x1="84" y1="33" x2="92" y2="30" stroke="#3B2F2F" strokeWidth="2" strokeLinecap="round" />
          <line x1="138" y1="15" x2="146" y2="12" stroke="#3B2F2F" strokeWidth="2" strokeLinecap="round" />
          {/* Garlic / Onion */}
          <path d="M44 108C34 108 26 118 28 128C30 136 38 140 44 140C50 140 58 136 60 128C62 118 54 108 44 108Z" stroke="#3B2F2F" strokeWidth="1.6" fill="none" />
          <path d="M44 108V98" stroke="#3B2F2F" strokeWidth="1.6" strokeLinecap="round" />
          {/* Star anise */}
          <path d="M126 96L130 106L140 106L132 113L136 123L126 117L116 123L120 113L112 106L122 106Z" stroke="#3B2F2F" strokeWidth="1.5" fill="none" />
          {/* Wooden spoon */}
          <ellipse cx="152" cy="148" rx="9" ry="13" transform="rotate(30 152 148)" stroke="#3B2F2F" strokeWidth="1.6" fill="none" />
          <line x1="145" y1="158" x2="126" y2="174" stroke="#3B2F2F" strokeWidth="1.8" strokeLinecap="round" />
          {/* Herb leaf */}
          <path d="M76 74C82 64 94 64 96 74C88 82 78 82 76 74Z" stroke="#3B2F2F" strokeWidth="1.5" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#spice-motif)" />
    </svg>
  </div>
);
