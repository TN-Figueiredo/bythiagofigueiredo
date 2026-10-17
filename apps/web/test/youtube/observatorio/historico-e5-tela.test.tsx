// @vitest-environment jsdom
// A5 · E5a, Tarefa 21c (mockup 13), a tela: a reserva do Suspense e o conteúdo são DUAS montagens de HistoricoScreen, e o foco de chegada é
// decidido uma vez só (correção 4 da Tarefa 21). Montamos a reserva e depois o conteúdo na MESMA árvore (um Suspense com uma promessa que o teste resolve).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Suspense, use, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import { buildHistoricoView, type HistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { buildCanalVideos } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { montarLista } from '@/app/cms/(authed)/youtube/competitors/_canal/lista'
import {
  VALE_DA_TROCA_MS, limparPagerUsado, marcarChegadaNaReserva, marcarPagerUsado, soltarChegadaDaReserva, tomarChegadaNaReserva,
} from '@/app/cms/(authed)/youtube/competitors/_historico/pager-usado'

const nav = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams('from=canais'),
}))
vi.mock('next/link', () => ({
  default: ({ href, replace, prefetch: _prefetch, onClick, children, ...rest }: { href: string; replace?: boolean; prefetch?: boolean; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} data-replace={replace ? 'true' : 'false'} onClick={e => { e.preventDefault(); onClick?.(e) }} {...rest}>{children}</a>
  ),
}))

const { obs, chId } = canalWorld()
const FULL = 'matt-opus55'
const thumb = obs.changes.find(c => c.video === FULL && c.type === 'thumb' && !c.window)!
const todos = buildCanalVideos(obs, chId).videos
const ids = montarLista(todos, { fmt: 'longos', sort: 'recentes', dir: 'desc', q: '', n: 0 }).visiveis
const janela = (i: number) => { const a = Math.max(0, Math.min(i - 50, ids.length - 100)); return ids.slice(a, a + 100) }
const viewDoPager = (i: number): HistoricoView => {
  const href = link.historico(ids[i]!, { from: 'canais', canal: chId, back: '?fmt=longos', ids: janela(i), pos: i + 1, tot: ids.length })
  return buildHistoricoView(obs, ids[i]!, Object.fromEntries(new URL(href, 'http://x').searchParams))
}
const viewDe = (p: Record<string, string | undefined> = {}, id = FULL) => buildHistoricoView(obs, id, p)

/** Monta dentro de um `act` assíncrono: o conteúdo suspende na montagem, e o React exige que o `act` seja esperado. */
async function montar(el: ReactNode) {
  await act(async () => { render(el) })
}

function porta() {
  let ok!: () => void
  const p = new Promise<void>(r => { ok = r })
  return { p, ok: async () => { await act(async () => { ok(); await p }) } }
}
function Conteudo({ p, view, erro, trilha }: { p: Promise<void>; view: HistoricoView; erro?: boolean; trilha?: boolean }) {
  use(p)
  return <HistoricoScreen view={view} erro={erro} pagerNaTrilha={trilha} />
}
function Arvore({ view, p, erro, trilha, onPin }: { view: HistoricoView; p: Promise<void>; erro?: boolean; trilha?: boolean; onPin?: () => Promise<never> }) {
  return (
    <ToastProvider>
      <div data-obs="">
        {trilha ? <div id="trilha"><a data-pager-prev href="#a">Anterior</a><a data-pager-next href="#b">Próximo</a><button id="fora" type="button">menu</button></div> : <button id="fora" type="button">menu</button>}
        <Suspense key={view.video!.id} fallback={<HistoricoScreen view={view} carregando pagerNaTrilha={trilha} onPin={onPin as never} />}>
          <Conteudo p={p} view={view} erro={erro} trilha={trilha} />
        </Suspense>
      </div>
    </ToastProvider>
  )
}
const raiz = () => document.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
const fixar = () => document.querySelector<HTMLElement>('[data-foco="fixar"] button')!
const titulo = () => raiz().querySelector<HTMLElement>('.vhead h2')!

beforeEach(() => { nav.replace.mockClear(); window.sessionStorage.clear(); limparPagerUsado() })
afterEach(() => { cleanup(); vi.useRealTimers(); document.getElementById('flut')?.remove() })

