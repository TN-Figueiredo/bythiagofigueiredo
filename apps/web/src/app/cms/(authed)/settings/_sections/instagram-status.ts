import { kindFrom } from '@/lib/instagram/status-text'

export type CardState =
  | 'invalid' | 'never-connected' | 'expiring' | 'retrying' | 'renewal-pending' | 'connected'

export interface InstagramCardAccount {
  handle: string
  connected: boolean
  sync_enabled: boolean
  last_synced_at: string | null
  token_expires_at: string | null
  token_error: string | null
  token_error_at: string | null
  token_error_mode: 'daily' | 'token_refresh' | null
  token_refreshed_at: string | null
  sync_logs: { mode: string; status: string; created_at: string; error_message: string | null }[]
}

/** Dois ciclos diários perdidos. */
export const STALE_MS = 48 * 3600_000
/** Acima disto o lembrete transitório muda de tom e Reconnect vira primário. */
export const LONG_OPEN_MS = 69 * 3600_000
/** O cron de renovação roda `"0 11 * * *"` (UTC) — §0. */
const DAILY_CHECK_UTC_HOUR = 11

function ms(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

export function daysUntilExpiry(iso: string | null, now: number): number | null {
  const t = ms(iso)
  return t === null ? null : Math.ceil((t - now) / 86_400_000)
}

export function expiresLabel(days: number): string {
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

export function formatDate(iso: string | null): string {
  const t = ms(iso)
  if (t === null) return 'an unknown date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(t))
}

export function relativeTime(iso: string | null, now: number): string {
  const t = ms(iso)
  if (t === null) return 'never'
  const mins = Math.floor((now - t) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/**
 * "08:00 today" / "08:00 tomorrow" — a próxima ocorrência das 11:00 UTC no fuso
 * do site. Um "by 08:00" seco, lido às 19:00, é lido como promessa já vencida.
 */
export function nextDailyCheckLabel(now: number, timeZone: string): string {
  const d = new Date(now)
  const todaysRun = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAILY_CHECK_UTC_HOUR, 0, 0)
  const runAt = now < todaysRun ? todaysRun : todaysRun + 86_400_000
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone,
  }).format(new Date(runAt))
  const dayOf = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(t))
  return `${hhmm} ${dayOf(runAt) === dayOf(now) ? 'today' : 'tomorrow'}`
}

/**
 * Allow-list do card: mensagens humanas da Meta passam; strings de máquina
 * (`Instagram API 403`, `fetch failed`, `TypeError: …`, prefixos internos) não —
 * §2 proíbe string de máquina nesta superfície.
 */
export function isHumanReason(reason: string): boolean {
  if (/^Instagram API \d+$/.test(reason)) return false
  if (/^fetch failed$/i.test(reason)) return false
  if (/^[A-Za-z]*Error\b/.test(reason)) return false
  if (/^(transient|permanent|infra|timeout|never_connected|decrypt_failed)\b/.test(reason)) return false
  return reason.trim().split(/\s+/).length >= 4 && /[a-z]{3}/.test(reason)
}

function since(a: InstagramCardAccount): number {
  return ms(a.token_refreshed_at) ?? 0
}

export function hasFailedFirstSync(a: InstagramCardAccount): boolean {
  if (a.last_synced_at !== null) return false
  return a.sync_logs.some((l) => l.status === 'failed' && (ms(l.created_at) ?? 0) > since(a))
}

export function hasOpenSyncRow(a: InstagramCardAccount): boolean {
  return a.sync_logs.some((l) => l.status === 'started' && (ms(l.created_at) ?? 0) > since(a))
}

/** Precedência MUST: Invalid > Never connected > Expiring > Retrying > Renewal pending > Connected. */
export function resolveCardState(a: InstagramCardAccount, now: number): CardState {
  const expiresAt = ms(a.token_expires_at)
  if (a.token_error !== null || (expiresAt !== null && expiresAt <= now)) return 'invalid'
  if (!a.connected) return 'never-connected'
  const days = daysUntilExpiry(a.token_expires_at, now)
  if (days !== null && days <= 7) return 'expiring'
  if (a.token_error_at !== null) return 'retrying'
  if (a.token_expires_at === null) return 'renewal-pending'
  return 'connected'
}

