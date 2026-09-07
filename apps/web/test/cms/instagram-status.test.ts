// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  cardText, daysUntilExpiry, expiresLabel, hasFailedFirstSync, hasOpenSyncRow,
  isHumanReason, isStale, nextDailyCheckLabel, reconnectIsPrimary, relativeTime,
  resolveCardState, type InstagramCardAccount,
} from '@/app/cms/(authed)/settings/_sections/instagram-status'

const NOW = Date.parse('2026-09-06T12:00:00Z')
const iso = (msFromNow: number) => new Date(NOW + msFromNow).toISOString()
const DAY = 86_400_000

function acc(over: Partial<InstagramCardAccount> = {}): InstagramCardAccount {
  return {
    handle: 'thiago.figueiredo',
    connected: true,
    sync_enabled: true,
    last_synced_at: iso(-3600_000),
    token_expires_at: iso(40 * DAY),
    token_error: null,
    token_error_at: null,
    token_error_mode: null,
    token_refreshed_at: iso(-2 * DAY),
    sync_logs: [],
    ...over,
  }
}

describe('resolveCardState — precedence', () => {
  it('Invalid wins over everything when token_error is set', () => {
    expect(resolveCardState(acc({ token_error: 'expired', connected: false, token_expires_at: null }), NOW)).toBe('invalid')
  })
  it('Invalid also covers an expired token with no episode yet', () => {
    expect(resolveCardState(acc({ token_expires_at: iso(-1000) }), NOW)).toBe('invalid')
  })
  it('Never connected comes next', () => {
    expect(resolveCardState(acc({ connected: false, token_expires_at: null }), NOW)).toBe('never-connected')
  })
  it('Expiring beats Retrying', () => {
    expect(resolveCardState(acc({ token_expires_at: iso(3 * DAY), token_error_at: iso(-4 * DAY) }), NOW)).toBe('expiring')
  })
  it('Retrying comes before Renewal pending', () => {
    expect(resolveCardState(acc({ token_expires_at: null, token_error_at: iso(-4 * DAY) }), NOW)).toBe('retrying')
  })
  it('Renewal pending when the expiry is unknown', () => {
    expect(resolveCardState(acc({ token_expires_at: null }), NOW)).toBe('renewal-pending')
  })
  it('Connected otherwise', () => {
    expect(resolveCardState(acc(), NOW)).toBe('connected')
  })
})

describe('expiresLabel / daysUntilExpiry', () => {
  it('renders 0, 1 and >= 2 days without "in 1 days"', () => {
    expect(expiresLabel(0)).toBe('Expires today')
    expect(expiresLabel(1)).toBe('Expires tomorrow')
    expect(expiresLabel(2)).toBe('Expires in 2 days')
    expect(expiresLabel(-3)).toBe('Expires today')
  })
  it('returns null for an absent or unparseable date instead of NaN', () => {
    expect(daysUntilExpiry(null, NOW)).toBeNull()
    expect(daysUntilExpiry('not-a-date', NOW)).toBeNull()
  })
})

describe('nextDailyCheckLabel — the 11:00 UTC run in the site timezone', () => {
  it('says "today" before the run and "tomorrow" after it', () => {
    expect(nextDailyCheckLabel(Date.parse('2026-09-06T09:00:00Z'), 'America/Sao_Paulo')).toBe('08:00 today')
    expect(nextDailyCheckLabel(Date.parse('2026-09-06T19:00:00Z'), 'America/Sao_Paulo')).toBe('08:00 tomorrow')
  })
})

describe('relativeTime', () => {
  it('says never for null and never renders NaN or "in 1 days"', () => {
    expect(relativeTime(null, NOW)).toBe('never')
    expect(relativeTime('not-a-date', NOW)).toBe('never')
    expect(relativeTime(iso(-DAY), NOW)).toBe('1 day ago')
    expect(relativeTime(iso(-3 * DAY), NOW)).toBe('3 days ago')
    expect(relativeTime(iso(-3600_000), NOW)).toBe('1 hour ago')
  })
})

