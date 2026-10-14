// @vitest-environment jsdom
/**
 * E17 degrau 1, Tarefa 6a: o empacotador de Comparar. Paridade com o componente REAL da tela em cada estado da matriz, os seis estados do
 * dado privado, o que acontece quando o dado não existe, e as provas por mutação (trocar lados, deslocar linha).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canalDe, pacoteDe, type OpcoesCanal } from './par-helpers'
import { NUMEROS, type NumeroId } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import type { CanalPack, CompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { buildPar, type ParView } from '@/app/cms/(authed)/youtube/competitors/_comparar/par-model'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'
import { definicoesDaTabela } from '@/app/cms/(authed)/youtube/competitors/_comparar/definicoes'
import {
  FRASE_ABERTURA, FRASE_ERRO_CARTAO, FRASE_NEGADO_CARTAO, INFO_SO_SEU_CANAL, type LinhaSoSeuCanal, type SoSeuCanalDado,
} from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import {
  AVISO_FREQUENCIA, AVISO_PARCIAL, empacotarComparar, formatoDaPublicacao, formatoDoVideo, INVENTARIO_COMPARAR, modeloDeComparar,
  SEM_PAR, SEM_PROVA_POR_IGUALDADE_DIRETA_COMPARAR, type ModeloComparar,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-comparar'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { ignorados, semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { EstadoDoPrivado, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO } from './contexto-ia-fixture'
import { expandirTela, provarParidade, provarQueExcluidoNaoVaza, type FolhaCrua } from './contexto-ia-paridade'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))

const ALL = (v: number): OpcoesCanal['n'] => Object.fromEntries(NUMEROS.map((k) => [k, v])) as OpcoesCanal['n']
const mk = (id: string, subs: number | null, o: OpcoesCanal = {}): CanalPack => canalDe(id, { subs, ...o })
/** Os cinco mais vistos e as publicações de 90 dias de mentira (nomes sintéticos). */
const comVideos = (c: CanalPack, n: number): CanalPack => ({
  ...c,
  top5: Array.from({ length: n }, (_, j) => ({ id: `${c.id}-v${j}`, abre: j !== 1, titulo: `Vídeo ${c.name} ${j + 1}`, thumb: null, viewsTexto: `${(j + 1) * 1200} views`, idadeTexto: j === 1 ? 'sem data' : `há ${j + 2} dias`, short: j === 2 })),
  top5Nota: n ? `${n} de ${n + 4} vídeos guardados, por views.` : 'Este canal não tem vídeos.',
  pub90: Array.from({ length: n }, (_, j) => ({ t: c.id.length * 1e9 + j, fmt: j === 0 ? 'long' : j === 1 ? 'short' : null, dataTexto: `0${j + 1}/09 10:0${j}` })),
  pub90Nota: n ? `${n} vídeos nos últimos 90 dias.` : 'ainda sem vídeos sincronizados',
})

const VIEW = (linhas: LinhaSoSeuCanal[], extra: { frase?: string; naoMedido?: boolean; taxa?: false } = {}): SoSeuCanalDado => ({
  acesso: 'ok', view: { canal: 'Eu Viajante', frase: extra.frase ?? FRASE_ABERTURA, naoMedido: extra.naoMedido ?? false, linhas, taxa: extra.taxa === false ? null : { cliques: 640, imp: 12345, alt: 'Taxa de clique do canal 5,2%, intervalo de 95% de 4,8% a 5,6%' } },
})
const L = (chave: LinhaSoSeuCanal['chave'], rotulo: string, valor: string | null, nota: string | null, o: Partial<LinhaSoSeuCanal> = {}): LinhaSoSeuCanal =>
  ({ chave, rotulo, sub: `base de ${rotulo}`, valor, nota, fraco: false, aindaNaoDa: false, ...o })
const ALCANCE_LIDO = VIEW([
  L('impressoes', 'Impressões', '12.345', null), L('cliques', 'Cliques estimados', '640', null),
  L('taxa', 'Taxa de clique', '5,2%', 'entre 4,8% e 5,6%'), L('assistido', '% assistido', null, 'ainda não há coleta diária deste canal'),
])
const ALCANCE_NADA_MEDIDO = VIEW([
  L('impressoes', 'Impressões', null, null), L('cliques', 'Cliques estimados', null, null), L('taxa', 'Taxa de clique', null, null), L('assistido', '% assistido', null, null),
], { frase: 'Não medido. As impressões ainda não chegaram: falta medir, não é zero.', naoMedido: true, taxa: false })
const ALCANCE_COM_ZERO = VIEW([L('impressoes', 'Impressões', '0', null), L('cliques', 'Cliques estimados', '0', null), L('taxa', 'Taxa de clique', null, 'nenhuma impressão nos dias medidos, então não há taxa'), L('assistido', '% assistido', '61%', null)], { taxa: false })

