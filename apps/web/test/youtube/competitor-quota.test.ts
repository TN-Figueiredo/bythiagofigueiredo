// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { pacificDate, recordQuota } from '@/lib/youtube/competitor-quota'

describe('pacificDate (item 224: o dia da cota é o do Pacífico)', () => {
  it('03:30 de São Paulo ainda é o dia anterior no Pacífico, no verão e no inverno de lá', () => {
    expect(pacificDate(Date.parse('2026-06-10T06:30:00Z'))).toBe('2026-06-09') // 23:30 PDT
    expect(pacificDate(Date.parse('2026-01-10T06:30:00Z'))).toBe('2026-01-09') // 22:30 PST
  })
  it('vira o dia à meia-noite do Pacífico, não à de São Paulo nem à UTC', () => {
    expect(pacificDate(Date.parse('2026-06-10T06:59:59Z'))).toBe('2026-06-09')
    expect(pacificDate(Date.parse('2026-06-10T07:00:00Z'))).toBe('2026-06-10')
    expect(pacificDate(Date.parse('2026-01-10T07:59:59Z'))).toBe('2026-01-09')
    expect(pacificDate(Date.parse('2026-01-10T08:00:00Z'))).toBe('2026-01-10')
  })
  it('nas duas viradas do horário de verão de lá a meia-noite muda de hora UTC (08:00 no inverno, 07:00 no verão)', () => {
    // 2026: o verão começa em 8 de março (10:00Z) e termina em 1 de novembro (09:00Z)
    expect(pacificDate(Date.parse('2026-03-09T06:59:59Z'))).toBe('2026-03-08') // já em PDT: meia-noite é 07:00Z
    expect(pacificDate(Date.parse('2026-03-09T07:00:00Z'))).toBe('2026-03-09')
    expect(pacificDate(Date.parse('2026-03-08T07:59:59Z'))).toBe('2026-03-07') // ainda em PST: meia-noite é 08:00Z
    expect(pacificDate(Date.parse('2026-03-08T08:00:00Z'))).toBe('2026-03-08')
    expect(pacificDate(Date.parse('2026-11-02T07:59:59Z'))).toBe('2026-11-01') // de volta a PST: meia-noite é 08:00Z
    expect(pacificDate(Date.parse('2026-11-02T08:00:00Z'))).toBe('2026-11-02')
    expect(pacificDate(Date.parse('2026-11-01T06:59:59Z'))).toBe('2026-10-31') // ainda em PDT
    expect(pacificDate(Date.parse('2026-11-01T07:00:00Z'))).toBe('2026-11-01')
  })
})
describe('recordQuota', () => {
  const sbOf = (error: { message: string } | null) => { const calls: unknown[] = []; return { calls, sb: { rpc: (name: string, args: unknown) => { calls.push([name, args]); return Promise.resolve({ data: 1, error }) } } as never } }
  it('uma instrução só: a função SQL soma; o corpo leva o dia do Pacífico, as unidades e o total por modo', async () => {
    const { sb, calls } = sbOf(null)
    await recordQuota(sb, { siteId: 's', nowMs: Date.parse('2026-06-10T06:30:00Z'), units: 5, mode: 'competitors' })
    expect(calls).toEqual([['youtube_quota_add', { p_site_id: 's', p_day: '2026-06-09', p_units: 5, p_add: { competitors: 5 }, p_max: {} }]])
  })
  it('o corte do teto diário vai em p_max (o maior do dia, não a soma das quatro faixas)', async () => {
    const { sb, calls } = sbOf(null)
    await recordQuota(sb, { siteId: 's', nowMs: Date.parse('2026-06-10T15:00:00Z'), units: 4, mode: 'competitors', cut: 12 })
    expect((calls[0] as [string, { p_max: unknown }])[1].p_max).toEqual({ teto_diario_cortados: 12 })
  })
  it('zero unidades e nenhum corte: não chama o banco; erro do banco lança', async () => {
    const quiet = sbOf(null)
    await recordQuota(quiet.sb, { siteId: 's', nowMs: 0, units: 0, mode: 'competitors' })
    expect(quiet.calls).toEqual([])
    await expect(recordQuota(sbOf({ message: 'boom' }).sb, { siteId: 's', nowMs: 0, units: 1, mode: 'competitors' })).rejects.toThrow(/cota: boom/)
  })
  it('extra e max vão para p_add e p_max; chave com 0 não vai', async () => {
    const { sb, calls } = sbOf(null)
    await recordQuota(sb, { siteId: 's', nowMs: Date.parse('2026-06-10T15:00:00Z'), units: 3, mode: 'competitors', extra: { partes_ausentes: 2, erros_cota: 0 }, max: { semanais_adiados: 4, teto_diario_cortados: 0 } })
    expect((calls[0] as [string, Record<string, unknown>])[1]).toMatchObject({ p_units: 3, p_add: { competitors: 3, partes_ausentes: 2 }, p_max: { semanais_adiados: 4 } })
  })
  it('units 0 com extra ainda grava (soma 0 unidades)', async () => {
    const { sb, calls } = sbOf(null)
    await recordQuota(sb, { siteId: 's', nowMs: Date.parse('2026-06-10T15:00:00Z'), units: 0, mode: 'competitors', extra: { partes_ausentes: 1 } })
    expect((calls[0] as [string, Record<string, unknown>])[1]).toMatchObject({ p_units: 0, p_add: { partes_ausentes: 1 } })
  })
})
