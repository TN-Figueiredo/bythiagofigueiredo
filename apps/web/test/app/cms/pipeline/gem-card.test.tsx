import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GemCard, type GemCardItem } from '@/app/cms/(authed)/pipeline/_components/gem-card'

const baseItem: GemCardItem = {
  id: '1',
  code: 'vid-test',
  title_pt: 'Test Title',
  title_en: null,
  format: 'video',
  stage: 'roteiro',
  language: 'pt-br',
  priority: 3,
  hook: null,
  body_content: null,
  tags: [],
  production_checklist: [
    { label: 'A', done: true },
    { label: 'B', done: false },
  ],
  updated_at: new Date().toISOString(),
  youtube_video_id: null,
  blog_post_id: null,
  newsletter_edition_id: null,
  campaign_id: null,
  is_archived: false,
  validation_score: 45,
  dependencies: [],
  collection_code: null,
  linked_post_status: null,
  sort_order: 0,
  version: 1,
}

describe('GemCard', () => {
  it('renders code and title', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('vid-test')).toBeDefined()
    expect(screen.getByText('Test Title')).toBeDefined()
  })

  it('shows format icon', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('🎬')).toBeDefined()
  })

  it('shows priority badge', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('P3')).toBeDefined()
  })

  it('shows raw state hint when no hook', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('sem hook definido')).toBeDefined()
  })

  it('shows hook text when enriched', () => {
    render(<GemCard item={{ ...baseItem, hook: 'A great hook' }} />)
    expect(screen.getByText('A great hook')).toBeDefined()
  })

  it('shows graduated badge when youtube_video_id set', () => {
    render(<GemCard item={{ ...baseItem, hook: 'x', youtube_video_id: 'abc' }} />)
    expect(screen.getByText('graduated')).toBeDefined()
  })

  it('applies archived styling', () => {
    const { container } = render(<GemCard item={{ ...baseItem, is_archived: true }} />)
    const card = container.firstElementChild
    expect(card?.className).toContain('opacity-45')
  })

  it('shows blocked tag when hard dep exists', () => {
    const deps = [{ dependency_type: 'hard', depends_on_pipeline: { code: 'vid-setup' } }]
    render(<GemCard item={{ ...baseItem, dependencies: deps }} />)
    expect(screen.getByText(/blocked by vid-setup/)).toBeDefined()
  })

  it('shows checklist segments', () => {
    const { container } = render(<GemCard item={baseItem} />)
    const segments = container.querySelectorAll('[data-segment]')
    expect(segments.length).toBe(2)
  })

  it('limits tags to 3 with overflow', () => {
    const item = { ...baseItem, tags: ['t1', 't2', 't3', 't4', 't5'], collection_code: null }
    render(<GemCard item={item} />)
    // 3 tags shown, 2 overflow (5 total - 3 displayed = 2)
    expect(screen.getByText('+2')).toBeDefined()
  })

  it('renders as a button-like div', () => {
    const { container } = render(<GemCard item={baseItem} />)
    const card = container.querySelector('[role="button"]')
    expect(card).toBeDefined()
    expect(card?.getAttribute('tabindex')).toBe('0')
  })
})
