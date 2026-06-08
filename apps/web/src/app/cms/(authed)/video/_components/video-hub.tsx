'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { VideoCard } from './video-card'
import { PILLARS, type PillarId } from '@/lib/pipeline/pillars'
import { CHANNELS } from '@/lib/pipeline/channels'
import type { VideoColumn } from '@/lib/pipeline/video-lifecycle'
import type { VideoHubData } from '@/lib/pipeline/load-video-hub'

const ptName = CHANNELS.find((c) => c.lang === 'pt')?.name ?? 'PT'
const enName = CHANNELS.find((c) => c.lang === 'en')?.name ?? 'EN'

const COLUMNS: { key: VideoColumn; label: string; color: string }[] = [
  { key: 'idea', label: 'Ideia', color: '#8b8cf6' },
  { key: 'roteiro', label: 'Roteiro', color: '#22b8d6' },
  { key: 'gravacao', label: 'Gravação', color: '#f59e0b' },
  { key: 'published', label: 'Publicado', color: '#22c55e' },
]

export function VideoHub({ data }: { data: VideoHubData }) {
  const [pillar, setPillar] = useState<PillarId | 'all'>('all')

  const shown =
    pillar === 'all' ? data.cards : data.cards.filter((c) => c.pillar === pillar)

  const stats = [
    { v: String(data.stats.total), l: 'Total', c: 'var(--text)' },
    { v: String(data.stats.roteiro), l: 'Em roteiro', c: '#22b8d6' },
    { v: String(data.stats.gravacao), l: 'Prontos p/ gravar', c: '#f59e0b' },
    { v: String(data.stats.published), l: 'Publicados', c: '#22c55e' },
  ]

  return (
    <div className="fade-in">
      <div className="mod-head">
        <span className="mod-title">Vídeos</span>
        <span className="mod-live">
          <i /> Canal {ptName} · {enName}
        </span>
        <div className="grow" style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={() =>
            toast.info('Novo Vídeo', {
              description: 'Em breve — começa como uma ideia pra destrinchar depois.',
            })
          }
        >
          <Plus size={15} /> Novo Vídeo
        </button>
      </div>

      <div className="vhub-grid">
        {stats.map((s, i) => (
          <div key={i} className="bstat" style={{ ['--bc' as string]: s.c }}>
            <div className="bv">{s.v}</div>
            <div className="bl">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="cat-rail">
        <button
          className={'cat-chip' + (pillar === 'all' ? ' on' : '')}
          onClick={() => setPillar('all')}
        >
          Todos <span className="ccount">{data.cards.length}</span>
        </button>
        {PILLARS.map((p) => {
          const c = data.pillarCounts[p.id] ?? 0
          return (
            <button
              key={p.id}
              className={'cat-chip' + (pillar === p.id ? ' on' : '')}
              onClick={() => setPillar(p.id)}
            >
              <span className="cdot" style={{ background: p.color }} /> {p.label}
              {c > 0 && <span className="ccount">{c}</span>}
            </button>
          )
        })}
      </div>

      <div className="vkanban">
        {COLUMNS.map((col) => {
          const items = shown.filter((c) => c.column === col.key)
          return (
            <div key={col.key} className="vcol">
              <div className="vcol-head" style={{ ['--kc' as string]: col.color }}>
                <span className="vdot" />
                <span className="vcol-name">{col.label}</span>
                <span className="vcol-count">{items.length}</span>
              </div>
              <div className="vcol-body">
                {items.length === 0 ? (
                  <div
                    className="kcol-empty"
                    style={{ padding: '14px 8px', fontSize: 12 }}
                  >
                    Vazio
                  </div>
                ) : (
                  items.map((c) => <VideoCard key={c.id} card={c} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
