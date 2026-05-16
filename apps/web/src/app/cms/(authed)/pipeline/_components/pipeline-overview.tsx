'use client'

import Link from 'next/link'
import { getFormatIcon, getPriorityConfig } from '@/lib/pipeline/gem-design'
import { getFormatColor } from '@/lib/pipeline/colors'
import { PipelineSearchDropdown } from './pipeline-search-dropdown'

interface Stats {
  total: number
  inProgress: number
  highPriority: number
  scriptsReady: number
  published: number
}

interface RecommendationItem {
  id: string
  code: string
  title_pt: string | null
  format: string
  priority: number
  updated_at: string
  stage?: string
}

interface ActivityEntry {
  id: string
  code: string
  format: string
  event_type: string
  to_value: string | null
  changed_at: string
}

interface PipelineOverviewProps {
  stats: Stats
  recommendations: { nextToRecord: RecommendationItem[]; topPriority: RecommendationItem[] }
  activity: ActivityEntry[]
}

function relativeTime(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function eventLabel(type: string, to: string | null): string {
  switch (type) {
    case 'stage_change': return `moveu para ${to}`
    case 'created': return 'criado'
    case 'archived': return 'arquivado'
    case 'restored': return 'restaurado'
    case 'graduated': return 'graduado'
    default: return type
  }
}

export function PipelineOverview({ stats, recommendations, activity }: PipelineOverviewProps) {
  const kpis = [
    { label: 'Total Pipeline', value: stats.total, color: 'var(--gem-accent)' },
    { label: 'In Progress', value: stats.inProgress, color: '#0ea5e9' },
    { label: 'High Priority', value: stats.highPriority, color: '#ef4444' },
    { label: 'Scripts Ready', value: stats.scriptsReady, color: '#10b981' },
    { label: 'Published', value: stats.published, color: '#8b5cf6' },
  ]

  return (
    <div className="space-y-6">
      <div className="max-w-sm ml-auto">
        <PipelineSearchDropdown />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--gem-dim)' }}>{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Grave a seguir</h3>
          <div className="space-y-2">
            {recommendations.nextToRecord.map((item) => {
              const icon = getFormatIcon(item.format)
              const pri = getPriorityConfig(item.priority)
              return (
                <Link key={item.id} href={`/cms/pipeline/items/${item.id}`} className="flex items-center gap-2 py-1 hover:bg-white/5 rounded px-1">
                  <span className="text-xs">{icon.icon}</span>
                  <span className="text-[10px] font-mono" style={{ color: pri.accent }}>{item.code}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{item.title_pt}</span>
                </Link>
              )
            })}
            {recommendations.nextToRecord.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--gem-dim)' }}>Nenhum pronto para gravar</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Top prioridade</h3>
          <div className="space-y-2">
            {recommendations.topPriority.map((item) => {
              const icon = getFormatIcon(item.format)
              const pri = getPriorityConfig(item.priority)
              return (
                <Link key={item.id} href={`/cms/pipeline/items/${item.id}`} className="flex items-center gap-2 py-1 hover:bg-white/5 rounded px-1">
                  <span className="text-xs">{icon.icon}</span>
                  <span className="text-[10px] font-mono" style={{ color: pri.accent }}>{item.code}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{item.title_pt}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}>{item.stage}</span>
                </Link>
              )
            })}
            {recommendations.topPriority.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--gem-dim)' }}>Nenhum com prioridade alta</p>
            )}
          </div>
        </div>
      </div>

      {activity.length > 0 && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Atividade recente</h3>
          <div className="space-y-1.5">
            {activity.map((entry) => {
              const colors = getFormatColor(entry.format)
              return (
                <div key={entry.id} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors.accent }} />
                  <span style={{ color: 'var(--gem-text)' }}>{entry.code}</span>
                  <span style={{ color: 'var(--gem-muted)' }}>{eventLabel(entry.event_type, entry.to_value)}</span>
                  <span className="ml-auto" style={{ color: 'var(--gem-dim)' }}>{relativeTime(entry.changed_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="rounded-lg border p-8 text-center" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--gem-muted)' }}>Pipeline vazio. Crie seu primeiro item.</p>
          <Link href="/cms/pipeline/video" className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--gem-accent)', color: 'white' }}>+ Novo item</Link>
        </div>
      )}
    </div>
  )
}
