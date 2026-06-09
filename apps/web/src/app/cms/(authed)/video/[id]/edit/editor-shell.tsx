'use client'

import { lazy, Suspense, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { CheckCircle } from 'lucide-react'
import { getStagePosition } from '@/lib/pipeline/workflows'
import { isRecorded } from '@/lib/pipeline/video-lifecycle'
import { getSectionKey } from '@/lib/pipeline/sections'
import { PosBriefSchema, ABDraftSchema } from '@/lib/pipeline/video-schemas'
import { abPublishCtaState } from '@/lib/pipeline/video-ab-precondition'
import { CHANNELS, channelByLang } from '@/lib/pipeline/channels'
import { pillarById } from '@/lib/pipeline/pillars'
import { asMarkGran } from '@/lib/pipeline/video-recording'
import { useVideoEditorState, useVideoEditorDispatch } from './context'
import { VideoEdBar } from './ed-bar'
import { VidStages } from './vid-stages'
import { FocusExit } from './focus-exit'
import { useEdBarHeight } from './use-ed-bar-height'
import { NavigationGuard } from '@/app/cms/(authed)/_shared/editor/navigation-guard'
import { useVideoData } from './data-context'
import { LockedStage } from './stages/locked-stage'
import { PosStage } from './stages/pos-stage'
import { PublicacaoStage } from './stages/publicacao-stage'
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
          onSetMarkGran={(gran) => dispatch({ type: 'SET_MARK_GRAN', gran })}
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

export function EditorShell() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const published = getStagePosition('video', state.stage) >= getStagePosition('video', 'published')
  const overlayOpen = state.recordingOpen || state.handoffOpen || state.coworkOpen

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
      className={`fade-in vid-ed${published ? ' vid-ro' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', ['--ed-bar-h' as string]: edBarH }}
    >
      <div ref={topRef}>
        <VideoEdBar />
        {!state.focus && <VidStages />}
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
