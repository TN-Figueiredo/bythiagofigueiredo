import { describe, it, expect } from 'vitest'
import { redactMessage } from '../../lib/waitlists/scrub'

describe('redactMessage', () => {
  it('redacts email and IPv4 from a mixed string', () => {
    const result = redactMessage('a@b.com from 203.0.113.5')
    expect(result).not.toContain('a@b.com')
    expect(result).not.toContain('203.0.113.5')
    expect(result).toContain('[email]')
    expect(result).toContain('[ip]')
  })
})
