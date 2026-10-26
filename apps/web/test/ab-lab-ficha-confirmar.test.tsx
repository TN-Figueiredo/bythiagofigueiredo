// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, renderHook, within, waitFor } from '@testing-library/react'
import * as Sentry from '@sentry/nextjs'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { FichaComStudio, type AcoesFichaStudio } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/ficha-com-studio'
import { useVoltaDoStudio } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/use-volta-do-studio'
import { fichaLida, AGORA_FICHA, URL_IMG, SHA } from './helpers/ficha-fixture'

// Relógio fixo no dia dos dados (22/10, 12:00 em São Paulo): a frase "Você abriu o Studio às" depende de ser o mesmo dia.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-22T15:00:00.000Z')) })
afterEach(() => { vi.useRealTimers() })

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const IMG = (nome: string) => ({ url: URL_IMG(nome), sha256: SHA, largura: 1280, altura: 720 })
// 14:4n UTC = 11:4n em São Paulo
const T = (n: number): string => `2026-10-22T14:${String(40 + n).padStart(2, '0')}:00.000Z`
const duas = (o: Partial<FichaLida> = {}): FichaLida => fichaLida({
  variantes: [
    { n: 1, tipo: 'combo', titulo: 'Título da A', imagem: IMG('a') },
    { n: 2, tipo: 'combo', titulo: 'Título da B', imagem: IMG('b') },
  ], ...o,
})
const linha = { titulo: 'Rota 66', miniaturaUrl: null, nosso: null, ytId: 'abcDEF12345' }
const okCom = (f: FichaLida) => ({ ok: true as const, ficha: f })

type Mocks = { [K in keyof AcoesFichaStudio]: ReturnType<typeof vi.fn> }
function acoesMock(): Mocks {
  return { salvarFicha: vi.fn(), enviarImagemDaFicha: vi.fn(), recomecarFicha: vi.fn(), marcarStudioAberto: vi.fn(), jaIniciei: vi.fn() }
}
function montar(inicial: FichaLida, a = acoesMock(), extra: { largura?: 'larga' | 'estreita' } = {}) {
  const aoRegistrar = vi.fn(); const aoAtualizar = vi.fn(); const fechar = vi.fn()
  const r = render(
    <FichaComStudio linha={linha} inicial={inicial} acoes={a as unknown as AcoesFichaStudio} fechar={fechar}
      agora={() => AGORA_FICHA} largura={extra.largura ?? 'larga'} aoRegistrar={aoRegistrar} aoAtualizar={aoAtualizar} />,
  )
  return { a, aoRegistrar, aoAtualizar, fechar, ...r }
}
function voltarDoStudio(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
}
const abrir = async (rotulo: string = FRASES.ficha.bloco2.abrirNoStudio): Promise<void> => {
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: new RegExp(rotulo) })[0]!) })
}
const jaIniciei = () => screen.getByRole('button', { name: FRASES.ficha.bloco3.jaIniciei })

