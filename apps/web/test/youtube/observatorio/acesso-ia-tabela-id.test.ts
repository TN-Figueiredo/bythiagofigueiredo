// @vitest-environment node
/**
 * A5 F1b T7 (D6, pedido da A7): a coluna `Id` entra nas tabelas principais de Destaques (`outliers`) e Mudanças (`trocas`), com o id do vídeo.
 * M3 (Yannis, F0.5a-T2/T3): o `views_dia_7d` do cartão com menos de 7 dias de série é a média desde a publicação; a nota viaja na célula (`nota`) e o CSV a leva.
 */
import { describe, expect, it } from 'vitest'
import { casosDeMudancas, casosDeOutliers } from './contexto-ia-x-telas-fixture'

describe('coluna Id', () => {
  it('outliers: coluna e chave `id` pareadas, e a célula é o id do cartão', () => {
    for (const caso of casosDeOutliers()) {
      const t = caso.pacote.tabelas.find((x) => x.id === 'outliers')
      if (!t) continue
      const i = t.colunas.indexOf('Id')
      expect(i, caso.nome).toBeGreaterThanOrEqual(0)
      expect(t.chaves![i]).toBe('id')
      const ids = caso.modelo.groups.flatMap((g) => g.cards.map((c) => c.id))
      expect(t.linhas.map((l) => (l[i] as { texto: string }).texto)).toEqual(ids)
    }
  })
  it('trocas: coluna e chave `id` pareadas, e a célula é o id do vídeo da troca', () => {
    for (const caso of casosDeMudancas()) {
      const t = caso.pacote.tabelas.find((x) => x.id === 'trocas')
      if (!t) continue
      const i = t.colunas.indexOf('Id')
      expect(i, caso.nome).toBeGreaterThanOrEqual(0)
      expect(t.chaves![i]).toBe('id')
      expect(t.linhas.map((l) => (l[i] as { texto: string }).texto)).toEqual(caso.modelo.heroes.map((h) => h.video.id))
    }
  })
  it('a fixture padrão tem as duas tabelas (o teste não passa vazio)', () => {
    expect(casosDeOutliers().some((c) => c.pacote.tabelas.some((t) => t.id === 'outliers'))).toBe(true)
    expect(casosDeMudancas().some((c) => c.pacote.tabelas.some((t) => t.id === 'trocas'))).toBe(true)
  })
})

describe('M3: views_dia_7d de vídeo com menos de 7 dias de série', () => {
  it('o cartão com vpdShortNote leva a nota na célula; o sem nota não leva', () => {
    let com = 0
    for (const caso of casosDeOutliers()) {
      const t = caso.pacote.tabelas.find((x) => x.id === 'outliers')
      if (!t) continue
      const col = t.chaves!.indexOf('views_dia_7d')
      const cards = caso.modelo.groups.flatMap((g) => g.cards)
      t.linhas.forEach((l, n) => {
        const c = l[col] as { nota?: string }
        const esperado = cards[n]!.vpdShortNote
        if (esperado !== null) { com += 1; expect(c.nota, `${caso.nome} linha ${n + 1}`).toBe(esperado) } else expect(c.nota).toBeUndefined()
      })
    }
    expect(com, 'a fixture precisa ter ao menos um cartão com a nota').toBeGreaterThan(0)
  })
})
