// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import * as Sentry from '@sentry/nextjs'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { PedidoRespostaDia14, ResultadoAcaoResponder } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import { Dia14Duas, type VersaoDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-duas'
import { ListaCaminho, type AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { LinhaCaminho, type LinhaCaminhoProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/linha-caminho'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const AGORA = new Date('2026-10-22T15:00:00.000Z')
const dia = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const duasV = [{ n: 1, titulo: 'Título original', imagem: null }, { n: 2, titulo: 'Título novo', imagem: { url: 'https://blob.example/b.png' } }]

function linha(estado: 'resultado_pronto' | 'sem_resposta', reg: Partial<NonNullable<LinhaDoCaminho['registro']>> = {}): LinhaDoCaminho {
  return {
    videoId: 'uuid-1', ytId: 'vid00000001', titulo: 'Vídeo 1', miniaturaUrl: null, publicadoEm: dia(30), estado,
    caminho: { tipo: 'nativo', portao: true, motivo: 'x' }, fichaId: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300,
    registro: {
      id: 'reg-1', updatedAt: dia(1), confirmadoEm: dia(estado === 'sem_resposta' ? 20 : 15), primeiraVista: dia(estado === 'sem_resposta' ? 20 : 15), diaDe14: 14,
      variantes: duasV, variantesTitulo: null, campos: ['titulo', 'miniatura'], respostaDono: null, ...reg,
    },
  }
}
const versoes = (l: LinhaDoCaminho): [VersaoDia14, VersaoDia14] => {
  const g = (n: number) => l.registro?.variantes?.find((x) => x.n === n)
  return [{ letra: 'A', titulo: g(1)?.titulo ?? null, imagem: g(1)?.imagem ?? null }, { letra: 'B', titulo: g(2)?.titulo ?? null, imagem: g(2)?.imagem ?? null }]
}

let responder: ReturnType<typeof vi.fn<(p: PedidoRespostaDia14) => Promise<ResultadoAcaoResponder>>>
let atualizar: ReturnType<typeof vi.fn>
beforeEach(() => { responder = vi.fn(async () => ({ ok: true, conflito: null }) as ResultadoAcaoResponder); atualizar = vi.fn(); vi.mocked(Sentry.captureMessage).mockClear() })
afterEach(() => { cleanup() })

const montar = (l = linha('resultado_pronto')) => render(<div className="cn-raiz"><Dia14Duas linha={l} versoes={versoes(l)} acoes={{ responder, atualizar }} /></div>)
const botao = (n: RegExp | string) => screen.getByRole('button', { name: n })

describe('Dia14Duas: estrutura do d14-duas (M2)', () => {
  it('título, apoio com a data do dado, dois botões de mesmo peso, sem .pri', () => {
    const { container } = montar()
    expect(screen.getByRole('heading', { name: 'Qual versão venceu no Studio?' })).toBeTruthy()
    const dd = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(dia(15)))
    expect(screen.getByText(`Teste confirmado em ${dd}. O resultado oficial está só no Studio.`)).toBeTruthy()
    expect(container.querySelectorAll('.pri').length).toBe(0)
    const g = screen.getByRole('group', { name: 'Versões' })
    const bs = within(g).getAllByRole('button')
    expect(bs.map((b) => b.querySelector('.cn-d14-lbl')?.textContent)).toEqual(['A (original) ficou', 'B venceu'])
    expect(bs[0]!.querySelector('[aria-label="Versão A"]')).not.toBeNull()
    expect(bs[1]!.querySelector('[aria-label="Versão B"]')).not.toBeNull()
    expect(bs[0]!.textContent).toContain('Título original')
    expect(bs[1]!.textContent).toContain('Título novo')
  })
  it('"Outra resposta:" na ordem fixa e o aviso antes de qualquer toque', () => {
    montar()
    const g = screen.getByRole('group', { name: 'Outra resposta' })
    expect(g.textContent).toContain('Outra resposta:')
    expect(within(g).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ficou igual', 'Inconclusivo', 'Não vi'])
    expect(FRASES.dia14.avisoMudar).toBe('Depois de responder, mudar a resposta por esta tela chega na próxima atualização.')
    expect(screen.getByText(FRASES.dia14.avisoMudar)).toBeTruthy()
    expect(responder).not.toHaveBeenCalled()
  })
  it('A sem imagem -> placeholder hachurado "não medido"; B com imagem -> a imagem guardada; nunca miniatura viva do YouTube', () => {
    const { container } = montar()
    const ph = screen.getAllByTestId('miniatura-nao-medida')
    expect(ph).toHaveLength(1)
    expect(ph[0]!.textContent).toBe('não medido')
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]!.getAttribute('src')).toBe('https://blob.example/b.png')
    expect(container.innerHTML).not.toContain('ytimg')
  })
  it('campos = [titulo]: a coluna de miniatura some (sem placeholder)', () => {
    const { container } = montar(linha('resultado_pronto', { campos: ['titulo'] }))
    expect(screen.queryAllByTestId('miniatura-nao-medida')).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })
  it('frase tardia só em sem_resposta (início + 14 d); resultado_pronto não a tem', () => {
    montar(linha('sem_resposta'))
    const prazo = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(new Date(dia(20)).getTime() + 14 * 86_400_000))
    expect(screen.getByText(`O prazo acabou em ${prazo}. Ainda dá para responder.`)).toBeTruthy()
    cleanup()
    montar(linha('resultado_pronto'))
    expect(document.body.textContent).not.toContain('O prazo acabou em')
  })
  it('a 390 (CSS): versões em coluna e alvos de 44 px', async () => {
    const css = (await import('node:fs')).readFileSync('src/app/cms/(authed)/youtube/ab-lab/_components/dia-14-duas.css', 'utf8')
    const estreito = css.slice(css.indexOf('@container (max-width: 640px)'))
    expect(estreito).toMatch(/\.cn-d14-grid\s*\{\s*grid-template-columns:\s*1fr/)
    expect(estreito).toMatch(/\.cn-d14-vopt\s*\{\s*min-height:\s*44px/)
    expect(estreito).toMatch(/\.cn-d14-other \.cn-btn\s*\{[^}]*min-height:\s*44px/)
    expect(css).not.toContain('color-mix')
  })
})

describe('Dia14Duas: pedido enviado à action', () => {
  const casos: [string, PedidoRespostaDia14['resposta'], number | null][] = [
    ['A (original) ficou', 'venceu_original', 1], ['B venceu', 'venceu_nova', 2],
    ['Ficou igual', 'ficou_igual', null], ['Inconclusivo', 'inconclusivo', null], ['Não vi', 'nao_vi', null],
  ]
  for (const [rotulo, resposta, n] of casos) {
    it(`"${rotulo}" -> { resposta: '${resposta}', n: ${n} } com lido = registro.updatedAt`, async () => {
      const l = linha('resultado_pronto')
      montar(l)
      fireEvent.click(botao(rotulo === 'A (original) ficou' || rotulo === 'B venceu' ? new RegExp(rotulo.replace(/[()]/g, '\\$&')) : rotulo))
      await waitFor(() => expect(responder).toHaveBeenCalledTimes(1))
      expect(responder).toHaveBeenCalledWith({ registroId: 'reg-1', lido: l.registro!.updatedAt, resposta, n })
    })
  }
})

describe('Dia14Duas: desfechos da action (um teste por linha)', () => {
  it('ok + venceu_original -> selo verde "Ficou no ar: A (original)" + frase + "só no Studio"', async () => {
    montar()
    fireEvent.click(botao(/A \(original\) ficou/))
    await screen.findByText('Ficou no ar: A (original)')
    expect(screen.getByText('A original segurou: a nova não superou.')).toBeTruthy()
    expect(screen.getByText('O resultado oficial está só no Studio.')).toBeTruthy()
    expect(document.querySelector('[data-selo="ok"]')).not.toBeNull()
    expect(atualizar).toHaveBeenCalledTimes(1)
  })
  it('ok + venceu_nova -> "Ficou no ar: B" + "A versão B venceu no Studio e ficou no ar."', async () => {
    montar()
    fireEvent.click(botao(/B venceu/))
    await screen.findByText('Ficou no ar: B')
    expect(screen.getByText('A versão B venceu no Studio e ficou no ar.')).toBeTruthy()
    expect(screen.getByText('O resultado oficial está só no Studio.')).toBeTruthy()
  })
  it('ok com conflito -> "Respostas diferentes", nunca "Ficou no ar", sem "Ver as duas"', async () => {
    responder.mockResolvedValue({ ok: true, conflito: { youtube: 'X', dono: 'Y' } })
    montar()
    fireEvent.click(botao(/B venceu/))
    await screen.findByText('Respostas diferentes')
    expect(screen.getByText('O título no ar e a sua resposta são diferentes.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Ficou no ar')
    expect(document.body.textContent).not.toContain('Ver as duas')
    expect(atualizar).toHaveBeenCalledTimes(1)
  })
  const sem: [string, string, string][] = [
    ['Ficou igual', 'Sem vencedor: ficou igual', 'Você respondeu: ficou igual.'],
    ['Inconclusivo', 'Sem vencedor: inconclusivo', 'Você respondeu: inconclusivo.'],
    ['Não vi', 'Sem vencedor: não vi o resultado', 'Você respondeu: não vi o resultado.'],
  ]
  for (const [rotulo, selo, frase] of sem) {
    it(`ok + "${rotulo}" -> selo neutro "${selo}", sem "Ficou no ar"`, async () => {
      montar()
      fireEvent.click(botao(rotulo))
      await screen.findByText(selo)
      expect(screen.getByText(frase)).toBeTruthy()
      expect(screen.getByText('Nada ficou registrado como versão no ar. O resultado oficial está só no Studio. Mudar a resposta por esta tela chega na próxima atualização.')).toBeTruthy()
      expect(document.querySelector('[data-selo="mute-neq"]')).not.toBeNull()
      expect(document.body.textContent).not.toContain('Ficou no ar')
      expect(document.body.textContent).not.toContain('Mudar minha resposta')
    })
  }
  for (const erro of ['ja_respondido', 'estado_mudou', 'nao_respondivel', 'nao_encontrado'] as const) {
    it(`${erro} -> "O teste mudou enquanto a tela estava aberta." + Atualizar relê`, async () => {
      responder.mockResolvedValue({ ok: false, erro })
      montar()
      fireEvent.click(botao(/B venceu/))
      await screen.findByText('O teste mudou enquanto a tela estava aberta.')
      expect(atualizar).not.toHaveBeenCalled()
      fireEvent.click(botao('Atualizar'))
      expect(atualizar).toHaveBeenCalledTimes(1)
      expect(Sentry.captureMessage).not.toHaveBeenCalled()
    })
  }
  for (const erro of ['falha_escrita', 'variante_invalida'] as const) {
    it(`${erro} -> frase de erro de FRASES + Sentry (só o motivo)`, async () => {
      responder.mockResolvedValue({ ok: false, erro })
      montar()
      fireEvent.click(botao(/B venceu/))
      await screen.findByText(FRASES.dia14.falhou)
      expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ extra: { motivo: erro } }))
    })
  }
  for (const erro of ['falha', 'sem_permissao', 'pedido_invalido'] as const) {
    it(`${erro} (com error cru) -> frase de erro de FRASES, nunca o texto do servidor + Sentry`, async () => {
      responder.mockResolvedValue({ ok: false, erro, error: 'detalhe cru do servidor' })
      montar()
      fireEvent.click(botao(/B venceu/))
      await screen.findByText(FRASES.dia14.falhou)
      expect(document.body.textContent).not.toContain('detalhe cru')
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    })
  }
  it('rede cai -> sem_conexao inline; nada registrado; o 2º toque reenvia o mesmo pedido', async () => {
    responder.mockRejectedValueOnce(new Error('network'))
    montar()
    fireEvent.click(botao(/B venceu/))
    await screen.findByText('Sem conexão. Nada foi registrado.')
    expect(atualizar).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Ficou no ar')
    fireEvent.click(botao('Tentar de novo'))
    await screen.findByText('Ficou no ar: B')
    expect(responder).toHaveBeenCalledTimes(2)
    expect(responder.mock.calls[1]![0]).toEqual(responder.mock.calls[0]![0])
  })
  it('duplo toque rápido: uma só chamada', async () => {
    let solta: (r: ResultadoAcaoResponder) => void = () => {}
    responder.mockImplementation(() => new Promise((res) => { solta = res }))
    montar()
    fireEvent.click(botao(/B venceu/)); fireEvent.click(botao(/B venceu/))
    expect(responder).toHaveBeenCalledTimes(1)
    solta({ ok: true, conflito: null })
    await screen.findByText('Ficou no ar: B')
  })
})