export function cardText(
  a: InstagramCardAccount,
  state: CardState,
  now: number,
  opts: { siteTimezone: string; syncing: boolean },
): { text: string; rawReason?: string } {
  const days = daysUntilExpiry(a.token_expires_at, now)

  switch (state) {
    case 'invalid': {
      const at = formatDate(a.token_error_at ?? a.token_expires_at)
      const kind = kindFrom({ token_error: a.token_error })
      if (kind === 'transient') {
        return { text: `Token expired — the daily check will confirm this by ${nextDailyCheckLabel(now, opts.siteTimezone)}` }
      }
      if (a.token_error === 'expired') return { text: `Token expired (since ${at})` }
      if (a.token_error === 'deauthorized') return { text: `Instagram access was revoked (since ${at})` }
      if (a.token_error === 'data_deletion_requested') {
        return { text: `A data-deletion request was received (since ${at}) — the cached feed was deleted` }
      }
      if (a.token_error === 'decrypt_failed') return { text: "Stored token can't be read — reconnect" }
      const reason = a.token_error ?? ''
      if (isHumanReason(reason)) return { text: `Token invalid — ${reason} (since ${at})` }
      return { text: `Token invalid (since ${at}) — reconnect`, rawReason: reason }
    }
    case 'never-connected':
      return { text: 'Not connected' }
    case 'expiring': {
      const base =
        `${expiresLabel(days ?? 0)} — auto-renewal hasn't succeeded ` +
        `(last successful renewal: ${relativeTime(a.token_refreshed_at, now)}). ` +
        'Reconnect now; waiting risks losing the connection.'
      const openEpisode = a.token_error === null && a.token_error_at !== null
        ? ` (auto-renewal has been failing since ${formatDate(a.token_error_at)})`
        : ''
      return { text: base + openEpisode }
    }
    case 'retrying': {
      const subject = a.token_error_mode === 'daily' ? 'Feed sync' : 'Auto-renewal'
      const at = formatDate(a.token_error_at)
      const openedAt = ms(a.token_error_at)
      const longOpen = openedAt !== null && now - openedAt >= LONG_OPEN_MS
      return {
        text: longOpen
          ? `${subject} has been failing since ${at} and hasn't recovered — reconnect`
          : `${subject} has been failing since ${at} — it keeps retrying daily`,
      }
    }
    case 'renewal-pending':
      return { text: 'Connected · expiry unknown — the daily check will renew it within two days' }
    case 'connected': {
      if (hasFailedFirstSync(a)) {
        return { text: 'Connected, but the first sync failed — the daily check will retry. See the runbook.' }
      }
      const tail = opts.syncing
        ? 'Syncing your feed…'
        : `last sync ${relativeTime(a.last_synced_at, now)}`
      return {
        text:
          `Connected · renews automatically · last renewal ${relativeTime(a.token_refreshed_at, now)} · ` +
          `${expiresLabel(days ?? 0)} · ${tail}`,
      }
    }
  }
}

/** O badge só é decidível nos três estados saudáveis (§3.5). */
export function isStale(a: InstagramCardAccount, now: number, state: CardState): boolean {
  if (state !== 'renewal-pending' && state !== 'expiring' && state !== 'connected') return false
  if (!a.connected || !a.sync_enabled) return false
  if (a.token_error !== null || a.token_error_at !== null) return false
  const last = ms(a.last_synced_at)
  return last !== null && now - last > STALE_MS
}

export function reconnectIsPrimary(state: CardState, a: InstagramCardAccount, now: number): boolean {
  if (state === 'invalid' || state === 'expiring') return true
  if (state === 'retrying') {
    const openedAt = ms(a.token_error_at)
    return openedAt !== null && now - openedAt >= LONG_OPEN_MS
  }
  return false
}
