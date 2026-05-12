'use client'

import {
  useState,
  useCallback,
  useEffect,
  useTransition,
  type FormEvent,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { deriveScheduleLabel } from '@/lib/youtube/schedule-label'
import {
  updateBranding,
  updateIdentity,
  updateSeoDefaults,
  updateNewsletterType,
  createNewsletterType,
  deleteNewsletterType,
  updateBlogCadence,
  updateSiteLocales,
  updateSiteTimezone,
  disableCms,
  deleteSite,
  updateYouTubeChannelSettings,
  lookupYouTubeChannel,
  addYouTubeChannel,
  removeYouTubeChannel,
  updateContactHeroText,
  updateContactHeroDisplay,
  updateContactSocial,
  updateContactFormSettings,
  updateContactFormText,
  updateContactFaq,
  updateContactVisibility,
} from './actions'
import { getDefaultSettings, DEFAULT_VISIBILITY } from '@/lib/contact/defaults'
import type { ContactPageSettings, ContactPageVisibility } from '@/lib/contact/types'
import { TimezonePicker } from './_components/timezone-picker'
import { DualClockCards } from './_components/dual-clock-cards'
import { SlotManager } from '@/components/instagram/slot-manager'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface SiteData {
  id: string
  logo_url: string | null
  primary_color: string | null
  identity_type: string
  twitter_handle: string | null
  seo_default_og_image: string | null
  supported_locales: string[]
  default_locale: string
  cms_enabled: boolean
  slug: string
  timezone: string
}

interface NewsletterTypeData {
  id: string
  name: string
  cadence_days: number | null
  preferred_send_time: string | null
  cadence_paused: boolean
  sort_order: number
  sender_name: string | null
  sender_email: string | null
  reply_to: string | null
  color: string | null
}

interface BlogCadenceData {
  locale: string
  cadence_days: number | null
  preferred_send_time: string | null
  cadence_start_date: string | null
}

interface SeoFlags {
  aiCrawlersBlocked: boolean
}

interface YouTubeChannelData {
  id: string
  name: string
  handle: string
  locale: string
  sync_enabled: boolean
  sync_schedules: Array<{
    day: string
    hour: number
    tz: string
    label: string
  }> | null
  schedule_label: string | null
}

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

interface Props {
  site: SiteData
  newsletterTypes: NewsletterTypeData[]
  blogCadence: BlogCadenceData[]
  youtubeChannels?: YouTubeChannelData[]
  instagramAccounts?: InstagramAccountData[]
  contactSettings?: Record<string, unknown>[]
  contactVisibility?: Record<string, unknown> | null
  defaultAuthor?: Record<string, unknown> | null
  initialSection: string
  seoFlags?: SeoFlags
  readOnly?: boolean
}

type SectionId =
  | 'branding'
  | 'seo'
  | 'newsletters'
  | 'blog-cadence'
  | 'youtube'
  | 'instagram'
  | 'contact-page'
  | 'localization'
  | 'danger-zone'

type SaveState = 'idle' | 'saving' | 'success' | 'error'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'seo', label: 'SEO' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'blog-cadence', label: 'Blog Cadence' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'contact-page', label: 'Contact Page' },
  { id: 'localization', label: 'Localization' },
  { id: 'danger-zone', label: 'Danger Zone' },
]

const CADENCE_OPTIONS = [
  { value: '', label: 'None' },
  { value: '1', label: 'Daily' },
  { value: '7', label: 'Weekly' },
  { value: '14', label: 'Biweekly' },
  { value: '30', label: 'Monthly' },
]

const LOCALE_OPTIONS = [
  'pt-BR',
  'en',
  'es',
  'fr',
  'de',
  'it',
  'ja',
  'ko',
  'zh',
]

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */

function useSaveState(): [SaveState, (s: SaveState) => void] {
  const [state, setState] = useState<SaveState>('idle')
  useEffect(() => {
    if (state === 'success') {
      const t = setTimeout(() => setState('idle'), 2000)
      return () => clearTimeout(t)
    }
  }, [state])
  return [state, setState]
}

function SaveButton({
  state,
  label = 'Save',
  disabled = false,
}: {
  state: SaveState
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={state === 'saving' || disabled}
      className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
    >
      {state === 'saving' && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      )}
      {state === 'success' ? 'Salvo' : label}
    </button>
  )
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-400">{message}</p>
}

