'use client'

import { useState, useEffect } from 'react'
import type { RendererProps } from '../section-content'

interface SceneMusic {
  search_terms?: string
  style?: string
  entry_cue?: string
  continuation?: string
}

interface SceneSFX {
  timestamp: string
  description: string
  search_terms?: string
}

interface SceneOverlay {
  timestamp: string
  instruction: string
}

interface SceneMixParam {
  parameter: string
  value: string
}

interface SceneTransition {
  type: string
  reasoning?: string
}

interface Scene {
  number: number
  beat_ref?: string
  timestamps?: string
  duration?: string
  status?: string
  difficulty?: string
  narrative?: string
  music?: SceneMusic
  sfx?: SceneSFX[]
  overlays?: SceneOverlay[]
  mix?: SceneMixParam[]
  transition?: SceneTransition
  decide_items?: string[]
}

interface SceneGuideContent {
  scenes?: Scene[]
}

function parseContent(content: RendererProps['content']): SceneGuideContent {
  if (typeof content === 'string') return {}
  if (Array.isArray(content) || content === null) return {}
  return content as SceneGuideContent
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  DONE: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  PRONTO: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  IN_PROGRESS: { bg: 'rgba(234,179,8,0.15)', color: '#eab308' },
  EM_ANDAMENTO: { bg: 'rgba(234,179,8,0.15)', color: '#eab308' },
  PENDING: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  PENDENTE: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
}

const DIFFICULTY_STYLES: Record<string, { bg: string; color: string }> = {
  EASY: { bg: 'rgba(34,197,94,0.1)', color: '#86efac' },
  MEDIUM: { bg: 'rgba(234,179,8,0.1)', color: '#fde047' },
  HARD: { bg: 'rgba(239,68,68,0.1)', color: '#fca5a5' },
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--gem-dim)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function SceneCard({ scene, expandAll }: { scene: Scene; expandAll: boolean }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(expandAll)
  }, [expandAll])

  const statusStyle = scene.status ? (STATUS_STYLES[scene.status.toUpperCase()] ?? { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' }) : null
  const diffStyle = scene.difficulty ? (DIFFICULTY_STYLES[scene.difficulty.toUpperCase()] ?? null) : null
  const hasDecide = scene.decide_items && scene.decide_items.length > 0

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ border: '1px solid var(--gem-border)' }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
        style={{ background: 'var(--gem-well)' }}
      >
        <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--gem-accent)', minWidth: '1.25rem' }}>
          {scene.number}
        </span>
        <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--gem-text)' }}>
          {scene.beat_ref && <span style={{ color: 'var(--gem-dim)' }}>Beat {scene.beat_ref} · </span>}
          {scene.timestamps ?? '—'}
          {scene.duration && <span style={{ color: 'var(--gem-dim)' }}> · {scene.duration}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {hasDecide && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
              ⚠ DECIDE
            </span>
          )}
          {statusStyle && scene.status && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={statusStyle}>
              {scene.status}
            </span>
          )}
          {diffStyle && scene.difficulty && (
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={diffStyle}>
              {scene.difficulty}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 py-3 space-y-3 text-[11px]" style={{ borderTop: '1px solid var(--gem-border)' }}>
          {scene.narrative && (
            <SubSection title="Narrativa">
              <p className="m-0 leading-relaxed" style={{ color: 'var(--gem-muted)' }}>{scene.narrative}</p>
            </SubSection>
          )}

          {scene.music && (
            <SubSection title="Música">
              <div className="space-y-0.5" style={{ color: 'var(--gem-muted)' }}>
                {scene.music.search_terms && <div><span style={{ color: 'var(--gem-dim)' }}>Busca: </span>{scene.music.search_terms}</div>}
                {scene.music.style && <div><span style={{ color: 'var(--gem-dim)' }}>Estilo: </span>{scene.music.style}</div>}
                {scene.music.entry_cue && <div><span style={{ color: 'var(--gem-dim)' }}>Entrada: </span>{scene.music.entry_cue}</div>}
                {scene.music.continuation && <div><span style={{ color: 'var(--gem-dim)' }}>Continuação: </span>{scene.music.continuation}</div>}
              </div>
            </SubSection>
          )}

          {scene.sfx && scene.sfx.length > 0 && (
            <SubSection title="SFX">
              <div className="space-y-1">
                {scene.sfx.map((fx, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono text-[10px] flex-shrink-0" style={{ color: 'var(--gem-accent)' }}>{fx.timestamp}</span>
                    <span style={{ color: 'var(--gem-muted)' }}>
                      {fx.description}
                      {fx.search_terms && <span style={{ color: 'var(--gem-dim)' }}> — {fx.search_terms}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </SubSection>
          )}

          {scene.overlays && scene.overlays.length > 0 && (
            <SubSection title="Overlays">
              <div className="space-y-1">
                {scene.overlays.map((ov, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono text-[10px] flex-shrink-0" style={{ color: 'var(--gem-accent)' }}>{ov.timestamp}</span>
                    <span style={{ color: 'var(--gem-muted)' }}>{ov.instruction}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          )}

          {scene.mix && scene.mix.length > 0 && (
            <SubSection title="Mix">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {scene.mix.map((m, i) => (
                  <div key={i} className="flex gap-1.5">
                    <span style={{ color: 'var(--gem-dim)' }}>{m.parameter}:</span>
                    <span style={{ color: 'var(--gem-muted)' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          )}

          {scene.transition && (
            <SubSection title="Transição">
              <div style={{ color: 'var(--gem-muted)' }}>
                <strong style={{ color: 'var(--gem-text)' }}>{scene.transition.type}</strong>
                {scene.transition.reasoning && <span style={{ color: 'var(--gem-dim)' }}> — {scene.transition.reasoning}</span>}
              </div>
            </SubSection>
          )}

          {hasDecide && (
            <div className="p-2.5 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#f87171' }}>
                ⚠ Decisões pendentes
              </div>
              <ul className="pl-3.5 m-0 space-y-0.5">
                {scene.decide_items!.map((item, i) => (
                  <li key={i} className="text-[10px]" style={{ color: '#fca5a5' }}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SceneGuideRenderer({ content }: RendererProps) {
  const data = parseContent(content)
  const scenes = data.scenes ?? []
  const [allExpanded, setAllExpanded] = useState(false)

  if (scenes.length === 0) {
    return (
      <div className="p-5 text-[11px] text-center" style={{ color: 'var(--gem-dim)' }}>
        Nenhuma cena encontrada.
      </div>
    )
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
          {scenes.length} cena{scenes.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setAllExpanded(v => !v)}
          className="text-[10px] transition-colors"
          style={{ color: 'var(--gem-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {allExpanded ? 'Colapsar todas' : 'Expandir todas'}
        </button>
      </div>

      <div className="space-y-1.5">
        {scenes.map((scene, i) => (
          <SceneCard key={i} scene={scene} expandAll={allExpanded} />
        ))}
      </div>
    </div>
  )
}
