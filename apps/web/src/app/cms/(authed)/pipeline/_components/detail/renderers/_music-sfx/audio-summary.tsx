'use client'

import { useMemo } from 'react'
import type { SceneMusic, SceneSFX } from './types'
import { isContinuationTrack } from './continuation'

interface Scene {
  music?: SceneMusic
  sfx?: SceneSFX[]
}

interface Stats {
  total: number
  local: number
  pending: number
  partial: number
  noMatch: number
  continuations: number
}

function computeStats(scenes: Scene[]): { music: Stats; sfx: Stats } {
  const music: Stats = { total: 0, local: 0, pending: 0, partial: 0, noMatch: 0, continuations: 0 }
  const sfx: Stats = { total: 0, local: 0, pending: 0, partial: 0, noMatch: 0, continuations: 0 }

  for (const scene of scenes) {
    if (scene.music) {
      if (isContinuationTrack(scene.music)) {
        music.continuations++
      } else if (scene.music.resolve_status) {
        music.total++
        const s = scene.music.resolve_status
        if (s === 'LOCAL') music.local++
        else if (s === 'PENDING_MATCH') music.pending++
        else if (s === 'PARTIAL_MATCH') music.partial++
        else if (s === 'NO_MATCH') music.noMatch++
      }
    }
    if (scene.sfx) {
      for (const fx of scene.sfx) {
        if (!fx.resolve_status) continue
        sfx.total++
        const s = fx.resolve_status
        if (s === 'LOCAL') sfx.local++
        else if (s === 'PENDING_MATCH') sfx.pending++
        else if (s === 'PARTIAL_MATCH') sfx.partial++
        else if (s === 'NO_MATCH') sfx.noMatch++
      }
    }
  }

  return { music, sfx }
}

function ProgressBar({ stats }: { stats: Stats }) {
  if (stats.total === 0) return null
  const pctLocal = (stats.local / stats.total) * 100
  const pctPending = (stats.pending / stats.total) * 100
  const pctPartial = (stats.partial / stats.total) * 100
  const resolved = stats.local + stats.pending + stats.partial
  const pctResolved = Math.round((resolved / stats.total) * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {pctLocal > 0 && <div className="h-full" style={{ width: `${pctLocal}%`, background: '#10b981' }} />}
        {pctPending > 0 && <div className="h-full" style={{ width: `${pctPending}%`, background: '#f59e0b' }} />}
        {pctPartial > 0 && <div className="h-full" style={{ width: `${pctPartial}%`, background: '#f97316' }} />}
      </div>
      <span className="text-[10px] font-bold flex-shrink-0" style={{ color: pctResolved === 100 ? '#10b981' : 'var(--gem-accent)' }}>
        {pctResolved}%
      </span>
    </div>
  )
}

function StatChips({ stats }: { stats: Stats }) {
  return (
    <div className="flex gap-2.5 flex-wrap">
      {stats.local > 0 && <span className="text-[9px]" style={{ color: '#10b981' }}>✓ {stats.local} local</span>}
      {stats.pending > 0 && <span className="text-[9px]" style={{ color: '#f59e0b' }}>⏳ {stats.pending} download</span>}
      {stats.partial > 0 && <span className="text-[9px]" style={{ color: '#f97316' }}>~ {stats.partial} parcial</span>}
      {stats.noMatch > 0 && <span className="text-[9px]" style={{ color: '#3b82f6' }}>🔗 {stats.noMatch} buscar</span>}
    </div>
  )
}

export function AudioSummaryV2({ scenes }: { scenes: Scene[] }) {
  const { music, sfx } = useMemo(() => computeStats(scenes), [scenes])

  if (music.total === 0 && sfx.total === 0 && music.continuations === 0) return null

  return (
    <div className="rounded-md p-2.5 space-y-2" style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}>
      {(music.total > 0 || music.continuations > 0) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gem-dim)' }}>
              Música
            </span>
            {music.continuations > 0 && (
              <span className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>↩ {music.continuations} cont</span>
            )}
          </div>
          <ProgressBar stats={music} />
          <StatChips stats={music} />
        </div>
      )}

      {sfx.total > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gem-dim)' }}>
            SFX
          </span>
          <ProgressBar stats={sfx} />
          <StatChips stats={sfx} />
        </div>
      )}
    </div>
  )
}
