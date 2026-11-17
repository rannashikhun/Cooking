import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function resolveBasePath(command: 'serve' | 'build'): string {
  if (command === 'serve') return '/';
  const explicit = process.env.VITE_BASE_PATH?.trim();
  if (explicit) {
    if (explicit === './' || explicit === '.') return './';
    const cleaned = explicit.replace(/^\/+|\/+$/g, '');
    return cleaned ? `/${cleaned}/` : '/';
  }
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1] || '';
    if (repoName && !repoName.endsWith('.github.io')) {
      return `/${repoName}/`;
    }
    return '/';
  }
  if (
    process.env.VERCEL === '1' ||
    process.env.NETLIFY === 'true' ||
    process.env.K_SERVICE ||
    process.env.APPLET_ID
  ) {
    return '/';
  }
  return './';
}

function githubPagesSpaPlugin(): Plugin {
  let resolvedBase = '/';
  return {
    name: 'github-pages-spa-404',
    configResolved(config) {
      resolvedBase = config.base || '/';
    },
    generateBundle() {
      const pathSegmentsToKeep =
        resolvedBase === '/' || resolvedBase === './'
          ? 0
          : resolvedBase.split('/').filter(Boolean).length;
      const html = `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <title>রান্না শিখুন</title>
    <script>
      (function () {
        var pathSegmentsToKeep = ${pathSegmentsToKeep};
        var l = window.location;
        if (pathSegmentsToKeep === 0 && l.hostname.endsWith('.github.io')) {
          var segs = l.pathname.split('/').filter(Boolean);
          if (segs.length > 0 && !/^(recipes|category|recipe|tips|tip|pricing|checkout|blog|contact|favorites|login|profile|admin)$/.test(segs[0])) {
            pathSegmentsToKeep = 1;
          }
        }
        l.replace(
          l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
          l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
          l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
          (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
          l.hash
        );
      })();
    </script>
  </head>
  <body></body>
</html>
`;
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: html,
      });
    },
  };
}

function liveVersionManifestPlugin(buildId: string): Plugin {
  const payload = JSON.stringify({ buildId });
  return {
    name: 'live-version-manifest',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.end(payload);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: payload,
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const buildId = Date.now().toString(36);
  const base = resolveBasePath(command);
  return {
    base,
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      tailwindcss(),
      liveVersionManifestPlugin(buildId),
      githubPagesSpaPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
