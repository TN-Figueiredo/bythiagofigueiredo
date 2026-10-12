// @vitest-environment jsdom
// A4 Tarefa 14: o cartão "Só o seu canal mede" da comparação (mockup aprovado em 12/10: comparar-so-seu-canal.html). Aqui: o modelo (o que o servidor
// monta e o que o navegador escolhe), a tela (jsdom) e o CSS. A prova de segurança de ROTA é o arquivo ao lado (-seguranca). Este sistema falha em
// VERDE: cada caso de dado ausente afirma o valor nulo E a frase.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { AlcanceLinha, DiarioCanal, Privado, AlcanceCanal } from '@/lib/youtube/observatorio/proprio/tipos'
import { canalDe, pacoteDe, type OpcoesCanal } from './par-helpers'
import { NUMEROS } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'
import type { CompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import {
  buildSoSeuCanal, montarSoSeuCanalDado, type SoSeuCanalDado, type SoSeuCanalView,
} from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import { proprioWorld, alcanceComLinhas, alcanceVazio, alcanceNadaLido, alcanceCheio } from './proprio-fixture'
import { diarioComPct } from './proprio-assistido-fixture'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))

const W = proprioWorld() // lido uma vez por arquivo
const { obs, canalId, ytIds, hoje, dm } = W
const d = (n: number) => addDays(hoje, -n)
const F = obs.fmt

const ok = <T,>(dado: T): Privado<T> => ({ acesso: 'ok', dado })
const NEGADO: Privado<never> = { acesso: 'negado' }
const ERRO: Privado<never> = { acesso: 'erro' }

/** Alcance: 140 impressões e 3 cliques estimados (100 × 3% + 40 × 0%), dois vídeos, dois dias. */
const LINHAS_3_DE_140: AlcanceLinha[] = [
  { ytId: ytIds[0]!, dia: d(5), imp: 100, ctr: 0.03 },
  { ytId: ytIds[1]!, dia: d(6), imp: 40, ctr: 0 },
]
const alc3de140 = (): Privado<AlcanceCanal> => ok(alcanceComLinhas(canalId, hoje, LINHAS_3_DE_140))
const diarioPct = (plano: Array<{ dias: number; views: number; pct: number | null }>): Privado<DiarioCanal> => ok(diarioComPct(canalId, ytIds, hoje, plano))
/** 28 dias × 6 views = 168 views, 55% assistido. */
const DIARIO_CHEIO = (): Privado<DiarioCanal> => diarioPct([{ dias: 28, views: 6, pct: 55 }])

const monta = (alcance: Privado<AlcanceCanal>, diario: Privado<DiarioCanal>, nome = 'tnFigueiredo'): SoSeuCanalDado =>
  montarSoSeuCanalDado({ nome, alcance, diario, longos: ytIds, dm, F })
const viewDe = (dado: SoSeuCanalDado): SoSeuCanalView => { if (!dado.view) throw new Error('sem view'); return dado.view }
const linha = (v: SoSeuCanalView, chave: SoSeuCanalView['linhas'][number]['chave']) => v.linhas.find(l => l.chave === chave)!

const eu = { id: 'eu', name: 'tnFigueiredo', own: true }
const eu2 = { id: 'eu2', name: 'Thiago Figueiredo', own: true }
const leo = { id: 'c1', name: 'Leo Khev', own: false }
const ana = { id: 'c2', name: 'Ana Viaja', own: false }

