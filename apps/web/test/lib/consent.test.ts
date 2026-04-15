import { describe, it, expect } from 'vitest'
import { CONSENT_VERSION } from '../../lib/campaigns/consent'

describe('CONSENT_VERSION', () => {
  it('has semver-like version prefix', () => {
    expect(CONSENT_VERSION).toMatch(/^v\d+-\d{4}-\d{2}$/)
  })
})