const ESTADO_OK: EstadoDoPrivado = { acessoPorCanal: { eu: { diario: 'ok', alcance: 'ok' } }, negativa: null }
const ESTADO_NEGADO: EstadoDoPrivado = { acessoPorCanal: { eu: { diario: 'negado', alcance: 'negado' } }, negativa: 'sem_direito' }
const SEM_PRIVADO: EstadoDoPrivado = { acessoPorCanal: {}, negativa: null }

interface Cenario { pack: CompararPack; a: string; b: string; estado: EstadoDoPrivado }
interface Montado { par: ParView; modelo: ModeloComparar; pacote: PacoteModelo; textoDoPacote: string; textoDaTela: string }

const textoDoPacote = (p: PacoteModelo): string => montarTexto(segmentar(p, CONTEXTO), '', 1_000_000, 'todos').texto

async function montar(c: Cenario, desenhar = true): Promise<Montado> {
  const par = buildPar(c.pack, c.a, c.b)
  const modelo = modeloDeComparar(c.pack, par)
  const pacote = empacotarComparar(modelo, c.estado)
  let textoDaTela = ''
  if (desenhar) {
    window.history.replaceState(null, '', `/cms/youtube/competitors/comparar?a=${c.a}&b=${c.b}`)
    const { container } = render(<div data-obs=""><CompararScreen pack={c.pack} inicial={{ a: c.a, b: c.b }} /></div>)
    textoDaTela = await expandirTela(container)
  }
  return { par, modelo, pacote, textoDoPacote: textoDoPacote(pacote), textoDaTela }
}

// ───────────────────────── o mapa de colunas da regra (d3), escrito aqui
const COL_LINHAS = (m: ModeloComparar): Record<string, string | readonly string[]> => ({
  Medida: '.nome', [`${m.a.name} (lado A)`]: ['.a.texto', '.a.motivo'], [`${m.b.name} (lado B)`]: ['.b.texto', '.b.motivo'], Base: '.base',
})
function colunasDe(m: ModeloComparar): Record<string, Record<string, string | readonly string[]>> {
  const linhas = {
    'numero-a-numero': COL_LINHAS(m),
    relacao: { Medida: '.nome', Relação: '.relacaoTexto' },
    'posicao-a': { Medida: '.nome', Posição: ['.posA.texto', '.posA.geral'] },
    'posicao-b': { Medida: '.nome', Posição: ['.posB.texto', '.posB.geral'] },
    'notas-dos-numeros-a': { Medida: '.nome', Nota: '.a.nota' },
    'notas-dos-numeros-b': { Medida: '.nome', Nota: '.b.nota' },
  }
  const privadas = Object.fromEntries(Object.entries(linhas).map(([k, v]) => [`privado-${k}`, v]))
  return {
    ...linhas, ...privadas,
    'mais-vistos': { Canal: ['modelo.a.name', 'modelo.b.name'], Vídeo: '.titulo', Views: '.viewsTexto', Idade: '.idadeTexto', Formato: '.short' },
    'mais-vistos-notas': { Canal: ['modelo.a.name', 'modelo.b.name'], Nota: ['.a.top5Nota', '.b.top5Nota'] },
    'publicacoes-90-dias': { Canal: ['modelo.a.name', 'modelo.b.name'], Data: '.dataTexto', Formato: '.fmt' },
    'publicacoes-90-dias-sem-formato': { Canal: ['modelo.a.name', 'modelo.b.name'], Data: '.dataTexto' },
    'publicacao-notas': { Canal: ['modelo.a.name', 'modelo.b.name'], Resumo: ['.a.pub90Nota', '.b.pub90Nota'] },
    'leitura-rapida': { Leitura: '.texto' },
    'privado-alcance-a': { Medida: '.rotulo', Valor: ['.valor', '.motivo'], Base: '.sub' },
    'privado-alcance-b': { Medida: '.rotulo', Valor: ['.valor', '.motivo'], Base: '.sub' },
    'privado-alcance-a-notas': { Medida: '.rotulo', Nota: '.nota' },
    'privado-alcance-b-notas': { Medida: '.rotulo', Nota: '.nota' },
  }
}
/** `SEM_PROVA_POR_IGUALDADE_DIRETA` de Comparar: o formato que o componente escreve por rótulo, não por igualdade com a folha. */
const CRUAS: FolhaCrua[] = [
  { caminho: 'a.top5[].short', nome: 'formato do vídeo', formatador: formatoDoVideo }, { caminho: 'b.top5[].short', nome: 'formato do vídeo', formatador: formatoDoVideo },
  { caminho: 'a.pub90[].fmt', nome: 'formato da publicação', formatador: formatoDaPublicacao }, { caminho: 'b.pub90[].fmt', nome: 'formato da publicação', formatador: formatoDaPublicacao },
]

