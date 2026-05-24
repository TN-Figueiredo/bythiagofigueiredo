import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublishRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer'

describe('PublishRenderer for courses', () => {
  it('renders sales copy fields when format is course', () => {
    render(
      <PublishRenderer
        content={{
          headline: 'Domine IA em 12 semanas',
          bullet_points: ['Framework testado'],
          platform: 'hotmart',
        }}
        isEditing={false}
        lang="pt"
        format="course"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText('Domine IA em 12 semanas')).toBeTruthy()
    expect(screen.getByText('Framework testado')).toBeTruthy()
  })
})
