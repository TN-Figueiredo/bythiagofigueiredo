import { describe, it, expect } from 'vitest'
import { WAITLIST_CONSENT_VERSION } from '@/app/api/waitlists/consent'
describe('waitlist consent version', () => {
  it('matches the id convention used in the seed', () => {
    expect(WAITLIST_CONSENT_VERSION).toMatch(/^launch-notification-v\d+-\d{4}-\d{2}$/)
  })
})
