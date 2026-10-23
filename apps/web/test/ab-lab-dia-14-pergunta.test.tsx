// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import * as Sentry from '@sentry/nextjs'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { PedidoRespostaDia14, ResultadoAcaoMudar, ResultadoAcaoResponder } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import { Dia14Pergunta, type PedidoMudarDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-pergunta'
import { versoesDoDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-estado'
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
      id: 'reg-1', updatedAt: dia(1), inicio: dia(estado === 'sem_resposta' ? 20 : 15), confirmadoEm: dia(estado === 'sem_resposta' ? 20 : 15), primeiraVista: dia(estado === 'sem_resposta' ? 20 : 15), diaDe14: 14,
      variantes: duasV, variantesTitulo: null, campos: ['titulo', 'miniatura'], respostaDono: null, ...reg,
    },
  }
}
let responder: ReturnType<typeof vi.fn<(p: PedidoRespostaDia14) => Promise<ResultadoAcaoResponder>>>
let atualizar: ReturnType<typeof vi.fn>
beforeEach(() => { responder = vi.fn(async () => ({ ok: true, conflito: null }) as ResultadoAcaoResponder); atualizar = vi.fn(); vi.mocked(Sentry.captureMessage).mockClear() })
afterEach(() => { cleanup() })

let mudar: ReturnType<typeof vi.fn<(p: PedidoMudarDia14) => Promise<ResultadoAcaoMudar>>>
let aoFechar: ReturnType<typeof vi.fn>
beforeEach(() => { mudar = vi.fn(async () => ({ ok: true, conflito: null }) as ResultadoAcaoMudar); aoFechar = vi.fn() })
const montar = (l = linha('resultado_pronto'), modo: 'responder' | 'mudar' = 'responder', vista: { respostaVista?: PedidoMudarDia14['respostaVista']; varianteVista?: number | null } = {}) =>
  render(<div className="cn-raiz"><Dia14Pergunta linha={l} pergunta={versoesDoDia14(l.registro!)} modo={modo} acoes={{ responder, mudar, atualizar }} aoFechar={aoFechar} {...vista} /></div>)
const botao = (n: RegExp | string) => screen.getByRole('button', { name: n })

describe('Dia14Pergunta: estrutura do d14-duas (M2)', () => {
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
    expect(FRASES.dia14.avisoResponder).toBe('Um toque responde; dá para mudar depois.')
    expect(screen.getByText(FRASES.dia14.avisoResponder)).toBeTruthy()
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
    const css = (await import('node:fs')).readFileSync('src/app/cms/(authed)/youtube/ab-lab/_components/dia-14-pergunta.css', 'utf8')
    const estreito = css.slice(css.indexOf('@container (max-width: 640px)'))
    expect(estreito).toMatch(/\.cn-d14-grid\s*\{\s*grid-template-columns:\s*1fr/)
    expect(estreito).toMatch(/\.cn-d14-vopt\s*\{\s*min-height:\s*44px/)
    expect(estreito).toMatch(/\.cn-d14-other \.cn-btn\s*\{[^}]*min-height:\s*44px/)
    expect(css).not.toContain('color-mix')
  })
})

describe('Dia14Pergunta: pedido enviado à action', () => {
  const casos: [string, PedidoRespostaDia14['resposta'], number | null][] = [
    ['A (original) ficou', 'venceu_original', 1], ['B venceu', 'venceu_nova', 2],
    ['Ficou igual', 'ficou_igual', null], ['Inconclusivo', 'inconclusivo', null], ['Não vi', 'nao_vi', null],
  ]
  for (const [rotulo, resposta, n] of casos) {
    it(`"${rotulo}" -> { resposta: '${resposta}', n: ${n} } (com tituloVisto nas versões) e lido = registro.updatedAt`, async () => {
      const l = linha('resultado_pronto')
      montar(l)
      fireEvent.click(botao(rotulo === 'A (original) ficou' || rotulo === 'B venceu' ? new RegExp(rotulo.replace(/[()]/g, '\\$&')) : rotulo))
      await waitFor(() => expect(responder).toHaveBeenCalledTimes(1))
      expect(responder).toHaveBeenCalledWith({ registroId: 'reg-1', lido: l.registro!.updatedAt, resposta, n, ...(n === null ? {} : { tituloVisto: n === 1 ? 'Título original' : 'Título novo' }) })
    })
  }
})

