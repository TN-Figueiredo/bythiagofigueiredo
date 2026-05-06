'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createLink } from '../actions'

const SOURCE_TYPES = ['manual', 'campaign', 'newsletter', 'blog', 'social', 'print'] as const

export function NewLinkForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [destination, setDestination] = useState('')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [redirectType, setRedirectType] = useState<'301' | '302'>('302')
  const [sourceType, setSourceType] = useState<typeof SOURCE_TYPES[number]>('manual')
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [showUtm, setShowUtm] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!destination) {
      setError('Destination URL is required')
      return
    }

    startTransition(async () => {
      const result = await createLink({
        destination_url: destination,
        title: title || undefined,
        code: code || undefined,
        redirect_type: redirectType,
        source_type: sourceType,
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        expires_at: expiresAt || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/cms/links/${result.linkId}`)
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Link</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new tracked short link.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Destination URL */}
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
            placeholder="https://example.com/page"
            required
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="My Campaign Link"
          />
        </div>

        {/* Code + Redirect */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium">
              Custom Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="auto-generated"
            />
            <p className="text-xs text-muted-foreground">Leave empty for auto-generated code</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="redirect" className="text-sm font-medium">
              Redirect Type
            </label>
            <select
              id="redirect"
              value={redirectType}
              onChange={(e) => setRedirectType(e.target.value as '301' | '302')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="302">302 Temporary</option>
              <option value="301">301 Permanent</option>
            </select>
          </div>
        </div>

        {/* Source Type */}
        <div className="space-y-2">
          <label htmlFor="source" className="text-sm font-medium">
            Source
          </label>
          <select
            id="source"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as typeof SOURCE_TYPES[number])}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Expiry */}
        <div className="space-y-2">
          <label htmlFor="expires" className="text-sm font-medium">
            Expires At
          </label>
          <input
            id="expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* UTM toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowUtm(!showUtm)}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            {showUtm ? '− Hide UTM Parameters' : '+ Add UTM Parameters'}
          </button>

          {showUtm && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Source</label>
                <input
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="newsletter"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Medium</label>
                <input
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="email"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Campaign</label>
                <input
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="may-2026"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={() => router.push('/cms/links')}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Creating…' : 'Create Link'}
          </button>
        </div>
      </form>
    </div>
  )
}
