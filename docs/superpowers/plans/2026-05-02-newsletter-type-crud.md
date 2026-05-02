# Newsletter Type CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small TypeModal with a full-featured TypeDrawer that exposes ALL newsletter type fields for CRUD operations.

**Architecture:** Create a slide-in drawer component, add a `getNewsletterTypeForEdit` server action to fetch full type data on-demand, integrate drawer triggers into the existing hub (TypeFilterChips area), add i18n strings, and delete the old TypeModal.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, Vitest + RTL

---

### Task 1: Add i18n strings for the drawer

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts`

- [ ] **Step 1: Add `typeDrawer` shape to the `NewsletterHubStrings` interface**

In `_i18n/types.ts`, add a new `typeDrawer` key to the interface:

```typescript
export interface NewsletterHubStrings {
  // ... existing keys ...
  typeDrawer: {
    createTitle: string
    editTitle: string
    sectionEssentials: string
    sectionLanding: string
    sectionAppearance: string
    sectionSchedule: string
    nameLabel: string
    namePlaceholder: string
    taglineLabel: string
    taglinePlaceholder: string
    localeLabel: string
    slugLabel: string
    slugPreview: string
    slugWarning: string
    badgeLabel: string
    badgePlaceholder: string
    badgeHint: string
    descriptionLabel: string
    descriptionPlaceholder: string
    promiseLabel: string
    promiseAdd: string
    promiseMax: string
    promiseItemPlaceholder: string
    colorLabel: string
    colorDarkLabel: string
    colorDarkHint: string
    ogImageLabel: string
    ogImagePlaceholder: string
    scheduleLink: string
    dangerZone: string
    deleteButton: string
    deleteConfirmEmpty: string
    deleteConfirmDeps: string
    deleteNameMismatch: string
    createButton: string
    saveButton: string
    creating: string
    saving: string
    cancel: string
  }
}
```

- [ ] **Step 2: Add English strings**

In `_i18n/en.ts`, add the `typeDrawer` block inside the exported object, after the last existing key:

```typescript
typeDrawer: {
  createTitle: 'New Newsletter Type',
  editTitle: 'Edit Newsletter Type',
  sectionEssentials: 'Essentials',
  sectionLanding: 'Landing Page Content',
  sectionAppearance: 'Appearance',
  sectionSchedule: 'Schedule',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. Weekly Digest',
  taglineLabel: 'Tagline',
  taglinePlaceholder: 'A short italic subtitle',
  localeLabel: 'Language',
  slugLabel: 'Slug',
  slugPreview: 'bythiagofigueiredo.com/newsletters/',
  slugWarning: 'Changing the slug will break existing links',
  badgeLabel: 'Badge',
  badgePlaceholder: 'e.g. MAIN, NEW',
  badgeHint: 'Shown as a tag above the title on the landing page',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Describe what subscribers will receive',
  promiseLabel: 'What you get',
  promiseAdd: 'Add item',
  promiseMax: 'Maximum 10 items',
  promiseItemPlaceholder: 'Promise item...',
  colorLabel: 'Accent Color (Light)',
  colorDarkLabel: 'Accent Color (Dark)',
  colorDarkHint: 'Falls back to light color if empty',
  ogImageLabel: 'OG Image URL',
  ogImagePlaceholder: 'https://...',
  scheduleLink: 'Edit in Schedule tab',
  dangerZone: 'Danger Zone',
  deleteButton: 'Delete Newsletter Type',
  deleteConfirmEmpty: 'Delete "{name}"? This cannot be undone.',
  deleteConfirmDeps: 'This has {subscribers} subscribers and {editions} editions. Type the name to confirm:',
  deleteNameMismatch: 'Name does not match',
  createButton: 'Create',
  saveButton: 'Save Changes',
  creating: 'Creating...',
  saving: 'Saving...',
  cancel: 'Cancel',
},
```

- [ ] **Step 3: Add Portuguese strings**

In `_i18n/pt-BR.ts`, add the `typeDrawer` block:

```typescript
typeDrawer: {
  createTitle: 'Novo Tipo de Newsletter',
  editTitle: 'Editar Tipo de Newsletter',
  sectionEssentials: 'Essenciais',
  sectionLanding: 'Conteúdo da Landing Page',
  sectionAppearance: 'Aparência',
  sectionSchedule: 'Agenda',
  nameLabel: 'Nome',
  namePlaceholder: 'ex: Resumo Semanal',
  taglineLabel: 'Subtítulo',
  taglinePlaceholder: 'Um subtítulo curto em itálico',
  localeLabel: 'Idioma',
  slugLabel: 'Slug',
  slugPreview: 'bythiagofigueiredo.com/newsletters/',
  slugWarning: 'Alterar o slug vai quebrar links existentes',
  badgeLabel: 'Badge',
  badgePlaceholder: 'ex: PRINCIPAL, NOVO',
  badgeHint: 'Exibido como tag acima do título na landing page',
  descriptionLabel: 'Descrição',
  descriptionPlaceholder: 'Descreva o que os inscritos vão receber',
  promiseLabel: 'O que você recebe',
  promiseAdd: 'Adicionar item',
  promiseMax: 'Máximo 10 itens',
  promiseItemPlaceholder: 'Item da promessa...',
  colorLabel: 'Cor de Destaque (Claro)',
  colorDarkLabel: 'Cor de Destaque (Escuro)',
  colorDarkHint: 'Usa a cor clara se vazio',
  ogImageLabel: 'URL da Imagem OG',
  ogImagePlaceholder: 'https://...',
  scheduleLink: 'Editar na aba Agenda',
  dangerZone: 'Zona de Perigo',
  deleteButton: 'Excluir Tipo de Newsletter',
  deleteConfirmEmpty: 'Excluir "{name}"? Esta ação não pode ser desfeita.',
  deleteConfirmDeps: 'Este tipo tem {subscribers} inscritos e {editions} edições. Digite o nome para confirmar:',
  deleteNameMismatch: 'Nome não confere',
  createButton: 'Criar',
  saveButton: 'Salvar Alterações',
  creating: 'Criando...',
  saving: 'Salvando...',
  cancel: 'Cancelar',
},
```

- [ ] **Step 4: Run TypeScript check to confirm no type errors**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors related to `typeDrawer` keys.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts
git commit -m "feat(newsletter): add i18n strings for type CRUD drawer"
```

