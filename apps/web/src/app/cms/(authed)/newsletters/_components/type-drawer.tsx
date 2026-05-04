'use client'

import { useState, useEffect, useRef, useId, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createNewsletterType,
  updateNewsletterType,
  deleteNewsletterType,
  getNewsletterTypeForEdit,
  uploadNewsletterTypeImage,
  getUnlinkedTags,
} from '../actions'
import { deriveCadenceLabel } from '@/lib/newsletter/format'
import type { NewsletterHubStrings } from '../_i18n/types'
import { COLOR_PALETTE } from '../../_shared/color-palette'
import type { UsedColor } from '../../_shared/color-palette'

const FOCUSABLE = 'input, select, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])'

const RESERVED_SLUGS = new Set([
  'archive', 'subscribe', 'new', 'settings', 'edit', 'confirm', 'api', 'admin', 'hub', 'rss', 'feed',
])

function generateSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function normalizeHex(val: string): string {
  const clean = val.replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(clean)) return `#${clean}`
  return val
}

export interface TypeDrawerData {
  id: string
  name: string
  tagline: string | null
  locale: string
  slug: string
  badge: string | null
  description: string | null
  color: string
  colorDark: string | null
  ogImageUrl: string | null
  landingPromise: string[]
  cadenceDays: number
  cadenceStartDate: string | null
  cadencePaused: boolean
  subscriberCount: number
  editionCount: number
  linkedTag: { id: string; name: string; color: string | null } | null
}

interface UnlinkedTag {
  id: string
  name: string
  slug: string
  color: string | null
  colorDark: string | null
}

interface PromiseItem { key: number; value: string }

interface TypeDrawerProps {
  open: boolean
  mode: 'create' | 'edit'
  typeId?: string | null
  onClose: () => void
  locale: 'en' | 'pt-BR'
  strings: NewsletterHubStrings['typeDrawer']
  existingBadges?: string[]
  siteId?: string
  usedColors?: UsedColor[]
}

