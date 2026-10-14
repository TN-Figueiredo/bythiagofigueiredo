// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WinnerBanner } from '@/app/cms/(authed)/youtube/ab-lab/_components/winner-banner'
import { HeroBand } from '@/app/cms/(authed)/youtube/ab-lab/_components/hero-band'
import { liftVsA, SEM_MEDICAO_DE_ENTREGA } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'

const stats = (o: Partial<{ ctrBefore: number; ctrAfter: number; totalImpressions: number }>) => ({
  ctrBefore: 0, ctrAfter: 0, totalImpressions: 0, abbaCycles: 3, monthlyExtraClicks: null, ...o,
})

describe('P2: "CTR ainda não medido" só quando não há impressão', () => {
  it('vencedor com CTR medido mostra o CTR e não mostra a frase', () => {
    render(<WinnerBanner winnerLabel="B" winnerColor="" lift={null} confidence={null} stats={stats({ ctrBefore: 3.6, ctrAfter: 5.4, totalImpressions: 1680 })} />)
    expect(screen.queryByText(SEM_MEDICAO_DE_ENTREGA)).toBeNull()
    expect(screen.getByTestId('winner-banner').textContent).toMatch(/3,6%.*5,4%/)
  })
  it('vencedor com impressões e zero cliques mostra 0,0% medido, sem a frase', () => {
    render(<WinnerBanner winnerLabel="B" winnerColor="" lift={null} confidence={null} stats={stats({ totalImpressions: 840 })} />)
    expect(screen.queryByText(SEM_MEDICAO_DE_ENTREGA)).toBeNull()
    expect(screen.getByTestId('winner-banner').textContent).toContain('0,0%')
  })
  it('vencedor sem impressão mostra "—" e a frase', () => {
    render(<WinnerBanner winnerLabel="B" winnerColor="" lift={null} confidence={null} stats={stats({})} />)
    expect(screen.getByText(SEM_MEDICAO_DE_ENTREGA)).toBeTruthy()
  })
  it('hero do ativo com medição mostra o lift do líder contra A, sem a frase', () => {
    const lift = liftVsA({ label: 'A', ctr: 3, impressions: 300 }, { label: 'B', ctr: 5, impressions: 300 })
    render(<HeroBand leader={{ label: 'B', color: '' }} trend="flat" semMedicao={false} liftLider={lift} />)
    expect(screen.getByTestId('hero-lift').textContent).toBe('+66,7%')
    expect(screen.queryByText(SEM_MEDICAO_DE_ENTREGA)).toBeNull()
  })
  it('hero do ativo sem medição mantém "—" e a frase', () => {
    render(<HeroBand leader={{ label: 'B', color: '' }} trend="flat" semMedicao liftLider={null} />)
    expect(screen.getByText(SEM_MEDICAO_DE_ENTREGA)).toBeTruthy()
  })
  it('liftVsA: sem impressão ou sem base em A dá null', () => {
    expect(liftVsA({ label: 'A', ctr: 0, impressions: 300 }, { label: 'B', ctr: 5, impressions: 300 })).toBeNull()
    expect(liftVsA({ label: 'A', ctr: 3, impressions: 0 }, { label: 'B', ctr: 5, impressions: 300 })).toBeNull()
    expect(liftVsA({ label: 'A', ctr: 3, impressions: 300 }, { label: 'A', ctr: 3, impressions: 300 })).toBeNull()
  })
})
