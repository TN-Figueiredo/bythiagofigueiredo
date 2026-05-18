import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('ScriptRenderer — unified mode', () => {
  it('renders beat header with number and label after v1→v2 migration', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(screen.getAllByText('#0').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('HOOK — Triple Curiosity Gap').length).toBeGreaterThanOrEqual(1)
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

  it('renders hidden print view alongside edit mode', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    const printView = container.querySelector('.script-print-view')
    expect(printView).toBeTruthy()
    expect(printView!.querySelector('.script-view')).toBeTruthy()
    expect(screen.queryByTitle('Edit mode')).toBeNull()
    expect(screen.queryByTitle(/View mode/)).toBeNull()
  })

  it('shows roteiro header label with beat count', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(container.textContent).toContain('1 beats')
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
    expect(container.textContent).toContain('#0')
  })

  it('migrates v1 content automatically', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(screen.getAllByText('#0').length).toBeGreaterThanOrEqual(1)
  })
})
