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

describe('PipelineBoard', () => {
  it('renders columns for video workflow', async () => {
    const { PipelineBoard } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-board')
    render(
      <PipelineBoard
        format="video"
        items={[
          { id: '1', code: 'G1-test', title_pt: 'Video 1', title_en: null, stage: 'idea', priority: 3, language: 'pt-br', tags: [], production_checklist: [], version: 1, format: 'video' },
          { id: '2', code: 'G2-test', title_pt: 'Video 2', title_en: null, stage: 'roteiro', priority: 1, language: 'both', tags: ['ai'], production_checklist: [{ label: 'X', done: true }], version: 1, format: 'video' },
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
    render(<PipelineBoard format="blog_post" items={[]} />)
    expect(screen.getByText('Ideia')).toBeTruthy()
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(screen.getByText('Pronto')).toBeTruthy()
  })
})
