// @vitest-environment jsdom
/**
 * A5 · E17 degrau 1, Tarefa 5: o inventário de folhas e o auxiliar de paridade. Aqui o modelo de tela é de mentira (canais com mediana,
 * motivo e série); os testes de cada tela real vêm nas Tarefas 6 e 7 e usam o mesmo auxiliar.
 */
import { createElement, useState } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { folhas, ignorados, semDestino, semUso, destinoDe, type Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import type { Celula, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { expandirTela, provarParidade, type EntradaDaParidade, type FolhaCrua } from './contexto-ia-paridade'
import { CONTEXTO } from './contexto-ia-fixture'

afterEach(() => cleanup())

// ───────────────────────── um modelo de tela de mentira
interface Num { x: number | null; texto: string | null; motivo: string | null }
interface CanalDeMentira { nome: string; mediana: Num; engaj: Num; base: string; serie: Array<{ dia: string; views: number; texto: string }> }
const canal = (nome: string, mediana: [number, string], engaj: Num, serie: number[]): CanalDeMentira => ({
  nome, mediana: { x: mediana[0], texto: mediana[1], motivo: null }, engaj, base: 'longos em 90 dias',
  serie: serie.map((v, i) => ({ dia: `0${i + 1}/10`, views: v, texto: `${v}` })),
})
const modelo = (): { janela: string; canais: CanalDeMentira[] } => ({
  janela: 'últimos 90 dias',
  canais: [
    canal('Nômade Raiz', [41200, '41,2 mil'], { x: 4.7, texto: '4,7%', motivo: null }, [100, 200]),
    canal('Lucas Bigodinho', [8400, '8,4 mil'], { x: null, texto: null, motivo: 'poucos vídeos para medir' }, [300, 400]),
  ],
})
const INVENTARIO: Inventario = {
  janela: 'rotulo',
  'canais[].nome': 'terceiros',
  'canais[].mediana.x': { descartado: 'repetido' },
  'canais[].mediana.texto': 'numero',
  'canais[].mediana.motivo': 'motivo',
  'canais[].engaj.x': { descartado: 'repetido' },
  'canais[].engaj.texto': 'numero',
  'canais[].engaj.motivo': 'motivo',
  'canais[].base': 'base',
  'canais[].serie[].dia': 'rotulo',
  'canais[].serie[].views': { descartado: 'repetido' },
  'canais[].serie[].texto': 'serie',
}
const COLUNAS = {
  canais: { Canal: '.nome', Mediana: ['.mediana.texto', '.mediana.motivo'], Engajamento: ['.engaj.texto', '.engaj.motivo'], Base: '.base' },
  'dia-0': { Dia: '.dia', Views: '.texto' },
  'dia-1': { Dia: '.dia', Views: '.texto' },
}

const medida = (texto: string | null, motivo: string | null, origemTexto: string, origemMotivo: string): Celula =>
  texto === null ? { papel: 'numero', estado: 'nao_medido', motivo: motivo ?? '', origem: origemMotivo } : { papel: 'numero', estado: 'medido', texto, x: 1, origem: origemTexto }

/** O empacotador de mentira: a lista de canais e uma série por canal. */
function empacotar(m: ReturnType<typeof modelo>): PacoteModelo {
  const colunas = ['Canal', 'Mediana', 'Engajamento', 'Base']
  const lista = {
    id: 'canais', titulo: 'Canais', tipo: 'lista' as const, nomeNoCorte: 'tabela de canais', privada: false, colunas,
    linhas: m.canais.map((c, i): Celula[] => [
      { papel: 'terceiros', texto: c.nome, origem: `pack.canais[${i}].nome` },
      medida(c.mediana.texto, c.mediana.motivo, `pack.canais[${i}].mediana.texto`, `pack.canais[${i}].mediana.motivo`),
      medida(c.engaj.texto, c.engaj.motivo, `pack.canais[${i}].engaj.texto`, `pack.canais[${i}].engaj.motivo`),
      { papel: 'base', texto: c.base, origem: `pack.canais[${i}].base` },
    ]),
  }
  const series = m.canais.map((c, i) => ({
    id: `dia-${i}`, titulo: `Views por dia, ${c.nome}`, tipo: 'dia_a_dia' as const, nomeNoCorte: 'canais', privada: false, colunas: ['Dia', 'Views'],
    linhas: c.serie.map((p, j): Celula[] => [
      { papel: 'rotulo', texto: p.dia, origem: `pack.canais[${i}].serie[${j}].dia` },
      { papel: 'numero', estado: 'medido', texto: p.texto, x: p.views, origem: `pack.canais[${i}].serie[${j}].texto` },
    ]),
  }))
  return {
    tela: 'canais', janela: m.janela, foco: [], tabelas: [lista, ...series], citados: [], definicoes: [], avisos: [], naoMede: [],
    privado: { estado: 'na' }, comentarios: { estado: 'na' }, vazio: null, motivoDoMagro: null, listasCompletas: false,
  }
}

const textoDaTelaDe = (m: ReturnType<typeof modelo>): string =>
  [m.janela, ...m.canais.flatMap((c) => [c.nome, c.mediana.texto, c.mediana.motivo, c.engaj.texto, c.engaj.motivo, c.base, ...c.serie.map((p) => `${p.dia} ${p.texto}`)])].filter(Boolean).join('\n')

function entrada(trocas: Partial<EntradaDaParidade> & { pacote?: PacoteModelo } = {}): EntradaDaParidade {
  const m = modelo()
  const pacote = trocas.pacote ?? empacotar(m)
  return {
    modelo: m, inventario: INVENTARIO, pacote, textoDaTela: textoDaTelaDe(m), colunas: COLUNAS,
    textoDoPacote: montarTexto(segmentar(pacote, CONTEXTO), '', 30_000, 'todos').texto,
    ...trocas,
  }
}

describe('folhas', () => {
  it('objeto aninhado, lista, null e objeto vazio', () => {
    const v = { a: { b: 1, c: 'x' }, l: [{ d: true }, { d: false }], n: null, vazio: {}, lv: [] }
    expect(folhas(v)).toEqual([
      { caminho: 'a.b', valor: 1 }, { caminho: 'a.c', valor: 'x' }, { caminho: 'l[].d', valor: true }, { caminho: 'l[].d', valor: false }, { caminho: 'n', valor: null },
    ])
  })

  it('o índice de lista vira [] e listas aninhadas viram [][]', () => {
    expect(folhas({ m: [[1, 2], [3]] }).map((f) => f.caminho)).toEqual(['m[][]', 'm[][]', 'm[][]'])
    expect(folhas([{ a: 1 }]).map((f) => f.caminho)).toEqual(['[].a'])
    expect(folhas('solto')).toEqual([{ caminho: '', valor: 'solto' }])
  })

  it('undefined é uma folha nula (o dado ausente também precisa de destino)', () => {
    expect(folhas({ a: undefined })).toEqual([{ caminho: 'a', valor: null }])
  })

  it('funções e elementos React ficam de fora e são listados à parte', () => {
    const v = { f: () => 1, el: createElement('b', null, 'x'), ok: 2 }
    expect(folhas(v)).toEqual([{ caminho: 'ok', valor: 2 }])
    expect(ignorados(v)).toEqual([{ caminho: 'f', tipo: 'funcao' }, { caminho: 'el', tipo: 'elemento_react' }])
  })

  it('referência circular não trava', () => {
    const a: Record<string, unknown> = { x: 1 }
    a['eu'] = a
    expect(folhas(a)).toEqual([{ caminho: 'x', valor: 1 }])
  })

  it('ciclo de verdade em dois passos (a -> b -> a) e dentro de lista não trava e lista cada folha uma vez', () => {
    const a: Record<string, unknown> = { x: 1 }
    const b: Record<string, unknown> = { y: 2, volta: a }
    a['b'] = b
    a['lista'] = [b, a]
    expect(folhas(a)).toEqual([
      { caminho: 'x', valor: 1 },
      { caminho: 'b.y', valor: 2 },
      { caminho: 'lista[].y', valor: 2 },
    ])
  })

  it('objeto compartilhado por duas chaves (DAG, não ciclo) é percorrido nos dois caminhos', () => {
    const medida = { texto: '10', x: 10 }
    const modelo = { a: medida, b: medida, lista: [medida, medida] }
    expect(folhas(modelo).map((f) => f.caminho)).toEqual(['a.texto', 'a.x', 'b.texto', 'b.x', 'lista[].texto', 'lista[].x', 'lista[].texto', 'lista[].x'])
    const comFuncao = { f: () => 1 }
    expect(ignorados({ a: comFuncao, b: comFuncao }).map((i) => i.caminho)).toEqual(['a.f', 'b.f'])
  })

  it('semDestino acusa o campo sem destino no SEGUNDO caminho de um objeto compartilhado', () => {
    const medida = { texto: '10', x: 10 }
    const modelo = { a: medida, b: medida }
    expect(semDestino(modelo, { 'a.texto': 'numero', 'a.x': 'serie' })).toEqual(['b.texto', 'b.x'])
    const compartilhado = { a: medida, b: medida, c: [medida] }
    expect(semDestino(compartilhado, { 'a.texto': 'numero', 'a.x': 'serie', 'b.*': 'numero' })).toEqual(['c[].texto', 'c[].x'])
  })
})

describe('semDestino e semUso', () => {
  it('o inventário do modelo de mentira está completo e sem sobra', () => {
    expect(semDestino(modelo(), INVENTARIO)).toEqual([])
    expect(semUso(modelo(), INVENTARIO)).toEqual([])
  })

  it('semDestino acha o campo novo (o controle negativo do item 160)', () => {
    const m = { ...modelo(), canais: modelo().canais.map((c) => ({ ...c, curtidas: 10 })) }
    expect(semDestino(m, INVENTARIO)).toEqual(['canais[].curtidas'])
    const topo = { ...modelo(), novoNumero: 7 }
    expect(semDestino(topo, INVENTARIO)).toEqual(['novoNumero'])
  })

  it('semUso acha a declaração velha', () => {
    expect(semUso(modelo(), { ...INVENTARIO, 'canais[].apagado': 'numero' })).toEqual(['canais[].apagado'])
  })

  it('curinga só no fim do caminho', () => {
    const m = { capa: { url: 'u', largura: 3 }, outra: { url: 'v' } }
    expect(semDestino(m, { 'capa.*': { descartado: 'imagem' }, 'outra.url': { descartado: 'endereço' } })).toEqual([])
    // asterisco no meio não é curinga: não casa com nada e a chave fica sem uso
    expect(semDestino(m, { 'capa.*.url': { descartado: 'imagem' }, 'capa.url': { descartado: 'imagem' } })).toEqual(['capa.largura', 'outra.url'])
    expect(semUso(m, { 'capa.*.url': { descartado: 'imagem' } })).toEqual(['capa.*.url'])
    expect(semUso(m, { 'capa.*': { descartado: 'imagem' }, 'zzz.*': 'numero' })).toEqual(['zzz.*'])
  })

  it('o curinga mais específico ganha', () => {
    const inv: Inventario = { 'a.*': 'base', 'a.b.*': 'numero' }
    expect(destinoDe('a.b.c', inv)).toBe('numero')
    expect(destinoDe('a.x', inv)).toBe('base')
    expect(destinoDe('z', inv)).toBeUndefined()
  })
})

describe('provarParidade', () => {
  it('aceita o empacotador certo', () => {
    expect(() => provarParidade(entrada())).not.toThrow()
  })

  it('(a) cai com campo novo no modelo sem destino, e a mensagem diz o caminho', () => {
    const m = modelo()
    const comCampo = { ...m, canais: m.canais.map((c) => ({ ...c, curtidas: 10 })) }
    expect(() => provarParidade(entrada({ modelo: comCampo }))).toThrow(/canais\[\]\.curtidas/)
  })

  it('falha quando o pacote tem um número que a tela não tem', () => {
    const pacote = empacotar(modelo())
    pacote.tabelas[0]!.linhas[0]![1] = { papel: 'numero', estado: 'medido', texto: '99 mil', x: 99000, origem: 'pack.canais[0].mediana.texto' }
    expect(() => provarParidade(entrada({ pacote }))).toThrow(/\(c\) o pacote tem "99 mil"/)
  })

  it('falha quando a tela tem um número que o pacote não tem', () => {
    const pacote = empacotar(modelo())
    for (const linha of pacote.tabelas[0]!.linhas) linha[3] = { papel: 'base', texto: 'outra base', origem: 'pack.canais[0].base' } // some "longos em 90 dias" do pacote inteiro
    expect(() => provarParidade(entrada({ pacote }))).toThrow(/\(b\) a tela mostra "longos em 90 dias"/)
  })

  it('falha quando o JSON diverge da tabela', () => {
    const e = entrada()
    const ruim = e.textoDoPacote.replace('"texto": "41,2 mil"', '"texto": "41,3 mil"')
    expect(ruim).not.toBe(e.textoDoPacote)
    expect(() => provarParidade({ ...e, textoDoPacote: ruim })).toThrow(/\(e\) canais, linha 1, coluna "Mediana": o JSON diverge/)
  })

  it('falha quando o JSON perde uma linha', () => {
    const e = entrada()
    const pacote = empacotar(modelo())
    pacote.tabelas[0]!.linhas.pop()
    const textoDoPacote = montarTexto(segmentar(pacote, CONTEXTO), '', 30_000, 'todos').texto
    expect(() => provarParidade({ ...e, textoDoPacote })).toThrow(/\(e\) canais: o JSON tem 1 linhas e a tabela 2/)
  })

  it('aceita série conferida pela origem (o gráfico desenha os pontos e a tela não os escreve)', () => {
    const m = modelo()
    const semNaTela = textoDaTelaDe(m).replace(/0\d\/10 \d+/g, '')
    expect(() => provarParidade(entrada({ textoDaTela: semNaTela }))).not.toThrow()
  })

  it('a série com valor errado cai pela origem', () => {
    const pacote = empacotar(modelo())
    pacote.tabelas[1]!.linhas[0]![1] = { papel: 'numero', estado: 'medido', texto: '555', x: 555, origem: 'pack.canais[0].serie[0].texto' }
    expect(() => provarParidade(entrada({ pacote, textoDaTela: textoDaTelaDe(modelo()) + '\n555' }))).toThrow(/\(d2\) o texto da célula não é o da folha \(dia-0/)
  })

  it('(d2) cai com dois canais trocados de lugar (os dois números existem na tela e no pacote; só a igualdade por origem pega)', () => {
    const pacote = empacotar(modelo())
    const [a, b] = [pacote.tabelas[0]!.linhas[0]![1] as Extract<Celula, { estado: 'medido' }>, pacote.tabelas[0]!.linhas[1]![1] as Extract<Celula, { estado: 'medido' }>]
    pacote.tabelas[0]!.linhas[0]![1] = { ...a, texto: b.texto } // o texto do canal 1 sob a origem honesta do canal 0
    pacote.tabelas[0]!.linhas[1]![1] = { ...b, texto: a.texto }
    expect(() => provarParidade(entrada({ pacote }))).toThrow(/\(d2\) o texto da célula não é o da folha/)
  })

  it('(d2) cai com uma linha de lista deslocada em uma posição', () => {
    const pacote = empacotar(modelo())
    pacote.tabelas[0]!.linhas[0]![1] = { papel: 'numero', estado: 'medido', texto: '8,4 mil', x: 8400, origem: 'pack.canais[1].mediana.texto' } // o rótulo é do canal 0, o número do canal 1
    expect(() => provarParidade(entrada({ pacote }))).toThrow(/\(d2\) as células da linha 1 de canais apontam para elementos diferentes/)
  })

  it('(d2) cai com o campo vizinho de mesmo texto (duas folhas com o texto "3")', () => {
    const m = modelo()
    m.canais[0]!.mediana.texto = '3'
    m.canais[1]!.mediana.texto = '3'
    const pacote = empacotar(m)
    pacote.tabelas[0]!.linhas[0]![1] = { papel: 'numero', estado: 'medido', texto: '3', x: 3, origem: 'pack.canais[1].mediana.texto' } // o texto é igual, a origem é a do vizinho
    expect(() => provarParidade({ ...entrada({ pacote }), modelo: m, textoDaTela: textoDaTelaDe(m) })).toThrow(/\(d2\) as células da linha 1 de canais apontam para elementos diferentes/)
  })

  it('(d) origem sem índice numa lista: falha', () => {
    const pacote = empacotar(modelo())
    pacote.tabelas[0]!.linhas[0]![3] = { papel: 'base', texto: 'longos em 90 dias', origem: 'pack.canais[].base' }
    expect(() => provarParidade(entrada({ pacote }))).toThrow(/\(d\) origem sem índice numa lista/)
  })

  it('(d) origem que não existe no modelo, e destino incompatível', () => {
    const pacote = empacotar(modelo())
    pacote.tabelas[0]!.linhas[0]![3] = { papel: 'base', texto: 'longos em 90 dias', origem: 'pack.canais[0].nao_existe' }
    expect(() => provarParidade(entrada({ pacote }))).toThrow(/\(d\) a origem não existe no modelo/)
    const outro = empacotar(modelo())
    outro.tabelas[0]!.linhas[0]![3] = { papel: 'numero', estado: 'medido', texto: 'longos em 90 dias', x: null, origem: 'pack.canais[0].base' }
    expect(() => provarParidade(entrada({ pacote: outro }))).toThrow(/\(d\) destino incompatível/)
  })

  it('(d3) cai com duas colunas trocadas na mesma linha (a mediana sob "Engajamento": a (d2) passa e a (d3) pega)', () => {
    const pacote = empacotar(modelo())
    const l = pacote.tabelas[0]!.linhas[0]!
    ;[l[1], l[2]] = [l[2]!, l[1]!] // origens honestas, mesma linha, colunas trocadas
    expect(() => provarParidade(entrada({ pacote }))).toThrow(/\(d3\) célula sob o cabeçalho errado \(canais, linha 1, coluna "Mediana"\)/)
  })

  it('(d3) cai com coluna do pacote sem entrada no mapa', () => {
    const colunas = { ...COLUNAS, canais: { Canal: '.nome', Mediana: ['.mediana.texto', '.mediana.motivo'], Base: '.base' } }
    expect(() => provarParidade(entrada({ colunas }))).toThrow(/\(d3\) coluna sem entrada no mapa \(canais, linha 1, coluna "Engajamento"\)/)
  })

  it('folha crua: a (d2) compara com o formatador aplicado, e cai se o empacotador formatar de outro jeito', () => {
    const m = modelo()
    const milhares = (v: unknown): string => `${Math.round(Number(v) / 100) / 10} mil`.replace('.', ',')
    const cruas: FolhaCrua[] = [{ caminho: 'canais[].mediana.x', nome: 'milhares', formatador: milhares }]
    const inv: Inventario = { ...INVENTARIO, 'canais[].mediana.x': 'numero', 'canais[].mediana.texto': { descartado: 'repetido' } }
    const pacote = empacotar(m)
    for (const [i, c] of m.canais.entries()) pacote.tabelas[0]!.linhas[i]![1] = { papel: 'numero', estado: 'medido', texto: milhares(c.mediana.x), x: c.mediana.x, origem: `pack.canais[${i}].mediana.x` }
    const colunas = { ...COLUNAS, canais: { ...COLUNAS.canais, Mediana: ['.mediana.x', '.mediana.motivo'] } }
    const base = { ...entrada({ pacote, inventario: inv, colunas }), cruas }
    expect(() => provarParidade({ ...base, textoDaTela: textoDaTelaDe(m) })).not.toThrow()
    // o formatador de mentira (arredonda diferente): a célula já não é a folha formatada
    const mentira: FolhaCrua[] = [{ caminho: 'canais[].mediana.x', nome: 'mentira', formatador: (v) => `${Math.round(Number(v) / 1000)} mil` }]
    expect(() => provarParidade({ ...base, cruas: mentira })).toThrow(/\(d2\)/)
  })
})

describe('expandirTela', () => {
  function ListaDeMentira() {
    const [pagina, setPagina] = useState(1)
    const [medida, setMedida] = useState<'uploads' | 'mediana'>('uploads')
    const [aberto, setAberto] = useState(false)
    return createElement('div', null,
      createElement('p', null, `página ${pagina}`),
      createElement('ul', null, ...Array.from({ length: pagina * 2 }, (_, i) => createElement('li', { key: i }, `item ${i + 1}`))),
      pagina < 3 ? createElement('button', { onClick: () => setPagina(pagina + 1) }, 'Carregar mais') : null,
      createElement('div', { role: 'tablist' },
        createElement('button', { role: 'tab', 'aria-selected': medida === 'uploads', onClick: () => setMedida('uploads') }, 'Uploads'),
        createElement('button', { role: 'tab', 'aria-selected': medida === 'mediana', onClick: () => setMedida('mediana') }, 'Multiplicador')),
      createElement('p', null, medida === 'uploads' ? 'valores de uploads: 12' : 'valores de multiplicador: 3,4'),
      createElement('button', { 'aria-expanded': aberto, onClick: () => setAberto(!aberto) }, 'Descrição'),
      aberto ? createElement('p', null, 'texto inteiro da descrição') : null)
  }

  it('junta o texto da segunda página de uma lista de mentira e das duas posições de um seletor', async () => {
    const { container } = render(createElement(ListaDeMentira))
    expect(container.textContent).not.toContain('item 6')
    const texto = await expandirTela(container)
    expect(texto).toContain('item 6') // clicou "Carregar mais" até acabar
    expect(texto).toContain('valores de uploads: 12')
    expect(texto).toContain('valores de multiplicador: 3,4')
    expect(texto).toContain('texto inteiro da descrição')
  })

  it('devolve o seletor à posição original', async () => {
    const { container } = render(createElement(ListaDeMentira))
    await expandirTela(container)
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Uploads')
  })

  it('tela sem nada a expandir devolve o texto como está', async () => {
    const { container } = render(createElement('p', null, 'só isto'))
    expect(await expandirTela(container)).toBe('só isto')
  })
})
