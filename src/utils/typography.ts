import { FONT_SIZE_OPTIONS, RECIPE_FONT_OPTIONS } from '../data/seedData';
import type { NormalizedFontSizeKey, RecipeFontKey } from '../types';

const VALID_FONT_KEYS = new Set<RecipeFontKey>(RECIPE_FONT_OPTIONS.map((opt) => opt.key));
const VALID_NORMALIZED_SIZE_KEYS = new Set<NormalizedFontSizeKey>([
  '100',
  '105',
  '110',
  '115',
  '120',
]);

const LEGACY_SIZE_MAP: Record<string, NormalizedFontSizeKey> = {
  sm: '100',
  md: '100',
  lg: '110',
  xl: '120',
};

export function resolveFontKey(
  key?: string,
  fallback: RecipeFontKey = 'hind-siliguri'
): RecipeFontKey {
  if (key && VALID_FONT_KEYS.has(key as RecipeFontKey)) {
    return key as RecipeFontKey;
  }
  return fallback;
}

export function resolveFontSizeKey(
  key?: string,
  fallback: NormalizedFontSizeKey = '100'
): NormalizedFontSizeKey {
  if (!key) return fallback;
  if (VALID_NORMALIZED_SIZE_KEYS.has(key as NormalizedFontSizeKey)) {
    return key as NormalizedFontSizeKey;
  }
  if (key in LEGACY_SIZE_MAP) {
    return LEGACY_SIZE_MAP[key];
  }
  return fallback;
}

/**
 * Single-device typography scope class (used for dedicated PC/Mobile preview cards).
 */
export function getPageTypographyClass(
  fontKey?: string,
  sizeKey?: string,
  fallbackFont: RecipeFontKey = 'hind-siliguri',
  fallbackSize: NormalizedFontSizeKey = '100'
): string {
  const font = resolveFontKey(fontKey, fallbackFont);
  const size = resolveFontSizeKey(sizeKey, fallbackSize);
  return `page-typo-scope typo-font-${font} typo-size-${size}`;
}

/**
 * Responsive PC (>= 768px) + Mobile (< 768px) typography scope class for live pages.
 */
export function getResponsiveTypographyClass(
  pcFontKey?: string,
  mobileFontKey?: string,
  pcSizeKey?: string,
  mobileSizeKey?: string,
  fallbackFont: RecipeFontKey = 'hind-siliguri',
  fallbackSize: NormalizedFontSizeKey = '100'
): string {
  const pcFont = resolveFontKey(pcFontKey, fallbackFont);
  const mobileFont = resolveFontKey(mobileFontKey || pcFontKey, pcFont);
  const pcSize = resolveFontSizeKey(pcSizeKey, fallbackSize);
  const mobileSize = resolveFontSizeKey(mobileSizeKey || pcSizeKey, pcSize);
  return `page-typo-scope typo-m-font-${mobileFont} typo-pc-font-${pcFont} typo-m-size-${mobileSize} typo-pc-size-${pcSize}`;
}

/**
 * Responsive PC + Mobile scope class specifically for Recipe Detail diary page.
 */
export function getRecipeTypographyClass(
  pcFontKey?: string,
  mobileFontKey?: string,
  pcSizeKey?: string,
  mobileSizeKey?: string
): string {
  const pcFont = resolveFontKey(pcFontKey, 'bensen');
  const mobileFont = resolveFontKey(mobileFontKey || pcFontKey, pcFont);
  const pcSize = resolveFontSizeKey(pcSizeKey, '100');
  const mobileSize = resolveFontSizeKey(mobileSizeKey || pcSizeKey, pcSize);
  return `rf-m-${mobileFont} rf-pc-${pcFont} rf-size-scope rf-size-m-${mobileSize} rf-size-pc-${pcSize}`;
}

export function getFontMeta(key?: string) {
  const resolved = resolveFontKey(key);
  return RECIPE_FONT_OPTIONS.find((opt) => opt.key === resolved) || RECIPE_FONT_OPTIONS[0];
}

export function getFontSizeMeta(key?: string) {
  const resolved = resolveFontSizeKey(key);
  return FONT_SIZE_OPTIONS.find((opt) => opt.key === resolved) || FONT_SIZE_OPTIONS[0];
}
