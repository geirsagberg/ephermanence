import { defaultAmbientBubbleSettings, type AmbientBubbleSettings } from '../spatialFieldScene'
import { cx } from '../../styled-system/css'
import {
  activePresetButtonClass,
  headingClass,
  presetButtonClass,
  presetsClass,
  sliderClass,
  tunerClass,
} from './AmbientBubbleTuner.css'

export const ambientBubblePresets = {
  whisper: { size: 0.6, presence: 0.3, density: 1 },
  haze: defaultAmbientBubbleSettings,
  realm: { size: 1, presence: 1, density: 3 },
} satisfies Record<string, AmbientBubbleSettings>

type PresetName = keyof typeof ambientBubblePresets

type AmbientBubbleTunerProps = {
  settings: AmbientBubbleSettings
  onChange: (settings: AmbientBubbleSettings, preset?: PresetName) => void
}

export function AmbientBubbleTuner({ settings, onChange }: AmbientBubbleTunerProps) {
  const activePreset = Object.entries(ambientBubblePresets).find(([, preset]) =>
    sameSettings(settings, preset),
  )?.[0] as PresetName | undefined

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
            className={cx(presetButtonClass, activePreset === name ? activePresetButtonClass : undefined)}
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
  )
}

type TunerSliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  output: string
  onChange: (value: number) => void
}

function TunerSlider({ label, value, min, max, step, output, onChange }: TunerSliderProps) {
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
  )
}

function sameSettings(left: AmbientBubbleSettings, right: AmbientBubbleSettings) {
  return left.size === right.size && left.presence === right.presence && left.density === right.density
}
