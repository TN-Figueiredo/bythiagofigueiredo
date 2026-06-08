import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { VideoKanban } from '@/app/cms/(authed)/video/_components/video-kanban'
import type { VideoHubCard } from '@/lib/pipeline/load-video-hub'

function card(over: Partial<VideoHubCard>): VideoHubCard {
  return {
    id: 'x', code: 'V-A00', title: 'T', column: 'idea', stage: 'idea', language: 'pt-br',
    pillar: undefined, duration: '—', beatsLabel: 'sem roteiro', beatsCount: 0,
    hasPt: true, hasEn: false, version: 1, ...over,
  }
}

const cards: VideoHubCard[] = [
  card({ id: 'a', code: 'V-A01', column: 'idea', stage: 'idea', pillar: 'viagem' }),
  card({ id: 'b', code: 'V-A02', column: 'roteiro', stage: 'roteiro', pillar: 'ia' }),
  card({ id: 'c', code: 'V-A03', column: 'roteiro', stage: 'roteiro', pillar: 'viagem' }),
  card({ id: 'd', code: 'V-A04', column: 'published', stage: 'published', pillar: 'viagem' }),
]

describe('VideoKanban', () => {
  it('renders 4 lifecycle columns with PT labels and per-column counts', () => {
    render(<VideoKanban cards={cards} activePillar={null} />)
    const labels = ['Ideia', 'Roteiro', 'Gravação', 'Publicado']
    for (const l of labels) expect(screen.getByText(l)).toBeInTheDocument()
    const roteiroCol = screen.getByText('Roteiro').closest('.vcol')!
    expect(within(roteiroCol as HTMLElement).getByText('2')).toBeInTheDocument()
  })

  it('shows "Vazio" in empty columns', () => {
    render(<VideoKanban cards={cards} activePillar={null} />)
    const gravacaoCol = screen.getByText('Gravação').closest('.vcol')!
    expect(within(gravacaoCol as HTMLElement).getByText('Vazio')).toBeInTheDocument()
  })

  it('pillar filter narrows all columns and updates counts', () => {
    render(<VideoKanban cards={cards} activePillar="viagem" />)
    expect(screen.queryByText('V-A02')).not.toBeInTheDocument() // ia card filtered out
    const roteiroCol = screen.getByText('Roteiro').closest('.vcol')!
    expect(within(roteiroCol as HTMLElement).getByText('1')).toBeInTheDocument() // only V-A03
    expect(screen.getByText('V-A01')).toBeInTheDocument()
    expect(screen.getByText('V-A04')).toBeInTheDocument()
  })
})