describe('14 modelo: buildSoSeuCanal', () => {
  it('nenhum lado é canal seu: nenhum cartão', () => {
    const dados = { eu: monta(alc3de140(), DIARIO_CHEIO()) }
    expect(buildSoSeuCanal({ a: leo, b: ana }, dados)).toEqual([])
    expect(buildSoSeuCanal({ a: leo, b: ana }, {})).toEqual([])
  })

  it('um lado é canal seu: quatro linhas (impressões, cliques estimados, taxa de clique, % assistido) e a frase "não porque sejam zero"', () => {
    const dados = { eu: monta(alc3de140(), DIARIO_CHEIO()) }
    for (const par of [{ a: eu, b: leo }, { a: leo, b: eu }]) {
      const vs = buildSoSeuCanal(par, dados)
      expect(vs).toHaveLength(1)
      const v = vs[0]!
      expect(v.canal).toBe('tnFigueiredo')
      expect(v.naoMedido).toBe(false)
      expect(v.linhas.map(l => l.chave)).toEqual(['impressoes', 'cliques', 'taxa', 'assistido'])
      expect(v.linhas.map(l => l.rotulo)).toEqual(['Impressões', 'Cliques estimados', 'Taxa de clique', '% assistido'])
      expect(v.frase).toBe('Impressões, taxa de clique e % assistido só chegam ao dono do canal. Leo Khev não tem esses números aqui porque o YouTube não os entrega, não porque sejam zero.')
      // impressões: o total e o período; cliques: o arredondado, com a conta no sub
      expect(linha(v, 'impressoes')).toMatchObject({ valor: '140', sub: `de ${dm(d(21))} a ${dm(d(1))}`, fraco: false })
      expect(linha(v, 'cliques')).toMatchObject({ valor: '3', sub: 'impressões × taxa de cada dia' })
      expect(linha(v, 'taxa').sub).toBe('com intervalo de 95%')
      expect(linha(v, 'assistido')).toMatchObject({ valor: '55%', sub: 'média pelas views, 28 dias', nota: null, fraco: false })
    }
  })

  it('o canal do outro lado que também é seu não leva a frase de "não tem esses números"', () => {
    const [a, b] = buildSoSeuCanal({ a: eu, b: eu2 }, { eu: monta(alc3de140(), DIARIO_CHEIO()), eu2: monta(alc3de140(), DIARIO_CHEIO(), 'Thiago Figueiredo') })
    expect(a!.frase).toBe('Impressões, taxa de clique e % assistido só chegam ao dono do canal.')
    expect(b!.frase).toBe(a!.frase)
  })

  it('taxa de clique: 3 de 140 mostra 2,1% e "entre 0,7% e 6,1%"; o "%" só aparece com o intervalo ao lado', () => {
    const v = viewDe(monta(alc3de140(), DIARIO_CHEIO()))
    const t = linha(v, 'taxa')
    expect(t.valor).toBe('2,1%')
    // 0,7% a 6,1% são 5,4 pontos de largura (mais de 5): o intervalo ainda é largo e a nota diz isso
    expect(t.nota).toBe('entre 0,7% e 6,1%. Ainda não dá para dizer se é alta ou baixa.')
    expect(t.fraco).toBe(false)
    // a faixa leva os números crus para o desenho (cliques e impressões do canal), e a leitura em texto
    expect(v.taxa).toEqual({ cliques: 3, imp: 140, alt: 'Taxa de clique do canal 2,1%, intervalo de 95% de 0,7% a 6,1%' })
    // nenhuma linha escreve um "%" de taxa sem o intervalo: valor e nota andam juntos
    for (const l of v.linhas) if (l.chave === 'taxa') expect(l.nota).toMatch(/^entre /)
    // intervalo estreito (300 cliques em 10.000 impressões): "entre 2,7% e 3,4%" e NENHUMA frase de "não dá para dizer"
    const estreito = alcanceComLinhas(canalId, hoje, [{ ytId: ytIds[0]!, dia: d(5), imp: 10000, ctr: 0.03 }])
    expect(linha(viewDe(monta(ok(estreito), DIARIO_CHEIO())), 'taxa')).toMatchObject({ valor: '3,0%', nota: 'entre 2,7% e 3,4%' })
  })

  it('taxa com intervalo largo (mais de 5 pontos) diz "Ainda não dá para dizer se é alta ou baixa."', () => {
    const largo = alcanceComLinhas(canalId, hoje, [{ ytId: ytIds[0]!, dia: d(5), imp: 20, ctr: 0.05 }]) // 1 clique em 20 impressões
    const t = linha(viewDe(monta(ok(largo), DIARIO_CHEIO())), 'taxa')
    expect(t.valor).toBe('5,0%')
    expect(t.nota).toMatch(/^entre 0,9% e 23,6%\. Ainda não dá para dizer se é alta ou baixa\.$/)
  })

  it('% assistido: com menos de 30 views leva a nota de pouca base; com menos de 10 fica marcado fraco; sem views é não medido, nunca 0%', () => {
    const com = (views: number, dias = 1) => linha(viewDe(monta(alc3de140(), diarioPct([{ dias, views, pct: 47.5 }]))), 'assistido')
    expect(com(20)).toMatchObject({ valor: '48%', nota: 'só 20 views: pouco para uma média', fraco: false })
    expect(com(29)).toMatchObject({ nota: 'só 29 views: pouco para uma média', fraco: false })
    expect(com(30)).toMatchObject({ valor: '48%', nota: null, fraco: false })
    expect(com(8)).toMatchObject({ valor: '48%', nota: 'só 8 views: pouco para uma média', fraco: true })
    expect(com(10)).toMatchObject({ fraco: false })
    expect(com(9).fraco).toBe(true)
    // 1 view: singular
    expect(com(1).nota).toBe('só 1 view: pouco para uma média')
    // sem views na janela: valor nulo, nunca "0%", e nenhuma nota inventada
    const semViews = linha(viewDe(monta(alc3de140(), diarioPct([{ dias: 10, views: 0, pct: 60 }]))), 'assistido')
    expect(semViews).toMatchObject({ valor: null, nota: null, fraco: false })
    expect(JSON.stringify(semViews)).not.toContain('0%')
    // diário que a coleta ainda não gravou
    const vazio = linha(viewDe(monta(alc3de140(), ok({ canalId, ultimoDia: null, linhas: [], descartados: 0 }))), 'assistido')
    expect(vazio).toMatchObject({ valor: null })
  })

  it('% assistido acima de 100 mostra o número real (trecho revisto), sem recortar', () => {
    expect(linha(viewDe(monta(alc3de140(), diarioPct([{ dias: 28, views: 6, pct: 139.38 }]))), 'assistido').valor).toBe('139%')
  })

  it('os dois lados são canais seus: dois cartões, cada um com o nome do canal', () => {
    const dados = { eu: monta(alc3de140(), DIARIO_CHEIO()), eu2: monta(alc3de140(), DIARIO_CHEIO(), 'Thiago Figueiredo') }
    const vs = buildSoSeuCanal({ a: eu, b: eu2 }, dados)
    expect(vs.map(v => v.canal)).toEqual(['tnFigueiredo', 'Thiago Figueiredo'])
    expect(buildSoSeuCanal({ a: eu2, b: eu }, dados).map(v => v.canal)).toEqual(['Thiago Figueiredo', 'tnFigueiredo'])
  })

  it('canal seu sem relatório lido: frase "Não medido…" e quatro linhas hachuradas, sem número', () => {
    for (const alcance of [alcanceVazio(canalId), alcanceNadaLido(canalId, hoje)]) {
      const dado = monta(ok(alcance), ok({ canalId, ultimoDia: null, linhas: [], descartados: 0 }))
      const v = buildSoSeuCanal({ a: eu, b: leo }, { eu: dado })[0]!
      expect(v.naoMedido).toBe(true)
      expect(v.frase.startsWith('Não medido. ')).toBe(true)
      expect(v.frase).toContain('falta medir, não é zero')
      expect(v.frase).toContain('tnFigueiredo')
      expect(v.linhas.map(l => l.chave)).toEqual(['impressoes', 'cliques', 'taxa', 'assistido'])
      for (const l of v.linhas) expect(l, l.chave).toMatchObject({ valor: null, nota: null, fraco: false })
      expect(v.taxa).toBeNull()
      expect(JSON.stringify(v)).not.toMatch(/"valor":"/)
    }
  })

  it('sem permissão ou leitura que falhou: o cartão diz o motivo; nunca 0', () => {
    const negado = monta(NEGADO, NEGADO)
    const erro = monta(ERRO, ERRO)
    expect(negado).toEqual({ acesso: 'negado', view: null })
    expect(erro).toEqual({ acesso: 'erro', view: null })
    const [vn] = buildSoSeuCanal({ a: eu, b: leo }, { eu: negado })
    const [ve] = buildSoSeuCanal({ a: eu, b: leo }, { eu: erro })
    expect(vn!.frase).toBe('Só quem edita o site vê estes números.')
    expect(ve!.frase).toBe('A leitura do alcance falhou agora; recarregue a página.')
    for (const v of [vn!, ve!]) { expect(v.linhas).toEqual([]); expect(v.taxa).toBeNull(); expect(v.naoMedido).toBe(false) }
    // canal seu que o pacote não trouxe: não é "zero" nem some: é leitura que não chegou
    expect(buildSoSeuCanal({ a: eu, b: leo }, {})[0]!.linhas).toEqual([])
  })

  it('alcance lido e diário negado ou com erro: impressões, cliques e taxa seguem; só o % assistido diz o motivo (nunca 0%)', () => {
    for (const [diario, nota] of [[NEGADO, 'só quem edita o site vê este número'], [ERRO, 'a leitura do % assistido falhou agora; recarregue a página']] as const) {
      const v = viewDe(monta(alc3de140(), diario))
      expect(linha(v, 'impressoes').valor).toBe('140')
      expect(linha(v, 'taxa').valor).toBe('2,1%')
      expect(linha(v, 'assistido')).toMatchObject({ valor: null, nota, fraco: false })
    }
    // o YouTube ainda não entregou o percentual (há views, nenhum dia com %)
    const semPct = linha(viewDe(monta(alc3de140(), diarioPct([{ dias: 10, views: 5, pct: null }]))), 'assistido')
    expect(semPct).toMatchObject({ valor: null, nota: 'o YouTube ainda não entregou o % assistido' })
    // a coleta diária ainda não gravou o canal
    expect(linha(viewDe(monta(alc3de140(), ok({ canalId, ultimoDia: null, linhas: [], descartados: 0 }))), 'assistido')).toMatchObject({ valor: null, nota: 'a coleta diária ainda não gravou este canal' })
  })

  it('cliques sem CTR em algum dia com impressão: cliques e taxa são "não medido", as impressões seguem; nunca 0', () => {
    const semCtr = alcanceComLinhas(canalId, hoje, [{ ytId: ytIds[0]!, dia: d(5), imp: 100, ctr: null }])
    const v = viewDe(monta(ok(semCtr), DIARIO_CHEIO()))
    expect(linha(v, 'impressoes').valor).toBe('100')
    expect(linha(v, 'cliques')).toMatchObject({ valor: null })
    expect(linha(v, 'cliques').nota).toContain('CTR')
    expect(linha(v, 'taxa')).toMatchObject({ valor: null })
    expect(v.taxa).toBeNull()
  })

  it('zero impressões em dias lidos: impressões "0" (zero medido), cliques "0" e taxa não medida (sem impressão não há taxa)', () => {
    const zeros = alcanceComLinhas(canalId, hoje, [])
    const v = viewDe(monta(ok(zeros), DIARIO_CHEIO()))
    expect(linha(v, 'impressoes').valor).toBe('0')
    expect(linha(v, 'cliques').valor).toBe('0')
    expect(linha(v, 'taxa')).toMatchObject({ valor: null })
    expect(v.taxa).toBeNull()
  })

  it('o cheio do fixture: 187 impressões em 11 dias com impressão e a taxa do canal com intervalo', () => {
    const v = viewDe(monta(ok(alcanceCheio(canalId, ytIds, hoje)), DIARIO_CHEIO()))
    expect(linha(v, 'impressoes').valor).toBe('187')
    expect(v.taxa?.imp).toBe(187)
  })
})

/* ---------------------------------------------------------------- a tela */

const ALL = (v: number): OpcoesCanal['n'] => Object.fromEntries(NUMEROS.map(k => [k, v])) as OpcoesCanal['n']
const mk = (id: string, subs: number | null, o: OpcoesCanal = {}) => canalDe(id, { subs, ...o })
function pacote(soSeuCanal: Record<string, SoSeuCanalDado>): CompararPack {
  return {
    ...pacoteDe([
      mk('eu', 1000, { own: true, name: 'tnFigueiredo', n: { ...ALL(10), inscritos: 1000 } }),
      mk('eu2', 400, { own: true, name: 'Thiago Figueiredo', n: { ...ALL(8), inscritos: 400 } }),
      mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(20), inscritos: 5000 } }),
      mk('c2', 3000, { name: 'Ana Viaja', n: { ...ALL(10), inscritos: 3000 } }),
    ]),
    soSeuCanal,
  }
}
const DADOS_TELA = () => ({ eu: monta(alc3de140(), DIARIO_CHEIO()), eu2: monta(alc3de140(), DIARIO_CHEIO(), 'Thiago Figueiredo') })
const wrap = (pack: CompararPack, a: string, b: string) => {
  window.history.replaceState(null, '', `/cms/youtube/competitors/comparar?a=${a}&b=${b}`)
  return render(<div data-obs=""><CompararScreen pack={pack} inicial={{ a, b }} /></div>)
}
const cartoes = () => [...document.querySelectorAll<HTMLElement>('[data-so-seu-canal]')]
const CSS = readFileSync(join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_comparar/comparar.css'), 'utf8')

beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.getElementById('flut')?.remove() })

