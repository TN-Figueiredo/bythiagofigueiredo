// @vitest-environment node
// A5 · E4, Tarefa 1: regras, tipos e a regra de contagem das medidas.
import { describe, expect, it } from 'vitest'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { FALTAS_DE_MARCA, MOTIVOS_NAO_MEDIDO, medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { countRuleOf, cruzaMudancaDeContagem } from '@/lib/youtube/observatorio/medidas/contagem'

const JANELA = { de: null, ate: null, dias: null }

describe('medidas: regras', () => {
  it('RULES.measures é o MEASURE_RULES, valor por valor', () => {
    expect(RULES.measures).toBe(MEASURE_RULES)
    expect(MEASURE_RULES).toEqual({
      ruleVersion: 1, ages: [1, 7, 30], maxGapHours: 36, maxGapHoursDay1: 8, weeklyGapHours: 192, lateReadingHours: 1, batch: 1500,
      discoveredLateHours: 24, equalPct: 0.10, channelWindowDays: 90,
      curve: { ages: [1, 2, 3, 5, 7, 14, 21, 30, 60, 90], windowDays: 180, weeklyFromAge: 60 },
      direction: { windowDays: 28, staleDays: 1 }, decline: { windows: 3 }, hit: { minAgeDays: 7, miss: 0.5, pctFromN: 10 },
      rise: { factor: 2, minGain: 1000, days: 7, lookbackDays: 14 }, rhythm: { weeks: 13, gapWeeks: 26, minPosts: 4 },
      engagement: { minViews: 100, todayMaxAgeDays: 90 }, stalled: { floorDays: 28, factor: 4 }, tail: { minAgeDays: 90, stillDays: 28 },
      peak: { minV30: 1000, tailShare: 0.5, stillMax: 0.02, reactionShare: 0.5 },
      comments: { minVideos: 5, pctFromN: 10, minVideoLikes: 100, windowDays: 90 },
      lost: { alarmAges: [7, 30], weeklyTier30Counts: true }, countChange: '2026-08-24',
    })
  })

  it('os seis códigos de falta, na ordem da tabela de 4.2', () => {
    expect([...FALTAS_DE_MARCA]).toEqual([
      'views_ocultas', 'sem_leitura', 'descoberto_tarde', 'leitura_comecou_depois', 'leitura_parou_antes', 'leituras_distantes',
    ])
  })

  it('a hora de folga do motivo é 1', () => {
    expect(MEASURE_RULES.lateReadingHours).toBe(1)
  })

  it('MEASURE_RULES não tem settleMinutes nem dailyGraceDays', () => {
    expect(Object.keys(MEASURE_RULES)).not.toContain('settleMinutes')
    expect(Object.keys(MEASURE_RULES)).not.toContain('dailyGraceDays')
    expect(RULES.series.dailyGraceDays).toBe(2)
  })

  it('o aviso de marca perdida vale para as idades 7 e 30, e a faixa semanal conta', () => {
    expect([...MEASURE_RULES.lost.alarmAges]).toEqual([7, 30])
    expect(MEASURE_RULES.lost.weeklyTier30Counts).toBe(true)
  })

  it('a lista de motivos tem 35 códigos, sem repetição, e inclui coleta_pausada', () => {
    expect(MOTIVOS_NAO_MEDIDO).toHaveLength(35)
    expect(new Set(MOTIVOS_NAO_MEDIDO).size).toBe(35)
    expect(MOTIVOS_NAO_MEDIDO).toContain('coleta_pausada')
    expect(MOTIVOS_NAO_MEDIDO).toContain('calculo_falhou')
  })
})

describe('medidas: construtores', () => {
  it('medido lança com NaN, Infinity e −Infinity, no topo e dentro do valor', () => {
    expect(() => medido(NaN, 1, JANELA)).toThrow()
    expect(() => medido(Infinity, 1, JANELA)).toThrow()
    expect(() => medido(-Infinity, 1, JANELA)).toThrow()
    expect(() => medido({ variacao: Infinity, direcao: 'subindo' }, 1, JANELA)).toThrow()
    expect(() => medido({ a: { b: [1, 2, NaN] } }, 1, JANELA)).toThrow()
    expect(() => medido(1, NaN, JANELA)).toThrow()
  })

  it('medido aceita valor finito e guarda n, janela e notas', () => {
    const m = medido({ x: 1.5 }, 3, JANELA, [{ tipo: 'so_curtidas' }])
    expect(m).toEqual({ estado: 'medido', valor: { x: 1.5 }, n: 3, janela: JANELA, notas: [{ tipo: 'so_curtidas' }] })
    expect(medido(0, 0, JANELA).notas).toEqual([])
  })

  it('naoMedido nunca tem valor', () => {
    const m = naoMedido('base_zero')
    expect(m).toEqual({ estado: 'nao_medido', motivo: 'base_zero', notas: [] })
    expect('valor' in m).toBe(false)
    expect(naoMedido('poucos_videos', { n: 2, minimo: 3 })).toMatchObject({ n: 2, minimo: 3 })
  })
})

describe('medidas: regra de contagem', () => {
  it('a regra de contagem: 23/08 é a antiga, 24/08 é a nova', () => {
    expect(countRuleOf('2026-08-23')).toBe('ate_2026-08-23')
    expect(countRuleOf('2026-08-24')).toBe('desde_2026-08-24')
  })

  // (revisão Yannis 14/10, M-1) dia que não existe no calendário lança, não vira outro dia
  it('dia inexistente no calendário lança dia_malformado', () => {
    expect(() => countRuleOf('2026-02-31')).toThrow('dia_malformado')
    expect(() => countRuleOf('2026-13-01')).toThrow('dia_malformado')
    expect(() => cruzaMudancaDeContagem('2026-08-24', '2026-09-31')).toThrow('dia_malformado')
    expect(countRuleOf('2024-02-29')).toBe('ate_2026-08-23')
  })

  it('a janela cruza a mudança só quando começa antes e termina no dia ou depois', () => {
    expect(cruzaMudancaDeContagem('2026-08-22', '2026-08-23')).toBe(false)
    expect(cruzaMudancaDeContagem('2026-08-23', '2026-08-24')).toBe(true)
    expect(cruzaMudancaDeContagem('2026-08-24', '2026-09-30')).toBe(false)
    expect(cruzaMudancaDeContagem('2026-08-24', '2026-08-24')).toBe(false)
  })

  it('data malformada lança', () => {
    expect(() => countRuleOf('24/08/2026')).toThrow()
    expect(() => countRuleOf('')).toThrow()
    expect(() => cruzaMudancaDeContagem('', '2026-08-24')).toThrow()
  })
})
