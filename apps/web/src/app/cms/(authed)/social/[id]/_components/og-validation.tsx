'use client'

import { useTransition } from 'react'
import { scrapeOgTags } from '@/lib/social/actions'

interface ValidationItem {
  key: string
  status: 'ok' | 'warning' | 'missing' | 'na'
  message: string
}

interface OgScrapeResult {
  success: boolean
  tags: Record<string, string | undefined>
  scrape: {
    status: number
    latency_ms: number
    timestamp: string
    raw_response: Record<string, unknown>
  }
  validation: {
    passed: number
    failed: number
    items: ValidationItem[]
  }
}

interface OgValidationProps {
  result: OgScrapeResult
  postId: string
}

const STATUS_COLORS: Record<string, string> = {
  ok: 'text-emerald-400 bg-emerald-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  missing: 'text-red-400 bg-red-500/10',
  na: 'text-cms-text-muted bg-cms-border/30',
}

const STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  warning: 'Warning',
  missing: 'Missing',
  na: 'N/A',
}

export function OgValidation({ result, postId }: OgValidationProps) {
  const [isPending, startTransition] = useTransition()

  function handleRescrape() {
    startTransition(async () => {
      await scrapeOgTags(postId)
    })
  }

  const heroSuccess = result.success
  const debuggerUrl = result.tags.url
    ? `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(result.tags.url)}`
    : 'https://developers.facebook.com/tools/debug/'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <a href={`/cms/social/${postId}`} className="text-sm text-cms-accent hover:underline">
          &larr; Voltar
        </a>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRescrape}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-cms-border px-3 py-1.5 text-xs font-medium text-cms-text hover:bg-cms-surface disabled:opacity-50"
          >
            Re-scrape
          </button>
          <a
            href={debuggerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-cms-border px-3 py-1.5 text-xs font-medium text-cms-text hover:bg-cms-surface"
          >
            Facebook Debugger
          </a>
        </div>
      </div>

      <div
        className={`rounded-lg border p-6 ${
          heroSuccess
            ? 'bg-emerald-500/[0.08] border-emerald-500/20'
            : 'bg-red-500/[0.08] border-red-500/20'
        }`}
      >
        <h2 className="text-lg font-semibold text-cms-text">
          {heroSuccess
            ? 'OG Tags validadas com sucesso'
            : 'Falha na validacao de OG Tags'}
        </h2>
        <p className="text-sm text-cms-text-muted">
          {result.validation.passed}/{result.validation.items.length} checks passaram
        </p>
      </div>

      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="text-sm font-semibold text-cms-text mb-3">Checklist</h3>
        <div className="space-y-2">
          {result.validation.items.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${STATUS_COLORS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
              <span className="font-mono text-xs text-cyan-400">{item.key}</span>
              <span className="text-xs text-cms-text-muted">{item.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="text-sm font-semibold text-cms-text mb-3">OG Tags</h3>
        <div className="space-y-1">
          {Object.entries(result.tags).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 py-1.5 border-b border-cms-border last:border-0">
              <span className="w-[140px] font-mono text-xs text-cms-text-muted shrink-0">{key}</span>
              <span className="flex-1 font-mono text-xs text-cms-text truncate" title={value ?? ''}>
                {value ?? '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
