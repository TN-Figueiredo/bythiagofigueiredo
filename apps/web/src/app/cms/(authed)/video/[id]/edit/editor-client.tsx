'use client'

import { Component, type ReactNode, type ErrorInfo, useCallback, useMemo, useState } from 'react'
import { AutosaveGate, useAutosaveGateRef } from './use-autosave'
import { Toaster } from 'sonner'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'
import type { SectionData } from '@/lib/pipeline/sections'
import type { PillarId } from '@/lib/pipeline/pillars'
import { PosBriefSchema, type PosBrief, type ABDraft } from '@/lib/pipeline/video-schemas'
import type { AbJoinFacts } from '@/lib/pipeline/video-ab-precondition'
import { VideoEditorProvider } from './context'
import { VideoDataProvider, type IdeiaPayload, type VideoData } from './data-context'
import { toEditorModel } from './editor-model'
import { EditorShell } from './editor-shell'
import { useVideoSection } from './use-video-section'
import { saveVideoTitle, advanceToRecorded as advanceToRecordedAction, publishVideo as publishVideoAction } from './actions'
import type { VideoEditorState } from './types'

class VideoEditorErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VideoEditor] crash:', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)' }}>Erro no editor</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</pre>
          <button className="btn sm" onClick={() => this.setState({ error: null })}>
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface InitialData {
  ideia: { pt: IdeiaPayload; en: IdeiaPayload }
  roteiro: { pt: RoteiroContentV3 | null; en: RoteiroContentV3 | null }
  pillar: PillarId | undefined
  durationRange: string | undefined
  /** Raw per-(section,lang) payload map (drives Pós/Publicação stage reads, §5.5). */
  sections: Record<string, unknown>
  /** A/B publish-CTA facts from the youtube_videos join (§3.8). */
  abJoinFacts: AbJoinFacts
  /** ab-lab winner_variant_id, when known (trophy on the winner once published). */
  winnerVariantId: string | null
}

/**
 * Hydrate a section hook from the stored `content_pipeline.sections[<key>]` envelope.
 * Stored values are full `{ rev, source, edited, content, ... }` envelopes (services/items.ts);
 * we preserve `rev` (optimistic section lock) and re-wrap into the `SectionData` the hook expects.
 * Returns `null` when the section was never written so the hook starts blank.
 */
function seedEnvelope(raw: unknown): SectionData | null {
  if (!raw || typeof raw !== 'object') return null
  const env = raw as Partial<SectionData>
  return {
    content: (env.content ?? null) as SectionData['content'],
    rev: typeof env.rev === 'number' ? env.rev : 0,
    source: env.source ?? 'user',
    edited: env.edited ?? false,
    cowork_rev: env.cowork_rev ?? null,
    updated_at: (env.updated_at ?? null) as unknown as string,
  }
}

/**
 * Like `seedEnvelope` but keeps the already-parsed/enriched `content` (ideia title
 * fallback, roteiro v3) while carrying the REAL section `rev` from the stored envelope.
 * Without the real rev the hook starts at `rev: 0`, so the first save after a reload
 * 409-conflicts against an already-persisted section (e.g. Recomeçar → clear was lost).
 */
function seedWithRev(content: unknown, raw: unknown): SectionData {
  const env = raw && typeof raw === 'object' ? (raw as Partial<SectionData>) : {}
  return {
    content: content as SectionData['content'],
    rev: typeof env.rev === 'number' ? env.rev : 0,
    source: env.source ?? 'user',
    edited: env.edited ?? false,
    cowork_rev: env.cowork_rev ?? null,
    updated_at: (env.updated_at ?? null) as unknown as string,
  }
}

