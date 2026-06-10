import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/edit/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/edit/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockState: EditorState
let mockVersion: VersionContent

vi.mock('@/app/cms/(authed)/blog/[id]/edit/context', () => ({
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
  useEditorVersion: () => mockVersion,
}))

/* ------------------------------------------------------------------ */
/*  Import after mock                                                 */
/* ------------------------------------------------------------------ */

import { StageIdeia } from '@/app/cms/(authed)/blog/[id]/edit/stages/stage-ideia'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    pipelineItemId: null,
    code: 'tg-01',
    siteId: 'site-1',
    siteTimezone: 'America/Sao_Paulo',
    activeStage: 'ideia',
    activeLang: 'pt',
    focus: false,
    inspectorOpen: false,
    categories: [],
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
      coverPrompt: '',
      direction: '',
      directionAlts: [],
      imagePrompts: {},
      history: [],
    },
    saveStatus: 'idle',
    scrollToImageId: null,
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

  it('renders title from version', () => {
    const { getByText } = render(<StageIdeia />)
    expect(getByText('Meu Post de Teste')).toBeTruthy()
  })

  it('shows PT-BR label when activeLang is pt', () => {
    const { container } = render(<StageIdeia />)
    expect(container.textContent).toContain('PT-BR')
  })

  it('shows EN label when activeLang is en', () => {
    mockState = makeState({ activeLang: 'en' })
    const { container } = render(<StageIdeia />)
    expect(container.textContent).toContain('EN')
  })

  it('renders "Conceito" kicker label', () => {
    const { container } = render(<StageIdeia />)
    expect(container.textContent).toContain('Conceito')
  })

  it('renders hook and synopsis brief cards', () => {
    const { container } = render(<StageIdeia />)
    expect(container.querySelectorAll('.brief-card')).toHaveLength(2)
    expect(container.querySelector('.brief-card.hook')).toBeTruthy()
  })

  it('next button dispatches SET_STAGE to rascunho', () => {
    const { getByText } = render(<StageIdeia />)
    const btn = getByText(/gerar o conteúdo/i)
    fireEvent.click(btn)
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STAGE',
      stage: 'rascunho',
    })
  })

  it('empty hook shows placeholder via data-empty', () => {
    mockState = makeState({
      shared: {
        ...makeState().shared,
        hook: '',
      },
    })
    const { container } = render(<StageIdeia />)
    const hookText = container.querySelector('.brief-card.hook .bc-text')
    expect(hookText?.getAttribute('data-empty')).toBe('true')
  })
})
