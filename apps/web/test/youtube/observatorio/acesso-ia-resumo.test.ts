// @vitest-environment node
/**
 * A7c1 T10: o resumo do todo por contagens. Calculado sobre TODAS as linhas da principal e das tabelas coluna, antes da janela.
 * Os estados são disjuntos e somam M em toda coluna; "não medido", "falhou" e "restrito" nunca viram zero.
 */
import { describe, expect, it } from 'vitest'
import { CATEGORIAS_NO_RESUMO, RESUMO_MAX, resumoDoTodo } from '@/lib/youtube/observatorio/acesso-ia/resumo'
import type { Celula, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { medido, naoMedido, rotulo, terceiros, zero } from './contexto-ia-fixture'

const falhou = (o: string): Celula => ({ papel: 'numero', estado: 'falhou', motivo: 'leitura falhou', origem: o })
const restrito = (o: string): Celula => ({ papel: 'numero', estado: 'restrito', motivo: 'sem acesso', origem: o })

const tabela = (id: string, colunas: string[], linhas: Celula[][], tipo: Tabela['tipo'] = 'lista'): Tabela => ({ id, titulo: id, colunas, linhas, tipo, nomeNoCorte: id, privada: false })

/** 1.000 canais: Inscritos com 300 não medidos e 5 falhou; o resto medido (os 10 primeiros, zero). */
function mil(): Tabela {
  const linhas = Array.from({ length: 1000 }, (_, i): Celula[] => {
    const o = `pack.canais[${i}].inscritos`
    const c: Celula = i < 300 ? naoMedido('sem leitura', o) : i < 305 ? falhou(o) : i < 315 ? zero(o) : medido(String(i), i, o)
    return [terceiros(`Canal ${i}`, `pack.canais[${i}].name`), c]
  })
  return tabela('canais', ['Canal', 'Inscritos'], linhas)
}

const linhaDe = (texto: string, coluna: string): string[] => {
  const l = texto.split('\n').find((x) => x.startsWith(`| ${coluna} |`))
  if (!l) throw new Error(`sem a linha da coluna ${coluna}`)
  return l.split('|').slice(2, -1).map((x) => x.trim())
}

describe('A7c1 T10: resumoDoTodo', () => {
  it('1.000 linhas, 300 não medidas e 5 que falharam: 695 medidos (10 deles zero medido), 300 sem medida, 5 falhou', () => {
    const t = resumoDoTodo(mil(), [], [])
    expect(t).toContain('## Resumo do todo (calculado sobre as 1000 linhas do pacote, antes da janela)')
    expect(t).toContain('| Coluna | Medidos | Zeros medidos | Sem medida | Falhou | Restrito | Sem linha |')
    expect(linhaDe(t, 'Inscritos')).toEqual(['685', '10', '300', '5', '0', '0'])
    expect(t).toContain('| Inscritos | 685 | 10 | 300 | 5 | 0 | 0 |')
  })

  it('propriedade: medidos + zeros + sem medida + falhou + restrito + sem linha = M em toda coluna, inclusive tabela coluna incompleta', () => {
    const M = 40
    const principal = tabela('canais', ['Canal', 'Views'], Array.from({ length: M }, (_, i) => [terceiros(`C${i}`, `p[${i}].n`), i % 5 === 0 ? restrito(`p[${i}].v`) : i % 3 === 0 ? naoMedido('x', `p[${i}].v`) : medido('1', 1, `p[${i}].v`)]))
    // tabela coluna com 25 linhas dos 40 canais (os pares); o resto não tem linha
    const ap = tabela('canais-direcao-numeros', ['Canal', 'Direção'], Array.from({ length: 25 }, (_, i) => [terceiros(`C${i}`, `d[${i}].n`), i % 4 === 0 ? zero(`d[${i}].v`) : medido('2', 2, `d[${i}].v`)]))
    const t = resumoDoTodo(principal, [{ tabela: ap, donos: Array.from({ length: 25 }, (_, i) => i) }], [])
    for (const col of ['Views', 'Direção']) expect(linhaDe(t, col).map(Number).reduce((a, b) => a + b, 0)).toBe(M)
    expect(linhaDe(t, 'Direção')[5]).toBe('15')
  })

  it('tabela coluna presente e sem nenhuma linha: sai uma linha com Sem linha = M, nunca some', () => {
    const t = resumoDoTodo(mil(), [{ tabela: tabela('canais-views-por-dia', ['Canal', 'Views/dia'], []), donos: [] }], [])
    expect(t).toContain('| canais-views-por-dia (sem nenhuma linha) | 0 | 0 | 0 | 0 | 0 | 1000 |')
  })

  it('linha de apoio sem dona ou repetida não entra na conta (a soma nunca passa de M)', () => {
    const principal = tabela('canais', ['Canal', 'A'], [[terceiros('X', 'a'), medido('1', 1, 'a1')], [terceiros('Y', 'b'), medido('1', 1, 'b1')]])
    const ap = tabela('canais-estado', ['Canal', 'B'], [[terceiros('X', 'c'), medido('1', 1, 'c1')], [terceiros('X', 'c'), medido('1', 1, 'c2')], [terceiros('Z', 'd'), medido('1', 1, 'd1')]])
    const t = resumoDoTodo(principal, [{ tabela: ap, donos: [0, 0, -1] }], [])
    expect(linhaDe(t, 'B')).toEqual(['1', '0', '0', '0', '0', '1'])
  })

  it('M = 0: o resumo não sai', () => {
    expect(resumoDoTodo(tabela('canais', ['Canal', 'Inscritos'], []), [], [])).toBe('')
  })

  it('coluna sem nenhuma célula numérica não entra; coluna toda não medida sai com 0 | 0 | M', () => {
    const p = tabela('canais', ['Canal', 'Nicho', 'Inscritos'], [[terceiros('A', 'a'), rotulo('x', 'n'), naoMedido('m', 'i1')], [terceiros('B', 'b'), rotulo('y', 'n2'), naoMedido('m', 'i2')]])
    const t = resumoDoTodo(p, [], [])
    expect(t).not.toContain('| Nicho |')
    expect(linhaDe(t, 'Inscritos')).toEqual(['0', '0', '2', '0', '0', '0'])
  })

  it('categorias contam sobre todas as linhas, maiores primeiro, até 8 valores e "mais N valores"', () => {
    const nichos = Array.from({ length: 12 }, (_, i) => `Nicho${String(i).padStart(2, '0')}`)
    const linhas = Array.from({ length: 1000 }, (_, i): Celula[] => [terceiros(`V${i}`, `v${i}`), rotulo(i < 400 ? 'Grande' : nichos[i % 12]!, `n${i}`), medido('1', 1, `m${i}`)])
    const t = resumoDoTodo(tabela('outliers', ['Vídeo', 'Nicho', 'Views'], linhas), [], ['Nicho'])
    const l = t.split('\n').find((x) => x.startsWith('Por Nicho:'))!
    expect(l.startsWith('Por Nicho: Grande 400;')).toBe(true)
    expect(l).toMatch(/mais 5 valores$/)
    expect(l.split(';').length).toBe(9) // 8 valores + "mais 5 valores"
  })

  it('categoria que a tabela não tem: a linha não sai (nada de "Por X: " vazio)', () => {
    expect(resumoDoTodo(mil(), [], ['Nicho'])).not.toContain('Por Nicho')
  })

  it('a tela mostra só parte do conjunto: o título diz', () => {
    const t = resumoDoTodo(mil(), [], [], { mostrados: 100, total: 1000 })
    expect(t.split('\n')[0]).toBe('## Resumo do todo (calculado sobre as 1000 linhas do pacote, antes da janela; a tela mostra 100 de 1000)')
  })

  it('pior caso cabe em RESUMO_MAX: 30 colunas numéricas em 9 tabelas e 8 valores longos de categoria', () => {
    const M = 200
    const p = tabela('canais', ['Canal', 'Nicho', ...Array.from({ length: 6 }, (_, i) => `Medida principal número ${i}`)], Array.from({ length: M }, (_, i): Celula[] => [terceiros(`C${i}`, `p${i}`), rotulo(`Um nicho com nome comprido demais ${i % 20}`, `n${i}`), ...Array.from({ length: 6 }, (_, j) => medido('1', 1, `p${i}.${j}`))]))
    const aps = Array.from({ length: 8 }, (_, a) => ({
      tabela: tabela(`ap${a}`, ['Canal', ...Array.from({ length: 3 }, (_, i) => `Medida de apoio ${a}-${i}`)], Array.from({ length: M }, (_, i): Celula[] => [terceiros(`C${i}`, `a${i}`), ...Array.from({ length: 3 }, (_, j) => medido('1', 1, `a${a}.${i}.${j}`))])),
      donos: Array.from({ length: M }, (_, i) => i),
    }))
    const t = resumoDoTodo(p, aps, ['Nicho'])
    expect(t.length).toBeLessThanOrEqual(RESUMO_MAX)
    expect(t).toContain('Medida de apoio 7-2')
  })

  it('pior caso acima do teto: as categorias caem primeiro e a frase diz; as contagens nunca somem', () => {
    const M = 5
    const cols = Array.from({ length: 30 }, (_, i) => `Coluna numérica comprida ${i}`)
    const p = tabela('canais', ['Canal', 'Nicho', ...cols], Array.from({ length: M }, (_, i): Celula[] => [terceiros(`C${i}`, `p${i}`), rotulo(`Nicho ${i}`, `n${i}`), ...cols.map((_, j) => medido('1', 1, `p${i}.${j}`))]))
    const t = resumoDoTodo(p, [], ['Nicho'])
    expect(t.length).toBeLessThanOrEqual(RESUMO_MAX)
    for (const c of cols) expect(t).toContain(`| ${c} |`)
  })

  it('categorias por tela', () => {
    expect(CATEGORIAS_NO_RESUMO.canais).toEqual([])
    expect(CATEGORIAS_NO_RESUMO.outliers).toEqual(['Nicho'])
    expect(CATEGORIAS_NO_RESUMO.mudancas).toEqual(['Tipo', 'Nicho'])
  })
})