const paridade = (m: Montado) => provarParidade({
  modelo: m.modelo, inventario: INVENTARIO_COMPARAR, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: colunasDe(m.modelo), cruas: CRUAS,
})

// ───────────────────────── a matriz de estados
const DOIS_CONCORRENTES = (): Cenario => ({
  pack: pacoteDe([
    comVideos(mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(20), inscritos: 5000 } }), 4),
    comVideos(mk('c2', 3000, { name: 'Ana Viaja', n: { ...ALL(10), inscritos: 3000 } }), 2),
    mk('c3', 100, { name: 'Beto Rota', n: { ...ALL(12), inscritos: 100 } }),
  ]), a: 'c1', b: 'c2', estado: SEM_PRIVADO,
})
const proprioContraConcorrente = (soSeuCanal: Record<string, SoSeuCanalDado>, estado: EstadoDoPrivado, numeros: Partial<Record<NumeroId, number | null>> = {}): Cenario => ({
  pack: { ...pacoteDe([
    comVideos(mk('eu', 1000, { own: true, name: 'Eu Viajante', n: { ...ALL(10), inscritos: 1000, inscritos30: null, trocas30: null, ...numeros }, motivos: { inscritos30: 'sem contagem de 30 dias atrás', trocas30: 'as trocas do seu canal ficam no A/B Lab' } }), 3),
    comVideos(mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(20), inscritos: 5000 } }), 2),
  ]), soSeuCanal }, a: 'eu', b: 'c1', estado,
})
const PAREDE = (): Cenario => ({ // contagens parecidas: "praticamente igual", sem posição de empate escondida
  pack: pacoteDe([mk('a1', 1000, { name: 'Alfa', n: { ...ALL(100), inscritos: 1000 } }), mk('b1', 1005, { name: 'Beta', n: { ...ALL(103), inscritos: 1005 } })]), a: 'a1', b: 'b1', estado: SEM_PRIVADO,
})
const SEM_VIDEOS = (): Cenario => ({
  pack: pacoteDe([
    { ...mk('s1', 10, { name: 'Sem Vídeos Um', semVideos: true, comDatas: false, n: { inscritos: 10 }, motivos: Object.fromEntries(NUMEROS.map((k) => [k, 'sem vídeos'])) }), href: null },
    { ...mk('s2', null, { name: 'Sem Vídeos Dois', semVideos: true, comDatas: false, niche: null, n: {}, motivos: Object.fromEntries(NUMEROS.map((k) => [k, 'sem vídeos'])) }), href: null },
  ]), a: 's1', b: 's2', estado: SEM_PRIVADO,
})

const MATRIZ: Array<[string, () => Cenario]> = [
  ['dois concorrentes', DOIS_CONCORRENTES],
  ['próprio contra concorrente, com acesso', () => proprioContraConcorrente({ eu: ALCANCE_LIDO }, ESTADO_OK, { vpd: 12.5, vpdPorMil: 2.1 })],
  ['próprio contra concorrente, negado', () => proprioContraConcorrente({ eu: { acesso: 'negado', view: null } }, ESTADO_NEGADO, { vpd: null, vpdPorMil: null })],
  ['canal sem vídeos (nenhum número medido)', SEM_VIDEOS],
  ['contagens parecidas', PAREDE],
  ['próprio com zero medido de um lado (frase "você não publicou…" capitalizada pela tela)', () => proprioContraConcorrente({ eu: ALCANCE_COM_ZERO }, ESTADO_OK, { longos90: 0, vpd: 12.5, vpdPorMil: 2.1 })],
]

beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.getElementById('flut')?.remove() })

