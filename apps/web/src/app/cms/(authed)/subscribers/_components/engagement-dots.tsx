export type DotStatus = 'opened' | 'clicked' | 'none' | 'bounced' | 'complained'

const DOT_COLORS: Record<DotStatus, string> = {
  opened: 'bg-cms-green',
  clicked: 'bg-cms-cyan',
  none: 'bg-cms-text-dim',
  bounced: 'bg-cms-red',
  complained: 'bg-cms-rose',
}

interface EngagementDotsProps {
  dots: DotStatus[]
  ariaLabel: string
}

export function EngagementDots({ dots, ariaLabel }: EngagementDotsProps) {
  return (
    <div className="flex gap-1" aria-label={ariaLabel} role="img">
      {dots.slice(0, 5).map((d, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${DOT_COLORS[d]}`} />
      ))}
    </div>
  )
}