let aberto: ReturnType<typeof vi.fn>
beforeEach(() => { aberto = vi.fn(); vi.stubGlobal('open', aberto) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Abrir no Studio', () => {
  it('salva a ficha, abre o Studio sem opener e marca; o atualizada_em devolvido é adotado', async () => {
    const a = acoesMock()
    const ordem: string[] = []
    a.salvarFicha.mockImplementation(async () => { ordem.push('salvar'); return okCom(duas({ atualizada_em: T(1) })) })
    aberto.mockImplementation(() => { ordem.push('open') })
    a.marcarStudioAberto.mockImplementation(async () => { ordem.push('marcar'); return okCom(duas({ atualizada_em: T(5), studio_aberto_em: T(5) })) })
    montar(duas(), a)
    fireEvent.change(screen.getByLabelText(/Título da versão B/), { target: { value: 'Novo B' } })
    await abrir()
    expect(ordem).toEqual(['open', 'salvar', 'marcar'])
    expect(aberto).toHaveBeenCalledWith('https://studio.youtube.com/video/abcDEF12345/edit', '_blank', 'noopener')
    expect(a.marcarStudioAberto).toHaveBeenCalledWith(duas().id)
    // editar depois salva sobre o atualizada_em adotado: sem "mudou"
    a.salvarFicha.mockResolvedValue(okCom(duas({ atualizada_em: T(6) })))
    fireEvent.change(screen.getByLabelText(/Título da versão B/), { target: { value: 'Outro B' } })
    await act(async () => { fireEvent.blur(screen.getByLabelText(/Título da versão B/)) })
    expect(a.salvarFicha.mock.calls.at(-1)![1]).toBe(T(5))
    expect(screen.queryByText(FRASES.mudouEmOutroLugar)).toBeNull()
  })

  it('o Studio abre sincronamente no clique, antes do salvar terminar (popup depois de await é bloqueado)', async () => {
    const a = acoesMock()
    let solta: (v: unknown) => void = () => undefined
    a.salvarFicha.mockImplementation(() => new Promise((r) => { solta = r }))
    a.marcarStudioAberto.mockResolvedValue(okCom(duas({ atualizada_em: T(5), studio_aberto_em: T(5) })))
    montar(duas(), a)
    fireEvent.change(screen.getByLabelText(/Título da versão B/), { target: { value: 'Novo B' } })
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(FRASES.ficha.bloco2.abrirNoStudio) })[0]!)
    expect(aberto).toHaveBeenCalledTimes(1)
    expect(a.marcarStudioAberto).not.toHaveBeenCalled()
    await waitFor(() => expect(a.salvarFicha).toHaveBeenCalledTimes(1))
    await act(async () => { solta(okCom(duas({ atualizada_em: T(1) }))) })
    await waitFor(() => expect(a.marcarStudioAberto).toHaveBeenCalledTimes(1))
  })

  it('se a ficha não pôde ser salva o Studio já abriu, mas nada é marcado e o erro aparece', async () => {
    const a = acoesMock()
    a.salvarFicha.mockRejectedValue(new TypeError('Failed to fetch'))
    montar(duas(), a)
    fireEvent.change(screen.getByLabelText(/Título da versão B/), { target: { value: 'Novo B' } })
    await abrir()
    expect(aberto).toHaveBeenCalledTimes(1)
    expect(a.marcarStudioAberto).not.toHaveBeenCalled()
    expect(screen.getByText(FRASES.ficha.erroSalvar)).toBeTruthy()
  })

  it('duplo clique: enquanto a 1ª abertura está pendente o 2º clique não chama nada; depois dela volta a valer', async () => {
    const a = acoesMock()
    let solta: (v: unknown) => void = () => undefined
    a.marcarStudioAberto.mockImplementation(() => new Promise((r) => { solta = r }))
    montar(duas(), a)
    const botao = (): HTMLElement => screen.getAllByRole('button', { name: new RegExp(FRASES.ficha.bloco2.abrirNoStudio) })[0]!
    await act(async () => { fireEvent.click(botao()); fireEvent.click(botao()) })
    expect(aberto).toHaveBeenCalledTimes(1)
    expect(a.marcarStudioAberto).toHaveBeenCalledTimes(1)
    await act(async () => { solta(okCom(duas({ atualizada_em: T(5), studio_aberto_em: T(5) }))) })
    await abrir()
    expect(aberto).toHaveBeenCalledTimes(2)
  })

  it('o cliente nunca chama cópia: só marcarStudioAberto; falha de marcar não aparece como erro de cópia', async () => {
    const a = acoesMock()
    a.marcarStudioAberto.mockResolvedValue({ ok: false, error: 'x' })
    montar(duas(), a)
    await abrir()
    expect(aberto).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('só aparece o primário "Abrir no Studio" antes da volta; sem B fica desabilitado com o motivo', () => {
    montar(fichaLida())
    const b = screen.getAllByRole('button', { name: /Abrir no Studio/ })[0] as HTMLButtonElement
    expect(b.disabled).toBe(true)
    expect(screen.getAllByText(FRASES.ficha.faltaB).length).toBeGreaterThan(0)
  })
})

