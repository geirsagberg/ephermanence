import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
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
});
