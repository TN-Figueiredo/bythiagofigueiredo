'use client'

import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { editorReducer } from './reducer'
import { AUTO_SAVE_STATUSES } from './types'
import type { EditorState, EditorAction, VersionContent } from './types'
import { useAutosave } from '@/app/cms/(authed)/_shared/editor/use-autosave'
import type { SaveMode } from '@/app/cms/(authed)/_shared/editor/use-autosave'

/* ------------------------------------------------------------------ */
/*  Snapshot helpers                                                  */
/* ------------------------------------------------------------------ */

export function buildSnapshot(state: EditorState) {
  const version = state.content[state.activeLang]
  return {
    title: version?.title ?? '',
    slug: version?.slug ?? '',
    excerpt: version?.excerpt ?? '',
    contentJson: version?.body ?? null,
    contentHtml: version?.bodyHtml ?? '',
    coverImageUrl: version?.coverImageUrl ?? null,
    metaTitle: version?.metaTitle ?? '',
    metaDescription: version?.metaDesc ?? '',
    ogImageUrl: version?.ogImageUrl ?? null,
    selectedTagId: state.shared.tagId,
    category: state.shared.category || null,
    keyPoints: state.shared.keyPoints,
    pullQuote: state.shared.pullQuote,
    notes: state.shared.notes,
    colophon: state.shared.colophon,
    previousPostId: state.shared.previousPostId,
    continuesInNext: state.shared.continuesInNext,
    hashtags: state.shared.hashtags,
  }
}

export function buildSavePayload(snap: ReturnType<typeof buildSnapshot>): Record<string, unknown> {
  return {
    content_mdx: snap.contentHtml || '',
    title: snap.title,
    slug: snap.slug,
    excerpt: snap.excerpt || undefined,
    content_json: snap.contentJson,
    content_html: snap.contentHtml || null,
    meta_title: snap.metaTitle || undefined,
    meta_description: snap.metaDescription || undefined,
    og_image_url: snap.ogImageUrl || undefined,
    cover_image_url: snap.coverImageUrl || undefined,
    tag_id: snap.selectedTagId ?? undefined,
    category: snap.category,
    key_points: snap.keyPoints.filter(Boolean),
    pull_quote: snap.pullQuote || null,
    notes: snap.notes.filter(Boolean),
    colophon: snap.colophon || null,
    previous_post_id: snap.previousPostId,
    continues_in_next: snap.continuesInNext,
    hashtag_ids: snap.hashtags.map(h => h.id),
  }
}

/* ------------------------------------------------------------------ */
/*  Contexts                                                          */
/* ------------------------------------------------------------------ */

const EditorStateContext = createContext<EditorState | null>(null)
const EditorDispatchContext = createContext<
  ((action: EditorAction) => void) | null
>(null)

interface AutosaveContextValue {
  state: string
  hasUnsavedChanges: boolean
}

const AutosaveContext = createContext<AutosaveContextValue | null>(null)

interface SaveActionsContextValue {
  saveNow: () => Promise<{ ok: boolean }> | void
}

const SaveActionsContext = createContext<SaveActionsContextValue | null>(null)

interface EphemeralContextValue {
  isEphemeral: boolean
  ensurePostCreated: () => Promise<string | null>
}

const EphemeralContext = createContext<EphemeralContextValue | null>(null)

/* ------------------------------------------------------------------ */
/*  No-op save function (default)                                     */
/* ------------------------------------------------------------------ */

const noopSaveFn = async () => ({ ok: true as const })

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