describe('cardText', () => {
  it('Invalid/transient points at the next daily check with a day word', () => {
    const a = acc({ token_expires_at: iso(-1000), token_error: null })
    expect(cardText(a, 'invalid', NOW, { siteTimezone: 'America/Sao_Paulo', syncing: false }).text)
      .toBe('Token expired — the daily check will confirm this by 08:00 tomorrow')
  })
  it('renders each known token_error reason in English', () => {
    const at = iso(-2 * DAY)
    const t = (reason: string) =>
      cardText(acc({ token_error: reason, token_error_at: at }), 'invalid', NOW,
        { siteTimezone: 'UTC', syncing: false }).text
    expect(t('expired')).toContain('Token expired (since ')
    expect(t('deauthorized')).toContain('Instagram access was revoked (since ')
    expect(t('data_deletion_requested')).toContain('A data-deletion request was received (since ')
    expect(t('data_deletion_requested')).toContain('— the cached feed was deleted')
    expect(t('decrypt_failed')).toBe("Stored token can't be read — reconnect")
    expect(t('The session has been invalidated because the user changed their password'))
      .toContain('Token invalid — The session has been invalidated')
  })
  it('hides machine strings behind the generic sentence and exposes them via rawReason', () => {
    const at = iso(-2 * DAY)
    for (const machine of ['Instagram API 403', 'fetch failed', 'TypeError: bad', 'permanent: nope']) {
      const r = cardText(acc({ token_error: machine, token_error_at: at }), 'invalid', NOW,
        { siteTimezone: 'UTC', syncing: false })
      expect(r.text).toContain('Token invalid (since ')
      expect(r.text).toContain('— reconnect')
      expect(r.text).not.toContain(machine)
      expect(r.rawReason).toBe(machine)
    }
  })
  it('Retrying names the subject and flips wording at 69 h', () => {
    const short = acc({ token_error_at: iso(-68 * 3600_000), token_error_mode: 'daily', token_expires_at: null })
    expect(cardText(short, 'retrying', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toContain('Feed sync has been failing since ')
    expect(cardText(short, 'retrying', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toContain('it keeps retrying daily')
    const long = acc({ token_error_at: iso(-70 * 3600_000), token_error_mode: 'token_refresh', token_expires_at: null })
    const text = cardText(long, 'retrying', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).toContain('Auto-renewal has been failing since ')
    expect(text).toContain("hasn't recovered — reconnect")
  })
  it('Expiring keeps the countdown and appends the open episode', () => {
    const a = acc({ token_expires_at: iso(3 * DAY), token_error_at: iso(-4 * DAY) })
    const text = cardText(a, 'expiring', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).toContain('Expires in 3 days')
    expect(text).toContain("auto-renewal hasn't succeeded (last successful renewal: 2 days ago)")
    expect(text).toContain(' (auto-renewal has been failing since ')
    expect(reconnectIsPrimary('expiring', a, NOW)).toBe(true)
  })
  it('Connected carries last renewal, expiry and last sync', () => {
    const text = cardText(acc(), 'connected', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).toBe('Connected · renews automatically · last renewal 2 days ago · Expires in 40 days · last sync 1 hour ago')
  })
  it('Syncing replaces ONLY the last-sync tail', () => {
    const text = cardText(acc(), 'connected', NOW, { siteTimezone: 'UTC', syncing: true }).text
    expect(text).toContain('Syncing your feed…')
    expect(text).toContain('last renewal 2 days ago')
    expect(text).not.toContain('last sync 1 hour')
  })
  it('Connected reports a failed first sync', () => {
    const a = acc({
      last_synced_at: null,
      sync_logs: [{ mode: 'manual', status: 'failed', created_at: iso(-60_000), error_message: 'x' }],
    })
    expect(cardText(a, 'connected', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toBe('Connected, but the first sync failed — the daily check will retry. See the runbook.')
    expect(hasFailedFirstSync(a)).toBe(true)
  })
  it('never renders NaN or Invalid Date for garbage timestamps', () => {
    const a = acc({ token_error: 'expired', token_error_at: 'garbage', token_expires_at: 'garbage' })
    const text = cardText(a, 'invalid', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Invalid Date')
  })
  it('Never connected and Renewal pending have fixed sentences', () => {
    expect(cardText(acc({ connected: false }), 'never-connected', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toBe('Not connected')
    expect(cardText(acc({ token_expires_at: null }), 'renewal-pending', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toBe('Connected · expiry unknown — the daily check will renew it within two days')
  })
})

describe('isStale', () => {
  it('shows at 49 h and hides at 47 h', () => {
    expect(isStale(acc({ last_synced_at: iso(-49 * 3600_000) }), NOW, 'connected')).toBe(true)
    expect(isStale(acc({ last_synced_at: iso(-47 * 3600_000) }), NOW, 'connected')).toBe(false)
  })
  it('hides with an open episode, with auto-sync off, when disconnected and in Invalid/Retrying/Never connected', () => {
    const stale = { last_synced_at: iso(-49 * 3600_000) }
    expect(isStale(acc({ ...stale, token_error_at: iso(-3 * DAY) }), NOW, 'connected')).toBe(false)
    expect(isStale(acc({ ...stale, sync_enabled: false }), NOW, 'connected')).toBe(false)
    expect(isStale(acc({ ...stale, connected: false }), NOW, 'connected')).toBe(false)
    expect(isStale(acc(stale), NOW, 'invalid')).toBe(false)
    expect(isStale(acc(stale), NOW, 'retrying')).toBe(false)
    expect(isStale(acc(stale), NOW, 'never-connected')).toBe(false)
    expect(isStale(acc({ ...stale, last_synced_at: null }), NOW, 'connected')).toBe(false)
  })
})

describe('hasOpenSyncRow — the Syncing sub-case of §3.1 step 11', () => {
  it('is true for a started row newer than the connection and false otherwise', () => {
    const a = acc({
      token_refreshed_at: iso(-60_000),
      sync_logs: [{ mode: 'manual', status: 'started', created_at: iso(-30_000), error_message: 'detail: x' }],
    })
    expect(hasOpenSyncRow(a)).toBe(true)
    const b = acc({
      token_refreshed_at: iso(-60_000),
      sync_logs: [{ mode: 'daily', status: 'started', created_at: iso(-90_000), error_message: null }],
    })
    expect(hasOpenSyncRow(b)).toBe(false)
  })
})

describe('isHumanReason', () => {
  it('accepts Meta sentences and rejects machine strings', () => {
    expect(isHumanReason('The session has been invalidated because the user changed their password')).toBe(true)
    expect(isHumanReason('Instagram API 403')).toBe(false)
    expect(isHumanReason('fetch failed')).toBe(false)
    expect(isHumanReason('TypeError: Failed to fetch')).toBe(false)
    expect(isHumanReason('transient: rate limit')).toBe(false)
  })
})

describe('reconnectIsPrimary', () => {
  it('is primary in Invalid and Expiring, and in Retrying only past 69 h', () => {
    expect(reconnectIsPrimary('invalid', acc(), NOW)).toBe(true)
    expect(reconnectIsPrimary('retrying', acc({ token_error_at: iso(-68 * 3600_000) }), NOW)).toBe(false)
    expect(reconnectIsPrimary('retrying', acc({ token_error_at: iso(-70 * 3600_000) }), NOW)).toBe(true)
    expect(reconnectIsPrimary('connected', acc(), NOW)).toBe(false)
    expect(reconnectIsPrimary('renewal-pending', acc(), NOW)).toBe(false)
  })
})
