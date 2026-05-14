'use client'

import { useRouter } from 'next/navigation'
import type { ContentType } from '@/lib/social/types'
import type { Provider } from '@tn-figueiredo/social'

interface Connection {
  provider: Provider
  account_name: string | null
  status: 'connected' | 'disconnected'
}

interface KanbanSocialModalProps {
  open: boolean
  onClose: () => void
  onScheduleWithSocial: () => void
  onScheduleWithoutSocial: () => void
  contentTitle: string
  contentType: ContentType
  contentId: string
  shortLink: string
  caption: string
  coverImage?: string
  connections: Connection[]
  platforms: readonly Provider[]
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
}

export function KanbanSocialModal({
  open,
  onClose,
  onScheduleWithSocial,
  onScheduleWithoutSocial,
  contentTitle,
  contentType,
  contentId,
  shortLink,
  caption,
  coverImage,
  connections,
  platforms,
}: KanbanSocialModalProps) {
  const router = useRouter()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-cms-border bg-cms-bg shadow-xl">
        {/* Header */}
        <div className="border-b border-cms-border px-6 py-4">
          <h2 className="text-lg font-semibold text-cms-text">Agendar Publicação</h2>
          <p className="text-sm text-cms-text-muted mt-0.5">{contentTitle}</p>
        </div>

        {/* Social Share Confidence Card */}
        <div className="px-6 py-4 space-y-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
            <p className="text-sm font-medium text-emerald-400">Tudo pronto para compartilhar</p>

            {/* Platform status */}
            <div className="flex flex-wrap gap-3">
              {connections.map((conn) => (
                <div key={conn.provider} className="flex items-center gap-1.5">
                  <span
                    data-testid="status-dot"
                    className={`h-2 w-2 rounded-full ${
                      conn.status === 'connected' ? 'bg-emerald-400' : 'bg-zinc-500'
                    }`}
                  />
                  <span className="text-xs text-cms-text">
                    {PLATFORM_LABELS[conn.provider] ?? conn.provider}
                  </span>
                </div>
              ))}
            </div>

            {/* Content preview */}
            <div className="space-y-1.5">
              <p className="font-mono text-xs text-cms-text-muted">{shortLink}</p>
              <p className="text-xs text-cms-text-muted line-clamp-2">{caption}</p>
            </div>

            {/* Mini preview grid */}
            <div className="grid grid-cols-3 gap-2">
              {platforms.map((p) => (
                <div
                  key={p}
                  data-testid={`preview-${p}`}
                  className="aspect-[4/3] rounded-md border border-cms-border bg-cms-surface overflow-hidden"
                >
                  {coverImage && (
                    <img src={coverImage} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>

            {/* Pipeline one-liner */}
            <p className="text-[10px] text-cms-text-muted">
              Publish → Link → OG → Post em ~2-3 min
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-cms-border px-6 py-4">
          <button
            type="button"
            onClick={onScheduleWithSocial}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Agendar + Social
          </button>
          <button
            type="button"
            onClick={onScheduleWithoutSocial}
            className="w-full rounded-md border border-cms-border px-4 py-2.5 text-sm font-medium text-cms-text hover:bg-cms-surface"
          >
            Agendar sem Social
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push(`/cms/social/new?source=${contentType}&id=${contentId}`)
            }}
            className="w-full text-center text-sm text-cms-accent hover:underline"
          >
            Personalizar no Social Hub
          </button>
        </div>
      </div>
    </div>
  )
}
