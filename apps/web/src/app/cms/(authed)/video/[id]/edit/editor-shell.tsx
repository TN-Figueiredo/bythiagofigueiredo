'use client'

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { CheckCircle, Eye, Pencil, Lock } from 'lucide-react'
import { getStagePosition } from '@/lib/pipeline/workflows'
import { isRecorded } from '@/lib/pipeline/video-lifecycle'
import { getSectionKey } from '@/lib/pipeline/sections'
import { PosBriefSchema, ABDraftSchema } from '@/lib/pipeline/video-schemas'
import { abPublishCtaState } from '@/lib/pipeline/video-ab-precondition'
import { CHANNELS, channelByLang } from '@/lib/pipeline/channels'
import { pillarById } from '@/lib/pipeline/pillars'
import { asMarkGran } from '@/lib/pipeline/video-recording'
import { useVideoEditorState, useVideoEditorDispatch, useEditMode, useSetLiveVersion } from './context'
import { retreatPipelineItem } from '@/app/cms/(authed)/pipeline/actions'
import { useRecordingSync } from './use-recording-sync'
import { VideoEdBar } from './ed-bar'
import { VidStages } from './vid-stages'
import { FocusExit } from './focus-exit'
import { useEdBarHeight } from './use-ed-bar-height'
import { NavigationGuard } from '@/app/cms/(authed)/_shared/editor/navigation-guard'
import { useVideoData } from './data-context'
import { LockedStage } from './stages/locked-stage'
import { PosStage } from './stages/pos-stage'
import { PublicacaoStage } from './stages/publicacao-stage'
import { isContentLockedStage } from './types'
import type { ABDraft } from '@/lib/pipeline/video-schemas'
import type { VideoLang } from './types'

/** Single global localStorage key for the print/recording marking granularity. */
const MARK_GRAN_LS_KEY = 'video-mark-gran'

/** SSR-safe + jsdom/happy-dom-safe localStorage read (returns null on any failure). */
function readLocal(key: string): string | null {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** SSR-safe + jsdom/happy-dom-safe localStorage write (no-op on any failure). */
function writeLocal(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage?.setItem !== 'function') return
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode / quota / stub — preference just doesn't persist */
  }
}

const IdeiaStage = lazy(() => import('./stages/ideia-stage').then((m) => ({ default: m.IdeiaStage })))
const RoteiroStage = lazy(() => import('./stages/roteiro-stage').then((m) => ({ default: m.RoteiroStage })))

// §13: code-split the print overlays (createPortal + window deps → client-only).
const RecordingSheet = dynamic(
  () => import('./_overlays/recording-sheet').then((m) => m.RecordingSheet),
  { ssr: false },
)
const HandoffSheet = dynamic(
  () => import('./_overlays/handoff-sheet').then((m) => m.HandoffSheet),
  { ssr: false },
)

/** PT/EN segmented options for the overlays (control hidden when ≤1). */
const OVERLAY_LANG_OPTIONS = CHANNELS.map((c) => ({ lang: c.lang, label: c.label, flag: c.flag }))

/** Unstarted Publicação: one original (A) + three blank challengers → valid 4-up (§3.8). */
const EMPTY_AB_DRAFT: ABDraft = {
  leader: 'A',
  variants: [
    { id: 'A', tag: 'original', title: '', brief: '' },
    { id: 'B', title: '', brief: '' },
    { id: 'C', title: '', brief: '' },
    { id: 'D', title: '', brief: '' },
  ],
}