---

### Task 2: Add `getNewsletterTypeForEdit` server action

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Add the server action after `deleteNewsletterType` (around line 812)**

```typescript
export async function getNewsletterTypeForEdit(typeId: string): Promise<
  | { ok: true; type: {
      id: string; name: string; tagline: string | null; locale: string; slug: string
      badge: string | null; description: string | null; color: string; colorDark: string | null
      ogImageUrl: string | null; landingPromise: string[]; cadenceDays: number
      cadenceStartDate: string | null; cadencePaused: boolean; subscriberCount: number; editionCount: number
    }}
  | { ok: false; error: string }
> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('id, name, tagline, locale, slug, badge, description, color, color_dark, og_image_url, landing_content, cadence_days, cadence_start_date, cadence_paused')
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
    .single()
  if (!type) return { ok: false, error: 'not_found' }

  const { count: subscriberCount } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', typeId)
    .eq('status', 'confirmed')

  const { count: editionCount } = await supabase
    .from('newsletter_editions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_type_id', typeId)

  const lc = type.landing_content as { promise?: string[] } | null
  return {
    ok: true,
    type: {
      id: type.id as string,
      name: type.name as string,
      tagline: type.tagline as string | null,
      locale: type.locale as string,
      slug: type.slug as string,
      badge: type.badge as string | null,
      description: type.description as string | null,
      color: type.color as string,
      colorDark: type.color_dark as string | null,
      ogImageUrl: type.og_image_url as string | null,
      landingPromise: lc?.promise ?? [],
      cadenceDays: type.cadence_days as number,
      cadenceStartDate: type.cadence_start_date as string | null,
      cadencePaused: !!type.cadence_paused,
      subscriberCount: subscriberCount ?? 0,
      editionCount: editionCount ?? 0,
    },
  }
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts
git commit -m "feat(newsletter): add getNewsletterTypeForEdit server action"
```

---

### Task 3: Create TypeDrawer component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx`

This is the largest task. The component handles: slide-in/out animation, 4 sections (Essentials, Landing Page, Appearance, Schedule), promise list dynamic array, color picker with presets, slug auto-generation + preview, delete flow with probe/confirm, focus trap, and accessibility.

- [ ] **Step 1: Create the drawer component**

Create `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx` with the full implementation:

