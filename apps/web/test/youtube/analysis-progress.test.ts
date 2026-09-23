// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  describeProgress,
  nextTick,
  failureReason,
  formatDuration,
  formatClock,
  isActive,
  type AnalysisTaskSnapshot,
} from '@/lib/youtube/analysis-progress'

// Dates are absolute ISO instants on purpose: the module only does arithmetic between the
// row's timestamps and `now`, both passed in — nothing here reads the wall clock.
const base: AnalysisTaskSnapshot = {
  id: 't1',
  status: 'pending',
  requestedAt: '2026-09-23T10:34:12Z',
  startedAt: null,
  completedAt: null,
  failedAt: null,
  updatedAt: '2026-09-23T10:34:12Z',
  retryCount: 0,
  errorMessage: null,
}
const at = (iso: string) => new Date(iso)

describe('nextTick', () => {
  it('is the next 10-minute boundary, strictly after', () => {
    expect(nextTick(at('2026-09-23T10:34:12Z')).toISOString()).toBe('2026-09-23T10:40:00.000Z')
    expect(nextTick(at('2026-09-23T10:40:00Z')).toISOString()).toBe('2026-09-23T10:50:00.000Z')
    expect(nextTick(at('2026-09-23T23:59:59Z')).toISOString()).toBe('2026-09-24T00:00:00.000Z')
  })
})

describe('describeProgress', () => {
  it('null without a task', () => {
    expect(describeProgress(null, at('2026-09-23T10:35:00Z'))).toBeNull()
  })

  it('queued: pickup is the first tick after the request, done ~30 s later', () => {
    const v = describeProgress(base, at('2026-09-23T10:35:00Z'))
    expect(v).toMatchObject({ kind: 'queued', attempt: 1 })
    if (v?.kind !== 'queued') throw new Error('kind')
    expect(v.pickupAt.toISOString()).toBe('2026-09-23T10:40:00.000Z')
    expect(v.expectedDoneAt.toISOString()).toBe('2026-09-23T10:40:30.000Z')
  })

  it('queued: a missed tick moves the pickup to the next one instead of counting negative', () => {
    const v = describeProgress(base, at('2026-09-23T10:42:00Z'))
    if (v?.kind !== 'queued') throw new Error(`kind ${v?.kind}`)
    expect(v.pickupAt.toISOString()).toBe('2026-09-23T10:50:00.000Z')
  })

  it('queued: inside the 90 s grace after the tick it still points at that tick', () => {
    const v = describeProgress(base, at('2026-09-23T10:41:00Z'))
    if (v?.kind !== 'queued') throw new Error(`kind ${v?.kind}`)
    expect(v.pickupAt.toISOString()).toBe('2026-09-23T10:40:00.000Z')
  })

  it('late: 25 min in the queue on the first attempt', () => {
    const v = describeProgress(base, at('2026-09-23T10:59:30Z'))
    expect(v?.kind).toBe('late')
    if (v?.kind !== 'late') throw new Error('kind')
    expect(v.expectedAt.toISOString()).toBe('2026-09-23T10:40:00.000Z')
    expect(v.lateByMs).toBe(19.5 * 60_000)
  })

  it('late is judged at the boundary: 24:59 is still queued', () => {
    expect(describeProgress(base, at('2026-09-23T10:59:11Z'))?.kind).toBe('queued')
  })

  it('retry: a requeued task is attempt 2 of 3 and never "late" by its old requested_at', () => {
    const v = describeProgress({ ...base, retryCount: 1 }, at('2026-09-23T11:02:00Z'))
    expect(v).toMatchObject({ kind: 'queued', attempt: 2 })
    if (v?.kind !== 'queued') throw new Error('kind')
    expect(v.pickupAt.toISOString()).toBe('2026-09-23T11:10:00.000Z')
  })

  it('unserved: a day in the queue (the EN channel since May)', () => {
    const v = describeProgress({ ...base, requestedAt: '2026-05-06T20:40:51Z' }, at('2026-09-23T10:35:00Z'))
    expect(v?.kind).toBe('unserved')
    if (v?.kind !== 'unserved') throw new Error('kind')
    expect(formatDuration(v.queuedForMs)).toBe('139 dias')
  })

  it('running: elapsed from started_at', () => {
    const v = describeProgress(
      { ...base, status: 'running', startedAt: '2026-09-23T10:40:03Z' },
      at('2026-09-23T10:40:21Z'),
    )
    expect(v).toMatchObject({ kind: 'running', elapsedMs: 18_000 })
  })

  it('done only when the caller watched it happen', () => {
    const t = { ...base, status: 'completed' as const, startedAt: '2026-09-23T10:40:03Z', completedAt: '2026-09-23T10:40:16Z' }
    expect(describeProgress(t, at('2026-09-23T10:41:00Z'))).toBeNull()
    expect(describeProgress(t, at('2026-09-23T10:41:00Z'), true)).toMatchObject({ kind: 'done', totalMs: 364_000 })
  })

  it('failed: shown for 24 h on page load, with the reason in words', () => {
    const t = {
      ...base, status: 'failed' as const, startedAt: '2026-09-23T11:00:03Z',
      failedAt: '2026-09-23T11:09:40Z', updatedAt: '2026-09-23T11:09:40Z', retryCount: 2, errorMessage: 'llama',
    }
    expect(describeProgress(t, at('2026-09-23T12:00:00Z'))).toMatchObject({
      kind: 'failed', reason: 'o modelo local não respondeu', code: 'llama',
    })
    expect(describeProgress(t, at('2026-09-24T11:10:00Z'))).toBeNull()
  })

  it('stale: the watchdog released it', () => {
    const t = { ...base, status: 'stale' as const, startedAt: '2026-09-23T10:40:03Z', updatedAt: '2026-09-23T11:15:00Z' }
    expect(describeProgress(t, at('2026-09-23T11:20:00Z'))).toMatchObject({ kind: 'stale' })
  })
})

