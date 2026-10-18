// @vitest-environment jsdom
// T9a: "Testar uma ideia no meu canal" nas trocas do Histórico (modelo real do Histórico, fixture matt-opus55: thumbnails A, B, A (voltou), C).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { abRefDaTroca, FRASE_SEM_IMAGEM, valorAbEntradas } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'
import { refTrocaValida } from '@/lib/youtube/ab-referencia'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams('from=canais'),
}))
vi.mock('next/link', () => ({
  default: ({ href, replace: _r, prefetch: _p, onClick, children, ...rest }: { href: string; replace?: boolean; prefetch?: boolean; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} onClick={e => { e.preventDefault(); onClick?.(e) }} {...rest}>{children}</a>
  ),
}))
beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/video/x?from=canais') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

const FULL = 'matt-opus55'
const BLOB = (i: number) => `https://x.public.blob.vercel-storage.com/observatorio/thumbs/${FULL}/${i}.jpg`
const mundo = (blob: (i: number) => string | null = BLOB) => canalWorld(ds => { ds.videos.find(x => x.id === FULL)!.thumbs.forEach((t, i) => { t.blobUrl = blob(i) }) }).obs
const EDITOR = valorAbEntradas({ podeEditar: true, abertos: null })
function montar(obs: ReturnType<typeof mundo>, valor: typeof EDITOR) {
  const view = buildHistoricoView(obs, FULL, {})
  const r = render(<ToastProvider><AbEntradasProvider valor={valor}><HistoricoScreen view={view} /></AbEntradasProvider></ToastProvider>)
  const escolhe = (k: string) => { fireEvent.click(r.container.querySelector<HTMLElement>(`.pair[data-k="${k}"]`)!) }
  const botao = () => r.container.querySelector<HTMLAnchorElement>('.hv-ab a')
  const sem = () => r.container.querySelector('.hv-ab-sem')
  return { ...r, view, escolhe, botao, sem }
}
const q = (a: HTMLAnchorElement) => new URL(a.getAttribute('href')!, 'https://x').searchParams

describe('abRefDaTroca (modelo)', () => {
  const base = { tipo: 'thumbnail' as const, own: false, thumbDepois: BLOB(1), tituloDepois: 'Novo', tituloDoVideo: 'Meu vídeo', refVideoId: FULL, refTroca: 'x/thumb/1' }
  it('thumb com imagem → testar com o título do vídeo; sem imagem → frase', () => {
    const r = abRefDaTroca(base)
    expect(r?.tipo).toBe('testar')
    const p = new URL((r as { href: string }).href, 'https://x').searchParams
    expect(p.get('changeType')).toBe('thumbnail'); expect(p.get('competitorThumb')).toBe(BLOB(1)); expect(p.get('competitorTitle')).toBe('Meu vídeo'); expect(p.get('refTroca')).toBe('x/thumb/1')
    expect(abRefDaTroca({ ...base, thumbDepois: null })).toEqual({ tipo: 'sem-imagem', frase: FRASE_SEM_IMAGEM })
    expect(abRefDaTroca({ ...base, thumbDepois: 'https://evil.com/a.jpg' })).toEqual({ tipo: 'sem-imagem', frase: FRASE_SEM_IMAGEM })
  })
  it('título → testar com tituloDepois; own e descrição → null', () => {
    const r = abRefDaTroca({ ...base, tipo: 'title', thumbDepois: null })
    expect(new URL((r as { href: string }).href, 'https://x').searchParams.get('competitorTitle')).toBe('Novo')
    expect(abRefDaTroca({ ...base, own: true })).toBeNull()
    expect(abRefDaTroca({ ...base, tipo: null })).toBeNull()
    expect(abRefDaTroca({ ...base, tipo: 'title', tituloDepois: null })).toBeNull()
  })
  it('título com & # ? emoji e aspas chega inteiro', () => {
    const t = 'A & B # C ? "D" 🔥'
    const r = abRefDaTroca({ ...base, tipo: 'title', tituloDepois: t })
    expect(new URL((r as { href: string }).href, 'https://x').searchParams.get('competitorTitle')).toBe(t)
  })
})

