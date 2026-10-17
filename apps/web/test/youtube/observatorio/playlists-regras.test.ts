// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { X3_RULES, FIM_ATE_MS } from '@/lib/youtube/observatorio/playlists/regras'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { BANCO_MS, LEVE_FIM_MS } from '@/lib/youtube/agenda/relogio'

describe('X3 regras: tempos amarrados (Phil I-3, Yannis I-1)', () => {
  it('a última chamada termina com folga para quatro idas ao banco (itensPresentes, items_record, visit_close, recordQuota) antes do fim da tarefa', () => {
    expect(X3_RULES.chamadaComecaAteMs + X3_RULES.chamadaMs + 4 * BANCO_MS + 2_000).toBeLessThanOrEqual(FIM_ATE_MS)
  })
  it('a fórmula dá 55 s e o canal novo começa antes da chamada (50 s)', () => {
    expect(X3_RULES.chamadaComecaAteMs).toBe(55_000)
    expect(X3_RULES.canalComecaAteMs).toBe(50_000)
    expect(X3_RULES.canalComecaAteMs).toBeLessThan(X3_RULES.chamadaComecaAteMs)
  })
  it('o fim da tarefa cabe no teto das leves', () => {
    expect(FIM_ATE_MS).toBeLessThanOrEqual(LEVE_FIM_MS)
  })
  it('os tetos de cota e a leitura única em RULES.x3', () => {
    expect(RULES.x3).toBe(X3_RULES)
    expect(X3_RULES).toMatchObject({ unidadesPorVisita: 40, paginasDeItensPorPlaylist: 10, unidadesPorDia: 600, diasEntreVoltas: 7, chamadaMs: 8_000 })
  })
})
