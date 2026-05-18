import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptEditMode } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-edit-mode'
import type { RoteiroContent } from '@/lib/pipeline/roteiro-schemas'

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

const CONTENT: RoteiroContent = {
  version: 2,
  meta: { canal: 'EN' },
  beats: [
    { idx: 0, name: 'Hook', status: 'PENDING', script: [{ type: 'line', text: 'Hello' }] },
    { idx: 1, name: 'Body', status: 'DONE', script: [] },
  ],
}

describe('ScriptEditMode', () => {
  it('renders meta editor', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={true} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Canal')).toBeTruthy()
  })

  it('renders all beats', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={false} onChange={vi.fn()} />)
    expect(screen.getAllByText('#0').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('#1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Hook').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Body').length).toBeGreaterThanOrEqual(1)
  })

  it('shows add-beat button in edit mode', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={true} onChange={vi.fn()} />)
    expect(screen.getByText('Adicionar beat')).toBeTruthy()
  })

  it('hides add-beat button in read mode', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={false} onChange={vi.fn()} />)
    expect(screen.queryByText('Adicionar beat')).toBeNull()
  })

  it('calls onChange with new beat when add clicked', () => {
    const onChange = vi.fn()
    render(<ScriptEditMode content={CONTENT} isEditing={true} onChange={onChange} />)
    fireEvent.click(screen.getByText('Adicionar beat'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const newContent = onChange.mock.calls[0]![0] as RoteiroContent
    expect(newContent.beats).toHaveLength(3)
    expect(newContent.beats[2]!.idx).toBe(2)
  })

  it('shows empty state when no beats and not editing', () => {
    const empty: RoteiroContent = { version: 2, meta: {}, beats: [] }
    render(<ScriptEditMode content={empty} isEditing={false} onChange={vi.fn()} />)
    expect(screen.getByText('Nenhum beat encontrado no roteiro.')).toBeTruthy()
  })

  it('shows add-beat button when beats empty and editing', () => {
    const empty: RoteiroContent = { version: 2, meta: {}, beats: [] }
    render(<ScriptEditMode content={empty} isEditing={true} onChange={vi.fn()} />)
    expect(screen.getByText('Adicionar beat')).toBeTruthy()
  })
})
