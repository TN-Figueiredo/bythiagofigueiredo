'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SlotManager } from '@/components/instagram/slot-manager'
import { useSaveState, SaveButton, labelCls, sectionCls } from './_shared'
import { oauthErrorText, previewDisabledText } from '@/lib/instagram/status-text'
import { allowedLocales, type InstagramLocale } from '@/lib/instagram/locale-rules'
import type { OauthErrorCode } from '@/lib/oauth/errors'
import {
  cardText, hasOpenSyncRow, isStale, reconnectIsPrimary, resolveCardState,
} from './instagram-status'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface InstagramAccountData {
  id: string
  locale: InstagramLocale
  handle: string
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  section_title_pt: string | null
  section_title_en: string | null
  section_subtitle_pt: string | null
  section_subtitle_en: string | null
  last_synced_at: string | null
  token_expires_at: string | null
  token_error: string | null
  token_error_at: string | null
  token_error_mode: 'daily' | 'token_refresh' | null
  token_refreshed_at: string | null
  token_alert_sent_at: string | null
  ig_user_id: string | null
  ig_user_id_source: 'oauth' | 'legacy'
  connected: boolean
  posts: { id: string; cached_image_url: string | null; caption: string | null }[]
  sync_logs: { mode: string; status: string; posts_found: number; posts_inserted: number; posts_updated: number; created_at: string; error_message: string | null }[]
  slots: { id: string; position: number; post_id: string | null; thumbnail_url: string | null; caption: string | null }[]
}

export interface InstagramSectionProps {
  accounts: InstagramAccountData[]
  readOnly: boolean
  oauthConfigured?: boolean
  missingInstagramEnv?: string[]
  isPreview?: boolean
  handleMismatch?: { accountId: string; authorizedHandle: string } | null
  siteTimezone?: string
}

/**
 * Teto incondicional do `In progress`. No celular a "janela" é uma aba que o
 * dono abandona sem fechar: sem o teto o spinner ficaria para sempre e as ações
 * travadas até um reload que ninguém tem motivo de dar.
 */
const OAUTH_TIMEOUT_MS = 10 * 60_000
const OAUTH_WINDOW_FEATURES = 'width=600,height=700'

/* ------------------------------------------------------------------ */
/*  InstagramSection                                                  */
/* ------------------------------------------------------------------ */

