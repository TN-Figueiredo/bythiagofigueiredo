'use client'

import {
  useState,
  useCallback,
  useEffect,
  useTransition,
  type FormEvent,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  updateBranding,
  updateIdentity,
  updateSeoDefaults,
  updateNewsletterType,
  createNewsletterType,
  deleteNewsletterType,
  updateBlogCadence,
  updateSiteLocales,
  disableCms,
  deleteSite,
} from './actions'

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
  jsonLd: boolean
  dynamicOg: boolean
  extendedSchemas: boolean
  aiCrawlersBlocked: boolean
}

interface Props {
  site: SiteData
  newsletterTypes: NewsletterTypeData[]
  blogCadence: BlogCadenceData[]
  initialSection: string
  seoFlags?: SeoFlags
  readOnly?: boolean
}

type SectionId =
  | 'branding'
  | 'seo'
  | 'newsletters'
  | 'blog-cadence'
  | 'localization'
  | 'danger-zone'

type SaveState = 'idle' | 'saving' | 'success' | 'error'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'seo', label: 'SEO' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'blog-cadence', label: 'Blog Cadence' },
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
    { key: 'JSON-LD', enabled: seoFlags.jsonLd },
    { key: 'Dynamic OG', enabled: seoFlags.dynamicOg },
    { key: 'Extended Schemas', enabled: seoFlags.extendedSchemas },
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
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function SettingsConnected({
  site,
  newsletterTypes,
  blogCadence,
  initialSection,
  seoFlags = {
    jsonLd: true,
    dynamicOg: true,
    extendedSchemas: true,
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

      if (!isInput && e.key >= '1' && e.key <= '6') {
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