function StageBody() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()
  const lang = state.activeLang
  const recorded = isRecorded(state.stage)
  const published = getStagePosition('video', state.stage) >= getStagePosition('video', 'published')

  // Pós reads its momentos/b-roll off the live roteiro beats (not stored); the brief
  // is the lightweight postprod_<lang> payload. A legacy rich payload (schema_version
  // present / no `kind`) falls through to PosStage's read-only fallback.
  const sections = data.sections ?? {}
  const beats = data.roteiro[lang]?.beats ?? []
  const posRaw = sections[getSectionKey('postprod', lang, 'video')]
  const posBrief = PosBriefSchema.safeParse(posRaw)
  const posLegacy = posBrief.success ? null : ((posRaw ?? null) as Record<string, unknown> | null)

  // Publicação reads the publish_<lang> A/B draft; unstarted → EMPTY_AB_DRAFT 4-up.
  const abRaw = sections[getSectionKey('publish', lang, 'video')]
  const abParsed = ABDraftSchema.safeParse(abRaw)
  const cta = abPublishCtaState(
    data.abJoinFacts ?? { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null },
    state.itemId,
  )

  // `cur` is the design-handoff Version for the active lang (editor-model.ts). Stage
  // bodies are verbatim ports that read `cur` + the existing save/nav callbacks; the
  // current IdeiaStage/RoteiroStage read these off context, so `cur`/`lang` are passed
  // as the forward-compatible contract the stage-rebuild agent migrates to.
  const cur = data.versions[lang]

  // Present language labels for the Pós "Versões" field — only langs that carry content
  // (the model always holds both pt/en objects, so test for actual content).
  const posLangLabels =
    CHANNELS.filter((c) => {
      const v = data.versions[c.lang]
      return !!v && (!!v.title?.trim() || !!v.direction?.trim() || (v.beats?.length ?? 0) > 0)
    })
      .map((c) => c.label)
      .join(' + ') || (channelByLang(lang)?.label ?? '')

  return (
    <Suspense fallback={<div className="stage-skel" aria-hidden="true" />}>
      <div key={`${state.activeStage}-${state.activeLang}`} className="stage-fade">
        {state.activeStage === 'ideia' && <IdeiaStage cur={cur} lang={lang} />}
        {state.activeStage === 'roteiro' && <RoteiroStage cur={cur} lang={lang} />}
        {state.activeStage === 'pos' && (
          recorded ? (
            <PosStage
              cur={cur}
              beats={beats}
              brief={posBrief.success ? posBrief.data : null}
              activeLang={lang}
              onPatch={(p) => { void data.savePostprod(lang, p) }}
              onOpenHandoff={() => dispatch({ type: 'OPEN_OVERLAY', overlay: 'handoff' })}
              legacy={posLegacy}
              langLabels={posLangLabels}
            />
          ) : (
            <LockedStage stageLabel="Pós" itemId={state.itemId} version={state.version} onUnlock={data.advanceToRecorded} />
          )
        )}
        {state.activeStage === 'publicacao' && (
          recorded ? (
            <PublicacaoStage
              cur={cur}
              draft={abParsed.success ? abParsed.data : EMPTY_AB_DRAFT}
              cta={cta}
              published={published}
              winnerVariantId={data.winnerVariantId ?? null}
              onPatch={(p) => { void data.savePublish(lang, p) }}
              onPublish={() => { void data.publishVideo(state.itemId, state.version) }}
              onSuggest={() => dispatch({ type: 'OPEN_OVERLAY', overlay: 'cowork' })}
            />
          ) : (
            <LockedStage stageLabel="Publicação" itemId={state.itemId} version={state.version} onUnlock={data.advanceToRecorded} />
          )
        )}
      </div>
    </Suspense>
  )
}

/**
 * Mounts the two print overlays (Modo Gravação / Brief pro editor) when their
 * reducer flag is open, fed from the live editor detail. Both are code-split via
 * `dynamic(ssr:false)` and dispatch `CLOSE_OVERLAY` on exit.
 */
