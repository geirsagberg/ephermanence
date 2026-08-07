import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ephermanence',
        short_name: 'Ephermanence',
        description: 'A space for thoughts to linger, alone or together.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ebe8df',
        theme_color: '#ebe8df',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,js,png,svg,woff2}'],
      },
    }),
  ],
  fmt: {
    printWidth: 90,
    semi: true,
    trailingComma: 'all',
    sortPackageJson: true,
    ignorePatterns: ['dist/**'],
  },
  lint: {
    ignorePatterns: ['dist/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
