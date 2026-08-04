import { useEffect } from 'react';

export type VariantKey = 'A' | 'B' | 'C';

const variants: { key: VariantKey; name: string }[] = [
  { key: 'A', name: 'Drift' },
  { key: 'B', name: 'Landing' },
  { key: 'C', name: 'Focus' },
];

type PrototypeSwitcherProps = {
  current: VariantKey;
  onChange: (variant: VariantKey) => void;
};

export function PrototypeSwitcher({ current, onChange }: PrototypeSwitcherProps) {
  const currentIndex = variants.findIndex((variant) => variant.key === current);
  const cycle = (direction: -1 | 1) => {
    const next = (currentIndex + direction + variants.length) % variants.length;
    onChange(variants[next].key);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') cycle(-1);
      if (event.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (import.meta.env.PROD) return null;

  return (
    <nav className="prototype-switcher" aria-label="Prototype variants">
      <button onClick={() => cycle(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        {current} — {variants[currentIndex].name}
      </span>
      <button onClick={() => cycle(1)} aria-label="Next variant">
        →
      </button>
    </nav>
  );
}
