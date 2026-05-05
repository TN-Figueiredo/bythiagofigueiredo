'use client'

import { useState, useTransition } from 'react'
import { createCategory, updateCategory, deleteCategory } from './actions'

export interface CategoryRow {
  id: string
  slug: string
  namePt: string
  nameEn: string
  descriptionPt: string | null
  descriptionEn: string | null
  color: string
  matchKeywords: string[]
  autoApprove: boolean
  sortOrder: number
}

interface CategoryFormState {
  slug: string
  name_pt: string
  name_en: string
  description_pt: string
  description_en: string
  color: string
  keywordsRaw: string
  auto_approve: boolean
}

const DEFAULT_FORM: CategoryFormState = {
  slug: '',
  name_pt: '',
  name_en: '',
  description_pt: '',
  description_en: '',
  color: '#6366f1',
  keywordsRaw: '',
  auto_approve: false,
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface CategoryFormProps {
  initial?: CategoryFormState
  onSave: (data: CategoryFormState) => Promise<void>
  onCancel: () => void
  isPending: boolean
}

function CategoryForm({ initial = DEFAULT_FORM, onSave, onCancel, isPending }: CategoryFormProps) {
  const [form, setForm] = useState<CategoryFormState>(initial)
  const [slugManual, setSlugManual] = useState(initial.slug !== '')

  function set<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'name_pt' && !slugManual) {
        next.slug = slugify(value as string)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Name PT */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Name (PT) *</label>
          <input
            type="text"
            value={form.name_pt}
            onChange={(e) => set('name_pt', e.target.value)}
            placeholder="ex: Tecnologia"
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>

        {/* Name EN */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Name (EN) *</label>
          <input
            type="text"
            value={form.name_en}
            onChange={(e) => set('name_en', e.target.value)}
            placeholder="ex: Technology"
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-cms-text-muted">Slug *</label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => {
            setSlugManual(true)
            set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
          }}
          placeholder="ex: technology"
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text font-mono placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
        />
        <p className="text-xs text-cms-text-dim">Auto-generated from PT name. Only lowercase letters, numbers and hyphens.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Description PT */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Description (PT)</label>
          <textarea
            value={form.description_pt}
            onChange={(e) => set('description_pt', e.target.value)}
            rows={2}
            placeholder="Optional description in Portuguese"
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent resize-none"
          />
        </div>

        {/* Description EN */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Description (EN)</label>
          <textarea
            value={form.description_en}
            onChange={(e) => set('description_en', e.target.value)}
            rows={2}
            placeholder="Optional description in English"
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent resize-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Color */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Color *</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
              className="h-8 w-8 rounded cursor-pointer border border-cms-border bg-transparent"
              aria-label="Pick color"
            />
            <input
              type="text"
              value={form.color}
              onChange={(e) => {
                const v = e.target.value
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) set('color', v)
              }}
              placeholder="#6366f1"
              className="w-28 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text font-mono placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
            />
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: form.color || '#6366f1' }}
            >
              Preview
            </span>
          </div>
        </div>

        {/* Auto-approve */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Auto-approve</label>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => set('auto_approve', !form.auto_approve)}
              className={`flex h-5 w-9 items-center rounded-full transition-colors ${
                form.auto_approve ? 'bg-cms-accent' : 'bg-cms-surface-hover'
              }`}
              aria-label={form.auto_approve ? 'Auto-approve enabled' : 'Auto-approve disabled'}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  form.auto_approve ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-cms-text-muted">
              {form.auto_approve ? 'Auto-approve suggestions' : 'Manual approval required'}
            </span>
          </div>
        </div>
      </div>

      {/* Keywords */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-cms-text-muted">Match Keywords</label>
        <input
          type="text"
          value={form.keywordsRaw}
          onChange={(e) => set('keywordsRaw', e.target.value)}
          placeholder="tech, software, programming, code"
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
        />
        <p className="text-xs text-cms-text-dim">Comma-separated keywords for auto-categorization</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-cms-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-1.5 text-sm text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending || !form.slug || !form.name_pt || !form.name_en || !/^#[0-9A-Fa-f]{6}$/.test(form.color)}
          onClick={() => onSave(form)}
          className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Category'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  categories: CategoryRow[]
}