export function TypeDrawer({ open, mode, typeId, onClose, locale, strings, existingBadges = [], siteId, usedColors = [] }: TypeDrawerProps) {
  const router = useRouter()
  const titleId = useId()
  const fid = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const nextPromiseKey = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [drawerLocale, setDrawerLocale] = useState<string>(locale)
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [badge, setBadge] = useState('')
  const [description, setDescription] = useState('')
  const [promiseItems, setPromiseItems] = useState<PromiseItem[]>([])
  const [color, setColor] = useState('#7c3aed')
  const [colorDark, setColorDark] = useState('')
  const [ogImageUrl, setOgImageUrl] = useState('')

  const [linkedTagId, setLinkedTagId] = useState<string | null>(null)
  const [initialLinkedTagId, setInitialLinkedTagId] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<UnlinkedTag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

  const [editData, setEditData] = useState<TypeDrawerData | null>(null)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<null | 'confirm' | 'name-check'>(null)
  const [deleteInfo, setDeleteInfo] = useState<{ subscriberCount: number; editionCount: number } | null>(null)
  const [deleteNameInput, setDeleteNameInput] = useState('')

  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (open) {
      setVisible(true)
      setErrors({})
      setDeleteConfirmStep(null)
      setDeleteInfo(null)
      setDeleteNameInput('')
      if (mode === 'edit' && typeId) {
        setLoading(true)
        getNewsletterTypeForEdit(typeId).then((res) => {
          if (res.ok) {
            const t = res.type
            setEditData(t)
            setName(t.name)
            setTagline(t.tagline ?? '')
            setDrawerLocale(t.locale)
            setSlug(t.slug)
            setSlugManual(true)
            setBadge(t.badge ?? '')
            setDescription(t.description ?? '')
            setPromiseItems(t.landingPromise.map(v => ({ key: nextPromiseKey.current++, value: v })))
            setColor(t.color)
            setColorDark(t.colorDark ?? '')
            setOgImageUrl(t.ogImageUrl ?? '')
            const tagLinkId = t.linkedTag?.id ?? null
            setLinkedTagId(tagLinkId)
            setInitialLinkedTagId(tagLinkId)
          } else {
            toast.error(strings.typeNotFound)
            onCloseRef.current()
          }
          setLoading(false)
        })
      } else {
        setEditData(null)
        setName('')
        setTagline('')
        setDrawerLocale(locale)
        setSlug('')
        setSlugManual(false)
        setBadge('')
        setDescription('')
        setPromiseItems([])
        setColor('#7c3aed')
        setColorDark('')
        setOgImageUrl('')
        setLinkedTagId(null)
        setInitialLinkedTagId(null)
      }
      // Fetch available tags for linking
      if (siteId) {
        setTagsLoading(true)
        getUnlinkedTags(siteId, mode === 'edit' && typeId ? typeId : undefined)
          .then((tags) => setAvailableTags(tags))
          .catch(() => setAvailableTags([]))
          .finally(() => setTagsLoading(false))
      }
    }
  }, [open, mode, typeId, locale, siteId])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(() => onCloseRef.current(), 200)
  }, [])

  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const panel = panelRef.current
    if (!panel) return
    requestAnimationFrame(() => {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    })

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { handleClose(); return }
      if (e.key !== 'Tab') return
      const els = panel!.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!els.length) return
      const first = els[0] as HTMLElement | undefined
      const last = els[els.length - 1] as HTMLElement | undefined
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, handleClose])

  function handleNameBlur() {
    if (mode === 'create' && !slugManual && name.trim()) {
      setSlug(generateSlug(name))
    }
  }

  function handleSlugChange(val: string) {
    setSlugManual(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  function addPromiseItem() {
    if (promiseItems.length >= 10) return
    setPromiseItems([...promiseItems, { key: nextPromiseKey.current++, value: '' }])
  }

  function removePromiseItem(idx: number) {
    setPromiseItems(promiseItems.filter((_, i) => i !== idx))
  }

  function updatePromiseItem(idx: number, val: string) {
    setPromiseItems(promiseItems.map((item, i) => (i === idx ? { ...item, value: val } : item)))
  }

  function movePromiseItem(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= promiseItems.length) return
    const next = [...promiseItems]
    const tmp = next[idx]!
    next[idx] = next[target]!
    next[target] = tmp
    setPromiseItems(next)
  }

  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadNewsletterTypeImage(fd)
    setUploading(false)
    if (result.ok) {
      setOgImageUrl(result.url)
    } else {
      toast.error(result.error === 'file_too_large' ? strings.uploadMaxError : result.error === 'unsupported_format' ? strings.uploadFormatError : result.error)
    }
  }, [strings.uploadMaxError, strings.uploadFormatError])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = strings.valRequired
    if (!slug.trim()) errs.slug = strings.valRequired
    else if (slug.length < 3) errs.slug = strings.valMinChars
    else if (slug.length > 80) errs.slug = strings.valMaxChars
    else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 2) errs.slug = strings.valInvalidFormat
    else if (RESERVED_SLUGS.has(slug)) errs.slug = strings.valReservedSlug
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) errs.color = strings.valInvalidHex
    if (colorDark && !/^#[0-9a-fA-F]{6}$/.test(colorDark)) errs.colorDark = strings.valInvalidHex
    if (ogImageUrl && !ogImageUrl.startsWith('https://')) errs.ogImageUrl = strings.valHttpsRequired
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    const cleanPromise = promiseItems.map(i => i.value).filter((s) => s.trim())
    const payload = {
      name: name.trim(),
      tagline: tagline.trim() || undefined,
      locale: drawerLocale,
      color,
      colorDark: colorDark || undefined,
      slug: slug.trim(),
      description: description.trim() || undefined,
      badge: badge.trim() || undefined,
      ogImageUrl: ogImageUrl.trim() || undefined,
      landingPromise: cleanPromise.length > 0 ? cleanPromise : undefined,
      linkedTagId: linkedTagId ?? undefined,
    }

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createNewsletterType(payload)
        if (result.ok) {
          toast.success(strings.toastCreated.replace('{name}', name.trim()))
          handleClose()
          router.refresh()
        } else {
          if (result.error.includes('slug') || result.error.includes('unique')) {
            setErrors({ slug: strings.valSlugInUse })
          } else {
            toast.error(result.error)
          }
        }
      } else if (editData) {
        const tagLinkChanged = linkedTagId !== initialLinkedTagId
        const result = await updateNewsletterType(editData.id, {
          ...payload,
          colorDark: colorDark || null,
          description: description.trim() || null,
          badge: badge.trim() || null,
          ogImageUrl: ogImageUrl.trim() || null,
          landingPromise: cleanPromise,
          ...(tagLinkChanged ? { linkedTagId } : {}),
        })
        if (result.ok) {
          toast.success(strings.toastSaved)
          handleClose()
          router.refresh()
        } else {
          toast.error('error' in result ? result.error : strings.unknownError)
        }
      }
    })
  }

  function handleDeleteClick() {
    if (!editData) return
    startTransition(async () => {
      const probe = await deleteNewsletterType(editData.id)
      if (probe.ok) {
        toast.success(strings.toastDeleted.replace('{name}', editData.name))
        handleClose()
        router.refresh()
        return
      }
      if (!('subscriberCount' in probe)) {
        toast.error(probe.error)
        return
      }
      const hasDeps = (probe.subscriberCount ?? 0) > 0 || (probe.editionCount ?? 0) > 0
      setDeleteInfo({ subscriberCount: probe.subscriberCount ?? 0, editionCount: probe.editionCount ?? 0 })
      setDeleteConfirmStep(hasDeps ? 'name-check' : 'confirm')
    })
  }

  function handleDeleteConfirm() {
    if (!editData) return
    if (deleteConfirmStep === 'name-check' && deleteNameInput !== editData.name) {
      toast.error(strings.deleteNameMismatch)
      return
    }
    startTransition(async () => {
      const result = await deleteNewsletterType(editData.id, { confirmed: true, confirmText: editData.name })
      if (result.ok) {
        toast.success(strings.toastDeleted.replace('{name}', editData.name))
        handleClose()
        router.refresh()
      } else {
        toast.error('error' in result ? result.error : strings.unknownError)
      }
    })
  }

  if (!open && !visible) return null

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${visible && open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      data-testid="type-drawer-backdrop"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute right-0 top-0 h-full w-full sm:w-[480px] bg-[#0a0a12] border-l border-gray-800 shadow-2xl flex flex-col transition-transform duration-200 ${visible && open ? 'translate-x-0' : 'translate-x-full'}`}
        data-testid="type-drawer-panel"
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-gray-100">
            {mode === 'create' ? strings.createTitle : strings.editTitle}
          </h2>
          <button type="button" onClick={handleClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none" aria-label={strings.close}>
            &#x2715;
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Section 1: Essentials */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{strings.sectionEssentials}</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`${fid}-name`} className="block text-sm font-medium text-gray-400 mb-1">{strings.nameLabel}</label>
                    <input
                      id={`${fid}-name`}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={handleNameBlur}
                      placeholder={strings.namePlaceholder}
                      maxLength={100}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? `${fid}-name-err` : undefined}
                      data-testid="drawer-name"
                    />
                    {errors.name && <p id={`${fid}-name-err`} className="text-xs text-red-400 mt-1" role="alert">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor={`${fid}-tagline`} className="block text-sm font-medium text-gray-400 mb-1">{strings.taglineLabel}</label>
                    <input
                      id={`${fid}-tagline`}
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder={strings.taglinePlaceholder}
                      maxLength={200}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                      data-testid="drawer-tagline"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${fid}-locale`} className="block text-sm font-medium text-gray-400 mb-1">{strings.localeLabel}</label>
                    <select
                      id={`${fid}-locale`}
                      value={drawerLocale}
                      onChange={(e) => setDrawerLocale(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                      aria-required="true"
                      data-testid="drawer-locale"
                    >
                      <option value="pt-BR">Portugu&#xEA;s (BR)</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor={`${fid}-slug`} className="block text-sm font-medium text-gray-400 mb-1">{strings.slugLabel}</label>
                    <input
                      id={`${fid}-slug`}
                      type="text"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 font-mono placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.slug}
                      aria-describedby={errors.slug ? `${fid}-slug-err` : `${fid}-slug-hint`}
                      data-testid="drawer-slug"
                    />
                    <p id={`${fid}-slug-hint`} className="text-[11px] text-gray-600 mt-1">
                      {strings.slugPreview}<span className="font-mono text-gray-400">{slug || '...'}</span>
                    </p>
                    {mode === 'edit' && editData && slug !== editData.slug && (
                      <p className="text-[11px] text-amber-400 mt-0.5">&#x26A0; {strings.slugWarning}</p>
                    )}
                    {errors.slug && <p id={`${fid}-slug-err`} className="text-xs text-red-400 mt-1" role="alert">{errors.slug}</p>}
                  </div>
                </div>
              </section>

              {/* Section 2: Landing Page Content */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{strings.sectionLanding}</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`${fid}-badge`} className="block text-sm font-medium text-gray-400 mb-1">{strings.badgeLabel}</label>
                    <input
                      id={`${fid}-badge`}
                      type="text"
                      list={existingBadges.length > 0 ? `${fid}-badge-list` : undefined}
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder={strings.badgePlaceholder}
                      maxLength={30}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                      aria-describedby={`${fid}-badge-hint`}
                      data-testid="drawer-badge"
                    />
                    <p id={`${fid}-badge-hint`} className="text-[11px] text-gray-600 mt-1">{strings.badgeHint}</p>
                    {existingBadges.length > 0 && (
                      <datalist id={`${fid}-badge-list`}>
                        {existingBadges.map((b) => <option key={b} value={b} />)}
                      </datalist>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`${fid}-desc`} className="block text-sm font-medium text-gray-400 mb-1">{strings.descriptionLabel}</label>
                    <textarea
                      id={`${fid}-desc`}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={strings.descriptionPlaceholder}
                      rows={4}
                      maxLength={1000}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
                      data-testid="drawer-description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">{strings.promiseLabel}</label>
                    <div className="space-y-2" data-testid="drawer-promise-list">
                      {promiseItems.map((item, idx) => (
                        <div key={item.key} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) => updatePromiseItem(idx, e.target.value)}
                            placeholder={strings.promiseItemPlaceholder}
                            maxLength={200}
                            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                            aria-label={`${strings.promiseLabel} ${idx + 1}`}
                          />
                          <button type="button" onClick={() => movePromiseItem(idx, -1)} disabled={idx === 0} className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30" aria-label={strings.moveUp}>&uarr;</button>
                          <button type="button" onClick={() => movePromiseItem(idx, 1)} disabled={idx === promiseItems.length - 1} className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30" aria-label={strings.moveDown}>&darr;</button>
                          <button type="button" onClick={() => removePromiseItem(idx)} className="p-1 text-red-400 hover:text-red-300" aria-label={strings.removeItem}>&#x2715;</button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addPromiseItem}
                      disabled={promiseItems.length >= 10}
                      className="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid="drawer-promise-add"
                    >
                      + {strings.promiseAdd}
                    </button>
                    {promiseItems.length >= 10 && (
                      <p className="text-[11px] text-gray-600 mt-1">{strings.promiseMax}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Section 3: Appearance */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{strings.sectionAppearance}</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`${fid}-color`} className="block text-sm font-medium text-gray-400 mb-1">{strings.colorLabel}</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COLOR_PALETTE.map((preset) => {
                        const isSelected = color.toLowerCase() === preset.light.toLowerCase()
                        const owner = usedColors.find((u) => u.color.toLowerCase() === preset.light.toLowerCase())
                        const isSelf = mode === 'edit' && editData?.color.toLowerCase() === preset.light.toLowerCase()
                        const isTaken = !!owner && !isSelf
                        return (
                          <div key={preset.light} className="relative group">
                            <button
                              type="button"
                              onClick={() => { setColor(preset.light); setColorDark(preset.dark) }}
                              className={`h-7 w-7 rounded-full border-2 transition-transform ${isSelected ? 'border-white scale-110' : isTaken ? 'border-transparent opacity-40' : 'border-transparent'}`}
                              style={{ backgroundColor: preset.light }}
                              aria-label={`${preset.label}${isTaken ? ` (${owner.entityName})` : ''}`}
                              aria-pressed={isSelected}
                            />
                            {isTaken && (
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                {owner.entityName}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-7 w-7 rounded cursor-pointer border border-gray-700"
                        aria-label="Custom color picker"
                      />
                    </div>
                    <input
                      id={`${fid}-color`}
                      type="text"
                      value={color}
                      onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value) }}
                      onBlur={() => setColor(normalizeHex(color))}
                      className="w-28 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 font-mono focus:border-indigo-500 focus:outline-none"
                      aria-invalid={!!errors.color}
                      aria-describedby={errors.color ? `${fid}-color-err` : undefined}
                      data-testid="drawer-color"
                    />
                    {errors.color && <p id={`${fid}-color-err`} className="text-xs text-red-400 mt-1" role="alert">{errors.color}</p>}
                  </div>

                  <div>
                    <label htmlFor={`${fid}-colordark`} className="block text-sm font-medium text-gray-400 mb-1">{strings.colorDarkLabel}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorDark || '#000000'}
                        onChange={(e) => setColorDark(e.target.value)}
                        className="h-7 w-7 rounded cursor-pointer border border-gray-700"
                        aria-label="Dark color picker"
                      />
                      <input
                        id={`${fid}-colordark`}
                        type="text"
                        value={colorDark}
                        onChange={(e) => {
                          const v = e.target.value
                          if (/^#[0-9a-fA-F]{0,6}$/.test(v) || /^[0-9a-fA-F]{0,6}$/.test(v)) setColorDark(v)
                        }}
                        onBlur={() => { if (colorDark) setColorDark(normalizeHex(colorDark)) }}
                        placeholder="#RRGGBB"
                        className="w-28 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 font-mono placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                        aria-invalid={!!errors.colorDark}
                        aria-describedby={errors.colorDark ? `${fid}-colordark-err` : `${fid}-colordark-hint`}
                        data-testid="drawer-color-dark"
                      />
                      {colorDark && (
                        <button type="button" onClick={() => setColorDark('')} className="text-xs text-gray-500 hover:text-gray-300">{strings.clearColor}</button>
                      )}
                    </div>
                    <p id={`${fid}-colordark-hint`} className="text-[11px] text-gray-600 mt-1">{strings.colorDarkHint}</p>
                    {errors.colorDark && <p id={`${fid}-colordark-err`} className="text-xs text-red-400 mt-1" role="alert">{errors.colorDark}</p>}
                  </div>

                  <div>
                    <label htmlFor={`${fid}-og`} className="block text-sm font-medium text-gray-400 mb-1">{strings.ogImageLabel}</label>
                    {ogImageUrl && /^https:\/\/.+/.test(ogImageUrl) && (
                      <div className="mb-2 relative group rounded-lg border border-gray-800 overflow-hidden">
                        <img
                          src={ogImageUrl}
                          alt="OG preview"
                          className="h-28 w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => setOgImageUrl('')}
                          className="absolute top-1.5 right-1.5 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
                          aria-label={strings.removeImage}
                        >
                          &#x2715;
                        </button>
                      </div>
                    )}
                    <div
                      className={`rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors ${
                        uploading ? 'border-indigo-500/50 bg-indigo-950/10' : 'border-gray-700 hover:border-gray-600'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const file = e.dataTransfer.files[0]
                        if (file) handleFileUpload(file)
                      }}
                      data-testid="drawer-og-dropzone"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file)
                          e.target.value = ''
                        }}
                        data-testid="drawer-og-file-input"
                      />
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                          <span className="text-xs text-gray-400">{strings.uploadUploading}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-gray-400 hover:text-gray-200"
                        >
                          <span className="text-indigo-400">{strings.uploadImage}</span> {strings.uploadDragDrop}
                          <br />
                          <span className="text-[10px] text-gray-600">{strings.uploadFormats}</span>
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-gray-600">{strings.uploadOr}</span>
                      <input
                        id={`${fid}-og`}
                        type="url"
                        value={ogImageUrl}
                        onChange={(e) => setOgImageUrl(e.target.value)}
                        placeholder={strings.ogImagePlaceholder}
                        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                        aria-invalid={!!errors.ogImageUrl}
                        aria-describedby={errors.ogImageUrl ? `${fid}-og-err` : undefined}
                        data-testid="drawer-og-image"
                      />
                    </div>
                    {errors.ogImageUrl && <p id={`${fid}-og-err`} className="text-xs text-red-400 mt-1" role="alert">{errors.ogImageUrl}</p>}
                  </div>
                </div>
              </section>

              {/* Section: Link to Tag */}
              {siteId && (
                <section data-testid="drawer-link-tag-section">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{strings.sectionLinkTag}</h3>
                  {tagsLoading ? (
                    <p className="text-xs text-gray-600">{strings.linkTagLoading}</p>
                  ) : linkedTagId ? (
                    <div className="rounded-lg border border-gray-800 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: availableTags.find((t) => t.id === linkedTagId)?.color ?? editData?.linkedTag?.color ?? '#6b7280' }}
                        />
                        <span className="text-sm text-gray-200 font-medium">
                          {availableTags.find((t) => t.id === linkedTagId)?.name ?? editData?.linkedTag?.name ?? '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600">{strings.linkTagSyncHint}</p>
                      <button
                        type="button"
                        onClick={() => setLinkedTagId(null)}
                        className="text-xs text-red-400 hover:text-red-300"
                        data-testid="drawer-unlink-tag"
                      >
                        {strings.linkTagUnlink}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor={`${fid}-tag`} className="block text-sm font-medium text-gray-400 mb-1">{strings.linkTagLabel}</label>
                      <select
                        id={`${fid}-tag`}
                        value=""
                        onChange={(e) => { if (e.target.value) setLinkedTagId(e.target.value) }}
                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                        data-testid="drawer-link-tag-select"
                      >
                        <option value="">{strings.linkTagNone}</option>
                        {availableTags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.color ? `● ` : ''}{tag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </section>
              )}

              {/* Section 4: Schedule (edit mode only) */}
              {mode === 'edit' && editData && (
                <section data-testid="drawer-schedule-section">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{strings.sectionSchedule}</h3>
                  <div className="rounded-lg border border-gray-800 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-200">
                        {deriveCadenceLabel(null, editData.cadenceDays, locale, editData.cadenceStartDate) ?? '—'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        editData.cadencePaused
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {editData.cadencePaused ? strings.statusPaused : strings.statusActive}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { handleClose(); router.push('/cms/newsletters?tab=schedule') }}
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      {strings.scheduleLink} &rarr;
                    </button>
                  </div>
                </section>
              )}

              {/* Danger Zone (edit mode only) */}
              {mode === 'edit' && editData && (
                <section className="border-t border-gray-800 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">{strings.dangerZone}</h3>
                  {deleteConfirmStep === null ? (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={isPending}
                      className="w-full rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      data-testid="drawer-delete"
                    >
                      {isPending ? '...' : strings.deleteButton}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-4 space-y-3" data-testid="drawer-delete-confirm">
                      <p className="text-sm text-red-300">
                        {deleteConfirmStep === 'confirm'
                          ? strings.deleteConfirmEmpty.replace('{name}', editData.name)
                          : strings.deleteConfirmDeps
                              .replace('{subscribers}', String(deleteInfo?.subscriberCount ?? 0))
                              .replace('{editions}', String(deleteInfo?.editionCount ?? 0))
                        }
                      </p>
                      {deleteConfirmStep === 'name-check' && (
                        <input
                          type="text"
                          value={deleteNameInput}
                          onChange={(e) => setDeleteNameInput(e.target.value)}
                          placeholder={editData.name}
                          className="w-full rounded-lg border border-red-500/30 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-red-500 focus:outline-none"
                          aria-label={strings.typeNameToConfirm}
                          data-testid="drawer-delete-name-input"
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setDeleteConfirmStep(null); setDeleteNameInput('') }}
                          className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800"
                        >
                          {strings.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteConfirm}
                          disabled={isPending || (deleteConfirmStep === 'name-check' && deleteNameInput !== editData.name)}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid="drawer-delete-confirm-btn"
                        >
                          {isPending ? '...' : strings.deleteButton}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-800 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800"
              >
                {strings.cancel}
              </button>
              <button
                type="submit"
                disabled={isPending || !name.trim()}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-busy={isPending}
                data-testid="drawer-submit"
              >
                {isPending
                  ? (mode === 'create' ? strings.creating : strings.saving)
                  : (mode === 'create' ? strings.createButton : strings.saveButton)
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
