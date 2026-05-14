'use client'
import { type FormEvent, useState } from 'react'
import {
  Globe,
  Tag,
  ArrowRight,
  Clock,
  Shield,
  Link2,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react'
import { useLinkForm, type LinkFormData } from '../hooks/use-link-form'

const SOURCE_TYPES = ['manual', 'campaign', 'newsletter', 'blog', 'social', 'print'] as const

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  campaign: 'Campaign',
  newsletter: 'Newsletter',
  blog: 'Blog',
  social: 'Social',
  print: 'Print',
}

const SOURCE_COLORS: Record<string, string> = {
  manual: 'border-gray-500/30 bg-gray-500/5 text-gray-300 hover:bg-gray-500/10',
  campaign: 'border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10',
  newsletter: 'border-purple-500/30 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10',
  blog: 'border-green-500/30 bg-green-500/5 text-green-400 hover:bg-green-500/10',
  social: 'border-pink-500/30 bg-pink-500/5 text-pink-400 hover:bg-pink-500/10',
  print: 'border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10',
}

const SOURCE_ACTIVE: Record<string, string> = {
  manual: 'border-gray-400 bg-gray-500/20 text-gray-200 ring-1 ring-gray-500/30',
  campaign: 'border-blue-400 bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30',
  newsletter: 'border-purple-400 bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30',
  blog: 'border-green-400 bg-green-500/20 text-green-300 ring-1 ring-green-500/30',
  social: 'border-pink-400 bg-pink-500/20 text-pink-300 ring-1 ring-pink-500/30',
  print: 'border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30',
}

export interface LinkFormProps {
  link?: LinkFormData & { id: string }
  onSubmit: (data: LinkFormData) => Promise<{ ok: boolean; error?: string }>
  onCancel: () => void
  siteId: string
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
    </div>
  )
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-medium text-foreground">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  )
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null
  return <p className="mt-1 text-[11px] text-red-400">{error}</p>
}

const inputClass =
  'mt-1.5 block w-full rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-colors'

