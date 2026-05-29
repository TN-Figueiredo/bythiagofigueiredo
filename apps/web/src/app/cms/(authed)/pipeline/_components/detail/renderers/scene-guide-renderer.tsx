'use client'

import { useState, useMemo, useRef } from 'react'
import type { RendererProps } from '../section-content'
import { TagPill, OptionalBadge, getTagColor } from './tokens'
import { tokenizeText } from './parse-tokens'
import { categorizeNote, type CategorizedNote, type NoteCategory } from './categorize-note'
import { parseArtlistSearch, parseArtlistSfxRef, buildArtlistTierUrls } from '@/lib/pipeline/artlist-search'
import {
  type SceneMusic,
  type SceneMusicRaw,
  type SceneSFX,
  type MusicRecommendation,
  SCORE_MAX,
  SFXItemCard,
  AudioSummaryV2,
} from './_music-sfx'
import type { ArtlistSearchTier } from './_music-sfx/types'
import { MusicHeroSection } from './_music-sfx/music-hero-section'

const MUSIC_ABSORBED_CATEGORIES: NoteCategory[] = ['MUSIC', 'STYLE', 'ENTRY', 'FLOW']

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

interface SceneRaw {
  number: number
  label?: string
  beat_ref?: string
  timestamps?: string
  timeline?: string
  duration?: string
  status?: string
  difficulty?: string
  narrative?: string
  edit_notes?: string[]
  music?: SceneMusicRaw
  sfx?: SceneSFX[]
  overlays?: SceneOverlay[]
  mix?: SceneMixParam[]
  transition?: SceneTransition
  decide_items?: string[]
}

interface Scene extends Omit<SceneRaw, 'music'> {
  music?: SceneMusic
}

interface SceneGuideContent {
  scenes?: SceneRaw[]
}

function makeEmptyRec(tier: ArtlistSearchTier, searchUrl: string): MusicRecommendation {
  return {
    track: '', artist: '', resolve_status: 'NO_MATCH', score: 0, score_max: SCORE_MAX,
    is_empty_slot: true, artlist_search_tier: tier, artlist_search_url: searchUrl,
  }
}

function normalizeRec(raw: Partial<MusicRecommendation>, tier: ArtlistSearchTier): MusicRecommendation {
  return {
    track: raw.track ?? '',
    artist: raw.artist ?? '',
    resolve_status: raw.resolve_status ?? 'NO_MATCH',
    score: raw.score ?? 0,
    score_max: raw.score_max ?? SCORE_MAX,
    is_empty_slot: false,
    artlist_search_tier: raw.artlist_search_tier ?? tier,
    original_filename: raw.original_filename,
    audio_asset_id: raw.audio_asset_id,
    score_breakdown: raw.score_breakdown,
    reasoning: raw.reasoning,
    delta_vs_favorite: raw.delta_vs_favorite,
    category: raw.category,
    energy: raw.energy,
    bpm: raw.bpm,
    key: raw.key,
    duration: raw.duration,
    artlist_url: raw.artlist_url,
    artlist_search_url: raw.artlist_search_url,
    slot_label: raw.slot_label,
  }
}

function normalizeSceneMusic(raw: SceneMusicRaw): SceneMusic {
  const searchTerms = raw.search_terms ?? ''
  const tiers = searchTerms
    ? buildArtlistTierUrls({ searchTerms, bpm: null, duration: null })
    : { narrow: '', medium: '', broad: '' }

  if (raw.recommendations && raw.recommendations.length >= 3 && raw.fill_count != null && raw.search_tiers) {
    return raw as SceneMusic
  }

  const oldRecs = raw.recommendations ?? []
  const tierOrder: ArtlistSearchTier[] = ['narrow', 'medium', 'broad']

  const mainRec: MusicRecommendation | null = raw.track
    ? normalizeRec({
        track: raw.track,
        artist: raw.artist,
        resolve_status: raw.resolve_status,
        score: raw.score ?? 0,
        score_max: raw.score_max ?? SCORE_MAX,
        original_filename: raw.original_filename,
        audio_asset_id: raw.audio_asset_id,
        score_breakdown: raw.score_breakdown,
        reasoning: raw.reasoning,
        artlist_url: raw.artlist_url,
      }, 'narrow')
    : null

  const filled: MusicRecommendation[] = []
  if (oldRecs.length > 0) {
    for (const r of oldRecs) filled.push(normalizeRec(r, tierOrder[filled.length] ?? 'broad'))
  } else if (mainRec) {
    filled.push(mainRec)
  }

  const recs: [MusicRecommendation, MusicRecommendation, MusicRecommendation] = [
    filled[0] ?? makeEmptyRec('narrow', tiers.narrow),
    filled[1] ?? makeEmptyRec('medium', tiers.medium),
    filled[2] ?? makeEmptyRec('broad', tiers.broad),
  ]

  const fillCount = recs.filter(r => !r.is_empty_slot).length

  return {
    ...raw,
    recommendations: recs,
    favorite_index: Math.min(raw.favorite_index ?? 0, 2) as 0 | 1 | 2,
    fill_count: fillCount,
    search_tiers: raw.search_tiers ?? tiers,
  }
}

