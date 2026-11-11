// @vitest-environment node
/**
 * A7c2 T11: mediana, quartis, maiores e menores do resumo do todo, pelas funções do motor (`stats.ts`) sobre o `x` das células.
 */
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { RESUMO_MAX, resumoDoTodo } from '@/lib/youtube/observatorio/acesso-ia/resumo'
import type { Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { medido, naoMedido, terceiros, zero } from './contexto-ia-fixture'
import { janela } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/corte-da-ia'
import { CONTEXTO } from './contexto-ia-fixture'
import { a3World } from './a3-fixture'
import { medidasDoOraculo } from './canais-e5a-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { empacotarCanais, modeloDeCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'

const tab = (colunas: string[], linhas: Tabela['linhas'], id = 'canais'): Tabela => ({ id, titulo: id, colunas, linhas, tipo: 'lista', nomeNoCorte: id, privada: false })
const col = (xs: Array<number | null | 'nm' | 'z'>): Tabela => tab(['Canal', 'Views'], xs.map((x, i) => [
  terceiros(`Canal${i + 1}`, `p[${i}].n`),
  x === 'nm' ? naoMedido('sem leitura', `p[${i}].v`) : x === 'z' || x === 0 ? zero(`p[${i}].v`) : medido(x === null ? '?' : String(x), x, `p[${i}].v`),
]))
const linhaDe = (t: string, c: string): string[] => {
  const l = t.split('\n').filter((x) => x.startsWith(`| ${c} |`)).pop() // a tabela de estatísticas vem depois da de contagens
  if (!l) throw new Error(`sem linha ${c}`)
  return l.split('|').slice(2, -1).map((x) => x.trim())
}

describe('A7c2 T11: mediana e quartis do motor', () => {
  it('[1,2,3,4,100]: n 5, mediana 3, Q1 2, Q3 4, maiores 100; 4; 3, menores 1; 2; 3', () => {
    const t = resumoDoTodo(col([1, 2, 3, 4, 100]), [], [])
    expect(t).toContain('conta da ferramenta sobre os números da tela')
    expect(t).toContain('| Coluna | n | Mediana | 1º quartil | 3º quartil | Maiores (3) | Menores (3) |')
    expect(linhaDe(t, 'Views')).toEqual(['5', '3', '2', '4', 'Canal5 100; Canal4 4; Canal3 3', 'Canal1 1; Canal2 2; Canal3 3'])
  })

  it('2 medidos sem x em 5: "não calculado: 2 de 5 sem valor de máquina" e UM aviso com tabela e n (nunca valor)', () => {
    const avisos: Array<[string, Record<string, number | string>]> = []
    const t = resumoDoTodo(col([1, null, 3, null, 5]), [], [], undefined, { avisar: (p, e) => avisos.push([p, e]) })
    expect(t).toContain('não calculado: 2 de 5 sem valor de máquina')
    expect(avisos).toEqual([['resumo_sem_x', { tabela: 'canais', n: 2 }]])
  })

  it('x NaN ou Infinity nunca é impresso: cai como "sem valor de máquina"', () => {
    const t = resumoDoTodo(col([1, NaN, Infinity, 4]), [], [])
    expect(t).not.toMatch(/NaN|Infinity/)
    expect(t).toContain('não calculado: 2 de 4 sem valor de máquina')
  })

  it('nao_medido nunca entra no n; zero_medido (x = 0) entra no n e na mediana', () => {
    const t = resumoDoTodo(col(['nm', 'nm', 0, 10, 20]), [], [])
    expect(linhaDe(t, 'Views').slice(0, 2)).toEqual(['3', '10'])
    const z = resumoDoTodo(col(['z', 'z', 'z', 6]), [], [])
    expect(linhaDe(z, 'Views').slice(0, 2)).toEqual(['4', '0'])
  })

  it('coluna sem nenhum valor (n = 0): n 0 e o resto "sem medida", nunca 0; uma linha só: mediana = quartis = o valor', () => {
    expect(linhaDe(resumoDoTodo(col(['nm', 'nm']), [], []), 'Views')).toEqual(['0', 'sem medida', 'sem medida', 'sem medida', 'sem medida', 'sem medida'])
    expect(linhaDe(resumoDoTodo(col([7]), [], []), 'Views').slice(0, 4)).toEqual(['1', '7', '7', '7'])
  })

  it('NAO_RESUMIR: Posição fica fora em Canais; em outliers entra', () => {
    const p = tab(['Canal', 'Posição', 'Views'], [0, 1, 2].map((i) => [terceiros(`C${i}`, `a${i}`), medido(String(i + 1), i + 1, `b${i}`), medido('9', 9, `c${i}`)]))
    expect(resumoDoTodo(p, [], [], undefined, { tela: 'canais' }).split('Mediana e quartis')[1]).not.toContain('| Posição |')
    expect(resumoDoTodo(p, [], [], undefined, { tela: 'outliers' }).split('Mediana e quartis')[1]).toContain('| Posição |')
  })

  it('tabela coluna: só n, mediana e quartis (sem maiores e menores); empate de maiores na ordem da tela; nome ≤ 24 caracteres', () => {
    const p = tab(['Canal', 'Views'], [['A muito longo nome de canal com mais de vinte e quatro', 5], ['B', 5], ['C', 5], ['D', 1]].map(([n, v], i) => [terceiros(String(n), `n${i}`), medido(String(v), Number(v), `v${i}`)]))
    const ap = tab(['Canal', 'Direção'], [10, 20, 30, 40].map((v, i) => [terceiros(`X${i}`, `d${i}n`), medido(String(v), v, `d${i}`)]), 'canais-direcao')
    const t = resumoDoTodo(p, [{ tabela: ap, donos: [0, 1, 2, 3] }], [])
    const [, , , , maiores] = linhaDe(t, 'Views')
    expect(maiores?.startsWith('A muito longo nome de c… 5; B 5; C 5')).toBe(true)
    expect(Array.from(maiores!.split(' 5;')[0]!).length).toBeLessThanOrEqual(24 + 2)
    expect(linhaDe(t, 'Direção')).toEqual(['4', '25', '17,5', '32,5'])
  })

  it('formato pt-BR com até 2 casas', () => {
    expect(linhaDe(resumoDoTodo(col([1, 2, 4]), [], []), 'Views').slice(1, 4)).toEqual(['2', '1,5', '3'])
  })

  it('célula "sem variação" (semXMotivo) não é falha: fica fora do n e a coluna diz quantas', () => {
    const p = col([1, 2, 3])
    p.linhas.push([terceiros('Canal4', 'p[3].n'), { papel: 'numero', estado: 'medido', texto: '0%', semXMotivo: 'sem variação', origem: 'p[3].v' }])
    const avisos: string[] = []
    const t = resumoDoTodo(p, [], [], undefined, { avisar: (x) => avisos.push(x) })
    expect(t).toContain('| Views (1 sem variação, fora da conta) | 3 | 2 |')
    expect(t).not.toContain('não calculado')
    expect(avisos).toEqual([])
  })

  it('RESUMO_MAX é 5.000', () => { expect(RESUMO_MAX).toBe(5_000) })

  it('Canais com o empacotador REAL: nenhuma coluna sai "não calculado" (prova a F0.5) e o resumo cabe', () => {
    const { obs } = a3World(() => {})
    const view = buildCanaisView(obs, { niche: 'todos', limit: 200, fmt: 'todos', medidas: medidasDoOraculo(obs) }, undefined)
    const ri = buildRiView(obs, { agoraMs: obs.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
    const mod = empacotarCanais(modeloDeCanais(view, ri), { acessoPorCanal: {}, negativa: null })
    const j = janela(mod, CONTEXTO, 1, 200, 45_000)
    expect(j.avisosDoResumo.map((a) => a.passo)).toEqual([])
    expect(j.corte.texto.texto).not.toContain('não calculado')
    expect(j.corte.texto.texto).toContain('Mediana e quartis')
    expect(j.resumoPassou).toBe(false)
  })
})
