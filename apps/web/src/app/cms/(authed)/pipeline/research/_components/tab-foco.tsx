'use client'

import { Fragment, useCallback, useMemo, useTransition } from 'react'
import {
  Target,
  Sparkles,
  Pencil,
  Plus,
  ArrowRight,
  FlaskConical,
  Gauge,
  Check,
  CheckCheck,
  Info,
  Layers,
  Pin,
  RefreshCw,
  X,
} from 'lucide-react'

import type {
  FocoWithRelations,
  ThemeId,
  FocoStateMeta,
  DecisionHorizon,
  FocoState,
  FocoAuthor,
  ResearchDecision,
  ResearchItemSummary,
} from '@/lib/pipeline/research-types'
import {
  HORIZON_META,
  FOCO_STATE_META,
} from '@/lib/pipeline/research-types'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { TemaDot, TemaTag, SearchPlus } from './atoms'
import { DecisionCard, type ResearchBacklink } from './tab-decisoes'
import { ResearchCard } from './tab-pesquisas'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TabFocoProps {
  focos: FocoWithRelations[]
  /** All decisions; the split filters these by horizon==='agora' && not archived. */
  decisions?: ResearchDecision[]
  /** All research items; the split filters these by pinned && not archived. */
  items?: ResearchItemSummary[]
  decisionSources?: Record<string, ResearchBacklink[]>
  onEditFoco: (id: string) => void
  onCreateFoco: () => void
  onActivateFoco: (id: string) => void
  onOpenItem?: (id: string) => void
  onEditDecision?: (id: string) => void
  /** Opens a decision fullscreen (DecisionDoc). Card body uses this; pencil still edits. */
  onOpenDecision?: (id: string) => void
  onSwitchTab?: (tab: string) => void
  onReset?: () => void
  showExplainer?: boolean
  onDismissExplainer?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function HorizonIcon({ id, size = 13 }: { id: DecisionHorizon; size?: number }) {
  switch (id) {
    case 'agora':
      return <Target size={size} />
    case 'proximo':
      return <ArrowRight size={size} />
    case 'explorar':
      return <FlaskConical size={size} />
  }
}

function ThemeDots({ themes }: { themes: ThemeId[] }) {
  if (themes.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {themes.map((t) => (
        <TemaDot key={t} id={t} size={8} />
      ))}
    </div>
  )
}

function ThemeTags({ themes }: { themes: ThemeId[] }) {
  if (themes.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {themes.map((t) => (
        <TemaTag key={t} id={t} />
      ))}
    </div>
  )
}

function AuthorBadge({ author, state }: { author: FocoAuthor; state: FocoState }) {
  if (state === 'proposto' || author === 'cowork') {
    return (
      <span className="auth cowork">
        <Sparkles size={12} /> Proposto pelo Cowork
      </span>
    )
  }
  return (
    <span className="auth you">
      <Pencil size={12} /> Definido por você
    </span>
  )
}

function StateLabel({ state }: { state: FocoState }) {
  const meta: FocoStateMeta = FOCO_STATE_META[state]
  return (
    <span
      className={`hz-state`}
      style={{ '--fc': meta.tone } as React.CSSProperties}
    >
      {state === 'ativo' ? (
        <i className="hz-live-dot" />
      ) : state === 'proposto' ? (
        <Sparkles size={11} />
      ) : (
        <Pencil size={11} />
      )}
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// FocusHero — Large card for the active foco
// ---------------------------------------------------------------------------

function FocusHero({
  foco,
  decisionsCount,
  onEdit,
  onOpenDoc,
}: {
  foco: FocoWithRelations
  decisionsCount?: number
  onEdit: (id: string) => void
  onOpenDoc?: (id: string) => void
}) {
  const themes = foco.themes
  const pinnedResearch = foco.pinned_research

  return (
    <div className="focus-hero">
      <div className="fh-bar" />
      <div className="fh-body">
        {/* Eyebrow */}
        <div className="fh-eyebrow">
          <Target size={14} aria-hidden="true" />
          <span>Foco · {HORIZON_META[foco.horizon]?.label ?? 'Agora'}</span>
          {foco.window_label && <span className="fh-window">{foco.window_label}</span>}
          <span className="fh-prov">
            <AuthorBadge author={foco.author} state={foco.state} />
          </span>
        </div>

        {/* Title */}
        <h2 className="fh-title">{foco.title}</h2>

        {/* Description / thesis */}
        {foco.description && <p className="fh-thesis">{foco.description}</p>}

        {/* Based on research */}
        {pinnedResearch && pinnedResearch.length > 0 && (
          <div className="fh-based">
            <span className="fh-based-lbl">Com base em</span>
            {pinnedResearch.map((r) => (
              <button
                key={r.item_id}
                className="based-chip"
                onClick={() => onOpenDoc?.(r.item_id)}
                type="button"
              >
                <SearchPlus size={11} />
                {r.title}
              </button>
            ))}
          </div>
        )}

        {/* Bottom row */}
        <div className="fh-bottom">
          {themes.length > 0 && (
            <div className="fh-temas">
              <ThemeTags themes={themes} />
            </div>
          )}

          {foco.metric && (
            <span className="fh-metric">
              <Gauge size={13} /> {foco.metric}
            </span>
          )}

          {decisionsCount != null && decisionsCount > 0 && (
            <span className="fh-metric">
              <Target size={13} />
              {decisionsCount} {decisionsCount === 1 ? 'decisão ligada' : 'decisões ligadas'}
            </span>
          )}

          <div className="grow" />

          <button
            className="btn sm"
            onClick={() => onEdit(foco.id)}
            type="button"
          >
            <Pencil size={14} /> Editar foco
          </button>
        </div>
      </div>

      {/* Decorative stamp */}
      <div className="fh-stamp" aria-hidden="true">
        <span>FOCO</span>
        <i />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FocusEmpty — Zero state when no active foco
// ---------------------------------------------------------------------------

const FZ_STEPS = [
  { icon: SearchPlus, color: 'var(--c-courses)', title: 'Pesquisas', sub: 'O Cowork investiga e escreve.' },
  { icon: CheckCheck, color: 'var(--c-pipeline)', title: 'Decisões', sub: 'Você decide o que importa.' },
  { icon: Target, color: 'var(--accent)', title: 'Foco', sub: 'A aposta do trimestre.', dest: true },
] as const

function FocusEmpty({
  onCreate,
  onSwitchTab,
}: {
  onCreate: () => void
  onSwitchTab?: (tab: string) => void
}) {
  return (
    <div className="fz">
      <span className="fz-bar" aria-hidden="true" />

      <div className="fz-main">
        <div className="fz-eyebrow">
          <Target size={14} />
          <span> Foco do trimestre </span>
          <span className="fz-tag">não definido</span>
        </div>

        <h2 className="fz-title">Escolha a aposta do trimestre</h2>

        <p className="fz-sub">
          O foco é a narrativa única em torno da qual roteiros, newsletter e thumbnails se organizam.{' '}
          <b>Você decide</b> — o Cowork só propõe.
        </p>

        <div className="fz-flow">
          {FZ_STEPS.map((step, i) => {
            const StepIcon = step.icon
            return (
              <Fragment key={step.title}>
                <div
                  className={`fz-step${('dest' in step && step.dest) ? ' dest' : ''}`}
                  style={{ '--sc': step.color } as React.CSSProperties}
                >
                  <span className="fz-step-ic">
                    <StepIcon size={16} />
                  </span>
                  <div className="fz-step-tx">
                    <span className="fz-step-t">{step.title}</span>
                    <span className="fz-step-s">{step.sub}</span>
                  </div>
                </div>
                {i < FZ_STEPS.length - 1 && (
                  <span className="fz-arrow" aria-hidden="true">
                    <ArrowRight size={14} />
                  </span>
                )}
              </Fragment>
            )
          })}
        </div>

        <div className="fz-actions">
          <button className="btn primary" onClick={onCreate} type="button">
            <Sparkles size={15} /> Pedir proposta ao Cowork
          </button>
          <button className="btn" onClick={onCreate} type="button">
            <Plus size={15} /> Definir manualmente
          </button>
        </div>

        <div className="fz-foot">
          <Info size={13} />
          <span> Sem pesquisas ainda. Comece na aba </span>
          <button className="fz-link" onClick={() => onSwitchTab?.('pesquisas')} type="button">
            Pesquisas
          </button>
          <span> — o Cowork investiga e escreve; depois viram decisões e foco.</span>
        </div>
      </div>

      <div className="fz-aura" aria-hidden="true">
        <i />
        <i />
        <i />
        <b />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FocusNoActive — compact banner when the board has bets but none is active
// ---------------------------------------------------------------------------

function FocusNoActive({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="fz-noactive">
      <span className="fzn-ic">
        <Target size={16} aria-hidden="true" />
      </span>
      <div className="fzn-tx">
        <b>Nenhum foco no ar.</b> Confirme uma aposta do board abaixo ou defina um novo foco.
      </div>
      <button className="btn sm primary" onClick={onCreate} type="button">
        <Plus size={14} /> Definir foco
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HorizonCard — Individual foco card in the board
// ---------------------------------------------------------------------------

function HorizonCard({
  foco,
  onEdit,
  onActivate,
}: {
  foco: FocoWithRelations
  onEdit: (id: string) => void
  onActivate: (id: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const themes = foco.themes
  const meta = FOCO_STATE_META[foco.state]

  const handleConfirm = useCallback(() => {
    startTransition(async () => {
      onActivate(foco.id)
    })
  }, [foco.id, onActivate, startTransition])

  return (
    <div
      className={`hz-card st-${foco.state}`}
      style={{ '--fc': meta.tone } as React.CSSProperties}
    >
      {/* Head: state badge + edit button */}
      <div className="hz-card-head">
        <StateLabel state={foco.state} />
        <button
          className="icon-btn bare hz-edit"
          title="Editar"
          onClick={() => onEdit(foco.id)}
          type="button"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Window label (mono) — every card shows one; fall back per state */}
      {(() => {
        const winLabel =
          foco.window_label ??
          (foco.state === 'proposto'
            ? 'a definir'
            : foco.state === 'rascunho'
              ? 'Aposta · sem data'
              : null)
        return winLabel ? <div className="hz-card-win mono">{winLabel}</div> : null
      })()}

      {/* Title */}
      <div className="hz-card-title">{foco.title}</div>

      {/* Description (4-line clamp via CSS) */}
      {foco.description && (
        <div className="hz-card-thesis">{foco.description}</div>
      )}

      {/* Footer: theme dots + confirm */}
      <div className="hz-card-foot">
        <div className="hz-card-temas">
          <ThemeDots themes={themes} />
        </div>
        {foco.state === 'proposto' && (
          <button
            className="btn sm primary hz-confirm"
            onClick={handleConfirm}
            disabled={pending}
            type="button"
          >
            <Check size={13} /> {pending ? 'Ativando...' : 'Confirmar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HorizonBoard — 3-column grid (Agora | Proximo | Explorar)
// ---------------------------------------------------------------------------

const HORIZONS: DecisionHorizon[] = ['agora', 'proximo', 'explorar']

function HorizonBoard({
  focos,
  onEdit,
  onActivate,
  onAdd,
}: {
  focos: FocoWithRelations[]
  onEdit: (id: string) => void
  onActivate: (id: string) => void
  onAdd: (horizon: DecisionHorizon) => void
}) {
  return (
    <div className="hz-board">
      {HORIZONS.map((hId) => {
        const meta = HORIZON_META[hId]
        const items = focos.filter((f) => f.horizon === hId)

        return (
          <div key={hId} className="hz-col">
            {/* Column header */}
            <div
              className="hz-col-head"
              style={{ '--hc': meta.color } as React.CSSProperties}
            >
              <span className="hz-dot">
                <HorizonIcon id={hId} size={13} />
              </span>
              <div>
                <div className="hz-name">{meta.label}</div>
                <div className="hz-sub">{meta.sub}</div>
              </div>
              <button
                className="hz-add"
                title="Nova aposta"
                onClick={() => onAdd(hId)}
                type="button"
              >
                <Plus size={15} />
              </button>
            </div>

            {/* Card list */}
            <div className="hz-col-body">
              {items.map((f) => (
                <HorizonCard
                  key={f.id}
                  foco={f}
                  onEdit={onEdit}
                  onActivate={onActivate}
                />
              ))}
              {items.length === 0 && (
                <button
                  className="hz-empty"
                  onClick={() => onAdd(hId)}
                  type="button"
                >
                  <Plus size={14} /> Adicionar aposta
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExplainerStrip — dismissible onboarding strip (Pesquisa→Decisão→Foco)
// ---------------------------------------------------------------------------

const EXPLAINER_STEPS = [
  {
    icon: SearchPlus,
    color: 'var(--c-courses)',
    title: 'Pesquisas',
    sub: 'O Cowork investiga e escreve. Você edita.',
  },
  {
    icon: CheckCheck,
    color: 'var(--c-pipeline)',
    title: 'Decisões',
    sub: 'Você transforma takeaways em decisões.',
  },
  {
    icon: Target,
    color: 'var(--accent)',
    title: 'Foco',
    sub: 'Uma decisão estratégica com prazo vira o foco do trimestre.',
  },
] as const

function ExplainerStrip({
  onClose,
  onPropose,
}: {
  onClose: () => void
  onPropose: () => void
}) {
  return (
    <div className="explainer" role="region" aria-label="Como o Foco funciona">
      <button className="explainer-x" onClick={onClose} title="Entendi" aria-label="Fechar explainer" type="button">
        <X size={15} />
      </button>

      <div className="explainer-head">
        <Info size={15} style={{ color: 'var(--accent-text)' }} />
        <span>
          Como o Foco funciona — <b>você decide, o Cowork propõe</b>
        </span>
      </div>

      <ol className="explainer-flow" aria-label="Fluxo em 3 passos">
        {EXPLAINER_STEPS.map((step, i) => {
          const StepIcon = step.icon
          return (
            <li key={step.title} style={{ display: 'contents' }}>
              <div className="ex-step" style={{ '--xc': step.color } as React.CSSProperties}>
                <span className="ex-ico">
                  <StepIcon size={15} />
                </span>
                <div>
                  <div className="ex-t">{step.title}</div>
                  <div className="ex-s">{step.sub}</div>
                </div>
              </div>
              {i < EXPLAINER_STEPS.length - 1 && (
                <ArrowRight size={15} className="ex-arrow" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>

      <div className="explainer-foot">
        <span className="dim fs12">
          Nada vira foco automaticamente — o Cowork só sugere; a confirmação é sempre sua.
        </span>
        <button className="btn sm" onClick={onPropose} type="button">
          <Sparkles size={14} /> Pedir proposta ao Cowork
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FocoSplit — decisions + pinned research columns
// ---------------------------------------------------------------------------

function FocoSplit({
  decisions,
  research,
  decisionSources,
  onOpenItem,
  onEditDecision,
  onOpenDecision,
  onSwitchTab,
}: {
  decisions: ResearchDecision[]
  research: ResearchItemSummary[]
  decisionSources?: Record<string, ResearchBacklink[]>
  onOpenItem?: (id: string) => void
  onEditDecision?: (id: string) => void
  onOpenDecision?: (id: string) => void
  onSwitchTab?: (tab: string) => void
}) {
  return (
    <div className="foco-split">
      {/* Left column — Decisions in effect */}
      <div>
        <div className="row between sec-head">
          <span className="section-label row gap-8">
            <Target size={13} aria-hidden="true" /> Decisões em vigor
          </span>
          <button
            className="card-link"
            onClick={() => onSwitchTab?.('decisoes')}
            type="button"
          >
            Todas <ArrowRight size={13} />
          </button>
        </div>
        <div className="col gap-10">
          {decisions.length > 0 ? (
            decisions.map((d) => (
              <DecisionCard
                key={d.id}
                decision={d}
                backlinks={decisionSources?.[d.id] ?? []}
                onEdit={(id) => onEditDecision?.(id)}
                onOpenItem={(id) => onOpenItem?.(id)}
                onOpen={(id) => onOpenDecision?.(id)}
              />
            ))
          ) : (
            <div className="card card-pad">
              <div className="empty">
                <div className="empty-ico">
                  <Target size={22} aria-hidden="true" />
                </div>
                <div className="empty-title">Nenhuma decisão para o foco atual</div>
                <div className="empty-sub">Transforme um takeaway de pesquisa em decisão.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right column — Pinned research */}
      <div>
        <div className="row between sec-head">
          <span className="section-label row gap-8">
            <Pin size={13} aria-hidden="true" /> Pesquisa que sustenta o foco
          </span>
          <button
            className="card-link"
            onClick={() => onSwitchTab?.('pesquisas')}
            type="button"
          >
            Biblioteca <ArrowRight size={13} />
          </button>
        </div>
        <div className="col gap-10">
          {research.length > 0 ? (
            research.map((it) => (
              <ResearchCard key={it.id} item={it} onOpen={(id) => onOpenItem?.(id)} />
            ))
          ) : (
            <div className="card card-pad">
              <div className="empty">
                <div className="empty-ico">
                  <SearchPlus size={22} aria-hidden="true" />
                </div>
                <div className="empty-title">Nada fixado no foco</div>
                <div className="empty-sub">Fixe pesquisas para mantê-las à mão.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TabFoco — main export
// ---------------------------------------------------------------------------

export function TabFoco({
  focos,
  decisions = [],
  items = [],
  decisionSources,
  onEditFoco,
  onCreateFoco,
  onActivateFoco,
  onOpenItem,
  onEditDecision,
  onOpenDecision,
  onSwitchTab,
  onReset,
  showExplainer: showExplainerProp,
  onDismissExplainer,
}: TabFocoProps) {
  // "Live" focus = state 'ativo'. Single source of truth: the board renders
  // its live styling from `state`, so the hero must key off the same signal
  // (avoids a foco rendering as live on the board while the banner says none).
  const activeFoco = useMemo(() => focos.find((f) => f.state === 'ativo'), [focos])
  const boardFocos = useMemo(() => focos.filter((f) => f.state !== 'arquivado'), [focos])

  // Decisions + research that sustain the active foco derive from GLOBAL state
  // (matches the prototype: focoDecisionCount + pinnedDocs), NOT the foco's own
  // join arrays. A decision belongs to the split when it is on the 'agora'
  // horizon and not archived; research when it is pinned and not archived.
  // Note the asymmetric spelling: decisions use 'arquivado', research 'arquivada'.
  const splitDecisions = useMemo(
    () =>
      decisions.filter((d) => d.horizon === 'agora' && d.status !== 'arquivado'),
    [decisions],
  )

  const splitResearch = useMemo(
    () => items.filter((it) => it.pinned && it.status !== 'arquivada'),
    [items],
  )

  // Count what's actually rendered, so the hero ("N decisões ligadas")
  // never disagrees with the cards shown in the split. Aligns with the
  // prototype's focoDecisionCount.
  const decisionsCount = splitDecisions.length

  const handleDismissExplainer = useCallback(() => {
    localStorage.setItem('tf-research-explainer-v1', 'dismissed')
    onDismissExplainer?.()
  }, [onDismissExplainer])

  return (
    <div className="fade-in">
      {/* Header: Cowork foco review deep-link */}
      <div className="row between sec-head" style={{ marginTop: 0 }}>
        <span className="section-label row gap-8">
          <Target size={13} aria-hidden="true" /> Foco do trimestre
        </span>
        <CoworkDeepLink
          instruction={buildCoworkInstruction('foco-review', {})}
          label="Abrir no Cowork"
          variant="button"
        />
      </div>

      {/* Onboarding explainer — only in the populated state. In the pure
          zero state the FocusEmpty card IS the invite, so nothing sits above it. */}
      {showExplainerProp && boardFocos.length > 0 && (
        <ExplainerStrip onClose={handleDismissExplainer} onPropose={onCreateFoco} />
      )}

      {/* Hero (active), compact banner (board has bets, none active),
          or the big invite card (pure zero state) */}
      {activeFoco ? (
        <FocusHero
          foco={activeFoco}
          decisionsCount={decisionsCount}
          onEdit={onEditFoco}
          onOpenDoc={onOpenItem}
        />
      ) : boardFocos.length > 0 ? (
        <FocusNoActive onCreate={onCreateFoco} />
      ) : (
        <FocusEmpty onCreate={onCreateFoco} onSwitchTab={onSwitchTab} />
      )}

      {/* Lower sections only render when there is board content to manage.
          A pure zero state (no focos) shows just the FocusEmpty card above. */}
      {boardFocos.length > 0 && (
        <>
          {/* Section header */}
          <div className="row between sec-head">
            <span className="section-label row gap-8">
              <Layers size={13} aria-hidden="true" /> Horizonte estratégico
            </span>
            {onReset && (
              <button className="reset-btn" onClick={onReset} type="button">
                <RefreshCw size={13} /> Recomeçar
              </button>
            )}
          </div>

          {/* Horizon board */}
          <HorizonBoard
            focos={boardFocos}
            onEdit={onEditFoco}
            onActivate={onActivateFoco}
            onAdd={(_horizon) => {
              onCreateFoco()
            }}
          />

          {/* Split: decisions + pinned research that sustain the active foco */}
          <FocoSplit
            decisions={splitDecisions}
            research={splitResearch}
            decisionSources={decisionSources}
            onOpenItem={onOpenItem}
            onEditDecision={onEditDecision}
            onOpenDecision={onOpenDecision}
            onSwitchTab={onSwitchTab}
          />
        </>
      )}
    </div>
  )
}
