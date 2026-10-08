// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { dayPt, ontemPt, addDays, diffDias, utcDay, boundsAnalytics, boundsReporting } from '@/lib/youtube/coleta/day-pt'

const H = 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()

afterEach(() => {
  vi.useRealTimers()
})

describe('dayPt', () => {
  it('usa o Pacífico com horário de verão: 06:59 UTC ainda é a véspera, 07:00 UTC já é o dia', () => {
    expect(dayPt(new Date('2026-10-31T06:59:59.000Z'))).toBe('2026-10-30')
    expect(dayPt(new Date('2026-10-31T07:00:00.000Z'))).toBe('2026-10-31')
  })

  it('no inverno a virada é às 08:00 UTC', () => {
    expect(dayPt(new Date('2026-12-10T07:59:59.000Z'))).toBe('2026-12-09')
    expect(dayPt(new Date('2026-12-10T08:00:00.000Z'))).toBe('2026-12-10')
  })

  it('01/11/2026 (fim do horário de verão): o dia começa às 07:00 UTC e só acaba às 08:00 UTC do dia 2', () => {
    expect(dayPt(new Date('2026-11-01T07:00:00.000Z'))).toBe('2026-11-01')
    expect(dayPt(new Date('2026-11-02T07:30:00.000Z'))).toBe('2026-11-01')
    expect(dayPt(new Date('2026-11-02T08:00:00.000Z'))).toBe('2026-11-02')
  })
})

describe('ontemPt com o relógio do cron (12:00 UTC)', () => {
  it.each([
    ['2026-11-01T12:00:00.000Z', '2026-10-31'],
    ['2026-11-02T12:00:00.000Z', '2026-11-01'],
    ['2026-11-03T12:00:00.000Z', '2026-11-02'],
    ['2026-03-09T12:00:00.000Z', '2026-03-08'],
    ['2026-01-01T12:00:00.000Z', '2025-12-31'],
  ])('agora = %s → ontem = %s', (agora, esperado) => {
    vi.useFakeTimers({ now: new Date(agora), toFake: ['Date'] })
    expect(ontemPt(new Date())).toBe(esperado)
  })
})

describe('boundsAnalytics (dia do Pacífico com horário de verão)', () => {
  it('31/10/2026: 24 horas, das 07:00 UTC às 07:00 UTC', () => {
    const b = boundsAnalytics('2026-10-31')
    expect(iso(b.start)).toBe('2026-10-31T07:00:00.000Z')
    expect(iso(b.end)).toBe('2026-11-01T07:00:00.000Z')
    expect((b.end - b.start) / H).toBe(24)
  })

  it('01/11/2026: 25 horas, das 07:00 UTC às 08:00 UTC do dia seguinte', () => {
    const b = boundsAnalytics('2026-11-01')
    expect(iso(b.start)).toBe('2026-11-01T07:00:00.000Z')
    expect(iso(b.end)).toBe('2026-11-02T08:00:00.000Z')
    expect((b.end - b.start) / H).toBe(25)
  })

  it('02/11/2026: 24 horas, das 08:00 UTC às 08:00 UTC', () => {
    const b = boundsAnalytics('2026-11-02')
    expect(iso(b.start)).toBe('2026-11-02T08:00:00.000Z')
    expect(iso(b.end)).toBe('2026-11-03T08:00:00.000Z')
    expect((b.end - b.start) / H).toBe(24)
  })

  it('08/03/2026: 23 horas, das 08:00 UTC às 07:00 UTC do dia seguinte', () => {
    const b = boundsAnalytics('2026-03-08')
    expect(iso(b.start)).toBe('2026-03-08T08:00:00.000Z')
    expect(iso(b.end)).toBe('2026-03-09T07:00:00.000Z')
    expect((b.end - b.start) / H).toBe(23)
  })

  it('todo instante dentro do intervalo pertence ao dia, e os vizinhos não', () => {
    for (const dia of ['2026-10-31', '2026-11-01', '2026-11-02', '2026-03-08']) {
      const b = boundsAnalytics(dia)
      expect(dayPt(new Date(b.start))).toBe(dia)
      expect(dayPt(new Date(b.end - 1))).toBe(dia)
      expect(dayPt(new Date(b.start - 1))).not.toBe(dia)
      expect(dayPt(new Date(b.end))).not.toBe(dia)
    }
  })
})

describe('boundsReporting (UTC-8 fixo)', () => {
  it.each(['2026-10-31', '2026-11-01', '2026-11-02', '2026-03-08', '2026-07-15'])('%s: sempre 24 horas a partir das 08:00 UTC', (dia) => {
    const b = boundsReporting(dia)
    expect(iso(b.start)).toBe(`${dia}T08:00:00.000Z`)
    expect((b.end - b.start) / H).toBe(24)
  })
})

describe('aritmética de dias', () => {
  it('addDays atravessa mês, ano e 29 de fevereiro', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('diffDias conta dias de calendário, sem se perder na troca de horário', () => {
    expect(diffDias('2026-10-31', '2026-11-03')).toBe(3)
    expect(diffDias('2026-03-07', '2026-03-09')).toBe(2)
    expect(diffDias('2026-11-03', '2026-11-03')).toBe(0)
  })

  it('utcDay é a data UTC, não a do Pacífico', () => {
    expect(utcDay(new Date('2026-10-07T03:00:00.000Z'))).toBe('2026-10-07')
    expect(dayPt(new Date('2026-10-07T03:00:00.000Z'))).toBe('2026-10-06')
  })
})
