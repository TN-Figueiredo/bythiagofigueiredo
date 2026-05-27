// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/asset-resolver.tsx
'use client'

import { useState, useCallback, memo } from 'react'
import type { BeatAssets, MusicAsset, SfxAsset, VisualAsset, AmbienceAsset, SoundDesignAsset } from './types'
import { TH, MONO_XS_CLS, MONO_SM_CLS } from './constants'

interface AssetResolverProps {
  assets: BeatAssets | undefined
}

/* ── Music Section ─────────────────────────────────── */

function MusicSection({ items }: { items: MusicAsset[] }) {
  const [selections, setSelections] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {}
    items.forEach(m => { if (m.selected) s[m.id] = true })
    return s
  })
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>(() => {
    const c: Record<string, boolean> = {}
    items.forEach(m => { if (m.confirmed) c[m.id] = true })
    return c
  })

  const selectMusic = useCallback((id: string) => {
    setSelections(() => {
      const next: Record<string, boolean> = {}
      items.forEach(m => { next[m.id] = m.id === id })
      return next
    })
  }, [items])

  const confirmMusic = useCallback((id: string) => {
    setConfirmed(prev => ({ ...prev, [id]: true }))
  }, [])

  return (
    <div className="mb-3.5">
      <div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 6 }}>MÚSICA</div>
      <div className="flex flex-col gap-1.5">
        {items.map(m => {
          const isSel = selections[m.id] ?? false
          const isConf = confirmed[m.id] ?? false
          if (isConf && !isSel) return null
          return (
            <div
              key={m.id}
              className="rounded-[5px] cursor-pointer"
              style={{
                padding: '10px 12px',
                background: isSel ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                border: isSel ? `1px solid rgba(99,102,241,0.25)` : `1px solid ${TH.border}`,
                opacity: isConf ? 0.6 : 1,
                cursor: isConf ? 'default' : 'pointer',
              }}
              onClick={() => !isConf && selectMusic(m.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                {isSel && <span className="text-[12px]" style={{ color: TH.accent }}>★</span>}
                <span className="text-[13px] font-semibold" style={{ color: TH.text }}>{m.name}</span>
                <span className="text-xs" style={{ color: TH.muted }}>— {m.artist}</span>
                <div className="flex-1" />
                {m.local ? (
                  <span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60', background: 'rgba(39,174,96,0.12)', padding: '1px 5px', borderRadius: 2 }}>✓ Local</span>
                ) : (
                  <span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E67E22', background: 'rgba(230,126,34,0.12)', padding: '1px 5px', borderRadius: 2 }}>⬇ Download</span>
                )}
                <span className="font-mono text-[16px] font-bold" style={{ color: m.match >= 80 ? '#27AE60' : m.match >= 60 ? TH.text : TH.muted }}>
                  {m.match}<span className="text-[10px] opacity-60">%</span>
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}>{m.genre}</span>
                {m.bpm != null && <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}>{m.bpm} BPM</span>}
                {m.dur && <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}>{m.dur}</span>}
                <div className="flex-1" />
                <div className="flex gap-1 flex-wrap">
                  {(m.tags ?? []).slice(0, 3).map(tag => (
                    <span key={tag} className="font-mono text-[8px] rounded-sm" style={{ color: TH.dim, padding: '1px 5px', background: 'rgba(255,255,255,0.04)' }}>{tag}</span>
                  ))}
                </div>
              </div>
              {m.note && <div className="text-xs italic mt-0.5" style={{ color: TH.muted }}>{m.note}</div>}
              {isSel && !isConf && (
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); confirmMusic(m.id) }}
                    className="font-mono text-[10px] font-semibold rounded-[3px] border-none cursor-pointer"
                    style={{ padding: '4px 12px', background: TH.accent, color: '#fff' }}
                  >
                    ✓ Confirmar Seleção
                  </button>
                </div>
              )}
              {isConf && <div className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60', marginTop: 4 }}>✓ CONFIRMADO</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── SFX Section ───────────────────────────────────── */

function SfxSection({ items }: { items: SfxAsset[] }) {
  return (
    <div className="mb-3.5">
      <div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 6 }}>SFX</div>
      <div className="flex flex-col gap-1.5">
        {items.map((s, i) => (
          <div key={i} className="rounded p-2 px-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${TH.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px]" style={{ color: TH.accent }}>{s.tc}</span>
              <span
                className={MONO_XS_CLS}
                style={{ fontSize: 8, color: s.typeColor, border: `1px solid ${s.typeColor}`, padding: '0 4px', borderRadius: 2 }}
              >
                {s.type}
              </span>
              <span className="text-xs" style={{ color: TH.text }}>{s.desc}</span>
            </div>
            {s.file ? (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs" style={{ color: TH.muted }}>{s.file.name}</span>
                <span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60', background: 'rgba(39,174,96,0.12)', padding: '1px 5px', borderRadius: 2 }}>✓ Local</span>
                <span className="font-mono text-[12px] font-semibold" style={{ color: s.file.match >= 80 ? '#27AE60' : TH.text }}>{s.file.match}%</span>
              </div>
            ) : (
              <div className={MONO_XS_CLS} style={{ fontSize: 9, color: '#E67E22', marginBottom: 4 }}>⚠ Nenhum arquivo selecionado — buscar</div>
            )}
            <div className="flex gap-1 flex-wrap items-center">
              {(s.tags ?? []).map(tag => (
                <span key={tag} className="font-mono text-[8px] rounded-full cursor-pointer" style={{ color: TH.dim, padding: '1px 5px', background: 'rgba(255,255,255,0.04)' }}>{tag} ↗</span>
              ))}
              {s.altCount != null && <span className={`${MONO_SM_CLS} cursor-pointer ml-1`} style={{ fontSize: 9, color: TH.accent }}>+{s.altCount} alt →</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Visual Section ────────────────────────────────── */

function VisualSection({ items }: { items: VisualAsset[] }) {
  return (
    <div className="mb-3.5">
      <div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 6 }}>VISUAL</div>
      <div className="flex flex-col gap-1">
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-2 rounded-[3px] px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${TH.border}` }}>
            <span className="font-mono text-[10px]" style={{ color: TH.accent }}>{v.tc}</span>
            <span className="text-xs flex-1" style={{ color: TH.text }}>{v.desc}</span>
            {v.status === 'resolved' ? (
              <span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60' }}>✓ {v.file}</span>
            ) : (
              <>
                <span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E67E22' }}>⚠ Pendente</span>
                <button className={`${MONO_SM_CLS} cursor-pointer border-none bg-transparent`} style={{ fontSize: 9, color: TH.accent }}>
                  Buscar
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Ambience Section ──────────────────────────────── */

function AmbienceSection({ items }: { items: AmbienceAsset[] }) {
  return (
    <div className="mb-2">
      <div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 4 }}>AMBIENCE</div>
      {items.map((a, i) => (
        <div key={i} className="flex items-center gap-2 rounded-[3px] px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${TH.border}` }}>
          <span className="text-xs" style={{ color: TH.text }}>{a.name}</span>
          {a.local && <span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60' }}>✓ Local</span>}
          <span className="font-mono text-xs" style={{ color: TH.muted }}>{a.match}%</span>
        </div>
      ))}
    </div>
  )
}

