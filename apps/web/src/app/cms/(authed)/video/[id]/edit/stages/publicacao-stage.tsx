'use client'

import type { ABDraft } from '@/lib/pipeline/video-schemas'
import type { AbCtaState } from '@/lib/pipeline/video-ab-precondition'

const AB_COLORS: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'var(--c-pipeline)', B: 'var(--c-links)', C: 'var(--warn)', D: 'var(--accent)',
}

export interface PublicacaoStageProps {
  draft: ABDraft
  cta: AbCtaState
  published: boolean
  /** ab-lab winner_variant_id; trophy shows on the winner ONLY (§3.8). */
  winnerVariantId: string | null
  onPatch: (patch: Partial<ABDraft>) => void
  onPublish: () => void
  onSuggest: () => void
}

export function PublicacaoStage({ draft, cta, published, winnerVariantId, onPatch, onPublish, onSuggest }: PublicacaoStageProps) {
  function setLeader(id: 'A' | 'B' | 'C' | 'D') { onPatch({ leader: id }) }
  function setTitle(idx: number, title: string) {
    const variants = draft.variants.map((v, i) => i === idx ? { ...v, title } : v)
    onPatch({ variants: variants as ABDraft['variants'] })
  }

  return (
    <div className="publicacao-stage" data-ro={published || undefined}>
      <div className="ab-grid">
        {draft.variants.map((v, idx) => {
          const isWinner = published && winnerVariantId === v.id
          return (
            <div key={v.id} className="ab-card" data-testid="ab-variant-card" style={{ '--ab': AB_COLORS[v.id] } as React.CSSProperties}>
              <div className="ab-thumb" aria-hidden />
              <span className="ab-badge">{v.id}</span>
              {v.tag === 'original' && <span className="ab-tag">original</span>}
              {isWinner && <span className="ab-trophy" data-testid="ab-trophy" aria-label="liderando">🏆</span>}
              {!published && (
                <button type="button" className="ab-leader" aria-pressed={draft.leader === v.id} onClick={() => setLeader(v.id)}>
                  Líder {v.id}
                </button>
              )}
              <div
                className="ab-title" data-testid="ab-title"
                contentEditable={!published} suppressContentEditableWarning
                onBlur={e => setTitle(idx, e.currentTarget.textContent ?? '')}
              >{v.title}</div>
              <div className="ab-brief" contentEditable={!published} suppressContentEditableWarning>{v.brief}</div>
            </div>
          )
        })}
      </div>

      {published ? (
        <p className="ab-locked-note">no ar — títulos travados</p>
      ) : (
        <button type="button" className="ab-suggest" onClick={onSuggest}>Sugerir títulos com Cowork</button>
      )}

      {!published && (
        <div className="ab-publish-row">
          <button type="button" className="ab-publish" disabled={!cta.enabled} title={cta.tooltip ?? undefined} onClick={onPublish}>
            Publicar + iniciar teste
          </button>
          {!cta.enabled && cta.deepLink && (
            <a className="ab-deeplink" href={cta.deepLink}>Abrir no A/B Lab</a>
          )}
        </div>
      )}
    </div>
  )
}