export function VideoEditorClient({
  initialState,
  initial,
}: {
  initialState: VideoEditorState
  initial: InitialData
}) {
  const [ideia, setIdeia] = useState(initial.ideia)
  const [roteiro, setRoteiro] = useState(initial.roteiro)
  const [version, setVersion] = useState(initialState.version)

  // Autosave pause: mirrors `useCanEditContent()` (view-mode / published-lock) into a ref the
  // save callbacks below read at call time. <AutosaveGate> (inside the provider) keeps it live.
  // VIEW mode and the published lock therefore NEVER persist content. Recording-status sync is
  // separate (use-recording-sync) and stays unaffected.
  const canEditRef = useAutosaveGateRef()

  // Tolerate a partial `initial` (older callers / tests pre-P3 omit the section map).
  const initialSections = initial.sections ?? {}
  const abJoinFacts = initial.abJoinFacts ?? { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null }
  const winnerVariantId = initial.winnerVariantId ?? null

  const onSaveSuccess = useCallback((_rev: number, v: number) => setVersion(v), [])

  const ideiaPt = useVideoSection({ itemId: initialState.itemId, sectionBase: 'ideia', lang: 'pt', format: 'video', itemVersion: version, initialData: seedWithRev(initial.ideia.pt, initialSections.ideia_pt), onSaveSuccess })
  const ideiaEn = useVideoSection({ itemId: initialState.itemId, sectionBase: 'ideia', lang: 'en', format: 'video', itemVersion: version, initialData: seedWithRev(initial.ideia.en, initialSections.ideia_en), onSaveSuccess })
  const roteiroPt = useVideoSection({ itemId: initialState.itemId, sectionBase: 'roteiro', lang: 'pt', format: 'video', itemVersion: version, initialData: initial.roteiro.pt ? seedWithRev(initial.roteiro.pt, initialSections.roteiro_pt) : null, onSaveSuccess })
  const roteiroEn = useVideoSection({ itemId: initialState.itemId, sectionBase: 'roteiro', lang: 'en', format: 'video', itemVersion: version, initialData: initial.roteiro.en ? seedWithRev(initial.roteiro.en, initialSections.roteiro_en) : null, onSaveSuccess })
  const postprodPt = useVideoSection({ itemId: initialState.itemId, sectionBase: 'postprod', lang: 'pt', format: 'video', itemVersion: version, initialData: seedEnvelope(initialSections.postprod_pt), onSaveSuccess })
  const postprodEn = useVideoSection({ itemId: initialState.itemId, sectionBase: 'postprod', lang: 'en', format: 'video', itemVersion: version, initialData: seedEnvelope(initialSections.postprod_en), onSaveSuccess })
  const publishPt = useVideoSection({ itemId: initialState.itemId, sectionBase: 'publish', lang: 'pt', format: 'video', itemVersion: version, initialData: seedEnvelope(initialSections.publish_pt), onSaveSuccess })
  const publishEn = useVideoSection({ itemId: initialState.itemId, sectionBase: 'publish', lang: 'en', format: 'video', itemVersion: version, initialData: seedEnvelope(initialSections.publish_en), onSaveSuccess })

  const saveIdeia = useCallback(async (lang: 'pt' | 'en', patch: Partial<IdeiaPayload>) => {
    if (!canEditRef.current) return // view mode / published lock — never persist content
    setIdeia((prev) => ({ ...prev, [lang]: { ...prev[lang], ...patch } }))
    const hook = lang === 'pt' ? ideiaPt : ideiaEn
    hook.setContent({ ...(hook.content as unknown as IdeiaPayload), ...patch })
    await hook.save()
  }, [ideiaPt, ideiaEn, canEditRef])

  const saveTitle = useCallback(async (lang: 'pt' | 'en', title: string) => {
    if (!canEditRef.current) return // view mode / published lock — never persist content
    const res = await saveVideoTitle(initialState.itemId, lang, title, version)
    if (res.ok) setVersion(res.version)
    setIdeia((prev) => ({ ...prev, [lang]: { ...prev[lang], title } }))
  }, [initialState.itemId, version, canEditRef])

  const saveRoteiro = useCallback(async (lang: 'pt' | 'en', content: RoteiroContentV3, opts?: { force?: boolean }) => {
    // CREATE-from-empty path passes { force: true }: the seed is dispatched in the SAME tick as
    // SET_EDIT_MODE('edit'), but canEditRef only flips on the next render — without `force` the
    // explicit create would be dropped. Normal edits stay gated (view mode / published lock).
    if (!canEditRef.current && !opts?.force) return
    setRoteiro((prev) => ({ ...prev, [lang]: content }))
    const hook = lang === 'pt' ? roteiroPt : roteiroEn
    hook.setContent(content as unknown as SectionData['content'])
    await hook.save()
  }, [roteiroPt, roteiroEn, canEditRef])

  const appendSiblings = useCallback(() => {
    /* wired to Cowork generation in P3 */
  }, [])

  const savePostprod = useCallback(async (lang: 'pt' | 'en', patch: Partial<PosBrief>, opts?: { force?: boolean }) => {
    // CREATE-from-empty path passes { force: true } (see saveRoteiro). Normal patches stay gated.
    if (!canEditRef.current && !opts?.force) return
    const hook = lang === 'pt' ? postprodPt : postprodEn
    // Replace-not-merge guard: only shallow-merge onto an existing *valid current* brief.
    // If the stored content is legacy (has `schema_version`, lacks `kind`) or otherwise
    // fails the strict schema, spreading the patch over it would carry forbidden legacy
    // keys → strict parse fails on read-back → the legacy fallback sticks forever. So we
    // reset the base to a fresh `{ kind: 'brief' }` before applying the patch.
    const raw: unknown = hook.content ?? null
    const base: PosBrief | { kind: 'brief' } = PosBriefSchema.safeParse(raw).success
      ? (raw as PosBrief)
      : { kind: 'brief' }
    hook.setContent({ ...base, ...patch } as unknown as SectionData['content'])
    await hook.save()
  }, [postprodPt, postprodEn, canEditRef])

  const savePublish = useCallback(async (lang: 'pt' | 'en', patch: Partial<ABDraft>) => {
    if (!canEditRef.current) return // view mode / published lock — never persist content
    const hook = lang === 'pt' ? publishPt : publishEn
    const prev = (hook.content ?? {}) as unknown as ABDraft
    hook.setContent({ ...prev, ...patch } as unknown as SectionData['content'])
    await hook.save()
  }, [publishPt, publishEn, canEditRef])

  const advanceToRecorded = useCallback(async (id: string, v: number) => {
    const res = await advanceToRecordedAction(id, v)
    if (res.ok) {
      const next = (res.data as { version?: number } | undefined)?.version
      if (typeof next === 'number') setVersion(next)
    }
    return { ok: res.ok, error: res.ok ? undefined : res.error }
  }, [])

  const publishVideo = useCallback(async (id: string, v: number) => {
    const res = await publishVideoAction(id, v)
    return { ok: res.ok, error: res.ok ? undefined : res.error }
  }, [])

  const anyDirty = ideiaPt.isDirty || ideiaEn.isDirty || roteiroPt.isDirty || roteiroEn.isDirty || postprodPt.isDirty || postprodEn.isDirty || publishPt.isDirty || publishEn.isDirty
  const anySaving = ideiaPt.isSaving || ideiaEn.isSaving || roteiroPt.isSaving || roteiroEn.isSaving || postprodPt.isSaving || postprodEn.isSaving || publishPt.isSaving || publishEn.isSaving
  const saveAll = useCallback(async () => {
    if (!canEditRef.current) return // ⌘S / nav-guard flush — view mode / published lock never persists
    await Promise.all([
      ideiaPt.save(), ideiaEn.save(), roteiroPt.save(), roteiroEn.save(),
      postprodPt.save(), postprodEn.save(), publishPt.save(), publishEn.save(),
    ])
  }, [ideiaPt, ideiaEn, roteiroPt, roteiroEn, postprodPt, postprodEn, publishPt, publishEn, canEditRef])

  // Live section-content map (unwrapped) keyed by getSectionKey output — StageBody reads
  // postprod_<lang>/publish_<lang> off this and parses the content with the section schemas.
  const sectionsContent = useMemo<Record<string, unknown>>(() => ({
    postprod_pt: postprodPt.content ?? null,
    postprod_en: postprodEn.content ?? null,
    publish_pt: publishPt.content ?? null,
    publish_en: publishEn.content ?? null,
  }), [postprodPt.content, postprodEn.content, publishPt.content, publishEn.content])

  // Design-handoff editor model — derived from the live ideia/roteiro/metadata so
  // stage components read `cur = versions[lang]` (editor-model.ts).
  const versions = useMemo(
    () => toEditorModel({ ideia, roteiro, pillar: initial.pillar, durationRange: initial.durationRange }),
    [ideia, roteiro, initial.pillar, initial.durationRange],
  )

  const data: VideoData = useMemo(() => ({
    ideia,
    roteiro,
    versions,
    pillar: initial.pillar,
    durationRange: initial.durationRange,
    saveIdeia,
    saveTitle,
    saveRoteiro,
    appendSiblings,
    hasUnsavedChanges: anyDirty,
    saveAll,
    autosaveState: anySaving ? 'saving' : anyDirty ? 'unsaved' : 'saved',
    sections: sectionsContent,
    abJoinFacts: initial.abJoinFacts,
    winnerVariantId: initial.winnerVariantId,
    savePostprod,
    savePublish,
    advanceToRecorded,
    publishVideo,
  }), [
    ideia, roteiro, versions, initial.pillar, initial.durationRange, saveIdeia, saveTitle, saveRoteiro, appendSiblings,
    anyDirty, anySaving, saveAll, sectionsContent, initial.abJoinFacts, initial.winnerVariantId,
    savePostprod, savePublish, advanceToRecorded, publishVideo,
  ])

  return (
    <VideoEditorErrorBoundary>
      <VideoEditorProvider initialState={initialState} liveVersion={version} setLiveVersion={setVersion}>
        <AutosaveGate canEditRef={canEditRef} />
        <VideoDataProvider value={data}>
          <EditorShell />
          <Toaster
            theme="dark"
            position="bottom-center"
            duration={2800}
            toastOptions={{ style: { borderRadius: '999px', boxShadow: 'var(--shadow-pop)' } }}
          />
        </VideoDataProvider>
      </VideoEditorProvider>
    </VideoEditorErrorBoundary>
  )
}