```tsx
'use client'

import { useState, useEffect, useRef, useId, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createNewsletterType,
  updateNewsletterType,
  deleteNewsletterType,
  getNewsletterTypeForEdit,
} from '../actions'
import { deriveCadenceLabel } from '@/lib/newsletter/format'
import type { NewsletterHubStrings } from '../_i18n/types'

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
}

interface TypeDrawerProps {
  open: boolean
  mode: 'create' | 'edit'
  typeId?: string | null
  onClose: () => void
  locale: 'en' | 'pt-BR'
  strings: NewsletterHubStrings['typeDrawer']
}

export function TypeDrawer({ open, mode, typeId, onClose, locale, strings }: TypeDrawerProps) {
  const router = useRouter()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [isPending, startTransition] = useTransition()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [drawerLocale, setDrawerLocale] = useState<string>(locale)
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [badge, setBadge] = useState('')
  const [description, setDescription] = useState('')
  const [promise, setPromise] = useState<string[]>([])
  const [color, setColor] = useState('#7c3aed')
  const [colorDark, setColorDark] = useState('')
  const [ogImageUrl, setOgImageUrl] = useState('')

  const [editData, setEditData] = useState<TypeDrawerData | null>(null)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setErrors({})
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
            setPromise(t.landingPromise.length > 0 ? t.landingPromise : [])
            setColor(t.color)
            setColorDark(t.colorDark ?? '')
            setOgImageUrl(t.ogImageUrl ?? '')
          } else {
            toast.error(res.error)
            onClose()
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
        setPromise([])
        setColor('#7c3aed')
        setColorDark('')
        setOgImageUrl('')
      }
    }
  }, [open, mode, typeId, locale, onClose])

  useEffect(() => {
    if (!visible) return
    const panel = panelRef.current
    if (!panel) return
    requestAnimationFrame(() => {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    })

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const els = panel!.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!els.length) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

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
    if (promise.length >= 10) return
    setPromise([...promise, ''])
  }

  function removePromiseItem(idx: number) {
    setPromise(promise.filter((_, i) => i !== idx))
  }

  function updatePromiseItem(idx: number, val: string) {
    setPromise(promise.map((item, i) => (i === idx ? val : item)))
  }

  function movePromiseItem(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= promise.length) return
    const next = [...promise]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setPromise(next)
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Required'
    if (!slug.trim()) errs.slug = 'Required'
    else if (slug.length < 3) errs.slug = 'Min 3 characters'
    else if (slug.length > 80) errs.slug = 'Max 80 characters'
    else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 2) errs.slug = 'Invalid format'
    else if (RESERVED_SLUGS.has(slug)) errs.slug = 'Reserved slug'
    if (ogImageUrl && !ogImageUrl.startsWith('https://')) errs.ogImageUrl = 'Must start with https://'
    if (colorDark && !/^#[0-9a-fA-F]{6}$/.test(colorDark)) errs.colorDark = 'Invalid hex color'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    const cleanPromise = promise.filter((s) => s.trim())
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
    }

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createNewsletterType(payload)
        if (result.ok) {
          toast.success(`"${name}" created`)
          handleClose()
          router.refresh()
        } else {
          if (result.error.includes('slug') || result.error.includes('unique')) {
            setErrors({ slug: 'Slug already in use' })
          } else {
            toast.error(result.error)
          }
        }
      } else if (editData) {
        const result = await updateNewsletterType(editData.id, {
          ...payload,
          colorDark: colorDark || null,
          description: description.trim() || null,
          badge: badge.trim() || null,
          ogImageUrl: ogImageUrl.trim() || null,
          landingPromise: cleanPromise,
        })
        if (result.ok) {
          toast.success(strings.saveButton.includes('Save') ? 'Changes saved' : 'Alterações salvas')
          handleClose()
          router.refresh()
        } else {
          toast.error('error' in result ? result.error : 'Unknown error')
        }
      }
    })
  }

  async function handleDelete() {
    if (!editData) return
    const probe = await deleteNewsletterType(editData.id)
    if (probe.ok) {
      toast.success(`"${editData.name}" deleted`)
      handleClose()
      router.refresh()
      return
    }
    if (!('subscriberCount' in probe)) {
      toast.error(probe.error)
      return
    }

    const hasDeps = (probe.subscriberCount ?? 0) > 0 || (probe.editionCount ?? 0) > 0
    if (!hasDeps) {
      const msg = strings.deleteConfirmEmpty.replace('{name}', editData.name)
      if (!window.confirm(msg)) return
    } else {
      const msg = strings.deleteConfirmDeps
        .replace('{subscribers}', String(probe.subscriberCount))
        .replace('{editions}', String(probe.editionCount))
      const input = window.prompt(`${msg}\n\n"${editData.name}"`)
      if (input === null) return
      if (input !== editData.name) {
        toast.error(strings.deleteNameMismatch)
        return
      }
    }

    const result = await deleteNewsletterType(editData.id, { confirmed: true, confirmText: editData.name })
    if (result.ok) {
      toast.success(`"${editData.name}" deleted`)
      handleClose()
      router.refresh()
    } else {
      toast.error('error' in result ? result.error : 'Unknown error')
    }
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
        className={`absolute right-0 top-0 h-full w-full sm:w-[480px] bg-cms-surface border-l border-cms-border shadow-2xl flex flex-col transition-transform duration-200 ${visible && open ? 'translate-x-0' : 'translate-x-full'}`}
        data-testid="type-drawer-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cms-border px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-cms-text">
            {mode === 'create' ? strings.createTitle : strings.editTitle}
          </h2>
          <button type="button" onClick={handleClose} className="text-cms-text-muted hover:text-cms-text text-xl leading-none" aria-label="Close">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cms-accent border-t-transparent" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* === Section 1: Essentials === */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim mb-3">{strings.sectionEssentials}</h3>
                <div className="space-y-3">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.nameLabel}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={handleNameBlur}
                      placeholder={strings.namePlaceholder}
                      className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.name}
                      data-testid="drawer-name"
                    />
                    {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                  </div>

                  {/* Tagline */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.taglineLabel}</label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder={strings.taglinePlaceholder}
                      maxLength={200}
                      className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
                      data-testid="drawer-tagline"
                    />
                  </div>

                  {/* Locale */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.localeLabel}</label>
                    <select
                      value={drawerLocale}
                      onChange={(e) => setDrawerLocale(e.target.value)}
                      className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-2 text-sm text-cms-text focus:border-cms-accent focus:outline-none"
                      aria-required="true"
                      data-testid="drawer-locale"
                    >
                      <option value="pt-BR">Português (BR)</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.slugLabel}</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-2 text-sm text-cms-text font-mono placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.slug}
                      data-testid="drawer-slug"
                    />
                    <p className="text-[11px] text-cms-text-dim mt-1">
                      {strings.slugPreview}<span className="font-mono">{slug || '...'}</span>
                    </p>
                    {mode === 'edit' && editData && slug !== editData.slug && (
                      <p className="text-[11px] text-amber-400 mt-0.5">⚠ {strings.slugWarning}</p>
                    )}
                    {errors.slug && <p className="text-xs text-red-400 mt-1">{errors.slug}</p>}
                  </div>
                </div>
              </section>

              {/* === Section 2: Landing Page Content === */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim mb-3">{strings.sectionLanding}</h3>
                <div className="space-y-3">
                  {/* Badge */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.badgeLabel}</label>
                    <input
                      type="text"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder={strings.badgePlaceholder}
                      maxLength={30}
                      className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
                      data-testid="drawer-badge"
                    />
                    <p className="text-[11px] text-cms-text-dim mt-1">{strings.badgeHint}</p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.descriptionLabel}</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={strings.descriptionPlaceholder}
                      rows={4}
                      maxLength={1000}
                      className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none resize-none"
                      data-testid="drawer-description"
                    />
                  </div>

                  {/* Promise list */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.promiseLabel}</label>
                    <div className="space-y-2" data-testid="drawer-promise-list">
                      {promise.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => updatePromiseItem(idx, e.target.value)}
                            placeholder={strings.promiseItemPlaceholder}
                            maxLength={200}
                            className="flex-1 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
                            aria-label={`${strings.promiseLabel} ${idx + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => movePromiseItem(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 text-cms-text-dim hover:text-cms-text disabled:opacity-30"
                            aria-label="Move up"
                          >↑</button>
                          <button
                            type="button"
                            onClick={() => movePromiseItem(idx, 1)}
                            disabled={idx === promise.length - 1}
                            className="p-1 text-cms-text-dim hover:text-cms-text disabled:opacity-30"
                            aria-label="Move down"
                          >↓</button>
                          <button
                            type="button"
                            onClick={() => removePromiseItem(idx)}
                            className="p-1 text-red-400 hover:text-red-300"
                            aria-label="Remove item"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addPromiseItem}
                      disabled={promise.length >= 10}
                      className="mt-2 text-xs font-medium text-cms-accent hover:text-cms-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid="drawer-promise-add"
                    >
                      + {strings.promiseAdd}
                    </button>
                    {promise.length >= 10 && (
                      <p className="text-[11px] text-cms-text-dim mt-1">{strings.promiseMax}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* === Section 3: Appearance === */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim mb-3">{strings.sectionAppearance}</h3>
                <div className="space-y-3">
                  {/* Color (Light) */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.colorLabel}</label>
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
                        className="h-7 w-7 rounded cursor-pointer border border-cms-border"
                      />
                    </div>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value) }}
                      className="w-28 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-1.5 text-xs text-cms-text font-mono focus:border-cms-accent focus:outline-none"
                      data-testid="drawer-color"
                    />
                  </div>

                  {/* Color Dark */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.colorDarkLabel}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorDark || '#000000'}
                        onChange={(e) => setColorDark(e.target.value)}
                        className="h-7 w-7 rounded cursor-pointer border border-cms-border"
                      />
                      <input
                        type="text"
                        value={colorDark}
                        onChange={(e) => { if (/^#?[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColorDark(e.target.value) }}
                        placeholder="#RRGGBB"
                        className="w-28 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-1.5 text-xs text-cms-text font-mono placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
                        data-testid="drawer-color-dark"
                      />
                      {colorDark && (
                        <button type="button" onClick={() => setColorDark('')} className="text-xs text-cms-text-dim hover:text-cms-text">
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-cms-text-dim mt-1">{strings.colorDarkHint}</p>
                    {errors.colorDark && <p className="text-xs text-red-400 mt-1">{errors.colorDark}</p>}
                  </div>

                  {/* OG Image URL */}
                  <div>
                    <label className="block text-sm font-medium text-cms-text-muted mb-1">{strings.ogImageLabel}</label>
                    <input
                      type="url"
                      value={ogImageUrl}
                      onChange={(e) => setOgImageUrl(e.target.value)}
                      placeholder={strings.ogImagePlaceholder}
                      className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
                      data-testid="drawer-og-image"
                    />
                    {errors.ogImageUrl && <p className="text-xs text-red-400 mt-1">{errors.ogImageUrl}</p>}
                  </div>
                </div>
              </section>

              {/* === Section 4: Schedule (edit mode only) === */}
              {mode === 'edit' && editData && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim mb-3">{strings.sectionSchedule}</h3>
                  <div className="rounded-[var(--cms-radius)] border border-cms-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-cms-text">
                        {deriveCadenceLabel(null, editData.cadenceDays, locale, editData.cadenceStartDate) ?? '—'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        editData.cadencePaused
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {editData.cadencePaused ? 'Paused' : 'Active'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { handleClose(); router.push('/cms/newsletters?tab=schedule') }}
                      className="text-xs text-cms-accent hover:underline"
                    >
                      {strings.scheduleLink} →
                    </button>
                  </div>
                </section>
              )}

              {/* === Danger Zone (edit mode only) === */}
              {mode === 'edit' && editData && (
                <section className="border-t border-cms-border pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">{strings.dangerZone}</h3>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full rounded-[var(--cms-radius)] border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    data-testid="drawer-delete"
                  >
                    {strings.deleteButton}
                  </button>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-cms-border px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium text-cms-text-muted hover:bg-cms-surface-hover"
              >
                {strings.cancel}
              </button>
              <button
                type="submit"
                disabled={isPending || !name.trim()}
                className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx
git commit -m "feat(newsletter): create TypeDrawer component with full CRUD"
```

---

### Task 4: Integrate drawer into hub

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_shared/type-filter-chips.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx`

- [ ] **Step 1: Extend TypeFilterChips to support context menu and add button**

In `_shared/type-filter-chips.tsx`, add right-click context menu on each chip and a "+" button at the end:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { NewsletterType } from '../_hub/hub-types'

interface TypeFilterChipsProps {
  types: NewsletterType[]
  selectedTypeId: string | null
  onSelect: (typeId: string | null) => void
  onAdd: () => void
  onEdit: (typeId: string) => void
  allLabel: string
}

export function TypeFilterChips({ types, selectedTypeId, onSelect, onAdd, onEdit, allLabel }: TypeFilterChipsProps) {
  const [contextId, setContextId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextId) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setContextId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextId])

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2 items-center" role="radiogroup" aria-label="Filter by newsletter type">
      <button
        role="radio"
        aria-checked={selectedTypeId === null}
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          selectedTypeId === null
            ? 'bg-gray-100 text-gray-900'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
      >
        {allLabel}
      </button>
      {types.map((t) => (
        <div key={t.id} className="relative">
          <button
            role="radio"
            aria-checked={selectedTypeId === t.id}
            onClick={() => onSelect(t.id)}
            onContextMenu={(e) => { e.preventDefault(); setContextId(contextId === t.id ? null : t.id) }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTypeId === t.id
                ? 'text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            style={selectedTypeId === t.id ? { backgroundColor: t.color } : undefined}
          >
            {t.name}
            {t.subscriberCount > 0 && (
              <span className="ml-1 opacity-60">{t.subscriberCount}</span>
            )}
          </button>
          {contextId === t.id && (
            <div className="absolute left-0 top-full mt-1 z-30 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-lg w-28">
              <button
                type="button"
                onClick={() => { onEdit(t.id); setContextId(null) }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-full border border-dashed border-gray-700 px-2.5 py-1 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Add newsletter type"
        data-testid="add-type-chip"
      >
        +
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire drawer state in hub-client.tsx**

In `hub-client.tsx`:

1. Add imports at the top:
```tsx
import { TypeDrawer } from '../_components/type-drawer'
import type { NewsletterHubStrings } from '../_i18n/types'
```

2. Add `drawerStrings` and `locale` to `HubClientProps`:
```tsx
interface HubClientProps {
  sharedData: NewsletterHubSharedData
  defaultTab: TabId
  children: ReactNode
  tabLabels: Record<TabId, string>
  allTypesLabel: string
  locale: 'en' | 'pt-BR'
  drawerStrings: NewsletterHubStrings['typeDrawer']
}
```

3. Add drawer state inside the component:
```tsx
const [drawerOpen, setDrawerOpen] = useState(false)
const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
const [drawerTypeId, setDrawerTypeId] = useState<string | null>(null)

const handleAddType = useCallback(() => {
  setDrawerMode('create')
  setDrawerTypeId(null)
  setDrawerOpen(true)
}, [])

const handleEditType = useCallback((typeId: string) => {
  setDrawerMode('edit')
  setDrawerTypeId(typeId)
  setDrawerOpen(true)
}, [])
```

4. Add `onAdd` and `onEdit` props to `TypeFilterChips`:
```tsx
<TypeFilterChips
  types={sharedData.types}
  selectedTypeId={selectedTypeId}
  onSelect={handleTypeSelect}
  onAdd={handleAddType}
  onEdit={handleEditType}
  allLabel={allTypesLabel}
/>
```

5. Render TypeDrawer at the bottom of the component, before the closing `</div>`:
```tsx
<TypeDrawer
  open={drawerOpen}
  mode={drawerMode}
  typeId={drawerTypeId}
  onClose={() => setDrawerOpen(false)}
  locale={locale}
  strings={drawerStrings}
/>
```

- [ ] **Step 3: Pass new props from page.tsx**

In `page.tsx`, update the HubClient usage to pass `locale` and `drawerStrings`:

```tsx
<HubClient
  sharedData={sharedData}
  defaultTab={tab}
  tabLabels={strings.tabs}
  allTypesLabel={strings.common.allTypes}
  locale={locale as 'en' | 'pt-BR'}
  drawerStrings={strings.typeDrawer}
>
```

- [ ] **Step 4: Run TypeScript check and dev server**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx apps/web/src/app/cms/(authed)/newsletters/_shared/type-filter-chips.tsx apps/web/src/app/cms/(authed)/newsletters/page.tsx
git commit -m "feat(newsletter): integrate TypeDrawer into hub via filter chips"
```

---

### Task 5: Clean up TypeCards and delete TypeModal

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx`
- Delete: `apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx`

- [ ] **Step 1: Update TypeCards to use TypeDrawer instead of TypeModal**

In `type-cards.tsx`:

1. Replace the import:
```tsx
// Remove: import { TypeModal } from './type-modal'
import { TypeDrawer } from './type-drawer'
```

2. Replace `showTypeModal` state with drawer state:
```tsx
const [drawerOpen, setDrawerOpen] = useState(false)
const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
```

3. Remove `editingType` state (no longer needed — drawer fetches data on its own).

4. Update the "+" button to open drawer in create mode:
```tsx
<button
  type="button"
  onClick={() => { setDrawerMode('create'); setEditingTypeId(null); setDrawerOpen(true) }}
  ...
```

5. Update context menu "Edit" button:
```tsx
onClick={() => { setDrawerMode('edit'); setEditingTypeId(type.id); setDrawerOpen(true); setContextMenuId(null) }}
```

6. Remove `handleCreate`, `handleUpdate` functions (drawer handles these internally).

7. Replace TypeModal renders at the bottom with a single TypeDrawer:
```tsx
<TypeDrawer
  open={drawerOpen}
  mode={drawerMode}
  typeId={editingTypeId}
  onClose={() => setDrawerOpen(false)}
  locale="pt-BR"
  strings={/* pass i18n strings */}
/>
```

Note: TypeCards needs i18n strings passed as a prop. Add `strings: NewsletterHubStrings['typeDrawer']` to `TypeCardsProps` and thread it through.

- [ ] **Step 2: Delete TypeModal**

```bash
rm apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx
```

- [ ] **Step 3: Verify no remaining imports of TypeModal**

Run: `grep -rn "TypeModal\|type-modal" apps/web/src/ --include="*.tsx" --include="*.ts"`
Expected: No results.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx
git add -u apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx
git commit -m "refactor(newsletter): replace TypeModal with TypeDrawer in TypeCards"
```

---

### Task 6: Unit tests for TypeDrawer

**Files:**
- Create: `apps/web/test/cms/newsletter-type-drawer.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TypeDrawer } from '@/app/cms/(authed)/newsletters/_components/type-drawer'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/app/cms/(authed)/newsletters/actions', () => ({
  createNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  updateNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  deleteNewsletterType: vi.fn().mockResolvedValue({ ok: false, error: 'requires_confirmation', subscriberCount: 0, editionCount: 0 }),
  getNewsletterTypeForEdit: vi.fn().mockResolvedValue({
    ok: true,
    type: {
      id: 'test-1', name: 'Test Type', tagline: 'A tagline', locale: 'en', slug: 'test-type',
      badge: 'NEW', description: 'Some desc', color: '#ea580c', colorDark: '#FF8240',
      ogImageUrl: 'https://example.com/og.png', landingPromise: ['Item 1', 'Item 2'],
      cadenceDays: 7, cadenceStartDate: '2026-05-01', cadencePaused: false,
      subscriberCount: 42, editionCount: 5,
    },
  }),
}))

vi.mock('@/lib/newsletter/format', () => ({
  deriveCadenceLabel: vi.fn().mockReturnValue('Weekly, Fridays'),
}))

const strings = {
  createTitle: 'New Newsletter Type',
  editTitle: 'Edit Newsletter Type',
  sectionEssentials: 'Essentials',
  sectionLanding: 'Landing Page Content',
  sectionAppearance: 'Appearance',
  sectionSchedule: 'Schedule',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. Weekly Digest',
  taglineLabel: 'Tagline',
  taglinePlaceholder: 'A short italic subtitle',
  localeLabel: 'Language',
  slugLabel: 'Slug',
  slugPreview: 'bythiagofigueiredo.com/newsletters/',
  slugWarning: 'Changing the slug will break existing links',
  badgeLabel: 'Badge',
  badgePlaceholder: 'e.g. MAIN, NEW',
  badgeHint: 'Shown as a tag above the title on the landing page',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Describe what subscribers will receive',
  promiseLabel: 'What you get',
  promiseAdd: 'Add item',
  promiseMax: 'Maximum 10 items',
  promiseItemPlaceholder: 'Promise item...',
  colorLabel: 'Accent Color (Light)',
  colorDarkLabel: 'Accent Color (Dark)',
  colorDarkHint: 'Falls back to light color if empty',
  ogImageLabel: 'OG Image URL',
  ogImagePlaceholder: 'https://...',
  scheduleLink: 'Edit in Schedule tab',
  dangerZone: 'Danger Zone',
  deleteButton: 'Delete Newsletter Type',
  deleteConfirmEmpty: 'Delete "{name}"? This cannot be undone.',
  deleteConfirmDeps: 'This has {subscribers} subscribers and {editions} editions. Type the name to confirm:',
  deleteNameMismatch: 'Name does not match',
  createButton: 'Create',
  saveButton: 'Save Changes',
  creating: 'Creating...',
  saving: 'Saving...',
  cancel: 'Cancel',
}

describe('TypeDrawer', () => {
  const onClose = vi.fn()

  beforeEach(() => { vi.clearAllMocks() })

  it('renders in create mode with empty fields', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    expect(screen.getByText('New Newsletter Type')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-name')).toHaveValue('')
    expect(screen.getByTestId('drawer-slug')).toHaveValue('')
    expect(screen.getByText('Create')).toBeInTheDocument()
  })

  it('renders in edit mode with pre-populated fields', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-name')).toHaveValue('Test Type')
    })
    expect(screen.getByTestId('drawer-slug')).toHaveValue('test-type')
    expect(screen.getByTestId('drawer-badge')).toHaveValue('NEW')
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })

  it('auto-generates slug from name on blur in create mode', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const nameInput = screen.getByTestId('drawer-name')
    await user.type(nameInput, 'Weekly Digest')
    await user.tab()
    expect(screen.getByTestId('drawer-slug')).toHaveValue('weekly-digest')
  })

  it('stops auto-generation when slug is manually edited', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const slugInput = screen.getByTestId('drawer-slug')
    await user.type(slugInput, 'my-custom-slug')
    const nameInput = screen.getByTestId('drawer-name')
    await user.type(nameInput, 'Something Else')
    await user.tab()
    expect(screen.getByTestId('drawer-slug')).toHaveValue('my-custom-slug')
  })

  it('adds a promise item', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const addBtn = screen.getByTestId('drawer-promise-add')
    await user.click(addBtn)
    const list = screen.getByTestId('drawer-promise-list')
    expect(within(list).getAllByRole('textbox')).toHaveLength(1)
  })

  it('removes a promise item', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    await user.click(screen.getByTestId('drawer-promise-add'))
    await user.click(screen.getByTestId('drawer-promise-add'))
    const list = screen.getByTestId('drawer-promise-list')
    expect(within(list).getAllByRole('textbox')).toHaveLength(2)
    const removeButtons = within(list).getAllByLabelText('Remove item')
    await user.click(removeButtons[0])
    expect(within(list).getAllByRole('textbox')).toHaveLength(1)
  })

  it('disables add at 10 items', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const addBtn = screen.getByTestId('drawer-promise-add')
    for (let i = 0; i < 10; i++) await user.click(addBtn)
    expect(addBtn).toBeDisabled()
  })

  it('closes on Escape key', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on backdrop click', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const backdrop = screen.getByTestId('type-drawer-backdrop')
    const overlay = backdrop.querySelector('.bg-black\\/40')!
    await user.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows validation error for empty name on submit', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    await user.type(screen.getByTestId('drawer-slug'), 'some-slug')
    const submit = screen.getByTestId('drawer-submit')
    expect(submit).toBeDisabled()
  })

  it('shows schedule section in edit mode', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByText('Schedule')).toBeInTheDocument()
    })
    expect(screen.getByText('Weekly, Fridays')).toBeInTheDocument()
  })

  it('hides schedule section in create mode', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    expect(screen.queryByText('Schedule')).not.toBeInTheDocument()
  })

  it('hides danger zone in create mode', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument()
  })

  it('shows danger zone in edit mode', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    })
    expect(screen.getByTestId('drawer-delete')).toBeInTheDocument()
  })

  it('selects color from presets', async () => {
    const user = userEvent.setup()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const preset = screen.getByLabelText('Select color #ea580c')
    await user.click(preset)
    expect(screen.getByTestId('drawer-color')).toHaveValue('#ea580c')
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run apps/web/test/cms/newsletter-type-drawer.test.tsx --reporter=verbose 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/newsletter-type-drawer.test.tsx
git commit -m "test(newsletter): add unit tests for TypeDrawer component"
```

---

### Task 7: Run full test suite and final commit

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (current: 1794 web tests).

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors.

- [ ] **Step 3: Verify no TypeModal references remain**

Run: `grep -rn "TypeModal\|type-modal" apps/web/src/ --include="*.tsx" --include="*.ts"`
Expected: No results.

- [ ] **Step 4: Squash commits if desired**

All individual task commits should already be clean. No squash needed unless user requests.
