// @vitest-environment jsdom
// T10: cartão S7 (estados 1 e 2) do teste do YouTube: "Confirmar", "Não é teste" em 2 toques, e o que a tela diz quando o registro muda por fora.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { CartaoTesteYoutube, type AcoesCartao } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/cartao-teste-youtube'
import { ContextoAssistente, useControleAssistente } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/assistente-contexto'
import { ListaCaminhoComPaineis } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-paineis'
import type { AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))

// 22/10/2026 12:00 em São Paulo. Datas do dado são sempre relativas a este relógio.
const AGORA = new Date('2026-10-22T15:00:00.000Z')
const dia = (n: number, h = 0): string => new Date(AGORA.getTime() - n * 86_400_000 + h * 3_600_000).toISOString()

const registro = (o: Partial<React.ComponentProps<typeof CartaoTesteYoutube>['registro']> = {}): React.ComponentProps<typeof CartaoTesteYoutube>['registro'] => ({
  id: 'reg-1', updatedAt: dia(0, -1), confirmadoEm: null, primeiraVista: dia(3), ultimaVista: dia(0, -2),
  variantesTitulo: ['Vegas barata: guia', 'Vegas barata: 3 dias com 50 dólares por dia'],
  votosTitulo: { 'Vegas barata: guia': 7, 'Vegas barata: 3 dias com 50 dólares por dia': 8 },
  ...o,
})

let acoes: { confirmarDetectado: ReturnType<typeof vi.fn>; naoETeste: ReturnType<typeof vi.fn> }
let aoAtualizar: ReturnType<typeof vi.fn>
let aoLiberado: ReturnType<typeof vi.fn>
beforeEach(() => {
  acoes = { confirmarDetectado: vi.fn(), naoETeste: vi.fn() }
  aoAtualizar = vi.fn(); aoLiberado = vi.fn()
})
afterEach(() => cleanup())

const montar = (r = registro(), labPausadoAte: string | null = null, agora = AGORA) =>
  render(<CartaoTesteYoutube registro={r} labPausadoAte={labPausadoAte} acoes={acoes as unknown as AcoesCartao} agora={() => agora} aoAtualizar={aoAtualizar} aoLiberado={aoLiberado} />)