function ReadOnlyBanner() {
  return (
    <div className="mb-4 rounded-md border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
      You have read-only access to settings. Contact an admin to make changes.
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full rounded-md border px-3 py-2 text-sm bg-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    hasError ? 'border-red-500' : 'border-slate-600'
  }`
}

function labelCls() {
  return 'block text-sm font-medium text-slate-300 mb-1'
}

function sectionCls() {
  return 'space-y-6 rounded-lg border border-slate-700 bg-slate-800/50 p-6'
}

/* ------------------------------------------------------------------ */
/*  Section: Branding                                                 */
/* ------------------------------------------------------------------ */

function BrandingSection({
  site,
  readOnly,
}: {
  site: SiteData
  readOnly: boolean
}) {
  const [logoUrl, setLogoUrl] = useState(site.logo_url ?? '')
  const [primaryColor, setPrimaryColor] = useState(
    site.primary_color ?? '#000000',
  )
  const [identityType, setIdentityType] = useState(site.identity_type)
  const [twitterHandle, setTwitterHandle] = useState(
    site.twitter_handle ?? '',
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (logoUrl && !logoUrl.startsWith('https://')) {
      e.logo_url = 'Must start with https://'
    }
    if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      e.primary_color = 'Must be a valid hex color (e.g. #1a2b3c)'
    }
    if (twitterHandle && !/^[A-Za-z0-9_]{1,15}$/.test(twitterHandle)) {
      e.twitter_handle = 'Must be 1-15 alphanumeric characters'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }, [logoUrl, primaryColor, twitterHandle])

  const handleSubmit = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
      if (readOnly) return
      if (!validate()) return
      setSaveState('saving')
      startTransition(async () => {
        const [brandRes, identRes] = await Promise.all([
          updateBranding({ logo_url: logoUrl, primary_color: primaryColor }),
          updateIdentity({
            identity_type: identityType,
            twitter_handle: twitterHandle,
          }),
        ])
        if (!brandRes.ok || !identRes.ok) {
          const errMsg =
            (!brandRes.ok ? brandRes.error : '') +
            (!identRes.ok ? identRes.error : '')
          setErrors({ _form: errMsg || 'Save failed' })
          setSaveState('error')
          return
        }
        setSaveState('success')
      })
    },
    [
      logoUrl,
      primaryColor,
      identityType,
      twitterHandle,
      validate,
      setSaveState,
      readOnly,
    ],
  )

  return (
    <form onSubmit={handleSubmit} className={sectionCls()}>
      <h2 className="text-lg font-semibold text-slate-100">Branding</h2>

      <div>
        <label htmlFor="logo-url" className={labelCls()}>
          Logo URL
        </label>
        <input
          id="logo-url"
          type="text"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
          className={inputCls(!!errors.logo_url)}
          disabled={readOnly}
        />
        <FieldError message={errors.logo_url} />
      </div>

      <div>
        <label htmlFor="primary-color" className={labelCls()}>
          Primary Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primary-color"
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#6366f1"
            className={inputCls(!!errors.primary_color) + ' flex-1'}
            disabled={readOnly}
          />
          <span
            className="inline-block h-8 w-8 shrink-0 rounded border border-slate-600"
            style={{
              backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(primaryColor)
                ? primaryColor
                : '#000',
            }}
            aria-label="Color preview"
          />
        </div>
        <FieldError message={errors.primary_color} />
      </div>

      <div>
        <span className={labelCls()}>Identity Type</span>
        <div className="mt-1 flex gap-4">
          {(['person', 'organization'] as const).map((type) => (
            <label
              key={type}
              className="inline-flex items-center gap-2 text-sm text-slate-300"
            >
              <input
                type="radio"
                name="identity_type"
                value={type}
                checked={identityType === type}
                onChange={() => setIdentityType(type)}
                className="accent-indigo-500"
                disabled={readOnly}
              />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="twitter-handle" className={labelCls()}>
          Twitter Handle
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            @
          </span>
          <input
            id="twitter-handle"
            type="text"
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
            placeholder="handle"
            className={inputCls(!!errors.twitter_handle) + ' pl-7'}
            disabled={readOnly}
          />
        </div>
        <FieldError message={errors.twitter_handle} />
      </div>

      <FieldError message={errors._form} />
      {!readOnly && <SaveButton state={saveState} />}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: SEO                                                      */
/* ------------------------------------------------------------------ */

function SeoSection({
  site,
  seoFlags,
  readOnly,
}: {
  site: SiteData
  seoFlags: SeoFlags
  readOnly: boolean
}) {
  const [ogImage, setOgImage] = useState(site.seo_default_og_image ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const featureFlags = [
    { key: 'AI Crawlers Blocked', enabled: seoFlags.aiCrawlersBlocked },
  ]

  const handleSubmit = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
      if (readOnly) return
      const e: Record<string, string> = {}
      if (ogImage && !ogImage.startsWith('https://')) {
        e.seo_default_og_image = 'Must start with https://'
      }
      setErrors(e)
      if (Object.keys(e).length > 0) return
      setSaveState('saving')
      startTransition(async () => {
        const res = await updateSeoDefaults({
          seo_default_og_image: ogImage || null,
        })
        if (!res.ok) {
          setErrors({ _form: res.error })
          setSaveState('error')
          return
        }
        setSaveState('success')
      })
    },
    [ogImage, setSaveState, readOnly],
  )

  return (
    <form onSubmit={handleSubmit} className={sectionCls()}>
      <h2 className="text-lg font-semibold text-slate-100">SEO</h2>

      <div>
        <label htmlFor="default-og-image" className={labelCls()}>
          Default OG Image
        </label>
        <input
          id="default-og-image"
          type="text"
          value={ogImage}
          onChange={(e) => setOgImage(e.target.value)}
          placeholder="https://example.com/og.png"
          className={inputCls(!!errors.seo_default_og_image)}
          disabled={readOnly}
        />
        <FieldError message={errors.seo_default_og_image} />
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Feature Flags (read-only)
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {featureFlags.map((flag) => (
            <div
              key={flag.key}
              className="flex items-center justify-between rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
            >
              <span className="text-sm text-slate-300">{flag.key}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  flag.enabled
                    ? 'bg-emerald-900/50 text-emerald-400'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {flag.enabled ? 'On' : 'Off'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">
          OG Image Precedence
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-400">
          <li>Per-post seo_extras.og_image_url</li>
          <li>cover_image_url from translation</li>
          <li>Dynamic OG route (if enabled)</li>
          <li>Site default OG image (above)</li>
          <li>/og-default.png fallback</li>
        </ol>
      </div>

      <FieldError message={errors._form} />
      {!readOnly && <SaveButton state={saveState} />}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Newsletters                                              */
/* ------------------------------------------------------------------ */

function NewslettersSection({
  newsletterTypes,
  readOnly,
}: {
  newsletterTypes: NewsletterTypeData[]
  readOnly: boolean
}) {
  const [types, setTypes] = useState(newsletterTypes)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useSaveState()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [pendingEdits, setPendingEdits] = useState<
    Record<
      string,
      {
        name?: string
        cadence_days?: number | null
        preferred_send_time?: string
        cadence_paused?: boolean
        sender_name?: string | null
        sender_email?: string | null
        reply_to?: string | null
        color?: string | null
        sort_order?: number
      }
    >
  >({})
  const [, startTransition] = useTransition()

  const handleFieldChange = useCallback(
    (id: string, field: keyof NewsletterTypeData, value: string | number | boolean | null) => {
      setPendingEdits((prev) => ({
        ...prev,
        [id]: { ...prev[id], [field]: value },
      }))
      setTypes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
      )
    },
    [],
  )

  const handleSaveType = useCallback(
    (id: string) => {
      const edits = pendingEdits[id]
      if (!edits || Object.keys(edits).length === 0) return
      setSaveState('saving')
      startTransition(async () => {
        const res = await updateNewsletterType(id, edits)
        if (!res.ok) {
          setSaveState('error')
          return
        }
        setPendingEdits((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setSaveState('success')
      })
    },
    [pendingEdits, setSaveState],
  )

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return
    setSaveState('saving')
    startTransition(async () => {
      const res = await createNewsletterType({
        name: newName.trim(),
        sort_order: types.length,
      })
      if (!res.ok) {
        setSaveState('error')
        return
      }
      setCreating(false)
      setNewName('')
      setSaveState('success')
    })
  }, [newName, types.length, setSaveState])

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (!window.confirm(`Delete newsletter type "${name}"? This cannot be undone.`))
        return
      setSaveState('saving')
      startTransition(async () => {
        const res = await deleteNewsletterType(id)
        if (!res.ok) {
          setSaveState('error')
          return
        }
        setTypes((prev) => prev.filter((t) => t.id !== id))
        setSaveState('success')
      })
    },
    [setSaveState],
  )

  return (
    <div className={sectionCls()}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Newsletters</h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
          >
            New Type
          </button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 p-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Type name"
            className={inputCls(false) + ' flex-1'}
            aria-label="New type name"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm text-white hover:bg-indigo-400"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false)
              setNewName('')
            }}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      )}

      {types.length === 0 && !creating && (
        <p className="text-sm text-slate-500">
          No newsletter types configured yet.
        </p>
      )}

      <div className="space-y-3">
        {types.map((nt) => (
          <div
            key={nt.id}
            className="rounded-md border border-slate-600 bg-slate-800"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedId(expandedId === nt.id ? null : nt.id)
              }
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                {nt.color && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: nt.color }}
                  />
                )}
                <span className="text-sm font-medium text-slate-200">
                  {nt.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    nt.cadence_paused
                      ? 'bg-amber-900/50 text-amber-400'
                      : 'bg-emerald-900/50 text-emerald-400'
                  }`}
                >
                  {nt.cadence_paused ? 'Paused' : 'Active'}
                </span>
                <span className="text-xs text-slate-500">
                  {expandedId === nt.id ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {expandedId === nt.id && (
              <div className="space-y-4 border-t border-slate-700 px-4 py-4">
                <div>
                  <label
                    htmlFor={`nt-cadence-${nt.id}`}
                    className={labelCls()}
                  >
                    Cadence
                  </label>
                  <select
                    id={`nt-cadence-${nt.id}`}
                    value={nt.cadence_days?.toString() ?? ''}
                    onChange={(e) =>
                      handleFieldChange(
                        nt.id,
                        'cadence_days',
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className={inputCls(false)}
                    disabled={readOnly}
                  >
                    {CADENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`nt-time-${nt.id}`}
                    className={labelCls()}
                  >
                    Preferred Send Time
                  </label>
                  <input
                    id={`nt-time-${nt.id}`}
                    type="time"
                    value={nt.preferred_send_time ?? '08:00'}
                    onChange={(e) =>
                      handleFieldChange(
                        nt.id,
                        'preferred_send_time',
                        e.target.value,
                      )
                    }
                    className={inputCls(false)}
                    disabled={readOnly}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={nt.cadence_paused}
                      onChange={(e) =>
                        handleFieldChange(
                          nt.id,
                          'cadence_paused',
                          e.target.checked,
                        )
                      }
                      className="accent-indigo-500"
                      disabled={readOnly}
                    />
                    Paused
                  </label>
                </div>

                {!readOnly && (
                  <div className="flex items-center justify-between border-t border-slate-700 pt-3">
                    {pendingEdits[nt.id] != null &&
                      Object.keys(pendingEdits[nt.id] as object).length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSaveType(nt.id)}
                          disabled={saveState === 'saving'}
                          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                        >
                          {saveState === 'saving' && (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          Save
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => handleDelete(nt.id, nt.name)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Delete type
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {saveState === 'success' && (
        <span className="text-sm text-emerald-400">Salvo</span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Blog Cadence                                             */
/* ------------------------------------------------------------------ */

function BlogCadenceSection({
  blogCadence,
  site,
  readOnly,
}: {
  blogCadence: BlogCadenceData[]
  site: SiteData
  readOnly: boolean
}) {
  type CadenceEdit = {
    cadence_days?: number | null
    preferred_send_time?: string
    cadence_start_date?: string | null
  }
  const cadenceMap = new Map(blogCadence.map((c) => [c.locale, c]))
  const [localState, setLocalState] = useState<Record<string, CadenceEdit>>(
    () => {
    const initial: Record<string, CadenceEdit> = {}
    for (const locale of site.supported_locales) {
      const c = cadenceMap.get(locale)
      initial[locale] = {
        cadence_days: c?.cadence_days ?? null,
        preferred_send_time: c?.preferred_send_time ?? '08:00',
      }
    }
    return initial
  })
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const handleCadenceFieldChange = useCallback(
    (locale: string, field: keyof CadenceEdit, value: string | number | null) => {
      setLocalState((prev) => ({
        ...prev,
        [locale]: { ...prev[locale], [field]: value },
      }))
      setDirty((prev) => ({ ...prev, [locale]: true }))
    },
    [],
  )

  const handleSave = useCallback(
    (locale: string) => {
      const data = localState[locale]
      if (!data) return
      setSaveState('saving')
      startTransition(async () => {
        const res = await updateBlogCadence(locale, data)
        if (!res.ok) {
          setSaveState('error')
          return
        }
        setDirty((prev) => ({ ...prev, [locale]: false }))
        setSaveState('success')
      })
    },
    [localState, setSaveState],
  )

  return (
    <div className={sectionCls()}>
      <h2 className="text-lg font-semibold text-slate-100">Blog Cadence</h2>

      <div className="space-y-4">
        {site.supported_locales.map((locale) => {
          const state = localState[locale] ?? {}
          return (
            <div
              key={locale}
              className="rounded-md border border-slate-600 bg-slate-800 p-4 space-y-3"
            >
              <h3 className="text-sm font-medium text-slate-200">{locale}</h3>

              <div>
                <label
                  htmlFor={`cadence-days-${locale}`}
                  className={labelCls()}
                >
                  Cadence
                </label>
                <select
                  id={`cadence-days-${locale}`}
                  value={state.cadence_days?.toString() ?? ''}
                  onChange={(e) =>
                    handleCadenceFieldChange(
                      locale,
                      'cadence_days',
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className={inputCls(false)}
                  disabled={readOnly}
                >
                  {CADENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`cadence-time-${locale}`}
                  className={labelCls()}
                >
                  Preferred Send Time
                </label>
                <input
                  id={`cadence-time-${locale}`}
                  type="time"
                  value={state.preferred_send_time ?? '08:00'}
                  onChange={(e) =>
                    handleCadenceFieldChange(
                      locale,
                      'preferred_send_time',
                      e.target.value,
                    )
                  }
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>

              {!readOnly && dirty[locale] && (
                <button
                  type="button"
                  onClick={() => handleSave(locale)}
                  disabled={saveState === 'saving'}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {saveState === 'saving' && (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  Save
                </button>
              )}
            </div>
          )
        })}
      </div>

      {saveState === 'success' && (
        <span className="text-sm text-emerald-400">Salvo</span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Localization                                             */
/* ------------------------------------------------------------------ */

function TimezoneSection({
  site,
  readOnly,
}: {
  site: SiteData
  readOnly: boolean
}) {
  const [timezone, setTimezone] = useState(site.timezone)
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()
  const dirty = timezone !== site.timezone

  const handleSave = useCallback(() => {
    if (readOnly || !dirty) return
    setSaveState('saving')
    startTransition(async () => {
      const res = await updateSiteTimezone({ timezone })
      if (!res.ok) {
        setSaveState('error')
        return
      }
      setSaveState('success')
    })
  }, [timezone, dirty, setSaveState, readOnly])

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls()}>Site Timezone</label>
        <TimezonePicker
          value={timezone}
          onChange={setTimezone}
          disabled={readOnly}
        />
      </div>

      <DualClockCards siteTimezone={timezone} />

      <p className="text-xs leading-relaxed text-slate-500">
        All scheduled content (posts, newsletters, YouTube sync) anchors to the
        site timezone. Dates in the CMS show site time first, with your local
        time alongside.
      </p>

      {!readOnly && dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saveState === 'saving' && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {saveState === 'success' ? 'Saved' : 'Save Timezone'}
        </button>
      )}
      {saveState === 'success' && !dirty && (
        <span className="text-sm text-emerald-400">Saved</span>
      )}
    </div>
  )
}

function LocalizationSection({
  site,
  readOnly,
}: {
  site: SiteData
  readOnly: boolean
}) {
  const [defaultLocale, setDefaultLocale] = useState(site.default_locale)
  const [locales, setLocales] = useState(site.supported_locales)
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const handleSubmit = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
      if (readOnly) return
      setSaveState('saving')
      startTransition(async () => {
        const res = await updateSiteLocales({
          default_locale: defaultLocale,
          supported_locales: locales,
        })
        if (!res.ok) {
          setSaveState('error')
          return
        }
        setSaveState('success')
      })
    },
    [defaultLocale, locales, setSaveState, readOnly],
  )

  const addLocale = useCallback(
    (locale: string) => {
      if (!locales.includes(locale)) {
        setLocales([...locales, locale])
      }
    },
    [locales],
  )

  const removeLocale = useCallback(
    (locale: string) => {
      if (locale === defaultLocale) return
      setLocales(locales.filter((l) => l !== locale))
    },
    [locales, defaultLocale],
  )

  return (
    <div className="space-y-6">
      <div className={sectionCls()}>
        <h2 className="text-lg font-semibold text-slate-100">Timezone</h2>
        <TimezoneSection site={site} readOnly={readOnly} />
      </div>

      <form onSubmit={handleSubmit} className={sectionCls()}>
        <h2 className="text-lg font-semibold text-slate-100">Localization</h2>

        <div>
          <label htmlFor="default-locale" className={labelCls()}>
            Default Locale
          </label>
          <select
            id="default-locale"
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value)}
            className={inputCls(false)}
            disabled={readOnly}
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelCls()}>Supported Locales</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {locales.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-700 px-3 py-1 text-sm text-slate-200"
              >
                {l}
                {l !== defaultLocale && !readOnly && (
                  <button
                    type="button"
                    onClick={() => removeLocale(l)}
                    className="ml-1 text-slate-400 hover:text-red-400"
                    aria-label={`Remove ${l}`}
                  >
                    {'×'}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {!readOnly && (
          <div>
            <label htmlFor="add-locale" className={labelCls()}>
              Add Locale
            </label>
            <select
              id="add-locale"
              value=""
              onChange={(e) => {
                if (e.target.value) addLocale(e.target.value)
              }}
              className={inputCls(false)}
            >
              <option value="">Select...</option>
              {LOCALE_OPTIONS.filter((l) => !locales.includes(l)).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}

        {!readOnly && <SaveButton state={saveState} />}
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Danger Zone                                              */
/* ------------------------------------------------------------------ */

function DangerZoneSection({ site }: { site: SiteData }) {
  const [confirmSlug, setConfirmSlug] = useState('')
  const [disableState, setDisableState] = useSaveState()
  const [deleteState, setDeleteState] = useSaveState()
  const [, startTransition] = useTransition()

  const handleDisable = useCallback(() => {
    if (
      !window.confirm(
        'Disable the CMS for this site? Content remains but editing will be locked.',
      )
    )
      return
    setDisableState('saving')
    startTransition(async () => {
      const res = await disableCms()
      if (!res.ok) {
        setDisableState('error')
        return
      }
      setDisableState('success')
    })
  }, [setDisableState])

  const handleDelete = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
      if (confirmSlug !== site.slug) return
      setDeleteState('saving')
      startTransition(async () => {
        const res = await deleteSite(confirmSlug)
        if (!res.ok) {
          setDeleteState('error')
          return
        }
        setDeleteState('success')
      })
    },
    [confirmSlug, site.slug, setDeleteState],
  )

  return (
    <div className={sectionCls() + ' border-red-900/50'}>
      <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>

      <div className="space-y-4 rounded-md border border-red-900/50 bg-red-950/20 p-4">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Disable CMS</h3>
          <p className="mt-1 text-sm text-slate-400">
            Disables the CMS for this site. Content remains but editing is
            locked.
          </p>
          <button
            type="button"
            onClick={handleDisable}
            disabled={disableState === 'saving' || !site.cms_enabled}
            className="mt-2 rounded-md border border-red-600 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50"
          >
            {disableState === 'saving'
              ? 'Disabling...'
              : disableState === 'success'
                ? 'Disabled'
                : site.cms_enabled
                  ? 'Disable CMS'
                  : 'Already disabled'}
          </button>
        </div>

        <hr className="border-red-900/30" />

        <form onSubmit={handleDelete}>
          <h3 className="text-sm font-medium text-slate-200">Delete Site</h3>
          <p className="mt-1 text-sm text-slate-400">
            Permanently deletes this site and all its data. This action cannot
            be undone.
          </p>
          <label
            htmlFor="confirm-slug"
            className="mt-3 block text-sm text-slate-400"
          >
            Type <strong className="text-slate-200">{site.slug}</strong> to
            confirm
          </label>
          <input
            id="confirm-slug"
            type="text"
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={site.slug}
            className={inputCls(false) + ' mt-1'}
          />
          <button
            type="submit"
            disabled={confirmSlug !== site.slug || deleteState === 'saving'}
            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
          >
            {deleteState === 'saving' ? 'Deleting...' : 'Delete Site'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: YouTube                                                  */
/* ------------------------------------------------------------------ */

function YouTubeSection({
  channels: initialChannels,
  readOnly,
}: {
  channels: YouTubeChannelData[]
  readOnly: boolean
}) {
  const [, startTransition] = useTransition()
  const [channels, setChannels] = useState(initialChannels)
  const canAdd = channels.length < 2

  const handleRemove = (channelId: string) => {
    if (!confirm('Remove this channel and all its synced videos?')) return
    startTransition(async () => {
      const res = await removeYouTubeChannel({ channelId })
      if (res.ok) setChannels(prev => prev.filter(c => c.id !== channelId))
      else alert(res.error)
    })
  }

  const handleAdded = (ch: YouTubeChannelData) => {
    setChannels(prev => [...prev, ch])
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-200">YouTube Channels</h2>

      {channels.length === 0 && (
        <p className="text-sm text-slate-400">No YouTube channels configured yet.</p>
      )}

      {channels.map((channel) => (
        <YouTubeChannelCard
          key={channel.id}
          channel={channel}
          readOnly={readOnly}
          onRemove={() => handleRemove(channel.id)}
        />
      ))}

      {canAdd && !readOnly && (
        <AddChannelForm
          existingLocales={channels.map(c => c.locale)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}

function AddChannelForm({
  existingLocales,
  onAdded,
}: {
  existingLocales: string[]
  onAdded: (ch: YouTubeChannelData) => void
}) {
  const [handle, setHandle] = useState('')
  const [locale, setLocale] = useState<'pt' | 'en'>(
    existingLocales.includes('pt') ? 'en' : 'pt',
  )
  const [looking, setLooking] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    channelId: string; name: string; handle: string; description: string | null
    uploadsPlaylistId: string; subscriberCount: number; videoCount: number
    thumbnailUrl: string | null; bannerUrl: string | null; customUrl: string | null
  } | null>(null)

  const availableLocales = (['pt', 'en'] as const).filter(l => !existingLocales.includes(l))

  const handleLookup = async () => {
    if (!handle.trim()) return
    setError(null)
    setPreview(null)
    setLooking(true)
    const res = await lookupYouTubeChannel({ handleOrUrl: handle.trim() })
    setLooking(false)
    if (!res.ok) { setError(res.error); return }
    setPreview(res.channel)
  }

  const handleAdd = async () => {
    if (!preview) return
    setAdding(true)
    setError(null)
    const res = await addYouTubeChannel({
      channelId: preview.channelId,
      locale,
      handle: preview.handle,
      name: preview.name,
      description: preview.description,
      uploadsPlaylistId: preview.uploadsPlaylistId,
      subscriberCount: preview.subscriberCount,
      videoCount: preview.videoCount,
      thumbnailUrl: preview.thumbnailUrl,
      bannerUrl: preview.bannerUrl,
      customUrl: preview.customUrl,
    })
    setAdding(false)
    if (!res.ok) { setError(res.error); return }
    onAdded({
      id: crypto.randomUUID(),
      name: preview.name,
      handle: preview.handle,
      locale,
      sync_enabled: true,
      sync_schedules: [],
      schedule_label: null,
    })
    setHandle('')
    setPreview(null)
  }

  return (
    <div className={sectionCls()}>
      <h3 className="text-sm font-medium text-slate-300">Add Channel</h3>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className={labelCls()}>Handle or URL</label>
          <input
            type="text"
            value={handle}
            onChange={e => { setHandle(e.target.value); setPreview(null); setError(null) }}
            placeholder="@channel or youtube.com/@channel"
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls()}>Locale</label>
          <select
            value={locale}
            onChange={e => setLocale(e.target.value as 'pt' | 'en')}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
          >
            {availableLocales.map(l => (
              <option key={l} value={l}>{l === 'pt' ? '🇧🇷 PT-BR' : '🌎 EN'}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleLookup}
          disabled={looking || !handle.trim()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {looking ? 'Looking up…' : 'Lookup'}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {preview && (
        <div className="mt-3 rounded border border-slate-600 bg-slate-800/50 p-3">
          <div className="flex items-center gap-3">
            {preview.thumbnailUrl && (
              <img src={preview.thumbnailUrl} alt="" className="h-10 w-10 rounded-full" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-200">{preview.name}</p>
              <p className="text-xs text-slate-400">
                {preview.handle} · {preview.subscriberCount.toLocaleString()} subs · {preview.videoCount} videos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="mt-3 rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {adding ? 'Adding…' : `Add as ${locale === 'pt' ? '🇧🇷 PT-BR' : '🌎 EN'} channel`}
          </button>
        </div>
      )}
    </div>
  )
}

function YouTubeChannelCard({
  channel,
  readOnly,
  onRemove,
}: {
  channel: YouTubeChannelData
  readOnly: boolean
  onRemove?: () => void
}) {
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()
  const [syncEnabled, setSyncEnabled] = useState(channel.sync_enabled)
  const [schedules, setSchedules] = useState(channel.sync_schedules ?? [])
  const [scheduleLabel, setScheduleLabel] = useState(channel.schedule_label ?? '')

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      const res = await updateYouTubeChannelSettings({
        channel_id: channel.id,
        sync_enabled: syncEnabled,
        sync_schedules: schedules.map(s => ({
          day: s.day as typeof DAYS[number],
          hour: s.hour,
          tz: s.tz,
          label: s.label,
        })),
        schedule_label: scheduleLabel.trim() || null,
      })
      setSaveState(res.ok ? 'success' : 'error')
    })
  }

  const addSchedule = () => {
    setSchedules([...schedules, { day: 'monday', hour: 10, tz: 'America/Sao_Paulo', label: '' }])
  }

  const removeSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index))
  }

  const updateSchedule = (index: number, field: string, value: string | number) => {
    setSchedules(schedules.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const flag = channel.locale === 'pt' ? '🇧🇷' : '🇺🇸'

  return (
    <form onSubmit={handleSave} className={sectionCls()}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <h3 className="text-base font-medium text-slate-200">{channel.name}</h3>
          <span className="text-xs text-slate-500">{channel.handle}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              disabled={readOnly}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500"
            />
            Sync enabled
          </label>
          {onRemove && !readOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {syncEnabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelCls()}>Posting Schedule</label>
            <button
              type="button"
              onClick={addSchedule}
              disabled={readOnly}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              + Add window
            </button>
          </div>

          {schedules.length === 0 && (
            <p className="text-xs text-slate-500">No posting windows configured. The catchall cron (daily 07:00) will still sync.</p>
          )}

          {schedules.map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/50 p-2">
              <select
                value={s.day}
                onChange={(e) => updateSchedule(i, 'day', e.target.value)}
                disabled={readOnly}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
              >
                {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
              <input
                type="number"
                min={0}
                max={23}
                value={s.hour}
                onChange={(e) => updateSchedule(i, 'hour', parseInt(e.target.value) || 0)}
                disabled={readOnly}
                className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
              />
              <span className="text-xs text-slate-500">h</span>
              <input
                type="text"
                value={s.label}
                onChange={(e) => updateSchedule(i, 'label', e.target.value)}
                disabled={readOnly}
                placeholder="Label"
                className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => removeSchedule(i)}
                disabled={readOnly}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}

          <div className="space-y-1">
            <label className={labelCls()}>Schedule Label (public site)</label>
            <input
              type="text"
              value={scheduleLabel}
              onChange={(e) => setScheduleLabel(e.target.value)}
              disabled={readOnly}
              placeholder={deriveScheduleLabel(schedules, channel.locale === 'pt' ? 'pt-BR' : 'en') ?? 'Auto-derived from schedules'}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">Leave empty to auto-derive from posting schedule. Set to override.</p>
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end pt-2">
          <SaveButton state={saveState} />
        </div>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Instagram Section                                                 */
/* ------------------------------------------------------------------ */

function InstagramSection({
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
      const { removeInstagramAccount } = await import('./actions')
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
      <h2 className="text-lg font-semibold text-slate-200">Instagram Feed</h2>

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
      const { updateInstagramSettings } = await import('./actions')
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
      const { setInstagramToken } = await import('./actions')
      const res = await setInstagramToken({ accountId: account.id, accessToken: token.trim() })
      if (res.ok) { setToken(''); alert('Token saved') }
      else alert(res.error)
    })
  }

  const handleSync = () => {
    setSyncing(true)
    startTransition(async () => {
      const { triggerInstagramSync } = await import('./actions')
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
      const { updateInstagramSlots } = await import('./actions')
      await updateInstagramSlots({ accountId: account.id, slots })
    })
  }

  const handlePinPost = (position: number, postId: string | null) => {
    startTransition(async () => {
      const { updateInstagramSlots } = await import('./actions')
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
              className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300"
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
              className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
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
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500"
            />
            Auto-sync enabled
          </label>

          <div className="space-y-1">
            <label className={labelCls()}>Layout</label>
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value as 'grid' | 'scatter')}
              disabled={readOnly}
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
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
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
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
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
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
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
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
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
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
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={handleSetToken}
              disabled={!token.trim()}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
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
    const { addInstagramAccount } = await import('./actions')
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
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls()}>Locale</label>
          <select
            value={locale}
            onChange={e => setLocale(e.target.value as 'pt' | 'en' | 'all')}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
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
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Connect'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Contact Page                                             */
/* ------------------------------------------------------------------ */

type ContactSubTab = 'hero' | 'social' | 'form' | 'faq' | 'visibility'

const CONTACT_SOCIAL_KEYS = [
  { key: 'email', label: 'Email', icon: '✉' },
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'youtube', label: 'YouTube', icon: '▶️' },
  { key: 'x', label: 'X', icon: '𝕏' },
  { key: 'github', label: 'GitHub', icon: '🐙' },
  { key: 'rss', label: 'RSS', icon: '📡' },
]

function LocaleTabs({
  locale,
  onChange,
}: {
  locale: 'pt-BR' | 'en'
  onChange: (l: 'pt-BR' | 'en') => void
}) {
  return (
    <div className="flex gap-1 rounded-md border border-slate-700 bg-slate-900 p-0.5 w-fit">
      {(['pt-BR', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            locale === l
              ? 'bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {l === 'pt-BR' ? '🇧🇷 PT-BR' : '🌎 EN'}
        </button>
      ))}
    </div>
  )
}

function ContactPageSection({
  contactSettings,
  contactVisibility,
  defaultAuthor,
  site,
  readOnly,
}: {
  contactSettings: Record<string, unknown>[]
  contactVisibility: Record<string, unknown> | null
  defaultAuthor: Record<string, unknown> | null
  site: SiteData
  readOnly: boolean
}) {
  const [activeTab, setActiveTab] = useState<ContactSubTab>('hero')
  const [pendingTab, setPendingTab] = useState<ContactSubTab | null>(null)
  const [showUnsaved, setShowUnsaved] = useState(false)
  const dirtyRef = useState<Record<ContactSubTab, boolean>>(() => ({
    hero: false,
    social: false,
    form: false,
    faq: false,
    visibility: false,
  }))[0]
  const [dirtyState, setDirtyState] = useState<Record<ContactSubTab, boolean>>({
    hero: false,
    social: false,
    form: false,
    faq: false,
    visibility: false,
  })

  // Parse persisted data
  const settingsByLocale = new Map<string, ContactPageSettings>()
  for (const row of contactSettings) {
    const locale = row.locale as string
    settingsByLocale.set(locale, row as unknown as ContactPageSettings)
  }

  const visibility: ContactPageVisibility = contactVisibility
    ? (contactVisibility as unknown as ContactPageVisibility)
    : ({ ...DEFAULT_VISIBILITY, id: '', site_id: site.id } as ContactPageVisibility)

  const authorSocials =
    defaultAuthor && typeof defaultAuthor.social_links === 'object' && defaultAuthor.social_links !== null
      ? (defaultAuthor.social_links as Record<string, string>)
      : {}

  const markDirty = (tab: ContactSubTab) => {
    dirtyRef[tab] = true
    setDirtyState((prev) => ({ ...prev, [tab]: true }))
  }
  const markClean = (tab: ContactSubTab) => {
    dirtyRef[tab] = false
    setDirtyState((prev) => ({ ...prev, [tab]: false }))
  }

  const trySwitch = (tab: ContactSubTab) => {
    if (dirtyState[activeTab]) {
      setPendingTab(tab)
      setShowUnsaved(true)
    } else {
      setActiveTab(tab)
    }
  }

  const confirmSwitch = () => {
    if (pendingTab) {
      markClean(activeTab)
      setActiveTab(pendingTab)
      setPendingTab(null)
    }
    setShowUnsaved(false)
  }

  const cancelSwitch = () => {
    setPendingTab(null)
    setShowUnsaved(false)
  }

  const SUB_TABS: { id: ContactSubTab; label: string }[] = [
    { id: 'hero', label: 'Hero & Textos' },
    { id: 'social', label: 'Social Links' },
    { id: 'form', label: 'Formulário' },
    { id: 'faq', label: 'FAQ' },
    { id: 'visibility', label: 'Visibilidade' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">Contact Page</h2>

      {/* Unsaved changes dialog */}
      {showUnsaved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">Unsaved changes</h3>
            <p className="text-sm text-slate-400 mb-4">
              You have unsaved changes in this tab. Discard them and switch?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelSwitch}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={confirmSwitch}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab nav */}
      <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => trySwitch(t.id)}
            className={`relative rounded-t px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            {dirtyState[t.id] && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'hero' && (
        <ContactHeroTab
          settingsByLocale={settingsByLocale}
          visibility={visibility}
          readOnly={readOnly}
          onDirty={() => markDirty('hero')}
          onSaved={() => markClean('hero')}
        />
      )}
      {activeTab === 'social' && (
        <ContactSocialTab
          visibility={visibility}
          authorSocials={authorSocials}
          readOnly={readOnly}
          onDirty={() => markDirty('social')}
          onSaved={() => markClean('social')}
        />
      )}
      {activeTab === 'form' && (
        <ContactFormTab
          settingsByLocale={settingsByLocale}
          visibility={visibility}
          notificationEmail={(site as unknown as Record<string, unknown>).contact_notification_email as string | null ?? ''}
          readOnly={readOnly}
          onDirty={() => markDirty('form')}
          onSaved={() => markClean('form')}
        />
      )}
      {activeTab === 'faq' && (
        <ContactFaqTab
          settingsByLocale={settingsByLocale}
          visibility={visibility}
          readOnly={readOnly}
          onDirty={() => markDirty('faq')}
          onSaved={() => markClean('faq')}
        />
      )}
      {activeTab === 'visibility' && (
        <ContactVisibilityTab
          visibility={visibility}
          readOnly={readOnly}
          onDirty={() => markDirty('visibility')}
          onSaved={() => markClean('visibility')}
        />
      )}
    </div>
  )
}

/* -- Contact sub-tab: Hero & Textos -- */

function ContactHeroTab({
  settingsByLocale,
  visibility: initialVisibility,
  readOnly,
  onDirty,
  onSaved,
}: {
  settingsByLocale: Map<string, ContactPageSettings>
  visibility: ContactPageVisibility
  readOnly: boolean
  onDirty: () => void
  onSaved: () => void
}) {
  const [locale, setLocale] = useState<'pt-BR' | 'en'>('pt-BR')
  const defaults = getDefaultSettings(locale)

  const getRow = (l: string) => settingsByLocale.get(l)

  const [textState, setTextState] = useState<
    Record<'pt-BR' | 'en', { hero_title: string; hero_subtitle: string; response_time_text: string }>
  >({
    'pt-BR': {
      hero_title: getRow('pt-BR')?.hero_title ?? getDefaultSettings('pt-BR').hero_title,
      hero_subtitle: getRow('pt-BR')?.hero_subtitle ?? getDefaultSettings('pt-BR').hero_subtitle,
      response_time_text: getRow('pt-BR')?.response_time_text ?? getDefaultSettings('pt-BR').response_time_text,
    },
    en: {
      hero_title: getRow('en')?.hero_title ?? getDefaultSettings('en').hero_title,
      hero_subtitle: getRow('en')?.hero_subtitle ?? getDefaultSettings('en').hero_subtitle,
      response_time_text: getRow('en')?.response_time_text ?? getDefaultSettings('en').response_time_text,
    },
  })

  const [displayState, setDisplayState] = useState({
    show_avatar: initialVisibility.show_avatar,
    show_bio: initialVisibility.show_bio,
    show_response_badge: initialVisibility.show_response_badge,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const cur = textState[locale]
  const def = defaults

  const handleTextChange = (field: keyof typeof cur, value: string) => {
    setTextState((prev) => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }))
    onDirty()
  }

  const handleDisplayChange = (field: keyof typeof displayState, value: boolean) => {
    setDisplayState((prev) => ({ ...prev, [field]: value }))
    onDirty()
  }

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault()
    if (readOnly) return
    const e: Record<string, string> = {}
    if (!cur.hero_title.trim()) e.hero_title = 'Title is required'
    if (cur.hero_title.length > 80) e.hero_title = 'Max 80 characters'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSaveState('saving')
    startTransition(async () => {
      const [textRes, displayRes] = await Promise.all([
        updateContactHeroText({
          locale,
          hero_title: cur.hero_title,
          hero_subtitle: cur.hero_subtitle,
          response_time_text: cur.response_time_text,
        }),
        updateContactHeroDisplay(displayState),
      ])
      if (!textRes.ok || !displayRes.ok) {
        setErrors({ _form: (!textRes.ok ? textRes.error : '') + (!displayRes.ok ? displayRes.error : '') || 'Save failed' })
        setSaveState('error')
        return
      }
      setSaveState('success')
      onSaved()
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('contact-hero-form')?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <form id="contact-hero-form" onSubmit={handleSubmit} className={sectionCls()}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Hero & Textos</h3>
        <LocaleTabs locale={locale} onChange={setLocale} />
      </div>

      <div>
        <label htmlFor="contact-hero-title" className={labelCls()}>
          Title <span className="text-red-400">*</span>
        </label>
        <input
          id="contact-hero-title"
          type="text"
          value={cur.hero_title}
          onChange={(e) => handleTextChange('hero_title', e.target.value)}
          placeholder={def.hero_title}
          maxLength={80}
          className={inputCls(!!errors.hero_title)}
          disabled={readOnly}
        />
        <div className="flex justify-between mt-0.5">
          <FieldError message={errors.hero_title} />
          <span className="text-xs text-slate-500">{cur.hero_title.length}/80</span>
        </div>
      </div>

      <div>
        <label htmlFor="contact-hero-subtitle" className={labelCls()}>
          Subtitle
        </label>
        <textarea
          id="contact-hero-subtitle"
          value={cur.hero_subtitle}
          onChange={(e) => handleTextChange('hero_subtitle', e.target.value)}
          placeholder={def.hero_subtitle}
          maxLength={300}
          rows={3}
          className={inputCls(false) + ' resize-none'}
          disabled={readOnly}
        />
        <div className="flex justify-end mt-0.5">
          <span className="text-xs text-slate-500">{cur.hero_subtitle.length}/300</span>
        </div>
      </div>

      <div>
        <label htmlFor="contact-response-time" className={labelCls()}>
          Response Time Text
        </label>
        <input
          id="contact-response-time"
          type="text"
          value={cur.response_time_text}
          onChange={(e) => handleTextChange('response_time_text', e.target.value)}
          placeholder={def.response_time_text}
          className={inputCls(false)}
          disabled={readOnly}
        />
      </div>

      <div>
        <span className={labelCls()}>Display Options</span>
        <div className="mt-2 space-y-2">
          {(
            [
              { key: 'show_avatar', label: 'Show avatar' },
              { key: 'show_bio', label: 'Show bio' },
              { key: 'show_response_badge', label: 'Show response time badge' },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={displayState[key]}
                onChange={(e) => handleDisplayChange(key, e.target.checked)}
                className="accent-indigo-500"
                disabled={readOnly}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <FieldError message={errors._form} />
      {!readOnly && <SaveButton state={saveState} />}
    </form>
  )
}

/* -- Contact sub-tab: Social Links -- */

function ContactSocialTab({
  visibility: initialVisibility,
  authorSocials,
  readOnly,
  onDirty,
  onSaved,
}: {
  visibility: ContactPageVisibility
  authorSocials: Record<string, string>
  readOnly: boolean
  onDirty: () => void
  onSaved: () => void
}) {
  const initialOrder = initialVisibility.social_order.length > 0
    ? initialVisibility.social_order
    : CONTACT_SOCIAL_KEYS.map((s) => s.key)

  const [order, setOrder] = useState<string[]>(initialOrder)
  const [visible, setVisible] = useState<Record<string, boolean>>(
    initialVisibility.social_visible ?? {},
  )
  const [emailHighlight, setEmailHighlight] = useState(initialVisibility.email_highlight)
  const [handwrittenNote, setHandwrittenNote] = useState(initialVisibility.handwritten_note)
  const [saveState, setSaveState] = useSaveState()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const handleToggleVisible = (key: string, val: boolean) => {
    setVisible((prev) => ({ ...prev, [key]: val }))
    onDirty()
  }

  const handleMove = (key: string, dir: 'up' | 'down') => {
    const idx = order.indexOf(key)
    if (idx === -1) return
    const next = [...order]
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= next.length) return
    const a = next[idx]
    const b = next[swapIdx]
    if (a === undefined || b === undefined) return
    next[idx] = b
    next[swapIdx] = a
    setOrder(next)
    onDirty()
  }

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      const res = await updateContactSocial({
        social_order: order,
        social_visible: visible,
        email_highlight: emailHighlight,
        handwritten_note: handwrittenNote,
      })
      if (!res.ok) {
        setErrors({ _form: res.error })
        setSaveState('error')
        return
      }
      setSaveState('success')
      onSaved()
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('contact-social-form')?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <form id="contact-social-form" onSubmit={handleSubmit} className={sectionCls()}>
      <h3 className="text-sm font-semibold text-slate-200">Social Links</h3>

      <p className="text-xs text-slate-500">
        Drag to reorder. Handles come from the default author profile.
      </p>

      <div className="space-y-2">
        {order.map((key, idx) => {
          const meta = CONTACT_SOCIAL_KEYS.find((s) => s.key === key)
          const handle = authorSocials[key]
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
            >
              <span className="text-base w-5 text-center">{meta?.icon ?? '•'}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-200">{meta?.label ?? key}</span>
                {handle && (
                  <span className="ml-2 text-xs text-slate-500 truncate">{handle}</span>
                )}
                {!handle && (
                  <span className="ml-2 text-xs text-slate-600 italic">not configured</span>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={visible[key] ?? true}
                  onChange={(e) => handleToggleVisible(key, e.target.checked)}
                  className="accent-indigo-500"
                  disabled={readOnly}
                />
                Visible
              </label>
              {!readOnly && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(key, 'up')}
                    disabled={idx === 0}
                    className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 leading-none"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(key, 'down')}
                    disabled={idx === order.length - 1}
                    className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 leading-none"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-2 border-t border-slate-700 pt-4">
        <span className={labelCls()}>Extra Options</span>
        {(
          [
            { key: 'email_highlight', label: 'Highlight email link', val: emailHighlight, set: setEmailHighlight },
            { key: 'handwritten_note', label: 'Show handwritten note decoration', val: handwrittenNote, set: setHandwrittenNote },
          ] as const
        ).map(({ key, label, val, set }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => { set(e.target.checked); onDirty() }}
              className="accent-indigo-500"
              disabled={readOnly}
            />
            {label}
          </label>
        ))}
      </div>

      <FieldError message={errors._form} />
      {!readOnly && <SaveButton state={saveState} />}
    </form>
  )
}

/* -- Contact sub-tab: Formulário -- */

function ContactFormTab({
  settingsByLocale,
  visibility: initialVisibility,
  notificationEmail: initialEmail,
  readOnly,
  onDirty,
  onSaved,
}: {
  settingsByLocale: Map<string, ContactPageSettings>
  visibility: ContactPageVisibility
  notificationEmail: string
  readOnly: boolean
  onDirty: () => void
  onSaved: () => void
}) {
  const [locale, setLocale] = useState<'pt-BR' | 'en'>('pt-BR')
  const [notifEmail, setNotifEmail] = useState(initialEmail)
  const [showSubjectSelector, setShowSubjectSelector] = useState(initialVisibility.show_subject_selector)
  const [showMarketingConsent, setShowMarketingConsent] = useState(initialVisibility.show_marketing_consent)

  const getRow = (l: string) => settingsByLocale.get(l)

  const [formTextState, setFormTextState] = useState<
    Record<'pt-BR' | 'en', { form_title: string; auto_reply_text: string; subject_options: string[] }>
  >({
    'pt-BR': {
      form_title: getRow('pt-BR')?.form_title ?? getDefaultSettings('pt-BR').form_title,
      auto_reply_text: getRow('pt-BR')?.auto_reply_text ?? getDefaultSettings('pt-BR').auto_reply_text,
      subject_options: getRow('pt-BR')?.subject_options ?? [...getDefaultSettings('pt-BR').subject_options],
    },
    en: {
      form_title: getRow('en')?.form_title ?? getDefaultSettings('en').form_title,
      auto_reply_text: getRow('en')?.auto_reply_text ?? getDefaultSettings('en').auto_reply_text,
      subject_options: getRow('en')?.subject_options ?? [...getDefaultSettings('en').subject_options],
    },
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const cur = formTextState[locale]
  const def = getDefaultSettings(locale)

  const updateFormText = (field: keyof typeof cur, value: string | string[]) => {
    setFormTextState((prev) => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }))
    onDirty()
  }

  const handleSubjectChange = (idx: number, val: string) => {
    const next = [...cur.subject_options]
    next[idx] = val
    updateFormText('subject_options', next)
  }

  const handleSubjectAdd = () => {
    updateFormText('subject_options', [...cur.subject_options, ''])
  }

  const handleSubjectRemove = (idx: number) => {
    updateFormText('subject_options', cur.subject_options.filter((_, i) => i !== idx))
  }

  const handleSubjectMove = (idx: number, dir: 'up' | 'down') => {
    const next = [...cur.subject_options]
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= next.length) return
    const a = next[idx]
    const b = next[swapIdx]
    if (a === undefined || b === undefined) return
    next[idx] = b
    next[swapIdx] = a
    updateFormText('subject_options', next)
  }

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault()
    if (readOnly) return
    const e: Record<string, string> = {}
    if (notifEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifEmail)) {
      e.notif_email = 'Must be a valid email address'
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSaveState('saving')
    startTransition(async () => {
      const [settingsRes, textRes] = await Promise.all([
        updateContactFormSettings({
          notification_email: notifEmail,
          show_subject_selector: showSubjectSelector,
          show_marketing_consent: showMarketingConsent,
        }),
        updateContactFormText({
          locale,
          form_title: cur.form_title,
          auto_reply_text: cur.auto_reply_text,
          subject_options: cur.subject_options,
        }),
      ])
      if (!settingsRes.ok || !textRes.ok) {
        setErrors({ _form: (!settingsRes.ok ? settingsRes.error : '') + (!textRes.ok ? textRes.error : '') || 'Save failed' })
        setSaveState('error')
        return
      }
      setSaveState('success')
      onSaved()
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('contact-form-tab-form')?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <form id="contact-form-tab-form" onSubmit={handleSubmit} className={sectionCls()}>
      <h3 className="text-sm font-semibold text-slate-200">Formulário</h3>

      <div>
        <label htmlFor="contact-notif-email" className={labelCls()}>
          Notification Email
        </label>
        <input
          id="contact-notif-email"
          type="email"
          value={notifEmail}
          onChange={(e) => { setNotifEmail(e.target.value); onDirty() }}
          placeholder="you@example.com"
          className={inputCls(!!errors.notif_email)}
          disabled={readOnly}
        />
        <FieldError message={errors.notif_email} />
        <p className="mt-1 text-xs text-slate-500">
          Where contact form submissions are delivered.
        </p>
      </div>

      <div className="space-y-2">
        <span className={labelCls()}>Options</span>
        {(
          [
            { key: 'show_subject_selector' as const, label: 'Show subject selector', val: showSubjectSelector, set: setShowSubjectSelector },
            { key: 'show_marketing_consent' as const, label: 'Show marketing consent checkbox', val: showMarketingConsent, set: setShowMarketingConsent },
          ]
        ).map(({ key, label, val, set }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => { set(e.target.checked); onDirty() }}
              className="accent-indigo-500"
              disabled={readOnly}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className={labelCls()}>Locale-specific texts</span>
          <LocaleTabs locale={locale} onChange={setLocale} />
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="contact-form-title" className={labelCls()}>
              Form Title
            </label>
            <input
              id="contact-form-title"
              type="text"
              value={cur.form_title}
              onChange={(e) => updateFormText('form_title', e.target.value)}
              placeholder={def.form_title}
              className={inputCls(false)}
              disabled={readOnly}
            />
          </div>

          <div>
            <label htmlFor="contact-auto-reply" className={labelCls()}>
              Auto-reply Message
            </label>
            <textarea
              id="contact-auto-reply"
              value={cur.auto_reply_text}
              onChange={(e) => updateFormText('auto_reply_text', e.target.value)}
              placeholder={def.auto_reply_text}
              maxLength={500}
              rows={3}
              className={inputCls(false) + ' resize-none'}
              disabled={readOnly}
            />
            <div className="flex justify-end mt-0.5">
              <span className="text-xs text-slate-500">{cur.auto_reply_text.length}/500</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls()}>Subject Options</label>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleSubjectAdd}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  + Add option
                </button>
              )}
            </div>
            <div className="space-y-2">
              {cur.subject_options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleSubjectChange(idx, e.target.value)}
                    placeholder="Subject option"
                    className={inputCls(false) + ' flex-1'}
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleSubjectMove(idx, 'up')}
                          disabled={idx === 0}
                          className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 leading-none"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubjectMove(idx, 'down')}
                          disabled={idx === cur.subject_options.length - 1}
                          className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 leading-none"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSubjectRemove(idx)}
                        className="text-sm text-red-400 hover:text-red-300"
                        aria-label="Remove subject option"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
              {cur.subject_options.length === 0 && (
                <p className="text-xs text-slate-500">No subject options configured.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <FieldError message={errors._form} />
      {!readOnly && <SaveButton state={saveState} />}
    </form>
  )
}

/* -- Contact sub-tab: FAQ -- */

function ContactFaqTab({
  settingsByLocale,
  visibility,
  readOnly,
  onDirty,
  onSaved,
}: {
  settingsByLocale: Map<string, ContactPageSettings>
  visibility: ContactPageVisibility
  readOnly: boolean
  onDirty: () => void
  onSaved: () => void
}) {
  const [locale, setLocale] = useState<'pt-BR' | 'en'>('pt-BR')

  const getRow = (l: string) => settingsByLocale.get(l)

  const [faqState, setFaqState] = useState<
    Record<'pt-BR' | 'en', { q: string; a: string }[]>
  >({
    'pt-BR': getRow('pt-BR')?.faq_items ?? [...getDefaultSettings('pt-BR').faq_items],
    en: getRow('en')?.faq_items ?? [...getDefaultSettings('en').faq_items],
  })

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [saveState, setSaveState] = useSaveState()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const cur = faqState[locale]

  const updateItem = (idx: number, field: 'q' | 'a', val: string) => {
    setFaqState((prev) => {
      const next = [...prev[locale]]
      const existing = next[idx]
      if (!existing) return prev
      next[idx] = { ...existing, [field]: val }
      return { ...prev, [locale]: next }
    })
    onDirty()
  }

  const addItem = () => {
    setFaqState((prev) => ({
      ...prev,
      [locale]: [...prev[locale], { q: '', a: '' }],
    }))
    setExpandedIdx(cur.length)
    onDirty()
  }

  const removeItem = (idx: number) => {
    setFaqState((prev) => ({
      ...prev,
      [locale]: prev[locale].filter((_, i) => i !== idx),
    }))
    if (expandedIdx === idx) setExpandedIdx(null)
    onDirty()
  }

  const moveItem = (idx: number, dir: 'up' | 'down') => {
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= cur.length) return
    setFaqState((prev) => {
      const next = [...prev[locale]]
      const a = next[idx]
      const b = next[swapIdx]
      if (a === undefined || b === undefined) return prev
      next[idx] = b
      next[swapIdx] = a
      return { ...prev, [locale]: next }
    })
    onDirty()
  }

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      const res = await updateContactFaq({ locale, faq_items: cur })
      if (!res.ok) {
        setErrors({ _form: res.error })
        setSaveState('error')
        return
      }
      setSaveState('success')
      onSaved()
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('contact-faq-form')?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <form id="contact-faq-form" onSubmit={handleSubmit} className={sectionCls()}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">FAQ</h3>
        <LocaleTabs locale={locale} onChange={setLocale} />
      </div>

      {!visibility.show_faq && (
        <div className="rounded-md border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          FAQ is currently hidden on the page. Enable it in the Visibilidade tab to show it.
        </div>
      )}

      <div className="space-y-2">
        {cur.map((item, idx) => (
          <div
            key={idx}
            className="rounded-md border border-slate-700 bg-slate-800"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="flex-1 text-left text-sm text-slate-300 truncate"
              >
                {item.q || <span className="italic text-slate-500">Empty question</span>}
              </button>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'up')}
                      disabled={idx === 0}
                      className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 leading-none"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'down')}
                      disabled={idx === cur.length - 1}
                      className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 leading-none"
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-sm text-red-400 hover:text-red-300 ml-1"
                    aria-label="Remove FAQ item"
                  >
                    ×
                  </button>
                </div>
              )}
              <span className="text-xs text-slate-600">
                {expandedIdx === idx ? '▲' : '▼'}
              </span>
            </div>

            {expandedIdx === idx && (
              <div className="space-y-3 border-t border-slate-700 px-3 py-3">
                <div>
                  <label className={labelCls()}>Question</label>
                  <input
                    type="text"
                    value={item.q}
                    onChange={(e) => updateItem(idx, 'q', e.target.value)}
                    placeholder="Question"
                    className={inputCls(false)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <label className={labelCls()}>Answer</label>
                  <textarea
                    value={item.a}
                    onChange={(e) => updateItem(idx, 'a', e.target.value)}
                    placeholder="Answer"
                    rows={3}
                    className={inputCls(false) + ' resize-none'}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {cur.length === 0 && (
          <p className="text-sm text-slate-500">No FAQ items configured yet.</p>
        )}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addItem}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          + Add FAQ item
        </button>
      )}

      <FieldError message={errors._form} />
      {!readOnly && <SaveButton state={saveState} />}
    </form>
  )
}

/* -- Contact sub-tab: Visibilidade -- */

function ContactVisibilityTab({
  visibility: initialVisibility,
  readOnly,
  onDirty,
  onSaved,
}: {
  visibility: ContactPageVisibility
  readOnly: boolean
  onDirty: () => void
  onSaved: () => void
}) {
  const [showHero, setShowHero] = useState(initialVisibility.show_hero)
  const [showSocialLinks, setShowSocialLinks] = useState(initialVisibility.show_social_links)
  const [showContactForm, setShowContactForm] = useState(initialVisibility.show_contact_form)
  const [showFaq, setShowFaq] = useState(initialVisibility.show_faq)
  const [saveState, setSaveState] = useSaveState()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const allHidden = !showHero && !showSocialLinks && !showContactForm && !showFaq

  const handleChange = (
    setter: (v: boolean) => void,
  ) => (val: boolean) => {
    setter(val)
    onDirty()
  }

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      const res = await updateContactVisibility({
        show_hero: showHero,
        show_social_links: showSocialLinks,
        show_contact_form: showContactForm,
        show_faq: showFaq,
      })
      if (!res.ok) {
        setErrors({ _form: res.error })
        setSaveState('error')
        return
      }
      setSaveState('success')
      onSaved()
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('contact-visibility-form')?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const sections = [
    { key: 'show_hero' as const, label: 'Hero section', val: showHero, set: setShowHero },
    { key: 'show_social_links' as const, label: 'Social links', val: showSocialLinks, set: setShowSocialLinks },
    { key: 'show_contact_form' as const, label: 'Contact form', val: showContactForm, set: setShowContactForm },
    { key: 'show_faq' as const, label: 'FAQ section', val: showFaq, set: setShowFaq },
  ]

  return (
    <form id="contact-visibility-form" onSubmit={handleSubmit} className={sectionCls()}>
      <h3 className="text-sm font-semibold text-slate-200">Visibilidade</h3>

      {allHidden && (
        <div className="rounded-md border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          All sections are hidden. The contact page will show nothing to visitors.
        </div>
      )}

      <div className="space-y-3">
        {sections.map(({ key, label, val, set }) => (
          <label key={key} className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => handleChange(set)(e.target.checked)}
              className="accent-indigo-500"
              disabled={readOnly}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {/* Wireframe preview */}
      <div>
        <span className={labelCls()}>Page Preview</span>
        <div className="mt-2 rounded-md border border-slate-600 bg-slate-900 p-4 space-y-2 text-xs">
          <div
            className={`rounded px-2 py-1.5 border transition-opacity ${
              showHero
                ? 'border-indigo-600/50 bg-indigo-950/30 text-indigo-300'
                : 'border-slate-700 bg-slate-800/30 text-slate-600 opacity-40'
            }`}
          >
            [Hero] Title + Subtitle + Avatar
          </div>
          <div
            className={`rounded px-2 py-1.5 border transition-opacity ${
              showSocialLinks
                ? 'border-purple-600/50 bg-purple-950/30 text-purple-300'
                : 'border-slate-700 bg-slate-800/30 text-slate-600 opacity-40'
            }`}
          >
            [Social Links] Email · Instagram · GitHub …
          </div>
          <div
            className={`rounded px-2 py-1.5 border transition-opacity ${
              showContactForm
                ? 'border-emerald-600/50 bg-emerald-950/30 text-emerald-300'
                : 'border-slate-700 bg-slate-800/30 text-slate-600 opacity-40'
            }`}
          >
            [Contact Form] Name · Email · Message · Send
          </div>
          <div
            className={`rounded px-2 py-1.5 border transition-opacity ${
              showFaq
                ? 'border-amber-600/50 bg-amber-950/30 text-amber-300'
                : 'border-slate-700 bg-slate-800/30 text-slate-600 opacity-40'
            }`}
          >
            [FAQ] Q&A accordion
          </div>
        </div>
      </div>

      <FieldError message={errors._form} />
      {!readOnly && <SaveButton state={saveState} />}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function SettingsConnected({
  site,
  newsletterTypes,
  blogCadence,
  youtubeChannels,
  instagramAccounts,
  contactSettings = [],
  contactVisibility = null,
  defaultAuthor = null,
  initialSection,
  seoFlags = {
    aiCrawlersBlocked: false,
  },
  readOnly = false,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>(
    (searchParams.get('section') as SectionId) ||
      (initialSection as SectionId) ||
      'branding',
  )

  const switchSection = useCallback(
    (id: SectionId) => {
      setActiveSection(id)
      setSidebarOpen(false)
      const params = new URLSearchParams(searchParams.toString())
      params.set('section', id)
      router.replace(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const form = document.querySelector(
          '[data-settings-section="' + activeSection + '"] form',
        ) as HTMLFormElement | null
        const sectionEl = document.querySelector(
          '[data-settings-section="' + activeSection + '"]',
        )
        const targetForm =
          form ??
          (sectionEl?.tagName === 'FORM'
            ? (sectionEl as HTMLFormElement)
            : null)
        targetForm?.requestSubmit()
        return
      }

      if (e.key === 'Escape') {
        ;(document.activeElement as HTMLElement)?.blur?.()
        return
      }

      if (!isInput && e.key >= '1' && e.key <= '8') {
        const idx = Number(e.key) - 1
        if (SECTIONS[idx]) {
          switchSection(SECTIONS[idx].id)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeSection, switchSection])

  const visibleSections = readOnly
    ? SECTIONS.filter((s) => s.id !== 'danger-zone')
    : SECTIONS

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[#0f172a]">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-indigo-500 p-3 text-white shadow-lg md:hidden"
        aria-label="Toggle settings menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        aria-label="Settings sections"
        className={`fixed inset-y-0 left-0 z-40 w-56 shrink-0 border-r border-slate-700 bg-slate-900/95 p-4 pt-20 transition-transform md:static md:translate-x-0 md:pt-4 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <ul className="space-y-1">
          {visibleSections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => switchSection(s.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  activeSection === s.id
                    ? 'bg-indigo-500/20 text-indigo-400 font-medium'
                    : s.id === 'danger-zone'
                      ? 'text-red-400 hover:bg-red-950/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="inline-block w-4 text-center text-xs text-slate-600">
                  {i + 1}
                </span>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <main className="flex-1 p-4 overflow-y-auto md:p-6">
        <div
          className="mx-auto max-w-2xl"
          data-settings-section={activeSection}
        >
          {readOnly && <ReadOnlyBanner />}
          {activeSection === 'branding' && (
            <BrandingSection site={site} readOnly={readOnly} />
          )}
          {activeSection === 'seo' && (
            <SeoSection site={site} seoFlags={seoFlags} readOnly={readOnly} />
          )}
          {activeSection === 'newsletters' && (
            <NewslettersSection
              newsletterTypes={newsletterTypes}
              readOnly={readOnly}
            />
          )}
          {activeSection === 'blog-cadence' && (
            <BlogCadenceSection
              blogCadence={blogCadence}
              site={site}
              readOnly={readOnly}
            />
          )}
          {activeSection === 'youtube' && (
            <YouTubeSection channels={youtubeChannels ?? []} readOnly={readOnly} />
          )}
          {activeSection === 'instagram' && (
            <InstagramSection accounts={instagramAccounts ?? []} readOnly={readOnly} />
          )}
          {activeSection === 'contact-page' && (
            <ContactPageSection
              contactSettings={contactSettings ?? []}
              contactVisibility={contactVisibility ?? null}
              defaultAuthor={defaultAuthor ?? null}
              site={site}
              readOnly={readOnly}
            />
          )}
          {activeSection === 'localization' && (
            <LocalizationSection site={site} readOnly={readOnly} />
          )}
          {activeSection === 'danger-zone' && !readOnly && (
            <DangerZoneSection site={site} />
          )}
        </div>
      </main>
    </div>
  )
}
