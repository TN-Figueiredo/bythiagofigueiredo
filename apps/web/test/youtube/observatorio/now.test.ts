// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
const ENV = { ...process.env }
const FROZEN = '2026-10-24T15:02:00-03:00'
afterEach(() => { process.env = { ...ENV }; vi.unstubAllEnvs(); vi.useRealTimers() })
/**
 * Gate (R34): `next dev` inlines process.env.NODE_ENV as 'development' in server bundles, so a NODE_ENV === 'test'
 * gate is dead under the Playwright webServer. The override needs OBS_E2E=1 AND a non-production NODE_ENV.
 */
describe('observatoryNow', () => {
  it('without OBS_NOW_OVERRIDE it is Date.now() (var deleted)', () => {
    delete process.env.OBS_NOW_OVERRIDE
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'development')
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
  it('honours the override under next dev (NODE_ENV=development) with OBS_E2E=1', () => {
    process.env.OBS_NOW_OVERRIDE = FROZEN
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'development')
    expect(observatoryNow()).toBe(Date.parse(FROZEN))
    vi.stubEnv('NODE_ENV', 'test')
    expect(observatoryNow()).toBe(Date.parse(FROZEN))
  })
  it('ignores the override when OBS_E2E is missing (var deleted)', () => {
    process.env.OBS_NOW_OVERRIDE = FROZEN
    delete process.env.OBS_E2E; vi.stubEnv('NODE_ENV', 'development')
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
  it('ignores the override when OBS_E2E is not exactly "1"', () => {
    process.env.OBS_NOW_OVERRIDE = FROZEN
    vi.stubEnv('OBS_E2E', 'true'); vi.stubEnv('NODE_ENV', 'development')
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
  it('NODE_ENV=production ignores the override even with OBS_E2E=1', () => {
    process.env.OBS_NOW_OVERRIDE = FROZEN
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'production')
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
  it('an unparsable override is ignored', () => {
    process.env.OBS_NOW_OVERRIDE = 'banana'; vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'development')
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
})