export function LinkForm({ link, onSubmit, onCancel, siteId: _siteId }: LinkFormProps) {
  const { form, errors, isSubmitting, setField, handleSubmit, addTag, addTags, removeTag } = useLinkForm(
    link ?? undefined,
  )
  const [showUtm, setShowUtm] = useState(
    !!(form.utm_source || form.utm_medium || form.utm_campaign),
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  const isEditMode = !!link

  const onFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    await handleSubmit(async (data) => {
      const result = await onSubmit(data)
      if (!result.ok) {
        setSubmitError(result.error ?? 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={onFormSubmit} className="space-y-6" data-testid="link-form">
      {submitError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[11px] text-red-400">
          {submitError}
        </div>
      )}

      {/* --- Destination --- */}
      <div className="space-y-4">
        <SectionHeader icon={<Globe className="h-3.5 w-3.5" />} title="Destination" />

        <div>
          <FieldLabel htmlFor="destination_url" required>
            Destination URL
          </FieldLabel>
          <input
            id="destination_url"
            type="text"
            value={form.destination_url}
            onChange={(e) => setField('destination_url', e.target.value)}
            className={inputClass}
            placeholder="https://example.com/page"
          />
          <FieldError error={errors.destination_url} />
        </div>

        <div>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            className={inputClass}
            placeholder="My Link Title"
          />
        </div>
      </div>

      {/* --- Identifier --- */}
      <div className="space-y-4">
        <SectionHeader icon={<Link2 className="h-3.5 w-3.5" />} title="Identifier" />

        <div>
          <FieldLabel htmlFor="slug">Custom Slug</FieldLabel>
          <input
            id="slug"
            type="text"
            value={form.slug}
            onChange={(e) => setField('slug', e.target.value)}
            className={inputClass}
            placeholder="my-custom-slug"
            disabled={isEditMode}
          />
          {isEditMode && (
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              Slug cannot be changed after creation
            </p>
          )}
          <FieldError error={errors.slug} />
        </div>

        {form.slug && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[10px] text-muted-foreground">Preview:</span>
            <code className="text-[11px] font-medium text-indigo-400">
              go.site.com/{form.slug}
            </code>
          </div>
        )}
      </div>

      {/* --- Classification --- */}
      <div className="space-y-4">
        <SectionHeader icon={<Tag className="h-3.5 w-3.5" />} title="Classification" />

        {/* Source Type — Pill Buttons */}
        <div>
          <p className="text-[11px] font-medium text-foreground">Source Type</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SOURCE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setField('source_type', type)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all ${
                  form.source_type === type
                    ? SOURCE_ACTIVE[type]
                    : SOURCE_COLORS[type]
                }`}
              >
                {SOURCE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <FieldLabel htmlFor="tag-input">Tags</FieldLabel>
          <div className="mt-1.5 flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2">
            {form.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-indigo-400/60 hover:text-indigo-300"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <input
              id="tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="min-w-[100px] flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              placeholder={form.tags.length === 0 ? 'Add tags (comma or space to separate)' : 'Add more…'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  const parts = tagInput.split(/[,\s]+/).map(p => p.trim().replace(/^#+/, '')).filter(Boolean)
                  if (parts.length > 0) addTags(parts)
                  setTagInput('')
                }
                if (e.key === ' ' && tagInput.trim()) {
                  e.preventDefault()
                  const parts = tagInput.split(/[,\s]+/).map(p => p.trim().replace(/^#+/, '')).filter(Boolean)
                  if (parts.length > 0) addTags(parts)
                  setTagInput('')
                }
                if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
                  removeTag(form.tags[form.tags.length - 1]!)
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (pasted.includes(',') || pasted.includes(' ') || pasted.includes('\n')) {
                  e.preventDefault()
                  const parts = pasted.split(/[,\s\n]+/).map(p => p.trim().replace(/^#+/, '')).filter(Boolean)
                  if (parts.length > 0) addTags(parts)
                  setTagInput('')
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* --- Behavior --- */}
      <div className="space-y-4">
        <SectionHeader icon={<ArrowRight className="h-3.5 w-3.5" />} title="Behavior" />

        {/* Redirect Type — Card Buttons */}
        <fieldset>
          <legend className="text-[11px] font-medium text-foreground">Redirect Type</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { value: 302 as const, label: '302', desc: 'Temporary (recommended)' },
              { value: 301 as const, label: '301', desc: 'Permanent' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('redirect_type', opt.value)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  form.redirect_type === opt.value
                    ? 'border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/20'
                    : 'border-border bg-card hover:border-muted-foreground/30'
                }`}
              >
                <div className="text-sm font-bold tabular-nums text-foreground">{opt.label}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="expires_at">Expires At</FieldLabel>
            <input
              id="expires_at"
              type="datetime-local"
              value={form.expires_at ? form.expires_at.slice(0, 16) : ''}
              onChange={(e) =>
                setField(
                  'expires_at',
                  e.target.value ? new Date(e.target.value).toISOString() : '',
                )
              }
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="click_limit">Click Limit</FieldLabel>
            <input
              id="click_limit"
              type="number"
              min={1}
              value={form.click_limit ?? ''}
              onChange={(e) =>
                setField('click_limit', e.target.value ? Number(e.target.value) : null)
              }
              className={inputClass}
              placeholder="Unlimited"
            />
            <FieldError error={errors.click_limit} />
          </div>
        </div>
      </div>

      {/* --- Options --- */}
      <div className="space-y-4">
        <SectionHeader icon={<Shield className="h-3.5 w-3.5" />} title="Options" />

        <div>
          <FieldLabel htmlFor="password">Password Protection</FieldLabel>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            className={inputClass}
            placeholder="Leave empty for no protection"
          />
        </div>

        {/* Active Toggle */}
        <label
          htmlFor="active"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30"
        >
          <div
            className={`relative h-5 w-9 rounded-full transition-colors ${
              form.active ? 'bg-green-500' : 'bg-muted-foreground/30'
            }`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                form.active ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setField('active', e.target.checked)}
              className="sr-only"
              aria-label="Active"
            />
          </div>
          <div>
            <div className="text-[11px] font-medium text-foreground">Active</div>
            <div className="text-[10px] text-muted-foreground">
              Link is {form.active ? 'live and accepting clicks' : 'paused'}
            </div>
          </div>
        </label>
      </div>

      {/* --- UTM Parameters (collapsible) --- */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowUtm(!showUtm)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            UTM Parameters
          </div>
          {showUtm ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {showUtm && (
          <div className="grid gap-3 rounded-lg border border-border bg-card/50 p-4 sm:grid-cols-3">
            {(
              [
                ['utm_source', 'Source', 'e.g. google'],
                ['utm_medium', 'Medium', 'e.g. cpc'],
                ['utm_campaign', 'Campaign', 'e.g. spring_sale'],
                ['utm_term', 'Term', 'e.g. running shoes'],
                ['utm_content', 'Content', 'e.g. banner_v2'],
              ] as const
            ).map(([field, label, placeholder]) => (
              <div key={field}>
                <label
                  htmlFor={field}
                  className="block text-[10px] font-medium text-muted-foreground"
                >
                  {label}
                </label>
                <input
                  id={field}
                  type="text"
                  value={form[field]}
                  onChange={(e) => setField(field, e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Actions --- */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEditMode ? 'Save Changes' : 'Create Link'}
        </button>
      </div>
    </form>
  )
}
