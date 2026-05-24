import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MaterialRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/material-renderer'

describe('MaterialRenderer', () => {
  const baseProps = {
    content: {
      l1: [
        { label: 'Slides da Aula 1', type: 'pdf', url: 'https://example.com/slides.pdf', media_id: null },
        { label: 'Repositório de Código', type: 'repo', url: 'https://github.com/example/repo', media_id: null },
      ],
      l2: [
        { label: 'Template Starter', type: 'template', url: null, media_id: null },
      ],
    },
    isEditing: false,
    lang: 'shared',
    onContentChange: vi.fn(),
  }

  it('read mode renders resource labels', () => {
    render(<MaterialRenderer {...baseProps} />)
    expect(screen.getByText('Slides da Aula 1')).toBeTruthy()
    expect(screen.getByText('Repositório de Código')).toBeTruthy()
    expect(screen.getByText('Template Starter')).toBeTruthy()
  })

  it('read mode shows type badges', () => {
    render(<MaterialRenderer {...baseProps} />)
    expect(screen.getByText('PDF')).toBeTruthy()
    expect(screen.getByText('Repositório')).toBeTruthy()
    expect(screen.getByText('Template')).toBeTruthy()
  })

  it('read mode shows URL link when URL is present', () => {
    render(<MaterialRenderer {...baseProps} />)
    const links = screen.getAllByText('Abrir ↗')
    expect(links.length).toBe(2)
  })

  it('read mode shows "Sem URL" for resources without URL', () => {
    render(<MaterialRenderer {...baseProps} />)
    expect(screen.getByText('Sem URL')).toBeTruthy()
  })

  it('read mode shows lesson IDs as headers', () => {
    render(<MaterialRenderer {...baseProps} />)
    expect(screen.getByText('l1')).toBeTruthy()
    expect(screen.getByText('l2')).toBeTruthy()
  })

  it('empty state shows a helpful message in read mode', () => {
    render(<MaterialRenderer {...baseProps} content={{}} />)
    expect(screen.getByText('Nenhum material cadastrado ainda.')).toBeTruthy()
  })

  describe('edit mode', () => {
    const editProps = { ...baseProps, isEditing: true }

    it('edit mode shows add lesson button', () => {
      render(<MaterialRenderer {...editProps} />)
      expect(screen.getByText('+ Adicionar aula')).toBeTruthy()
    })

    it('edit mode shows add material buttons for each lesson block', () => {
      render(<MaterialRenderer {...editProps} />)
      const addButtons = screen.getAllByText('+ Adicionar material')
      expect(addButtons.length).toBe(2)
    })

    it('empty state in edit mode shows helpful message', () => {
      render(<MaterialRenderer {...editProps} content={{}} />)
      expect(screen.getByText(/nenhuma aula com material ainda/i)).toBeTruthy()
    })

    it('adding a resource calls onContentChange', () => {
      const onContentChange = vi.fn()
      render(<MaterialRenderer {...editProps} onContentChange={onContentChange} />)

      const addButtons = screen.getAllByText('+ Adicionar material')
      fireEvent.click(addButtons[0])

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as Record<string, Array<{ label: string; type: string }>>
      expect(updated.l1).toHaveLength(3)
    })

    it('removing a resource calls onContentChange with fewer items', () => {
      const onContentChange = vi.fn()
      render(<MaterialRenderer {...editProps} onContentChange={onContentChange} />)

      const removeButtons = screen.getAllByLabelText('Remover material')
      fireEvent.click(removeButtons[0])

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as Record<string, Array<unknown>>
      expect(updated.l1).toHaveLength(1)
    })

    it('adding a lesson with an ID calls onContentChange', () => {
      const onContentChange = vi.fn()
      render(<MaterialRenderer {...editProps} onContentChange={onContentChange} />)

      const input = screen.getByLabelText('ID da aula para adicionar')
      fireEvent.change(input, { target: { value: 'newLesson' } })
      fireEvent.click(screen.getByText('+ Adicionar aula'))

      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as Record<string, unknown>
      expect(Array.isArray(updated.newLesson)).toBe(true)
    })

    it('removing a lesson block calls onContentChange without that key', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const onContentChange = vi.fn()
      render(<MaterialRenderer {...editProps} onContentChange={onContentChange} />)

      const removeButtons = screen.getAllByText('Remover aula')
      fireEvent.click(removeButtons[0])

      expect(window.confirm).toHaveBeenCalled()
      expect(onContentChange).toHaveBeenCalledOnce()
      const updated = onContentChange.mock.calls[0][0] as Record<string, unknown>
      expect('l1' in updated).toBe(false)
      expect('l2' in updated).toBe(true)
    })
  })
})
