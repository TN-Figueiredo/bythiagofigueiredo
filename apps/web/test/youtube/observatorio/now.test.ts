// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
const ENV = { ...process.env }
afterEach(() => { process.env = { ...ENV }; vi.unstubAllEnvs(); vi.useRealTimers() })
describe('observatoryNow', () => {
  it('without OBS_NOW_OVERRIDE it is Date.now()', () => {
    delete process.env.OBS_NOW_OVERRIDE
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
  it('honours the override only under NODE_ENV=test', () => {
    process.env.OBS_NOW_OVERRIDE = '2026-10-24T15:02:00-03:00'
    vi.stubEnv('NODE_ENV', 'test'); expect(observatoryNow()).toBe(Date.parse('2026-10-24T15:02:00-03:00'))
    vi.stubEnv('NODE_ENV', 'production'); expect(observatoryNow()).not.toBe(Date.parse('2026-10-24T15:02:00-03:00'))
  })
  it('an unparsable override is ignored', () => {
    process.env.OBS_NOW_OVERRIDE = 'banana'; vi.stubEnv('NODE_ENV', 'test')
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
})
