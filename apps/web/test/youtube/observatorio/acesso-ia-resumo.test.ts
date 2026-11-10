// @vitest-environment node
/**
 * A7c1 T10: o resumo do todo por contagens. Calculado sobre TODAS as linhas da principal e das tabelas coluna, antes da janela.
 * Os estados são disjuntos e somam M em toda coluna; "não medido", "falhou" e "restrito" nunca viram zero.
 */
import { describe, expect, it } from 'vitest'
import { CATEGORIAS_NO_RESUMO, RESUMO_MAX, resumoDoTodo, resumoPassou } from '@/lib/youtube/observatorio/acesso-ia/resumo'
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

  it('tabela coluna sem nenhuma linha (Mudanças com trocas, nenhuma observada): UMA linha com o título e Sem linha = M, sem listar colunas (nem as de texto)', () => {
    const vazia = tabela('canais-views-por-dia', ['Canal', 'Veredito', 'Antes', 'Depois'], [])
    const t = resumoDoTodo(mil(), [{ tabela: vazia, donos: [] }], [])
    expect(linhaDe(t, 'canais-views-por-dia (sem nenhuma linha)')).toEqual(['0', '0', '0', '0', '0', '1000'])
    for (const col of ['Veredito', 'Antes', 'Depois', 'Canal']) expect(t).not.toContain(`| ${col} |`)
    expect(t.split('\n').length).toBe(5)
  })

  it('tabela com linhas, mas nenhuma com dona (ou só a repetida tem número): a coluna aparece com Sem linha = M', () => {
    const principal = tabela('canais', ['Canal', 'A'], [[terceiros('X', 'a'), medido('1', 1, 'a1')], [terceiros('Y', 'b'), medido('1', 1, 'b1')]])
    const semDona = tabela('canais-estado', ['Canal', 'B'], [[terceiros('Z', 'c'), medido('1', 1, 'c1')], [terceiros('W', 'd'), medido('1', 1, 'd1')]])
    expect(linhaDe(resumoDoTodo(principal, [{ tabela: semDona, donos: [-1, -1] }], []), 'B')).toEqual(['0', '0', '0', '0', '0', '2'])
    const sobrando = tabela('canais-estado', ['Canal', 'B'], [[terceiros('X', 'c'), naoMedido('m', 'c1')], [terceiros('X', 'd'), medido('1', 1, 'd1')]])
    // a 2ª linha (repetida) é descartada; a coluna aparece pelo conjunto todo e conta só a linha usada
    expect(linhaDe(resumoDoTodo(principal, [{ tabela: sobrando, donos: [0, 0] }], []), 'B')).toEqual(['0', '0', '1', '0', '0', '1'])
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

  const cols = (n: number): string[] => Array.from({ length: n }, (_, i) => `Coluna numérica comprida ${i}`)
  const comNichos = (nCols: number, M: number, nichos: number): Tabela => {
    const c = cols(nCols)
    return tabela('canais', ['Canal', 'Nicho', ...c], Array.from({ length: M }, (_, i): Celula[] => [terceiros(`C${i}`, `p${i}`), rotulo(`Nicho de nome bem comprido número ${String(i % nichos).padStart(2, '0')}`, `n${i}`), ...c.map((_, j) => medido('1', 1, `p${i}.${j}`))]))
  }

  it('pior caso acima do teto de verdade: 8 valores não cabem, 3 cabem; "mais N valores" com 3 itens antes dele', () => {
    // acha o número de colunas em que 8 valores passam do teto e 3 cabem
    let achou = false
    for (let n = 10; n < 40 && !achou; n += 1) {
      const t = resumoDoTodo(comNichos(n, 40, 20), [], ['Nicho'])
      const sem = resumoDoTodo(comNichos(n, 40, 20), [], [])
      const l = t.split('\n').find((x) => x.startsWith('Por Nicho:'))
      if (l && l.split(';').length === 4) {
        expect(sem.length).toBeLessThan(RESUMO_MAX)
        expect(l).toMatch(/mais 17 valores$/)
        expect(t.length).toBeLessThanOrEqual(RESUMO_MAX)
        expect(t).not.toContain('As contagens por categoria não couberam no resumo.')
        achou = true
      }
    }
    expect(achou).toBe(true)
  })

  it('degrau 0: as contagens sozinhas cabem mas nem 3 valores cabem: a linha "Por Nicho" sai e a frase diz', () => {
    let achou = false
    for (let n = 10; n < 40 && !achou; n += 1) {
      const t = resumoDoTodo(comNichos(n, 40, 20), [], ['Nicho'])
      const sem = resumoDoTodo(comNichos(n, 40, 20), [], [])
      if (!t.includes('Por Nicho:') && sem.length <= RESUMO_MAX) {
        expect(t).toContain('As contagens por categoria não couberam no resumo.')
        expect(t.length).toBeLessThanOrEqual(RESUMO_MAX)
        achou = true
      }
    }
    expect(achou).toBe(true)
  })

  it('sem categoria que não coube não há frase (8 valores cabem: nada a dizer)', () => {
    const t = resumoDoTodo(comNichos(3, 12, 12), [], ['Nicho'])
    expect(t).toContain('Por Nicho:')
    expect(t).not.toContain('não couberam')
  })

  it('42 colunas × 12 linhas: só as contagens passam do teto; o resumo sai inteiro (nunca corte calado), sem categorias, com a frase, e resumoPassou diz', () => {
    const t = resumoDoTodo(comNichos(42, 12, 12), [], ['Nicho'])
    expect(t.length).toBeGreaterThan(RESUMO_MAX)
    expect(resumoPassou(t)).toBe(true)
    for (const c of cols(42)) expect(t).toContain(`| ${c} |`)
    expect(t).toContain('As contagens por categoria não couberam no resumo.')
    expect(t).not.toContain('Por Nicho:')
    expect(resumoPassou(resumoDoTodo(comNichos(3, 12, 12), [], ['Nicho']))).toBe(false)
  })

  it('categoria com "|" ou ";" sai sem barra invertida; emoji não é partido ao meio', () => {
    const emojis = '😀'.repeat(60)
    const linhas = [['a|b;c', 1], [emojis, 2]].flatMap(([v, n]) => Array.from({ length: n as number }, (_, i): Celula[] => [terceiros(`V${v}${i}`, `v${v}${i}`), rotulo(v as string, `n${v}${i}`), medido('1', 1, `m${v}${i}`)]))
    const t = resumoDoTodo(tabela('outliers', ['Vídeo', 'Nicho', 'Views'], linhas), [], ['Nicho'])
    const l = t.split('\n').find((x) => x.startsWith('Por Nicho:'))!
    expect(l).not.toContain('\\')
    expect(l).toContain('a,b,c 1')
    expect(l).toContain(`${'😀'.repeat(39)}… 2`)
    expect(l).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
  })

  it('categorias por tela', () => {
    expect(CATEGORIAS_NO_RESUMO.canais).toEqual([])
    expect(CATEGORIAS_NO_RESUMO.outliers).toEqual(['Nicho'])
    expect(CATEGORIAS_NO_RESUMO.mudancas).toEqual(['Tipo', 'Nicho'])
  })
})