describe('a reserva é o HistoricoScreen com carregando', () => {
  it('o título e os botões são os de verdade, a frase "Carregando o histórico do vídeo." aparece uma vez e não há gráfico por dia', async () => {
    const view = viewDe()
    const g = porta()
    await montar(<Arvore view={view} p={g.p} />)
    expect(titulo().textContent).toBe(view.video!.title)
    expect(fixar()).not.toBeNull()
    expect(document.body.textContent!.split('Carregando o histórico do vídeo.').length - 1).toBe(1)
    expect(raiz().querySelector('.timeline')).toBeNull()
    expect(raiz().querySelector('[data-esqueleto="historico"]')).not.toBeNull()
  })

  it('botões de ação em aria-disabled durante o carregando: o clique não chama a ação, e o pager navega', () => {
    const view = viewDoPager(5)
    const onPin = vi.fn()
    render(<ToastProvider><HistoricoScreen view={view} carregando onPin={onPin as never} /></ToastProvider>)
    const botoes = [...raiz().querySelectorAll<HTMLElement>('.actions button')]
    expect(botoes.length).toBeGreaterThan(0)
    for (const b of botoes) {
      expect(b.getAttribute('aria-disabled')).toBe('true')
      expect(b.getAttribute('aria-describedby')).toBe('hv-carregando')
    }
    fireEvent.click(botoes[0]!)
    expect(onPin).not.toHaveBeenCalled()
    const prox = raiz().querySelector<HTMLAnchorElement>('[data-pager-next]')!
    expect(prox.hasAttribute('aria-disabled')).toBe(false)
    fireEvent.click(prox)
    expect(prox.getAttribute('href')).toContain('/video/')
  })
})

describe('foco entre a reserva e o conteúdo (correção 4)', () => {
  it('foco posto pela pessoa durante o carregando não é tirado quando os blocos chegam', async () => {
    const g = porta()
    await montar(<Arvore view={viewDe()} p={g.p} />)
    fixar().focus()
    const antes = fixar()
    await g.ok()
    expect(fixar()).not.toBe(antes)                        // a árvore foi trocada
    expect(document.activeElement).toBe(fixar())
    expect(document.activeElement).not.toBe(titulo())
    expect(document.activeElement).not.toBe(document.body)
  })

  it('pager: o botão usado continua com o foco depois que os blocos chegam (recriado, dentro da tela), e o status é lido uma vez', async () => {
    marcarPagerUsado('next', ids[6]!)
    const g = porta()
    await montar(<Arvore view={viewDoPager(6)} p={g.p} />)
    expect(document.activeElement).toBe(raiz().querySelector('[data-pager-next]'))
    expect(raiz().querySelector('#hv-live')!.textContent).toBe(viewDoPager(6).pager!.status)
    await g.ok()
    expect(document.activeElement).toBe(raiz().querySelector('[data-pager-next]'))
    expect(raiz().querySelector('#hv-live')!.textContent).toBe('')   // o conteúdo não lê de novo
  })

  it('pager na trilha (o nó sobrevive): o botão usado mantém o foco e o status é lido uma vez', async () => {
    marcarPagerUsado('next', ids[6]!)
    const g = porta()
    await montar(<Arvore view={viewDoPager(6)} p={g.p} trilha />)
    const botao = document.querySelector<HTMLElement>('#trilha [data-pager-next]')!
    expect(document.activeElement).toBe(botao)
    await g.ok()
    expect(document.activeElement).toBe(botao)
    expect(raiz().querySelector('#hv-live')!.textContent).toBe('')
  })

  it('chegada por mudança: o marcador recebe o foco quando o gráfico chega, uma vez, e só se a pessoa não mexeu no foco', async () => {
    const g = porta()
    const view = viewDe({ troca: thumb.id })
    expect(view.arrival).not.toBeNull()
    await montar(<Arvore view={view} p={g.p} />)
    expect(document.activeElement).toBe(titulo())            // a reserva não tem o marcador: o título
    await g.ok()
    expect(document.activeElement).toBe(raiz().querySelector('[data-arrival]'))
    expect(raiz().querySelector('#hv-live')!.textContent).toBe(view.arrival!.status)
  })

  it('chegada por mudança, mas a pessoa pôs o foco em "Fixar vídeo": o marcador não rouba o foco', async () => {
    const g = porta()
    await montar(<Arvore view={viewDe({ troca: thumb.id })} p={g.p} />)
    fixar().focus()
    await g.ok()
    expect(document.activeElement).toBe(fixar())
    expect(document.activeElement).not.toBe(raiz().querySelector('[data-arrival]'))
  })

  it('foco fora da tela durante o carregando: ninguém toca', async () => {
    const g = porta()
    await montar(<Arvore view={viewDe()} p={g.p} />)
    const fora = document.getElementById('fora')!
    fora.focus()
    await g.ok()
    expect(document.activeElement).toBe(fora)
  })

  it('saiu com a reserva na tela e voltou ao mesmo vídeo sem reserva, depois de VALE_DA_TROCA_MS: chegada nova, o título recebe o foco', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const view = viewDe()
    const a = render(<ToastProvider><HistoricoScreen view={view} carregando /></ToastProvider>)
    fixar().focus()
    a.unmount()
    vi.setSystemTime(Date.now() + VALE_DA_TROCA_MS + 1)
    render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
    expect(document.activeElement).toBe(titulo())
  })

  it('dentro de VALE_DA_TROCA_MS a marca ainda vale: a troca devolve o foco ao controle equivalente', () => {
    const view = viewDe()
    const a = render(<ToastProvider><HistoricoScreen view={view} carregando /></ToastProvider>)
    fixar().focus()
    a.unmount()
    render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
    expect(document.activeElement).toBe(fixar())
  })

  it('a marca do vídeo anterior não vale para o vídeo novo', () => {
    marcarChegadaNaReserva('outro-video', 'fixar')
    render(<ToastProvider><HistoricoScreen view={viewDe()} /></ToastProvider>)
    expect(document.activeElement).toBe(titulo())
    expect(tomarChegadaNaReserva('outro-video')).toBeNull()   // foi apagada pela leitura de outro vídeo
  })

  it('conteúdo que monta sem reserva nenhuma: igual a hoje (o título recebe o foco)', () => {
    render(<ToastProvider><HistoricoScreen view={viewDe()} /></ToastProvider>)
    expect(document.activeElement).toBe(titulo())
  })

  it('controle da reserva sem equivalente na árvore nova: o foco vai para o título, nunca fica no body', () => {
    const view = viewDe()
    marcarChegadaNaReserva(view.video!.id, 'controle-que-nao-existe')
    render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
    expect(document.activeElement).toBe(titulo())
    expect(document.activeElement).not.toBe(document.body)
  })

  it('o conjunto falhou depois da reserva: o foco vai para o título do erro e a marca é consumida', async () => {
    const g = porta()
    const view = viewDe()
    await montar(<Arvore view={view} p={g.p} erro />)
    fixar().focus()
    await g.ok()
    expect(document.activeElement).toBe(raiz().querySelector('[data-erro-titulo]'))
    expect(raiz().querySelector('[data-erro-titulo]')!.textContent).toBe('Não deu para abrir o histórico deste vídeo')
    expect(tomarChegadaNaReserva(view.video!.id)).toBeNull()
  })

  it('o erro sem reserva tira da tela só o que depende das medidas: o aviso, "Tentar de novo" e o bloco de o que dá para ver', () => {
    render(<ToastProvider><HistoricoScreen view={viewDe()} erro /></ToastProvider>)
    const t = raiz().textContent!
    expect(t).toContain('O servidor não respondeu. Tente de novo; se continuar assim, avise.')
    expect(t).toContain('O que dá para ver enquanto isso')
    expect(raiz().querySelector<HTMLAnchorElement>('a.btn.pri')!.textContent).toBe('Tentar de novo')
    expect(raiz().querySelector('.timeline')).toBeNull()
  })

  it('marca da reserva: lê e apaga; depois de soltar vale só por VALE_DA_TROCA_MS', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    marcarChegadaNaReserva('v', 'titulo')
    expect(tomarChegadaNaReserva('v')).toEqual({ foco: 'titulo' })
    expect(tomarChegadaNaReserva('v')).toBeNull()
    marcarChegadaNaReserva('v', 'fixar')
    soltarChegadaDaReserva('v')
    vi.setSystemTime(Date.now() + VALE_DA_TROCA_MS - 1)
    expect(tomarChegadaNaReserva('v')).toEqual({ foco: 'fixar' })
    marcarChegadaNaReserva('v', 'fixar')
    soltarChegadaDaReserva('v')
    vi.setSystemTime(Date.now() + VALE_DA_TROCA_MS + 1)
    expect(tomarChegadaNaReserva('v')).toBeNull()
  })
})

