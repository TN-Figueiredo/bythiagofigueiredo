// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard', () => ({
  AbCreateWizard: (p: { video: { id: string }; referencia?: React.ReactNode; prefill?: unknown; referenciaDados?: unknown }) => (
    <div data-testid="wizard" data-video={p.video.id} data-prefill={JSON.stringify(p.prefill ?? null)} data-ref={JSON.stringify(p.referenciaDados ?? null)}>{p.referencia}</div>
  ),
}))

import { NewTestClient } from '../src/app/cms/(authed)/youtube/ab-lab/new/client'

const video = (id: string, hasActiveTest = false) => ({
  id, title: `Vídeo ${id}`, thumbnailUrl: null, durationSeconds: 60,
  channelHandle: '@x', hasActiveTest, statusDoTeste: hasActiveTest ? 'active' as const : null, bloqueio: null, publishedAt: null, viewCount: null, previousLift: null, sourcePipelineId: null,
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
  it('assistente aberto pelo Observatório envia a referência (três campos) ao createAbTest', () => {
    const rid = '123e4567-e89b-12d3-a456-426614174000'
    render(<NewTestClient {...base} initialVideoId="u1" tipoInicial="title" competitorContext={{ tipo: 'title', thumb: null, titulo: 'T', refVideoId: rid, refTroca: 'abc:1', canal: 'c', hrefOrigem: null, thumbSubstituta: null }} />)
    expect(JSON.parse(screen.getByTestId('wizard').getAttribute('data-ref')!)).toEqual({ refVideoId: rid, refTroca: 'abc:1', tipo: 'title' })
  })
  it('sem competitorContext não há referência', () => {
    render(<NewTestClient {...base} initialVideoId="u1" />)
    expect(JSON.parse(screen.getByTestId('wizard').getAttribute('data-ref')!)).toBeNull()
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

  describe('faixa de referência (T3)', () => {
    const thumb = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    const mont = (o: Partial<import('../src/app/cms/(authed)/youtube/ab-lab/new/client').CompetitorContext>) =>
      render(<NewTestClient {...base} initialVideoId="u1" competitorContext={ctx(o)} />)
    it('thumbnail com troca', () => {
      const { container } = mont({ tipo: 'thumbnail', thumb, titulo: 'Tit', canal: 'Fulano', refTroca: 'c1', hrefOrigem: '/o' })
      const img = container.querySelector('img')!
      expect(img.getAttribute('width')).toBe('96')
      expect(img.getAttribute('height')).toBe('54')
      expect(img.getAttribute('alt')).toBe('')
      expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
      expect(screen.getByText('Referência · Fulano trocou a thumbnail')).toBeTruthy()
      expect(screen.getByText('Tit').className).toContain('line-clamp-2')
      expect(screen.getByText('Referência, não modelo.')).toBeTruthy()
      expect(screen.getByText('Ver a troca').getAttribute('href')).toBe('/o')
      expect(screen.getByRole('button', { name: 'Recolher' }).getAttribute('aria-expanded')).toBe('true')
    })
    it('título: sem img, citado em font-serif', () => {
      const { container } = mont({ tipo: 'title', titulo: 'Meu título', canal: 'Fulano', refTroca: 'c1' })
      expect(container.querySelector('img')).toBeNull()
      expect(screen.getByText('Referência · Fulano trocou o título')).toBeTruthy()
      expect(screen.getByText('Meu título').className).toContain('font-serif')
    })
    it('sem refTroca (veio do menu)', () => {
      mont({ tipo: 'thumbnail', canal: 'Fulano', hrefOrigem: '/v' })
      expect(screen.getByText('Referência · thumbnail de Fulano')).toBeTruthy()
      expect(screen.getByText('Ver o vídeo').getAttribute('href')).toBe('/v')
      cleanup()
      mont({ tipo: 'title', canal: 'Fulano' })
      expect(screen.getByText('Referência · título de Fulano')).toBeTruthy()
    })
    it('canal nulo: "um concorrente" e sem link', () => {
      mont({ tipo: 'title', refTroca: 'c1', canal: null, hrefOrigem: null })
      expect(screen.getByText('Referência · um concorrente trocou o título')).toBeTruthy()
      expect(screen.queryByText('Ver a troca')).toBeNull()
    })
    it('recolher e reabrir mostra o mesmo conteúdo', () => {
      mont({ tipo: 'title', titulo: 'Meu título', canal: 'Fulano', refTroca: 'c1' })
      fireEvent.click(screen.getByRole('button', { name: 'Recolher' }))
      const b = screen.getByRole('button', { name: 'Mostrar referência' })
      expect(b.getAttribute('aria-expanded')).toBe('false')
      expect(screen.queryByText('Meu título')).toBeNull()
      expect(screen.getByText('Referência · Fulano trocou o título')).toBeTruthy()
      fireEvent.click(b)
      expect(screen.getByText('Meu título')).toBeTruthy()
    })
    it('erro da imagem (404 do Blob) tira o <img> quebrado', () => {
      const { container } = mont({ tipo: 'thumbnail', thumb, canal: 'Fulano' })
      fireEvent.error(container.querySelector('img')!)
      expect(container.querySelector('img')).toBeNull()
    })
    it.todo('sem imagem guardada: imagem substituta (thumbnail original + selo numérico) ou quadro neutro 96x54, depois do mockup ajustado (Logan/Naksu), decisão P1')
    it.todo('404 do Blob com thumbSubstituta cai na substituta; se a substituta falhar, quadro neutro')
  })
})
