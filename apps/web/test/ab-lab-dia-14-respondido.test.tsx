// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react'
import * as Sentry from '@sentry/nextjs'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { prazoDoTeste } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES, dataCurta, horaCurta } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { PedidoRespostaDia14, ResultadoAcaoMudar, ResultadoAcaoResponder } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import type { PedidoMudarDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-pergunta'
import { versoesDoDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-estado'
import { Dia14Respondido } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-respondido'
import { Dia14Conflito } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-conflito'
import { ListaCaminho, type AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { ContextoAssistente, SEM_ASSISTENTE } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/assistente-contexto'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const AGORA = new Date('2026-10-22T15:00:00.000Z')
const dia = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const duasV = [{ n: 1, titulo: 'Título original', imagem: null }, { n: 2, titulo: 'Título novo', imagem: { url: 'https://blob.example/b.png' } }]
const tresV = [...duasV, { n: 3, titulo: 'Título C', imagem: { url: 'https://blob.example/c.png' } }]
type Reg = NonNullable<LinhaDoCaminho['registro']>
type EstadoR = 'ficou_no_ar' | 'respostas_diferentes' | 'respondido_sem_vencedor'

function linhaR(estado: EstadoR, reg: Partial<Reg> = {}, id = 'uuid-1'): LinhaDoCaminho {
  return {
    videoId: id, ytId: id === 'uuid-1' ? 'vid00000001' : 'vid00000002', titulo: `Vídeo ${id}`, miniaturaUrl: null, publicadoEm: dia(40), estado,
    caminho: { tipo: 'nativo', portao: true, motivo: 'x' }, fichaId: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300,
    registro: {
      id: 'reg-1', updatedAt: dia(0), inicio: dia(10), confirmadoEm: dia(10), primeiraVista: dia(10), diaDe14: 14,
      variantes: duasV, variantesTitulo: null, campos: ['titulo', 'miniatura'], tituloAntes: null,
      respostaDono: 'venceu_nova', varianteVencedora: 2, respondidoEm: AGORA.toISOString(), respostaMudadaEm: null,
      vencedorFonte: 'dono', vencedorTitulo: 'Título novo', desfechoEm: null, ...reg,
    },
  } as LinhaDoCaminho
}
const conflito = (reg: Partial<Reg> = {}): LinhaDoCaminho => linhaR('respostas_diferentes', {
  respostaDono: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'regra', vencedorTitulo: 'Título original', desfechoEm: dia(17), respondidoEm: dia(16), inicio: dia(30), ...reg,
})
const D = (iso: string): Date => new Date(iso)

let responder: ReturnType<typeof vi.fn<(p: PedidoRespostaDia14) => Promise<ResultadoAcaoResponder>>>
let mudar: ReturnType<typeof vi.fn<(p: PedidoMudarDia14) => Promise<ResultadoAcaoMudar>>>
let atualizar: ReturnType<typeof vi.fn>
beforeEach(() => {
  responder = vi.fn(async () => ({ ok: true, conflito: null }) as ResultadoAcaoResponder)
  mudar = vi.fn(async () => ({ ok: true, conflito: null }) as ResultadoAcaoMudar)
  atualizar = vi.fn()
  vi.mocked(Sentry.captureMessage).mockClear()
})
afterEach(() => { cleanup() })

const bloco = (l: LinhaDoCaminho, agora = AGORA) =>
  render(<div className="cn-raiz"><ul><li data-linha={l.videoId}>
    {l.estado === 'respostas_diferentes'
      ? <Dia14Conflito linha={l} pergunta={versoesDoDia14(l.registro!)} acoes={{ responder, mudar, atualizar }} />
      : <Dia14Respondido linha={l} pergunta={versoesDoDia14(l.registro!)} agora={agora} acoes={{ responder, mudar, atualizar }} />}
  </li></ul></div>)
const botao = (n: RegExp | string) => screen.getByRole('button', { name: n })
const texto = (): string => document.body.textContent ?? ''

describe('Dia14Respondido: com versão no ar', () => {
  it('venceu_nova n=2: selo verde, frase, meta "hoje" com data e hora do relógio injetado', () => {
    const { container } = bloco(linhaR('ficou_no_ar'))
    expect(screen.getByText('Ficou no ar: B')).toBeTruthy()
    expect(container.querySelector('[data-selo="ok"]')).not.toBeNull()
    expect(screen.getByText('A versão B venceu no Studio e ficou no ar.')).toBeTruthy()
    expect(screen.getByText(`Você respondeu hoje, ${dataCurta(AGORA)}, às ${horaCurta(AGORA)}. O resultado oficial está só no Studio.`)).toBeTruthy()
  })
  it('resposta de outro dia: "em dd/mm, às HH:MM", sem "hoje"', () => {
    const q = D(dia(3))
    bloco(linhaR('ficou_no_ar', { respondidoEm: dia(3) }))
    expect(screen.getByText(`Você respondeu em ${dataCurta(q)}, às ${horaCurta(q)}. O resultado oficial está só no Studio.`)).toBeTruthy()
    expect(texto()).not.toContain('respondeu hoje')
  })
  it('venceu_original: "Ficou no ar: A (original)" e "A original segurou: a nova não superou."; nunca "a nova ganhou"', () => {
    bloco(linhaR('ficou_no_ar', { respostaDono: 'venceu_original', varianteVencedora: 1, vencedorTitulo: 'Título original' }))
    expect(screen.getByText('Ficou no ar: A (original)')).toBeTruthy()
    expect(screen.getByText('A original segurou: a nova não superou.')).toBeTruthy()
    expect(texto()).not.toMatch(/nova ganhou/)
  })
  it('3 versões: C no ar', () => {
    bloco(linhaR('ficou_no_ar', { variantes: tresV, varianteVencedora: 3, vencedorTitulo: 'Título C' }))
    expect(screen.getByText('Ficou no ar: C')).toBeTruthy()
    expect(screen.getByText('A versão C venceu no Studio e ficou no ar.')).toBeTruthy()
  })
  it('derivada sem original: "Ficou no ar: <título>", sem "original" nem "nova ganhou"', () => {
    bloco(linhaR('ficou_no_ar', { variantes: null, variantesTitulo: ['Um', 'Dois'], tituloAntes: null, campos: null, varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: 'Dois' }))
    expect(screen.getByText('Ficou no ar: Dois')).toBeTruthy()
    expect(texto().toLowerCase()).not.toContain('original')
    expect(texto()).not.toMatch(/nova ganhou/)
  })
  it('tardia (1ª resposta depois do prazo): "Você respondeu em dd/mm, depois do prazo (dd/mm)."', () => {
    const l = linhaR('ficou_no_ar', { inicio: dia(30), respondidoEm: dia(5) })
    bloco(l)
    const prazo = prazoDoTeste(l.registro!.inicio)
    expect(screen.getByText(`Você respondeu em ${dataCurta(D(dia(5)))}, depois do prazo (${dataCurta(prazo)}). O resultado oficial está só no Studio.`)).toBeTruthy()
  })
  it('1ª resposta no prazo + troca depois do prazo: nunca "depois do prazo"; mostra "Resposta mudada em dd/mm, às HH:MM."', () => {
    const mud = D(dia(1))
    bloco(linhaR('ficou_no_ar', { inicio: dia(16), respondidoEm: dia(15), respostaMudadaEm: dia(1) }))
    expect(texto()).not.toContain('depois do prazo')
    expect(screen.getByText(`Resposta mudada em ${dataCurta(mud)}, às ${horaCurta(mud)}.`)).toBeTruthy()
  })
  it('respostaMudadaEm nulo: nunca "mudada em null" nem linha de troca', () => {
    bloco(linhaR('ficou_no_ar'))
    expect(texto()).not.toMatch(/mudada em/i)
    expect(texto()).not.toContain('null')
  })
  it('o foco-alvo do bloco é o <p class="cn-d14-q3"> com tabindex -1', () => {
    const { container } = bloco(linhaR('ficou_no_ar'))
    const q3 = container.querySelector('.cn-d14-q3') as HTMLElement
    expect(q3.getAttribute('tabindex')).toBe('-1')
    expect(q3.tagName).toBe('P')
  })
})

describe('Dia14Respondido: sem vencedor (D-7(a))', () => {
  const sv = (reg: Partial<Reg> = {}) => linhaR('respondido_sem_vencedor', { respostaDono: 'ficou_igual', varianteVencedora: null, vencedorFonte: 'dono', vencedorTitulo: null, ...reg })
  it('selo neutro, título "Você respondeu: …", meta "Respondido hoje …", apoio fixo; sem "Nada ficou registrado" nem "Ficou no ar"', () => {
    const { container } = bloco(sv())
    expect(container.querySelector('[data-selo="mute-neq"]')).not.toBeNull()
    expect(screen.getByText('Você respondeu: ficou igual.')).toBeTruthy()
    expect(screen.getByText(`Respondido hoje, ${dataCurta(AGORA)}, às ${horaCurta(AGORA)}. O resultado oficial está só no Studio.`)).toBeTruthy()
    expect(screen.getByText('Nenhuma versão ficou registrada como vencedora.')).toBeTruthy()
    expect(texto()).not.toContain('Nada ficou registrado')
    expect(texto()).not.toContain('Ficou no ar')
  })
  it('as três respostas dão os três títulos', () => {
    for (const [r, t] of [['ficou_igual', 'Você respondeu: ficou igual.'], ['inconclusivo', 'Você respondeu: inconclusivo.'], ['nao_vi', 'Você respondeu: não vi o resultado.']] as const) {
      bloco(sv({ respostaDono: r }))
      expect(screen.getByText(t)).toBeTruthy()
      cleanup()
    }
  })
  it('tardia (1ª resposta): "Respondido em dd/mm, depois do prazo (dd/mm)."; o sujeito não repete', () => {
    const l = sv({ inicio: dia(30), respondidoEm: dia(5) })
    bloco(l)
    expect(screen.getByText(`Respondido em ${dataCurta(D(dia(5)))}, depois do prazo (${dataCurta(prazoDoTeste(l.registro!.inicio))}).`)).toBeTruthy()
    expect(texto().match(/Você respondeu/g)).toHaveLength(1)
  })
  it('com veredito do Lab (regra): apoio "No ar, lido pelo Lab em dd/mm: [chip A]. Você não indicou uma versão."', () => {
    const { container } = bloco(sv({ vencedorFonte: 'regra', vencedorTitulo: 'Título original', desfechoEm: dia(10) }))
    const apoio = screen.getByText(/^No ar, lido pelo Lab em/)
    expect(apoio.textContent).toContain(`em ${dataCurta(D(dia(10)))}:`)
    expect(apoio.textContent).toContain('Você não indicou uma versão.')
    expect(apoio.querySelector('[aria-label="Versão A"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Nenhuma versão ficou registrada')
  })
  it('veredito sem par: título cru sem chip; desfechoEm nulo: sem data', () => {
    bloco(sv({ vencedorFonte: 'regra', vencedorTitulo: 'Outro título qualquer', desfechoEm: null }))
    const apoio = screen.getByText(/^No ar, lido pelo Lab: /)
    expect(apoio.textContent).toContain('Outro título qualquer')
    expect(apoio.querySelector('.cn-chip')).toBeNull()
  })
})

describe('Dia14Conflito', () => {
  it('selo, título "No ar estava A; você disse B.", meta do mockup, dois cartões sem destaque', () => {
    const l = conflito()
    const { container } = bloco(l)
    expect(container.querySelector('[data-selo="mute-neq"]')?.textContent).toBe('Respostas diferentes')
    expect(screen.getByRole('heading', { name: 'No ar estava A; você disse B.' })).toBeTruthy()
    expect(screen.getByText(FRASES.conflito.meta)).toBeTruthy()
    const cartoes = container.querySelectorAll('.cn-d14-cf > div')
    expect(cartoes).toHaveLength(2)
    expect(cartoes[0]!.className).toBe(cartoes[1]!.className)
    expect(container.querySelectorAll('.pri')).toHaveLength(0)
    expect(within(cartoes[0] as HTMLElement).getByText(`No ar, lido pelo Lab em ${dataCurta(D(dia(17)))}`)).toBeTruthy()
    expect(cartoes[0]!.querySelector('[aria-label="Versão A"]')).not.toBeNull()
    expect(cartoes[0]!.textContent).toContain('Título original')
    const q = D(dia(16))
    expect(within(cartoes[1] as HTMLElement).getByText(`Você disse: B (${dataCurta(q)}, ${horaCurta(q)})`)).toBeTruthy()
    expect(cartoes[1]!.querySelector('[aria-label="Versão B"]')).not.toBeNull()
  })
  it('o cartão "Você disse" usa a data da resposta atual (respostaMudadaEm) quando há troca', () => {
    const m = D(dia(2))
    bloco(conflito({ respostaMudadaEm: dia(2) }))
    expect(screen.getByText(`Você disse: B (${dataCurta(m)}, ${horaCurta(m)})`)).toBeTruthy()
  })
  it('sem par: título D-7(d), slot do chip unk com aria-label e a mesma estrutura de .top', () => {
    const { container } = bloco(conflito({ vencedorTitulo: 'Título que não é nenhuma versão' }))
    expect(screen.getByRole('heading', { name: 'No ar está um título que não é nenhuma das versões; você disse B.' })).toBeTruthy()
    const tops = container.querySelectorAll('.cn-d14-cf .cn-d14-top')
    expect(tops).toHaveLength(2)
    expect(tops[0]!.querySelector('.cn-chip.unk[aria-label="Título sem versão correspondente"]')).not.toBeNull()
    expect(tops[0]!.querySelector('q')?.textContent).toBe('Título que não é nenhuma versão')
    expect(tops[0]!.children.length).toBe(tops[1]!.children.length)
  })
  it('desfechoEm nulo: "No ar, lido pelo Lab" sem data; respostaMudadaEm nulo nunca vira "mudada em null"', () => {
    bloco(conflito({ desfechoEm: null }))
    expect(screen.getByText('No ar, lido pelo Lab')).toBeTruthy()
    expect(texto()).not.toContain('null')
  })
  it('título hostil de 90 letras sem espaço: o q tem title e a CSS quebra (overflow-wrap) nos cartões e no h3', async () => {
    const longo = 'x'.repeat(90)
    bloco(conflito({ variantes: [{ n: 1, titulo: longo, imagem: null }, duasV[1]!], vencedorTitulo: longo }))
    expect(screen.getAllByText(longo)[0]!.getAttribute('title')).toBe(longo)
    const css = (await import('node:fs')).readFileSync('src/app/cms/(authed)/youtube/ab-lab/_components/dia-14-pergunta.css', 'utf8')
    expect(css).toMatch(/\.cn-d14-cf q\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.cn-d14 h3\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.cn-d14-q3\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/scroll-margin-top/)
  })
})

describe('Mudar minha resposta (bloco direto)', () => {
  it('abre a pergunta em modo mudar sem 2º toque, sem .pri; a atual leva aria-pressed e ✓', () => {
    const { container } = bloco(linhaR('ficou_no_ar', { variantes: tresV, varianteVencedora: 2 }))
    fireEvent.click(botao('Mudar minha resposta'))
    const bs = within(screen.getByRole('group', { name: 'Versões' })).getAllByRole('button')
    expect(bs.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(bs[1]!.querySelector('.cn-d14-lbl')?.textContent).toBe('✓ Sua resposta')
    expect(container.querySelectorAll('.pri')).toHaveLength(0)
    expect(screen.getByText('Um toque muda a resposta.')).toBeTruthy()
  })
  it('"Manter a resposta atual" volta ao bloco com o foco no link', async () => {
    bloco(linhaR('ficou_no_ar'))
    botao('Mudar minha resposta').focus()
    fireEvent.click(botao('Mudar minha resposta'))
    fireEvent.click(botao('Manter a resposta atual'))
    await waitFor(() => expect(document.activeElement).toBe(botao('Mudar minha resposta')))
    expect(screen.getByText('A versão B venceu no Studio e ficou no ar.')).toBeTruthy()
    expect(mudar).not.toHaveBeenCalled()
  })
  it('Esc volta ao bloco com o foco no link', async () => {
    bloco(linhaR('ficou_no_ar'))
    fireEvent.click(botao('Mudar minha resposta'))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Versões' }), { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(botao('Mudar minha resposta')))
  })
  it('toque em "C venceu" chama a action com respostaVista e varianteVista', async () => {
    const l = linhaR('ficou_no_ar', { variantes: tresV, varianteVencedora: 2 })
    bloco(l)
    fireEvent.click(botao('Mudar minha resposta'))
    fireEvent.click(botao(/C venceu/))
    await waitFor(() => expect(mudar).toHaveBeenCalledWith({
      registroId: 'reg-1', lido: l.registro!.updatedAt, resposta: 'venceu_nova', n: 3, tituloVisto: 'Título C', respostaVista: 'venceu_nova', varianteVista: 2,
    }))
  })
  it('em sem_versoes: "Mudar para:" e a atual só com ✓ + aria-pressed', () => {
    bloco(linhaR('respondido_sem_vencedor', { variantes: null, variantesTitulo: null, respostaDono: 'nao_vi', varianteVencedora: null, vencedorFonte: 'dono', vencedorTitulo: null }))
    fireEvent.click(botao('Mudar minha resposta'))
    expect(screen.getByText('Mudar para:')).toBeTruthy()
    expect(botao(/Não vi/).getAttribute('aria-pressed')).toBe('true')
    expect(botao(/Ficou igual/).getAttribute('aria-pressed')).toBe('false')
    expect(texto()).not.toContain('Sua resposta:')
  })
  it('conflito: o link também troca o bloco pela pergunta, com a atual marcada', () => {
    bloco(conflito())
    fireEvent.click(botao('Mudar minha resposta'))
    expect(within(screen.getByRole('group', { name: 'Versões' })).getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
  })
  it('estado_mudou / nao_respondida: "O teste mudou enquanto a tela estava aberta." + Atualizar', async () => {
    for (const erro of ['estado_mudou', 'nao_respondida'] as const) {
      mudar.mockResolvedValue({ ok: false, erro } as ResultadoAcaoMudar)
      bloco(linhaR('ficou_no_ar'))
      fireEvent.click(botao('Mudar minha resposta'))
      fireEvent.click(botao(/A \(original\) ficou/))
      await screen.findByText('O teste mudou enquanto a tela estava aberta.')
      fireEvent.click(botao('Atualizar'))
      expect(atualizar).toHaveBeenCalled()
      cleanup()
    }
  })
  it('rede cai: sem_conexao com a mensagem de D-7(g), pergunta aberta', async () => {
    mudar.mockRejectedValueOnce(new Error('network'))
    bloco(linhaR('ficou_no_ar'))
    fireEvent.click(botao('Mudar minha resposta'))
    fireEvent.click(botao(/A \(original\) ficou/))
    await screen.findByText('Sem conexão. A resposta continua a mesma. Tente de novo.')
    expect(screen.getByRole('group', { name: 'Versões' })).toBeTruthy()
  })
  it('resposta pedida já gravada: ok sem erro falso (anuncia a troca)', async () => {
    bloco(linhaR('ficou_no_ar'))
    fireEvent.click(botao('Mudar minha resposta'))
    fireEvent.click(botao(/A \(original\) ficou/))
    expect((await screen.findByRole('status')).textContent).toBe('Resposta mudada para A (original).')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

// ---- na lista ----
describe('ListaCaminho: bloco na própria linha', () => {
  let atualizarCtx: ReturnType<typeof vi.fn>
  const acoes = () => ({ responderTesteDoYouTube: responder, mudarRespostaDoTesteDoYouTube: mudar } as unknown as AcoesCaminho)
  const tela = (linhas: LinhaDoCaminho[], videoInicial: string | null = null) => (
    <ContextoAssistente.Provider value={{ ...SEM_ASSISTENTE, atualizar: atualizarCtx }}>
      <ListaCaminho linhas={linhas} videoInicial={videoInicial} acoes={acoes()} painel={() => null} agora={() => AGORA} />
    </ContextoAssistente.Provider>
  )
  beforeEach(() => { atualizarCtx = vi.fn() })
  const li = (id = 'uuid-1') => document.querySelector(`li[data-linha="${id}"]`) as HTMLElement

  it('"Ver teste" (ficou_no_ar) abre o bloco na própria linha com o foco no título; a vizinha fica intacta', () => {
    render(tela([linhaR('ficou_no_ar'), linhaR('ficou_no_ar', { respostaDono: 'venceu_original', varianteVencedora: 1 }, 'uuid-2')]))
    const antes = li('uuid-2').innerHTML
    fireEvent.click(within(li()).getByRole('button', { name: 'Ver teste' }))
    expect(li().querySelector('.cn-d14')).not.toBeNull()
    expect(document.activeElement).toBe(li().querySelector('.cn-d14-q3'))
    expect(li('uuid-2').innerHTML).toBe(antes)
    expect(li('uuid-2').querySelector('.cn-d14')).toBeNull()
  })
  it('"Ver teste" (respondido sem vencedor) e "Ver as duas" (conflito) abrem o bloco', () => {
    render(tela([linhaR('respondido_sem_vencedor', { respostaDono: 'inconclusivo', varianteVencedora: null }), conflito()].map((l, i) => ({ ...l, videoId: `u${i}`, ytId: `vid0000000${i}` }))))
    fireEvent.click(within(li('u0')).getByRole('button', { name: 'Ver teste' }))
    expect(within(li('u0')).getByText('Você respondeu: inconclusivo.')).toBeTruthy()
    fireEvent.click(within(li('u1')).getByRole('button', { name: 'Ver as duas' }))
    expect(within(li('u1')).getByRole('heading', { name: 'No ar estava A; você disse B.' })).toBeTruthy()
  })
  it('linha do conflito: selo mute-neq + "No ar está A; você disse B." (presente no tempo da lista)', () => {
    render(tela([conflito()]))
    expect(li().querySelector('[data-selo="mute-neq"]')).not.toBeNull()
    expect(within(li()).getByText('No ar está A; você disse B.')).toBeTruthy()
    fireEvent.click(within(li()).getByRole('button', { name: 'Ver as duas' }))
    expect(within(li()).getByText('No ar está A; você disse B.')).toBeTruthy()
    expect(within(li()).getByRole('heading', { name: 'No ar estava A; você disse B.' })).toBeTruthy()
  })
  it('conflito sem par: a linha diz "No ar está outro título; você disse B."', () => {
    render(tela([conflito({ vencedorTitulo: 'Qualquer outro' })]))
    expect(within(li()).getByText('No ar está outro título; você disse B.')).toBeTruthy()
  })
  it('?video= de ficou_no_ar abre o respondido; de respostas_diferentes abre o conflito', () => {
    render(tela([linhaR('ficou_no_ar')], 'vid00000001'))
    expect(within(li()).getByText('A versão B venceu no Studio e ficou no ar.')).toBeTruthy()
    cleanup()
    render(tela([conflito()], 'vid00000001'))
    expect(within(li()).getByRole('heading', { name: 'No ar estava A; você disse B.' })).toBeTruthy()
    expect(document.activeElement).toBe(li().querySelector('[data-foco-bloco]'))
  })
  it('mudar na lista: trocar para C chama a action; a linha relida mostra o respondido novo e o anúncio fica fora do bloco', async () => {
    const l0 = linhaR('ficou_no_ar', { variantes: tresV, varianteVencedora: 2 })
    const { rerender } = render(tela([l0], 'vid00000001'))
    fireEvent.click(within(li()).getByRole('button', { name: 'Mudar minha resposta' }))
    fireEvent.click(within(li()).getByRole('button', { name: /C venceu/ }))
    await waitFor(() => expect(mudar).toHaveBeenCalledTimes(1))
    expect(mudar.mock.calls[0]![0]).toMatchObject({ respostaVista: 'venceu_nova', varianteVista: 2, n: 3 })
    await waitFor(() => expect(atualizarCtx).toHaveBeenCalled())
    const l1 = linhaR('ficou_no_ar', { variantes: tresV, varianteVencedora: 3, vencedorTitulo: 'Título C', updatedAt: new Date(AGORA.getTime() + 1000).toISOString(), respostaMudadaEm: AGORA.toISOString() })
    rerender(tela([l1], 'vid00000001'))
    await waitFor(() => expect(within(li()).getByText('A versão C venceu no Studio e ficou no ar.')).toBeTruthy())
    await waitFor(() => expect(screen.getAllByRole('status').some((s) => s.textContent === 'Resposta mudada para C.')).toBe(true))
    const status = screen.getAllByRole('status').find((s) => s.textContent === 'Resposta mudada para C.')!
    expect(li().contains(status)).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(within(li()).getByRole('button', { name: 'Mudar minha resposta' })))
  })
  it('sem mudança de dado depois do ok, a confirmação fica (nunca volta ao dado velho) e oferece Atualizar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(tela([linhaR('ficou_no_ar')], 'vid00000001'))
      fireEvent.click(within(li()).getByRole('button', { name: 'Mudar minha resposta' }))
      fireEvent.click(within(li()).getByRole('button', { name: /A \(original\) ficou/ }))
      await waitFor(() => expect(mudar).toHaveBeenCalled())
      await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
      expect(within(li()).queryByText(FRASES.dia14.trocaSemReleitura)).toBeNull()
      await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
      expect(within(li()).queryByRole('button', { name: 'Mudar minha resposta' })).toBeNull()
      expect(within(li()).queryByText('Ficou no ar: A (original)')).toBeNull()
      expect(within(li()).getByText(FRASES.dia14.trocaSemReleitura)).toBeTruthy()
      atualizarCtx.mockClear()
      fireEvent.click(within(li()).getByRole('button', { name: 'Atualizar' }))
      expect(atualizarCtx).toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
  it('1ª resposta: depois de relida a linha, o foco cai no link "Mudar minha resposta" (não no body) e a linha mostra o respondido', async () => {
    const aberta: LinhaDoCaminho = { ...linhaR('ficou_no_ar'), estado: 'resultado_pronto' as LinhaDoCaminho['estado'] }
    aberta.registro = { ...aberta.registro!, respostaDono: null, respondidoEm: null, varianteVencedora: null, vencedorFonte: null, vencedorTitulo: null }
    const { rerender } = render(tela([aberta], 'vid00000001'))
    fireEvent.click(within(li()).getByRole('button', { name: /B venceu/ }))
    await waitFor(() => expect(responder).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(atualizarCtx).toHaveBeenCalled())
    const q3 = li().querySelector('.cn-d14-q3') as HTMLElement
    expect(document.activeElement).toBe(q3)
    expect(q3.getAttribute('tabindex')).toBe('-1')
    await waitFor(() => expect(screen.getByTestId('anuncio-dia-14').textContent).toBe('Registrado: a versão B ficou no ar.'))
    expect(li().querySelector('[role="status"]')).toBeNull()
    rerender(tela([linhaR('ficou_no_ar')], 'vid00000001'))
    await waitFor(() => expect(document.activeElement).toBe(within(li()).getByRole('button', { name: 'Mudar minha resposta' })))
    expect(within(li()).getByText('Ficou no ar: B')).toBeTruthy()
  })
  it('1ª resposta com ja_respondido: "Você já tinha respondido em outra tela." + Atualizar', async () => {
    responder.mockResolvedValue({ ok: false, erro: 'ja_respondido' })
    const aberta: LinhaDoCaminho = { ...linhaR('ficou_no_ar'), estado: 'resultado_pronto' as LinhaDoCaminho['estado'] }
    aberta.registro = { ...aberta.registro!, respostaDono: null }
    render(tela([aberta], 'vid00000001'))
    fireEvent.click(within(li()).getByRole('button', { name: /B venceu/ }))
    await screen.findByText('Você já tinha respondido em outra tela.')
    fireEvent.click(botao('Atualizar'))
    expect(atualizarCtx).toHaveBeenCalled()
  })
  it('no máximo 1 .pri no DOM com o bloco aberto', () => {
    const { container } = render(tela([conflito(), linhaR('ficou_no_ar', {}, 'uuid-2')], 'vid00000001'))
    expect(container.querySelectorAll('.pri').length).toBeLessThanOrEqual(1)
  })
})

describe('Minors da T6 e fonte única das frases (lote da T7)', () => {
  it('CSS: o hover não tira a borda de 2 px da resposta atual (regra com [data-theme], acima do hover do .cn-btn e do vopt)', async () => {
    const css = (await import('node:fs')).readFileSync('src/app/cms/(authed)/youtube/ab-lab/_components/dia-14-pergunta.css', 'utf8')
    expect(css).toMatch(/\[data-theme\] \.cn-d14-vopt\[aria-pressed="true"\]:hover:not\(\[disabled\]\)[^{]*\{\s*border:\s*2px solid var\(--cn-text\)/)
    expect(css).toMatch(/\[data-theme\] \.cn-d14-other \.cn-btn\[aria-pressed="true"\]:hover/)
  })
  it('FRASES: as chaves duplicadas de respondido.* saíram (a fonte é dia14.*)', () => {
    for (const k of ['manter', 'suaResposta', 'avisoMudar', 'semConexao', 'mudadaPara']) expect(k in FRASES.respondido, k).toBe(false)
  })
})

describe('Conserto B1 (revisão Logan e Naksu do envio B)', () => {
  const lerCss = async (f: string): Promise<string> => (await import('node:fs')).readFileSync(`src/app/cms/(authed)/youtube/ab-lab/_components/${f}`, 'utf8')
  const tela = (linhas: LinhaDoCaminho[], videoInicial: string | null = null) => (
    <ContextoAssistente.Provider value={{ ...SEM_ASSISTENTE, atualizar: vi.fn() }}>
      <ListaCaminho linhas={linhas} videoInicial={videoInicial} acoes={{ responderTesteDoYouTube: responder, mudarRespostaDoTesteDoYouTube: mudar } as unknown as AcoesCaminho} painel={() => null} agora={() => AGORA} />
    </ContextoAssistente.Provider>
  )
  const li = (id = 'uuid-1') => document.querySelector(`li[data-linha="${id}"]`) as HTMLElement
  const semPar = (): LinhaDoCaminho => linhaR('ficou_no_ar', { variantes: null, variantesTitulo: null, vencedorTitulo: 'Título lido pelo Lab' })

  it('C-1: o selo da linha quebra de linha (regra própria para .cn-vrow .st .cn-selo)', async () => {
    const css = await lerCss('caminho-nativo.css') + await lerCss('dia-14-pergunta.css')
    expect(css).toMatch(/\.cn-vrow \.st \.cn-selo[^{]*\{[^}]*white-space:\s*normal/)
  })
  it('I-4: o botão com aria-expanded="true" tem estado visível', async () => {
    expect(await lerCss('caminho-nativo.css')).toMatch(/\.cn-btn\[aria-expanded="true"\][^{]*\{[^}]*border:\s*2px solid var\(--cn-text\)/)
  })
  it('I2: derivada respondida sem par diz o título no ar na linha e no bloco', () => {
    render(tela([semPar()]))
    expect(within(li()).getByText('Ficou no ar: Título lido pelo Lab')).toBeTruthy()
    fireEvent.click(within(li()).getByRole('button', { name: 'Ver teste' }))
    expect(within(li()).getByText('Ficou no ar: Título lido pelo Lab')).toBeTruthy()
  })
  it('I2: sem par e sem título lido, o selo genérico (de FRASES)', () => {
    render(tela([linhaR('ficou_no_ar', { variantes: null, variantesTitulo: null, vencedorTitulo: null })]))
    expect(within(li()).getByText(FRASES.dia14.seloNoArSemTitulo)).toBeTruthy()
  })
  it('I3: com o bloco do conflito aberto há um só "Respostas diferentes" e a frase não repete na tela', () => {
    render(tela([conflito()]))
    fireEvent.click(within(li()).getByRole('button', { name: 'Ver as duas' }))
    expect(within(li()).getAllByText('Respostas diferentes')).toHaveLength(1)
    expect(within(li()).getAllByText(/No ar est(á|ava) A; você disse B\./).filter((e) => !e.closest('.cn-sr, h3'))).toHaveLength(1)
    expect(li().querySelector('[data-foco-bloco]')).not.toBeNull()
  })
  it('I-3: a 1ª resposta é anunciada na região da lista, não numa região que nasce junto com o texto', async () => {
    const aberta: LinhaDoCaminho = { ...linhaR('ficou_no_ar'), estado: 'resultado_pronto' as LinhaDoCaminho['estado'] }
    aberta.registro = { ...aberta.registro!, respostaDono: null }
    render(tela([aberta]))
    fireEvent.click(within(li()).getByRole('button', { name: 'Responder' }))
    fireEvent.click(within(li()).getByRole('button', { name: /B venceu/ }))
    await waitFor(() => expect(screen.getByTestId('anuncio-dia-14').textContent).toMatch(/^Registrado/))
  })
  it('M3 Logan: o cartão "Você disse" sem par não usa o rótulo do lado do Lab', () => {
    bloco(conflito({ varianteVencedora: 3 }))
    expect(screen.getAllByLabelText(FRASES.conflito.seloRespostaSemPar).length).toBe(1)
  })
  it('m-1: sem selo nem meta (bloco aberto) a linha não deixa a faixa .st vazia', () => {
    render(tela([linhaR('ficou_no_ar')], 'vid00000001'))
    expect(li().querySelector('.st')).toBeNull()
  })
  it('m-7: textos soltos vivem em FRASES', () => {
    expect(FRASES.respondido.respondeuEm(AGORA)).toBe(`Você respondeu em ${dataCurta(AGORA)}.`)
  })
})