describe('Dia14Pergunta: desfechos da action (um teste por linha)', () => {
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
    ['Ficou igual', 'Sem vencedor: ficou igual', 'Registrado: você respondeu "ficou igual".'],
    ['Inconclusivo', 'Sem vencedor: inconclusivo', 'Registrado: você respondeu "inconclusivo".'],
    ['Não vi', 'Sem vencedor: não vi o resultado', 'Registrado: você respondeu "não vi o resultado".'],
  ]
  for (const [rotulo, selo, frase] of sem) {
    it(`ok + "${rotulo}" -> selo neutro "${selo}", sem "Ficou no ar"`, async () => {
      montar()
      fireEvent.click(botao(rotulo))
      await screen.findByText(selo)
      expect(screen.getByText(frase)).toBeTruthy()
      expect(screen.getByText('Nenhuma versão ficou registrada como vencedora.')).toBeTruthy()
      expect(document.querySelector('[data-selo="mute-neq"]')).not.toBeNull()
      expect(document.body.textContent).not.toContain('Ficou no ar')
      expect(document.body.textContent).not.toContain('Mudar minha resposta')
    })
  }
  it('ja_respondido -> "Você já tinha respondido em outra tela." + Atualizar relê', async () => {
    responder.mockResolvedValue({ ok: false, erro: 'ja_respondido' })
    montar()
    fireEvent.click(botao(/B venceu/))
    await screen.findByText('Você já tinha respondido em outra tela.')
    fireEvent.click(botao('Atualizar'))
    expect(atualizar).toHaveBeenCalledTimes(1)
  })
  for (const erro of ['estado_mudou', 'nao_respondivel', 'nao_encontrado'] as const) {
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
      await screen.findByText(erro === 'falha_escrita' ? FRASES.dia14.falhou : FRASES.pedidoRecusado)
      expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ extra: { motivo: erro } }))
    })
  }
  const TEXTO_DO_ERRO = { falha: FRASES.dia14.falhou, sem_permissao: FRASES.semPermissao, pedido_invalido: FRASES.pedidoRecusado } as const
  for (const erro of ['falha', 'sem_permissao', 'pedido_invalido'] as const) {
    it(`${erro} (com error cru) -> frase de erro de FRASES, nunca o texto do servidor + Sentry`, async () => {
      responder.mockResolvedValue({ ok: false, erro, error: 'detalhe cru do servidor' })
      montar()
      fireEvent.click(botao(/B venceu/))
      await screen.findByText(TEXTO_DO_ERRO[erro])
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
    const b = botao(/B venceu/)
    fireEvent.click(b); fireEvent.click(b)
    expect(responder).toHaveBeenCalledTimes(1)
    solta({ ok: true, conflito: null })
    await screen.findByText('Ficou no ar: B')
  })
})

// ---- T6: três versões, origem derivada, sem versões, envio e modo mudar ----
const tresV = [...duasV, { n: 3, titulo: 'Título C', imagem: { url: 'https://blob.example/c.png' } }]
const derivada = (titulos: string[], tituloAntes: string | null, o: Partial<NonNullable<LinhaDoCaminho['registro']>> = {}) =>
  linha('resultado_pronto', { variantes: null, variantesTitulo: titulos, tituloAntes, campos: null, ...o })
const rotulos = () => within(screen.getByRole('group', { name: 'Versões' })).getAllByRole('button').map((b) => b.querySelector('.cn-d14-lbl')?.textContent)
const lerCss = async (f: string) => (await import('node:fs')).readFileSync(f, 'utf8')
const DIR = 'src/app/cms/(authed)/youtube/ab-lab/_components/'

