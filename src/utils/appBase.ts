const KNOWN_APP_ROOT_SEGMENTS = new Set([
  'recipes',
  'category',
  'recipe',
  'tips',
  'tip',
  'pricing',
  'checkout',
  'blog',
  'contact',
  'favorites',
  'login',
  'profile',
  'admin',
]);

export function getAppBasePrefix(): string {
  const rawBase = import.meta.env.BASE_URL || '/';
  if (rawBase !== '/' && rawBase !== './' && rawBase !== '.') {
    return `/${rawBase.replace(/^\/+|\/+$/g, '')}`;
  }
  if ((rawBase === './' || rawBase === '.') && typeof window !== 'undefined') {
    try {
      const scriptPath = new URL(import.meta.url).pathname;
      const assetsMarkerIdx = scriptPath.indexOf('/assets/');
      if (assetsMarkerIdx > 0) {
        return scriptPath.slice(0, assetsMarkerIdx);
      }
      if (assetsMarkerIdx === 0) {
        return '';
      }
    } catch {
      // Fall back to hostname-based GitHub Pages detection below
    }
    if (window.location.hostname.endsWith('.github.io')) {
      const firstSeg = window.location.pathname.split('/').filter(Boolean)[0];
      if (firstSeg && !KNOWN_APP_ROOT_SEGMENTS.has(firstSeg)) {
        return `/${firstSeg}`;
      }
    }
  }
  return '';
}

export function stripAppBase(pathname: string): string {
  const base = getAppBasePrefix();
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    return pathname.slice(base.length) || '/';
  }
  return pathname || '/';
}

export function withAppBase(routePath: string): string {
  const base = getAppBasePrefix();
  const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
  if (!base) return normalized;
  return normalized === '/' ? `${base}/` : `${base}${normalized}`;
}

export function resolvePublicAsset(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '');
  return withAppBase(`/${clean}`);
}