describe('Comparar: paridade em cada estado da matriz', () => {
  for (const [nome, cena] of MATRIZ) {
    it(`${nome}: a tela e o pacote dizem o mesmo (a, b, c, d, d2, d3 e e)`, async () => {
      const m = await montar(cena())
      expect(m.pacote.tabelas.length).toBeGreaterThan(0)
      expect(m.textoDaTela.length).toBeGreaterThan(300) // a tela foi mesmo desenhada e expandida
      expect(() => paridade(m)).not.toThrow()
    })
  }

  it('toda folha do modelo tem destino em todos os estados, e o inventário não guarda declaração velha (união da matriz)', async () => {
    const usos = new Set<string>()
    for (const [, cena] of MATRIZ) {
      const m = await montar(cena(), false)
      expect(semDestino(m.modelo, INVENTARIO_COMPARAR)).toEqual([])
      expect(ignorados(m.modelo)).toEqual([])
      const sobra = new Set(semUso(m.modelo, INVENTARIO_COMPARAR))
      for (const k of Object.keys(INVENTARIO_COMPARAR)) if (!sobra.has(k)) usos.add(k)
    }
    expect(Object.keys(INVENTARIO_COMPARAR).filter((k) => !usos.has(k))).toEqual([])
  })

  it('o pacote tem as quatro dimensões de quem pede: foco com os dois lados, janela, definições e "o que esta tela não mede"', async () => {
    const m = await montar(DOIS_CONCORRENTES(), false)
    expect(m.pacote.tela).toBe('comparar')
    expect(m.pacote.foco.map((f) => f.nome)).toEqual(['Leo Khev', 'Ana Viaja'])
    expect(m.pacote.janela).toContain('Viagem')
    expect(m.pacote.definicoes.length).toBeGreaterThan(0)
    expect(m.pacote.naoMede.length).toBeGreaterThan(0)
    expect(m.pacote.avisos).toContain(AVISO_FREQUENCIA)
    expect(m.pacote.avisos).toContain(m.par.rodape)
  })
})

describe('Comparar: a relação sai como a tela escreve', () => {
  it('"igual" e "zero" começam em maiúscula na tela e no pacote; "maior" fica como veio', async () => {
    const z = await montar(proprioContraConcorrente({ eu: ALCANCE_COM_ZERO }, ESTADO_OK, { longos90: 0, vpd: 12.5, vpdPorMil: 2.1 }))
    expect(z.textoDaTela).toContain('Você não publicou longos em 90 dias')
    expect(z.textoDoPacote).toContain('Você não publicou longos em 90 dias')
    cleanup(); document.getElementById('flut')?.remove()
    const i = await montar(PAREDE())
    expect(i.textoDaTela).toContain('Praticamente igual')
    expect(i.textoDoPacote).toContain('Praticamente igual')
    expect(i.textoDoPacote).not.toMatch(/\| praticamente igual \|/)
  })
})

describe('Comparar: o que acontece quando o dado não existe', () => {
  it('conjunto vazio (menos de dois canais): pacote com `vazio` preenchido e nenhuma tabela, e o texto diz isso', () => {
    const pacote = empacotarComparar(null, SEM_PRIVADO)
    expect(pacote.vazio).toBe(SEM_PAR)
    expect(pacote.tabelas).toEqual([])
    const t = textoDoPacote(pacote)
    expect(t).toContain(SEM_PAR)
    expect(segmentar(pacote, CONTEXTO).vazio).toBe(true)
  })

  it('nenhuma linha das tabelas novas da A5 (canal sem vídeos): toda medida é "não medido" com o motivo do modelo, nenhuma omitida', async () => {
    const m = await montar(SEM_VIDEOS(), false)
    const tabela = m.pacote.tabelas.find((t) => t.id === 'numero-a-numero')!
    // sem nenhum dos dois medidos, a linha vai para "ficaram de fora" (o modelo a tirou); as que sobram (inscritos de um lado) trazem motivo
    const cel = tabela.linhas.flatMap((l) => l.slice(1, 3))
    expect(cel.length).toBeGreaterThan(0)
    for (const c of cel) if (c.papel === 'numero' && c.estado === 'nao_medido') expect(c.motivo.length).toBeGreaterThan(0)
    expect(cel.some((c) => c.papel === 'numero' && c.estado === 'nao_medido' && c.motivo === 'sem vídeos')).toBe(true)
    expect(m.pacote.definicoes.some((d) => d.frase.includes('porque nenhum dos dois tem o dado'))).toBe(true)
    expect(m.textoDoPacote).toContain('não medido')
  })

  it('valor ausente sem motivo no modelo: a célula diz "a tela não informa o motivo" (campos escritos aqui: Numero.motivo nulo com x nulo)', async () => {
    const c = DOIS_CONCORRENTES()
    const dois = c.pack.canais.find((x) => x.id === 'c2')!
    dois.numeros.medianaViews = { x: null, texto: null, motivo: null, nota: null } // defeito do modelo: nulo sem motivo
    const m = await montar(c, false)
    const linha = m.pacote.tabelas.find((t) => t.id === 'numero-a-numero')!.linhas.find((l) => l[0]!.texto === 'Mediana de views dos longos')!
    expect(linha[2]).toMatchObject({ papel: 'numero', estado: 'nao_medido', motivo: 'a tela não informa o motivo' })
  })

  it('zero medido continua zero medido (e não vira "não medido")', async () => {
    const c = DOIS_CONCORRENTES()
    c.pack.canais.find((x) => x.id === 'c2')!.numeros.longos90 = { x: 0, texto: '0', motivo: null, nota: null }
    const m = await montar(c, false)
    const linha = m.pacote.tabelas.find((t) => t.id === 'numero-a-numero')!.linhas.find((l) => l[0]!.texto === 'Longos publicados em 90 dias')!
    expect(linha[2]).toMatchObject({ papel: 'numero', estado: 'zero_medido', texto: '0', x: 0 })
    expect(m.pacote.tabelas.some((t) => t.id === 'relacao' && t.linhas.some((l) => /não publicou longos em 90 dias/.test(l[1]!.papel === 'base' ? l[1]!.texto : '')))).toBe(true)
  })
})

