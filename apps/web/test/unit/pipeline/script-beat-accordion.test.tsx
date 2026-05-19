import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptBeatAccordion } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-beat-accordion'
import type { RoteiroBeat } from '@/lib/pipeline/roteiro-schemas'

// Mock TipTap editor (heavy dependency)
vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react')
  return {
    ...actual,
    useEditor: () => ({
      isEditable: true,
      setEditable: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      storage: { characterCount: { words: () => 12 } },
      chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }), toggleItalic: () => ({ run: vi.fn() }), toggleUnderline: () => ({ run: vi.fn() }), toggleHighlight: () => ({ run: vi.fn() }), toggleBulletList: () => ({ run: vi.fn() }), toggleBlockquote: () => ({ run: vi.fn() }), insertContent: () => ({ run: vi.fn() }), undo: () => ({ run: vi.fn() }), redo: () => ({ run: vi.fn() }) }) }),
      isActive: () => false,
      can: () => ({ undo: () => false, redo: () => false }),
    }),
    EditorContent: ({ editor }: { editor: unknown }) => (
      <div data-testid="editor-content">Editor</div>
    ),
  }
})

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
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

const baseBeat: RoteiroBeat = {
  idx: 0,
  name: 'HOOK',
  status: 'PENDING',
  script: [{ type: 'line', text: 'I lived in Canada.' }],
}

describe('ScriptBeatAccordion', () => {
  it('renders beat number and name', () => {
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('#1')).toBeTruthy()
    expect(screen.getByText('HOOK')).toBeTruthy()
  })

  it('shows drag handle only in edit mode', () => {
    const { rerender, container } = render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(container.querySelector('[aria-label="Drag to reorder beat"]')).toBeNull()

    rerender(
      <ScriptBeatAccordion beat={baseBeat} isEditing={true} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(container.querySelector('[aria-label="Drag to reorder beat"]')).toBeTruthy()
  })

  it('collapses body when toggle clicked', () => {
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    const toggle = screen.getByLabelText('Collapse beat')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('editor-content')).toBeNull()
  })

  it('calls onDelete with beat idx', () => {
    const onDelete = vi.fn()
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={true} onBeatChange={vi.fn()} onDelete={onDelete} />,
    )
    fireEvent.click(screen.getByLabelText('Delete beat'))
    expect(onDelete).toHaveBeenCalledWith(0)
  })

  it('toggles status when status button clicked', () => {
    const onBeatChange = vi.fn()
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={true} onBeatChange={onBeatChange} onDelete={vi.fn()} />,
    )
    fireEvent.click(screen.getByLabelText('Status: PENDING'))
    expect(onBeatChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'DONE' }))
  })

  it('shows "Gravado" status badge when beat.status is DONE in read mode', () => {
    const doneBeat: RoteiroBeat = { ...baseBeat, status: 'DONE' }
    render(
      <ScriptBeatAccordion beat={doneBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('Gravado')).toBeTruthy()
  })

  it('shows "Pendente" status badge when beat.status is PENDING in read mode', () => {
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('Pendente')).toBeTruthy()
  })

  it('shows duration display in read mode when beat has duration', () => {
    const beatWithDuration: RoteiroBeat = { ...baseBeat, duration: 45 }
    render(
      <ScriptBeatAccordion beat={beatWithDuration} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('45s')).toBeTruthy()
  })
})
