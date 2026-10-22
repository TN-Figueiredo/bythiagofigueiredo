// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { FichaComStudio, type AcoesFichaStudio } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/ficha-com-studio'
import { CHAVE_FILA_LEMBRETE } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/fila-lembrete'
import { fichaLida, AGORA_FICHA, URL_IMG, SHA } from './helpers/ficha-fixture'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))

const IMG = (nome: string) => ({ url: URL_IMG(nome), sha256: SHA, largura: 1280, altura: 720 })
const duas = (o: Partial<FichaLida> = {}): FichaLida => fichaLida({
  variantes: [
    { n: 1, tipo: 'combo', titulo: 'Título da A', imagem: IMG('a') },
    { n: 2, tipo: 'combo', titulo: 'Título da B', imagem: IMG('b') },
  ], ...o,
})
type NossoT = { testId: string; restoreSeq: number; dia: number; status: 'active' | 'paused'; restoreStatus?: Record<string, unknown> | null }
const NOSSO: NossoT = { testId: 'teste-1', restoreSeq: 4, dia: 5, status: 'active' }
const linha = (nosso: NossoT | null = null) => ({ titulo: 'Rota 66', miniaturaUrl: null, nosso, ytId: 'abcDEF12345' })
const ok = (campos: Record<string, unknown>): ResultadoAcaoSaida => ({ ok: true, resultado: 'feito', campos: campos as never })
const campoOk = { estado: 'ok', destino: 'original', em: '2026-10-22T14:59:00.000Z', forcado: false, escreveu: true, erro: null, attempts: 1 }
const campoBusy = { ...campoOk, estado: 'em_andamento' }
const campoFalhou = { ...campoOk, estado: 'falhou', erro: { status: 401, reason: 'invalid_grant' } }

type Mocks = { [K in keyof AcoesFichaStudio]: ReturnType<typeof vi.fn> }
const acoesMock = (): Mocks => ({
  salvarFicha: vi.fn(), enviarImagemDaFicha: vi.fn(), recomecarFicha: vi.fn(), marcarStudioAberto: vi.fn(), jaIniciei: vi.fn(),
  lembrarNoComputador: vi.fn(), pauseAbTest: vi.fn(), retryRestore: vi.fn(),
})
function montar(inicial: FichaLida, o: { nosso?: NossoT | null; largura?: 'larga' | 'estreita'; a?: Mocks; entrada?: Record<string, unknown> } = {}) {
  const a = o.a ?? acoesMock()
  const aoAtualizar = vi.fn()
  const el = (nosso: NossoT | null): ReactNode => (
    <FichaComStudio linha={linha(nosso) as never} inicial={inicial} acoes={a as unknown as AcoesFichaStudio} fechar={vi.fn()}
      agora={() => AGORA_FICHA} largura={o.largura ?? 'larga'} aoRegistrar={vi.fn()} aoAtualizar={vi.fn()} aoRecarregar={aoAtualizar} entrada={o.entrada} />
  )
  const r = render(el(o.nosso ?? null))
  return { a, aoAtualizar, trocarNosso: (n: NossoT) => r.rerender(el(n)), ...r }
}
const clicar = async (nome: string | RegExp): Promise<void> => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: nome })) }) }
const PAUSAR = FRASES.ficha.pausarEVoltar