describe('isActive', () => {
  it('pending and running keep polling; everything else stops', () => {
    expect(isActive({ ...base, status: 'pending' })).toBe(true)
    expect(isActive({ ...base, status: 'running' })).toBe(true)
    expect(isActive({ ...base, status: 'completed' })).toBe(false)
    expect(isActive({ ...base, status: 'failed' })).toBe(false)
    expect(isActive(null)).toBe(false)
  })
})

describe('failureReason', () => {
  it.each([
    ['llama', 'o modelo local não respondeu'],
    ['bug: KeyError', 'um erro no programa da forja'],
    ['snapshot 500', 'a forja não conseguiu ler os números do canal'],
    ['janela 28', 'a janela de dados do canal veio diferente de 90 dias'],
    ['patch 429', 'o site não aceitou o resultado da forja'],
    ['orcamento', 'o tempo da execução acabou antes de o texto ficar pronto'],
  ])('%s', (code, text) => {
    expect(failureReason(code)).toBe(text)
  })

  it('a prefix is not a match: "llamada" is not "llama"', () => {
    expect(failureReason('llamada')).toBe('um erro que a forja registrou')
  })

  it('no code and unknown code still say something true', () => {
    expect(failureReason(null)).toBe('a forja não informou o motivo')
    expect(failureReason('auto-released: running past 30min')).toBe('um erro que a forja registrou')
  })
})

describe('formatters', () => {
  it('formatDuration', () => {
    expect(formatDuration(58_000)).toBe('58 s')
    expect(formatDuration(5 * 60_000)).toBe('5 min')
    expect(formatDuration(65 * 60_000)).toBe('1 h 05 min')
  })
  it('formatClock', () => {
    expect(formatClock(18_000)).toBe('0:18')
    expect(formatClock(125_000)).toBe('2:05')
  })
})
