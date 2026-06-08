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
  it('renders the mod-head, the four .bstat cards, the .cat-rail and the .vkanban', () => {
    const { container } = render(<VideoHub data={data} />)
    expect(container.querySelector('.mod-head .mod-title')!.textContent).toBe('Vídeos')
    expect(container.querySelector('.mod-live i')).toBeTruthy()
    expect(container.querySelector('.btn.primary')!.textContent).toContain('Novo Vídeo')

    const stats = container.querySelectorAll('.vhub-grid .bstat')
    expect(stats).toHaveLength(4)
    expect(within(stats[0] as HTMLElement).getByText('Total')).toBeInTheDocument()
    expect((stats[0] as HTMLElement).getAttribute('style') ?? '').toContain('--bc')

    expect(container.querySelector('.cat-rail .cat-chip')!.textContent).toContain('Todos')
    expect(container.querySelectorAll('.vkanban .vcol')).toHaveLength(4)
    // column header names (handoff)
    expect(screen.getByText('Ideia')).toBeInTheDocument()
    expect(screen.getByText('Roteiro')).toBeInTheDocument()
    expect(screen.getByText('Gravação')).toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
  })

  it('the "Todos" chip carries the total card count and pillar chips carry pillarCounts', () => {
    const { container } = render(<VideoHub data={data} />)
    const chips = container.querySelectorAll('.cat-chip')
    expect(chips[0].textContent).toContain('Todos')
    expect(within(chips[0] as HTMLElement).getByText('2')).toBeInTheDocument()
    // Viagem chip exists with a count of 1
    const rail = container.querySelector('.cat-rail') as HTMLElement
    const viagem = within(rail).getByText('Viagem').closest('.cat-chip')!
    expect(within(viagem as HTMLElement).getByText('1')).toBeInTheDocument()
  })

  it('empty columns render the .kcol-empty "Vazio" state', () => {
    const { container } = render(<VideoHub data={data} />)
    // idea + roteiro have a card each; gravacao + published are empty → 2 empties
    const empties = container.querySelectorAll('.kcol-empty')
    expect(empties.length).toBe(2)
    expect(empties[0].textContent).toContain('Vazio')
  })

  it('clicking a pillar chip activates it and narrows all columns client-side', () => {
    const { container } = render(<VideoHub data={data} />)
    expect(screen.getByText('V-A02')).toBeInTheDocument()

    const rail = container.querySelector('.cat-rail') as HTMLElement
    const viagem = within(rail).getByText('Viagem').closest('.cat-chip')!
    fireEvent.click(viagem)
    expect(viagem.className).toContain('on')

    // only the viagem card (V-A01) remains; the ia card (V-A02) is filtered out
    expect(screen.queryByText('V-A02')).not.toBeInTheDocument()
    expect(screen.getByText('V-A01')).toBeInTheDocument()

    const roteiroCol = screen.getByText('Roteiro').closest('.vcol')!
    expect(within(roteiroCol as HTMLElement).getByText('0')).toBeInTheDocument()
  })
})