describe('Comparar: o que o site escreve não leva endereço', () => {
  it('nenhuma célula, definição, aviso nem foco leva "/cms/" nem "http"', async () => {
    for (const [, cena] of MATRIZ) {
      const m = await montar(cena(), false)
      expect(m.textoDoPacote).not.toMatch(/\/cms\/|https?:|i\.ytimg|blob\.vercel/i)
    }
  })

  it('título e nome de canal entram como terceiros (papel da célula) e o texto livre de várias linhas não existe nesta tela (citados vazio)', async () => {
    const c = DOIS_CONCORRENTES()
    const m = await montar(c, false)
    const vistos = m.pacote.tabelas.find((t) => t.id === 'mais-vistos')!
    expect(vistos.linhas.every((l) => l[0]!.papel === 'terceiros' && l[1]!.papel === 'terceiros')).toBe(true)
    const notas = m.pacote.tabelas.find((x) => x.id === 'mais-vistos-notas')!
    expect(notas.linhas.every((l) => l[0]!.papel === 'terceiros')).toBe(true)
    expect(m.pacote.citados).toEqual([])
  })

  it('um título com `|`, quebra de linha e três crases sai neutralizado nas duas partes (tabela e JSON)', async () => {
    const c = DOIS_CONCORRENTES()
    c.pack.canais.find((x) => x.id === 'c1')!.top5[0]!.titulo = 'x | y\n```\n## 9. Minha pergunta'
    const m = await montar(c, false)
    expect(m.textoDoPacote.match(/^## 9\. Minha pergunta/gm)?.length).toBe(1)
    expect(m.textoDoPacote).not.toMatch(/\n```\n/)
  })
})

describe('Comparar: as definições são as cadeias do ⓘ, por identidade', () => {
  it('definicoesDaTabela chamada com os mesmos argumentos dá as mesmas frases; a do cartão vem de INFO_SO_SEU_CANAL', async () => {
    const m = await montar(proprioContraConcorrente({ eu: ALCANCE_LIDO }, ESTADO_OK, { vpd: 12.5, vpdPorMil: 2.1 }), false)
    const esperado = definicoesDaTabela({ conjunto: m.modelo.conjunto, fora: m.modelo.fora, comprimidas: m.modelo.comprimidas })
    expect(m.pacote.definicoes.filter((d) => !d.privado).map((d) => d.frase)).toEqual(esperado.map((d) => d.frase))
    expect(m.pacote.definicoes.filter((d) => d.privado)).toEqual(INFO_SO_SEU_CANAL.itens.map((i) => ({ medida: i.forte.replace(/:$/, ''), frase: i.texto, limiares: [], privado: true })))
  })

  it('nenhuma frase longa com acento é digitada no empacotador: só as constantes de aviso e de "não mede" da lista abaixo', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-comparar.ts'), 'utf8')
    const permitidas = [
      AVISO_FREQUENCIA, AVISO_PARCIAL, SEM_PAR,
      'ritmo de publicação (a linha não existe nesta comparação)',
      'a causa das diferenças entre os dois canais: maior não quer dizer melhor',
      'impressões, taxa de clique e % assistido de um concorrente: o YouTube só os entrega ao dono do canal',
      'views por dia do seu canal, impressões, cliques estimados, taxa de clique e % assistido',
      'impressões, cliques estimados, taxa de clique e % assistido',
      'As duas janelas de tempo são diferentes: 28 dias de um lado, desde ',
      'últimos 90 dias · posições entre ',
    ]
    // só o código: sem comentário, sem as linhas que escrevem título de tabela ou nome de corte (rótulos do site, não definição)
    const codigo = fonte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\b(titulo|nomeNoCorte):/.test(l)).map((l) => l.replace(/\s\/\/.*$/, ''))
    const literais = [...codigo.join('\n').matchAll(/(['`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]!).filter((s) => s.replace(/\$\{[^}]*\}/g, '').length > 20 && /[áàâãéêíóôõúç]/i.test(s))
    expect(literais.filter((s) => !permitidas.some((p) => s.startsWith(p)))).toEqual([])
  })
})