function parseContent(content: RendererProps['content']): SceneGuideContent {
  if (typeof content === 'string') return {}
  if (Array.isArray(content) || content === null) return {}
  return content as SceneGuideContent
}

function normalizeScenes(raw: SceneRaw[]): Scene[] {
  return raw.map(scene => ({
    ...scene,
    music: scene.music ? normalizeSceneMusic(scene.music) : undefined,
  }))
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

/* ---------- Categorized Notes components ---------- */

function groupByTimestamp(notes: CategorizedNote[]): { timestamp: string; notes: CategorizedNote[] }[] {
  const map = new Map<string, CategorizedNote[]>()
  for (const n of notes) {
    const ts = n.timestamp!
    if (!map.has(ts)) map.set(ts, [])
    map.get(ts)!.push(n)
  }
  return Array.from(map.entries()).map(([timestamp, grouped]) => ({ timestamp, notes: grouped }))
}

function ArtlistLinks({ text }: { text: string }) {
  const result = parseArtlistSearch(text)
  if (!result) return null
  return (
    <div className="flex items-center gap-1.5 pl-[58px] -mt-0.5 pb-0.5">
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buscar música no Artlist (abre em nova aba)"
        className="text-[10px] font-medium transition-colors hover:underline"
        style={{ color: '#c084fc' }}
      >
        Buscar no Artlist ↗
      </a>
      {result.fallbackUrl && (
        <>
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>·</span>
          <a
            href={result.fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buscar no Artlist com menos filtros"
            className="text-[10px] transition-colors hover:underline"
            style={{ color: 'var(--gem-dim)' }}
          >
            Menos filtros ↗
          </a>
        </>
      )}
    </div>
  )
}

function ArtlistSfxInline({ text }: { text: string }) {
  const ref = parseArtlistSfxRef(text)
  if (!ref) return null
  return (
    <a
      href={ref.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] font-medium ml-1 transition-colors hover:underline"
      style={{ color: '#fbbf24' }}
    >
      ↗ Artlist
    </a>
  )
}

function NoteLine({ note, stripLeadingTs }: { note: CategorizedNote; stripLeadingTs?: boolean }) {
  const textColor = getTagColor(note.category).text
  let displayText = note.text
  if (stripLeadingTs && note.timestamp && note.text.startsWith(note.timestamp)) {
    displayText = note.text.slice(note.timestamp.length).replace(/^[\s:–-]+/, '')
  }
  return (
    <>
      <div className="flex items-start gap-2 py-1 px-1 rounded transition-colors hover:bg-white/[0.03]">
        <TagPill tag={note.category} />
        <span className="text-xs leading-relaxed" style={{ color: textColor }}>
          {note.isOptional && <OptionalBadge />}
          {tokenizeText(displayText)}
          <ArtlistSfxInline text={note.text} />
        </span>
      </div>
      {note.category === 'MUSIC' && <ArtlistLinks text={note.text} />}
    </>
  )
}

function CategorizedNotes({ notes }: { notes: string[] }) {
  const categorized = useMemo(() => notes.map(n => categorizeNote(n)), [notes])
  const nonTemporal = categorized.filter(n => !n.timestamp)
  const temporal = categorized.filter(n => n.timestamp)
  const grouped = groupByTimestamp(temporal)

  return (
    <div>
      {nonTemporal.map((n, i) => (
        <NoteLine key={`nt-${i}`} note={n} />
      ))}
      {grouped.length > 0 && (
        <div className="tl-strip relative pl-5 mt-1.5">
          <div
            className="absolute left-[7px] top-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(180deg, rgba(129,140,248,0.19), rgba(129,140,248,0.06))' }}
          />
          {grouped.map((group, gi) => (
            <div key={gi} className="tl-point relative py-1">
              <div
                className="absolute w-[7px] h-[7px] rounded-full"
                style={{ left: -17, top: 10, background: 'rgba(129,140,248,0.25)', border: '1.5px solid #818cf8' }}
              />
              <span className="font-mono text-[10px] font-bold block mb-0.5" style={{ color: '#818cf8' }}>
                {group.timestamp}
              </span>
              <div className="pl-0.5">
                {group.notes.length > 1 ? (
                  <div style={{ borderLeft: '1px solid var(--gem-border)', paddingLeft: 6 }}>
                    {group.notes.map((n, ni) => <NoteLine key={ni} note={n} stripLeadingTs />)}
                  </div>
                ) : (
                  <NoteLine note={group.notes[0]!} stripLeadingTs />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- SubSection ---------- */

function SubSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gem-dim)' }}>
          {title}
        </span>
        {subtitle && (
          <span className="text-[8px]" style={{ color: '#3d4f65', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/* ---------- SceneCard ---------- */

function SceneCard({ scene, expandAll, sceneIndex, itemCode }: { scene: Scene; expandAll: boolean; sceneIndex: number; itemCode?: string }) {
  const [expanded, setExpanded] = useState(expandAll)
  const prevExpandAll = useRef(expandAll)
  if (prevExpandAll.current !== expandAll) {
    prevExpandAll.current = expandAll
    setExpanded(expandAll)
  }

  const statusStyle = scene.status ? (STATUS_STYLES[scene.status.toUpperCase()] ?? { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' }) : null
  const diffStyle = scene.difficulty ? (DIFFICULTY_STYLES[scene.difficulty.toUpperCase()] ?? null) : null
  const hasDecide = scene.decide_items && scene.decide_items.length > 0

  const filteredNotes = useMemo(() => {
    if (!scene.edit_notes) return []
    const absorbed: NoteCategory[] = []
    if (scene.music) absorbed.push(...MUSIC_ABSORBED_CATEGORIES)
    if (scene.sfx && scene.sfx.length > 0) absorbed.push('SFX')
    if (absorbed.length === 0) return scene.edit_notes
    return scene.edit_notes.filter((n: string) => {
      const { category } = categorizeNote(n)
      return !absorbed.includes(category)
    })
  }, [scene.edit_notes, scene.music, scene.sfx])

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
        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--gem-accent)', minWidth: '1.25rem' }}>
          {scene.number}
        </span>
        <span className="text-xs font-medium flex-1" style={{ color: 'var(--gem-text)' }}>
          {scene.beat_ref && <span style={{ color: 'var(--gem-dim)' }}>Beat {scene.beat_ref} · </span>}
          {scene.label ?? scene.timestamps ?? scene.timeline ?? '—'}
          {scene.duration && <span style={{ color: 'var(--gem-dim)' }}> · {scene.duration}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {hasDecide && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
              DECIDE
            </span>
          )}
          {statusStyle && scene.status && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={statusStyle}>
              {scene.status}
            </span>
          )}
          {diffStyle && scene.difficulty && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={diffStyle}>
              {scene.difficulty}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 py-3 space-y-3 text-xs" style={{ borderTop: '1px solid var(--gem-border)' }}>
          {scene.narrative && (
            <div
              className="text-xs leading-snug italic pb-2 mb-2"
              style={{ color: 'var(--gem-dim)', borderBottom: '1px solid var(--gem-border)' }}
            >
              {scene.narrative}
            </div>
          )}

          {scene.music && (
            <MusicHeroSection music={scene.music} sceneIndex={sceneIndex} itemCode={itemCode} />
          )}

          {filteredNotes.length > 0 && (
            <SubSection title="Notas de Edição">
              <CategorizedNotes notes={filteredNotes} />
            </SubSection>
          )}

          {scene.sfx && scene.sfx.length > 0 && (
            <SubSection
              title="SFX"
              subtitle={(() => {
                const total = scene.sfx.length
                const local = scene.sfx.filter(f => f.resolve_status === 'LOCAL').length
                const search = scene.sfx.filter(f => f.resolve_status === 'NO_MATCH').length
                const parts = [`${total} efeito${total !== 1 ? 's' : ''}`]
                if (local > 0) parts.push(`${local} local`)
                if (search > 0) parts.push(`${search} buscar`)
                return parts.join(' · ')
              })()}
            >
              <div className="space-y-1">
                {scene.sfx.map((fx, i) => (
                  <SFXItemCard key={i} sfx={fx} />
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
                    <span style={{ color: 'var(--gem-muted)' }}>{tokenizeText(ov.instruction)}</span>
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
                    <span style={{ color: 'var(--gem-muted)' }}>{tokenizeText(m.value)}</span>
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
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#f87171' }}>
                Decisões pendentes
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

/* ---------- Main renderer ---------- */

export function SceneGuideRenderer({ content, itemCode }: RendererProps) {
  const data = parseContent(content)
  const scenes = useMemo(() => normalizeScenes(data.scenes ?? []), [data.scenes])
  const [allExpanded, setAllExpanded] = useState(true)

  if (scenes.length === 0) {
    return (
      <div className="p-5 text-xs text-center" style={{ color: 'var(--gem-dim)' }}>
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

      <AudioSummaryV2 scenes={scenes} />

      <div className="space-y-1.5">
        {scenes.map((scene, i) => (
          <SceneCard key={i} scene={scene} expandAll={allExpanded} sceneIndex={scene.number ?? i + 1} itemCode={itemCode} />
        ))}
      </div>
    </div>
  )
}
