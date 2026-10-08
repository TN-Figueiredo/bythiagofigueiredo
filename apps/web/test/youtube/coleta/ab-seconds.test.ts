// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calcularAbDoDia, type AbCycle, type AbTest } from '@/lib/youtube/coleta/ab-seconds'
import { boundsAnalytics } from '@/lib/youtube/coleta/day-pt'

// Dia de verão: no Pacífico vai de 2026-07-15T07:00Z a 2026-07-16T07:00Z; em UTC-8 fixo, das 08:00Z às 08:00Z.
const D = '2026-07-15'
const CAPTURA = Date.parse('2026-07-16T12:00:00.000Z')

const teste = (extra: Partial<AbTest> = {}): AbTest => ({
  id: 't1', status: 'active', paused_at: null, completed_at: null, original_title: 'Título original', ...extra,
})
const ciclo = (id: string, variant: string, started: string, ended: string | null, extra: Partial<AbCycle> = {}): AbCycle => ({
  id, test_id: 't1', variant_id: variant, started_at: started, ended_at: ended, applied_metadata: null, ...extra,
})
const calc = (o: Partial<Parameters<typeof calcularAbDoDia>[0]>) =>
  calcularAbDoDia({ day: D, tests: [teste()], cycles: [], capturedAt: CAPTURA, titleAtCapture: 'Título na captura', ...o })

describe('sem ciclo de teste no dia', () => {
  it('copia a captura e deixa tudo de A/B nulo', () => {
    expect(calc({ tests: [] })).toEqual({
      ab_test_id: null, ab_variant_id: null,
      seconds_on_air_analytics: null, seconds_other_analytics: null,
      seconds_on_air_reporting: null, seconds_other_reporting: null,
      title: 'Título na captura', thumbCopiaCaptura: true, motivoNulo: null,
    })
  })

  it('ciclo aberto de teste pausado antes do dia não conta', () => {
    const r = calc({
      tests: [teste({ status: 'paused', paused_at: '2026-07-10T00:00:00.000Z' })],
      cycles: [ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', null)],
    })
    expect(r.ab_test_id).toBeNull()
    expect(r.title).toBe('Título na captura')
  })

  it('ciclo aberto de teste não ativo sem paused_at nem completed_at termina em started_at', () => {
    const r = calc({
      tests: [teste({ status: 'paused' })],
      cycles: [ciclo('c1', 'vA', '2026-07-15T10:00:00.000Z', null)],
    })
    expect(r.ab_test_id).toBeNull()
  })
})

describe('os dois fusos', () => {
  it('rotação às 08:00 UTC num dia de horário de verão: other_analytics = 3600 e other_reporting = 0', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T08:00:00.000Z', '2026-07-15T08:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-15T08:00:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({
      ab_test_id: 't1', ab_variant_id: 'vB',
      seconds_on_air_analytics: 82_800, seconds_other_analytics: 3_600,
      seconds_on_air_reporting: 86_400, seconds_other_reporting: 0,
      motivoNulo: null,
    })
  })

  it('ciclo que só toca o dia em UTC-8 fixo: ab_test_id preenchido, variante nula', () => {
    const r = calc({ cycles: [ciclo('c1', 'vA', '2026-07-16T07:30:00.000Z', null)] })
    expect(r).toMatchObject({
      ab_test_id: 't1', ab_variant_id: null, title: null,
      seconds_on_air_analytics: 0, seconds_on_air_reporting: 1_800, motivoNulo: 'fora_de_ciclo',
    })
  })
})

describe('dias de 23, 24 e 25 horas, com teste no ar o dia inteiro', () => {
  it.each([
    ['2026-10-31', 86_400],
    ['2026-11-01', 90_000],
    ['2026-11-02', 86_400],
    ['2026-03-08', 82_800],
  ])('%s grava a variante certa com %i segundos no cálculo do Pacífico', (dia, segundos) => {
    const r = calc({
      day: dia,
      capturedAt: boundsAnalytics(dia).end + 5 * 3_600_000,
      cycles: [ciclo('c1', 'vA', '2026-01-01T00:00:00.000Z', null)],
    })
    expect(r).toMatchObject({
      ab_test_id: 't1', ab_variant_id: 'vA', title: 'Título original', thumbCopiaCaptura: true,
      seconds_on_air_analytics: segundos, seconds_other_analytics: 0,
      seconds_on_air_reporting: 86_400, seconds_other_reporting: 0,
      motivoNulo: null,
    })
  })
})