describe('Comparar: o dado privado tem seis estados e o pacote nomeia os seis', () => {
  const privadoDe = (m: Montado) => m.pacote.privado
  const tabelasPrivadas = (m: Montado) => m.pacote.tabelas.filter((t) => t.privada)

  it('nenhum lado é seu: privado "na", nenhuma tabela privada', async () => {
    const m = await montar(DOIS_CONCORRENTES(), false)
    expect(privadoDe(m)).toEqual({ estado: 'na' })
    expect(tabelasPrivadas(m)).toEqual([])
  })

  it('lido: incluido; as linhas do diário e o alcance vão em tabelas privadas, com o motivo do modelo no "% assistido"', async () => {
    const m = await montar(proprioContraConcorrente({ eu: ALCANCE_LIDO }, ESTADO_OK, { vpd: 12.5, vpdPorMil: 2.1 }), false)
    expect(privadoDe(m).estado).toBe('incluido')
    const ids = tabelasPrivadas(m).map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['privado-numero-a-numero', 'privado-alcance-a', 'privado-alcance-a-notas']))
    expect(m.pacote.tabelas.find((t) => t.id === 'numero-a-numero')!.linhas.map((l) => l[0]!.papel === 'rotulo' ? l[0]!.texto : '')).not.toContain('Views por dia nos longos')
    const alcance = tabelasPrivadas(m).find((t) => t.id === 'privado-alcance-a')!
    expect(alcance.linhas[3]![1]).toMatchObject({ estado: 'nao_medido', motivo: 'ainda não há coleta diária deste canal' })
    expect(m.pacote.avisosPrivados?.length).toBe(1)
    expect(m.pacote.avisosPrivados![0]!.startsWith(FRASE_ABERTURA)).toBe(true)
    expect(m.pacote.avisos).not.toContain(AVISO_PARCIAL)
    expect(() => segmentar(m.pacote, CONTEXTO)).not.toThrow()
  })

  it('sem o direito: excluido sem_direito, nenhuma tabela privada, as linhas do diário seguem na tabela pública (o lado seu "não medido")', async () => {
    const m = await montar(proprioContraConcorrente({ eu: { acesso: 'negado', view: null } }, ESTADO_NEGADO, { vpd: null, vpdPorMil: null }), false)
    expect(privadoDe(m)).toMatchObject({ estado: 'excluido', motivo: 'sem_direito' })
    expect(tabelasPrivadas(m)).toEqual([])
    expect(m.pacote.avisos).toContain(FRASE_NEGADO_CARTAO)
    expect(m.textoDoPacote).toContain('Não incluído: dado privado do canal')
    expect(m.textoDoPacote).toContain('não tem o direito de ver desempenho privado')
    expect(() => segmentar(m.pacote, CONTEXTO)).not.toThrow()
  })

  it.each([
    ['negativa nula', null],
    ['negativa "nao_foi_possivel_conferir"', 'nao_foi_possivel_conferir' as const],
  ])('não foi possível conferir (%s): excluido nao_conferido, e NUNCA "sem direito"', async (_nome, negativa) => {
    const estado: EstadoDoPrivado = { acessoPorCanal: { eu: { diario: 'negado', alcance: 'negado' } }, negativa }
    const m = await montar(proprioContraConcorrente({ eu: { acesso: 'negado', view: null } }, estado, { vpd: null, vpdPorMil: null }), false)
    expect(privadoDe(m)).toMatchObject({ estado: 'excluido', motivo: 'nao_conferido' })
  })

  it('a leitura falhou (diário e alcance com erro): excluido leitura_falhou, antes de qualquer outra negativa', async () => {
    const estado: EstadoDoPrivado = { acessoPorCanal: { eu: { diario: 'erro', alcance: 'erro' } }, negativa: 'sem_direito' }
    const m = await montar(proprioContraConcorrente({ eu: { acesso: 'erro', view: null } }, estado, { vpd: null, vpdPorMil: null }), false)
    expect(privadoDe(m)).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
    expect(m.pacote.avisos).toContain(FRASE_ERRO_CARTAO)
  })

  it('mesmo canal, diário ok e alcance com erro, com tabela privada no pacote: incluido e o aviso de parcial', async () => {
    const estado: EstadoDoPrivado = { acessoPorCanal: { eu: { diario: 'ok', alcance: 'erro' } }, negativa: null }
    const m = await montar(proprioContraConcorrente({ eu: { acesso: 'erro', view: null } }, estado, { vpd: 12.5, vpdPorMil: 2.1 }), false)
    expect(privadoDe(m).estado).toBe('incluido')
    expect(tabelasPrivadas(m).map((t) => t.id)).toContain('privado-numero-a-numero')
    expect(m.pacote.avisos).toContain(AVISO_PARCIAL)
    expect(m.pacote.avisos).toContain(FRASE_ERRO_CARTAO)
  })

  it('mesmo canal, diário com erro e alcance com erro: excluido leitura_falhou', async () => {
    const estado: EstadoDoPrivado = { acessoPorCanal: { eu: { diario: 'erro', alcance: 'erro' } }, negativa: null }
    const m = await montar(proprioContraConcorrente({ eu: { acesso: 'erro', view: null } }, estado, { vpd: null, vpdPorMil: null }), false)
    expect(privadoDe(m)).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
  })

  it('canal seu FORA do par com erro, os dois lados lidos: incluido, SEM o aviso de parcial', async () => {
    const c = proprioContraConcorrente({ eu: ALCANCE_LIDO }, { acessoPorCanal: { eu: { diario: 'ok', alcance: 'ok' }, outro: { diario: 'erro', alcance: 'erro' } }, negativa: null }, { vpd: 12.5, vpdPorMil: 2.1 })
    const m = await montar(c, false)
    expect(privadoDe(m).estado).toBe('incluido')
    expect(m.pacote.avisos).not.toContain(AVISO_PARCIAL)
  })

  it('canal seu FORA do par com erro, par de dois concorrentes: privado "na"', async () => {
    const c = DOIS_CONCORRENTES()
    const m = await montar({ ...c, estado: { acessoPorCanal: { outro: { diario: 'erro', alcance: 'erro' } }, negativa: 'sem_direito' } }, false)
    expect(privadoDe(m)).toEqual({ estado: 'na' })
  })

  it('lido e nada medido (acesso ok, naoMedido true): a tabela privada É emitida, toda "não medido" com o motivo do modelo, incluido, e segmentar não lança', async () => {
    const m = await montar(proprioContraConcorrente({ eu: ALCANCE_NADA_MEDIDO }, ESTADO_OK, { vpd: null, vpdPorMil: null }), false)
    expect(privadoDe(m).estado).toBe('incluido')
    const alcance = tabelasPrivadas(m).find((t) => t.id === 'privado-alcance-a')!
    expect(alcance.linhas.every((l) => l[1]!.papel === 'numero' && l[1]!.estado === 'nao_medido')).toBe(true)
    expect(alcance.linhas[0]![1]).toMatchObject({ motivo: ALCANCE_NADA_MEDIDO.view!.frase })
    expect(() => segmentar(m.pacote, CONTEXTO)).not.toThrow()
  })

  it('zero medido no cartão continua zero medido', async () => {
    const m = await montar(proprioContraConcorrente({ eu: ALCANCE_COM_ZERO }, ESTADO_OK, { vpd: 12.5, vpdPorMil: 2.1 }), false)
    const alcance = tabelasPrivadas(m).find((t) => t.id === 'privado-alcance-a')!
    expect(alcance.linhas[0]![1]).toMatchObject({ estado: 'zero_medido', texto: '0', x: 0 })
  })

  it('o excluído não vaza nenhuma folha privada do incluído (texto e JSON)', async () => {
    const dados = { vpd: 12.5, vpdPorMil: 2.1 }
    const incluido = await montar(proprioContraConcorrente({ eu: ALCANCE_LIDO }, ESTADO_OK, dados), false)
    const excluido = await montar(proprioContraConcorrente({ eu: { acesso: 'negado', view: null } }, ESTADO_NEGADO, { vpd: null, vpdPorMil: null }), false)
    const t = excluido.textoDoPacote
    expect(() => provarQueExcluidoNaoVaza(incluido.pacote, t, t)).not.toThrow()
  })

  it('a paridade vale também com o dado privado incluído, parcial e lido-e-vazio', async () => {
    for (const [soSeuCanal, estado, numeros] of [
      [{ eu: ALCANCE_NADA_MEDIDO }, ESTADO_OK, { vpd: null, vpdPorMil: null }],
      [{ eu: { acesso: 'erro', view: null } as SoSeuCanalDado }, { acessoPorCanal: { eu: { diario: 'ok', alcance: 'erro' } }, negativa: null } as EstadoDoPrivado, { vpd: 12.5, vpdPorMil: 2.1 }],
      [{ eu: ALCANCE_COM_ZERO }, ESTADO_OK, { vpd: 12.5, vpdPorMil: 2.1 }],
    ] as const) {
      const m = await montar(proprioContraConcorrente(soSeuCanal, estado, numeros))
      expect(() => paridade(m)).not.toThrow()
      cleanup(); document.getElementById('flut')?.remove()
    }
  })
})

