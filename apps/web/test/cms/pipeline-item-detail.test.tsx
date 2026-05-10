import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  updatePipelineItem: vi.fn().mockResolvedValue({ ok: true, data: { id: '1', version: 2 } }),
  advancePipelineItem: vi.fn().mockResolvedValue({ ok: true }),
  retreatPipelineItem: vi.fn().mockResolvedValue({ ok: true }),
  archivePipelineItem: vi.fn().mockResolvedValue({ ok: true }),
  restorePipelineItem: vi.fn().mockResolvedValue({ ok: true }),
  toggleChecklist: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('PipelineItemDetail', () => {
  it('renders item title and stage', async () => {
    const { PipelineItemDetail } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-item-detail')
    render(
      <PipelineItemDetail
        item={{
          id: '1',
          code: 'G14-test',
          title_pt: 'AI Agents',
          title_en: null,
          format: 'video',
          stage: 'roteiro',
          language: 'pt-br',
          priority: 3,
          hook: 'Learn AI agents',
          synopsis: 'Full overview',
          body_content: '# Script\n\nHello',
          tags: ['ai'],
          production_checklist: [{ label: 'Escrever roteiro', done: true, toggled_at: null }],
          format_metadata: { playlist_letter: 'G', episode_number: 14 },
          version: 1,
          is_archived: false,
          updated_at: '2026-05-01T00:00:00Z',
          validation_score: 70,
          sections: null,
        }}
        collections={[]}
        history={[]}
        dependencies={[]}
      />,
    )
    expect(screen.getByDisplayValue('AI Agents')).toBeTruthy()
    // 'Roteiro' appears both as the stage badge and as a section tab
    expect(screen.getAllByText('Roteiro').length).toBeGreaterThan(0)
  })

  it('shows checklist items', async () => {
    const { PipelineItemDetail } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-item-detail')
    render(
      <PipelineItemDetail
        item={{
          id: '1', code: 'G14', title_pt: 'X', title_en: null,
          format: 'video', stage: 'idea', language: 'pt-br', priority: 0,
          hook: null, synopsis: null, body_content: null, tags: [],
          production_checklist: [
            { label: 'Task A', done: false, toggled_at: null },
            { label: 'Task B', done: true, toggled_at: '2026-05-09' },
          ],
          format_metadata: {}, version: 1, is_archived: false,
          updated_at: '2026-05-01T00:00:00Z', validation_score: 0,
          sections: null,
        }}
        collections={[]}
        history={[]}
        dependencies={[]}
      />,
    )
    expect(screen.getByText('Task A')).toBeTruthy()
    expect(screen.getByText('Task B')).toBeTruthy()
  })
})