describe('regras de nulo', () => {
  it('pausar e retomar no mesmo dia (a pausa não fecha o ciclo e a retomada abre outro): variante, título e thumbnail nulos', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-13T00:00:00.000Z', null),
        ciclo('c2', 'vB', '2026-07-15T15:00:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, title: null, thumbCopiaCaptura: false, motivoNulo: 'ciclo_aberto_duplicado' })
  })

  it('dois ciclos abertos do mesmo teste, mesmo que da mesma variante: nulo', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-13T00:00:00.000Z', null),
        ciclo('c2', 'vA', '2026-07-14T00:00:00.000Z', null),
      ],
    })
    expect(r.motivoNulo).toBe('ciclo_aberto_duplicado')
    expect(r.ab_variant_id).toBeNull()
  })

  it('pausa manual que fechou o ciclo, com buraco de 10 minutos: a variante de mais tempo vale', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-15T13:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-15T13:10:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({
      ab_variant_id: 'vB', motivoNulo: null,
      seconds_on_air_analytics: 64_200, seconds_other_analytics: 21_600,
      seconds_on_air_reporting: 67_800, seconds_other_reporting: 18_000,
    })
  })

  it('teste pausado no meio do dia: o ciclo aberto termina em paused_at, e o tempo fora de ciclo vence', () => {
    const r = calc({
      tests: [teste({ status: 'paused', paused_at: '2026-07-15T13:00:00.000Z' })],
      cycles: [ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', null)],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, seconds_on_air_analytics: 21_600, motivoNulo: 'fora_de_ciclo' })
  })

  it('teste concluído no dia: o ciclo aberto termina em completed_at', () => {
    const r = calc({
      tests: [teste({ status: 'completed', completed_at: '2026-07-16T06:00:00.000Z', paused_at: '2026-07-01T00:00:00.000Z' })],
      cycles: [ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', null)],
    })
    expect(r).toMatchObject({ ab_variant_id: 'vA', seconds_on_air_analytics: 82_800, motivoNulo: null, thumbCopiaCaptura: false })
  })

  it('teste iniciado às 23:00 do Pacífico: campos de variante nulos, ab_test_id preenchido', () => {
    const r = calc({ cycles: [ciclo('c1', 'vA', '2026-07-16T06:00:00.000Z', null)] })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, title: null, seconds_on_air_analytics: 3_600, motivoNulo: 'fora_de_ciclo' })
  })

  it('ciclos de mais de um teste no dia: nulo, e ab_test_id é o de mais segundos', () => {
    const r = calc({
      tests: [teste({ id: 't1', status: 'completed', completed_at: '2026-07-15T20:00:00.000Z' }), teste({ id: 't2' })],
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-15T20:00:00.000Z'),
        { ...ciclo('c2', 'vX', '2026-07-15T20:00:00.000Z', null), test_id: 't2' },
      ],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, title: null, motivoNulo: 'mais_de_um_teste' })
  })

  it('soma dos ciclos acima da duração real do dia: nulo', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-17T00:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-14T00:00:00.000Z', '2026-07-17T00:00:00.000Z'),
      ],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, motivoNulo: 'soma_acima_do_dia' })
  })

  it('sobreposição de 2 segundos entre fechar e abrir (ordem de gravação) é tolerada', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-15T19:00:02.000Z'),
        ciclo('c2', 'vB', '2026-07-15T19:00:00.000Z', null),
      ],
    })
    expect(r.motivoNulo).toBeNull()
    expect(r.ab_variant_id).toBe('vA')
  })
})

describe('título e thumbnail do dia', () => {
  const umCiclo = (meta: AbCycle['applied_metadata']) => [ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', null, { applied_metadata: meta })]

  it('title_set do ciclo vence', () => {
    expect(calc({ cycles: umCiclo({ title_set: 'Título da variante' }) }).title).toBe('Título da variante')
  })

  it('teste só de thumbnail, applied_metadata nulo: title é o original e ab_variant_id fica preenchido', () => {
    const r = calc({ cycles: umCiclo(null) })
    expect(r.title).toBe('Título original')
    expect(r.ab_variant_id).toBe('vA')
  })

  it('title_set vazio ou nulo cai no original; sem original, cai na captura', () => {
    expect(calc({ cycles: umCiclo({ title_set: '' }) }).title).toBe('Título original')
    expect(calc({ cycles: umCiclo({ title_set: null }), tests: [teste({ original_title: null })] }).title).toBe('Título na captura')
  })

  it('thumbnail copia a captura quando a variante no ar na captura é a do dia', () => {
    expect(calc({ cycles: umCiclo(null) }).thumbCopiaCaptura).toBe(true)
  })

  it('rotação entre o fim do dia e a captura: a thumbnail do dia NÃO copia a captura', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', '2026-07-16T09:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-16T09:00:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({ ab_variant_id: 'vA', title: 'Título original', thumbCopiaCaptura: false, motivoNulo: null })
  })
})

describe('dado ilegível nunca vira "sem A/B"', () => {
  const esperado = (id: string, motivoNulo: string) =>
    expect.objectContaining({ ab_test_id: id, ab_variant_id: null, title: null, thumbCopiaCaptura: false, motivoNulo })
  const outro = (extra: Partial<AbCycle>): AbCycle => ({ ...ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', null), test_id: 'tX', ...extra })

  it('ciclo aberto de teste ausente', () => {
    expect(calc({ cycles: [outro({})] })).toEqual(esperado('tX', 'teste_ausente'))
  })
  it('ciclo fechado de teste ausente que toca o dia', () => {
    expect(calc({ cycles: [outro({ ended_at: '2026-07-15T12:00:00.000Z' })] })).toEqual(esperado('tX', 'teste_ausente'))
  })
  it('started_at ilegível', () => {
    expect(calc({ cycles: [ciclo('c1', 'vA', 'não é data', null)] })).toEqual(esperado('t1', 'data_invalida'))
  })
  it('ended_at ilegível', () => {
    expect(calc({ cycles: [ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', 'x')] })).toEqual(esperado('t1', 'data_invalida'))
  })
})

describe('ciclo aberto com outro posterior', () => {
  it('c1 aberto desde antes do dia e c2 FECHADO que começou no dia', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', null),
        ciclo('c2', 'vB', '2026-07-15T10:00:00.000Z', '2026-07-15T12:00:00.000Z'),
      ],
    })
    expect(r).toMatchObject({ ab_variant_id: null, motivoNulo: 'ciclo_aberto_duplicado' })
  })
  it('c1 aberto e c2 que começa depois do dia', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', null),
        ciclo('c2', 'vB', '2026-07-16T09:00:00.000Z', '2026-07-16T10:00:00.000Z'),
      ],
    })
    expect(r).toMatchObject({ ab_variant_id: null, motivoNulo: 'ciclo_aberto_duplicado' })
  })
})