describe('Comparar: provas por mutação (a paridade cai)', () => {
  const casos = async (): Promise<Montado> => montar({ ...DOIS_CONCORRENTES() })

  it('trocar dois canais de lugar (A por B) numa célula derruba a regra (d2)', async () => {
    const m = await casos()
    const t = m.pacote.tabelas.find((x) => x.id === 'numero-a-numero')!
    const linha = t.linhas.find((l) => l[1]!.papel === 'numero' && l[1]!.estado === 'medido')!
    const [, ca, cb] = linha
    linha[1] = { ...cb! } as typeof ca & object
    expect(() => paridade(m)).toThrow(/\(d2\)|\(d3\)/)
  })

  it('deslocar uma linha de lista em uma posição derruba a regra (d2)', async () => {
    const m = await casos()
    const t = m.pacote.tabelas.find((x) => x.id === 'mais-vistos')!
    const celula = t.linhas[0]![1]!
    t.linhas[0]![1] = { ...celula, origem: celula.origem.replace('top5[0]', 'top5[1]') }
    expect(() => paridade(m)).toThrow(/\(d2\)/)
  })

  it('copiar o campo vizinho de mesmo texto derruba a regra (d3) (a célula sob o cabeçalho errado)', async () => {
    const m = await casos()
    const t = m.pacote.tabelas.find((x) => x.id === 'numero-a-numero')!
    const l0 = t.linhas[0]!
    l0[3] = { ...l0[3]!, origem: l0[3]!.origem.replace('.base', '.nome') }
    expect(() => paridade(m)).toThrow(/\(d2\)|\(d3\)|\(d\)/)
  })

  it('apagar uma entrada do inventário derruba a regra (a)', async () => {
    const m = await casos()
    const { ['linhas[].base']: _fora, ...sem } = INVENTARIO_COMPARAR
    void _fora
    expect(() => provarParidade({ modelo: m.modelo, inventario: sem, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: colunasDe(m.modelo), cruas: CRUAS })).toThrow(/\(a\).*linhas\[\]\.base/)
  })

  it('tratar `erro` como `negado` derruba o caso "leitura falhou"', async () => {
    const estado: EstadoDoPrivado = { acessoPorCanal: { eu: { diario: 'erro', alcance: 'erro' } }, negativa: null }
    const m = await montar(proprioContraConcorrente({ eu: { acesso: 'erro', view: null } }, estado, { vpd: null, vpdPorMil: null }), false)
    expect(m.pacote.privado).not.toMatchObject({ motivo: 'nao_conferido' })
    expect(m.pacote.privado).toMatchObject({ motivo: 'leitura_falhou' })
  })
})

describe('Comparar: a lista de números sem prova por igualdade direta está escrita', () => {
  it('SEM_PROVA_POR_IGUALDADE_DIRETA_COMPARAR é a lista dos caminhos com formatador no teste', () => {
    expect([...SEM_PROVA_POR_IGUALDADE_DIRETA_COMPARAR].sort()).toEqual(CRUAS.map((c) => c.caminho).sort())
  })
})