describe('14 tela: o cartão na comparação', () => {
  it('canal seu × concorrente: o cartão fica logo abaixo dos dois lados e antes de "Número a número"', () => {
    wrap(pacote(DADOS_TELA()), 'eu', 'c1')
    const [c] = cartoes()
    expect(cartoes()).toHaveLength(1)
    const lados = document.querySelector('.cp-sides')!
    const tabela = screen.getByRole('heading', { name: /Número a número/ }).closest('section')!
    expect(lados.compareDocumentPosition(c!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(c!.compareDocumentPosition(tabela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(c!).getByRole('heading', { level: 2, name: /Só o seu canal mede/ })).toBeTruthy()
    // a frase, com o trecho em negrito
    expect(c!.textContent).toContain('Impressões, taxa de clique e % assistido só chegam ao dono do canal. Leo Khev não tem esses números aqui porque o YouTube não os entrega, não porque sejam zero.')
    expect(c!.querySelector('.so-lead b')!.textContent).toBe('não porque sejam zero')
    // as quatro linhas: rótulo, sub e valor
    const itens = [...c!.querySelectorAll('li')]
    expect(itens.map(li => li.querySelector('.so-rt')!.firstChild!.textContent)).toEqual(['Impressões', 'Cliques estimados', 'Taxa de clique', '% assistido'])
    expect(itens[0]!.textContent).toContain('140')
    expect(itens[2]!.textContent).toContain('2,1%')
    expect(itens[2]!.textContent).toContain('entre 0,7% e 6,1%')
    expect(itens[3]!.textContent).toContain('55%')
    // a faixa da taxa de clique (o componente compartilhado) com a leitura em texto
    expect(itens[2]!.querySelector('[role="img"][aria-label^="Taxa de clique do canal 2,1%"]')).not.toBeNull()
  })

  it('os valores usam a cor do canal próprio (--lado-o) e o cartão tem o fio de destaque; nenhuma classe de direção (verde/âmbar)', () => {
    wrap(pacote(DADOS_TELA()), 'eu', 'c1')
    const c = cartoes()[0]!
    expect(c.querySelectorAll('.so-vl').length).toBeGreaterThanOrEqual(4)
    expect(CSS).toMatch(/\.so-vl\{[^}]*color:var\(--lado-o\)/)
    expect(CSS).toMatch(/\.so-vl\.fraco\{[^}]*color:var\(--muted\)/)
    expect(CSS).toMatch(/\.so\{[^}]*border-left:3px solid var\(--accent\)/)
    // nada de cor de direção nem de classe de direção dentro do cartão e das regras dele
    expect(c.innerHTML).not.toMatch(/dir-up|dir-dn|dir-eq|class="[^"]*\b(up|dn|acima|abaixo|sobe|desce)\b/)
    const regrasSo = CSS.split('}').filter(r => /\.so[\s{.-]/.test(r)).join('}')
    expect(regrasSo).not.toMatch(/dir-up|dir-dn|dir-eq|color-mix|z-index/)
  })

  it('"não medido" é só o quadradinho hachurado com nome acessível; o sem-dado tem as quatro e a frase "Não medido."', () => {
    const dado = monta(ok(alcanceVazio(canalId)), ok({ canalId, ultimoDia: null, linhas: [], descartados: 0 }))
    wrap(pacote({ eu: dado }), 'eu', 'c1')
    const c = cartoes()[0]!
    expect(c.querySelector('.so-lead b')!.textContent).toBe('Não medido.')
    expect(c.querySelectorAll('.obs-ch-nm[role="img"][aria-label="não medido"]')).toHaveLength(4)
    expect(c.querySelectorAll('.so-vl')).toHaveLength(0)
    expect(c.querySelector('.so-lead')!.textContent).not.toMatch(/\d/)
    expect(c.querySelectorAll('[data-linha]')).toHaveLength(4)
  })

  it('sem permissão ou leitura que falhou: o cartão diz o motivo, sem linhas e sem número', () => {
    wrap(pacote({ eu: monta(NEGADO, NEGADO) }), 'eu', 'c1')
    let c = cartoes()[0]!
    expect(c.querySelector('.so-lead')!.textContent).toBe('Só quem edita o site vê estes números.')
    expect(c.querySelectorAll('li')).toHaveLength(0)
    cleanup()
    wrap(pacote({ eu: monta(ERRO, ERRO) }), 'eu', 'c1')
    c = cartoes()[0]!
    expect(c.querySelector('.so-lead')!.textContent).toBe('A leitura do alcance falhou agora; recarregue a página.')
    expect(c.querySelectorAll('li')).toHaveLength(0)
  })

  it('dois canais seus: dois cartões, cada um com o nome do canal no título', () => {
    wrap(pacote(DADOS_TELA()), 'eu', 'eu2')
    const cs = cartoes()
    expect(cs).toHaveLength(2)
    expect(within(cs[0]!).getByRole('heading', { level: 2 }).textContent).toContain('tnFigueiredo')
    expect(within(cs[1]!).getByRole('heading', { level: 2 }).textContent).toContain('Thiago Figueiredo')
    for (const c of cs) expect(c.querySelector('.so-lead')!.textContent).toBe('Impressões, taxa de clique e % assistido só chegam ao dono do canal.')
  })

  it('o ⓘ "De onde vêm estes números" abre a explicação na camada única (#flut), fora da tela', () => {
    wrap(pacote(DADOS_TELA()), 'eu', 'c1')
    const botao = within(cartoes()[0]!).getByRole('button', { name: 'De onde vêm estes números' })
    expect(botao.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(botao)
    const caixa = within(document.getElementById('flut')!).getByRole('dialog')
    expect(botao.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-obs-screen="comparar"]')!.contains(caixa)).toBe(false)
    expect(caixa.textContent).toContain('Impressões e taxa de clique')
    expect(caixa.textContent).toContain('intervalo de 95%')
    expect(caixa.textContent).toContain('pesada pelas views do dia')
  })

  it('trocar o seletor para um par sem canal seu tira o cartão sem ir ao servidor', async () => {
    const buscar = vi.spyOn(globalThis, 'fetch')
    wrap(pacote(DADOS_TELA()), 'eu', 'c1')
    expect(cartoes()).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Lado A'), { target: { value: 'c2' } })
    expect(cartoes()).toHaveLength(0)
    expect(document.body.textContent).not.toContain('Só o seu canal mede')
    // e volta quando o par volta a ter um canal seu
    fireEvent.change(screen.getByLabelText('Lado B'), { target: { value: 'eu2' } })
    expect(cartoes()).toHaveLength(1)
    // o par agora é Ana Viaja × Thiago Figueiredo: a frase do cartão cita o concorrente do par
    expect(cartoes()[0]!.querySelector('.so-lead')!.textContent).toContain('Ana Viaja não tem esses números')
    expect(buscar).not.toHaveBeenCalled()
  })

  it('"Inverter lados" mantém o cartão do mesmo canal', () => {
    wrap(pacote(DADOS_TELA()), 'eu', 'c1')
    const antes = cartoes()[0]!.textContent
    fireEvent.click(screen.getByRole('button', { name: /Inverter lados/ }))
    expect(cartoes()).toHaveLength(1)
    expect(cartoes()[0]!.textContent).toBe(antes)
    expect(screen.getByLabelText('Lado A')).toHaveProperty('value', 'c1')
  })

  it('dois concorrentes: nenhum cartão e nenhuma frase dele', () => {
    wrap(pacote(DADOS_TELA()), 'c1', 'c2')
    expect(cartoes()).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/Só o seu canal mede|só chegam ao dono do canal/)
  })

  it('o CSS: uma coluna só a 640 px ou menos, texto de 12 px ou mais e nenhum color-mix nem z-index nas regras novas', () => {
    expect(CSS).toMatch(/@media \(max-width:640px\)\{[^@]*\.so-linhas li\{grid-template-columns:minmax\(0,1fr\)\}/)
    for (const m of CSS.matchAll(/\.so[^{]*\{[^}]*font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(12)
    for (const regra of CSS.split('}').filter(r => /\.so[\s{.-]/.test(r))) expect(regra).not.toMatch(/color-mix|z-index/)
  })
})

describe('14 Passo 4: "Views por dia nos longos" com as janelas dos dois lados escritas', () => {
  it('canal seu × concorrente: o aviso diz que as duas janelas de tempo são diferentes e que maior não quer dizer melhor', () => {
    const p = pacote(DADOS_TELA())
    p.canais.find(c => c.id === 'eu')!.numeros.vpd = { x: 2.4, texto: '2,4', motivo: null, nota: 'média dos últimos 28 dias do YouTube com medida (de 11/09 a 08/10), mediana de 3 longos' }
    p.canais.find(c => c.id === 'c1')!.numeros.vpd = { x: 0.2, texto: '0,2', motivo: null, nota: 'views por dia desde 03/10, mediana de 4 longos' }
    wrap(p, 'eu', 'c1')
    const aviso = document.querySelector('[data-janelas-aviso]')!
    expect(aviso.textContent).toBe('As duas janelas de tempo são diferentes: 28 dias de um lado, desde 03/10 do outro. Maior não quer dizer melhor: são canais de tamanhos diferentes.')
    expect(aviso.closest('section')!.querySelector('table')).not.toBeNull()
  })

  it('dois concorrentes, ou dois canais seus: sem o aviso (as janelas são as mesmas)', () => {
    const p = pacote(DADOS_TELA())
    wrap(p, 'c1', 'c2')
    expect(document.querySelector('[data-janelas-aviso]')).toBeNull()
    cleanup()
    wrap(p, 'eu', 'eu2')
    expect(document.querySelector('[data-janelas-aviso]')).toBeNull()
  })
})
