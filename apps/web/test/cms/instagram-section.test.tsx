// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'

const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: routerRefresh }) }))
vi.mock('@/components/instagram/slot-manager', () => ({ SlotManager: () => <div data-testid="slot-manager" /> }))
vi.mock('@/lib/instagram/status-text', () => ({
  kindFrom: (row: { token_error: string | null }) =>
    row.token_error === null ? 'transient'
      : row.token_error === 'expired' ? 'expired'
      : row.token_error === 'deauthorized' || row.token_error === 'data_deletion_requested' ? 'revoked'
      : 'invalid',
  oauthErrorText: (code: string) =>
    code === 'not_configured'
      ? "Instagram OAuth isn't configured yet — see the setup runbook"
      : `error:${code}`,
  previewDisabledText: () => 'Instagram authorization is disabled on preview deployments — use production.',
  RECONNECT_CTA: 'reconnect',
}))

const mockRebind = vi.fn()
const mockDismiss = vi.fn()
const mockDisconnect = vi.fn()
const mockTriggerSync = vi.fn()
const mockRemove = vi.fn()
const mockUpdateSettings = vi.fn()
const mockSetToken = vi.fn()
const mockUpdateSlots = vi.fn()
const mockAdd = vi.fn(async () => ({ ok: true }))
vi.mock('@/app/cms/(authed)/settings/actions', () => ({
  authorizeInstagramRebind: (...a: unknown[]) => mockRebind(...a),
  dismissInstagramHandleMismatch: (...a: unknown[]) => mockDismiss(...a),
  disconnectInstagramAccount: (...a: unknown[]) => mockDisconnect(...a),
  triggerInstagramSync: (...a: unknown[]) => mockTriggerSync(...a),
  removeInstagramAccount: (...a: unknown[]) => mockRemove(...a),
  updateInstagramSettings: (...a: unknown[]) => mockUpdateSettings(...a),
  setInstagramToken: (...a: unknown[]) => mockSetToken(...a),
  updateInstagramSlots: (...a: unknown[]) => mockUpdateSlots(...a),
  addInstagramAccount: (...a: unknown[]) => mockAdd(...(a as [])),
}))

import { InstagramSection } from '@/app/cms/(authed)/settings/_sections/instagram'

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString()

function account(over: Record<string, unknown> = {}) {
  return {
    id: 'acc-1', locale: 'pt' as const, handle: 'thiago.figueiredo',
    sync_enabled: true, display_slots: 6, layout_type: 'grid' as const,
    section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: ago(3600_000), token_expires_at: ahead(40 * DAY),
    token_error: null, token_error_at: null, token_error_mode: null,
    token_refreshed_at: ago(2 * DAY), token_alert_sent_at: null,
    ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' as const,
    connected: true, posts: [], sync_logs: [], slots: [],
    ...over,
  }
}

function renderSection(over: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  return render(
    <InstagramSection
      accounts={[account(over)] as never}
      readOnly={false}
      oauthConfigured
      isPreview={false}
      missingInstagramEnv={[]}
      handleMismatch={null}
      siteTimezone="America/Sao_Paulo"
      {...props}
    />,
  )
}

const statusText = () => screen.getByTestId('ig-status-text').textContent ?? ''