/* ── Sound Design Section ──────────────────────────── */

function SoundDesignSection({ items }: { items: SoundDesignAsset[] }) {
  return (
    <div>
      <div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 4 }}>SOUND DESIGN</div>
      {items.map((sd, i) => (
        <div key={i} className="flex items-center gap-2 rounded-[3px] px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${TH.border}` }}>
          <span className="font-mono text-[10px]" style={{ color: TH.accent }}>{sd.tc}</span>
          <span className="text-xs flex-1" style={{ color: TH.text }}>{sd.name}</span>
          <span className={MONO_XS_CLS} style={{ fontSize: 8, color: sd.status === 'pending' ? '#E67E22' : '#27AE60' }}>
            {sd.status === 'pending' ? '⚠ Pendente' : '✓ Pronto'}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Main Resolver ─────────────────────────────────── */

function AssetResolverRaw({ assets }: AssetResolverProps) {
  const [open, setOpen] = useState(false)

  if (!assets) return null

  const musicCount = (assets.music ?? []).length
  const sfxCount = (assets.sfx ?? []).length
  const visualCount = (assets.visual ?? []).length
  const pendingVisual = (assets.visual ?? []).filter(v => v.status === 'pending').length
  const pendingSfx = (assets.sfx ?? []).filter(s => !s.file).length
  const pendingMusic = (assets.music ?? []).filter(m => !m.local).length
  const totalPending = pendingVisual + pendingSfx + pendingMusic

  const summaryParts: string[] = []
  if (musicCount > 0) summaryParts.push(`${musicCount} mús`)
  if (sfxCount > 0) summaryParts.push(`${sfxCount} sfx`)
  if (visualCount > 0) summaryParts.push(`${visualCount} vis`)

  return (
    <div style={{ borderTop: `1px solid ${TH.border}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none text-left"
        style={{ background: TH.header }}
      >
        <span
          className="text-[10px] transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        >
          ▶
        </span>
        <span className={MONO_XS_CLS} style={{ color: TH.accent, fontSize: 9 }}>ASSETS</span>
        <span
          className={`${MONO_SM_CLS} shrink overflow-hidden text-ellipsis whitespace-nowrap`}
          style={{ color: TH.dim, fontSize: 9 }}
        >
          {summaryParts.join(' · ')}
        </span>
        <div className="flex-1" />
        {totalPending > 0 && (
          <span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E67E22', background: 'rgba(230,126,34,0.12)', padding: '1px 6px', borderRadius: 3 }}>
            {totalPending} pendente{totalPending > 1 ? 's' : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="p-3.5 pt-3" style={{ background: TH.bg }}>
          {musicCount > 0 && <MusicSection items={assets.music!} />}
          {sfxCount > 0 && <SfxSection items={assets.sfx!} />}
          {visualCount > 0 && <VisualSection items={assets.visual!} />}
          {(assets.ambience || assets.soundDesign) && (
            <div>
              {assets.ambience && assets.ambience.length > 0 && <AmbienceSection items={assets.ambience} />}
              {assets.soundDesign && assets.soundDesign.length > 0 && <SoundDesignSection items={assets.soundDesign} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const AssetResolver = memo(AssetResolverRaw)
AssetResolver.displayName = 'AssetResolver'