describe('Volta do Studio', () => {
  it('ao voltar o bloco Confirmar sobe ao topo com a hora, Já iniciei vira primário e o link de novo fica no passo 2', async () => {
    const a = acoesMock()
    a.marcarStudioAberto.mockResolvedValue(okCom(duas({ atualizada_em: T(5), studio_aberto_em: T(5) })))
    montar(duas(), a)
    await abrir()
    expect(screen.queryByText(FRASES.ficha.voceAbriuOStudio('11:45'))).toBeNull()
    voltarDoStudio()
    expect(screen.getByText(FRASES.ficha.voceAbriuOStudio('11:45'))).toBeTruthy()
    expect(jaIniciei().className).toContain('pri')
    const passo2 = screen.getByRole('region', { name: FRASES.ficha.bloco2.titulo })
    expect(within(passo2).getByRole('button', { name: FRASES.ficha.bloco2.abrirNoStudioDeNovo })).toBeTruthy()
    // o bloco está antes do bloco 1 (topo)
    const h3Confirmar = screen.getByRole('heading', { name: new RegExp(FRASES.ficha.bloco3.titulo) })
    const h3Versoes = screen.getByRole('heading', { name: new RegExp(FRASES.ficha.bloco1.titulo) })
    expect(h3Confirmar.compareDocumentPosition(h3Versoes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('"Abrir no Studio de novo" chama marcarStudioAberto de novo (a cópia da A é do servidor e idempotente)', async () => {
    const a = acoesMock()
    a.marcarStudioAberto.mockResolvedValue(okCom(duas({ atualizada_em: T(5), studio_aberto_em: T(5) })))
    montar(duas(), a)
    await abrir()
    voltarDoStudio()
    await abrir(FRASES.ficha.bloco2.abrirNoStudioDeNovo)
    expect(a.marcarStudioAberto).toHaveBeenCalledTimes(2)
    expect(aberto).toHaveBeenCalledTimes(2)
  })

  it('ficha enviada vinda do servidor já mostra a pergunta (outro aparelho, recarga)', () => {
    montar(duas({ studio_aberto_em: T(2), enviada: true }))
    expect(screen.getByText(FRASES.ficha.voceAbriuOStudio('11:42'))).toBeTruthy()
    expect(jaIniciei().className).toContain('pri')
  })

  it('Studio aberto em outro dia mostra a data junto da hora', () => {
    montar(duas({ studio_aberto_em: '2026-10-20T14:42:00.000Z', enviada: true, atualizada_em: T(2) }))
    expect(screen.getByText(FRASES.ficha.voceAbriuOStudioOutroDia('20/10', '11:42'))).toBeTruthy()
  })

  it('só lembrete (sem Studio aberto) não faz a pergunta subir', () => {
    montar(duas({ lembrar_em: T(2), enviada: true }))
    expect(screen.queryByText(/Você abriu o Studio/)).toBeNull()
  })
})

describe('Já iniciei e o 2º toque', () => {
  const enviada = () => duas({ studio_aberto_em: T(2), enviada: true })

  it('abre o 2º toque com a consequência e aria-expanded; só Confirmar fica laranja', () => {
    montar(enviada())
    expect(jaIniciei().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(jaIniciei())
    expect(jaIniciei().getAttribute('aria-expanded')).toBe('true')
    const prazo = FRASES.ficha.confirmarConsequencia(new Date(AGORA_FICHA.getTime() + 16 * 86_400_000))
    const grupo = screen.getByRole('group', { name: FRASES.ficha.bloco3.confirmarGrupo })
    expect(within(grupo).getByText(prazo)).toBeTruthy()
    expect(jaIniciei().className).not.toContain('pri')
    expect(within(grupo).getByRole('button', { name: FRASES.ficha.bloco3.confirmar }).className).toContain('pri')
    expect(document.querySelectorAll('.cn-btn.pri').length).toBe(1)
  })

  it('Confirmar chama jaIniciei e mostra a faixa verde com data, hora e lembrete; a lista é avisada', async () => {
    const a = acoesMock()
    a.jaIniciei.mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] })
    const { aoRegistrar } = montar(enviada(), a)
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    expect(a.jaIniciei).toHaveBeenCalledWith(enviada().id)
    expect(screen.getByText('Teste registrado em 22/10, 12:00')).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.registradaBloco('22/10, 12:00', '05/11').apoio, { exact: false })).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.registrada(new Date(AGORA_FICHA.getTime() + 14 * 86_400_000)).frase)).toBeTruthy()
    expect(aoRegistrar).toHaveBeenCalledTimes(1)
  })

  it('depois de registrar, os campos dos passos 1 e 2 ficam travados (sem falso "mudou em outro lugar")', async () => {
    const a = acoesMock()
    a.jaIniciei.mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] })
    montar(enviada(), a)
    expect((screen.getByLabelText(/Título da versão B/) as HTMLInputElement).readOnly).toBe(false)
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    const campo = screen.getByLabelText(/Título da versão B/) as HTMLInputElement
    expect(campo.readOnly || campo.disabled).toBe(true)
    expect(a.salvarFicha).not.toHaveBeenCalled()
    expect(screen.queryByText(FRASES.mudouEmOutroLugar)).toBeNull()
  })

  it('o aviso de pausa não concluída aparece como linha âmbar sob o registro', async () => {
    const a = acoesMock()
    a.jaIniciei.mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: ['t'], aviso: 'Confirmado. Não deu para pausar.' })
    montar(enviada(), a)
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    const aviso = screen.getByText('Confirmado. Não deu para pausar.')
    expect(aviso.closest('.cn-aviso')).toBeTruthy()
  })

  it('"Ainda não" esconde a pergunta até reabrir', () => {
    montar(enviada())
    fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.ainda }))
    expect(screen.getByText(FRASES.ficha.ainda_nota)).toBeTruthy()
    fireEvent.click(jaIniciei())
    expect(screen.getByRole('group', { name: FRASES.ficha.bloco3.confirmarGrupo })).toBeTruthy()
  })

  it.each([
    ['ficha_incompleta', FRASES.motivo.incompleta.forte],
    ['ja_ha_teste_em_andamento', FRASES.motivo.ja_ha_teste.forteSemData],
    ['estado_mudou', FRASES.motivo.estado_mudou.forte],
    ['nao_encontrada', FRASES.motivo.estado_mudou.forte],
    ['falha', FRASES.motivo.estado_mudou.forte],
  ] as const)('erro %s cai no motivo certo, inline, com ⚠ e sem estado de registrado', async (erro, trecho) => {
    const a = acoesMock()
    a.jaIniciei.mockResolvedValue({ ok: false, erro, error: 'x' })
    const { aoRegistrar } = montar(enviada(), a)
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toContain(trecho)
    expect(alerta.querySelector('svg')).toBeTruthy()
    expect(screen.queryByText(/Teste registrado em/)).toBeNull()
    expect(aoRegistrar).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ extra: { fichaId: enviada().id, motivo: expect.any(String) } }))
  })

  it('já há teste e estado mudou oferecem a ação que relê', async () => {
    const a = acoesMock()
    a.jaIniciei.mockResolvedValue({ ok: false, erro: 'ja_ha_teste_em_andamento', error: 'x' })
    const { aoAtualizar } = montar(enviada(), a)
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    fireEvent.click(screen.getByRole('button', { name: FRASES.motivo.ja_ha_teste.acao! }))
    expect(aoAtualizar).toHaveBeenCalledTimes(1)
  })

  it('rede cai: sem_conexao sem estado otimista; o 2º toque depois da rede volta chama de novo e registra', async () => {
    const a = acoesMock()
    a.jaIniciei.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ ok: true, registroId: 'r', pausados: [], naoPausados: [] })
    const { aoRegistrar } = montar(enviada(), a)
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    expect(screen.getByRole('alert').textContent).toContain(FRASES.motivo.sem_conexao.forte)
    expect(screen.queryByText(/Teste registrado em/)).toBeNull()
    expect(aoRegistrar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: FRASES.motivo.sem_conexao.acao }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    expect(a.jaIniciei).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/Teste registrado em/)).toBeTruthy()
    expect(aoRegistrar).toHaveBeenCalledTimes(1)
  })

  it('a fila: jaIniciei espera a mutação anterior e a ficha devolvida é adotada', async () => {
    const a = acoesMock()
    let solta: () => void = () => {}
    a.marcarStudioAberto.mockImplementation(() => new Promise((res) => { solta = () => res(okCom(duas({ atualizada_em: T(5), studio_aberto_em: T(5) }))) }))
    a.jaIniciei.mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] })
    montar(duas({ studio_aberto_em: T(2), enviada: true }), a)
    await abrir(FRASES.ficha.bloco2.abrirNoStudioDeNovo)
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    expect(a.jaIniciei).not.toHaveBeenCalled()
    await act(async () => { solta() })
    expect(a.jaIniciei).toHaveBeenCalledTimes(1)
  })

  it('com o nosso teste rodando o Já iniciei fica desabilitado com o motivo', () => {
    const a = acoesMock()
    render(<FichaComStudio linha={{ ...linha, nosso: { testId: 't', restoreSeq: 0, status: 'active', dia: 3, teto: 14 } }} inicial={enviada()} acoes={a as unknown as AcoesFichaStudio}
      fechar={vi.fn()} agora={() => AGORA_FICHA} largura="larga" aoRegistrar={vi.fn()} aoAtualizar={vi.fn()} />)
    expect((jaIniciei() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText(FRASES.ficha.primeiroPause).length).toBeGreaterThan(0)
  })
})

