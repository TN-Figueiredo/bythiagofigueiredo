// @vitest-environment jsdom
// T10: "Testar uma ideia no meu canal" nos cartões de Mudanças (modelo real, fixture matt-opus55: thumbnails A, B, A (voltou), C).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildMudancasView, type Hero } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { VideoGroup } from '@/app/cms/(authed)/youtube/competitors/_mudancas/change-hero'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { FRASE_SEM_IMAGEM, valorAbEntradas } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/mudancas', useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({ default: ({ href, children, prefetch: _p, ...r }: { href: string; children?: ReactNode; prefetch?: boolean } & Record<string, unknown>) => <a href={href} {...r}>{children}</a> }))
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const V = 'matt-opus55'
const BLOB = (i: number) => `https://x.public.blob.vercel-storage.com/observatorio/thumbs/${V}/${i}.jpg`
const mundo = (blob: (i: number) => string | null = BLOB, mut?: (ds: Dataset) => void) => canalWorld(ds => { ds.videos.find(x => x.id === V)!.thumbs.forEach((t, i) => { t.blobUrl = blob(i) }); mut?.(ds) }).obs
const EDITOR = valorAbEntradas({ podeEditar: true, abertos: null })
const heroes = (obs: ReturnType<typeof mundo>): Hero[] => buildMudancasView(obs, {}, new Set()).heroes.filter(h => h.video.id === V)
const hero = (hs: Hero[], id: string) => hs.find(h => h.id === `${V}/${id}`)!
const swipeOf = () => ({ saved: false, label: 'Salvar', busy: false, disabled: false })
function grupo(hs: Hero[], valor: typeof EDITOR) {
  const r = render(<ToastProvider><div data-obs=""><AbEntradasProvider valor={valor}><VideoGroup heroes={hs} swipeOf={swipeOf} onSwipe={() => {}} /></AbEntradasProvider></div></ToastProvider>)
  return { ...r, botao: () => r.container.querySelector<HTMLAnchorElement>('.acts a[href*="/ab-lab/new"]'), sem: () => r.container.querySelector('.fx-ab-sem') }
}
const q = (a: Element) => new URL(a.getAttribute('href')!, 'https://x').searchParams

describe('cartões de Mudanças: entrada do A/B', () => {
  it('Hero.video.own vem do canal, explícito', () => {
    const h = hero(heroes(mundo()), 'thumb/1')
    expect(h.video.own).toBe(false)
    expect(heroes(mundo()).every(x => x.video.own === false)).toBe(true)
  })
  it('thumb: botão ao lado de "Ver histórico do vídeo" com o "Depois" da PRÓPRIA troca e refTroca = id da troca', () => {
    const hs = heroes(mundo())
    const g = grupo([hero(hs, 'thumb/1')], EDITOR)
    const a = g.botao()!
    expect(a.textContent).toBe('Testar uma ideia no meu canal')
    expect(a.hasAttribute('target')).toBe(false)
    const p = q(a)
    expect([p.get('changeType'), p.get('competitorThumb'), p.get('refTroca'), p.get('refVideoId')]).toEqual(['thumbnail', BLOB(1), `${V}/thumb/1`, V])
    expect(a.parentElement!.querySelector('a[aria-label^="Ver histórico do vídeo"]')).not.toBeNull()
  })
  it('A→B→A: com a troca B→A (restaurada) e A→B no cartão, a referência é a de B, nunca a restaurada nem a atual', () => {
    const hs = heroes(mundo())
    const g = grupo([hero(hs, 'thumb/2'), hero(hs, 'thumb/1')], EDITOR)
    expect(q(g.botao()!).get('competitorThumb')).toBe(BLOB(1))
    expect(q(g.botao()!).get('refTroca')).toBe(`${V}/thumb/1`)
  })
  it('título: botão com o título DEPOIS da troca', () => {
    const hs = heroes(mundo())
    const g = grupo([hero(hs, 'title/1')], EDITOR)
    expect([q(g.botao()!).get('changeType'), q(g.botao()!).get('competitorTitle')]).toEqual(['title', hero(hs, 'title/1').title!.afterText])
  })
  it('thumb sem imagem arquivada: a frase e nenhum botão', () => {
    const hs = heroes(mundo(i => (i === 1 ? null : BLOB(i))))
    const g = grupo([hero(hs, 'thumb/1')], EDITOR)
    expect(g.botao()).toBeNull()
    expect(g.sem()!.textContent).toBe(FRASE_SEM_IMAGEM)
  })
  it('cartão com thumb sem imagem e título: o botão do título vence a frase "sem imagem" (Yannis M1)', () => {
    const hs = heroes(mundo(i => (i === 1 ? null : BLOB(i))))
    const g = grupo([hero(hs, 'thumb/1'), hero(hs, 'title/1')], EDITOR)
    expect(q(g.botao()!).get('changeType')).toBe('title')
    expect(g.sem()).toBeNull()
  })
  it('descrição: nada', () => {
    const g = grupo([hero(heroes(mundo()), 'desc/1')], EDITOR)
    expect(g.botao()).toBeNull(); expect(g.sem()).toBeNull()
  })
  it('vídeo de canal próprio (Hero.video.own): nada', () => {
    const h = hero(heroes(mundo()), 'thumb/1')
    const g = grupo([{ ...h, video: { ...h.video, own: true } }], EDITOR)
    expect(g.botao()).toBeNull(); expect(g.sem()).toBeNull()
  })
  it('reporter (provedor null): nada; sem provedor: nada', () => {
    const h = hero(heroes(mundo()), 'thumb/1')
    const g = grupo([h], null)
    expect(g.botao()).toBeNull(); expect(g.sem()).toBeNull()
    g.unmount()
    const r = render(<ToastProvider><div data-obs=""><VideoGroup heroes={[h]} swipeOf={swipeOf} onSwipe={() => {}} /></div></ToastProvider>)
    expect(r.container.querySelector('a[href*="/ab-lab/new"], .fx-ab-sem')).toBeNull()
  })
  it('troca ainda "aguardando" (não medida) mantém o botão (decisão 2 do dono)', () => {
    const h = hero(heroes(mundo()), 'title/2')
    expect(h.effect.status).toBe('aguardando')
    expect(grupo([h], EDITOR).botao()).not.toBeNull()
  })
})
