import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  base: '/ephermanence/',
  plugins: [react()],
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