describe('LinhaCaminho: "Responder" abre a pergunta na própria linha', () => {
  const props = (l: LinhaDoCaminho, o: Partial<LinhaCaminhoProps> = {}): LinhaCaminhoProps => ({
    l, agora: AGORA, escolhaNosso: false, aoPreferir: vi.fn(), aoAbrirPainel: vi.fn(), aoIniciar: vi.fn(), perguntaAberta: false,
    aoRegistrar: vi.fn(), aoSeguirComNosso: vi.fn(), aoFecharPergunta: vi.fn(), aoAtualizar: atualizar, jaIniciei: vi.fn(),
    responderDia14: responder as unknown as LinhaCaminhoProps['responderDia14'], responderAberta: false, responderPrimario: true, aoMudarResponder: vi.fn(), ...o,
  })
  const li = (p: LinhaCaminhoProps) => render(<ul><LinhaCaminho {...p} /></ul>)

  it('2 versões em resultado_pronto e em sem_resposta: botão "Responder" (único .pri da linha)', () => {
    for (const e of ['resultado_pronto', 'sem_resposta'] as const) {
      const { container } = li(props(linha(e)))
      expect(screen.getByRole('button', { name: 'Responder' }).className).toContain('pri')
      expect(container.querySelectorAll('.pri')).toHaveLength(1)
      cleanup()
    }
  })
  it('aberta: a pergunta aparece dentro da <li> da linha, sem .pri na pergunta, e o botão perde o laranja', () => {
    const { container } = li(props(linha('resultado_pronto'), { responderAberta: true }))
    const item = container.querySelector('li[data-linha="uuid-1"]')!
    expect(within(item as HTMLElement).getByRole('heading', { name: 'Qual versão venceu no Studio?' })).toBeTruthy()
    expect(item.querySelector('.cn-d14 .pri')).toBeNull()
    expect(container.querySelectorAll('.pri')).toHaveLength(0)
  })
  it('o clique em "Responder" pede a abertura', () => {
    const aoMudarResponder = vi.fn()
    li(props(linha('resultado_pronto'), { aoMudarResponder }))
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
    expect(aoMudarResponder).toHaveBeenCalledWith(true)
  })
  it('3 versões ou origem derivada: sem botão, com a frase honesta de D-1', () => {
    li(props(linha('resultado_pronto', { variantes: [...duasV, { n: 3, titulo: 'C', imagem: null }] })))
    expect(screen.getByText(FRASES.resposta.semBotao)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull()
    cleanup()
    li(props(linha('sem_resposta', { variantes: null, variantesTitulo: ['x', 'y'] })))
    expect(screen.getByText(FRASES.resposta.semBotao)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull()
  })
  it('tabela das 5 respostas: a linha relida mostra selo e frase exatos', () => {
    const tab: [NonNullable<LinhaDoCaminho['registro']>['respostaDono'], string, string, 'ficou_no_ar' | 'respondido_sem_vencedor'][] = [
      ['venceu_original', 'Ficou no ar: A (original)', 'A original segurou: a nova não superou.', 'ficou_no_ar'],
      ['venceu_nova', 'Ficou no ar: B', 'A versão B venceu no Studio e ficou no ar.', 'ficou_no_ar'],
      ['ficou_igual', 'Sem vencedor: ficou igual', 'Você respondeu: ficou igual.', 'respondido_sem_vencedor'],
      ['inconclusivo', 'Sem vencedor: inconclusivo', 'Você respondeu: inconclusivo.', 'respondido_sem_vencedor'],
      ['nao_vi', 'Sem vencedor: não vi o resultado', 'Você respondeu: não vi o resultado.', 'respondido_sem_vencedor'],
    ]
    for (const [r, selo, frase, estado] of tab) {
      const l = { ...linha('resultado_pronto', { respostaDono: r }), estado }
      li(props(l))
      expect(screen.getByText(selo)).toBeTruthy()
      expect(screen.getByText(frase)).toBeTruthy()
      if (estado === 'respondido_sem_vencedor') expect(document.body.textContent).not.toContain('Ficou no ar')
      cleanup()
    }
  })
})

describe('ListaCaminho: dia 14 pelo botão e pelo aviso (?video=)', () => {
  const acoes = () => ({ responderTesteDoYouTube: responder } as unknown as AcoesCaminho)
  const lista = (videoInicial: string | null, l = linha('resultado_pronto')) =>
    render(<ListaCaminho linhas={[l]} videoInicial={videoInicial} acoes={acoes()} painel={() => null} agora={() => AGORA} />)

  it('aviso do dia 14 aberto por ?video=: a pergunta já vem aberta na própria linha, sem tocar em "Responder"', () => {
    const { container } = lista('vid00000001')
    const item = container.querySelector('li[data-linha="uuid-1"]') as HTMLElement
    expect(within(item).getByRole('heading', { name: 'Qual versão venceu no Studio?' })).toBeTruthy()
  })
  it('sem ?video=: só o botão "Responder"; o toque abre a pergunta na linha e a resposta sai com o pedido certo', async () => {
    lista(null)
    expect(screen.queryByRole('heading', { name: 'Qual versão venceu no Studio?' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
    fireEvent.click(await screen.findByRole('button', { name: /B venceu/ }))
    await waitFor(() => expect(responder).toHaveBeenCalledWith(expect.objectContaining({ resposta: 'venceu_nova', n: 2, registroId: 'reg-1' })))
  })
  it('linha sem_resposta aberta: a frase tardia aparece uma só vez (na pergunta)', () => {
    lista('vid00000001', linha('sem_resposta'))
    expect(screen.getAllByText(/^O prazo acabou em \d{2}\/\d{2}\. Ainda dá para responder\.$/)).toHaveLength(1)
  })
})
