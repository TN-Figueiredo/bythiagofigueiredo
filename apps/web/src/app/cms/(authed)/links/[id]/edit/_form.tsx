'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { handleUpdate } from './actions'

const SOURCE_TYPES = ['manual', 'campaign', 'newsletter', 'blog', 'social', 'print'] as const

interface EditLinkFormProps {
  linkId: string
  initial: {
    destination_url: string
    title: string
    slug: string
    source_type: string
    redirect_type: number
    utm_source: string
    utm_medium: string
    utm_campaign: string
    utm_term: string
    utm_content: string
    expires_at: string
    tags: string[]
  }
}

export function EditLinkForm({ linkId, initial }: EditLinkFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [destination, setDestination] = useState(initial.destination_url)
  const [title, setTitle] = useState(initial.title)
  const [slug, setSlug] = useState(initial.slug)
  const [sourceType, setSourceType] = useState(initial.source_type)
  const [utmSource, setUtmSource] = useState(initial.utm_source)
  const [utmMedium, setUtmMedium] = useState(initial.utm_medium)
  const [utmCampaign, setUtmCampaign] = useState(initial.utm_campaign)
  const [utmTerm, setUtmTerm] = useState(initial.utm_term)
  const [utmContent, setUtmContent] = useState(initial.utm_content)
  const [expiresAt, setExpiresAt] = useState(initial.expires_at)
  const [showUtm, setShowUtm] = useState(
    !!(initial.utm_source || initial.utm_medium || initial.utm_campaign),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!destination) {
      setError('Destination URL is required')
      return
    }

    startTransition(async () => {
      const result = await handleUpdate(linkId, {
        destination_url: destination,
        title: title || undefined,
        slug: slug || null,
        source_type: sourceType as 'manual' | 'campaign' | 'newsletter' | 'blog' | 'social' | 'print',
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        utm_term: utmTerm || undefined,
        utm_content: utmContent || undefined,
        expires_at: expiresAt || null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/cms/links/${linkId}`)
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Link</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update link settings and tracking parameters.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="destination" className="text-sm font-medium">
            Destination URL <span className="text-red-500">*</span>
          </label>
          <input
            id="destination"
            type="url"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="slug" className="text-sm font-medium">Slug</label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="source" className="text-sm font-medium">Source</label>
            <select
              id="source"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="expires" className="text-sm font-medium">Expires At</label>
          <input
            id="expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowUtm(!showUtm)}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            {showUtm ? '− Hide UTM Parameters' : '+ UTM Parameters'}
          </button>

          {showUtm && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Source</label>
                <input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Medium</label>
                <input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Campaign</label>
                <input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Term</label>
                <input value={utmTerm} onChange={(e) => setUtmTerm(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Content</label>
                <input value={utmContent} onChange={(e) => setUtmContent(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={() => router.push(`/cms/links/${linkId}`)}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
