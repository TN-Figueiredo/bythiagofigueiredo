import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { VideoHub } from '@/app/cms/(authed)/video/_components/video-hub'
import type { VideoHubData } from '@/lib/pipeline/load-video-hub'

const data: VideoHubData = {
  cards: [
    { id: 'a', code: 'V-A01', title: 'A', column: 'idea', stage: 'idea', language: 'pt-br', pillar: 'viagem', duration: '—', beatsLabel: 'sem roteiro', beatsCount: 0, hasPt: true, hasEn: false, version: 1 },
    { id: 'b', code: 'V-A02', title: 'B', column: 'roteiro', stage: 'roteiro', language: 'en', pillar: 'ia', duration: '—', beatsLabel: '2 beats', beatsCount: 2, hasPt: false, hasEn: true, version: 1 },
  ],
  stats: { total: 2, roteiro: 1, gravacao: 0, published: 0 },
  pillarCounts: { viagem: 1, ia: 1 },
}

describe('VideoHub', () => {
  it('renders header, stat row, pillar rail and kanban', () => {
    render(<VideoHub data={data} />)
    expect(screen.getByRole('heading', { name: 'Vídeos' })).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Todos')).toBeInTheDocument()
    expect(screen.getByText('Ideia')).toBeInTheDocument()
  })

  it('clicking a pillar chip filters the kanban client-side', () => {
    render(<VideoHub data={data} />)
    expect(screen.getByText('V-A02')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Viagem').closest('button')!)
    expect(screen.queryByText('V-A02')).not.toBeInTheDocument()
    expect(screen.getByText('V-A01')).toBeInTheDocument()
    const roteiroCol = screen.getByText('Roteiro').closest('.vcol')!
    expect(within(roteiroCol as HTMLElement).getByText('0')).toBeInTheDocument()
  })
})
