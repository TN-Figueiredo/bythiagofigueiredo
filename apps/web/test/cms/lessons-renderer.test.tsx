import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LessonsRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/lessons-renderer'

describe('LessonsRenderer', () => {
  const baseProps = {
    content: {
      l1: {
        talking_points: ['Point A', 'Point B'],
        script: 'This is the script for lesson 1',
        production_notes: 'Use lapel mic',
        recording_date: null,
        actual_duration_seconds: null,
        equipment_notes: null,
      },
    },
    isEditing: false,
    lang: 'pt',
    onContentChange: vi.fn(),
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders lesson script content', () => {
    render(<LessonsRenderer {...baseProps} />)
    expect(screen.getByText(/Point A/)).toBeTruthy()
  })

  it('renders formatted lesson label in sidebar', () => {
    render(<LessonsRenderer {...baseProps} />)
    expect(screen.getByText('Aula 1')).toBeTruthy()
  })

  it('renders script text', () => {
    render(<LessonsRenderer {...baseProps} />)
    expect(screen.getByText(/This is the script for lesson 1/)).toBeTruthy()
  })

  it('renders production notes', () => {
    render(<LessonsRenderer {...baseProps} />)
    expect(screen.getByText(/Use lapel mic/)).toBeTruthy()
  })

  it('shows empty state when no lessons', () => {
    render(<LessonsRenderer {...baseProps} content={{}} />)
    const matches = screen.getAllByText(/Nenhuma aula definida/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders multiple lessons in sidebar', () => {
    const content = {
      l1: { talking_points: ['Point A'], script: 'Script 1', production_notes: '', recording_date: null, actual_duration_seconds: null, equipment_notes: null },
      l2: { talking_points: ['Point B'], script: 'Script 2', production_notes: '', recording_date: null, actual_duration_seconds: null, equipment_notes: null },
    }
    render(<LessonsRenderer {...baseProps} content={content} />)
    expect(screen.getByText('Aula 1')).toBeTruthy()
    expect(screen.getByText('Aula 2')).toBeTruthy()
  })

  // ── Edit mode tests ────────────────────────────────────────────────────────

  describe('edit mode', () => {
    const editProps = {
      ...baseProps,
      isEditing: true,
      onContentChange: vi.fn(),
    }

    it('shows "Nova aula" button and clicking it calls onContentChange with a new lesson entry', () => {
      const onContentChange = vi.fn()
      render(<LessonsRenderer {...editProps} onContentChange={onContentChange} />)

      const addBtn = screen.getByText('+ Adicionar aula')
      expect(addBtn).toBeTruthy()

      fireEvent.click(addBtn)

      expect(onContentChange).toHaveBeenCalledOnce()
      const updatedContent = onContentChange.mock.calls[0][0] as Record<string, unknown>
      // Should still contain l1 plus a new lesson key
      expect(Object.keys(updatedContent)).toContain('l1')
      expect(Object.keys(updatedContent).length).toBe(2)
    })

    it('shows "Remover aula" button in the edit panel for the selected lesson', () => {
      render(<LessonsRenderer {...editProps} />)
      expect(screen.getByRole('button', { name: 'Remover aula' })).toBeTruthy()
    })

    it('clicking "Remover aula" triggers window.confirm and removes the lesson when confirmed', () => {
      const onContentChange = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<LessonsRenderer {...editProps} onContentChange={onContentChange} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remover aula' }))

      expect(window.confirm).toHaveBeenCalledWith('Remover esta aula?')
      expect(onContentChange).toHaveBeenCalledOnce()
      const updatedContent = onContentChange.mock.calls[0][0] as Record<string, unknown>
      expect(Object.keys(updatedContent)).not.toContain('l1')
    })

    it('clicking "Remover aula" does nothing when window.confirm is cancelled', () => {
      const onContentChange = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<LessonsRenderer {...editProps} onContentChange={onContentChange} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remover aula' }))

      expect(window.confirm).toHaveBeenCalledOnce()
      expect(onContentChange).not.toHaveBeenCalled()
    })

    it('can add a new talking point via "+ Adicionar ponto" button', () => {
      const onContentChange = vi.fn()
      render(<LessonsRenderer {...editProps} onContentChange={onContentChange} />)

      fireEvent.click(screen.getByText('+ Adicionar ponto'))

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as Record<string, { talking_points: string[] }>
      expect(updated.l1.talking_points).toHaveLength(3)
      expect(updated.l1.talking_points[2]).toBe('')
    })

    it('can edit the script textarea and calls onContentChange with updated script', () => {
      const onContentChange = vi.fn()
      render(<LessonsRenderer {...editProps} onContentChange={onContentChange} />)

      const textarea = screen.getByPlaceholderText('Escreva o roteiro da aula...')
      fireEvent.change(textarea, { target: { value: 'Updated script text' } })

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as Record<string, { script: string }>
      expect(updated.l1.script).toBe('Updated script text')
    })

    it('can edit production notes and calls onContentChange with updated notes', () => {
      const onContentChange = vi.fn()
      render(<LessonsRenderer {...editProps} onContentChange={onContentChange} />)

      const textarea = screen.getByPlaceholderText('Notas para a equipe de produção...')
      fireEvent.change(textarea, { target: { value: 'New production note' } })

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as Record<string, { production_notes: string }>
      expect(updated.l1.production_notes).toBe('New production note')
    })

    it('shows recording date and equipment notes fields in edit mode', () => {
      render(<LessonsRenderer {...editProps} />)

      // Equipment notes input is present
      expect(screen.getByPlaceholderText('Ex: câmera A, microfone lapela...')).toBeTruthy()

      // Recording date label is rendered as a span
      const spans = document.querySelectorAll('span')
      const labelTexts = Array.from(spans).map((s) => s.textContent)
      expect(labelTexts.some((t) => t?.includes('Data de gravação'))).toBe(true)
      expect(labelTexts.some((t) => t?.includes('Notas de equipamento'))).toBe(true)

      // A date input is present in the DOM
      const dateInputs = document.querySelectorAll('input[type="date"]')
      expect(dateInputs.length).toBe(1)
    })
  })
})