describe('<InstagramSection> — the six states', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Never connected', () => {
    renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    expect(statusText()).toBe('Not connected')
  })
  it('Invalid — expired', () => {
    renderSection({ token_error: 'expired', token_error_at: ago(2 * DAY) })
    expect(statusText()).toContain('Token expired (since ')
  })
  it('Invalid — revoked', () => {
    renderSection({ token_error: 'deauthorized', token_error_at: ago(DAY) })
    expect(statusText()).toContain('Instagram access was revoked (since ')
  })
  it('Invalid — data deletion', () => {
    renderSection({ token_error: 'data_deletion_requested', token_error_at: ago(DAY) })
    expect(statusText()).toContain('the cached feed was deleted')
  })
  it('Invalid — machine reason falls back and keeps the raw value only in title=', () => {
    renderSection({ token_error: 'Instagram API 403', token_error_at: ago(DAY) })
    expect(statusText()).toContain('Token invalid (since ')
    expect(statusText()).not.toContain('Instagram API 403')
    expect(screen.getByTestId('ig-status-text').getAttribute('title')).toBe('Instagram API 403')
  })
  it('Retrying — subject and the 69 h flip', () => {
    renderSection({ token_expires_at: null, token_error_at: ago(68 * 3600_000), token_error_mode: 'daily' })
    expect(statusText()).toContain('Feed sync has been failing since ')
    expect(statusText()).toContain('it keeps retrying daily')
  })
  it('Renewal pending', () => {
    renderSection({ token_expires_at: null })
    expect(statusText()).toBe('Connected · expiry unknown — the daily check will renew it within two days')
  })
  it('Expiring beats Retrying and appends the open episode', () => {
    renderSection({ token_expires_at: ahead(3 * DAY), token_error_at: ago(4 * DAY) })
    expect(statusText()).toContain('Expires in 3 days')
    expect(statusText()).toContain(' (auto-renewal has been failing since ')
  })
  it('Connected — with last renewal, expiry and last sync', () => {
    renderSection()
    expect(statusText()).toContain('Connected · renews automatically · last renewal 2 days ago')
    expect(statusText()).toContain('Expires in 40 days')
    expect(statusText()).toContain('last sync 1 hour ago')
  })
  it('Connected — first sync failed', () => {
    renderSection({
      last_synced_at: null,
      token_refreshed_at: ago(120_000),
      sync_logs: [{ mode: 'manual', status: 'failed', posts_found: 0, posts_inserted: 0, posts_updated: 0, created_at: ago(60_000), error_message: 'boom' }],
    })
    expect(statusText()).toBe('Connected, but the first sync failed — the daily check will retry. See the runbook.')
  })
  it('never renders NaN, Invalid Date or "in 1 days"', () => {
    for (const over of [{}, { token_expires_at: null }, { token_error: 'expired', token_error_at: null }]) {
      const { unmount } = renderSection(over)
      const t = statusText()
      expect(t).not.toContain('NaN')
      expect(t).not.toContain('Invalid Date')
      expect(t).not.toMatch(/in 1 days/)
      unmount()
    }
  })
})