export function InstagramSection({
  accounts,
  readOnly,
  oauthConfigured = false,
  missingInstagramEnv = [],
  isPreview = false,
  handleMismatch = null,
  siteTimezone = 'America/Sao_Paulo',
}: InstagramSectionProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Estado derivado de props: `router.refresh()` no lugar de `setAccounts`.
  // O `handleAdd` antigo injetava `id: crypto.randomUUID()` e o card recém-criado
  // apontava para uma conta inexistente.
  const handleRemove = (accountId: string) => {
    startTransition(async () => {
      const { removeInstagramAccount } = await import('../actions')
      const res = await removeInstagramAccount({ accountId })
      if (res.ok) router.refresh()
      else alert(res.error)
    })
  }

  const existingLocales = accounts.map((a) => a.locale)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-100">Instagram Feed</h2>

      {accounts.length === 0 && (
        <p className="text-sm text-slate-400">No Instagram account configured.</p>
      )}

      {accounts.map((account) => (
        <InstagramAccountCard
          key={account.id}
          account={account}
          readOnly={readOnly}
          oauthConfigured={oauthConfigured}
          missingInstagramEnv={missingInstagramEnv}
          isPreview={isPreview}
          mismatch={handleMismatch?.accountId === account.id ? handleMismatch : null}
          siteTimezone={siteTimezone}
          existingLocales={existingLocales}
          onRemove={() => handleRemove(account.id)}
        />
      ))}

      {accounts.length < 3 && !readOnly && (
        <AddInstagramForm existingLocales={existingLocales} onAdded={() => router.refresh()} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  InstagramAccountCard                                              */
/* ------------------------------------------------------------------ */

function InstagramAccountCard({
  account,
  readOnly,
  oauthConfigured,
  missingInstagramEnv,
  isPreview,
  mismatch,
  siteTimezone,
  existingLocales,
  onRemove,
}: {
  account: InstagramAccountData
  readOnly: boolean
  oauthConfigured: boolean
  missingInstagramEnv: string[]
  isPreview: boolean
  mismatch: { accountId: string; authorizedHandle: string } | null
  siteTimezone: string
  existingLocales: string[]
  onRemove: () => void
}) {
  const router = useRouter()
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()
  const [accountLocale, setAccountLocale] = useState<InstagramLocale>(account.locale)
  const [syncEnabled, setSyncEnabled] = useState(account.sync_enabled)
  const [displaySlots, setDisplaySlots] = useState(account.display_slots)
  const [layoutType, setLayoutType] = useState(account.layout_type)
  const [titlePt, setTitlePt] = useState(account.section_title_pt ?? '')
  const [titleEn, setTitleEn] = useState(account.section_title_en ?? '')
  const [subtitlePt, setSubtitlePt] = useState(account.section_subtitle_pt ?? '')
  const [subtitleEn, setSubtitleEn] = useState(account.section_subtitle_en ?? '')
  const [token, setToken] = useState('')
  const [inProgress, setInProgress] = useState<{ origin: 'oauth' | 'sync'; startedAt: number } | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [lastOauthQuery, setLastOauthQuery] = useState('')
  const winRef = useRef<Window | null>(null)

  const busy = inProgress !== null
  const syncing = inProgress?.origin === 'sync'
  const oauthDisabled = readOnly || isPreview || !oauthConfigured
  const oauthTitle = isPreview
    ? previewDisabledText()
    : !oauthConfigured
      ? oauthErrorText('not_configured')
      : undefined

  const now = Date.now()
  const state = resolveCardState(account, now)
  const isSyncing = hasOpenSyncRow(account)
  const showStale = !isSyncing && isStale(account, now, state)
  const status = cardText(account, state, now, { siteTimezone, syncing: isSyncing })
  const reconnectPrimary = reconnectIsPrimary(state, account, now)
  // `Preview` vence `Not configured`; nos dois a cola manual é primária.
  const pastePrimary = isPreview || !oauthConfigured
  const localeOptions = allowedLocales(existingLocales, account.locale)
  // Visível em todo estado com token, mais Invalid/Retrying mesmo sem ele;
  // oculto só em Never connected sem episódio.
  const disconnectVisible = account.connected || state === 'invalid' || state === 'retrying'

  // Listener único do resultado do popup. `origin` é conferido SEMPRE.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      // MUST: `oauthResultHtml` (B) faz `...extra` no payload — `code` e `status`
      // chegam no TOPO do objeto, NUNCA aninhados sob `extra`.
      const data = e.data as {
        type?: string; success?: boolean; error?: unknown
        status?: string; code?: OauthErrorCode
      } | null
      if (!data || data.type !== 'instagram-oauth-result') return

      setInProgress(null)
      winRef.current = null

      if (data.success) {
        setInlineError(null)
        router.refresh()
        // O `after()` do callback ainda está rodando: um segundo refresh troca
        // "last sync never" por "Syncing your feed…" sem recarga manual.
        window.setTimeout(() => router.refresh(), 8000)
        return
      }
      if (data.status === 'handle_mismatch') {
        router.refresh()
        return
      }
      const fromServer = typeof data.error === 'string' && data.error.length <= 200 ? data.error : null
      setInlineError(fromServer ?? oauthErrorText(data.code ?? 'write_failed'))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [router])

  // Teto incondicional de 10 min; `w.closed` só ANTECIPA.
  useEffect(() => {
    if (!inProgress) return
    const settle = () => {
      const elapsed = Date.now() - inProgress.startedAt
      if (winRef.current?.closed !== true && elapsed < OAUTH_TIMEOUT_MS) return
      winRef.current?.close()
      winRef.current = null
      setInProgress(null)
      if (elapsed >= OAUTH_TIMEOUT_MS) {
        setInlineError(inProgress.origin === 'oauth'
          ? "Authorization didn't finish — try again"
          : 'The sync is taking too long — try again')
      }
    }
    const timer = window.setTimeout(settle, Math.max(0, OAUTH_TIMEOUT_MS - (Date.now() - inProgress.startedAt)))
    const onVisible = () => { if (document.visibilityState === 'visible') settle() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [inProgress])

  const isDirty =
    titlePt !== (account.section_title_pt ?? '') ||
    titleEn !== (account.section_title_en ?? '') ||
    subtitlePt !== (account.section_subtitle_pt ?? '') ||
    subtitleEn !== (account.section_subtitle_en ?? '')

  /** `window.open` SÍNCRONO antes de qualquer `await` — senão o navegador bloqueia. */
  const openOauth = (query: string) => {
    if (oauthDisabled || busy) return
    const url = `/api/instagram/oauth?account_id=${account.id}${query}`
    setLastOauthQuery(query)
    const w = window.open('about:blank', 'ig-oauth', OAUTH_WINDOW_FEATURES)
    if (w === null) {
      if (isDirty && !confirm('Leave this page to authorize with Instagram? Unsaved changes to the section texts will be lost.')) return
      window.location.href = url
      return
    }
    winRef.current = w
    setInlineError(null)
    setInProgress({ origin: 'oauth', startedAt: Date.now() })
    w.location.href = url
  }

  const handleRebind = () => {
    if (oauthDisabled || busy) return
    const w = window.open('about:blank', 'ig-oauth', OAUTH_WINDOW_FEATURES)
    if (w !== null) winRef.current = w
    setInlineError(null)
    setInProgress({ origin: 'oauth', startedAt: Date.now() })
    startTransition(async () => {
      const { authorizeInstagramRebind } = await import('../actions')
      const res = await authorizeInstagramRebind({ accountId: account.id })
      if (!res.ok) {
        w?.close()
        winRef.current = null
        setInProgress(null)
        setInlineError(res.error)
        return
      }
      const url = `/api/instagram/oauth?account_id=${account.id}&rebind=${encodeURIComponent(res.rebind)}`
      if (w) w.location.href = url
      else window.location.href = url
    })
  }

  const handleDismissMismatch = () => {
    startTransition(async () => {
      const { dismissInstagramHandleMismatch } = await import('../actions')
      await dismissInstagramHandleMismatch()
      router.refresh()
    })
  }

  const cancelInProgress = () => {
    winRef.current?.close()
    winRef.current = null
    setInProgress(null)
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      const { updateInstagramSettings } = await import('../actions')
      const res = await updateInstagramSettings({
        accountId: account.id,
        locale: accountLocale,
        sync_enabled: syncEnabled,
        display_slots: displaySlots,
        layout_type: layoutType,
        section_title_pt: titlePt.trim() || null,
        section_title_en: titleEn.trim() || null,
        section_subtitle_pt: subtitlePt.trim() || null,
        section_subtitle_en: subtitleEn.trim() || null,
      })
      setSaveState(res.ok ? 'success' : 'error')
      if (res.ok) router.refresh()
    })
  }

  const handleEnableAutoSync = () => {
    startTransition(async () => {
      const { updateInstagramSettings } = await import('../actions')
      const res = await updateInstagramSettings({ accountId: account.id, sync_enabled: true })
      if (res.ok) { setSyncEnabled(true); router.refresh() }
      else alert(res.error)
    })
  }

  const handleSetToken = () => {
    if (!token.trim()) return
    startTransition(async () => {
      const { setInstagramToken } = await import('../actions')
      const res = await setInstagramToken({ accountId: account.id, accessToken: token.trim() })
      if (res.ok) { setToken(''); router.refresh() }
      else alert(res.error)
    })
  }

  const handleSync = () => {
    if (busy) return
    setSyncNote(null)
    setInlineError(null)
    setInProgress({ origin: 'sync', startedAt: Date.now() })
    startTransition(async () => {
      const { triggerInstagramSync } = await import('../actions')
      const res = await triggerInstagramSync({ accountId: account.id })
      setInProgress(null)
      if (!res.ok) { setInlineError(res.error); return }
      if (res.partial) setSyncNote('Synced part of the feed — run Sync Now again to finish')
      router.refresh()
    })
  }

  const handleDisconnect = () => {
    const message = account.last_synced_at !== null && account.token_error !== 'data_deletion_requested'
      ? 'Disconnect this Instagram account? Alerts stop and the feed keeps the posts already synced, but it stops receiving new ones until you reconnect. This does not revoke the app on Instagram.'
      : 'Disconnect this Instagram account? Alerts stop and the account stays configured with no posts until you reconnect. This does not revoke the app on Instagram.'
    if (!confirm(message)) return
    startTransition(async () => {
      const { disconnectInstagramAccount } = await import('../actions')
      const res = await disconnectInstagramAccount({ accountId: account.id })
      if (!res.ok) { setInlineError(res.error); return }
      router.refresh()
    })
  }

  const handleRemoveClick = () => {
    const message = disconnectVisible
      ? 'Remove this Instagram account and all synced posts? To keep the posts and only stop the alerts, use Disconnect.'
      : 'Remove this Instagram account and all synced posts?'
    if (!confirm(message)) return
    onRemove()
  }

  const effectiveSlots = account.slots.length > 0
    ? account.slots
    : Array.from({ length: account.display_slots }, (_, i) => ({
        id: `virtual-${i + 1}`,
        position: i + 1,
        post_id: null as string | null,
        thumbnail_url: null as string | null,
        caption: null as string | null,
      }))

  const handleSlotReorder = (slots: { position: number; postId: string | null }[]) => {
    startTransition(async () => {
      const { updateInstagramSlots } = await import('../actions')
      await updateInstagramSlots({ accountId: account.id, slots })
    })
  }

  const handlePinPost = (position: number, postId: string | null) => {
    startTransition(async () => {
      const { updateInstagramSlots } = await import('../actions')
      const currentSlots = effectiveSlots.map(s => ({
        position: s.position,
        postId: s.position === position ? postId : s.post_id,
      }))
      await updateInstagramSlots({ accountId: account.id, slots: currentSlots })
    })
  }

  return (
    <div className="space-y-4" data-testid="ig-card">
      <form onSubmit={handleSaveSettings} className={sectionCls()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-slate-200">{account.handle}</h3>
            <select
              data-testid="ig-locale-select"
              value={accountLocale}
              onChange={e => setAccountLocale(e.target.value as InstagramLocale)}
              disabled={readOnly}
              className="rounded-md border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300"
            >
              {localeOptions.map(l => (
                <option key={l} value={l}>
                  {l === 'all' ? 'All (PT + EN)' : l === 'pt' ? 'PT-BR' : 'EN'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {!readOnly && account.connected && (
              <button
                type="button"
                data-testid="ig-sync-now"
                onClick={handleSync}
                disabled={busy}
                className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                data-testid="ig-remove"
                onClick={handleRemoveClick}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Connection */}
        <div className="space-y-2 rounded-md border border-slate-700 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-slate-300">Connection</h4>
            {isPreview && (
              <span data-testid="ig-badge-preview" className="rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-200">
                Preview
              </span>
            )}
            {!account.sync_enabled && (
              <span data-testid="ig-badge-autosync-off" className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] text-amber-300">
                Auto-sync off
              </span>
            )}
            {showStale && (
              <span data-testid="ig-badge-stale" className="rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300">
                Stale
              </span>
            )}
          </div>

          <p data-testid="ig-status-text" className="text-sm text-slate-300" title={status.rawReason}>
            {status.text}
          </p>

          {isPreview && (
            <p className="text-xs text-slate-400">{previewDisabledText()}</p>
          )}
          {!isPreview && !oauthConfigured && (
            <p
              data-testid="ig-badge-not-configured"
              className="text-xs text-amber-300"
              title={missingInstagramEnv.join(', ')}
            >
              {oauthErrorText('not_configured')}
            </p>
          )}

          {readOnly && (state === 'invalid' || state === 'retrying') && (
            <p data-testid="ig-readonly-note" className="text-xs text-slate-400">
              You don&apos;t have permission to reconnect — ask a site admin.
            </p>
          )}

          {!readOnly && !account.sync_enabled && state !== 'never-connected' && (
            <button
              type="button"
              data-testid="ig-enable-autosync"
              onClick={handleEnableAutoSync}
              className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              Enable auto-sync
            </button>
          )}

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              {state === 'never-connected' ? (
                <button
                  type="button"
                  data-testid="ig-connect"
                  onClick={() => openOauth('')}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  Connect with Instagram
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="ig-reconnect"
                  onClick={() => openOauth('')}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className={
                    reconnectPrimary
                      ? 'rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50'
                      : 'rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50'
                  }
                >
                  Reconnect
                </button>
              )}

              {account.connected && (
                <button
                  type="button"
                  data-testid="ig-different"
                  onClick={() => openOauth('&different=1')}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Connect a different account
                </button>
              )}

              {disconnectVisible && (
                <button
                  type="button"
                  data-testid="ig-disconnect"
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  Disconnect
                </button>
              )}
            </div>
          )}

          {syncNote && (
            <p data-testid="ig-sync-note" className="text-xs text-amber-300">{syncNote}</p>
          )}

          {!readOnly && busy && (
            <p data-testid="ig-inprogress" className="flex items-center gap-2 text-xs text-slate-400">
              <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-transparent" />
              Still waiting for Instagram.{' '}
              <button
                type="button"
                data-testid="ig-cancel"
                onClick={cancelInProgress}
                className="underline hover:text-slate-200"
              >
                Cancel
              </button>
            </p>
          )}

          {!readOnly && inlineError && (
            <div className="space-y-1 rounded-md border border-red-500/40 bg-red-500/10 p-2">
              <p data-testid="ig-inline-error" className="text-xs text-red-300">{inlineError}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="ig-try-again"
                  onClick={() => openOauth(lastOauthQuery)}
                  disabled={oauthDisabled || busy}
                  className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Try again
                </button>
                <button
                  type="button"
                  data-testid="ig-dismiss-error"
                  onClick={() => setInlineError(null)}
                  className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {!readOnly && mismatch && (
            <div data-testid="ig-mismatch-banner" className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
              <p className="text-xs text-amber-200">
                You authorized @{mismatch.authorizedHandle}; this CMS account is @{account.handle}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="ig-rebind"
                  onClick={handleRebind}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className="rounded-md bg-indigo-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  Use @{mismatch.authorizedHandle} for this account and reconnect
                </button>
                <button
                  type="button"
                  data-testid="ig-mismatch-cancel"
                  onClick={handleDismissMismatch}
                  className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              disabled={readOnly}
              className="accent-indigo-500"
            />
            Auto-sync enabled
          </label>

          <div className="space-y-1">
            <label className={labelCls()}>Layout</label>
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value as 'grid' | 'scatter')}
              disabled={readOnly}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="grid">Grid</option>
              <option value="scatter">Scatter</option>
            </select>
          </div>
        </div>

        {(accountLocale === 'pt' || accountLocale === 'all') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls()}>Título (PT-BR)</label>
              <input
                type="text"
                value={titlePt}
                onChange={e => setTitlePt(e.target.value)}
                disabled={readOnly}
                placeholder="do iPhone, sem filtro"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls()}>Subtítulo (PT-BR)</label>
              <input
                type="text"
                value={subtitlePt}
                onChange={e => setSubtitlePt(e.target.value)}
                disabled={readOnly}
                placeholder="últimos cliques"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        {(accountLocale === 'en' || accountLocale === 'all') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls()}>Title (EN)</label>
              <input
                type="text"
                value={titleEn}
                onChange={e => setTitleEn(e.target.value)}
                disabled={readOnly}
                placeholder="from the iPhone, no filter"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls()}>Subtitle (EN)</label>
              <input
                type="text"
                value={subtitleEn}
                onChange={e => setSubtitleEn(e.target.value)}
                disabled={readOnly}
                placeholder="latest shots"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className={labelCls()}>Display Slots ({displaySlots})</label>
          <input
            type="range"
            min={1}
            max={12}
            value={displaySlots}
            onChange={(e) => setDisplaySlots(Number(e.target.value))}
            disabled={readOnly}
            className="w-full"
          />
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-2">
            <SaveButton state={saveState} />
          </div>
        )}
      </form>

      {/* Cola manual — fallback permanente (objetivo 4), nunca removida */}
      {!readOnly && (
        <details data-testid="ig-paste-details" open={pastePrimary} className={sectionCls()}>
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            {pastePrimary ? 'Paste token manually' : 'Paste token manually (fallback)'}
          </summary>
          <div className="mt-3 flex items-end gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste long-lived access token"
              className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={handleSetToken}
              disabled={!token.trim()}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </details>
      )}

      {account.posts.length > 0 && (
        <div className={sectionCls()}>
          <h4 className="text-sm font-medium text-slate-300">Pin Management</h4>
          <SlotManager
            slots={effectiveSlots.map(s => ({
              id: s.id,
              position: s.position,
              postId: s.post_id,
              thumbnailUrl: s.thumbnail_url,
              caption: s.caption,
            }))}
            allPosts={account.posts.map(p => ({
              id: p.id,
              cachedImageUrl: p.cached_image_url,
              caption: p.caption,
            }))}
            onReorder={handleSlotReorder}
            onPinPost={handlePinPost}
            disabled={readOnly}
          />
        </div>
      )}

      {account.sync_logs.length > 0 && (
        <div className={sectionCls()}>
          <h4 className="text-sm font-medium text-slate-300">Sync History</h4>
          <div className="space-y-1">
            {account.sync_logs.slice(0, 5).map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">{new Date(log.created_at).toLocaleDateString()}</span>
                <span className={log.status === 'completed' ? 'text-green-400' : log.status === 'failed' ? 'text-red-400' : 'text-slate-400'}>
                  {log.status}
                </span>
                {log.status === 'completed' && (
                  <span className="text-slate-500">{log.posts_inserted} new, {log.posts_updated} updated</span>
                )}
                {log.error_message && (
                  <span className="text-red-400">{log.error_message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AddInstagramForm                                                  */
/* ------------------------------------------------------------------ */

function AddInstagramForm({
  existingLocales,
  onAdded,
}: {
  existingLocales: string[]
  onAdded: () => void
}) {
  const availableLocales = allowedLocales(existingLocales)
  const [handle, setHandle] = useState('')
  const [locale, setLocale] = useState<InstagramLocale>(availableLocales[0] ?? 'all')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!handle.trim()) return
    setAdding(true)
    setError(null)
    const { addInstagramAccount } = await import('../actions')
    const res = await addInstagramAccount({ handle: handle.trim(), locale })
    setAdding(false)
    if (!res.ok) { setError(res.error); return }
    setHandle('')
    onAdded()
  }

  if (availableLocales.length === 0) return null

  return (
    <div className={sectionCls()} data-testid="ig-add-form">
      <h3 className="text-sm font-medium text-slate-300">Add Instagram Account</h3>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className={labelCls()}>Handle</label>
          <input
            type="text"
            value={handle}
            onChange={e => { setHandle(e.target.value); setError(null) }}
            placeholder="@bythiagofigueiredo"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls()}>Locale</label>
          <select
            data-testid="ig-add-locale"
            value={locale}
            onChange={e => setLocale(e.target.value as InstagramLocale)}
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableLocales.map(l => (
              <option key={l} value={l}>{l === 'all' ? 'All (PT + EN)' : l === 'pt' ? 'PT-BR' : 'EN'}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          data-testid="ig-add-submit"
          onClick={handleAdd}
          disabled={adding || !handle.trim()}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add account'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
