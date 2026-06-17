import { describe, it, expect } from 'vitest'
import { parseSignupsCursor } from '../../src/app/cms/(authed)/waitlists/queries'

const ISO = '2026-06-10T12:00:00.000Z'
const UUID = '12345678-1234-1234-1234-123456789abc'

describe('parseSignupsCursor (keyset cursor validation — W1 injection guard)', () => {
  it('parses a valid <iso>|<uuid> cursor', () => {
    expect(parseSignupsCursor(`${ISO}|${UUID}`)).toEqual({ createdAt: ISO, id: UUID })
  })

  it('returns undefined for absent / pipe-less / boundary inputs', () => {
    expect(parseSignupsCursor(undefined)).toBeUndefined()
    expect(parseSignupsCursor('')).toBeUndefined()
    expect(parseSignupsCursor('nopipe')).toBeUndefined()
    expect(parseSignupsCursor(`|${UUID}`)).toBeUndefined() // leading pipe → empty createdAt
    expect(parseSignupsCursor(`${ISO}|`)).toBeUndefined() // trailing pipe → empty id
  })

  it('rejects a malformed date or id (must be ISO + UUID)', () => {
    expect(parseSignupsCursor(`notadate|${UUID}`)).toBeUndefined()
    expect(parseSignupsCursor(`${ISO}|not-a-uuid`)).toBeUndefined()
  })

  it('requires a timezone on the timestamp (rejects a bare TZ-less ISO)', () => {
    expect(parseSignupsCursor(`2026-06-10T12:00:00|${UUID}`)).toBeUndefined()
    expect(parseSignupsCursor(`2026-06-10T12:00:00.000|${UUID}`)).toBeUndefined()
    // …but accepts both Z and ±offset forms.
    expect(parseSignupsCursor(`2026-06-10T12:00:00+00:00|${UUID}`)).toEqual({
      createdAt: '2026-06-10T12:00:00+00:00',
      id: UUID,
    })
  })

  it('rejects a PostgREST-filter injection attempt in either part', () => {
    expect(parseSignupsCursor(`${ISO}|${UUID}),or=(email.eq.x`)).toBeUndefined()
    expect(parseSignupsCursor(`2026-01-01T00:00:00.or(status.eq.pending)|${UUID}`)).toBeUndefined()
  })
})
