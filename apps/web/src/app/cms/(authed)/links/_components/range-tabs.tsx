'use client'

type RangeId = '7d' | '30d' | '90d' | '1y'

const RANGE_OPTIONS: Array<{ id: RangeId; label: string }> = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
  { id: '1y', label: '1 ano' },
]

interface RangeTabsProps {
  value: RangeId
  onChange: (id: RangeId) => void
}

export function RangeTabs({ value, onChange }: RangeTabsProps) {
  return (
    <div className="inline-flex rounded-[9px] bg-muted p-[3px] gap-[2px]">
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-[7px] border-none px-[13px] py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === o.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
