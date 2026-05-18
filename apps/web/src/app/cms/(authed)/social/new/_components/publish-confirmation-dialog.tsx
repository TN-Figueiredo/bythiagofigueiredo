'use client'

import { useEffect, useId, useRef } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import {
  PlatformIcon,
  platformLabel,
} from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { OgData } from './og-preview-sidebar'
import { OgFacebookCard } from './og-facebook-card'
import { OgBlueskyCard } from './og-bluesky-card'

// ---------------------------------------------------------------------------
// Variable resolution for confirmation
// ---------------------------------------------------------------------------

const VARIABLE_REGEX = /\{\{(link|title|url)\}\}/g

function resolveCaption(
  template: string,
  title: string,
  shortUrl: string,
  rawUrl: string,
): string {
  return template.replace(VARIABLE_REGEX, (_match, varName: string) => {
    switch (varName) {
      case 'link':
        return shortUrl
      case 'title':
        return title
      case 'url':
        return rawUrl
      default:
        return _match
    }
  })
}

// ---------------------------------------------------------------------------
// Char limits (duplicated from caption-tabs for self-containment)
// ---------------------------------------------------------------------------

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63_206,
  instagram: 2_200,
  bluesky: 300,
  youtube: 5_000,
}

// ---------------------------------------------------------------------------
// Platform delivery mode badge
// ---------------------------------------------------------------------------

type DeliveryMode = 'auto' | 'notification'

function getDeliveryMode(
  platform: Provider,
  instagramMode?: 'quick' | 'design',
): DeliveryMode {
  if (platform === 'instagram' && instagramMode === 'design') {
    return 'notification'
  }
  return 'auto'
}

const MODE_LABELS: Record<DeliveryMode, string> = {
  auto: 'Auto-post',
  notification: 'Notification',
}

const MODE_COLORS: Record<DeliveryMode, string> = {
  auto: 'text-emerald-400 bg-emerald-500/10',
  notification: 'text-amber-400 bg-amber-500/10',
}

// ---------------------------------------------------------------------------
// OG warnings
// ---------------------------------------------------------------------------

interface OgWarning {
  label: string
  severity: 'red' | 'amber'
}

function getOgWarnings(ogData: OgData | null): OgWarning[] {
  if (!ogData) return [{ label: 'OG metadata not available', severity: 'amber' }]
  const warnings: OgWarning[] = []
  if (!ogData.image) {
    warnings.push({ label: 'og:image missing', severity: 'red' })
  }
  if (!ogData.title) {
    warnings.push({ label: 'og:title missing', severity: 'red' })
  }
  return warnings
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PublishConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  platforms: readonly Provider[]
  captions: Record<string, Record<string, string>>
  contentTitle: string
  contentUrl: string
  shortUrl: string
  ogData: OgData | null
  isLoading: boolean
  activeLang?: string
  instagramMode?: 'quick' | 'design'
}

export function PublishConfirmationDialog({
  open,
  onClose,
  onConfirm,
  platforms,
  captions,
  contentTitle,
  contentUrl,
  shortUrl,
  ogData,
  isLoading,
  activeLang = 'pt',
  instagramMode = 'quick',
}: PublishConfirmationDialogProps) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Focus trap + keyboard handling
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const focusable = [cancelRef.current, confirmRef.current].filter(
          Boolean,
        ) as HTMLButtonElement[]
        if (focusable.length < 2) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const ogWarnings = getOgWarnings(ogData)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-cms-border bg-cms-surface shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-cms-border px-6 py-4">
          <h2
            id={titleId}
            className="text-lg font-semibold text-cms-text"
          >
            Confirmar Publicacao
          </h2>
          <p
            id={descId}
            className="text-sm text-cms-text-muted"
          >
            Revise o conteudo antes de publicar em {platforms.length} plataforma
            {platforms.length > 1 ? 's' : ''}.
          </p>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-4">
          {/* Warnings */}
          {ogWarnings.length > 0 && (
            <div className="space-y-1">
              {ogWarnings.map((w) => (
                <div
                  key={w.label}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium ${
                    w.severity === 'red'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01"
                    />
                  </svg>
                  {w.label}
                </div>
              ))}
            </div>
          )}

          {/* Per-platform resolved captions */}
          {platforms.map((p) => {
            const template = captions[p]?.[activeLang] ?? ''
            const resolved = resolveCaption(
              template,
              contentTitle,
              shortUrl,
              contentUrl,
            )
            const charLimit = CHAR_LIMITS[p] ?? 63_206
            const isOver = resolved.length > charLimit
            const deliveryMode = getDeliveryMode(p, instagramMode)

            return (
              <div
                key={p}
                className="rounded-lg border border-cms-border bg-cms-bg p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlatformIcon provider={p} size="sm" />
                    <span className="text-sm font-medium capitalize text-cms-text">
                      {platformLabel(p)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      data-testid="platform-badge"
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MODE_COLORS[deliveryMode]}`}
                    >
                      {MODE_LABELS[deliveryMode]}
                    </span>
                    <span
                      className={`text-[10px] ${isOver ? 'text-red-400' : 'text-cms-text-muted'}`}
                    >
                      {resolved.length}/{charLimit}
                    </span>
                  </div>
                </div>

                <p className="whitespace-pre-wrap font-mono text-xs text-cms-text">
                  {resolved}
                </p>

                {isOver && (
                  <p className="mt-1 text-[10px] text-red-400">
                    Caption exceeds {platformLabel(p)} limit by{' '}
                    {resolved.length - charLimit} characters
                  </p>
                )}
              </div>
            )
          })}

          {/* OG Card Preview */}
          {ogData && (
            <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
                Link Card Preview
              </p>
              <div className="grid grid-cols-2 gap-3">
                {platforms.includes('facebook') && (
                  <OgFacebookCard
                    imageUrl={ogData.image}
                    title={ogData.title}
                    description={ogData.description}
                    domain={ogData.domain}
                  />
                )}
                {platforms.includes('bluesky') && (
                  <OgBlueskyCard
                    imageUrl={ogData.image}
                    title={ogData.title}
                    description={ogData.description}
                    domain={ogData.domain}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-cms-border px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-md bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? 'Publicando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
