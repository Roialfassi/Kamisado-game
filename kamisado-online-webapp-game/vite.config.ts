import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Emits /sw.js from sw-template.js with a per-build version and the full list of built files. */
function serviceWorker(): Plugin {
  return {
    name: 'kamisado-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', ...Object.keys(bundle).map((f) => `/${f}`)];
      const unique = [...new Set(files)];
      const version = Date.now().toString(36);
      const template = readFileSync(resolve(__dirname, 'sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(unique)),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    host: true,
    port: 5173,
  },
});
