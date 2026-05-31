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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 10, width: 24, flexShrink: 0, color: 'var(--ink-dim)' }}>{label}</label>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        style={{ flex: 1, borderRadius: 6, padding: '2px 6px', fontSize: 11, width: 0, background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />
      {unit && <span style={{ fontSize: 9, width: 16, flexShrink: 0, color: 'var(--ink-dim)' }}>{unit}</span>}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--ink-dim)' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--ink-dim)' }}>{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        style={{ width: '100%' }}
      />
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginTop: 12, color: 'var(--ink-dim)' }}>{children}</h4>
}

/* ── Toggle Switch ── */

export function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 42, height: 24, borderRadius: 99,
        background: checked ? 'var(--accent)' : 'var(--surface-3, #3a3630)',
        border: 'none', cursor: 'pointer', padding: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

/* ── Position input (X / Y / L) ── */

export function PositionInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 4 }}>{label}</div>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line-strong)',
        borderRadius: 7, padding: '0 6px 0 8px',
        display: 'flex', alignItems: 'center',
      }}>
        <input
          type="number"
          value={Math.round(value)}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', padding: '6px 0', width: 0,
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>px</span>
      </div>
    </div>
  )
}
