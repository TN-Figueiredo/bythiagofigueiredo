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

interface Props {
  site: SiteData
  newsletterTypes: NewsletterTypeData[]
  blogCadence: BlogCadenceData[]
  initialSection: string
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
}: {
  state: SaveState
  label?: string
}) {
  return (
    <button
      type="submit"
      disabled={state === 'saving'}
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

function BrandingSection({ site }: { site: SiteData }) {
  const [logoUrl, setLogoUrl] = useState(site.logo_url ?? '')
  const [primaryColor, setPrimaryColor] = useState(site.primary_color ?? '#000000')
  const [identityType, setIdentityType] = useState(site.identity_type)
  const [twitterHandle, setTwitterHandle] = useState(site.twitter_handle ?? '')
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
    [logoUrl, primaryColor, identityType, twitterHandle, validate, setSaveState],
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
            <label key={type} className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="radio"
                name="identity_type"
                value={type}
                checked={identityType === type}
                onChange={() => setIdentityType(type)}
                className="accent-indigo-500"
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
          />
        </div>
        <FieldError message={errors.twitter_handle} />
      </div>

      <FieldError message={errors._form} />
      <SaveButton state={saveState} />
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: SEO                                                      */
/* ------------------------------------------------------------------ */

function SeoSection({ site }: { site: SiteData }) {
  const [ogImage, setOgImage] = useState(site.seo_default_og_image ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const featureFlags = [
    { key: 'JSON-LD', env: 'NEXT_PUBLIC_SEO_JSONLD_ENABLED' },
    { key: 'Dynamic OG', env: 'NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED' },
    { key: 'Extended Schemas', env: 'NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED' },
    { key: 'AI Crawlers Blocked', env: 'SEO_AI_CRAWLERS_BLOCKED' },
  ]

  const handleSubmit = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
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
    [ogImage, setSaveState],
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
        />
        <FieldError message={errors.seo_default_og_image} />
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Feature Flags (read-only)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {featureFlags.map((flag) => (
            <div
              key={flag.key}
              className="flex items-center justify-between rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
            >
              <span className="text-sm text-slate-300">{flag.key}</span>
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                env
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
      <SaveButton state={saveState} />
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Newsletters                                              */
/* ------------------------------------------------------------------ */

function NewslettersSection({
  newsletterTypes,
}: {
  newsletterTypes: NewsletterTypeData[]
}) {
  const [types, setTypes] = useState(newsletterTypes)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useSaveState()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [, startTransition] = useTransition()

  const handleUpdateType = useCallback(
    (id: string, data: Partial<NewsletterTypeData>) => {
      setSaveState('saving')
      startTransition(async () => {
        const res = await updateNewsletterType(id, data)
        if (!res.ok) {
          setSaveState('error')
          return
        }
        setTypes((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...data } : t)),
        )
        setSaveState('success')
      })
    },
    [setSaveState],
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
    (id: string) => {
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
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          New Type
        </button>
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
                      handleUpdateType(nt.id, {
                        cadence_days: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className={inputCls(false)}
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
                      handleUpdateType(nt.id, {
                        preferred_send_time: e.target.value,
                      })
                    }
                    className={inputCls(false)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={nt.cadence_paused}
                      onChange={(e) =>
                        handleUpdateType(nt.id, {
                          cadence_paused: e.target.checked,
                        })
                      }
                      className="accent-indigo-500"
                    />
                    Paused
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(nt.id)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Delete type
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {saveState === 'saving' && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      )}
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
}: {
  blogCadence: BlogCadenceData[]
  site: SiteData
}) {
  const cadenceMap = new Map(blogCadence.map((c) => [c.locale, c]))
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const handleUpdate = useCallback(
    (locale: string, data: Record<string, unknown>) => {
      setSaveState('saving')
      startTransition(async () => {
        const res = await updateBlogCadence(locale, data)
        if (!res.ok) {
          setSaveState('error')
          return
        }
        setSaveState('success')
      })
    },
    [setSaveState],
  )

  return (
    <div className={sectionCls()}>
      <h2 className="text-lg font-semibold text-slate-100">Blog Cadence</h2>

      <div className="space-y-4">
        {site.supported_locales.map((locale) => {
          const cadence = cadenceMap.get(locale)
          return (
            <div
              key={locale}
              className="rounded-md border border-slate-600 bg-slate-800 p-4 space-y-3"
            >
              <h3 className="text-sm font-medium text-slate-200">
                {locale}
              </h3>

              <div>
                <label
                  htmlFor={`cadence-days-${locale}`}
                  className={labelCls()}
                >
                  Cadence
                </label>
                <select
                  id={`cadence-days-${locale}`}
                  defaultValue={cadence?.cadence_days?.toString() ?? ''}
                  onChange={(e) =>
                    handleUpdate(locale, {
                      cadence_days: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className={inputCls(false)}
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
                  defaultValue={cadence?.preferred_send_time ?? '08:00'}
                  onChange={(e) =>
                    handleUpdate(locale, {
                      preferred_send_time: e.target.value,
                    })
                  }
                  className={inputCls(false)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {saveState === 'saving' && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      )}
      {saveState === 'success' && (
        <span className="text-sm text-emerald-400">Salvo</span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Localization                                             */
/* ------------------------------------------------------------------ */

function LocalizationSection({ site }: { site: SiteData }) {
  const [defaultLocale, setDefaultLocale] = useState(site.default_locale)
  const [locales, setLocales] = useState(site.supported_locales)
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()

  const handleSubmit = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
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
    [defaultLocale, locales, setSaveState],
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
              {l !== defaultLocale && (
                <button
                  type="button"
                  onClick={() => removeLocale(l)}
                  className="ml-1 text-slate-400 hover:text-red-400"
                  aria-label={`Remove ${l}`}
                >
                  x
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

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

      <SaveButton state={saveState} />
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
            disabled={
              confirmSlug !== site.slug || deleteState === 'saving'
            }
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
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState<SectionId>(
    (searchParams.get('section') as SectionId) ||
      (initialSection as SectionId) ||
      'branding',
  )

  const switchSection = useCallback(
    (id: SectionId) => {
      setActiveSection(id)
      const params = new URLSearchParams(searchParams.toString())
      params.set('section', id)
      router.replace(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  /* Keyboard shortcuts */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      /* Ignore if user is typing in an input/textarea/select */
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      /* Cmd/Ctrl+S => submit current form */
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const form = document.querySelector(
          '[data-settings-section="' + activeSection + '"] form',
        ) as HTMLFormElement | null
        /* If the section itself is a form, use that; otherwise look for nested form */
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

      /* Esc => blur current input */
      if (e.key === 'Escape') {
        ;(document.activeElement as HTMLElement)?.blur?.()
        return
      }

      /* 1-6 number keys => switch tab (only when not in an input) */
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

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[#0f172a]">
      {/* Sidebar */}
      <nav className="w-56 shrink-0 border-r border-slate-700 bg-slate-900/50 p-4">
        <ul className="space-y-1">
          {SECTIONS.map((s, i) => (
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
      <main className="flex-1 p-6 overflow-y-auto">
        <div
          className="mx-auto max-w-2xl"
          data-settings-section={activeSection}
        >
          {activeSection === 'branding' && <BrandingSection site={site} />}
          {activeSection === 'seo' && <SeoSection site={site} />}
          {activeSection === 'newsletters' && (
            <NewslettersSection newsletterTypes={newsletterTypes} />
          )}
          {activeSection === 'blog-cadence' && (
            <BlogCadenceSection blogCadence={blogCadence} site={site} />
          )}
          {activeSection === 'localization' && (
            <LocalizationSection site={site} />
          )}
          {activeSection === 'danger-zone' && (
            <DangerZoneSection site={site} />
          )}
        </div>
      </main>
    </div>
  )
}