describe('CartaoTesteYoutube, estado 1 (visto de fora)', () => {
  it('selo, frase de "visto", A e B com as leituras de cada título e o "Confirmar" como único primário', () => {
    montar()
    expect(screen.getByText('Parece haver um teste no Studio')).toBeTruthy()
    expect(screen.getByText(/Visto de fora desde 19\/10 às 12:00\. Última leitura hoje, 10:00\. Você ainda não confirmou\./)).toBeTruthy()
    const a = screen.getByRole('img', { name: 'Versão A' }).closest('.cn-opt') as HTMLElement
    const b = screen.getByRole('img', { name: 'Versão B' }).closest('.cn-opt') as HTMLElement
    expect(within(a).getByText('Título de antes')).toBeTruthy()
    expect(within(a).getByText('Vegas barata: guia')).toBeTruthy()
    expect(within(a).getByText(/Leituras com este título/)).toBeTruthy()
    expect(within(a).getByText('7 de 15')).toBeTruthy()
    expect(within(b).getByText('Título novo')).toBeTruthy()
    expect(within(b).getByText('8 de 15')).toBeTruthy()
    const pri = document.querySelectorAll('.cn-btn.pri')
    expect(pri.length).toBe(1)
    expect(pri[0]!.textContent).toBe('Confirmar')
    expect(screen.getByText(FRASES.s7.dica)).toBeTruthy()
  })
  it('votos nulos: "não medido", nunca "0 de 0"', () => {
    montar(registro({ votosTitulo: null }))
    expect(screen.getAllByText('não medido').length).toBe(2)
    expect(screen.queryByText(/0 de 0/)).toBeNull()
  })
  it('votos sem nenhum voto (soma 0) também é "não medido"', () => {
    montar(registro({ votosTitulo: {} }))
    expect(screen.queryByText(/0 de 0/)).toBeNull()
    expect(screen.getAllByText('não medido').length).toBe(2)
  })
  it('sem primeira/última leitura no dado, a tela não inventa data', () => {
    montar(registro({ primeiraVista: null, ultimaVista: null }))
    expect(screen.getByText(/Visto de fora desde data não medida\. Última leitura não medida\./)).toBeTruthy()
  })
  it('só um título (derivada): mostra o que existe, sem inventar a segunda versão', () => {
    montar(registro({ variantesTitulo: ['Só este'], votosTitulo: null }))
    expect(screen.getAllByRole('img', { name: /Versão/ }).length).toBe(1)
  })
  it('"Não é teste" abre a faixa de 2 toques com o foco em Cancelar; Cancelar fecha e devolve o foco', () => {
    montar()
    const nao = screen.getByRole('button', { name: 'Não é teste' })
    expect(nao.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(nao)
    const grupo = screen.getByRole('group', { name: 'Confirmar liberação' })
    expect(within(grupo).getByText('Decisão sua, fica registrada.')).toBeTruthy()
    expect(grupo.textContent).toContain('O Lab volta a trocar título e miniatura neste vídeo, mesmo que o YouTube esteja testando.')
    expect(within(grupo).getByRole('button', { name: 'Liberar o Lab' })).toBeTruthy()
    expect(document.activeElement).toBe(within(grupo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Não é teste' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(grupo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('group', { name: 'Confirmar liberação' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Não é teste' }))
    expect(acoes.naoETeste).not.toHaveBeenCalled()
  })
  it('"Liberar o Lab" chama naoETeste com o id e o updatedAt lido; ok libera a linha (aoLiberado)', async () => {
    acoes.naoETeste.mockResolvedValue({ ok: true })
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Não é teste' }))
    fireEvent.click(screen.getByRole('button', { name: 'Liberar o Lab' }))
    await waitFor(() => expect(aoLiberado).toHaveBeenCalledTimes(1))
    expect(acoes.naoETeste).toHaveBeenCalledWith('reg-1', registro().updatedAt)
  })
  it('linha âmbar de Lab pausado: "parece haver", com dd/mm; passada a data, "espera o resultado"', () => {
    montar(registro(), '2026-11-04T09:40:00.000Z')
    expect(screen.getByText(/Lab pausado/).closest('p')!.textContent).toBe('Lab pausado porque parece haver teste no Studio. Retomar fica disponível a partir de 04/11, 06:40.')
    cleanup()
    montar(registro(), '2026-10-22T14:59:59.000Z')
    expect(screen.getByText(/Lab pausado/).closest('p')!.textContent).toContain('Retomar espera o resultado do teste no Studio.')
  })
  it('sem nosso teste pausado (labPausadoAte nulo) não há linha âmbar', () => {
    montar()
    expect(screen.queryByText(/Lab pausado/)).toBeNull()
  })
  it('"Confirmar" chama confirmarDetectado e passa ao estado 2: "Você confirmou em dd/mm, HH:MM", sem "Não é teste" nem Confirmar', async () => {
    acoes.confirmarDetectado.mockResolvedValue({ ok: true, registroId: 'reg-1', pausados: [], naoPausados: [] })
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('Você confirmou em 22/10, 12:00.')
    expect(acoes.confirmarDetectado).toHaveBeenCalledWith('reg-1', registro().updatedAt)
    expect(screen.getByText('Em teste no Studio')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Não é teste' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
    expect(screen.queryByText(/Desfazer/)).toBeNull()
    expect(screen.queryByText(/Também testa miniatura/)).toBeNull()
    expect(aoAtualizar).toHaveBeenCalled()
  })
  it('confirmado com aviso (pausa do nosso adiada) mostra o aviso', async () => {
    acoes.confirmarDetectado.mockResolvedValue({ ok: true, registroId: 'reg-1', pausados: [], naoPausados: ['t'], aviso: 'Confirmado. Aviso X.' })
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('Confirmado. Aviso X.')
  })
  it.each([
    ['confirmar', 'estado_mudou'], ['confirmar', 'ja_confirmado'], ['confirmar', 'nao_encontrada'],
    ['liberar', 'ja_encerrado'], ['liberar', 'confirmado'], ['liberar', 'nao_encontrado'],
  ])('%s -> %s: "O teste mudou enquanto a tela estava aberta." com o botão Atualizar, nunca erro cru', async (qual, erro) => {
    if (qual === 'confirmar') acoes.confirmarDetectado.mockResolvedValue({ ok: false, erro })
    else acoes.naoETeste.mockResolvedValue({ ok: false, erro })
    montar()
    if (qual === 'confirmar') fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    else { fireEvent.click(screen.getByRole('button', { name: 'Não é teste' })); fireEvent.click(screen.getByRole('button', { name: 'Liberar o Lab' })) }
    const msg = await screen.findByText('O teste mudou enquanto a tela estava aberta.')
    expect(msg.closest('[role="alert"], [role="status"]')).toBeTruthy()
    const atualizar = screen.getByRole('button', { name: 'Atualizar' })
    expect(atualizar.className).not.toContain('pri')
    expect(screen.getAllByRole('button', { name: 'Atualizar' }).length).toBe(1)
    fireEvent.click(atualizar)
    expect(aoAtualizar).toHaveBeenCalled()
    expect(screen.queryByText(/estado_mudou|ja_encerrado|nao_encontrad/)).toBeNull()
  })
  it('falha de rede/servidor: mostra a mensagem da action e permite tentar de novo (sem estado 2 otimista)', async () => {
    acoes.confirmarDetectado.mockResolvedValue({ ok: false, erro: 'falha', error: 'Não deu para confirmar agora.' })
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('Não deu para confirmar agora.')
    expect(screen.queryByText(/Você confirmou em/)).toBeNull()
    expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('exceção da action também não vira estado 2', async () => {
    acoes.confirmarDetectado.mockRejectedValue(new Error('rede'))
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByRole('alert')
    expect(screen.queryByText(/Você confirmou em/)).toBeNull()
  })
  it('toque duplo em Confirmar chama a action uma vez só', async () => {
    let fim!: (v: unknown) => void
    acoes.confirmarDetectado.mockReturnValue(new Promise((r) => { fim = r }))
    montar()
    const b = screen.getByRole('button', { name: 'Confirmar' })
    fireEvent.click(b); fireEvent.click(b)
    expect(acoes.confirmarDetectado).toHaveBeenCalledTimes(1)
    await act(async () => { fim({ ok: true, registroId: 'reg-1', pausados: [], naoPausados: [] }) })
  })
})

describe('CartaoTesteYoutube, estado 2 vindo do dado (confirmadoEm)', () => {
  it('mostra "Você confirmou em dd/mm, HH:MM" do dado e a linha âmbar com "há teste"', () => {
    montar(registro({ confirmadoEm: dia(1) }), '2026-11-02T12:00:00.000Z')
    expect(screen.getByText('Você confirmou em 21/10, 12:00.')).toBeTruthy()
    expect(screen.getByText(/Lab pausado/).closest('p')!.textContent).toBe('Lab pausado porque há teste no Studio. Retomar fica disponível a partir de 02/11, 09:00.')
    expect(screen.queryByRole('button', { name: 'Não é teste' })).toBeNull()
  })
})

// ---- pela lista (painel real no lugar do provisório) ----
const mkAcoes = (): AcoesCaminho => ({
  abrirFicha: vi.fn(), lerFichaDoVideo: vi.fn(), recomecarFicha: vi.fn(), salvarFicha: vi.fn(), marcarStudioAberto: vi.fn(),
  enviarImagemDaFicha: vi.fn(), lembrarNoComputador: vi.fn(), jaIniciei: vi.fn(), confirmarDetectado: vi.fn(), naoETeste: vi.fn(),
  responderTesteDoYouTube: vi.fn(), pauseAbTest: vi.fn(), retryRestore: vi.fn(),
} as unknown as AcoesCaminho)
const linhaS7 = (o: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho => ({
  videoId: 'uuid-1', ytId: 'vid00000001', titulo: 'Vegas barata', miniaturaUrl: null, publicadoEm: dia(10),
  estado: 'em_teste_studio', caminho: { tipo: 'nativo', portao: true, motivo: 'x' }, fichaId: null,
  registro: { id: 'reg-1', updatedAt: dia(0, -1), confirmadoEm: null, primeiraVista: dia(3), ultimaVista: dia(0, -2), diaDe14: 3, variantes: null,
    variantesTitulo: ['A antes', 'B novo'], votosTitulo: { 'A antes': 3, 'B novo': 1 }, campos: null, respostaDono: null },
  labPausadoAte: null, nosso: null, impressoesPorDia: 300, ...o,
})

describe('lista: o painel S7 é o cartão real', () => {
  function Lista({ linhas, acoesL, atualizar }: { linhas: LinhaDoCaminho[]; acoesL: AcoesCaminho; atualizar: () => void }): ReactNode {
    const controle = useControleAssistente({ onAbrir: vi.fn(), atualizar, agora: () => AGORA })
    return (
      <ContextoAssistente.Provider value={controle}>
        <ListaCaminhoComPaineis linhas={linhas} videoInicial={null} acoes={acoesL} agora={() => AGORA} />
      </ContextoAssistente.Provider>
    )
  }
  beforeEach(() => {
    const m = new Map<string, string>()
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear(), key: () => null, length: 0 } as Storage
    vi.stubGlobal('localStorage', st); vi.stubGlobal('sessionStorage', st)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('"Ver teste" abre o cartão com o título do vídeo; o provisório sumiu', () => {
    render(<Lista linhas={[linhaS7()]} acoesL={mkAcoes()} atualizar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Ver teste/ }))
    expect(screen.getByRole('heading', { name: 'Vegas barata', level: 2 })).toBeTruthy()
    expect(screen.getByText('Parece haver um teste no Studio')).toBeTruthy()
    expect(screen.queryByText(/chega na próxima atualização/)).toBeNull()
  })
  it('"Liberar o Lab" pela lista: chama naoETeste da prop, fecha o painel e relê a lista', async () => {
    const a = mkAcoes()
    vi.mocked(a.naoETeste).mockResolvedValue({ ok: true })
    const atualizar = vi.fn()
    render(<Lista linhas={[linhaS7()]} acoesL={a} atualizar={atualizar} />)
    fireEvent.click(screen.getByRole('button', { name: /Ver teste/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Não é teste' }))
    fireEvent.click(screen.getByRole('button', { name: 'Liberar o Lab' }))
    await waitFor(() => expect(atualizar).toHaveBeenCalled())
    expect(a.naoETeste).toHaveBeenCalledWith('reg-1', linhaS7().registro!.updatedAt)
    await waitFor(() => expect(screen.queryByText('Parece haver um teste no Studio')).toBeNull())
  })
  it('"Confirmar" pela lista usa confirmarDetectado da prop', async () => {
    const a = mkAcoes()
    vi.mocked(a.confirmarDetectado).mockResolvedValue({ ok: true, registroId: 'reg-1', pausados: [], naoPausados: [] })
    render(<Lista linhas={[linhaS7()]} acoesL={a} atualizar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Ver teste/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByText(/Você confirmou em 22\/10/)
    expect(a.confirmarDetectado).toHaveBeenCalledWith('reg-1', linhaS7().registro!.updatedAt)
  })
})
