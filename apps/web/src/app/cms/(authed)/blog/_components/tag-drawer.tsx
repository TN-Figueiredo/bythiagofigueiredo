'use client'

import { useState, useEffect, useRef, useId, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createTag, updateTag, deleteTag } from '../actions'
import type { BlogTag } from '../_hub/hub-types'
import type { BlogHubStrings } from '../_i18n/types'

const COLOR_PRESETS = [
  '#7c3aed', '#ea580c', '#2563eb', '#16a34a', '#dc2626',
  '#ca8a04', '#0891b2', '#db2777',
]

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

interface TagDrawerProps {
  open: boolean
  mode: 'create' | 'edit'
  tagId?: string | null
  tags?: BlogTag[]
  onClose: () => void
  locale: 'en' | 'pt-BR'
  strings: BlogHubStrings['tagDrawer']
}

export function TagDrawer({ open, mode, tagId, tags = [], onClose, strings }: TagDrawerProps) {
  const router = useRouter()
  const titleId = useId()
  const fid = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [isPending, startTransition] = useTransition()
  const [visible, setVisible] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [badge, setBadge] = useState('')
  const [color, setColor] = useState('#7c3aed')
  const [colorDark, setColorDark] = useState('')

  const [editTag, setEditTag] = useState<BlogTag | null>(null)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<null | 'confirm' | 'name-check'>(null)
  const [deleteNameInput, setDeleteNameInput] = useState('')

  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (open) {
      setVisible(true)
      setErrors({})
      setDeleteConfirmStep(null)
      setDeleteNameInput('')
      if (mode === 'edit' && tagId) {
        const found = tags.find((t) => t.id === tagId) ?? null
        setEditTag(found)
        if (found) {
          setName(found.name)
          setSlug(found.slug)
          setSlugManual(true)
          setBadge(found.badge ?? '')
          setColor(found.color)
          setColorDark(found.colorDark ?? '')
        } else {
          setName('')
          setSlug('')
          setSlugManual(false)
          setBadge('')
          setColor('#7c3aed')
          setColorDark('')
        }
      } else {
        setEditTag(null)
        setName('')
        setSlug('')
        setSlugManual(false)
        setBadge('')
        setColor('#7c3aed')
        setColorDark('')
      }
    }
  }, [open, mode, tagId, tags])

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
    if (!slugManual && name.trim()) {
      setSlug(generateSlug(name))
    }
  }

  function handleSlugChange(val: string) {
    setSlugManual(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = strings.valRequired
    if (!slug.trim()) errs.slug = strings.valRequired
    else if (slug.length < 2) errs.slug = strings.valMinChars
    else if (slug.length > 50) errs.slug = strings.valMaxChars
    else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 2) errs.slug = strings.valInvalidFormat
    else if (RESERVED_SLUGS.has(slug)) errs.slug = strings.valReservedSlug
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) errs.color = strings.valInvalidHex
    if (colorDark && !/^#[0-9a-fA-F]{6}$/.test(colorDark)) errs.colorDark = strings.valInvalidHex
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    const payload = {
      name: name.trim(),
      color,
      colorDark: colorDark || null,
      badge: badge.trim() || null,
    }

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createTag(payload)
        if (result.ok) {
          toast.success(strings.toastCreated)
          handleClose()
          router.refresh()
        } else {
          if (result.error.includes('slug') || result.error.includes('unique') || result.error === 'name_already_exists') {
            setErrors({ slug: strings.valSlugInUse })
          } else {
            toast.error(result.error)
          }
        }
      } else if (editTag) {
        const result = await updateTag(editTag.id, payload)
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
    if (!editTag) return
    startTransition(async () => {
      const probe = await deleteTag(editTag.id)
      if (probe.ok) {
        toast.success(strings.toastDeleted)
        handleClose()
        router.refresh()
        return
      }
      if ('postCount' in probe && (probe.postCount ?? 0) > 0) {
        setDeleteConfirmStep('name-check')
      } else {
        setDeleteConfirmStep('confirm')
      }
    })
  }

  function handleDeleteConfirm() {
    if (!editTag) return
    if (deleteConfirmStep === 'name-check' && deleteNameInput !== editTag.name) {
      toast.error(strings.deleteNameMismatch)
      return
    }
    // Can't delete if posts exist — only show name-check for documentation;
    // the actual server action will block it. For 'confirm' case (0 posts), re-try delete.
    if (deleteConfirmStep === 'confirm') {
      startTransition(async () => {
        const result = await deleteTag(editTag.id)
        if (result.ok) {
          toast.success(strings.toastDeleted)
          handleClose()
          router.refresh()
        } else {
          toast.error('error' in result ? result.error : strings.unknownError)
        }
      })
    }
  }

  if (!open && !visible) return null

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${visible && open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      data-testid="tag-drawer-backdrop"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute right-0 top-0 h-full w-full sm:w-[440px] bg-[#0a0a12] border-l border-gray-800 shadow-2xl flex flex-col transition-transform duration-200 ${visible && open ? 'translate-x-0' : 'translate-x-full'}`}
        data-testid="tag-drawer-panel"
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-gray-100">
            {mode === 'create' ? strings.createTitle : strings.editTitle}
          </h2>
          <button type="button" onClick={handleClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none" aria-label={strings.close}>
            &#x2715;
          </button>
        </div>

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
                      {strings.slugPreview} <span className="font-mono text-gray-400">{slug || '...'}</span>
                    </p>
                    {mode === 'edit' && editTag && slug !== editTag.slug && (
                      <p className="text-[11px] text-amber-400 mt-0.5">&#x26A0; {strings.slugWarning}</p>
                    )}
                    {errors.slug && <p id={`${fid}-slug-err`} className="text-xs text-red-400 mt-1" role="alert">{errors.slug}</p>}
                  </div>

                  <div>
                    <label htmlFor={`${fid}-badge`} className="block text-sm font-medium text-gray-400 mb-1">{strings.badgeLabel}</label>
                    <input
                      id={`${fid}-badge`}
                      type="text"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder={strings.badgePlaceholder}
                      maxLength={30}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                      aria-describedby={`${fid}-badge-hint`}
                      data-testid="drawer-badge"
                    />
                    <p id={`${fid}-badge-hint`} className="text-[11px] text-gray-600 mt-1">{strings.badgeHint}</p>
                  </div>
                </div>
              </section>

              {/* Section 2: Appearance */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{strings.sectionAppearance}</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`${fid}-color`} className="block text-sm font-medium text-gray-400 mb-1">{strings.colorLabel}</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                          aria-label={`Select color ${c}`}
                          aria-pressed={color === c}
                        />
                      ))}
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
                </div>
              </section>

              {/* Danger Zone (edit mode only) */}
              {mode === 'edit' && editTag && (
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
                        {deleteConfirmStep === 'name-check'
                          ? strings.deleteConfirmDeps.replace('{count}', String(editTag.postCount))
                          : strings.deleteConfirmDeps.replace('{count}', '0')
                        }
                      </p>
                      {deleteConfirmStep === 'name-check' && (
                        <>
                          <p className="text-xs text-gray-400">{strings.typeNameToConfirm}</p>
                          <input
                            type="text"
                            value={deleteNameInput}
                            onChange={(e) => setDeleteNameInput(e.target.value)}
                            placeholder={editTag.name}
                            className="w-full rounded-lg border border-red-500/30 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-red-500 focus:outline-none"
                            aria-label={strings.typeNameToConfirm}
                            data-testid="drawer-delete-name-input"
                          />
                        </>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setDeleteConfirmStep(null); setDeleteNameInput('') }}
                          className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800"
                        >
                          {strings.cancel}
                        </button>
                        {deleteConfirmStep === 'confirm' && (
                          <button
                            type="button"
                            onClick={handleDeleteConfirm}
                            disabled={isPending}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="drawer-delete-confirm-btn"
                          >
                            {isPending ? '...' : strings.deleteButton}
                          </button>
                        )}
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
      </div>
    </div>
  )
}
