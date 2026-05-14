interface DeliveryHeroProps {
  publishedCount: number
  totalCount: number
  status: string
  durationMs?: number
  platforms: string[]
}

const HERO_TEXTS: Record<string, string> = {
  completed: 'Entregues',
  partial_failure: 'Entregas parciais',
  publishing: 'Entregas em andamento...',
  failed: 'Falha na entrega',
}

const HERO_BG: Record<string, string> = {
  completed: 'bg-emerald-500/[0.08] border-emerald-500/20',
  partial_failure: 'bg-amber-500/[0.08] border-amber-500/20',
  publishing: 'bg-blue-500/[0.08] border-blue-500/20',
  failed: 'bg-red-500/[0.08] border-red-500/20',
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-500',
  instagram: 'bg-pink-500',
  bluesky: 'bg-cyan-500',
  youtube: 'bg-red-500',
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}m ${sec}s`
}

export function DeliveryHero({ publishedCount, totalCount, status, durationMs, platforms }: DeliveryHeroProps) {
  return (
    <div className={`rounded-lg border p-6 ${HERO_BG[status] ?? HERO_BG.publishing}`}>
      <div className="flex items-center gap-4">
        <div className="flex gap-1.5">
          {platforms.map((p) => (
            <div
              key={p}
              data-testid="platform-dot"
              className={`h-8 w-8 rounded-full ${PLATFORM_COLORS[p] ?? 'bg-cms-border'} flex items-center justify-center`}
              title={p}
            >
              <span className="text-white text-[10px] font-bold">{p[0]?.toUpperCase()}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-lg font-semibold text-cms-text">
            <span className="tabular-nums">{publishedCount}/{totalCount}</span>{' '}
            {HERO_TEXTS[status] ?? status}
          </p>
          {durationMs !== undefined && (
            <p className="text-sm text-cms-text-muted">{formatDuration(durationMs)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