describe('Dia14Pergunta: três versões de ficha', () => {
  it('três vopt com chip A/B/C, miniatura e título; rótulos fixos; nenhum .pri; --n = 3', () => {
    const { container } = montar(linha('resultado_pronto', { variantes: tresV }))
    const bs = within(screen.getByRole('group', { name: 'Versões' })).getAllByRole('button')
    expect(bs).toHaveLength(3)
    expect(rotulos()).toEqual(['A (original) ficou', 'B venceu', 'C venceu'])
    for (const [i, l] of ['A', 'B', 'C'].entries()) expect(bs[i]!.querySelector(`[aria-label="Versão ${l}"]`)).not.toBeNull()
    expect(bs[2]!.textContent).toContain('Título C')
    expect(bs[2]!.querySelector('img')?.getAttribute('src')).toBe('https://blob.example/c.png')
    expect(container.querySelectorAll('.pri')).toHaveLength(0)
    expect(screen.getByRole('group', { name: 'Versões' }).style.getPropertyValue('--n')).toBe('3')
  })
  it('"C venceu" -> venceu_nova n=3 com o título de C; a confirmação diz C', async () => {
    const l = linha('resultado_pronto', { variantes: tresV })
    montar(l)
    fireEvent.click(botao(/C venceu/))
    await waitFor(() => expect(responder).toHaveBeenCalledWith({ registroId: 'reg-1', lido: l.registro!.updatedAt, resposta: 'venceu_nova', n: 3, tituloVisto: 'Título C' }))
    await screen.findByText('Ficou no ar: C')
    expect(screen.getByText('A versão C venceu no Studio e ficou no ar.')).toBeTruthy()
  })
  it('a 390 (CSS): grade em uma coluna, vopt de 44 px; clamp 3 com n=3 ou derivada; overflow-wrap; sem color-mix', async () => {
    const css = await lerCss(`${DIR}dia-14-pergunta.css`)
    expect(css).toMatch(/repeat\(var\(--n, 2\), minmax\(0, 1fr\)\)/)
    expect(css).toMatch(/\[data-n="3"\][^{]*q[^{]*\{\s*-webkit-line-clamp:\s*3/)
    expect(css).toMatch(/\[data-derivada\][^{]*q[^{]*\{\s*-webkit-line-clamp:\s*3/)
    expect(css).toMatch(/\.cn-d14-top q\s*\{[^}]*overflow-wrap:\s*anywhere/)
    const estreito = css.slice(css.indexOf('@container (max-width: 640px)'))
    expect(estreito).toMatch(/\.cn-d14-grid\s*\{\s*grid-template-columns:\s*1fr/)
    expect(estreito).toMatch(/\.cn-d14-vopt\s*\{\s*min-height:\s*44px/)
  })
  it('título de 90 letras sem espaço: o q quebra (overflow-wrap) e leva title com o título completo', () => {
    const longo = 'x'.repeat(90)
    montar(linha('resultado_pronto', { variantes: [{ n: 1, titulo: longo, imagem: null }, duasV[1]!] }))
    const q = screen.getByText(longo)
    expect(q.tagName).toBe('Q')
    expect(q.getAttribute('title')).toBe(longo)
  })
  it('aviso D-7(b) antes de qualquer toque; nada enviado', () => {
    montar(linha('resultado_pronto', { variantes: tresV }))
    expect(screen.getByText('Um toque responde; dá para mudar depois.')).toBeTruthy()
    expect(responder).not.toHaveBeenCalled()
  })
})

describe('Dia14Pergunta: origem derivada', () => {
  it('original conhecida: sem miniatura, apoio da derivada, "A (original) ficou" -> venceu_original n=1 com tituloVisto', async () => {
    const l = derivada(['Novo 1', 'Antes'], 'Antes')
    const { container } = montar(l)
    expect(container.querySelectorAll('img, [data-testid="miniatura-nao-medida"], .cn-d14-th')).toHaveLength(0)
    expect(screen.getByText(FRASES.dia14.apoioDerivada)).toBeTruthy()
    expect(rotulos()).toEqual(['A (original) ficou', 'B venceu'])
    fireEvent.click(botao(/A \(original\) ficou/))
    await waitFor(() => expect(responder).toHaveBeenCalledWith({ registroId: 'reg-1', lido: l.registro!.updatedAt, resposta: 'venceu_original', n: 1, tituloVisto: 'Antes' }))
  })
  it('original desconhecida: apoio D-7(c), "A ficou"/"B ficou", sem "(original)"; "A ficou" -> venceu_nova n=1', async () => {
    const l = derivada(['Um', 'Dois'], null)
    montar(l)
    expect(screen.getByText(FRASES.dia14.apoioDerivadaSemOriginal)).toBeTruthy()
    expect(rotulos()).toEqual(['A ficou', 'B ficou'])
    expect(document.body.textContent).not.toContain('(original)')
    fireEvent.click(botao(/A ficou/))
    await waitFor(() => expect(responder).toHaveBeenCalledWith({ registroId: 'reg-1', lido: l.registro!.updatedAt, resposta: 'venceu_nova', n: 1, tituloVisto: 'Um' }))
  })
})

describe('Dia14Pergunta: versões ilegíveis', () => {
  it('só "Sua resposta:" e a frase D-7(e); sem grade de versões; os três botões enviam sem n', async () => {
    const l = linha('resultado_pronto', { variantes: null, variantesTitulo: null })
    montar(l)
    expect(screen.queryByRole('group', { name: 'Versões' })).toBeNull()
    expect(screen.getByText(FRASES.dia14.apoioSemVersoes)).toBeTruthy()
    expect(screen.getByText('Sua resposta:')).toBeTruthy()
    fireEvent.click(botao('Não vi'))
    await waitFor(() => expect(responder).toHaveBeenCalledWith({ registroId: 'reg-1', lido: l.registro!.updatedAt, resposta: 'nao_vi', n: null }))
  })
})

describe('Dia14Pergunta: enviando', () => {
  it('ao tocar: todos desabilitados com aria-disabled, grupo aria-busy, o tocado diz "Salvando…"; erro volta ao estado anterior com role=alert', async () => {
    let falha: (r: ResultadoAcaoResponder) => void = () => {}
    responder.mockImplementation(() => new Promise((res) => { falha = res }))
    montar(linha('resultado_pronto', { variantes: tresV }))
    fireEvent.click(botao(/C venceu/))
    const todos = screen.getAllByRole('button')
    expect(todos.length).toBeGreaterThanOrEqual(6)
    for (const b of todos) { expect((b as HTMLButtonElement).disabled).toBe(true); expect(b.getAttribute('aria-disabled')).toBe('true') }
    expect(screen.getByRole('group', { name: 'Versões' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: /Salvando…/ }).querySelector('[aria-label="Versão C"]')).not.toBeNull()
    falha({ ok: false, erro: 'falha_escrita' })
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toBe(FRASES.dia14.falhou)
    expect(rotulos()).toEqual(['A (original) ficou', 'B venceu', 'C venceu'])
    expect((botao(/C venceu/) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('Dia14Pergunta: modo mudar', () => {
  const reg3 = (o: Partial<NonNullable<LinhaDoCaminho['registro']>> = {}) =>
    linha('resultado_pronto', { variantes: tresV, respostaDono: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: 'Título novo', ...o })
  const vista = { respostaVista: 'venceu_nova' as const, varianteVista: 2 }

  it('a resposta atual leva aria-pressed, ✓ e "Sua resposta" no lugar do rótulo; os outros não; apoio "Um toque muda a resposta."', () => {
    montar(reg3(), 'mudar', vista)
    const bs = within(screen.getByRole('group', { name: 'Versões' })).getAllByRole('button')
    expect(bs.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(bs[1]!.querySelector('.cn-d14-lbl')?.textContent).toBe('✓ Sua resposta')
    expect(bs[0]!.querySelector('.cn-d14-lbl')?.textContent).toBe('A (original) ficou')
    expect(bs[2]!.querySelector('.cn-d14-lbl')?.textContent).toBe('C venceu')
    expect(screen.getByText('Um toque muda a resposta.')).toBeTruthy()
    expect(screen.queryByText('Um toque responde; dá para mudar depois.')).toBeNull()
  })
  it('resposta sem versão atual: "Ficou igual" leva ✓ + aria-pressed (sem texto "Sua resposta")', () => {
    montar(reg3({ respostaDono: 'ficou_igual', varianteVencedora: null, vencedorTitulo: null }), 'mudar', { respostaVista: 'ficou_igual', varianteVista: null })
    expect(botao(/Ficou igual/).getAttribute('aria-pressed')).toBe('true')
    expect(botao(/Ficou igual/).textContent).toContain('✓')
    expect(botao('Não vi').getAttribute('aria-pressed')).toBe('false')
    expect(document.body.textContent).not.toContain('Sua resposta')
  })
  it('"Manter a resposta atual" é .cn-lnk, fecha e devolve o foco ao link "Mudar minha resposta"', async () => {
    const l = reg3()
    const { container } = render(
      <div className="cn-raiz"><ul><li data-linha="uuid-1"><button type="button" data-acao="mudar-resposta">Mudar minha resposta</button></li></ul><div id="slot" /></div>,
    )
    const link = screen.getByRole('button', { name: 'Mudar minha resposta' })
    link.focus()
    const { unmount } = render(<Dia14Pergunta linha={l} pergunta={versoesDoDia14(l.registro!)} modo="mudar" {...vista} acoes={{ responder, mudar, atualizar }} aoFechar={aoFechar} />, { container: container.querySelector('#slot')! })
    const manter = screen.getByRole('button', { name: 'Manter a resposta atual' })
    expect(manter.className).toContain('cn-lnk')
    fireEvent.click(manter)
    expect(aoFechar).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.activeElement).toBe(link))
    unmount()
  })
  it('Esc fecha como "Manter a resposta atual"', () => {
    montar(reg3(), 'mudar', vista)
    fireEvent.keyDown(screen.getByRole('heading', { name: 'Qual versão venceu no Studio?' }), { key: 'Escape' })
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
  it('"Manter a resposta atual" tem 44 px a 390 (CSS)', async () => {
    const css = await lerCss(`${DIR}dia-14-pergunta.css`)
    expect(css.slice(css.indexOf('@container (max-width: 640px)'))).toMatch(/\.cn-d14 \.cn-lnk\s*\{\s*min-height:\s*44px/)
  })
  it('toque em "C venceu" chama a action de mudar com respostaVista, varianteVista e tituloVisto (e não a de responder)', async () => {
    const l = reg3()
    montar(l, 'mudar', vista)
    fireEvent.click(botao(/C venceu/))
    await waitFor(() => expect(mudar).toHaveBeenCalledWith({
      registroId: 'reg-1', lido: l.registro!.updatedAt, resposta: 'venceu_nova', n: 3, tituloVisto: 'Título C', respostaVista: 'venceu_nova', varianteVista: 2,
    }))
    expect(responder).not.toHaveBeenCalled()
    expect((await screen.findByRole('status')).textContent).toBe('Resposta mudada para C.')
    expect(atualizar).toHaveBeenCalledTimes(1)
  })
  it('estado_mudou: "O teste mudou enquanto a tela estava aberta." + Atualizar relê', async () => {
    mudar.mockResolvedValue({ ok: false, erro: 'estado_mudou' })
    montar(reg3(), 'mudar', vista)
    fireEvent.click(botao(/C venceu/))
    await screen.findByText('O teste mudou enquanto a tela estava aberta.')
    fireEvent.click(botao('Atualizar'))
    expect(atualizar).toHaveBeenCalledTimes(1)
  })
  it('nao_respondida (outra aba apagou a resposta): trata como "mudou", sem texto vazio, e Atualizar relê', async () => {
    mudar.mockResolvedValue({ ok: false, erro: 'nao_respondida' })
    montar(reg3(), 'mudar', vista)
    fireEvent.click(botao(/C venceu/))
    await screen.findByText('O teste mudou enquanto a tela estava aberta.')
    fireEvent.click(botao('Atualizar'))
    expect(atualizar).toHaveBeenCalledTimes(1)
  })
  it('sem_conexao: "Sem conexão. A resposta continua a mesma. Tente de novo." e a pergunta segue aberta', async () => {
    mudar.mockRejectedValueOnce(new Error('rede'))
    montar(reg3(), 'mudar', vista)
    fireEvent.click(botao(/C venceu/))
    await screen.findByText('Sem conexão. A resposta continua a mesma. Tente de novo.')
    expect(screen.getByRole('group', { name: 'Versões' })).toBeTruthy()
    fireEvent.click(botao('Tentar de novo'))
    await screen.findByText('Resposta mudada para C.')
    expect(mudar).toHaveBeenCalledTimes(2)
  })
  it('sem versões no modo mudar: rótulo "Mudar para:"', () => {
    montar(linha('resultado_pronto', { variantes: null, variantesTitulo: null, respostaDono: 'nao_vi' }), 'mudar', { respostaVista: 'nao_vi', varianteVista: null })
    expect(screen.getByText('Mudar para:')).toBeTruthy()
    expect(screen.queryByText('Sua resposta:')).toBeNull()
  })
})

describe('Arquitetura: sem color-mix e sem .pri na pergunta', () => {
  it('caminho-nativo.css, dia-14-*.css e dia-14-*.tsx não usam color-mix(', async () => {
    const fs = await import('node:fs')
    const arquivos = [`${DIR}caminho-nativo.css`, ...fs.readdirSync(DIR).filter((f) => /^dia-14-.*\.css$/.test(f)).map((f) => DIR + f),
      ...fs.readdirSync(`${DIR}caminho-nativo`).filter((f) => /^dia-14-.*\.tsx?$/.test(f)).map((f) => `${DIR}caminho-nativo/${f}`)]
    expect(arquivos.length).toBeGreaterThanOrEqual(4)
    for (const a of arquivos) expect(fs.readFileSync(a, 'utf8'), a).not.toContain('color-mix(')
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

describe('LinhaCaminho: nenhuma linha de dia 14 sem "Responder"', () => {
  const props = (l: LinhaDoCaminho): LinhaCaminhoProps => ({
    l, agora: AGORA, escolhaNosso: false, aoPreferir: vi.fn(), aoAbrirPainel: vi.fn(), aoIniciar: vi.fn(), perguntaAberta: false,
    aoRegistrar: vi.fn(), aoSeguirComNosso: vi.fn(), aoFecharPergunta: vi.fn(), aoAtualizar: atualizar, jaIniciei: vi.fn(),
    responderDia14: responder as unknown as LinhaCaminhoProps['responderDia14'], responderAberta: false, responderPrimario: false, aoMudarResponder: vi.fn(),
  })
  const variantes: [string, Partial<NonNullable<LinhaDoCaminho['registro']>>][] = [
    ['2 versões', {}], ['3 versões', { variantes: tresV }], ['derivada', { variantes: null, variantesTitulo: ['a', 'b'] }], ['sem versões', { variantes: null, variantesTitulo: null }],
  ]
  for (const e of ['resultado_pronto', 'sem_resposta'] as const) {
    for (const [nome, o] of variantes) {
      it(`${e} com ${nome}: botão "Responder" e nenhuma frase de "próxima atualização"`, () => {
        render(<ul><LinhaCaminho {...props(linha(e, o))} /></ul>)
        expect(screen.getByRole('button', { name: 'Responder' })).toBeTruthy()
        expect(document.body.textContent).not.toContain('próxima atualização')
        cleanup()
      })
    }
  }
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

describe('Conserto UI 1 (revisão Logan e Naksu do envio A)', () => {
  const reg3 = (o: Partial<NonNullable<LinhaDoCaminho['registro']>> = {}) =>
    linha('resultado_pronto', { variantes: tresV, respostaDono: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: 'Título novo', ...o })
  const vista = { respostaVista: 'venceu_nova' as const, varianteVista: 2 }

  it('FRASES: confirmações de resposta sem versão e da troca, texto exato; "Resposta mudada." sozinho não existe', () => {
    expect(FRASES.dia14.registrada).toEqual({ ficou_igual: 'Registrado: você respondeu "ficou igual".', inconclusivo: 'Registrado: você respondeu "inconclusivo".', nao_vi: 'Registrado: você respondeu "não vi o resultado".' })
    expect(FRASES.dia14.mudadaSemVersao).toEqual({ ficou_igual: 'Resposta mudada para "ficou igual".', inconclusivo: 'Resposta mudada para "inconclusivo".', nao_vi: 'Resposta mudada para "não vi o resultado".' })
    expect(FRASES.dia14.mudadaPara('C', false)).toBe('Resposta mudada para C.')
    expect(FRASES.dia14.mudadaPara('A', true)).toBe('Resposta mudada para A (original).')
    expect('mudada' in FRASES.dia14).toBe(false)
    expect(FRASES.dia14.fraseOriginal(2)).toBe('A original segurou: a nova não superou.')
    expect(FRASES.dia14.fraseOriginal(3)).toBe('A original segurou: nenhuma das novas superou.')
  })
  it('modo mudar, resposta sem versão: "Resposta mudada para "ficou igual"." e, na original, "A (original)."', async () => {
    montar(reg3(), 'mudar', vista)
    fireEvent.click(botao('Ficou igual'))
    expect((await screen.findByRole('status')).textContent).toBe('Resposta mudada para "ficou igual".')
    cleanup()
    montar(reg3(), 'mudar', vista)
    fireEvent.click(botao(/A \(original\) ficou/))
    expect((await screen.findByRole('status')).textContent).toBe('Resposta mudada para A (original).')
  })
  it('3 versões e a original segura: "nenhuma das novas superou"', async () => {
    montar(linha('resultado_pronto', { variantes: tresV }))
    fireEvent.click(botao(/A \(original\) ficou/))
    await screen.findByText('A original segurou: nenhuma das novas superou.')
  })

  // C1: a tela real desmonta o link ao abrir a pergunta e o remonta no aoFechar.
  function Tela({ l }: { l: LinhaDoCaminho }) {
    const [aberto, setAberto] = React.useState(false)
    return (
      <div className="cn-raiz"><ul><li data-linha="uuid-1">
        {aberto
          ? <Dia14Pergunta linha={l} pergunta={versoesDoDia14(l.registro!)} modo="mudar" {...vista} acoes={{ responder, mudar, atualizar }} aoFechar={() => setAberto(false)} />
          : <button type="button" data-acao="mudar-resposta" onClick={() => setAberto(true)}>Mudar minha resposta</button>}
      </li></ul></div>
    )
  }
  it('C1: com o link desmontado enquanto a pergunta está aberta, "Manter" devolve o foco ao link remontado', async () => {
    render(<Tela l={reg3()} />)
    const link = screen.getByRole('button', { name: 'Mudar minha resposta' })
    link.focus(); fireEvent.click(link)
    expect(screen.queryByRole('button', { name: 'Mudar minha resposta' })).toBeNull()
    fireEvent.click(botao('Manter a resposta atual'))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mudar minha resposta' })))
  })
  it('C1: o Esc também devolve o foco ao link remontado', async () => {
    render(<Tela l={reg3()} />)
    const link = screen.getByRole('button', { name: 'Mudar minha resposta' })
    link.focus(); fireEvent.click(link)
    fireEvent.keyDown(screen.getByRole('heading', { name: 'Qual versão venceu no Studio?' }), { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mudar minha resposta' })))
  })
  const semV = () => linha('resultado_pronto', { variantes: null, variantesTitulo: null, respostaDono: 'nao_vi' })
  it('C2: sem versões no modo mudar, o foco entra no apoio (nome da seção) e o Esc fecha', () => {
    montar(semV(), 'mudar', { respostaVista: 'nao_vi', varianteVista: null })
    const apoio = screen.getByText(FRASES.dia14.apoioSemVersoes)
    expect(document.activeElement).toBe(apoio)
    // Nome curto da seção (o rótulo do grupo), não a frase inteira do apoio.
    expect(screen.getByRole('region', { name: 'Mudar para' })).toBeTruthy()
    fireEvent.keyDown(apoio, { key: 'Escape' })
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
  it('C2: sem versões, o link remontado recebe o foco de volta', async () => {
    render(<Tela l={semV()} />)
    const link = screen.getByRole('button', { name: 'Mudar minha resposta' })
    link.focus(); fireEvent.click(link)
    fireEvent.click(botao('Manter a resposta atual'))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mudar minha resposta' })))
  })

  it('I1: o aviso "antes do toque" fica antes da grade de versões e de "Outra resposta"', () => {
    montar()
    const aviso = screen.getByText(FRASES.dia14.avisoResponder)
    const grade = screen.getByRole('group', { name: 'Versões' })
    const outra = screen.getByRole('group', { name: 'Outra resposta' })
    expect(aviso.compareDocumentPosition(grade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(aviso.compareDocumentPosition(outra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('I2: erro, sem conexão e "mudou" levam o foco para o aviso, não para o título', async () => {
    responder.mockResolvedValueOnce({ ok: false, erro: 'falha_escrita' })
    montar()
    fireEvent.click(botao(/B venceu/))
    expect(document.activeElement?.contains(await screen.findByRole('alert'))).toBe(true)
    cleanup()
    responder.mockRejectedValueOnce(new Error('rede'))
    montar()
    fireEvent.click(botao(/B venceu/))
    await screen.findByText('Sem conexão. Nada foi registrado.')
    expect(document.activeElement?.contains(screen.getByRole('alert'))).toBe(true)
    cleanup()
    responder.mockResolvedValueOnce({ ok: false, erro: 'estado_mudou' })
    montar()
    fireEvent.click(botao(/B venceu/))
    await screen.findByText('O teste mudou enquanto a tela estava aberta.')
    expect(document.activeElement?.contains(screen.getByRole('alert'))).toBe(true)
  })
  it('I3: tocar na resposta atual (versão ou "Outra resposta") só fecha, sem chamar a action', () => {
    montar(reg3(), 'mudar', vista)
    fireEvent.click(botao(/Sua resposta/))
    expect(mudar).not.toHaveBeenCalled()
    expect(aoFechar).toHaveBeenCalledTimes(1)
    cleanup(); aoFechar.mockClear()
    montar(reg3({ respostaDono: 'ficou_igual', varianteVencedora: null, vencedorTitulo: null }), 'mudar', { respostaVista: 'ficou_igual', varianteVista: null })
    fireEvent.click(botao(/Ficou igual/))
    expect(mudar).not.toHaveBeenCalled()
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
  it('I4: durante o envio "Manter" fica desligado e o Esc não fecha; "Tentar de novo" leva aria-disabled', async () => {
    let fim: (r: ResultadoAcaoResponder) => void = () => {}
    mudar.mockImplementation(() => new Promise((res) => { fim = res }))
    montar(reg3(), 'mudar', vista)
    fireEvent.click(botao(/C venceu/))
    const manter = botao('Manter a resposta atual') as HTMLButtonElement
    expect(manter.disabled).toBe(true); expect(manter.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(manter)
    fireEvent.keyDown(screen.getByRole('group', { name: 'Versões' }), { key: 'Escape' })
    expect(aoFechar).not.toHaveBeenCalled()
    fim({ ok: true, conflito: null })
    await screen.findByRole('status')
  })
  it('I4: "Tentar de novo" durante o reenvio está desligado com aria-disabled', async () => {
    responder.mockRejectedValueOnce(new Error('rede'))
    montar()
    fireEvent.click(botao(/B venceu/))
    await screen.findByText('Sem conexão. Nada foi registrado.')
    let fim: (r: ResultadoAcaoResponder) => void = () => {}
    responder.mockImplementation(() => new Promise((res) => { fim = res }))
    fireEvent.click(botao('Tentar de novo'))
    const t = botao('Tentar de novo')
    expect(t.getAttribute('aria-disabled')).toBe('true')
    fim({ ok: true, conflito: null })
    await screen.findByText('Ficou no ar: B')
  })
  it('Naksu I-1 (CSS): resposta atual com borda 2 px em --cn-text, nos cartões e em "Outra resposta"; hover sem cor translúcida', async () => {
    const css = await lerCss(`${DIR}dia-14-pergunta.css`)
    expect(css).toMatch(/\.cn-d14-vopt\[aria-pressed="true"\]\s*\{[^}]*border:\s*2px solid var\(--cn-text\)/)
    expect(css).toMatch(/\.cn-d14-other \.cn-btn\[aria-pressed="true"\]\s*\{[^}]*border:\s*2px solid var\(--cn-text\)/)
    expect(css).toMatch(/\[data-theme="dark"\] \.cn-d14-vopt:hover:not\(\[disabled\]\)\s*\{[^}]*#A89D88/)
    expect(css).toMatch(/\[data-theme="light"\] \.cn-d14-vopt:hover:not\(\[disabled\]\)\s*\{[^}]*#6E624E/)
    expect(css).toMatch(/\.cn-d14-ph\.fail\s*\{[^}]*var\(--cn-err-line\)/)
  })
  it('Naksu I-2: miniatura que não carrega vira "A imagem não carregou", sem ícone quebrado', () => {
    const { container } = montar()
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(screen.getByRole('img', { name: FRASES.ficha.imagemNaoCarregou })).toBeTruthy()
    expect(screen.getAllByTestId('miniatura-nao-medida')).toHaveLength(1)
  })
  it('m-3: dois blocos abertos têm ids próprios (aria-labelledby não aponta para o primeiro)', () => {
    const l = linha('resultado_pronto')
    render(<div className="cn-raiz">{[0, 1].map((i) => <Dia14Pergunta key={i} linha={l} pergunta={versoesDoDia14(l.registro!)} modo="responder" acoes={{ responder, mudar, atualizar }} aoFechar={aoFechar} />)}</div>)
    const ids = screen.getAllByRole('heading', { name: 'Qual versão venceu no Studio?' }).map((h) => h.id)
    expect(new Set(ids).size).toBe(2)
    for (const sec of document.querySelectorAll('section.cn-d14')) expect(sec.getAttribute('aria-labelledby')).toBe(sec.querySelector('h3')!.id)
  })
  it('prazo da frase tardia vem do início do teste (inicio), não do updatedAt', () => {
    montar(linha('sem_resposta', { primeiraVista: null, confirmadoEm: null, updatedAt: dia(0) }))
    const prazo = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(new Date(dia(20)).getTime() + 14 * 86_400_000))
    expect(screen.getByText(`O prazo acabou em ${prazo}. Ainda dá para responder.`)).toBeTruthy()
  })
})
