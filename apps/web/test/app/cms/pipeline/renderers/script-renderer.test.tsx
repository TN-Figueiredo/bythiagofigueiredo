import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer'

const noop = vi.fn()

vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react')
  return {
    ...actual,
    useEditor: () => ({
      isEditable: true,
      setEditable: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      storage: { characterCount: { words: () => 5 } },
      chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
      isActive: () => false,
    }),
    EditorContent: () => <div data-testid="editor-content">Editor</div>,
  }
})

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: 'vertical',
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

// ScriptViewMode mock — renders a .script-view sentinel
vi.mock(
  '@/app/cms/(authed)/pipeline/_components/detail/renderers/script-view-mode',
  () => ({
    ScriptViewMode: ({ onExitView }: { onExitView: () => void }) => (
      <div className="script-view">
        <button onClick={onExitView}>Exit view</button>
      </div>
    ),
  }),
)

const BEAT_WITH_TAGS = {
  meta: { canal: 'EN', formato: 'Storytelling' },
  beats: [
    {
      number: 0,
      label: 'HOOK — Triple Curiosity Gap',
      status: 'GRAVADO',
      text: '[VISUAL: 3s — montage rápida] [TOM: calmo, NÃO dramático] "I lived in Canada for four years." [PAUSE 0.5s] "I chose to move back."',
    },
  ],
}

describe('ScriptRenderer — edit mode (new architecture)', () => {
  it('renders beat header with number and label after v1→v2 migration', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(screen.getByText('#0')).toBeTruthy()
    expect(screen.getByText('HOOK — Triple Curiosity Gap')).toBeTruthy()
  })

  it('renders meta grid when meta is present', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(container.textContent).toContain('Canal')
    expect(container.textContent).toContain('EN')
  })

  it('shows editor content for each beat', () => {
    const { getAllByTestId } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={true} lang="en" onContentChange={noop} />,
    )
    expect(getAllByTestId('editor-content').length).toBeGreaterThanOrEqual(1)
  })
})

describe('ScriptRenderer — edge cases', () => {
  it('handles empty beats array', () => {
    const { container } = render(
      <ScriptRenderer content={{ beats: [] }} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(container.textContent).toContain('Nenhum beat')
  })

  it('handles string content fallback', () => {
    const { container } = render(
      <ScriptRenderer content="raw string content" isEditing={false} lang="en" onContentChange={noop} />,
    )
    // Migrated to a single beat, beat header is rendered
    expect(container.textContent).toContain('#0')
  })
})

describe('ScriptRenderer — dual-mode toggle', () => {
  it('starts in edit mode by default', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={true} lang="en" onContentChange={noop} />,
    )
    expect(container.querySelector('.script-view')).toBeNull()
  })

  it('shows Edit/View toggle buttons', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(screen.getByTitle('Edit mode')).toBeTruthy()
    expect(screen.getByTitle(/View mode/)).toBeTruthy()
  })

  it('switches to view mode when View button clicked', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    fireEvent.click(screen.getByTitle(/View mode/))
    expect(container.querySelector('.script-view')).toBeTruthy()
  })

  it('migrates v1 content automatically', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(screen.getByText('#0')).toBeTruthy()
  })
})
