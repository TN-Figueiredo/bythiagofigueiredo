'use client'

import { Component, type ReactNode, type ErrorInfo, useCallback, useMemo, useState } from 'react'
import { Toaster } from 'sonner'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'
import type { SectionData } from '@/lib/pipeline/sections'
import type { PillarId } from '@/lib/pipeline/pillars'
import { VideoEditorProvider } from './context'
import { VideoDataProvider, type IdeiaPayload, type VideoData } from './data-context'
import { EditorShell } from './editor-shell'
import { useVideoSection } from './use-video-section'
import { saveVideoTitle } from './actions'
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
}

// `useVideoSection` reads scalar fields off `initialData` without re-validating the
// embedded `content`; the `.content` shape is the section payload (IdeiaPayload /
// RoteiroContentV3). We build a permissive envelope here.
function seed(content: unknown): SectionData {
  return {
    content: content as SectionData['content'],
    rev: 0,
    source: 'user',
    edited: false,
    cowork_rev: null,
    updated_at: null as unknown as string,
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

  const onSaveSuccess = useCallback((_rev: number, v: number) => setVersion(v), [])

  const ideiaPt = useVideoSection({ itemId: initialState.itemId, sectionBase: 'ideia', lang: 'pt', format: 'video', itemVersion: version, initialData: seed(initial.ideia.pt), onSaveSuccess })
  const ideiaEn = useVideoSection({ itemId: initialState.itemId, sectionBase: 'ideia', lang: 'en', format: 'video', itemVersion: version, initialData: seed(initial.ideia.en), onSaveSuccess })
  const roteiroPt = useVideoSection({ itemId: initialState.itemId, sectionBase: 'roteiro', lang: 'pt', format: 'video', itemVersion: version, initialData: initial.roteiro.pt ? seed(initial.roteiro.pt) : null, onSaveSuccess })
  const roteiroEn = useVideoSection({ itemId: initialState.itemId, sectionBase: 'roteiro', lang: 'en', format: 'video', itemVersion: version, initialData: initial.roteiro.en ? seed(initial.roteiro.en) : null, onSaveSuccess })

  const saveIdeia = useCallback(async (lang: 'pt' | 'en', patch: Partial<IdeiaPayload>) => {
    setIdeia((prev) => ({ ...prev, [lang]: { ...prev[lang], ...patch } }))
    const hook = lang === 'pt' ? ideiaPt : ideiaEn
    hook.setContent({ ...(hook.content as unknown as IdeiaPayload), ...patch })
    await hook.save()
  }, [ideiaPt, ideiaEn])

  const saveTitle = useCallback(async (lang: 'pt' | 'en', title: string) => {
    const res = await saveVideoTitle(initialState.itemId, lang, title, version)
    if (res.ok) setVersion(res.version)
    setIdeia((prev) => ({ ...prev, [lang]: { ...prev[lang], title } }))
  }, [initialState.itemId, version])

  const saveRoteiro = useCallback(async (lang: 'pt' | 'en', content: RoteiroContentV3) => {
    setRoteiro((prev) => ({ ...prev, [lang]: content }))
    const hook = lang === 'pt' ? roteiroPt : roteiroEn
    hook.setContent(content as unknown as SectionData['content'])
    await hook.save()
  }, [roteiroPt, roteiroEn])

  const appendSiblings = useCallback(() => {
    /* wired to Cowork generation in P3 */
  }, [])

  const anyDirty = ideiaPt.isDirty || ideiaEn.isDirty || roteiroPt.isDirty || roteiroEn.isDirty
  const anySaving = ideiaPt.isSaving || ideiaEn.isSaving || roteiroPt.isSaving || roteiroEn.isSaving
  const saveAll = useCallback(async () => {
    await Promise.all([ideiaPt.save(), ideiaEn.save(), roteiroPt.save(), roteiroEn.save()])
  }, [ideiaPt, ideiaEn, roteiroPt, roteiroEn])

  const data: VideoData = useMemo(() => ({
    ideia,
    roteiro,
    pillar: initial.pillar,
    durationRange: initial.durationRange,
    saveIdeia,
    saveTitle,
    saveRoteiro,
    appendSiblings,
    hasUnsavedChanges: anyDirty,
    saveAll,
    autosaveState: anySaving ? 'saving' : anyDirty ? 'unsaved' : 'saved',
  }), [ideia, roteiro, initial.pillar, initial.durationRange, saveIdeia, saveTitle, saveRoteiro, appendSiblings, anyDirty, anySaving, saveAll])

  return (
    <VideoEditorErrorBoundary>
      <VideoEditorProvider initialState={initialState}>
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
