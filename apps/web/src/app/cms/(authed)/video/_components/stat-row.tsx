import type { VideoHubStats } from '@/lib/pipeline/load-video-hub'

interface StatDef {
  key: keyof VideoHubStats
  label: string
  accent: string
}

const STATS: StatDef[] = [
  { key: 'total', label: 'Total', accent: 'var(--text)' },
  { key: 'roteiro', label: 'Em roteiro', accent: 'var(--c-pipeline)' },
  { key: 'gravacao', label: 'Prontos p/ gravar', accent: 'var(--warn)' },
  { key: 'published', label: 'Publicados', accent: 'var(--c-links)' },
]

export function StatRow({ stats }: { stats: VideoHubStats }) {
  return (
    <div className="vhub-grid">
      {STATS.map((s) => (
        <div key={s.key} className="stat-card" style={{ ['--bc' as string]: s.accent }}>
          <div className="stat-card-n">{stats[s.key]}</div>
          <div className="stat-card-l">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
