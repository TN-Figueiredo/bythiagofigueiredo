'use client'

import {
  useState,
  useTransition,
} from 'react'
import { SlotManager } from '@/components/instagram/slot-manager'
import {
  useSaveState,
  SaveButton,
  labelCls,
  sectionCls,
} from './_shared'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface InstagramAccountData {
  id: string
  locale: 'pt' | 'en' | 'all'
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
  posts: { id: string; cached_image_url: string | null; caption: string | null }[]
  sync_logs: { mode: string; status: string; posts_found: number; posts_inserted: number; posts_updated: number; created_at: string; error_message: string | null }[]
  slots: { id: string; position: number; post_id: string | null; thumbnail_url: string | null; caption: string | null }[]
}

/* ------------------------------------------------------------------ */
/*  InstagramSection                                                  */
/* ------------------------------------------------------------------ */

export function InstagramSection({
  accounts: initialAccounts,
  readOnly,
}: {
  accounts: InstagramAccountData[]
  readOnly: boolean
}) {
  const [, startTransition] = useTransition()
  const [accounts, setAccounts] = useState(initialAccounts)

  const handleRemove = (accountId: string) => {
    if (!confirm('Remove this Instagram account and all synced posts?')) return
    startTransition(async () => {
      const { removeInstagramAccount } = await import('../actions')
      const res = await removeInstagramAccount({ accountId })
      if (res.ok) setAccounts(prev => prev.filter(a => a.id !== accountId))
      else alert(res.error)
    })
  }

  const handleAdded = (acc: InstagramAccountData) => {
    setAccounts(prev => [...prev, acc])
  }

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
          onRemove={() => handleRemove(account.id)}
        />
      ))}

      {accounts.length < 2 && !readOnly && (
        <AddInstagramForm
          existingLocales={accounts.map(a => a.locale)}
          onAdded={handleAdded}
        />
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
  onRemove,
}: {
  account: InstagramAccountData
  readOnly: boolean
  onRemove: () => void
}) {
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()
  const [accountLocale, setAccountLocale] = useState(account.locale)
  const [syncEnabled, setSyncEnabled] = useState(account.sync_enabled)
  const [displaySlots, setDisplaySlots] = useState(account.display_slots)
  const [layoutType, setLayoutType] = useState(account.layout_type)
  const [titlePt, setTitlePt] = useState(account.section_title_pt ?? '')
  const [titleEn, setTitleEn] = useState(account.section_title_en ?? '')
  const [subtitlePt, setSubtitlePt] = useState(account.section_subtitle_pt ?? '')
  const [subtitleEn, setSubtitleEn] = useState(account.section_subtitle_en ?? '')
  const [token, setToken] = useState('')
  const [syncing, setSyncing] = useState(false)

  const daysUntilExpiry = account.token_expires_at
    ? Math.ceil((new Date(account.token_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

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
    })
  }

  const handleSetToken = () => {
    if (!token.trim()) return
    startTransition(async () => {
      const { setInstagramToken } = await import('../actions')
      const res = await setInstagramToken({ accountId: account.id, accessToken: token.trim() })
      if (res.ok) { setToken(''); alert('Token saved') }
      else alert(res.error)
    })
  }

  const handleSync = () => {
    setSyncing(true)
    startTransition(async () => {
      const { triggerInstagramSync } = await import('../actions')
      const res = await triggerInstagramSync({ accountId: account.id })
      setSyncing(false)
      if (!res.ok) alert(res.error)
    })
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
    <div className="space-y-4">
      <form onSubmit={handleSaveSettings} className={sectionCls()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-slate-200">{account.handle}</h3>
            <select
              value={accountLocale}
              onChange={e => setAccountLocale(e.target.value as 'pt' | 'en' | 'all')}
              disabled={readOnly}
              className="rounded-md border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300"
            >
              <option value="all">All (PT + EN)</option>
              <option value="pt">PT-BR</option>
              <option value="en">EN</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || readOnly}
              className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            {!readOnly && (
              <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">
                Remove
              </button>
            )}
          </div>
        </div>

        {account.last_synced_at && (
          <p className="text-xs text-slate-500">
            Last sync: {new Date(account.last_synced_at).toLocaleString()}
          </p>
        )}

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

      <div className={sectionCls()}>
        <h4 className="text-sm font-medium text-slate-300">Access Token</h4>
        {daysUntilExpiry !== null && (
          <p className={`text-xs ${daysUntilExpiry < 7 ? 'text-amber-400' : 'text-slate-500'}`}>
            Expires in {daysUntilExpiry} days
          </p>
        )}
        {!readOnly && (
          <div className="flex items-end gap-2">
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
        )}
      </div>

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
  onAdded: (acc: InstagramAccountData) => void
}) {
  const [handle, setHandle] = useState('')
  const [locale, setLocale] = useState<'pt' | 'en' | 'all'>(
    existingLocales.includes('all') ? (existingLocales.includes('pt') ? 'en' : 'pt') : 'all',
  )
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableLocales = (['all', 'pt', 'en'] as const).filter(l => !existingLocales.includes(l))

  const handleAdd = async () => {
    if (!handle.trim()) return
    setAdding(true)
    setError(null)
    const { addInstagramAccount } = await import('../actions')
    const res = await addInstagramAccount({ handle: handle.trim(), locale })
    setAdding(false)
    if (!res.ok) { setError(res.error); return }
    onAdded({
      id: crypto.randomUUID(),
      handle: handle.trim(),
      locale,
      sync_enabled: true,
      display_slots: 6,
      layout_type: 'grid',
      section_title_pt: null,
      section_title_en: null,
      section_subtitle_pt: null,
      section_subtitle_en: null,
      last_synced_at: null,
      token_expires_at: null,
      posts: [],
      sync_logs: [],
      slots: [],
    })
    setHandle('')
  }

  return (
    <div className={sectionCls()}>
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
            value={locale}
            onChange={e => setLocale(e.target.value as 'pt' | 'en' | 'all')}
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableLocales.map(l => (
              <option key={l} value={l}>{l === 'all' ? 'All (PT + EN)' : l === 'pt' ? 'PT-BR' : 'EN'}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !handle.trim()}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Connect'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
