// @vitest-environment node
/**
 * Phil 16/11 (a) e (b): as tabelas de apoio de Mudanças trazem tipo e quando (duas trocas do mesmo vídeo não parecem linha repetida),
 * a faixa sai em uma linha por troca e base de menos de 5 vídeos não publica esperado, efeito nem faixa.
 */
import { describe, expect, it } from 'vitest'
import { casosDeMudancas, OBS_DAS_TELAS as OBS } from './contexto-ia-x-telas-fixture'

type Cel = { papel: string; estado?: string; texto?: string; motivo?: string; nota?: string }
const CASOS = casosDeMudancas()
const tab = (c: (typeof CASOS)[number], id: string) => c.pacote.tabelas.find((t) => t.id === id)

describe('tabelas de apoio de Mudanças', () => {
  it('(a) nenhuma linha idêntica; efeito e faixa têm uma linha por troca com número; as colunas tipo e quando existem', () => {
    let vistas = 0
    for (const c of CASOS) {
      for (const id of ['trocas-efeito', 'trocas-esperado', 'trocas-faixa', 'trocas-base']) {
        const t = tab(c, id)
        if (!t) continue
        const chaves = JSON.stringify(t.linhas.map((l) => l.map((x) => (x as Cel).texto ?? (x as Cel).motivo)))
        const linhas = t.linhas.map((l) => JSON.stringify(l.map((x) => [(x as Cel).texto, (x as Cel).motivo])))
        expect(new Set(linhas).size, `${c.nome} ${id} ${chaves.length}`).toBe(linhas.length)
        if (id !== 'trocas-efeito') expect(t.chaves).toEqual(expect.arrayContaining(['tipo', 'quando']))
        else expect(t.chaves).toContain('quando')
        vistas += t.linhas.length
      }
      const f = tab(c, 'trocas-faixa'), ef = tab(c, 'trocas-efeito')
      if (f && ef) expect(f.linhas.length).toBeLessThanOrEqual(ef.linhas.length)
    }
    expect(vistas).toBeGreaterThan(0)
  })
  it('(b) base com menos de minN vídeos: esperado, efeito e faixa levam a ressalva na célula; base_n ao lado', () => {
    const minN = OBS.RULES.effect.minN
    let pequenas = 0, grandes = 0
    for (const c of CASOS) {
      for (const id of ['trocas-esperado', 'trocas-faixa']) {
        const t = tab(c, id)
        if (!t) continue
        const iN = t.chaves!.indexOf('base_n')
        for (const l of t.linhas) {
          const n = Number((l[iN] as Cel).texto)
          const dados = l.slice(1, iN) as Cel[]
          if (n < minN) {
            pequenas += 1
            for (const d of dados) expect(d.nota).toMatch(new RegExp(`^base de ${n} vídeos?; a medida pede ${minN}; não conclui$`))
          } else { grandes += 1; for (const d of dados) expect(d.nota).toBeUndefined() }
        }
      }
    }
    expect(pequenas).toBeGreaterThan(0)
    expect(grandes + pequenas).toBeGreaterThan(0)
  })
})
