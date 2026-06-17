import { describe, it, expect } from 'vitest'
import { LEGAL_TRANSITIONS, WAITLIST_STATUSES } from '../../lib/waitlists/status'
import { STRIP } from '../../src/app/cms/(authed)/waitlists/_components/status-strip'

// The status-strip buttons and the transitionWaitlistStatus guard must not drift: every
// button the strip offers MUST be a legal transition (WL-4 — single source of truth).
describe('status-strip ↔ LEGAL_TRANSITIONS consistency', () => {
  it.each(WAITLIST_STATUSES)('every %s button target is a legal transition', (status) => {
    const allowed = LEGAL_TRANSITIONS[status]
    for (const action of STRIP[status]) {
      expect(allowed).toContain(action.to)
    }
  })

  it('terminal statuses (launching/launched) expose no transition buttons', () => {
    expect(STRIP.launching).toHaveLength(0)
    expect(STRIP.launched).toHaveLength(0)
  })
})
