// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import type { PaginaDoCanal } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import type { AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { VideosDoCanal } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/videos-do-canal'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))

const AGORA = new Date('2026-10-22T15:00:00.000Z')
const dia = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const ID = (n: number): string => `vid${String(n).padStart(8, '0')}`
function linha(n: number, o: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho {
  return {
    videoId: `uuid-${n}`, ytId: ID(n), titulo: `Vídeo ${n}`, miniaturaUrl: null, publicadoEm: dia(3 + n),
    estado: 'sugerido_youtube', caminho: { tipo: 'nativo', portao: true, motivo: 'x' },
    fichaId: null, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300, ...o,
  }
}
const pag = (linhas: LinhaDoCaminho[], o: Partial<PaginaDoCanal> = {}): PaginaDoCanal => ({
  linhas, contagem: { testaveis: 31, semVolume: 4, naoLido: 0, total: 35, motivoNaoLido: null },
  totalDoFiltro: 31, temMais: true, truncado: false, filtroEfetivo: 'testaveis', ...o,
})
const acoes = { jaIniciei: vi.fn(), lembrarNoComputador: vi.fn() } as unknown as AcoesCaminho
type Pedido = Parameters<React.ComponentProps<typeof VideosDoCanal>['ler']>[0]
const ler = vi.fn(async (_p: Pedido) => ({ ok: true as const, pagina: pag([]) }))
const lote = (de: number, ate: number): LinhaDoCaminho[] => Array.from({ length: ate - de }, (_, i) => linha(de + i))

function montar(inicial = pag(lote(0, 20)), videoInicial: string | null = null) {
  const r = render(<VideosDoCanal inicial={inicial} videoInicial={videoInicial} acoes={acoes} ler={ler} />)
  return { ...r, de: (i: PaginaDoCanal, v: string | null = videoInicial) => r.rerender(<VideosDoCanal inicial={i} videoInicial={v} acoes={acoes} ler={ler} />) }
}
const caixa = (): HTMLInputElement => screen.getByRole('searchbox', { name: 'Buscar vídeo' }) as HTMLInputElement
const digitar = (v: string): void => { fireEvent.change(caixa(), { target: { value: v } }) }
const passa = async (ms: number): Promise<void> => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

beforeEach(() => { vi.useFakeTimers(); ler.mockReset(); ler.mockImplementation(async () => ({ ok: true as const, pagina: pag([]) })); window.history.replaceState(null, '', '/cms/youtube/ab-lab') })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('VideosDoCanal (M7 T10)', () => {
  it('começa recolhido; com ?video= começa aberto', () => {
    const { container } = montar()
    expect((container.querySelector('details') as HTMLDetailsElement).open).toBe(false)
    cleanup()
    const b = montar(pag(lote(0, 20)), ID(3))
    expect((b.container.querySelector('details') as HTMLDetailsElement).open).toBe(true)
  })
  it('resumo com testáveis e sem volume; ", n sem volume lido" e "(dos 2.000 mais recentes)" só quando valem', () => {
    montar(pag(lote(0, 20), { contagem: { testaveis: 31, semVolume: 4, naoLido: 7, total: 42, motivoNaoLido: null }, truncado: true }))
    expect(screen.getByText('31 com volume para testar, 4 sem, 7 sem volume lido (dos 2.000 mais recentes)')).toBeTruthy()
    expect(screen.getByText('A busca procura só nos 2.000 vídeos mais recentes.')).toBeTruthy()
  })
  it('digitar espera 350 ms e chama ler uma vez; menos de 2 letras não chama', async () => {
    montar()
    digitar('a'); await passa(500)
    expect(ler).not.toHaveBeenCalled()
    digitar('ag'); await passa(200); digitar('agu'); await passa(349)
    expect(ler).not.toHaveBeenCalled()
    await passa(2)
    expect(ler).toHaveBeenCalledTimes(1)
    expect(ler).toHaveBeenCalledWith({ busca: 'agu', filtro: 'testaveis', pagina: 0, incluirYtId: null })
  })
  it('resposta antiga que chega depois da nova é descartada', async () => {
    const soltas: Array<(p: PaginaDoCanal) => void> = []
    ler.mockImplementation(() => new Promise(r => { soltas.push(p => r({ ok: true, pagina: p })) }))
    montar()
    digitar('ag'); await passa(351)
    digitar('agu'); await passa(351)
    expect(ler).toHaveBeenCalledTimes(2)
    soltas[1]!(pag([linha(90, { titulo: 'Água nova' })], { totalDoFiltro: 1, temMais: false }))
    await passa(0)
    soltas[0]!(pag([linha(91, { titulo: 'Água velha' })], { totalDoFiltro: 1, temMais: false }))
    await passa(0)
    expect(screen.getByText('Água nova')).toBeTruthy()
    expect(screen.queryByText('Água velha')).toBeNull()
  })
  it('"ag" → resposta → apagar para "a": ler é chamado com busca null e a lista volta à inicial; "ag" ainda em voo é descartado', async () => {
    montar()
    ler.mockImplementationOnce(async () => ({ ok: true as const, pagina: pag([linha(90, { titulo: 'Só água' })], { totalDoFiltro: 1, temMais: false }) }))
    digitar('ag'); await passa(351)
    expect(screen.getByText('Só água')).toBeTruthy()
    ler.mockImplementationOnce(async () => ({ ok: true as const, pagina: pag(lote(0, 20)) }))
    digitar('a'); await passa(351)
    expect(ler).toHaveBeenLastCalledWith({ busca: null, filtro: 'testaveis', pagina: 0, incluirYtId: null })
    expect(screen.queryByText('Só água')).toBeNull()
    expect(screen.getByText('Vídeo 0')).toBeTruthy()
    // em voo
    let solta: (p: PaginaDoCanal) => void = () => {}
    ler.mockImplementationOnce(() => new Promise(r => { solta = p => r({ ok: true, pagina: p }) }))
    digitar('xy'); await passa(351)
    digitar('x'); await act(async () => { solta(pag([linha(95, { titulo: 'Xis velho' })])) })
    await passa(351)
    expect(screen.queryByText('Xis velho')).toBeNull()
  })
  it('trocar para "Todos" pede filtro todos e página 0', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await passa(0)
    expect(ler).toHaveBeenCalledWith({ busca: null, filtro: 'todos', pagina: 0, incluirYtId: null })
    expect(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('"Mostrar os 11 restantes" pede a página seguinte e anexa as linhas', async () => {
    montar(pag(lote(0, 20), { totalDoFiltro: 31 }))
    ler.mockImplementationOnce(async () => ({ ok: true as const, pagina: pag(lote(20, 31), { totalDoFiltro: 31, temMais: false }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar os 11 restantes' }))
    await passa(0)
    expect(ler).toHaveBeenCalledWith({ busca: null, filtro: 'testaveis', pagina: 1, incluirYtId: null })
    expect(screen.getByText('Vídeo 0')).toBeTruthy()
    expect(screen.getByText('Vídeo 30')).toBeTruthy()
    expect(screen.getByText('Mostrando 31 de 31 testáveis')).toBeTruthy()
  })
  it('com mais de 20 restantes o botão diz "Mostrar mais 20"', () => {
    montar(pag(lote(0, 20), { totalDoFiltro: 80 }))
    expect(screen.getByRole('button', { name: 'Mostrar mais 20' })).toBeTruthy()
  })
  it('anexo com linha repetida entre páginas não duplica (Map por videoId)', async () => {
    montar(pag(lote(0, 20), { totalDoFiltro: 31 }))
    ler.mockImplementationOnce(async () => ({ ok: true as const, pagina: pag([linha(19), ...lote(20, 31)], { totalDoFiltro: 31, temMais: false }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar os 11 restantes' }))
    await passa(0)
    expect(screen.getAllByText('Vídeo 19')).toHaveLength(1)
  })
  it('falha mostra "Não deu para ler os vídeos." e "Tentar de novo" repete o último pedido', async () => {
    montar()
    ler.mockImplementationOnce(async () => ({ ok: false as const, erro: 'falha' as const }))
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await passa(0)
    expect(screen.getByText(/Não deu para ler os vídeos\./)).toBeTruthy()
    ler.mockImplementationOnce(async () => ({ ok: true as const, pagina: pag([linha(7)], { totalDoFiltro: 1, temMais: false, filtroEfetivo: 'todos' }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await passa(0)
    expect(ler).toHaveBeenCalledTimes(2)
    expect(ler.mock.calls[1]![0]).toEqual(ler.mock.calls[0]![0])
    expect(screen.getByText('Vídeo 7')).toBeTruthy()
  })
  it('a lista não mostra os cabeçalhos "Precisa de você"/"Outros vídeos" e fica dentro de .cn-raiz', () => {
    const { container } = montar(pag([linha(1), linha(2, { estado: 'resultado_pronto', registro: { id: 'r', updatedAt: dia(1), inicio: dia(15), confirmadoEm: dia(15), primeiraVista: dia(15), diaDe14: 14, variantes: null, variantesTitulo: null, campos: null, respostaDono: null } })]))
    expect(screen.queryByText('Precisa de você')).toBeNull()
    expect(screen.queryByText('Outros vídeos')).toBeNull()
    expect(container.querySelector('.cn-sum')).toBeNull()
    expect(container.querySelector('.cn-lhd')).toBeNull()
    expect(container.querySelector('.cn-raiz .cn-vrow')).not.toBeNull()
  })
  it('depois de router.refresh() (inicial novo), o anexo antigo some e a linha mostra o estado novo', async () => {
    const m = montar(pag(lote(0, 20), { totalDoFiltro: 31 }))
    ler.mockImplementationOnce(async () => ({ ok: true as const, pagina: pag(lote(20, 31), { totalDoFiltro: 31, temMais: false }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar os 11 restantes' }))
    await passa(0)
    expect(screen.getByText('Vídeo 25')).toBeTruthy()
    m.de(pag([linha(0, { titulo: 'Vídeo 0 já em teste', estado: 'em_teste_studio', registro: { id: 'r', updatedAt: dia(1), inicio: dia(3), confirmadoEm: dia(3), primeiraVista: dia(3), diaDe14: 3, variantes: null, variantesTitulo: null, campos: null, respostaDono: null } }), ...lote(1, 20)], { totalDoFiltro: 31 }))
    expect(screen.queryByText('Vídeo 25')).toBeNull()
    expect(screen.getByText('Vídeo 0 já em teste')).toBeTruthy()
  })
  it('Testáveis vazio sem busca mostra a frase do motivoNaoLido; filtroEfetivo "todos" abre com o chip Todos ativo', () => {
    const vazio = (motivo: PaginaDoCanal['contagem']['motivoNaoLido']) => pag([], { totalDoFiltro: 0, temMais: false, contagem: { testaveis: 0, semVolume: 0, naoLido: 5, total: 5, motivoNaoLido: motivo } })
    const casos: Array<[PaginaDoCanal['contagem']['motivoNaoLido'], RegExp]> = [
      ['sem_leitura', /sem acesso ao Analytics do canal/], ['falha', /Não deu para ler o volume agora\./], ['poucos_dias', /menos de 3 dias de relatório/],
    ]
    for (const [motivo, re] of casos) { const m = montar(vazio(motivo)); expect(screen.getByText(re)).toBeTruthy(); m.unmount() }
    montar(pag(lote(0, 3), { filtroEfetivo: 'todos', totalDoFiltro: 3, temMais: false }))
    expect(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Testáveis' }).getAttribute('aria-pressed')).toBe('false')
  })
  it('busca sem resultado: "Nenhum vídeo com “xyz”." e "Limpar busca"', async () => {
    montar()
    ler.mockImplementationOnce(async () => ({ ok: true as const, pagina: pag([], { totalDoFiltro: 0, temMais: false }) }))
    digitar('xyz'); await passa(351)
    expect(screen.getByText(/Nenhum vídeo com “xyz”\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeTruthy()
  })
  it('grupo de poucas impressões aparece com Testáveis e piso de 220', () => {
    montar()
    expect(screen.getByText(/4 vídeos com poucas impressões por dia \(menos de 220\)\. Escolha “Todos” para ver\./)).toBeTruthy()
  })
})
