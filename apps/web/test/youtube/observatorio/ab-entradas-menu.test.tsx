// @vitest-environment jsdom
// T8: itens do A/B no menu ⋯ (próprio e concorrente), com o modelo e a tela de verdade (sem mock do modelo).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { proprioWorld } from './proprio-fixture'
import { viewDe } from './proprio-mount'
import { canalWorld } from './canal-fixture'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import type { ChannelVideoView } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import type { ProprioVideoView } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { VideoMenu } from '@/app/cms/(authed)/youtube/competitors/_canal/video-menu'
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { itensDoMenu, valorAbEntradas } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'
import type { TestesAbertos } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/testes-abertos'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/x', useSearchParams: () => new URLSearchParams(''),
}))
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const W = proprioWorld()
const proprio: ProprioVideoView = viewDe(W).videos.videos.find(v => v.dur == null || v.dur > 60) as ProprioVideoView
const conc: ChannelVideoView = (() => { const { obs, chId } = canalWorld(); return buildCanalView(obs, chId, {})!.videos.videos[0]! })()
const EDITOR = valorAbEntradas({ podeEditar: true, abertos: { acesso: 'ok', porVideo: {} } })
const comAberto = (v: ProprioVideoView, rotulo: string, curto: string, href: string): ReturnType<typeof valorAbEntradas> =>
  valorAbEntradas({ podeEditar: true, abertos: { acesso: 'ok', porVideo: { [v.id]: { href, rotulo, frase: 'f', curto } } } as unknown as TestesAbertos })
