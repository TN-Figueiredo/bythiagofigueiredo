'use client'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

export function NumberField({ label, value, onChange, min, max, step = 1, unit }: NumberFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] w-6 shrink-0" style={{ color: 'var(--ink-dim)' }}>{label}</label>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 rounded px-1.5 py-0.5 text-[11px] w-0"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />
      {unit && <span className="text-[9px] w-4 shrink-0" style={{ color: 'var(--ink-dim)' }}>{unit}</span>}
    </div>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
}

export function SliderField({ label, value, onChange, min, max, step = 1, format }: SliderFieldProps) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>{label}</span>
        <span className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 mt-3 first:mt-0" style={{ color: 'var(--ink-dim)' }}>{children}</h4>
}
