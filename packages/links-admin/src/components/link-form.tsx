'use client'
import { type FormEvent } from 'react'
import { useLinkForm, type LinkFormData } from '../hooks/use-link-form'

const SOURCE_TYPES = ['manual', 'campaign', 'newsletter', 'blog', 'social', 'print'] as const

export interface LinkFormProps {
  link?: LinkFormData & { id: string }
  onSubmit: (data: LinkFormData) => Promise<{ ok: boolean; error?: string }>
  onCancel: () => void
  siteId: string
}

export function LinkForm({ link, onSubmit, onCancel, siteId }: LinkFormProps) {
  const { form, errors, isSubmitting, setField, handleSubmit, addTag, removeTag } = useLinkForm(
    link ?? undefined,
  )

  const isEditMode = !!link

  const onFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await handleSubmit(onSubmit)
  }

  return (
    <form onSubmit={onFormSubmit} className="space-y-6" data-testid="link-form">
      {/* Destination URL */}
      <div>
        <label htmlFor="destination_url" className="block text-sm font-medium text-gray-700">
          Destination URL
        </label>
        <input
          id="destination_url"
          type="text"
          value={form.destination_url}
          onChange={(e) => setField('destination_url', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="https://example.com/page"
        />
        {errors.destination_url && (
          <p className="mt-1 text-sm text-red-600">{errors.destination_url}</p>
        )}
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="My Link Title"
        />
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
          Slug (optional)
        </label>
        <input
          id="slug"
          type="text"
          value={form.slug}
          onChange={(e) => setField('slug', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="my-custom-slug"
        />
        {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug}</p>}
      </div>

      {/* Source Type */}
      <div>
        <label htmlFor="source_type" className="block text-sm font-medium text-gray-700">
          Source Type
        </label>
        <select
          id="source_type"
          value={form.source_type}
          onChange={(e) => setField('source_type', e.target.value as LinkFormData['source_type'])}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Redirect Type */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Redirect Type</legend>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="redirect_type"
              value={301}
              checked={form.redirect_type === 301}
              onChange={() => setField('redirect_type', 301)}
              aria-label="301"
            />
            301 (Permanent)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="redirect_type"
              value={302}
              checked={form.redirect_type === 302}
              onChange={() => setField('redirect_type', 302)}
              aria-label="302"
            />
            302 (Temporary)
          </label>
        </div>
      </fieldset>

      {/* UTM Parameters */}
      <details>
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          UTM Parameters
        </summary>
        <div className="mt-3 space-y-3">
          {(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const).map(
            (field) => (
              <div key={field}>
                <label htmlFor={field} className="block text-xs text-gray-600">
                  {field}
                </label>
                <input
                  id={field}
                  type="text"
                  value={form[field]}
                  onChange={(e) => setField(field, e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
            ),
          )}
        </div>
      </details>

      {/* Tags */}
      <div>
        <label htmlFor="tag-input" className="block text-sm font-medium text-gray-700">
          Tags
        </label>
        <div className="mt-1 flex flex-wrap gap-1">
          {form.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-blue-600 hover:text-blue-800"
                aria-label={`Remove tag ${tag}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
        <input
          id="tag-input"
          type="text"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          placeholder="Type and press Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const val = e.currentTarget.value.trim()
              if (val) {
                addTag(val)
                e.currentTarget.value = ''
              }
            }
          }}
        />
      </div>

      {/* Expires At */}
      <div>
        <label htmlFor="expires_at" className="block text-sm font-medium text-gray-700">
          Expires At (optional)
        </label>
        <input
          id="expires_at"
          type="datetime-local"
          value={form.expires_at ? form.expires_at.slice(0, 16) : ''}
          onChange={(e) =>
            setField('expires_at', e.target.value ? new Date(e.target.value).toISOString() : '')
          }
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Click Limit */}
      <div>
        <label htmlFor="click_limit" className="block text-sm font-medium text-gray-700">
          Click Limit (optional)
        </label>
        <input
          id="click_limit"
          type="number"
          min={1}
          value={form.click_limit ?? ''}
          onChange={(e) => setField('click_limit', e.target.value ? Number(e.target.value) : null)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password Protection (optional)
        </label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => setField('password', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-2">
        <input
          id="active"
          type="checkbox"
          aria-label="Active"
          checked={form.active}
          onChange={(e) => setField('active', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="active" className="text-sm text-gray-700">
          Active
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isEditMode ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  )
}