describe('useVoltaDoStudio', () => {
  it('só escuta depois de ativo e vira true uma vez', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    const { result, rerender } = renderHook(({ ativo }) => useVoltaDoStudio(ativo), { initialProps: { ativo: false } })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(false)
    rerender({ ativo: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(true)
    rerender({ ativo: true })
    expect(result.current).toBe(true)
  })

  it('ignora a mudança para oculto', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    const { result } = renderHook(() => useVoltaDoStudio(true))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(false)
  })
})

describe('pela lista (ListaCaminhoComPaineis)', () => {
  const linhaLista = {
    videoId: 'uuid-1', ytId: 'vid00000001', titulo: 'Vídeo 1', miniaturaUrl: null, publicadoEm: '2026-10-10T12:00:00.000Z',
    estado: 'sugerido_youtube', caminho: { tipo: 'nativo', portao: true, motivo: 'Vídeo longo com volume.' },
    fichaId: duas().id, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300,
  } as unknown as import('@/lib/youtube/teste-youtube/nativo/lista').LinhaDoCaminho

  it('abre o Studio com o ytId da linha, e o registro avisa a lista (atualizar do contexto)', async () => {
    const { ListaCaminhoComPaineis } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-paineis')
    const { ContextoAssistente, useControleAssistente } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/assistente-contexto')
    const atualizar = vi.fn()
    const acoes = {
      lerFichaDoVideo: vi.fn().mockResolvedValue({ ok: true, ficha: duas({ studio_aberto_em: T(2), enviada: true }), vencida: false }), abrirFicha: vi.fn(), recomecarFicha: vi.fn(),
      salvarFicha: vi.fn(), enviarImagemDaFicha: vi.fn(), marcarStudioAberto: vi.fn().mockResolvedValue(okCom(duas({ atualizada_em: T(5), studio_aberto_em: T(5) }))),
      lembrarNoComputador: vi.fn(), jaIniciei: vi.fn().mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] }),
      confirmarDetectado: vi.fn(), naoETeste: vi.fn(), responderTesteDoYouTube: vi.fn(), pauseAbTest: vi.fn(), retryRestore: vi.fn(),
    }
    function Casca() {
      const c = useControleAssistente({ onAbrir: vi.fn(), atualizar, agora: () => AGORA_FICHA })
      return <ContextoAssistente.Provider value={c}><ListaCaminhoComPaineis linhas={[linhaLista]} videoInicial="vid00000001" acoes={acoes as never} agora={() => AGORA_FICHA} /></ContextoAssistente.Provider>
    }
    render(<Casca />)
    await screen.findByText(FRASES.ficha.voceAbriuOStudio('11:42'))
    await abrir(FRASES.ficha.bloco2.abrirNoStudioDeNovo)
    expect(aberto).toHaveBeenCalledWith('https://studio.youtube.com/video/vid00000001/edit', '_blank', 'noopener')
    fireEvent.click(jaIniciei())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    expect(acoes.jaIniciei).toHaveBeenCalledTimes(1)
    expect(atualizar).toHaveBeenCalled()
  })
})
