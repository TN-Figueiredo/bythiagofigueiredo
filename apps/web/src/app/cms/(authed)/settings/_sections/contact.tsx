'use client'

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  type FormEvent,
} from 'react'
import {
  updateContactHeroText,
  updateContactHeroDisplay,
  updateContactSocial,
  updateContactFormSettings,
  updateContactFormText,
  updateContactFaq,
  updateContactVisibility,
} from '../actions'
import { getDefaultSettings, DEFAULT_VISIBILITY } from '@/lib/contact/defaults'
import type { ContactPageSettings, ContactPageVisibility } from '@/lib/contact/types'
import {
  type SiteData,
  useSaveState,
  SaveButton,
  FieldError,
  CharCount,
  inputCls,
  labelCls,
  sectionCls,
} from './_shared'

/* ------------------------------------------------------------------ */
/*  Types & constants                                                 */
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

/* ------------------------------------------------------------------ */
/*  LocaleTabs                                                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  ContactPageSection (main)                                         */
/* ------------------------------------------------------------------ */

export function ContactPageSection({
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
  const dirtyRef = useRef<Record<ContactSubTab, boolean>>({
    hero: false,
    social: false,
    form: false,
    faq: false,
    visibility: false,
  })
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
    dirtyRef.current[tab] = true
    setDirtyState((prev) => ({ ...prev, [tab]: true }))
  }
  const markClean = (tab: ContactSubTab) => {
    dirtyRef.current[tab] = false
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

/* ------------------------------------------------------------------ */
/*  Contact sub-tab: Hero & Textos                                    */
/* ------------------------------------------------------------------ */

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
          <CharCount current={cur.hero_title.length} max={80} />
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
          <CharCount current={cur.hero_subtitle.length} max={300} />
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

/* ------------------------------------------------------------------ */
/*  Contact sub-tab: Social Links                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Contact sub-tab: Formulário                                       */
/* ------------------------------------------------------------------ */

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
              <CharCount current={cur.auto_reply_text.length} max={500} />
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

/* ------------------------------------------------------------------ */
/*  Contact sub-tab: FAQ                                              */
/* ------------------------------------------------------------------ */

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
            key={`faq-${locale}-${idx}-${item.q.slice(0, 20)}`}
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

/* ------------------------------------------------------------------ */
/*  Contact sub-tab: Visibilidade                                     */
/* ------------------------------------------------------------------ */

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