describe('<InstagramSection> — modifiers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Syncing replaces only the last-sync tail and suppresses Stale', () => {
    renderSection({
      last_synced_at: ago(60 * 3600_000),
      token_refreshed_at: ago(120_000),
      sync_logs: [{ mode: 'manual', status: 'started', posts_found: 0, posts_inserted: 0, posts_updated: 0, created_at: ago(60_000), error_message: 'detail: instagram_business_basic' }],
    })
    expect(statusText()).toContain('Syncing your feed…')
    expect(statusText()).toContain('last renewal')
    expect(screen.queryByTestId('ig-badge-stale')).toBeNull()
  })

  it('Stale shows at 49 h and hides at 47 h, with an episode, with auto-sync off and when disconnected', () => {
    const shown = renderSection({ last_synced_at: ago(49 * 3600_000) })
    expect(screen.getByTestId('ig-badge-stale')).toBeTruthy()
    shown.unmount()
    for (const over of [
      { last_synced_at: ago(47 * 3600_000) },
      { last_synced_at: ago(49 * 3600_000), token_error_at: ago(3 * DAY), token_expires_at: null },
      { last_synced_at: ago(49 * 3600_000), sync_enabled: false },
      { last_synced_at: ago(49 * 3600_000), connected: false },
    ]) {
      const { unmount } = renderSection(over)
      expect(screen.queryByTestId('ig-badge-stale')).toBeNull()
      unmount()
    }
  })

  it('Stale never renders in Invalid, Retrying or Never connected', () => {
    for (const over of [
      { last_synced_at: ago(49 * 3600_000), token_error: 'expired', token_error_at: ago(DAY) },
      { last_synced_at: ago(49 * 3600_000), token_error_at: ago(DAY), token_expires_at: null },
      { last_synced_at: ago(49 * 3600_000), connected: false },
    ]) {
      const { unmount } = renderSection(over)
      expect(screen.queryByTestId('ig-badge-stale')).toBeNull()
      unmount()
    }
  })

  it('Auto-sync off shows the badge plus the enable button, and ONLY the badge in Never connected', () => {
    const on = renderSection({ sync_enabled: false })
    expect(screen.getByTestId('ig-badge-autosync-off').textContent).toBe('Auto-sync off')
    expect(screen.getByTestId('ig-enable-autosync').textContent).toBe('Enable auto-sync')
    on.unmount()

    const { unmount } = renderSection({ sync_enabled: false, connected: false, token_expires_at: null })
    expect(screen.getByTestId('ig-badge-autosync-off')).toBeTruthy()
    expect(screen.queryByTestId('ig-enable-autosync')).toBeNull()
    unmount()
  })

  it('Preview wins over Not configured and disables the OAuth buttons with that title', () => {
    renderSection({}, { isPreview: true, oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_ID'] })
    expect(screen.getByTestId('ig-badge-preview').textContent).toBe('Preview')
    expect(screen.getByText('Instagram authorization is disabled on preview deployments — use production.')).toBeTruthy()
    expect(screen.queryByTestId('ig-badge-not-configured')).toBeNull()
    expect(screen.getByTestId('ig-paste-details').hasAttribute('open')).toBe(true)
    expect(within(screen.getByTestId('ig-paste-details')).getByText('Paste token manually')).toBeTruthy()
  })

  it('Preview alone makes pasting primary even when OAuth is configured', () => {
    renderSection({}, { isPreview: true })
    const details = screen.getByTestId('ig-paste-details')
    expect(details.hasAttribute('open')).toBe(true)
    expect(within(details).getByText('Paste token manually')).toBeTruthy()
  })

  it('Not configured names the missing envs (names only) and makes pasting primary', () => {
    renderSection({}, { oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_SECRET', 'SOCIAL_MASTER_KEY'] })
    const badge = screen.getByTestId('ig-badge-not-configured')
    expect(badge.textContent).toContain("Instagram OAuth isn't configured yet — see the setup runbook")
    expect(badge.getAttribute('title')).toBe('INSTAGRAM_APP_SECRET, SOCIAL_MASTER_KEY')
    expect(screen.getByTestId('ig-paste-details').hasAttribute('open')).toBe(true)
  })

  it('keeps the paste fallback closed and labelled "(fallback)" when OAuth works', () => {
    renderSection()
    const details = screen.getByTestId('ig-paste-details')
    expect(details.hasAttribute('open')).toBe(false)
    expect(within(details).getByText('Paste token manually (fallback)')).toBeTruthy()
  })

  it('readOnly hides every control, keeps badges and adds the permission note in Invalid/Retrying', () => {
    renderSection({ token_error: 'expired', token_error_at: ago(DAY), sync_enabled: false }, { readOnly: true })
    expect(screen.getByTestId('ig-badge-autosync-off')).toBeTruthy()
    expect(screen.getByTestId('ig-readonly-note').textContent)
      .toBe("You don't have permission to reconnect — ask a site admin.")
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByTestId('ig-paste-details')).toBeNull()
    expect(screen.getByTestId('ig-locale-select').hasAttribute('disabled')).toBe(true)
  })

  it('readOnly with zero accounts renders no add form', () => {
    render(<InstagramSection accounts={[]} readOnly oauthConfigured siteTimezone="UTC" />)
    expect(screen.queryByTestId('ig-add-form')).toBeNull()
  })

  it('derives `connected` per row instead of per site', () => {
    render(
      <InstagramSection
        accounts={[account({ id: 'a', locale: 'pt', connected: true }), account({ id: 'b', locale: 'en', connected: false, token_expires_at: null, last_synced_at: null })] as never}
        readOnly={false}
        oauthConfigured
        siteTimezone="UTC"
      />,
    )
    const texts = screen.getAllByTestId('ig-status-text').map((n) => n.textContent)
    expect(texts[0]).toContain('Connected · renews automatically')
    expect(texts[1]).toBe('Not connected')
  })

  it('offers only non-conflicting locales in the row select', () => {
    render(
      <InstagramSection
        accounts={[account({ id: 'a', locale: 'pt' }), account({ id: 'b', locale: 'en' })] as never}
        readOnly={false}
        oauthConfigured
        siteTimezone="UTC"
      />,
    )
    const first = screen.getAllByTestId('ig-locale-select')[0] as HTMLSelectElement
    expect([...first.options].map((o) => o.value)).toEqual(['pt'])
  })
})

/**
 * Alcançabilidade da matriz de §3.5: 6 estados × 8 modificadores = 48 células,
 * 44 alcançáveis (o texto do estado fica INALTERADO e o modificador aparece),
 * 4 inalcançáveis viram asserções negativas nomeadas e 1 das 44 é a exceção
 * `Auto-sync off` × *Never connected* (só o badge).
 */
describe('<InstagramSection> — reachability matrix (44 + 4 negatives + 1 exception)', () => {
  const STATES = {
    invalid: { token_error: 'expired', token_error_at: ago(2 * DAY) },
    'never-connected': { connected: false, token_expires_at: null, last_synced_at: null },
    expiring: { token_expires_at: ahead(3 * DAY) },
    retrying: { token_expires_at: null, token_error_at: ago(4 * DAY), token_error_mode: 'daily' },
    'renewal-pending': { token_expires_at: null },
    connected: {},
  } as const
  const MODIFIERS = [
    'none', 'readOnly', 'preview', 'not-configured', 'autosync-off', 'stale', 'syncing', 'in-progress',
  ] as const

  /** As 4 células inalcançáveis de §3.5, nomeadas: o modificador NÃO aparece. */
  const UNREACHABLE = new Set([
    'stale/invalid', 'stale/retrying', 'stale/never-connected', 'syncing/never-connected',
  ])

  const overridesFor = (mod: typeof MODIFIERS[number]) => {
    if (mod === 'autosync-off') return { sync_enabled: false }
    if (mod === 'stale') return { last_synced_at: ago(49 * 3600_000) }
    if (mod === 'syncing') return {
      token_refreshed_at: ago(120_000),
      sync_logs: [{ mode: 'manual', status: 'started', posts_found: 0, posts_inserted: 0, posts_updated: 0, created_at: ago(60_000), error_message: 'detail: instagram_business_basic' }],
    }
    return {}
  }
  const propsFor = (mod: typeof MODIFIERS[number]) => {
    if (mod === 'readOnly') return { readOnly: true }
    if (mod === 'preview') return { isPreview: true }
    if (mod === 'not-configured') return { oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_ID'] }
    return {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', vi.fn(() => ({ closed: false, close: vi.fn(), location: { href: '' } })))
  })

  it('renders all 48 cells without crashing and keeps the state text unchanged in the 44 reachable ones', () => {
    let reachable = 0
    let unreachable = 0
    for (const [state, stateOver] of Object.entries(STATES)) {
      const baseline = (() => {
        const r = renderSection(stateOver as never)
        const t = statusText()
        r.unmount()
        return t
      })()
      for (const mod of MODIFIERS) {
        const r = renderSection({ ...stateOver, ...overridesFor(mod) } as never, propsFor(mod))
        const text = () => r.getByTestId('ig-status-text').textContent ?? ''
        if (UNREACHABLE.has(`${mod}/${state}`)) {
          // Célula nomeada como inalcançável: o modificador não pode aparecer.
          if (mod === 'stale') expect(r.queryByTestId('ig-badge-stale')).toBeNull()
          else expect(text()).not.toContain('Syncing your feed…')
          unreachable++
          r.unmount()
          continue
        }
        if (mod === 'in-progress') {
          fireEvent.click((r.queryByTestId('ig-reconnect') ?? r.getByTestId('ig-connect')) as HTMLElement)
          expect(r.getByTestId('ig-inprogress')).toBeTruthy()
        }
        if (mod === 'stale') expect(r.getByTestId('ig-badge-stale')).toBeTruthy()
        // A cauda `Syncing your feed…` só existe na frase de *Connected* — nos
        // demais estados a linha de sync não é dita, e dizê-la seria mentira
        // (o texto do estado é o que manda).
        if (mod === 'syncing') {
          if (state === 'connected') expect(text()).toContain('Syncing your feed…')
          else expect(text()).not.toContain('Syncing your feed…')
        }
        // O texto do estado é preservado; só a cauda "last sync" muda sob `Syncing`.
        if (mod !== 'syncing' && mod !== 'stale') expect(text()).toBe(baseline)
        reachable++
        r.unmount()
      }
    }
    expect(reachable).toBe(44)
    expect(unreachable).toBe(4)
  })

  it('names the 4 unreachable cells: Stale in Invalid/Retrying/Never connected and Syncing in Never connected', () => {
    for (const state of ['invalid', 'retrying', 'never-connected'] as const) {
      const r = renderSection({ ...STATES[state], last_synced_at: ago(49 * 3600_000) } as never)
      expect(r.queryByTestId('ig-badge-stale')).toBeNull()
      r.unmount()
    }
    const never = renderSection({ ...STATES['never-connected'], ...overridesFor('syncing') } as never)
    expect(statusText()).toBe('Not connected')
    expect(statusText()).not.toContain('Syncing your feed…')
    expect(never.queryByTestId('ig-sync-now')).toBeNull()
    never.unmount()
  })

  it('names the 1 exception: Auto-sync off × Never connected is badge-only', () => {
    renderSection({ ...STATES['never-connected'], sync_enabled: false } as never)
    expect(screen.getByTestId('ig-badge-autosync-off')).toBeTruthy()
    expect(screen.queryByTestId('ig-enable-autosync')).toBeNull()
  })

  it('readOnly across every state renders no button, no paste block, no banner and no spinner', () => {
    for (const stateOver of Object.values(STATES)) {
      const r = renderSection(stateOver as never, {
        readOnly: true, handleMismatch: { accountId: 'acc-1', authorizedHandle: 'x' },
      })
      expect(r.queryAllByRole('button')).toHaveLength(0)
      expect(r.queryByTestId('ig-paste-details')).toBeNull()
      expect(r.queryByTestId('ig-mismatch-banner')).toBeNull()
      expect(r.queryByTestId('ig-inprogress')).toBeNull()
      r.unmount()
    }
  })

  it('Expiring with an open episode keeps the countdown AND makes Reconnect primary', () => {
    renderSection({ token_expires_at: ahead(3 * DAY), token_error_at: ago(4 * DAY) })
    expect(statusText()).toContain('Expires in 3 days')
    expect(statusText()).toContain(' (auto-renewal has been failing since ')
    expect(screen.getByTestId('ig-reconnect').className).toContain('bg-indigo-500')
  })

  it('Retrying under 69 h keeps Reconnect secondary', () => {
    renderSection({ token_expires_at: null, token_error_at: ago(68 * 3600_000), token_error_mode: 'daily' })
    expect(screen.getByTestId('ig-reconnect').className).not.toContain('bg-indigo-500')
  })
})

function fakeWindow() {
  return { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window & {
    closed: boolean; close: ReturnType<typeof vi.fn>; location: { href: string }
  }
}

function postResult(data: Record<string, unknown>, origin = window.location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }))
  })
}