const abrir = (v: ChannelVideoView, valor: ReturnType<typeof valorAbEntradas>) => {
  render(<AbEntradasProvider valor={valor}><div data-obs=""><VideoMenu v={v} onAmpliar={vi.fn()} onTrocas={vi.fn()} /></div></AbEntradasProvider>)
  fireEvent.click(screen.getByRole('button', { name: /Ações do vídeo/ }))
  return screen.getByRole('menu')
}
const abHrefs = (m: HTMLElement) => [...m.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"][href*="/cms/youtube/ab-lab"]')]

describe('itensDoMenu (modelo)', () => {
  it('ab nulo (reporter, fora do provedor) → []', () => {
    expect(itensDoMenu(proprio, null)).toEqual([])
    expect(itensDoMenu(conc, null)).toEqual([])
    expect(valorAbEntradas({ podeEditar: false, abertos: null })).toBeNull()
  })
  it('próprio com dado: "Testar no A/B Lab" com o uuid', () => {
    expect(itensDoMenu(proprio, EDITOR)).toEqual([{ rotulo: 'Testar no A/B Lab', href: `/cms/youtube/ab-lab/new?videoId=${proprio.id}` }])
  })
  it('próprio com "não medido" ou zero medido (Q-a, P3): o item aparece', () => {
    expect(itensDoMenu({ ...proprio, impEstado: 'nao_medido' }, EDITOR)).toHaveLength(1)
    expect(itensDoMenu({ ...proprio, impEstado: null, imp: null }, EDITOR)).toHaveLength(1)
  })
  it('próprio restrito/falhou: nenhum item', () => {
    expect(itensDoMenu({ ...proprio, impEstado: 'restrito' }, EDITOR)).toEqual([])
    expect(itensDoMenu({ ...proprio, impEstado: 'falhou' }, EDITOR)).toEqual([])
  })
  it('Short: nenhum item', () => {
    expect(itensDoMenu({ ...proprio, dur: 45 }, EDITOR)).toEqual([])
  })
  it('próprio com teste ativo e com rascunho', () => {
    expect(itensDoMenu(proprio, comAberto(proprio, 'Ver teste', 'em andamento', '/cms/youtube/ab-lab/t1'))).toEqual([{ rotulo: 'Ver teste', href: '/cms/youtube/ab-lab/t1', curto: 'em andamento' }])
    expect(itensDoMenu(proprio, comAberto(proprio, 'Rascunho no A/B Lab', 'rascunho', '/cms/youtube/ab-lab'))).toEqual([{ rotulo: 'Rascunho no A/B Lab', href: '/cms/youtube/ab-lab', curto: 'rascunho' }])
  })
  it('concorrente com thumb do Blob: dois itens; refVideoId = v.id e a thumb chega a competitorThumb (Phil R2)', () => {
    const thumb = `https://x.public.blob.vercel-storage.com/observatorio/thumbs/${conc.id}/x.jpg`
    const itens = itensDoMenu({ ...conc, thumbSrc: thumb }, EDITOR)
    expect(itens.map(i => i.rotulo)).toEqual(['Testar uma ideia a partir desta thumbnail', 'Testar uma ideia a partir deste título'])
    const q = new URL(itens[0]!.href, 'https://x').searchParams
    expect(q.get('competitorThumb')).toBe(thumb)
    expect(q.get('refVideoId')).toBe(conc.id)
    expect(q.get('changeType')).toBe('thumbnail')
    expect(q.get('refTroca')).toBeNull()
    const t = new URL(itens[1]!.href, 'https://x').searchParams
    expect(t.get('changeType')).toBe('title')
    expect(t.get('competitorTitle')).toBe(conc.title)
  })
  it('concorrente sem thumbSrc ou com host não permitido: só o do título', () => {
    expect(itensDoMenu({ ...conc, thumbSrc: null }, EDITOR).map(i => i.rotulo)).toEqual(['Testar uma ideia a partir deste título'])
    expect(itensDoMenu({ ...conc, thumbSrc: 'https://evil.com/a.jpg' }, EDITOR).map(i => i.rotulo)).toEqual(['Testar uma ideia a partir deste título'])
  })
})

describe('menu ⋯ (tela)', () => {
  it('próprio com dado: item depois de um <hr>, <a> sem target, setas percorrem o item novo', () => {
    const m = abrir(proprio, EDITOR)
    const [a] = abHrefs(m)
    expect(a!.textContent).toBe('Testar no A/B Lab')
    expect(a!.hasAttribute('target')).toBe(false)
    expect(m.querySelectorAll('hr')).toHaveLength(1)
    expect(a!.previousElementSibling!.tagName).toBe('HR')
    const itens = [...m.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    itens[itens.length - 2]!.focus()
    fireEvent.keyDown(itens[itens.length - 2]!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(a)
  })
  it('teste ativo: "Ver teste" com <small>em andamento</small>; rascunho: <small>rascunho</small> para a lista', () => {
    let m = abrir(proprio, comAberto(proprio, 'Ver teste', 'em andamento', '/cms/youtube/ab-lab/t1'))
    expect(abHrefs(m)[0]!.querySelector('small')!.textContent).toBe('em andamento')
    expect(abHrefs(m)[0]!.querySelector('span')!.textContent).toBe('Ver teste')
    cleanup(); document.getElementById('flut')?.remove()
    m = abrir(proprio, comAberto(proprio, 'Rascunho no A/B Lab', 'rascunho', '/cms/youtube/ab-lab'))
    expect(abHrefs(m)[0]!.getAttribute('href')).toBe('/cms/youtube/ab-lab')
    expect(abHrefs(m)[0]!.querySelector('small')!.textContent).toBe('rascunho')
  })
  it.each(['restrito', 'falhou'] as const)('impEstado %s: sem item e sem <hr>', (s) => {
    const m = abrir({ ...proprio, impEstado: s }, EDITOR)
    expect(abHrefs(m)).toHaveLength(0)
    expect(m.querySelector('hr')).toBeNull()
  })
  it('reporter (valor null) e Short: nenhum item e nenhum <hr>', () => {
    expect(abHrefs(abrir(proprio, null))).toHaveLength(0)
    cleanup(); document.getElementById('flut')?.remove()
    const m = abrir({ ...proprio, dur: 45 }, EDITOR)
    expect(abHrefs(m)).toHaveLength(0)
    expect(m.querySelector('hr')).toBeNull()
  })
  it('concorrente: os itens da ideia aparecem para o editor', () => {
    const m = abrir(conc, EDITOR)
    expect(abHrefs(m).map(a => a.textContent).some(t => /deste título/.test(t ?? ''))).toBe(true)
  })
})
