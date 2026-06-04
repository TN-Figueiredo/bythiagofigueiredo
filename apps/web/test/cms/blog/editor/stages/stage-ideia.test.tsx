import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/editor/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockState: EditorState
let mockVersion: VersionContent

vi.mock('@/app/cms/(authed)/blog/[id]/editor/context', () => ({
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
  useEditorVersion: () => mockVersion,
}))

/* ------------------------------------------------------------------ */
/*  Import after mock                                                 */
/* ------------------------------------------------------------------ */

import { StageIdeia } from '@/app/cms/(authed)/blog/[id]/editor/stages/stage-ideia'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    activeStage: 'ideia',
    activeLang: 'pt',
    focus: false,
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
    shared: {
      status: 'draft',
      category: 'Tecnologia',
      tagId: null,
      tags: [],
      hashtags: [],
      hook: 'Um gancho poderoso',
      synopsis: 'Uma sinopse detalhada do post',
      plevel: null,
      previousPostId: null,
      continuesInNext: false,
      keyPoints: [],
      pullQuote: '',
      notes: [],
      colophon: '',
      history: [],
    },
    saveStatus: 'idle',
    ...overrides,
  }
}

function makeVersion(overrides: Partial<VersionContent> = {}): VersionContent {
  return {
    ...EMPTY_VERSION,
    fresh: false,
    title: 'Meu Post de Teste',
    words: 1500,
    readTime: 7,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('StageIdeia', () => {
  beforeEach(() => {
    mockState = makeState()
    mockVersion = makeVersion()
    mockDispatch.mockClear()
  })

  it('renders hook text from state', () => {
    const { getByText } = render(<StageIdeia />)
    expect(getByText('Um gancho poderoso')).toBeTruthy()
  })

  it('renders synopsis text from state', () => {
    const { getByText } = render(<StageIdeia />)
    expect(getByText('Uma sinopse detalhada do post')).toBeTruthy()
  })

  it('title input dispatches SET_TITLE on change', () => {
    const { getByDisplayValue } = render(<StageIdeia />)
    const input = getByDisplayValue('Meu Post de Teste')
    fireEvent.change(input, { target: { value: 'Novo Titulo' } })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TITLE',
      title: 'Novo Titulo',
    })
  })

  it('meta line shows read time when available', () => {
    const { getByText } = render(<StageIdeia />)
    expect(getByText(/7 min de leitura/)).toBeTruthy()
  })

  it('meta line shows "rascunho novo" when readTime is empty', () => {
    mockVersion = makeVersion({ readTime: 0 })
    const { getByText } = render(<StageIdeia />)
    expect(getByText(/rascunho novo/)).toBeTruthy()
  })

  it('fresh version shows placeholder text instead of hook/synopsis values', () => {
    mockVersion = makeVersion({ fresh: true })
    const { getByText, queryByText } = render(<StageIdeia />)
    expect(getByText('Defina o hook para esta versão')).toBeTruthy()
    expect(getByText('Defina a sinopse para esta versão')).toBeTruthy()
    expect(queryByText('Um gancho poderoso')).toBeNull()
    expect(queryByText('Uma sinopse detalhada do post')).toBeNull()
  })

  it('word count is formatted with locale', () => {
    mockVersion = makeVersion({ words: 12345 })
    const { container } = render(<StageIdeia />)
    // pt-BR locale formats 12345 as "12.345"
    expect(container.textContent).toContain('12.345')
  })

  it('shows PT-BR flag when activeLang is pt', () => {
    const { container } = render(<StageIdeia />)
    expect(container.textContent).toContain('PT-BR')
  })

  it('shows EN flag when activeLang is en', () => {
    mockState = makeState({ activeLang: 'en' })
    const { container } = render(<StageIdeia />)
    expect(container.textContent).toContain('EN')
  })

  it('renders category name in meta line', () => {
    const { getByText } = render(<StageIdeia />)
    expect(getByText(/Tecnologia/)).toBeTruthy()
  })
})
