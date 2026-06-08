// apps/web/test/cms/video/kanban-empty-column.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoKanban } from '@/app/cms/(authed)/video/_components/video-kanban'

describe('VideoKanban empty column (§5.5)', () => {
  it('a column with no cards shows the "Vazio" empty-column state', () => {
    // all cards in the `idea` column → roteiro/gravacao/published are empty
    const cards = [
      { id: 'p1', code: 'VID-1', column: 'idea', stage: 'idea', titlePt: 'A', titleEn: null, language: 'pt-br', pillar: undefined, beatsCount: 0, hasPt: true, hasEn: false },
    ]
    render(<VideoKanban cards={cards as never} activePillar={null} />)
    // 4 columns, 3 empty → at least 3 "Vazio" labels
    expect(screen.getAllByText('Vazio').length).toBeGreaterThanOrEqual(3)
  })
})
