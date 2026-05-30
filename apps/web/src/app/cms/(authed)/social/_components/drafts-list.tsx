'use client'

import Link from 'next/link'
import { deleteSocialPost } from '@/lib/social/actions'
import { socialToast } from './shared/social-toast'
import { useRouter } from 'next/navigation'

interface DraftItem {
  id: string
  title: string
  description: string
  confidence: number | null
  trigger: string
  createdAt: string
}

interface DraftsListProps {
  items: DraftItem[]
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const color =
    pct >= 80
      ? 'text-green-400 bg-green-500/15'
      : pct >= 50
        ? 'text-amber-400 bg-amber-500/15'
        : 'text-red-400 bg-red-500/15'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}%
    </span>
  )
}

const TRIGGER_LABELS: Record<string, string> = {
  blog_published: 'Blog publicado',
  video_published: 'Video publicado',
  newsletter_sent: 'Newsletter enviada',
  auto: 'Automatico',
}

export function DraftsList({ items }: DraftsListProps) {
  const router = useRouter()

  async function handleDiscard(id: string) {
    const result = await deleteSocialPost(id)
    if (result.ok) {
      socialToast('post_deleted')
      router.refresh()
    } else {
      socialToast('publish_failed', 'Erro ao excluir rascunho')
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-cms-text-muted">{items.length} rascunhos automaticos</p>
        <Link
          href="/cms/social/accounts?tab=automations"
          className="text-xs font-medium text-[var(--cms-cowork,#7c3aed)] hover:underline"
        >
          Automacoes
        </Link>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 rounded-xl border border-cms-border bg-cms-surface p-4">
            {/* Cowork icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cms-cowork,#7c3aed)]/15 text-[var(--cms-cowork,#7c3aed)]">
              <span className="text-sm font-bold">AI</span>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-cms-text">{item.title}</p>
                <ConfidenceBadge value={item.confidence} />
              </div>
              {item.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-cms-text-muted">{item.description}</p>
              )}
              <p className="mt-1 text-[10px] text-cms-text-dim">
                {TRIGGER_LABELS[item.trigger] ?? item.trigger} · {new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => handleDiscard(item.id)}
                className="rounded-lg border border-cms-border px-3 py-1.5 text-xs font-medium text-cms-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
              >
                Descartar
              </button>
              <Link
                href={`/cms/social/new?draft=${item.id}`}
                className="rounded-lg bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cms-accent-hover transition-colors"
              >
                Revisar
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