describe('o cabeçalho do vídeo que saiu do YouTube', () => {
  const saiu = (linkSaiu: { href: string } | null) => ({
    pastilhas: [{ tipo: 'saiu' as const, texto: 'saiu do YouTube em 10/10', mantido: false }],
    abrirNoYoutube: false, semLink: 'Sem link: o vídeo não está mais no YouTube',
    botaoDaFila: linkSaiu ? { texto: 'Responder em “Saíram do YouTube”', href: linkSaiu.href } : null,
  })
  it('sem "Abrir no YouTube", com "Sem link…", e o botão da fila só com link.saiu', () => {
    const a = render(<ToastProvider><HistoricoScreen view={viewDe()} cabecalhoDoSaiu={saiu(null)} /></ToastProvider>)
    expect(raiz().textContent).not.toContain('Abrir no YouTube')
    expect(raiz().textContent).toContain('Sem link: o vídeo não está mais no YouTube')
    expect(raiz().textContent).toContain('saiu do YouTube em 10/10')
    expect(raiz().textContent).not.toContain('Saíram do YouTube')
    a.unmount()
    render(<ToastProvider><HistoricoScreen view={viewDe()} cabecalhoDoSaiu={saiu({ href: '/cms/youtube/competitors/saiu' })} /></ToastProvider>)
    expect(raiz().querySelector<HTMLAnchorElement>('a[href="/cms/youtube/competitors/saiu"]')!.textContent).toContain('Saíram do YouTube')
  })
})