describe('Histórico: entrada nas trocas de concorrente', () => {
  it('thumb com imagem Blob: botão com o href decodificado (refTroca = changeId, competitorThumb, refVideoId)', () => {
    const m = montar(mundo(), EDITOR)
    m.escolhe(`${FULL}/thumb/1`)
    const a = m.botao()!
    expect(a.textContent).toBe('Testar uma ideia no meu canal')
    expect(a.hasAttribute('target')).toBe(false)
    const p = q(a)
    expect(p.get('refTroca')).toBe(`${FULL}/thumb/1`)
    expect(p.get('refVideoId')).toBe(FULL)
    expect(p.get('changeType')).toBe('thumbnail')
    expect(p.get('ref')).toBe('competitor')
  })
  it('A→B→A: a referência é a imagem de B (a troca), nunca a restaurada (A) nem a atual (C)', () => {
    const m = montar(mundo(), EDITOR)
    m.escolhe(`${FULL}/thumb/1`)
    expect(q(m.botao()!).get('competitorThumb')).toBe(BLOB(1))
    expect(q(m.botao()!).get('competitorThumb')).not.toBe(BLOB(2))
    expect(q(m.botao()!).get('competitorThumb')).not.toBe(BLOB(3))
  })
  it('thumb sem imagem guardada: a frase, sem botão', () => {
    const m = montar(mundo(i => (i === 1 ? null : BLOB(i))), EDITOR)
    m.escolhe(`${FULL}/thumb/1`)
    expect(m.botao()).toBeNull()
    expect(m.sem()!.textContent).toBe(FRASE_SEM_IMAGEM)
  })
  it('título: botão com o título DEPOIS da troca; troca de título + thumb na mesma janela segue o campo da primeira', () => {
    const m = montar(mundo(), EDITOR)
    m.escolhe(`${FULL}/title/1`)
    expect(q(m.botao()!).get('changeType')).toBe('title')
    expect(q(m.botao()!).get('competitorTitle')).toBe(m.view.comparisons.find(c => c.changeId === `${FULL}/title/1`)!.depoisTitulo)
    m.escolhe(`${FULL}/title/2`)
    expect(q(m.botao()!).get('changeType')).toBe('title')
  })
  it('descrição: nada', () => {
    const m = montar(mundo(), EDITOR)
    m.escolhe(`${FULL}/desc/1`)
    expect(m.botao()).toBeNull(); expect(m.sem()).toBeNull()
  })
  it('troca ainda "aguardando" (não medida) mantém o botão (decisão 2 do dono)', () => {
    const m = montar(mundo(), EDITOR)
    m.escolhe(`${FULL}/title/2`)
    expect(m.view.comparisons.find(c => c.changeId === `${FULL}/title/2`)!.effect.status).toBe('aguardando')
    expect(m.botao()).not.toBeNull()
  })
  it('reporter (provedor null) e sem provedor: nada', () => {
    for (const valor of [null]) {
      const m = montar(mundo(), valor)
      m.escolhe(`${FULL}/thumb/1`)
      expect(m.botao()).toBeNull(); expect(m.sem()).toBeNull()
      m.unmount()
    }
    const obs = mundo()
    const r = render(<ToastProvider><HistoricoScreen view={buildHistoricoView(obs, FULL, {})} /></ToastProvider>)
    fireEvent.click(r.container.querySelector<HTMLElement>(`.pair[data-k="${FULL}/thumb/1"]`)!)
    expect(r.container.querySelector('.hv-ab, .hv-ab-sem')).toBeNull()
  })
  it('o id de troca REAL do fixture passa na regra de refTroca', () => {
    for (const c of buildHistoricoView(mundo(), FULL, {}).comparisons) expect(refTrocaValida(c.changeId), c.changeId).toBe(c.changeId)
  })
})
