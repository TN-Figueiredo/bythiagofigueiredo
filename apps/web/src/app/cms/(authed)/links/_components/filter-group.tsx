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
    <div role="radiogroup" aria-label={label} className="flex items-center gap-[7px] flex-wrap">
      <span className="mr-[2px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
            className={`rounded-[7px] border-none px-[10px] py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 focus:ring-offset-background ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
