// @vitest-environment jsdom
// T6: o cabeçalho do vídeo próprio desenha a entrada do A/B decidida pela página (a tela só desenha).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { proprioWorld } from './proprio-fixture'
import { ProprioVideoScreen } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-screen'
import { buildProprioVideoBase } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-model'
import { entradaDoProprio, FRASE_SEM_DADO, type EntradaProprio } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'
import type { TestesAbertos } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/testes-abertos'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/x', useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const W = proprioWorld()
const v0 = W.obs.videos.find(v => v.ch === W.canalId)!
const base = buildProprioVideoBase(W.obs, v0.id, {})!
const UUID = base.header.id
const ab = (a: Partial<Parameters<typeof entradaDoProprio>[0]> = {}): EntradaProprio | null =>
  entradaDoProprio({ podeEditar: true, videoUuid: UUID, dur: 600, abertos: null, semDado: null, ...a })
const tela = (e: EntradaProprio | null | undefined) =>
  render(<ProprioVideoScreen header={base.header} pager={base.pager} fromCanal={null} ab={e}><div /></ProprioVideoScreen>)
const link = (c: HTMLElement) => c.querySelector<HTMLAnchorElement>('.vp-a a[href*="/cms/youtube/ab-lab"]')
const aberto = (status: 'active' | 'draft'): TestesAbertos => ({
  acesso: 'ok',
  porVideo: { [UUID]: status === 'active'
    ? { href: '/cms/youtube/ab-lab/t1', rotulo: 'Ver teste', frase: 'Teste de thumbnail em andamento desde 10/10.', curto: 'em andamento' }
    : { href: '/cms/youtube/ab-lab', rotulo: 'Rascunho no A/B Lab', frase: 'Rascunho de teste aberto no A/B Lab desde 10/10.', curto: 'rascunho' } },
}) as unknown as TestesAbertos

describe('cabeçalho do vídeo próprio: entrada do A/B', () => {
  it('editor, com dado: link "Testar no A/B Lab", sem target', () => {
    const { container } = tela(ab())
    const a = link(container)!
    expect(a.textContent).toBe('Testar no A/B Lab')
    expect(a.getAttribute('href')).toBe(`/cms/youtube/ab-lab/new?videoId=${UUID}`)
    expect(a.hasAttribute('target')).toBe(false)
  })
  it('vídeo não medido (Q-a, padrão): o mesmo link', () => {
    expect(link(tela(ab({ semDado: null })).container)?.textContent).toBe('Testar no A/B Lab')
  })
  it('teste ativo: "Ver teste" e a frase', () => {
    const { container } = tela(ab({ abertos: aberto('active') }))
    expect(link(container)!.textContent).toBe('Ver teste')
    expect(link(container)!.getAttribute('href')).toBe('/cms/youtube/ab-lab/t1')
    expect(container.querySelector('.vp-ab-nota')!.textContent).toBe('Teste de thumbnail em andamento desde 10/10.')
  })
  it('rascunho: "Rascunho no A/B Lab" para a lista', () => {
    const { container } = tela(ab({ abertos: aberto('draft') }))
    expect(link(container)!.textContent).toBe('Rascunho no A/B Lab')
    expect(link(container)!.getAttribute('href')).toBe('/cms/youtube/ab-lab')
    expect(container.querySelector('.vp-ab-nota')!.textContent).toContain('Rascunho de teste aberto')
  })
  it.each(['restrito', 'falhou'] as const)('%s: sem link de A/B e a frase exata', (s) => {
    const { container } = tela(ab({ semDado: s }))
    expect(link(container)).toBeNull()
    expect(container.querySelector('.vp-ab-nota')!.textContent).toBe(FRASE_SEM_DADO[s])
  })
  it('Short (dur 45): nada', () => {
    const e = ab({ dur: 45 })
    expect(e).toBeNull()
    const { container } = tela(e)
    expect(link(container)).toBeNull()
    expect(container.querySelector('.vp-ab-nota')).toBeNull()
  })
  it('reporter (ab null) e sem prop: nem link nem frase', () => {
    for (const e of [null, undefined]) {
      const { container, unmount } = tela(e)
      expect(link(container)).toBeNull()
      expect(container.querySelector('.vp-ab-nota')).toBeNull()
      unmount()
    }
  })
})