describe('<InstagramSection> — OAuth actions', () => {
  let win: ReturnType<typeof fakeWindow>

  beforeEach(() => {
    vi.clearAllMocks()
    win = fakeWindow()
    vi.stubGlobal('open', vi.fn(() => win))
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('offers Connect with Instagram once in Never connected, with no force_reauth', () => {
    renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    const btn = screen.getByTestId('ig-connect')
    expect(screen.getAllByTestId('ig-connect')).toHaveLength(1)
    expect(btn.textContent).toBe('Connect with Instagram')
    fireEvent.click(btn)
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1')
    expect(win.location.href).not.toContain('force_reauth')
  })

  it('offers Reconnect once connected and "Connect a different account" with different=1', () => {
    const invalid = renderSection({ token_error: 'expired', token_error_at: ago(DAY) })
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1')
    invalid.unmount()

    const { unmount } = renderSection()
    fireEvent.click(screen.getAllByTestId('ig-different')[0] as HTMLElement)
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1&different=1')
    unmount()
  })

  it('opens the window BEFORE awaiting and enters In progress, disabling the six named actions', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    expect(window.open).toHaveBeenCalledWith('about:blank', 'ig-oauth', expect.any(String))
    expect(screen.getByTestId('ig-inprogress').textContent).toContain('Still waiting for Instagram.')
    for (const id of ['ig-reconnect', 'ig-different', 'ig-sync-now', 'ig-disconnect']) {
      const el = screen.queryByTestId(id) as HTMLButtonElement | null
      expect(el).not.toBeNull()
      if (el) expect(el.disabled).toBe(true)
    }
    expect((screen.getByTestId('ig-remove') as HTMLButtonElement).disabled).toBe(false)
  })

  it('two clicks on Connect with Instagram start a single flow', () => {
    renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    const btn = screen.getByTestId('ig-connect') as HTMLButtonElement
    fireEvent.click(btn)
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(window.open).toHaveBeenCalledTimes(1)
  })

  it('navigates the current tab when the popup is blocked, confirming only when the texts are dirty', () => {
    vi.stubGlobal('open', vi.fn(() => null))
    const hrefSetter = vi.fn()
    const realLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { origin: realLocation.origin, get href() { return '' }, set href(v: string) { hrefSetter(v) } },
      configurable: true,
      writable: true,
    })
    try {
      renderSection()
      fireEvent.click(screen.getByTestId('ig-reconnect'))
      expect(vi.mocked(confirm)).not.toHaveBeenCalled()
      expect(hrefSetter).toHaveBeenCalledWith('/api/instagram/oauth?account_id=acc-1')

      fireEvent.change(screen.getByPlaceholderText('do iPhone, sem filtro'), { target: { value: 'novo' } })
      fireEvent.click(screen.getByTestId('ig-reconnect'))
      expect(vi.mocked(confirm)).toHaveBeenCalledWith(
        'Leave this page to authorize with Instagram? Unsaved changes to the section texts will be lost.',
      )
    } finally {
      Object.defineProperty(window, 'location', { value: realLocation, configurable: true, writable: true })
    }
  })

  it('clears In progress and refreshes on a success message from the same origin', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({ type: 'instagram-oauth-result', success: true, provider: 'instagram' })
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
    expect(routerRefresh).toHaveBeenCalled()
  })

  it('ignores messages from another origin and of another type', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({ type: 'instagram-oauth-result', success: true }, 'https://evil.com')
    postResult({ type: 'social-oauth-result', success: true })
    expect(screen.getByTestId('ig-inprogress')).toBeTruthy()
    expect(routerRefresh).not.toHaveBeenCalled()
  })

  it('shows a persistent inline error with Try again and Dismiss, and does not refresh', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({
      type: 'instagram-oauth-result', success: false, provider: 'instagram',
      error: 'Instagram rejected the authorization (code 400)', code: 'exchange_failed',
    })
    expect(screen.getByTestId('ig-inline-error').textContent).toBe('Instagram rejected the authorization (code 400)')
    expect(routerRefresh).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('ig-try-again'))
    expect(window.open).toHaveBeenCalledTimes(2)

    postResult({ type: 'instagram-oauth-result', success: false, code: 'write_failed' })
    fireEvent.click(screen.getByTestId('ig-dismiss-error'))
    expect(screen.queryByTestId('ig-inline-error')).toBeNull()
  })

  it('falls back to oauthErrorText for a missing or oversized server message', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({ type: 'instagram-oauth-result', success: false, error: 'x'.repeat(201), code: 'invalid_state' })
    expect(screen.getByTestId('ig-inline-error').textContent).toBe('error:invalid_state')
  })

  it('enforces the 10-minute ceiling even with w.closed === false', () => {
    vi.useFakeTimers()
    try {
      renderSection()
      fireEvent.click(screen.getByTestId('ig-reconnect'))
      act(() => { vi.advanceTimersByTime(10 * 60_000 + 1000) })
      expect(screen.queryByTestId('ig-inprogress')).toBeNull()
      expect(screen.getByTestId('ig-inline-error').textContent).toBe("Authorization didn't finish — try again")
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears early on visibilitychange when the window was closed', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    win.closed = true
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
  })

  it('clears early when the window regains focus after the popup closed', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    win.closed = true
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
    expect(screen.queryByTestId('ig-inline-error')).toBeNull()
  })

  it('Cancel clears immediately and closes the window, with no error text', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    fireEvent.click(screen.getByTestId('ig-cancel'))
    expect(win.close).toHaveBeenCalled()
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
    expect(screen.queryByTestId('ig-inline-error')).toBeNull()
  })

  it('renders the mismatch banner with both handles and one button', async () => {
    mockRebind.mockResolvedValue({ ok: true, rebind: 'signed-rebind' })
    renderSection({}, { handleMismatch: { accountId: 'acc-1', authorizedHandle: 'other.account' } })
    expect(screen.getByTestId('ig-mismatch-banner').textContent)
      .toContain('You authorized @other.account; this CMS account is @thiago.figueiredo')
    const btn = screen.getByTestId('ig-rebind')
    expect(btn.textContent).toBe('Use @other.account for this account and reconnect')

    await act(async () => { fireEvent.click(btn) })
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(mockRebind).toHaveBeenCalledWith({ accountId: 'acc-1' })
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1&rebind=signed-rebind')
    expect(win.location.href).not.toContain('force_reauth')
  })

  it('closes the window and shows the error when the rebind action fails', async () => {
    mockRebind.mockResolvedValue({ ok: false, error: 'error:invalid_state' })
    renderSection({}, { handleMismatch: { accountId: 'acc-1', authorizedHandle: 'other.account' } })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-rebind')) })
    expect(win.close).toHaveBeenCalled()
    expect(screen.getByTestId('ig-inline-error').textContent).toBe('error:invalid_state')
  })

  it('Cancel on the banner dismisses the cookie', async () => {
    mockDismiss.mockResolvedValue({ ok: true })
    renderSection({}, { handleMismatch: { accountId: 'acc-1', authorizedHandle: 'other.account' } })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-mismatch-cancel')) })
    expect(mockDismiss).toHaveBeenCalled()
  })

  it('renders no banner for a cookie that belongs to another row', () => {
    renderSection({}, { handleMismatch: { accountId: 'other-acc', authorizedHandle: 'x' } })
    expect(screen.queryByTestId('ig-mismatch-banner')).toBeNull()
  })

  it('renders no banner and no OAuth buttons under readOnly', () => {
    renderSection({}, { readOnly: true, handleMismatch: { accountId: 'acc-1', authorizedHandle: 'x' } })
    expect(screen.queryByTestId('ig-mismatch-banner')).toBeNull()
    expect(screen.queryByTestId('ig-reconnect')).toBeNull()
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
  })

  it('disables the OAuth buttons on preview and when not configured, with the right title', () => {
    const preview = renderSection({}, { isPreview: true })
    expect((screen.getByTestId('ig-reconnect') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('ig-reconnect').getAttribute('title'))
      .toBe('Instagram authorization is disabled on preview deployments — use production.')
    preview.unmount()

    const { unmount } = renderSection({}, { oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_ID'] })
    expect((screen.getByTestId('ig-reconnect') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('ig-reconnect').getAttribute('title'))
      .toBe("Instagram OAuth isn't configured yet — see the setup runbook")
    unmount()
  })
})

describe('<InstagramSection> — row actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', vi.fn(() => fakeWindow()))
    vi.stubGlobal('confirm', vi.fn(() => true))
    mockTriggerSync.mockResolvedValue({ ok: true })
    mockDisconnect.mockResolvedValue({ ok: true })
    mockRemove.mockResolvedValue({ ok: true })
  })

  it('hides Sync Now without a token and shows it once connected', () => {
    const never = renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    expect(screen.queryByTestId('ig-sync-now')).toBeNull()
    never.unmount()
    const { unmount } = renderSection()
    expect(screen.getByTestId('ig-sync-now')).toBeTruthy()
    unmount()
  })

  it('reports a partial sync inline', async () => {
    mockTriggerSync.mockResolvedValue({ ok: true, partial: true })
    renderSection()
    await act(async () => { fireEvent.click(screen.getByTestId('ig-sync-now')) })
    expect(screen.getByTestId('ig-sync-note').textContent)
      .toBe('Synced part of the feed — run Sync Now again to finish')
  })

  it('uses the two Disconnect confirm texts and hides it only in Never connected with no episode', async () => {
    const synced = renderSection()
    await act(async () => { fireEvent.click(screen.getByTestId('ig-disconnect')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(
      'Disconnect this Instagram account? Alerts stop and the feed keeps the posts already synced, but it stops receiving new ones until you reconnect. This does not revoke the app on Instagram.',
    )
    expect(mockDisconnect).toHaveBeenCalledWith({ accountId: 'acc-1' })
    synced.unmount()

    vi.mocked(confirm).mockClear()
    const never = renderSection({ last_synced_at: null })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-disconnect')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(
      'Disconnect this Instagram account? Alerts stop and the account stays configured with no posts until you reconnect. This does not revoke the app on Instagram.',
    )
    never.unmount()

    vi.mocked(confirm).mockClear()
    const deleted = renderSection({ token_error: 'data_deletion_requested', token_error_at: ago(DAY), connected: false })
    expect(screen.getByTestId('ig-disconnect')).toBeTruthy()   // Invalid sem token ainda mostra
    await act(async () => { fireEvent.click(screen.getByTestId('ig-disconnect')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(expect.stringContaining('stays configured with no posts'))
    deleted.unmount()

    const hidden = renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    expect(screen.queryByTestId('ig-disconnect')).toBeNull()
    hidden.unmount()
  })

  it('mentions Disconnect in the Remove confirm only while Disconnect is visible', async () => {
    const connected = renderSection()
    await act(async () => { fireEvent.click(screen.getByTestId('ig-remove')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(
      'Remove this Instagram account and all synced posts? To keep the posts and only stop the alerts, use Disconnect.',
    )
    connected.unmount()

    vi.mocked(confirm).mockClear()
    const never = renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-remove')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith('Remove this Instagram account and all synced posts?')
    never.unmount()
  })

  it('offers the add form up to three accounts, labelled "Add account", with a safe initial locale', () => {
    const one = render(
      <InstagramSection accounts={[account({ id: 'a', locale: 'pt' })] as never} readOnly={false} oauthConfigured siteTimezone="UTC" />,
    )
    expect((screen.getByTestId('ig-add-locale') as HTMLSelectElement).value).toBe('en')
    expect(screen.getByTestId('ig-add-submit').textContent).toBe('Add account')
    one.unmount()

    const two = render(
      <InstagramSection
        accounts={[account({ id: 'a', locale: 'pt' }), account({ id: 'b', locale: 'en' })] as never}
        readOnly={false} oauthConfigured siteTimezone="UTC"
      />,
    )
    expect(two.queryByTestId('ig-add-form')).toBeNull()      // nenhum locale livre
    two.unmount()
  })

  it('refreshes from the server after adding instead of inventing a client id', async () => {
    render(<InstagramSection accounts={[]} readOnly={false} oauthConfigured siteTimezone="UTC" />)
    fireEvent.change(screen.getByPlaceholderText('@bythiagofigueiredo'), { target: { value: '@x' } })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-add-submit')) })
    expect(routerRefresh).toHaveBeenCalled()
    expect(screen.queryAllByTestId('ig-card')).toHaveLength(0)
  })
})
