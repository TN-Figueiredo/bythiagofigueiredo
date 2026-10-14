// @vitest-environment node
// apps/web/test/youtube/observatorio/medidas-telas-calendario.test.ts
// E5a Tarefa 1: o calendário das medidas. Nenhum número de dias é escrito no módulo: saem das regras da E4.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const deploy = vi.hoisted(() => ({ valor: '2026-10-13' as string | null }))
vi.mock('@/lib/conferencias', () => ({ get E1_E2_DEPLOY() { return deploy.valor } }))

import {
  INICIO_DAS_MARCAS, somaDias, quedaExisteEm, mesmaIdadeExisteEm, estourouExisteEm, primeiras24hDesde, fraseDasPrimeiras24h, avisoDeContagem, aindaNaoExiste,
  type RegrasDoCalendario,
} from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'

describe('calendário das medidas (E5a T1)', () => {
  it('a queda existe 112 dias depois da mudança de contagem', () => {
    expect(quedaExisteEm()).toBe('2026-12-14')
    expect(quedaExisteEm()).toBe(somaDias(MEASURE_RULES.countChange, 28 * 4))
  })
  it('a mesma idade existe 180 dias depois do início das marcas; a leitura estourou, 90', () => {
    expect(mesmaIdadeExisteEm()).toBe('2027-04-01')
    expect(estourouExisteEm()).toBe('2027-01-01')
  })
  it('os dias do calendário saem das regras da E4', () => {
    const regras: RegrasDoCalendario = { ...MEASURE_RULES, decline: { windows: 4 }, tail: { ...MEASURE_RULES.tail, minAgeDays: 120 } }
    expect(quedaExisteEm(regras)).toBe(somaDias(MEASURE_RULES.countChange, 28 * 5))
    expect(estourouExisteEm(regras)).toBe(somaDias(INICIO_DAS_MARCAS, 120))
    const fonte = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/medidas-telas/calendario.ts'), 'utf8')
    expect(fonte).not.toMatch(/\b(112|90|180)\b/)
  })
  it('somaDias atravessa mês e ano', () => {
    expect(somaDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somaDias('2027-03-01', -1)).toBe('2027-02-28')
  })
  it('ainda não existe na véspera e existe no dia', () => {
    for (const [leitura, dia] of [['queda', quedaExisteEm()], ['mesma_idade', mesmaIdadeExisteEm()], ['estourou', estourouExisteEm()]] as const) {
      expect(aindaNaoExiste(leitura, somaDias(dia, -1))).toEqual({ existeEm: dia })
      expect(aindaNaoExiste(leitura, dia)).toBeNull()
    }
  })
  it('o aviso de contagem dura até o último dia em que a janela cruza', () => {
    expect(avisoDeContagem({ de: '2026-08-23', ate: '2026-10-18', dias: 56 })).toEqual({ ate: '2026-10-18' })
    expect(avisoDeContagem({ de: '2026-08-24', ate: '2026-10-19', dias: 56 })).toBeNull()
    expect(avisoDeContagem({ de: null, ate: null, dias: null })).toBeNull()
  })
  it('primeiras 24 horas: sem a constante de envio não há data', () => {
    expect(primeiras24hDesde()).toBe('2026-10-13')
    deploy.valor = null
    try {
      expect(primeiras24hDesde()).toBeNull()
      expect(fraseDasPrimeiras24h()).toMatch(/ainda sem data/)
    } finally { deploy.valor = '2026-10-13' }
    expect(fraseDasPrimeiras24h()).toContain('13/10/2026')
  })
})
