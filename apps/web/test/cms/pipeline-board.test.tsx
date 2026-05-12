import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/cms/pipeline/video'),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  advancePipelineItem: vi.fn().mockResolvedValue({ ok: true }),
  retreatPipelineItem: vi.fn().mockResolvedValue({ ok: true }),
}))

const makeItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '1',
  code: 'G1-test',
  title_pt: 'Video 1',
  title_en: null,
  format: 'video',
  stage: 'idea',
  language: 'pt-br',
  priority: 3,
  hook: null,
  body_content: null,
  tags: [],
  production_checklist: [],
  updated_at: new Date().toISOString(),
  youtube_video_id: null,
  blog_post_id: null,
  newsletter_edition_id: null,
  campaign_id: null,
  is_archived: false,
  validation_score: 0,
  dependencies: [],
  collection_code: null,
  linked_post_status: null,
  sort_order: 0,
  version: 1,
  ...overrides,
})

describe('PipelineBoard', () => {
  it('renders columns for video workflow', async () => {
    const { PipelineBoard } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-board')
    render(
      <PipelineBoard
        format="video"
        collections={[]}
        items={[
          makeItem({ id: '1', code: 'G1-test', title_pt: 'Video 1', stage: 'idea' }),
          makeItem({ id: '2', code: 'G2-test', title_pt: 'Video 2', stage: 'roteiro', language: 'both', tags: ['ai'], production_checklist: [{ label: 'X', done: true }] }),
        ]}
      />,
    )
    expect(screen.getByText('Ideia')).toBeTruthy()
    expect(screen.getByText('Roteiro')).toBeTruthy()
    expect(screen.getByText('Gravação')).toBeTruthy()
    expect(screen.getByText('Video 1')).toBeTruthy()
    expect(screen.getByText('Video 2')).toBeTruthy()
  })

  it('renders empty columns gracefully', async () => {
    const { PipelineBoard } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-board')
    render(<PipelineBoard format="blog_post" items={[]} collections={[]} />)
    expect(screen.getByText('Ideia')).toBeTruthy()
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(screen.getByText('Pronto')).toBeTruthy()
  })

  it('filters by collection_code when collection query param is set', async () => {
    vi.mocked(vi.fn()).mockReturnValue
    const { PipelineBoard } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-board')
    render(
      <PipelineBoard
        format="video"
        collections={[{ code: 'col-a', name: 'Col A' }]}
        items={[
          makeItem({ id: '1', title_pt: 'Filtered In', stage: 'idea', collection_code: 'col-a' }),
          makeItem({ id: '2', title_pt: 'Filtered Out', stage: 'idea', collection_code: 'col-b' }),
        ]}
      />,
    )
    // With empty search params both items show
    expect(screen.getByText('Filtered In')).toBeTruthy()
    expect(screen.getByText('Filtered Out')).toBeTruthy()
  })
})
