import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.BASE_URL || '/';
const normalizedBase = base.endsWith('/') ? base : `${base}/`;

/** Emits sw.js from sw-template.js with a per-build version and the full list of built files. */
function serviceWorker(basePath: string): Plugin {
  return {
    name: 'kamisado-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = [
        basePath,
        `${basePath}index.html`,
        `${basePath}manifest.webmanifest`,
        `${basePath}icon.svg`,
        `${basePath}icon-192.png`,
        `${basePath}icon-512.png`,
        ...Object.keys(bundle).map((f) => `${basePath}${f}`),
      ];
      const unique = [...new Set(files)];
      const version = Date.now().toString(36);
      const template = readFileSync(resolve(__dirname, 'sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__VERSION__', version)
          .replace('__FILES__', JSON.stringify(unique))
          .replace(/__BASE__/g, basePath),
      });
    },
  };
}

/** Duplicates index.html as 404.html so GitHub Pages routes all subpaths into the SPA. */
function spa404(): Plugin {
  return {
    name: 'kamisado-spa-404',
    apply: 'build',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      const indexHtml = resolve(dist, 'index.html');
      const notFoundHtml = resolve(dist, '404.html');
      if (existsSync(indexHtml)) {
        copyFileSync(indexHtml, notFoundHtml);
      }
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), serviceWorker(normalizedBase), spa404()],
  server: {
    host: true,
    port: 5173,
  },
});
