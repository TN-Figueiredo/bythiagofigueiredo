'use client'

import Link from 'next/link'
import { deleteSocialPost } from '@/lib/social/actions'
import { socialToast } from './shared/social-toast'
import { useRouter } from 'next/navigation'
import { Sparkles, Settings, ArrowRight } from 'lucide-react'
import { PlatformIcon } from './shared/platform-icon'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DraftItem {
  id: string
  title: string
  description: string
  confidence: number | null
  trigger: string
  createdAt: string
  provider?: string
  surface?: string
  lang?: string
}

interface DraftsListProps {
  items: DraftItem[]
}

/* ------------------------------------------------------------------ */
/*  Cowork purple constants                                            */
/* ------------------------------------------------------------------ */

const COWORK_BG = 'rgba(110,99,242,0.15)'
const COWORK_FG = 'rgb(155,147,246)'

/* ------------------------------------------------------------------ */
/*  Sparkle confidence badge (always cowork purple)                    */
/* ------------------------------------------------------------------ */

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  return (
    <span
      className="inline-flex items-center gap-[3px] rounded-full px-[7px] py-[2px] font-mono text-[10.5px]"
      style={{ background: COWORK_BG, color: COWORK_FG }}
    >
      <Sparkles className="h-[11px] w-[11px]" />
      {pct}%
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Trigger icon — camera / document / envelope (38x38)                */
/* ------------------------------------------------------------------ */

function TriggerIcon({ trigger }: { trigger: string }) {
  const isVideo = trigger === 'video_published'
  const isNewsletter = trigger === 'newsletter_sent'
  // default = blog/document

  return (
    <div
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px]"
      style={{ background: COWORK_BG }}
    >
      {isVideo ? (
        /* Camera / video icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COWORK_FG} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="M16 10l5-3v10l-5-3" />
        </svg>
      ) : isNewsletter ? (
        /* Envelope icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COWORK_FG} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      ) : (
        /* Document / blog icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COWORK_FG} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h8" />
        </svg>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mini platform icon (22x22, solid bg, white SVG)                    */
/* ------------------------------------------------------------------ */

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E8823C',
  youtube: '#E0574E',
  facebook: '#5B7FD6',
  bluesky: '#0085FF',
}

function MiniPlatformIcon({ provider }: { provider: string }) {
  const bg = PLATFORM_COLORS[provider] ?? '#888'

  return (
    <div
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px]"
      style={{ background: bg }}
    >
      <PlatformIcon provider={provider} size={12} variant="solid" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Trigger label map                                                  */
/* ------------------------------------------------------------------ */

const TRIGGER_LABELS: Record<string, string> = {
  blog_published: 'Blog publicado',
  video_published: 'Vídeo publicado',
  newsletter_sent: 'Newsletter enviada',
  auto: 'Automático',
}

/* ------------------------------------------------------------------ */
/*  Relative time formatter                                            */
/* ------------------------------------------------------------------ */

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `ha ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `ha ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'ha 1 dia'
  return `ha ${diffD} dias`
}

/* ------------------------------------------------------------------ */
/*  DraftsList component                                               */
/* ------------------------------------------------------------------ */

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
    <div className="max-w-[760px]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        {/* Left: Cowork sparkle + title + subtitle */}
        <div className="flex items-start gap-[10px]">
          <Sparkles
            className="mt-[1px] h-[18px] w-[18px] shrink-0"
            style={{ color: COWORK_FG }}
          />
          <div>
            <p className="text-[14px] font-semibold text-cms-text">Rascunhos da IA</p>
            <p className="mt-[2px] text-[12px] text-cms-text-dim">
              O Cowork monitora o CMS e prepara posts sozinho. Revise e publique.
            </p>
          </div>
        </div>

        {/* Right: Automacoes button */}
        <Link
          href="/cms/social/accounts?tab=automations"
          className="inline-flex shrink-0 items-center gap-[5px] rounded-[9px] border border-[var(--line-strong,var(--color-cms-border))] bg-transparent px-[10px] py-[5px] text-[12.5px] font-semibold text-cms-text-dim transition-colors hover:text-cms-text"
        >
          <Settings className="h-[14px] w-[14px]" />
          Automações
        </Link>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-[11px]">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-start gap-[13px] rounded-[var(--radius,12px)] border border-cms-border bg-cms-surface p-4"
          >
            {/* Trigger icon (38x38) */}
            <TriggerIcon trigger={item.trigger} />

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* Title + confidence */}
              <div className="flex items-center gap-2">
                <p className="truncate text-[14px] font-semibold text-cms-text">{item.title}</p>
                <ConfidenceBadge value={item.confidence} />
              </div>

              {/* Description */}
              {item.description && (
                <p className="mb-[9px] mt-[3px] text-[12.5px] leading-[1.5] text-cms-text-dim">
                  {item.description}
                </p>
              )}

              {/* Footer: platform + trigger + actions */}
              <div className="flex items-center gap-[6px]">
                {/* Platform chip */}
                {item.provider && (
                  <>
                    <MiniPlatformIcon provider={item.provider} />
                    <span className="text-[11.5px] text-cms-text-dim">
                      {[
                        item.provider === 'youtube' ? 'YouTube' :
                        item.provider === 'instagram' ? 'Instagram' :
                        item.provider === 'facebook' ? 'Facebook' :
                        item.provider === 'bluesky' ? 'Bluesky' :
                        item.provider,
                        item.surface,
                        item.lang ?? 'PT',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </>
                )}

                {/* Trigger text */}
                <span className="text-[11px] text-[var(--ink-faint,var(--color-cms-text-dim))]">
                  · {TRIGGER_LABELS[item.trigger] ?? item.trigger} {formatRelativeTime(item.createdAt)}
                </span>

                {/* Action buttons (pushed right) */}
                <div className="ml-auto flex shrink-0 gap-2">
                  <button
                    onClick={() => handleDiscard(item.id)}
                    aria-label={`Descartar rascunho: ${item.title}`}
                    className="rounded-[9px] border border-transparent px-3 py-1.5 text-[12px] font-medium text-cms-text-dim transition-colors hover:border-red-400/30 hover:text-red-400"
                  >
                    Descartar
                  </button>
                  <Link
                    href={`/cms/social/new?draft=${item.id}`}
                    className="inline-flex items-center gap-[5px] rounded-[9px] bg-cms-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-cms-accent-hover"
                  >
                    Revisar
                    <ArrowRight className="h-[13px] w-[13px]" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
