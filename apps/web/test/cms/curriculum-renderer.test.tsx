import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CurriculumRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/curriculum-renderer'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: 'vertical',
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: null }),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr]
    const [item] = result.splice(from, 1)
    result.splice(to, 0, item)
    return result
  }),
  sortableKeyboardCoordinates: vi.fn(),
}))
vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => '' } } }))
vi.mock('@dnd-kit/core/dist/hooks/utilities', () => ({}))

describe('CurriculumRenderer', () => {
  const baseProps = {
    content: {
      curriculum_mode: 'fixed',
      target_audience: 'Developers',
      difficulty: 'beginner',
      estimated_hours: 10,
      learning_outcomes: ['Learn AI'],
      modules: [{
        id: 'm1', title: 'Module 1', description: 'First module', sort_order: 0,
        is_preview: false,
        lessons: [{
          id: 'l1', title: 'Lesson 1', type: 'video', sort_order: 0,
          is_preview: false, estimated_minutes: 15, production_status: 'ready',
          pipeline_ref: null, resources: [],
        }],
      }],
    },
    isEditing: false,
    lang: 'shared',
    onContentChange: vi.fn(),
  }

  it('renders module title', () => {
    render(<CurriculumRenderer {...baseProps} />)
    expect(screen.getByText('Module 1')).toBeTruthy()
  })

  it('renders lesson title', () => {
    render(<CurriculumRenderer {...baseProps} />)
    expect(screen.getByText('Lesson 1')).toBeTruthy()
  })

  it('shows progress', () => {
    render(<CurriculumRenderer {...baseProps} />)
    const matches = screen.getAllByText(/1\/1/)
    expect(matches.length).toBeGreaterThan(0)
  })

  describe('edit mode', () => {
    const editProps = {
      ...baseProps,
      isEditing: true,
    }

    it('changing a module title calls onContentChange with updated modules array', () => {
      const onContentChange = vi.fn()
      render(<CurriculumRenderer {...editProps} onContentChange={onContentChange} />)

      // The module title input is labeled "Módulo"
      const moduleInput = screen.getByDisplayValue('Module 1')
      fireEvent.change(moduleInput, { target: { value: 'Updated Module' } })

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as { modules: Array<{ title: string }> }
      expect(updated.modules[0].title).toBe('Updated Module')
    })

    it('adding a module calls onContentChange with a new module appended', () => {
      const onContentChange = vi.fn()
      render(<CurriculumRenderer {...editProps} onContentChange={onContentChange} />)

      const addModuleBtn = screen.getByText('+ Adicionar módulo')
      fireEvent.click(addModuleBtn)

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as { modules: Array<{ title: string }> }
      expect(updated.modules).toHaveLength(2)
      expect(updated.modules[1].title).toBe('Novo módulo')
    })

    it('removing a learning outcome calls onContentChange with updated learning_outcomes', () => {
      const propsWithOutcomes = {
        ...editProps,
        content: {
          ...baseProps.content,
          learning_outcomes: ['Learn AI', 'Build apps'],
        },
        onContentChange: vi.fn(),
      }
      render(<CurriculumRenderer {...propsWithOutcomes} />)

      // Each outcome has a "×" remove button; click the first one
      const removeButtons = screen.getAllByText('×')
      fireEvent.click(removeButtons[0])

      expect(propsWithOutcomes.onContentChange).toHaveBeenCalledOnce()
      const updated = propsWithOutcomes.onContentChange.mock.calls[0][0] as { learning_outcomes: string[] }
      expect(updated.learning_outcomes).toHaveLength(1)
      expect(updated.learning_outcomes[0]).toBe('Build apps')
    })

    it('shows safeParse warning banner when content is invalid', () => {
      const invalidProps = {
        ...editProps,
        content: { invalid_field: true, modules: 'not-an-array' },
      }
      render(<CurriculumRenderer {...invalidProps} />)

      expect(
        screen.getByText(/dados do currículo foram carregados com valores padrão/i)
      ).toBeTruthy()
    })
  })
})
