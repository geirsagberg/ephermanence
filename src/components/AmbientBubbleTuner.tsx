import {
  defaultAmbientBubbleSettings,
  type AmbientBubbleSettings,
} from '../spatialFieldScene';
import { css, cx } from '../../styled-system/css';

export const ambientBubblePresets = {
  whisper: { size: 0.6, presence: 0.3, density: 1 },
  haze: defaultAmbientBubbleSettings,
  realm: { size: 1, presence: 1, density: 3 },
} satisfies Record<string, AmbientBubbleSettings>;

type PresetName = keyof typeof ambientBubblePresets;

type AmbientBubbleTunerProps = {
  settings: AmbientBubbleSettings;
  onChange: (settings: AmbientBubbleSettings, preset?: PresetName) => void;
};

export function AmbientBubbleTuner({ settings, onChange }: AmbientBubbleTunerProps) {
  const activePreset = Object.entries(ambientBubblePresets).find(([, preset]) =>
    sameSettings(settings, preset),
  )?.[0] as PresetName | undefined;

  return (
    <aside className={tunerClass} aria-label="Background bubble tuner">
      <div className={headingClass}>
        <span>Background bubbles</span>
        <small>Hidden controls</small>
      </div>
      <div className={presetsClass} aria-label="Bubble presets">
        {(Object.keys(ambientBubblePresets) as PresetName[]).map((name) => (
          <button
            key={name}
            type="button"
            className={cx(
              presetButtonClass,
              activePreset === name ? activePresetButtonClass : undefined,
            )}
            aria-pressed={activePreset === name}
            onClick={() => onChange(ambientBubblePresets[name], name)}
          >
            {name}
          </button>
        ))}
      </div>
      <TunerSlider
        label="Size"
        value={settings.size}
        min={0.45}
        max={1.3}
        step={0.05}
        output={`${Math.round(settings.size * 100)}%`}
        onChange={(size) => onChange({ ...settings, size })}
      />
      <TunerSlider
        label="Presence"
        value={settings.presence}
        min={0.15}
        max={1}
        step={0.05}
        output={`${Math.round(settings.presence * 100)}%`}
        onChange={(presence) => onChange({ ...settings, presence })}
      />
      <TunerSlider
        label="Number"
        value={settings.density}
        min={1}
        max={4}
        step={1}
        output={`${settings.density}`}
        onChange={(density) => onChange({ ...settings, density })}
      />
    </aside>
  );
}

type TunerSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  output: string;
  onChange: (value: number) => void;
};

function TunerSlider({
  label,
  value,
  min,
  max,
  step,
  output,
  onChange,
}: TunerSliderProps) {
  return (
    <label className={sliderClass}>
      <span>{label}</span>
      <output>{output}</output>
      <input
        aria-label={`Bubble ${label.toLowerCase()}`}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

const tunerClass = css({
  position: 'fixed',
  zIndex: 20,
  top: '18px',
  right: '18px',
  width: 'min(244px, calc(100vw - 36px))',
  padding: '14px',
  border: '1px solid rgb(255 255 255 / 72%)',
  borderRadius: '18px',
  background: 'rgb(245 243 236 / 88%)',
  boxShadow: '0 12px 32px rgb(51 59 54 / 15%)',
  backdropFilter: 'blur(18px)',
  '@media (max-width: 720px)': {
    top: '56px',
  },
});

const headingClass = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  marginBottom: '10px',
  color: '#36423c',
  fontSize: '12px',
  fontWeight: 500,
  '& small': {
    color: 'rgb(54 66 60 / 48%)',
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
});

const presetsClass = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '5px',
  marginBottom: '12px',
});

const presetButtonClass = css({
  padding: '6px 4px',
  border: '1px solid rgb(54 66 60 / 12%)',
  borderRadius: '999px',
  background: 'rgb(255 255 255 / 42%)',
  color: 'rgb(54 66 60 / 65%)',
  fontSize: '10px',
  textTransform: 'capitalize',
  cursor: 'pointer',
});

const activePresetButtonClass = css({
  borderColor: 'rgb(72 94 82 / 38%)',
  background: 'rgb(218 229 222 / 80%)',
  color: '#35473e',
});

const sliderClass = css({
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '5px 8px',
  alignItems: 'center',
  marginTop: '9px',
  color: 'rgb(54 66 60 / 72%)',
  fontSize: '10px',
  '& output': {
    color: '#36423c',
    fontVariantNumeric: 'tabular-nums',
  },
  '& input': {
    gridColumn: '1 / -1',
    width: '100%',
    accentColor: '#718c7d',
  },
});

function sameSettings(left: AmbientBubbleSettings, right: AmbientBubbleSettings) {
  return (
    left.size === right.size &&
    left.presence === right.presence &&
    left.density === right.density
  );
}
