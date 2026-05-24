import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