interface EditorProviderProps {
  initialState: EditorState
  saveFn?: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  /** Raw server action for saving — provider wraps it with current postId/locale */
  saveAction?: (
    id: string,
    locale: string,
    input: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>
  createPostAction?: (input: {
    title: string
    locale: string
    status: string
  }) => Promise<{ ok: true; postId: string } | { ok: false; error: string }>
  children: ReactNode
}

export function EditorProvider({ initialState, saveFn, saveAction, createPostAction, children }: EditorProviderProps) {
  const [state, dispatch] = useReducer(editorReducer, initialState)

  // Stable dispatch — never changes reference identity across re-renders
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  // fieldsRef always holds the latest snapshot
  const currentSnapshot = useMemo(() => buildSnapshot(state), [state])
  const fieldsRef = useRef(currentSnapshot)
  fieldsRef.current = currentSnapshot

  const getPayload = useCallback(() => buildSavePayload(fieldsRef.current), [])

  const isEphemeral = state.postId === null

  // Refs for values used in derived saveFn and dispatchAndSave
  const saveActionRef = useRef(saveAction)
  saveActionRef.current = saveAction
  const activeLangRef = useRef(state.activeLang)
  activeLangRef.current = state.activeLang
  const postIdRef = useRef(state.postId)
  postIdRef.current = state.postId

  // Derive saveFn from saveAction if saveFn is not explicitly provided
  const derivedSaveFn = useCallback(async (data: Record<string, unknown>) => {
    const action = saveActionRef.current
    const pid = postIdRef.current
    if (!action || !pid) return { ok: false, error: 'no_save_action' }
    const locale = activeLangRef.current === 'pt' ? 'pt-BR' : 'en'
    return action(pid, locale, data)
  }, [])

  const effectiveSaveFn = saveFn ?? (saveAction ? derivedSaveFn : noopSaveFn)

  const saveMode: SaveMode = AUTO_SAVE_STATUSES.has(state.shared.status)
    ? 'auto'
    : state.shared.status === 'published'
      ? 'guarded'
      : 'manual'

  const autosave = useAutosave({
    editionId: state.postId,
    saveFn: effectiveSaveFn,
    enabled: state.postId !== null,
    mode: saveMode,
    getPayload,
    debounceMs: 3000,
  })

  const saveActions = useMemo(() => ({
    saveNow: () => {
      const payload = buildSavePayload(fieldsRef.current)
      // An explicit Save (button / Ctrl+S) IS the confirmation — bypass the
      // guarded-mode prompt so published-post saves never silently dead-end.
      // Returns the promise so callers (e.g. "Salvar e sair") can await it.
      return autosave.forceSave(payload)
    },
  }), [autosave.forceSave])

  const prevSaveStateRef = useRef(autosave.state)
  useEffect(() => {
    const prev = prevSaveStateRef.current
    prevSaveStateRef.current = autosave.state
    if (prev !== 'saved' && autosave.state === 'saved') {
      toast.info('Rascunho salvo')
    }
    if (prev !== 'error' && autosave.state === 'error') {
      toast.error('Erro ao salvar — tente novamente')
    }
  }, [autosave.state])

  // Keep refs for values used by dispatchAndSave so its identity stays stable
  const scheduleSaveRef = useRef(autosave.scheduleSave)
  scheduleSaveRef.current = autosave.scheduleSave

  const stateRef = useRef(state)
  stateRef.current = state

  const dispatchAndSave = useCallback((action: EditorAction) => {
    dispatchRef.current(action)
    if (postIdRef.current) {
      const nextState = editorReducer(stateRef.current, action)
      scheduleSaveRef.current(buildSavePayload(buildSnapshot(nextState)))
    }
  }, [])

  /* ---- Ephemeral post creation ---- */

  const creationPromiseRef = useRef<Promise<string | null> | null>(null)
  const createPostActionRef = useRef(createPostAction)
  createPostActionRef.current = createPostAction

  const ensurePostCreated = useCallback(async (): Promise<string | null> => {
    const current = stateRef.current
    if (current.postId) return current.postId
    if (creationPromiseRef.current) return creationPromiseRef.current

    const actionFn = createPostActionRef.current
    if (!actionFn) return null

    const version = current.content[current.activeLang]
    if (!version?.title?.trim()) return null

    const promise = actionFn({
      title: version.title,
      locale: current.activeLang === 'pt' ? 'pt-BR' : 'en',
      status: 'draft',
    }).then(result => {
      if (result.ok) {
        dispatchRef.current({ type: 'SET_POST_ID', postId: result.postId })
        return result.postId
      }
      return null
    }).finally(() => {
      creationPromiseRef.current = null
    })

    creationPromiseRef.current = promise
    return promise
  }, [])

  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={dispatchAndSave}>
        <AutosaveContext.Provider value={{ state: autosave.state, hasUnsavedChanges: autosave.hasUnsavedChanges }}>
          <SaveActionsContext.Provider value={saveActions}>
            <EphemeralContext.Provider value={{ isEphemeral, ensurePostCreated }}>
              {children}
            </EphemeralContext.Provider>
          </SaveActionsContext.Provider>
        </AutosaveContext.Provider>
      </EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/*  Consumer hooks                                                    */
/* ------------------------------------------------------------------ */

export function useEditorState(): EditorState {
  const state = useContext(EditorStateContext)
  if (state === null) {
    throw new Error('useEditorState must be used within an EditorProvider')
  }
  return state
}

export function useEditorDispatch(): (action: EditorAction) => void {
  const dispatch = useContext(EditorDispatchContext)
  if (dispatch === null) {
    throw new Error('useEditorDispatch must be used within an EditorProvider')
  }
  return dispatch
}

export function useEditorVersion(): VersionContent | null {
  const state = useEditorState()
  return state.content[state.activeLang] ?? null
}

export function useAutosaveState(): AutosaveContextValue {
  const ctx = useContext(AutosaveContext)
  if (!ctx) {
    throw new Error('useAutosaveState must be used within an EditorProvider')
  }
  return ctx
}

export function useSaveActions(): SaveActionsContextValue {
  const ctx = useContext(SaveActionsContext)
  if (!ctx) {
    throw new Error('useSaveActions must be used within an EditorProvider')
  }
  return ctx
}

export function useEphemeral(): EphemeralContextValue {
  const ctx = useContext(EphemeralContext)
  if (!ctx) {
    throw new Error('useEphemeral must be used within an EditorProvider')
  }
  return ctx
}
