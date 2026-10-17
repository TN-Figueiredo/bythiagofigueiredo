// @vitest-environment jsdom
/**
 * E17 degrau 1, Tarefa 16: o empacotador de "Saíram do YouTube" (a fila). Paridade com o componente REAL da tela em cada estado da matriz, o que
 * acontece quando o dado não existe, e a prova do plano: o que o dono mandou APAGAR (classe (iii)) não entra por caminho nenhum, e texto de comentário
 * não existe no pacote ("comentário (texto não incluído)"). Fixtures: as da própria tela (`saiu-fixtures`).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FilaScreen } from '@/app/cms/(authed)/youtube/competitors/_saiu/fila-screen'
import { buildFilaView, type FilaViewOk } from '@/app/cms/(authed)/youtube/competitors/_saiu/view-model'
import {
  empacotarFila, INVENTARIO_FILA, modeloDeFila, SEM_FOLHA_NA_MATRIZ_FILA, SEM_PROVA_POR_IGUALDADE_DIRETA_FILA, type ModeloFila,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-fila'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { ignorados, semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { LeituraDaFila } from '@/lib/youtube/observatorio/saiu/modelo'
import { CONTEXTO } from './contexto-ia-fixture'
import { expandirTela, provarParidade } from './contexto-ia-paridade'
import { AGORA, apagando, canal, fila, grupo, ha, previaVideo, respondidoApagado, respondidoMantido, video, voltouApagado } from './saiu-fixtures'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))

const acoes = {
  apagar: async () => ({ desfecho: 'mantido', frase: '' }), manter: async () => ({ desfecho: 'mantido', frase: '' }), volta: async () => ({ desfecho: 'mantido', frase: '' }),
  tentar: async () => ({ desfecho: 'mantido', frase: '' }), ignorarGrupo: async () => ({ desfecho: 'mantido', frase: '' }),
} as never

interface Montado { view: FilaViewOk; modelo: ModeloFila; pacote: PacoteModelo; textoDoPacote: string; textoDaTela: string }
const textoDoPacote = (p: PacoteModelo, limite = 1_000_000): string => montarTexto(segmentar(p, CONTEXTO), '', limite, 'todos').texto

async function montar(leitura: LeituraDaFila, mostrar = 10, desenhar = true): Promise<Montado> {
  const v = buildFilaView(leitura, { agoraMs: AGORA, mostrar })
  if (v.estado !== 'ok') throw new Error(`a matriz só usa o estado ok: ${v.estado}`)
  const modelo = modeloDeFila(v)
  const pacote = empacotarFila(modelo)
  let textoDaTela = ''
  if (desenhar) {
    const { container } = render(<FilaScreen view={v} acoes={acoes} />)
    textoDaTela = await expandirTela(container)
    cleanup()
  }
  return { view: v, modelo, pacote, textoDoPacote: textoDoPacote(pacote), textoDaTela }
}

// ───────────────────────── o mapa de colunas da regra (d3), escrito aqui
const COLUNAS: Record<string, Record<string, string | readonly string[]>> = {
  'fila-por-tipo': { Tipo: '.texto', Itens: '.n' },
  'fila-fora-da-pagina': { 'Ainda na fila, fora desta página': 'maisN.n' },
  esperando: { Tipo: '.rotuloDoTipo', Item: '.titulo', 'Desde quando': '.quando', Detalhe: '.linha2' },
  'esperando-dados': { Item: '.titulo', Dado: '.rotulo', Valor: '.valor' },
  'esperando-guardado': { Item: '.titulo', Guardado: '.texto', Quantidade: '.n' },
  'esperando-notas': { Item: '.titulo', Aviso: ['.erroDaPrevia', '.nota', '.naoSai[0]', '.naoSai[1]', '.naoSai[2]', '.naoSai[3]', '.naoSai[4]'] },
  voltaram: { Tipo: '.rotuloDoTipo', Item: ['.titulo', '.codigo', '.rotuloDoTipo'], Quando: '.quando', Situação: '.texto' },
  apagando: { 'Código no YouTube': '.codigo', Desde: '.desde', 'O que falta': '.falta' },
  'apagando-voltou': { 'Código no YouTube': '.codigo', 'Voltou ao ar': '.voltou' },
  respondidos: { Tipo: '.rotuloDoTipo', Item: ['.titulo', '.codigo'], Situação: '.situacao', Quando: '.quando', 'Situação do dado': '.texto' },
  'respondidos-total': { Total: '.total' },
}
const paridade = (m: Montado) => provarParidade({
  modelo: m.modelo, inventario: INVENTARIO_FILA, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [],
})

// ───────────────────────── a matriz de estados
const MUITOS = Array.from({ length: 14 }, (_, i) => video(i + 1))
const MATRIZ: Array<[string, () => LeituraDaFila, number?]> = [
  ['vídeo, canal e grupo de comentários', () => fila({ esperando: [video(1), canal(), grupo()] })],
  ['só um vídeo', () => fila({ esperando: [video(1)] })],
  ['tudo ao mesmo tempo', () => fila({
    esperando: [video(1), canal(), grupo()], apagando: [apagando(1)], voltaram: [voltouApagado(), { ...voltouApagado(), pedeResposta: false, titulo: 'Mantido que voltou', codigo: 'VOL2', itemIds: [] }],
    respondidos: [respondidoMantido(), respondidoApagado()], respondidosTotal: 2,
  })],
  ['mais itens do que a página', () => fila({ esperando: MUITOS.slice(0, 10), totalEsperando: 14 })],
  ['segunda página (mostrar=20)', () => fila({ esperando: MUITOS, totalEsperando: 14 }), 20],
  ['quem só lê (sem permissão)', () => fila({ esperando: [video(1)], podeResponder: false })],
  ['só apagando', () => fila({ esperando: [], apagando: [apagando(1), apagando(2, { arquivoPendente: true, voltouEm: ha(1) })] })],
  ['só voltaram', () => fila({ esperando: [], voltaram: [voltouApagado()] })],
  ['respondidos com "e mais"', () => fila({ esperando: [video(1)], respondidos: [respondidoMantido(), respondidoApagado()], respondidosTotal: 40 })],
  ['previa falhou (cartão sem "Guardado")', () => fila({ esperando: [video(1, { previa: { erro: 'contagem_indisponivel' } as never })] })],
  ['vazia, leitura recente', () => fila({ esperando: [] })],
  ['vazia, leitura antiga', () => fila({ esperando: [], ultimaLeituraDosCanais: ha(3) })],
  ['vazia, sem nenhuma leitura', () => fila({ esperando: [], ultimaLeituraDosCanais: null })],
  ['vazia, sem canais', () => fila({ esperando: [], canaisDoSite: 0 })],
]

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Fila: paridade em cada estado da matriz', () => {
  for (const [nome, fazer, mostrar] of MATRIZ) {
    it(`${nome}: a tela e o pacote dizem o mesmo`, async () => {
      const m = await montar(fazer(), mostrar)
      expect(m.textoDaTela.length).toBeGreaterThan(50)
      expect(() => paridade(m)).not.toThrow()
    })
  }

  it('toda folha do modelo tem destino em todos os estados, e o inventário não guarda declaração velha (união da matriz)', async () => {
    const usos = new Set<string>()
    for (const [, fazer, mostrar] of MATRIZ) {
      const m = await montar(fazer(), mostrar, false)
      expect(semDestino(m.modelo, INVENTARIO_FILA)).toEqual([])
      expect(ignorados(m.modelo)).toEqual([])
      const sobra = new Set(semUso(m.modelo, INVENTARIO_FILA))
      for (const k of Object.keys(INVENTARIO_FILA)) if (!sobra.has(k)) usos.add(k)
    }
    const naoUsadas = Object.keys(INVENTARIO_FILA).filter((k) => !usos.has(k))
    expect(naoUsadas.filter((k) => !SEM_FOLHA_NA_MATRIZ_FILA.includes(k))).toEqual([])
  })

  it('o pacote tem as dimensões de quem pede e leva todos os itens da página, na ordem da tela', async () => {
    const m = await montar(MATRIZ[0]![1](), 10, false)
    expect(m.pacote.tela).toBe('fila')
    expect(m.pacote.listasCompletas).toBe(false)
    expect(m.pacote.privado).toEqual({ estado: 'na' })
    expect(m.pacote.comentarios).toEqual({ estado: 'na' })
    const t = m.pacote.tabelas.find((x) => x.id === 'esperando')!
    expect(t.linhas.map((l) => (l[1] as { texto: string }).texto)).toEqual(m.view.cartoes.map((c) => c.titulo))
  })

  it('"mais itens do que a página": o número do que ficou de fora vai no pacote, igual ao da tela', async () => {
    const m = await montar(MATRIZ[3]![1](), 10, false)
    expect(m.view.maisN!.n).toBe(4)
    const t = m.pacote.tabelas.find((x) => x.id === 'fila-fora-da-pagina')!
    expect(t.linhas[0]![0]).toMatchObject({ papel: 'numero', texto: '4' })
  })
})

describe('Fila: o que acontece quando o dado não existe', () => {
  it('fila vazia: nenhuma tabela de itens, `vazio` com a frase da tela (e o aviso de leitura antiga NÃO some)', async () => {
    const m = await montar(fila({ esperando: [], ultimaLeituraDosCanais: ha(3) }), 10, false)
    expect(m.view.resumo.vazia).toBe(true)
    expect(m.pacote.tabelas).toEqual([])
    expect(m.pacote.vazio).toBe(`${m.view.resumo.negrito} ${m.view.resumo.texto}`)
    expect(m.pacote.vazio).toMatch(/não dá para afirmar que nada saiu/)
    expect(segmentar(m.pacote, CONTEXTO).vazio).toBe(true)
  })

  it('cartão cuja prévia falhou: o pacote diz que a contagem não está disponível, sem inventar "Guardado"', async () => {
    const m = await montar(fila({ esperando: [video(1, { previa: { erro: 'contagem_indisponivel' } as never })] }), 10, false)
    expect(m.view.cartoes[0]!.erroDaPrevia).not.toBeNull()
    expect(m.textoDoPacote).toContain(m.view.cartoes[0]!.erroDaPrevia!)
    expect(m.pacote.tabelas.some((t) => t.id === 'esperando-guardado')).toBe(false)
  })
})

describe('Fila: o que o dono mandou apagar não entra (classe (iii)), nem texto de comentário', () => {
  const SENT = 'SENTINELA-TITULO-APAGADO-93817'
  const SENT_CANAL = 'SENTINELA-CANAL-APAGADO-55120'

  it('título e nome em item apagado (voltou, respondido) NÃO saem, mesmo que o dado traga; o código e a data saem', async () => {
    const leitura = fila({
      esperando: [video(1)],
      voltaram: [voltouApagado({ titulo: SENT, codigo: 'VOLCOD00001' })],
      respondidos: [respondidoApagado({ titulo: SENT_CANAL, codigo: 'UCAPAGADO0001' }), respondidoMantido({ titulo: 'Título do mantido visível' })],
      respondidosTotal: 2,
    })
    const m = await montar(leitura, 10, false)
    const tudo = JSON.stringify(m.pacote) + m.textoDoPacote
    expect(tudo).not.toContain(SENT)
    expect(tudo).not.toContain(SENT_CANAL)
    expect(tudo).toContain('VOLCOD00001')
    expect(tudo).toContain('UCAPAGADO0001')
    expect(tudo).toContain('Título do mantido visível') // o mantido continua guardado: o título é o que a tela mostra
  })

  it('o item da fila aberta e o apagando só levam o que a tela leva (título do que ainda não foi apagado entra; do apagado nunca)', async () => {
    const m = await montar(fila({ esperando: [video(1, { titulo: 'Vídeo ainda guardado' })], apagando: [apagando(1)] }), 10, false)
    expect(m.textoDoPacote).toContain('Vídeo ainda guardado')
    expect(m.pacote.tabelas.find((t) => t.id === 'apagando')!.colunas).toEqual(['Código no YouTube', 'Desde', 'O que falta'])
  })

  it('comentários: o grupo entra como contagem e vídeos, sem texto, nome nem id de comentário; o "não mede" diz isso', async () => {
    const m = await montar(fila({ esperando: [grupo()] }), 10, false)
    expect(m.pacote.naoMede.join(' ')).toMatch(/texto dos comentários/)
    expect(m.pacote.comentarios).toEqual({ estado: 'na' })
    expect(m.view.cartoes[0]!.tipo).toBe('comentarios')
    expect(m.textoDoPacote).toContain(m.view.cartoes[0]!.titulo)
  })
})

describe('Fila: o que o site escreve não leva endereço', () => {
  it('nenhum texto do pacote leva "/cms/" nem "http" (a prévia tem endereço de Blob; não pode sair)', async () => {
    for (const [, fazer, mostrar] of MATRIZ) {
      const m = await montar(fazer(), mostrar, false)
      expect(m.textoDoPacote).not.toMatch(/\/cms\/|https?:|i\.ytimg|blob\.vercel|\?niche=|\?mostrar=/i)
    }
  })
})

describe('Fila: nenhuma frase longa com acento digitada fora das constantes de "não mede"', () => {
  it('o empacotador só tem frases longas nas constantes permitidas', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-fila.ts'), 'utf8')
    const permitidas = ['por que um item saiu do YouTube', 'o texto dos comentários', 'o que o dono já mandou apagar']
    const codigo = fonte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\b(titulo|nomeNoCorte):/.test(l)).map((l) => l.replace(/\s\/\/.*$/, ''))
    const literais = [...codigo.join('\n').matchAll(/(['`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]!).filter((s) => s.replace(/\$\{[^}]*\}/g, '').trim().split(/\s+/).length >= 10 && /[áàâãéêíóôõúç]/i.test(s))
    expect(literais.filter((s) => !permitidas.some((p) => s.startsWith(p)))).toEqual([])
  })
})

describe('Fila: provas por mutação (a paridade cai)', () => {
  it('trocar o item de uma linha por outro derruba a regra (d2)', async () => {
    const m = await montar(fila({ esperando: [video(1), canal()] }))
    const t = m.pacote.tabelas.find((x) => x.id === 'esperando')!
    const c = t.linhas[0]![1]!
    t.linhas[0]![1] = { ...c, origem: c.origem.replace(/cartoes\[(\d+)\]/, 'cartoes[1]') }
    expect(() => paridade(m)).toThrow(/\(d2\)/)
  })

  it('apagar uma entrada do inventário derruba a regra (a)', async () => {
    const m = await montar(fila({ esperando: [video(1)] }))
    const { ['cartoes[].quando']: _fora, ...sem } = INVENTARIO_FILA
    void _fora
    expect(() => provarParidade({ modelo: m.modelo, inventario: sem, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [] }))
      .toThrow(/\(a\).*quando/)
  })
})

describe('Fila: lista de números sem prova por igualdade direta', () => {
  it('é vazia', () => { expect([...SEM_PROVA_POR_IGUALDADE_DIRETA_FILA]).toEqual([]) })
})

void previaVideo
