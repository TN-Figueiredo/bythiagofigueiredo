'use client'

import { Check, Info, Calendar, Rss, Instagram, Facebook, Youtube, Cloud, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useEditorState, useEditorVersion, useEditorDispatch } from '../context'
import { saveDistributionPlan } from '../actions'
import { BlogCoworkButton } from '../blog-cowork-button'
import type { DistPlatformId, DistTiming } from '../types'

/* ------------------------------------------------------------------ */
/*  Platform + timing constants                                       */
/* ------------------------------------------------------------------ */

interface DistPlatform {
  id: DistPlatformId
  label: string
  fmt: string
  icon: LucideIcon
  color: string
}

export const DIST_PLATFORMS: DistPlatform[] = [
  { id: 'instagram', label: 'Instagram', fmt: 'modelo de card', icon: Instagram, color: '#d6336c' },
  { id: 'bluesky', label: 'Bluesky', fmt: 'compartilhar link', icon: Cloud, color: '#1185fe' },
  { id: 'facebook', label: 'Facebook', fmt: 'link + capa', icon: Facebook, color: '#1877f2' },
  { id: 'youtube', label: 'Comunidade YouTube', fmt: 'post + miniatura', icon: Youtube, color: '#ef4444' },
]

const DIST_WHEN: Array<{ id: DistTiming; label: string }> = [
  { id: 'with', label: 'Com o post' },
  { id: 'plus1', label: '+1 h' },
  { id: 'plus1d', label: '+1 dia' },
]

/* ------------------------------------------------------------------ */
/*  DistributionPlanner                                               */
/* ------------------------------------------------------------------ */

export function DistributionPlanner({ scheduledMode = false }: { scheduledMode?: boolean }) {
  const state = useEditorState()
  const version = useEditorVersion()
  const dispatch = useEditorDispatch()

  const plan = version?.distribution ?? {}
  const count = Object.keys(plan).length

  /** Espelha a lógica do reducer (timing null remove) e persiste fire-and-forget. */
  const persistPlan = (platform: DistPlatformId, timing: DistTiming | null) => {
    const nextPlan = { ...(version?.distribution ?? {}) }
    if (timing === null) delete nextPlan[platform]
    else nextPlan[platform] = timing
    if (state.postId) {
      void saveDistributionPlan(state.postId, nextPlan as Record<string, string>).then((res) => {
        if (!res.ok) toast.error('Não consegui salvar a distribuição')
      })
    }
  }

  const toggle = (id: DistPlatformId) => {
    dispatch({ type: 'SET_DIST', platform: id, timing: plan[id] ? null : 'with' })
    persistPlan(id, plan[id] ? null : 'with')
  }
  const setWhen = (id: DistPlatformId, w: DistTiming) => {
    dispatch({ type: 'SET_DIST', platform: id, timing: w })
    persistPlan(id, w)
  }

  return (
    <div className="dist-plan" data-testid="dist-plan">
      <div className="dist-head">
        <span className="flabel" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Rss size={13} className="lucide" /> Distribuição nas redes
        </span>
        <BlogCoworkButton stage="publicacao" label="Captions com Cowork" compact />
        <span className={`dist-count${count ? ' on' : ''}`} data-testid="dist-count">
          {count ? `${count} selecionada${count > 1 ? 's' : ''}` : 'nenhuma'}
        </span>
      </div>

      <div className="dist-grid">
        {DIST_PLATFORMS.map((p) => {
          const on = !!plan[p.id]
          const Ico = p.icon
          return (
            <div key={p.id} className={`dist-row${on ? ' on' : ''}`}>
              <button
                type="button"
                className="dist-toggle"
                data-testid={`dist-toggle-${p.id}`}
                aria-pressed={on}
                onClick={() => toggle(p.id)}
              >
                <span
                  className="dist-check"
                  style={on ? ({ '--pc': p.color } as React.CSSProperties) : undefined}
                >
                  {on && <Check size={12} />}
                </span>
                <span className="dist-ic" style={{ color: p.color }}>
                  <Ico size={15} />
                </span>
                <span className="dist-tx">
                  <b>{p.label}</b>
                  <span>{p.fmt}</span>
                </span>
              </button>
              {on && (
                <div className="dist-when" role="radiogroup" aria-label={`Quando publicar em ${p.label}`}>
                  {DIST_WHEN.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      role="radio"
                      aria-checked={plan[p.id] === w.id}
                      className={`dw-opt${plan[p.id] === w.id ? ' on' : ''}`}
                      onClick={() => setWhen(p.id, w.id)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {count === 0 ? (
        <div className="dist-remind" data-testid="dist-remind">
          <Info size={14} className="lucide" />
          <span>
            Nenhum canal selecionado. Um post sem distribuição costuma morrer no feed — escolha pelo
            menos um. O sistema agenda o link automaticamente.
          </span>
        </div>
      ) : (
        <div className="dist-summary" data-testid="dist-summary">
          <Calendar size={13} className="lucide" />
          {count} {count === 1 ? 'rede recebe o post' : 'redes recebem o post'}{' '}
          {scheduledMode ? 'junto com o agendamento' : 'ao publicar'} · ajuste fino no Painel Social
        </div>
      )}
    </div>
  )
}
