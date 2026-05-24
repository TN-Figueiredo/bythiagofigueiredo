import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CurriculumRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/curriculum-renderer'

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
})
