// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard', () => ({
  AbCreateWizard: (p: { video: { id: string }; referencia?: React.ReactNode; prefill?: unknown }) => (
    <div data-testid="wizard" data-video={p.video.id} data-prefill={JSON.stringify(p.prefill ?? null)}>{p.referencia}</div>
  ),
}))

import { NewTestClient } from '../src/app/cms/(authed)/youtube/ab-lab/new/client'

const video = (id: string, hasActiveTest = false) => ({
  id, title: `Vídeo ${id}`, thumbnailUrl: null, durationSeconds: 60,
  channelHandle: '@x', hasActiveTest, previousLift: null, sourcePipelineId: null,
})
const base = {
  siteId: 's',
  settings: {} as never,
  eligibleVideos: [video('u1'), video('u2')],
}

describe('NewTestClient', () => {
  it('initialVideoId elegível abre o assistente com aquele vídeo', () => {
    render(<NewTestClient {...base} initialVideoId="u2" />)
    expect(screen.getByTestId('wizard').getAttribute('data-video')).toBe('u2')
  })
  it('tipoInicial sem competitorContext pré-marca o tipo (B1) e nunca leva thumb/título', () => {
    render(<NewTestClient {...base} initialVideoId="u1" tipoInicial="thumbnail" />)
    expect(JSON.parse(screen.getByTestId('wizard').getAttribute('data-prefill')!)).toEqual({ testType: 'thumbnail' })
  })
  it('com referência o prefill continua só com testType', () => {
    render(<NewTestClient {...base} initialVideoId="u1" tipoInicial="title" competitorContext={{ tipo: 'title', thumb: null, titulo: 'T', refVideoId: null, refTroca: null, canal: null, hrefOrigem: null, thumbSubstituta: null }} />)
    expect(JSON.parse(screen.getByTestId('wizard').getAttribute('data-prefill')!)).toEqual({ testType: 'title' })
  })
  it('sem tipoInicial não há prefill', () => {
    render(<NewTestClient {...base} initialVideoId="u1" />)
    expect(JSON.parse(screen.getByTestId('wizard').getAttribute('data-prefill')!)).toBeNull()
  })
  it('sem initialVideoId mostra a lista', () => {
    render(<NewTestClient {...base} />)
    expect(screen.queryByTestId('wizard')).toBeNull()
    expect(screen.getByText('Vídeo u1')).toBeTruthy()
  })
  it('aviso aparece na região status', () => {
    render(<NewTestClient {...base} aviso="Não encontramos esse vídeo." />)
    expect(screen.getByRole('status').textContent).toContain('Não encontramos esse vídeo.')
  })
  const ctx = (o: Partial<import('../src/app/cms/(authed)/youtube/ab-lab/new/client').CompetitorContext>) => ({
    tipo: 'title' as const, thumb: null, titulo: null, refVideoId: null, refTroca: null,
    canal: null, hrefOrigem: null, thumbSubstituta: null, ...o,
  })
  it('título hostil vira texto, sem img', () => {
    const { container } = render(
      <NewTestClient {...base} initialVideoId="u1" competitorContext={ctx({ titulo: '<b>x</b>' })} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<b>x</b>')).toBeTruthy()
  })
  it('thumb do YouTube renderiza img', () => {
    const { container } = render(
      <NewTestClient {...base} initialVideoId="u1" competitorContext={ctx({ tipo: 'thumbnail', thumb: 'https://i.ytimg.com/vi/a/hq.jpg' })} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://i.ytimg.com/vi/a/hq.jpg')
  })
})
