import { describe, expect, it } from 'vitest';

import indexHtml from '../index.html?raw';
import pandaConfig from '../panda.config.ts?raw';

describe('browser chrome theme', () => {
  it('applies the stored color mode before the app starts', () => {
    const themeInitializer = indexHtml.indexOf('ephermanence-color-mode');
    const appEntryPoint = indexHtml.indexOf('/src/main.tsx');

    expect(indexHtml).toContain('<meta name="color-scheme" content="light dark" />');
    expect(themeInitializer).toBeGreaterThan(-1);
    expect(themeInitializer).toBeLessThan(appEntryPoint);
    expect(indexHtml).toContain('document.documentElement.dataset.theme = colorMode');
    expect(indexHtml).toContain('themeColor.content =');
  });

  it('gives the browser canvas a dark background in dark mode', () => {
    expect(pandaConfig).toContain("'[data-theme=dark]':");
    expect(pandaConfig).toContain("background: '#171b19'");
  });
});