function armazem(): Storage {
  const m = new Map<string, string>()
  return { get length() { return m.size }, key: (i: number) => [...m.keys()][i] ?? null, getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() }
}
beforeEach(() => { vi.stubGlobal('localStorage', armazem()); vi.stubGlobal('open', vi.fn()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('faixa 0b: nosso teste rodando', () => {
  it('mostra a faixa com o dia e "Pausar e voltar a original" como único primário; o Studio fica bloqueado', () => {
    montar(duas(), { nosso: NOSSO })
    expect(screen.getByText(FRASES.ficha.faixaNossoRodando(5).titulo)).toBeTruthy()
    const b = screen.getByRole('button', { name: PAUSAR })
    expect(b.className).toContain('pri')
    expect(document.querySelectorAll('.cn-btn.pri')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: FRASES.ficha.bloco2.abrirNoStudio })).toBeNull()
  })

  it('2 toques: o 1º abre a confirmação (texto do mockup) sem chamar nada; Cancelar fecha', async () => {
    const { a } = montar(duas(), { nosso: NOSSO })
    await clicar(PAUSAR)
    const grupo = screen.getByRole('group', { name: 'Confirmar a pausa' })
    expect(grupo.textContent).toContain(FRASES.ficha.pausarPergunta)
    expect(grupo.textContent).toContain(FRASES.ficha.pausarConsequencia)
    expect(a.pauseAbTest).not.toHaveBeenCalled()
    await clicar(FRASES.ficha.cancelar)
    expect(screen.queryByRole('group', { name: 'Confirmar a pausa' })).toBeNull()
  })

  it('o 2º toque chama pauseAbTest(testId, seq); feito com tudo ok mostra a faixa âmbar com a hora e libera "Abrir no Studio" como primário', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue(ok({ title: campoOk, thumbnail: campoOk }))
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR)
    await clicar(PAUSAR)
    expect(a.pauseAbTest).toHaveBeenCalledWith('teste-1', 4)
    expect(a.pauseAbTest).toHaveBeenCalledTimes(1)
    expect(screen.getByText(FRASES.ficha.faixaRestaurada('22/10, 12:00').titulo)).toBeTruthy()
    const studio = screen.getAllByRole('button', { name: FRASES.ficha.bloco2.abrirNoStudio })[0] as HTMLButtonElement
    expect(studio.disabled).toBe(false)
    expect(studio.className).toContain('pri')
    expect(screen.queryByRole('button', { name: PAUSAR })).toBeNull()
  })

  it('campo em andamento: "Restaurando a original…" com aria-busy e sem "Abrir no Studio"', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue(ok({ title: campoOk, thumbnail: campoBusy }))
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    const faixa = screen.getByText(FRASES.ficha.faixaRestaurando).closest('[aria-busy]')!
    expect(faixa.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('button', { name: FRASES.ficha.bloco2.abrirNoStudio })).toBeNull()
  })

  it('"em andamento" devolvido pela action também mostra a faixa de restaurando', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue({ ok: false, resultado: 'em_andamento', error: 'x' })
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    expect(screen.getByText(FRASES.ficha.faixaRestaurando)).toBeTruthy()
  })

  it('falhou por token: "Tentar de novo" chama retryRestore e "Reconectar o canal" é link para os canais', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue(ok({ title: campoFalhou }))
    a.retryRestore.mockResolvedValue(ok({ title: campoOk }))
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    expect(screen.getByRole('alert').textContent).toContain(FRASES.ficha.faixaRestaurarFalhou.titulo)
    const link = screen.getByRole('link', { name: FRASES.ficha.reconectar })
    expect(link.getAttribute('href')).toBe('/cms/youtube')
    await clicar(FRASES.ficha.tentarDeNovo)
    expect(a.retryRestore).toHaveBeenCalledWith('teste-1', 4)
    expect(screen.getByText(FRASES.ficha.faixaRestaurada('22/10, 12:00').titulo)).toBeTruthy()
  })

  it('nosso pausado com restauro feito, recarregado: "Abrir no Studio" liberado (restore_status da linha)', () => {
    montar(duas(), { nosso: { ...NOSSO, status: 'paused', restoreStatus: { title: campoOk, thumbnail: campoOk } } })
    const studio = screen.getAllByRole('button', { name: FRASES.ficha.bloco2.abrirNoStudio })[0] as HTMLButtonElement
    expect(studio.disabled).toBe(false)
    expect(screen.queryByText(FRASES.ficha.faixaRestaurando)).toBeNull()
  })

  it('nosso pausado com restauro pulado (sem original): frase própria, não a de token vencido, e sem "Tentar de novo"', () => {
    montar(duas(), { nosso: { ...NOSSO, status: 'paused', restoreStatus: { title: { ...campoOk, estado: 'pulado_sem_original' }, thumbnail: campoOk } } })
    expect(screen.getByRole('alert').textContent).toContain(FRASES.ficha.faixaRestaurarNaoVolta.titulo)
    expect(screen.queryByText(FRASES.ficha.faixaRestaurarFalhou.apoio)).toBeNull()
    expect(screen.queryByRole('button', { name: FRASES.ficha.tentarDeNovo })).toBeNull()
  })

  it('nosso pausado com restauro desistiu (retry humano aceita): oferece "Tentar de novo"', () => {
    montar(duas(), { nosso: { ...NOSSO, status: 'paused', restoreStatus: { title: { ...campoOk, estado: 'desistiu', motivo: 'token' }, thumbnail: campoOk } } })
    expect(screen.getByRole('button', { name: FRASES.ficha.tentarDeNovo })).toBeTruthy()
  })

  it('pausa falhou por token: recarrega a linha e o "Tentar de novo" usa o seq novo', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue(ok({ title: campoFalhou }))
    a.retryRestore.mockResolvedValue(ok({ title: campoOk }))
    const { aoAtualizar, trocarNosso } = montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    expect(aoAtualizar).toHaveBeenCalled()
    trocarNosso({ ...NOSSO, restoreSeq: 5, status: 'paused' })
    await clicar(FRASES.ficha.tentarDeNovo)
    expect(a.retryRestore).toHaveBeenCalledWith('teste-1', 5)
  })

  it('retryRestore devolve "mudou": recarrega a linha em vez de só mostrar a frase', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue(ok({ title: campoFalhou }))
    a.retryRestore.mockResolvedValue({ ok: false, resultado: 'mudou', error: 'O teste mudou em outra aba. Reabra para decidir.' })
    const { aoAtualizar } = montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    aoAtualizar.mockClear()
    await clicar(FRASES.ficha.tentarDeNovo)
    expect(aoAtualizar).toHaveBeenCalledTimes(1)
  })

  it('precisa_confirmar -> "Trocar mesmo assim" repete a pausa com forcar (sem loop de diálogo)', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValueOnce({ ok: true, resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'Título editado por fora' }] })
    a.pauseAbTest.mockResolvedValueOnce(ok({ title: campoOk, thumbnail: campoOk }))
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    await clicar(/Trocar/)
    expect(a.pauseAbTest).toHaveBeenLastCalledWith('teste-1', 4, true)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText(FRASES.ficha.faixaRestaurada('22/10, 12:00').titulo)).toBeTruthy()
  })

  it('precisa_confirmar de retryRestore não abre diálogo: frase inline', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue(ok({ title: campoFalhou }))
    a.retryRestore.mockResolvedValue({ ok: true, resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'x' }] })
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    await clicar(FRASES.ficha.tentarDeNovo)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText(FRASES.ficha.pausarPrecisaConfirmar)).toBeTruthy()
  })

  it('precisa_confirmar abre o diálogo existente; Voltar fecha sem mais chamadas', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue({ ok: true, resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'Título editado por fora' }] })
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('Título editado por fora')).toBeTruthy()
    await clicar('Voltar')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(a.pauseAbTest).toHaveBeenCalledTimes(1)
  })

  it('erro da action aparece como frase da própria action, sem estado otimista', async () => {
    const a = acoesMock()
    a.pauseAbTest.mockResolvedValue({ ok: false, resultado: 'mudou', error: 'O teste mudou. Recarregue.' })
    montar(duas(), { nosso: NOSSO, a })
    await clicar(PAUSAR); await clicar(PAUSAR)
    expect(screen.getByRole('alert').textContent).toContain('O teste mudou. Recarregue.')
    expect(screen.queryByText(FRASES.ficha.faixaRestaurada('22/10, 12:00').titulo)).toBeNull()
  })
})