function VideoOverlays() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()
  const lang = state.activeLang
  const channel = channelByLang(lang) ?? CHANNELS[0]! // CHANNELS always has pt+en
  const pillarLabel = pillarById(data.pillar)?.label ?? '—'
  const title = data.ideia[lang]?.title ?? ''
  const beats = data.roteiro[lang]?.beats ?? []
  const switchLang = (l: string) => dispatch({ type: 'SET_LANG', lang: l as VideoLang })

  // Handoff brief is the postprod_<lang> payload (schema-parsed); unstarted → blanks.
  const sections = data.sections ?? {}
  const briefParsed = PosBriefSchema.safeParse(sections[getSectionKey('postprod', lang, 'video')])
  const brief = briefParsed.success ? briefParsed.data : null
  const versionsLabel = OVERLAY_LANG_OPTIONS.map((o) => o.label).join(' + ')

  return (
    <>
      {state.recordingOpen && (
        <RecordingSheet
          code={state.code}
          channelName={channel.name}
          channelLabel={channel.label}
          channelFlag={channel.flag}
          pillarLabel={pillarLabel}
          durationRange={data.durationRange ?? ''}
          title={title}
          beats={beats}
          langOptions={OVERLAY_LANG_OPTIONS}
          onSwitchLang={switchLang}
          markGran={state.markGran}
          recordedHash={state.recRecordedHash ?? {}}
          onSetMarkGran={(gran) => dispatch({ type: 'SET_MARK_GRAN', gran })}
          onSetBeatStatus={(key, status) => dispatch({ type: 'SET_BEAT_STATUS', key, status })}
          onClose={() => dispatch({ type: 'CLOSE_OVERLAY', overlay: 'recording' })}
        />
      )}
      {state.handoffOpen && (
        <HandoffSheet
          code={state.code}
          channelLabel={channel.label}
          channelName={channel.name}
          activeLang={lang}
          versionsLabel={versionsLabel}
          title={title}
          deliverables={brief?.deliverables ?? {}}
          style={brief?.style ?? []}
          ctas={brief?.ctas ?? { note: '', rows: [], display: '' }}
          beats={beats}
          langOptions={OVERLAY_LANG_OPTIONS}
          onSwitchLang={switchLang}
          onClose={() => dispatch({ type: 'CLOSE_OVERLAY', overlay: 'handoff' })}
        />
      )}
    </>
  )
}

/**
 * View/Edit safety toggle. Default = 👁 Visualizando (content read-only); ✏️ Editar enters
 * edit mode. When the DB stage is content-locked (scheduled/published) the toggle is replaced
 * by a 🔒 affordance that, on confirm, RETREATS the stage (despublica) via the generic
 * `retreatPipelineItem` action — the only existing stage-retreat mechanism — then auto-enters
 * edit mode. Recording-status marking is never gated, so it stays usable in either mode.
 */
function EditModeToggle() {
  const { mode, locked, setMode } = useEditMode()
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const setLiveVersion = useSetLiveVersion()
  const [busy, setBusy] = useState(false)

  if (locked) {
    const onUnpublish = async () => {
      if (busy) return
      if (typeof window !== 'undefined' && !window.confirm('Despublicar pra editar? O vídeo sai do ar até você publicar de novo.')) return
      setBusy(true)
      try {
        const res = await retreatPipelineItem(state.itemId, state.version)
        if (!res.ok) {
          toast.error(res.error === 'Version conflict' ? 'Versão desatualizada — recarregue a página.' : 'Não foi possível despublicar.')
          return
        }
        const updated = res.data as { stage?: string; version?: number } | undefined
        if (updated?.stage) dispatch({ type: 'SET_DB_STAGE', stage: updated.stage })
        if (typeof updated?.version === 'number') {
          dispatch({ type: 'SET_VERSION', version: updated.version })
          setLiveVersion(updated.version)
        }
        // published→scheduled retreats ONE step but scheduled is still content-locked: don't flip
        // the UI to "editing" while editing is still hard-blocked. Only enter edit mode when the
        // new stage actually unlocks content; otherwise keep view mode and tell the user.
        if (updated?.stage && isContentLockedStage(updated.stage)) {
          toast('Ainda travado — despublique mais uma etapa pra editar.')
        } else {
          setMode('edit') // despublicar é uma ação deliberada de edição → já entra em modo edição
          toast.success('Despublicado — agora você pode editar.')
        }
      } finally {
        setBusy(false)
      }
    }
    return (
      <button
        type="button"
        className="ed-editlock"
        title="Publicado — conteúdo travado. Despublique para editar."
        aria-label={busy ? 'Despublicando para poder editar' : 'Conteúdo publicado e travado — despublicar para editar'}
        aria-busy={busy}
        onClick={onUnpublish}
        disabled={busy}
      >
        <Lock size={14} /> {busy ? 'Despublicando…' : '🔒 Publicado — despublicar pra editar'}
      </button>
    )
  }

  const editing = mode === 'edit'
  return (
    <button
      type="button"
      className={`ed-editmode${editing ? ' on' : ''}`}
      aria-pressed={editing}
      title={editing ? 'Editando — clique para voltar a visualizar' : 'Visualizando (somente leitura) — clique para editar'}
      onClick={() => setMode(editing ? 'view' : 'edit')}
    >
      {editing ? <><Pencil size={14} /> Editar</> : <><Eye size={14} /> Visualizando</>}
    </button>
  )
}

