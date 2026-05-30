'use client'

interface FilterOption {
  id: string
  label: string
}

interface FilterGroupProps {
  label: string
  value: string
  onChange: (id: string) => void
  opts: FilterOption[]
}

export function FilterGroup({ label, value, onChange, opts }: FilterGroupProps) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
      <span className="eyebrow" style={{ marginRight: 2, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        {label}
      </span>
      {opts.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            style={{
              padding: '4px 10px',
              borderRadius: 7,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              background: active ? 'var(--accent)' : 'var(--surface-2)',
              color: active ? 'rgb(26, 18, 12)' : 'var(--ink-dim)',
              cursor: 'pointer',
              transition: '0.15s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