describe('faixa 0c: registro detectado', () => {
  it('diz desde quando o título alterna', () => {
    montar(duas(), { entrada: { registroDetectado: { primeiraVista: '2026-10-22T13:10:00.000Z' } } })
    const t = FRASES.ficha.faixaDetectado('22/10, 10:10')
    expect(screen.getByText(t.titulo)).toBeTruthy()
    expect(screen.getByText(t.apoio)).toBeTruthy()
  })
})

describe('rodapé do celular (390): Lembrar no computador', () => {
  const LEMBRAR = FRASES.ficha.rodapeLembrete.lembrar
  const LEMBROU = '2026-10-22T14:40:00.000Z' // 11:40 em São Paulo

  it('primário com a explicação; com o nosso rodando deixa de ser primário', () => {
    montar(duas(), { largura: 'estreita' })
    const b = screen.getByRole('button', { name: LEMBRAR })
    expect(b.className).toContain('pri')
    expect(screen.getByText(FRASES.ficha.rodapeLembrete.chega)).toBeTruthy()
    cleanup()
    montar(duas(), { largura: 'estreita', nosso: NOSSO })
    expect(screen.getByRole('button', { name: LEMBRAR }).className).not.toContain('pri')
  })

  it('sem a versão B: desabilitado com o motivo', () => {
    montar(fichaLida(), { largura: 'estreita' })
    expect((screen.getByRole('button', { name: LEMBRAR }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText(FRASES.ficha.rodapeLembrete.semB).length).toBeGreaterThan(0)
  })

  it('sucesso: "Lembrete enviado em dd/mm, HH:MM" e o atualizada_em devolvido é adotado', async () => {
    const a = acoesMock()
    a.lembrarNoComputador.mockResolvedValue({ ok: true, lembrarEm: LEMBROU, jaLembrado: false, ficha: duas({ atualizada_em: '2026-10-22T14:41:00.000Z', lembrar_em: LEMBROU }) })
    a.salvarFicha.mockResolvedValue({ ok: true, ficha: duas() })
    montar(duas(), { largura: 'estreita', a })
    await clicar(LEMBRAR)
    expect(a.lembrarNoComputador).toHaveBeenCalledWith(duas().id)
    expect(screen.getByText(FRASES.ficha.lembreteEnviado('22/10, 11:40'))).toBeTruthy()
    expect(screen.queryByRole('button', { name: LEMBRAR })).toBeNull()
    fireEvent.change(screen.getByLabelText(/Título da versão B/), { target: { value: 'Outro B' } })
    await act(async () => { fireEvent.blur(screen.getByLabelText(/Título da versão B/)) })
    expect(a.salvarFicha.mock.calls.at(-1)![1]).toBe('2026-10-22T14:41:00.000Z')
  })

  it('2º toque com jaLembrado mostra a mesma data; ficha já lembrada abre com a data', async () => {
    const a = acoesMock()
    a.lembrarNoComputador.mockResolvedValue({ ok: true, lembrarEm: LEMBROU, jaLembrado: true })
    montar(duas(), { largura: 'estreita', a })
    await clicar(LEMBRAR)
    expect(screen.getByText(FRASES.ficha.lembreteEnviado('22/10, 11:40'))).toBeTruthy()
    cleanup()
    montar(duas({ lembrar_em: LEMBROU }), { largura: 'estreita' })
    expect(screen.getByText(FRASES.ficha.lembreteEnviado('22/10, 11:40'))).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.rodapeLembrete.abraPeloSino)).toBeTruthy()
  })

  it('offline: botão habilitado, frase da fila; o toque enfileira só o fichaId e não chama a action', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const a = acoesMock()
    montar(duas(), { largura: 'estreita', a })
    const b = screen.getByRole('button', { name: LEMBRAR }) as HTMLButtonElement
    expect(b.disabled).toBe(false)
    expect(screen.queryByText(FRASES.ficha.rodapeLembrete.offline)).toBeNull()
    await clicar(LEMBRAR)
    expect(screen.getByText(FRASES.ficha.rodapeLembrete.offline)).toBeTruthy()
    expect(a.lembrarNoComputador).not.toHaveBeenCalled()
    const fila = JSON.parse(localStorage.getItem(CHAVE_FILA_LEMBRETE)!)
    expect(fila).toHaveLength(1)
    expect(Object.keys(fila[0]).sort()).toEqual(['enfileiradoEm', 'fichaId'])
    expect(fila[0].fichaId).toBe(duas().id)
    vi.restoreAllMocks()
  })

  it('falha de rede na action também enfileira', async () => {
    const a = acoesMock()
    a.lembrarNoComputador.mockRejectedValue(new TypeError('Failed to fetch'))
    montar(duas(), { largura: 'estreita', a })
    await clicar(LEMBRAR)
    expect(JSON.parse(localStorage.getItem(CHAVE_FILA_LEMBRETE)!)).toHaveLength(1)
  })

  it('ficha de outro aparelho a 390: sem rodapé de lembrete', () => {
    montar(duas(), { largura: 'estreita', entrada: { criadaEmOutroAparelho: true } })
    expect(screen.queryByRole('button', { name: LEMBRAR })).toBeNull()
  })

  it('a 1280 não há rodapé de lembrete', () => {
    montar(duas())
    expect(screen.queryByRole('button', { name: LEMBRAR })).toBeNull()
  })
})