export function CategoriesConnected({ categories }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function formFromRow(row: CategoryRow): CategoryFormState {
    return {
      slug: row.slug,
      name_pt: row.namePt,
      name_en: row.nameEn,
      description_pt: row.descriptionPt ?? '',
      description_en: row.descriptionEn ?? '',
      color: row.color,
      keywordsRaw: row.matchKeywords.join(', '),
      auto_approve: row.autoApprove,
    }
  }

  function toPayload(form: CategoryFormState) {
    return {
      slug: form.slug,
      name_pt: form.name_pt,
      name_en: form.name_en,
      description_pt: form.description_pt || null,
      description_en: form.description_en || null,
      color: form.color,
      match_keywords: form.keywordsRaw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      auto_approve: form.auto_approve,
    }
  }

  async function handleCreate(form: CategoryFormState) {
    setError(null)
    startTransition(async () => {
      const res = await createCategory(toPayload(form))
      if (!res.ok) {
        setError(res.error)
        return
      }
      setShowForm(false)
    })
  }

  async function handleUpdate(id: string, form: CategoryFormState) {
    setError(null)
    startTransition(async () => {
      const res = await updateCategory(id, toPayload(form))
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditingId(null)
    })
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Videos in this category will become uncategorized.`)) return
    setError(null)
    startTransition(async () => {
      const res = await deleteCategory(id)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cms-text">Categories</h1>
          <p className="mt-0.5 text-sm text-cms-text-muted">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingId(null); setError(null) }}
            className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Category
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-[var(--cms-radius)] border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-cms-text">New Category</h2>
          <CategoryForm
            onSave={handleCreate}
            onCancel={() => { setShowForm(false); setError(null) }}
            isPending={isPending}
          />
        </div>
      )}

      {/* Category list */}
      {categories.length === 0 && !showForm ? (
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
          <p className="text-sm text-cms-text-muted">No categories yet. Create one to start organizing your videos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
              {editingId === cat.id ? (
                <div className="p-4">
                  <h2 className="mb-4 text-sm font-semibold text-cms-text">Edit Category</h2>
                  <CategoryForm
                    initial={formFromRow(cat)}
                    onSave={(form) => handleUpdate(cat.id, form)}
                    onCancel={() => { setEditingId(null); setError(null) }}
                    isPending={isPending}
                  />
                </div>
              ) : (
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* Color dot */}
                  <span
                    className="mt-0.5 shrink-0 h-4 w-4 rounded-full"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden="true"
                  />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-cms-text">
                        {cat.namePt}
                        <span className="mx-1 text-cms-text-dim">/</span>
                        {cat.nameEn}
                      </span>
                      <code className="rounded bg-cms-surface-hover px-1.5 py-0.5 text-xs text-cms-text-muted font-mono">
                        {cat.slug}
                      </code>
                      {cat.autoApprove ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          auto-approve
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-cms-surface-hover px-2 py-0.5 text-xs font-medium text-cms-text-dim">
                          manual
                        </span>
                      )}
                    </div>

                    {cat.matchKeywords.length > 0 && (
                      <p className="mt-1 text-xs text-cms-text-dim">
                        <span className="text-cms-text-muted">Keywords:</span>{' '}
                        {cat.matchKeywords.join(', ')}
                      </p>
                    )}

                    {(cat.descriptionPt || cat.descriptionEn) && (
                      <p className="mt-1 text-xs text-cms-text-dim line-clamp-1">
                        {cat.descriptionPt || cat.descriptionEn}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => { setEditingId(cat.id); setShowForm(false); setError(null) }}
                      className="rounded p-1.5 text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text disabled:opacity-50"
                      aria-label={`Edit ${cat.namePt}`}
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(cat.id, cat.namePt)}
                      className="rounded p-1.5 text-cms-text-muted hover:bg-red-900/20 hover:text-red-400 disabled:opacity-50"
                      aria-label={`Delete ${cat.namePt}`}
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