export function EditorShell() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const { canEdit, locked } = useEditMode()
  const published = getStagePosition('video', state.stage) >= getStagePosition('video', 'published')
  const overlayOpen = state.recordingOpen || state.handoffOpen || state.coworkOpen

  // Durable recording-status: beat-id persistence + local-first write + hydrate + sync,
  // all session-authed (the user's RLS), driving the per-beat ledger end-to-end.
  useRecordingSync()

  // Precedence level 3: Esc exits focus only when no overlay/cowork popover owns the key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && state.focus && !overlayOpen) {
        dispatch({ type: 'TOGGLE_FOCUS' })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state.focus, overlayOpen, dispatch])

  // Marking-granularity preference: hydrate once from localStorage (SSR-safe — read in
  // an effect, never in the reducer initializer), then persist on every change. The
  // `hydrated` guard stops the first persist effect from clobbering storage with the
  // default 'off' before hydration runs. Mirrors use-autosave's `typeof window` guard.
  const markGranHydrated = useRef(false)
  useEffect(() => {
    const stored = asMarkGran(readLocal(MARK_GRAN_LS_KEY))
    if (stored !== state.markGran) dispatch({ type: 'SET_MARK_GRAN', gran: stored })
    markGranHydrated.current = true
    // hydrate once on mount — intentionally not reactive to state.markGran
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])
  useEffect(() => {
    if (!markGranHydrated.current) return
    writeLocal(MARK_GRAN_LS_KEY, state.markGran)
  }, [state.markGran])

  const topRef = useRef<HTMLDivElement>(null)
  const edBarH = useEdBarHeight(topRef)

  const data = useVideoData()

  // ⌘S / Ctrl+S force-flush autosave (no-op if clean — useAutosave handles that).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void data.saveAll()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [data])

  return (
    <div
      className={`fade-in vid-ed${published ? ' vid-ro' : ''}${canEdit ? ' vid-editing' : ' vid-viewing'}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', ['--ed-bar-h' as string]: edBarH }}
    >
      <div ref={topRef}>
        <VideoEdBar />
        {!state.focus && (
          <div className="vid-modebar">
            <EditModeToggle />
            {canEdit && (
              <span className="vid-editbadge" aria-hidden="true"><Pencil size={12} /> Editando</span>
            )}
            {!canEdit && (
              <span className="vid-mode-hint">
                {locked
                  ? 'Conteúdo travado (publicado) — marcação de gravação continua disponível.'
                  : 'Somente leitura — clique em Editar para alterar o conteúdo — marcação de gravação continua disponível.'}
              </span>
            )}
          </div>
        )}
        {!state.focus && <VidStages />}
        {!canEdit && !locked && !state.focus && (
          <div className="vid-viewbanner" role="note">
            <Eye size={14} />
            <span>Modo visualização — toque em <b>Editar</b> pra alterar. Marcação de gravação continua disponível.</span>
          </div>
        )}
        {published && !state.focus && (
          <div className="vid-robanner">
            <CheckCircle size={15} /> <span><b>Publicado · no ar.</b> Edições limitadas — para mudar algo, peça ao <b>Cowork</b> ou despublique.</span>
          </div>
        )}
      </div>
      <div role="main" style={{ flex: 1, minHeight: 0 }}>
        <StageBody />
      </div>
      <FocusExit />
      <VideoOverlays />
      <div
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {data.autosaveState === 'saving' ? 'Salvando…'
          : data.autosaveState === 'saved' ? 'Rascunho salvo'
          : data.autosaveState === 'error' ? 'Erro ao salvar'
          : data.autosaveState === 'offline' ? 'Sem conexão — salvo localmente'
          : ''}
      </div>
      <NavigationGuard hasUnsavedChanges={data.hasUnsavedChanges} onSave={async () => { await data.saveAll() }} />
    </div>
  )
}
