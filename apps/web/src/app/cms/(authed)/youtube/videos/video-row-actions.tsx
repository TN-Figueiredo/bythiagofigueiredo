'use client'

import { useTransition, useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateVideo, approveCategory, rejectCategory, pinWeeklyPick, unpinWeeklyPick } from './actions'
import { pauseAbTest, endAbTest } from '../ab-lab/actions'

interface CategoryBadgeProps {
  videoId: string
  categoryId: string | null
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  categoryName: string | null
  categoryColor: string | null
}

export function CategoryBadge({
  videoId,
  categoryId,
  suggestedCategoryId,
  suggestedCategoryName,
  categoryName,
  categoryColor,
}: CategoryBadgeProps) {
  const [isPending, startTransition] = useTransition()

  if (suggestedCategoryId && !categoryId) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-900/30 text-amber-400">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 15a1 1 0 110-2 1 1 0 010 2zm1-4H11V7h2v6z" />
          </svg>
          {suggestedCategoryName ?? 'Suggested'}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await approveCategory(videoId); toast.success('Categoria aprovada.') })}
            className="rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await rejectCategory(videoId); toast.success('Sugestao de categoria rejeitada.') })}
            className="rounded px-1.5 py-0.5 text-xs font-medium bg-red-900/40 text-red-400 hover:bg-red-900/70 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    )
  }

  if (!categoryId) {
    return (
      <span className="text-xs text-cms-text-dim">—</span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: categoryColor ?? '#6366f1' }}
    >
      {categoryName ?? categoryId.slice(0, 8)}
    </span>
  )
}

interface FeaturedToggleProps {
  videoId: string
  isFeatured: boolean
}

export function FeaturedToggle({ videoId, isFeatured }: FeaturedToggleProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => { await updateVideo({ id: videoId, is_featured: !isFeatured }) })
      }
      role="switch"
      aria-checked={isFeatured}
      title={isFeatured ? 'Remove from featured' : 'Mark as featured'}
      className={`flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        isFeatured ? 'bg-cms-accent' : 'bg-cms-surface-hover'
      }`}
      aria-label="Featured"
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          isFeatured ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

interface HiddenToggleProps {
  videoId: string
  isHidden: boolean
}

export function HiddenToggle({ videoId, isHidden }: HiddenToggleProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => { await updateVideo({ id: videoId, is_hidden: !isHidden }) })
      }
      role="switch"
      aria-checked={isHidden}
      title={isHidden ? 'Unhide video' : 'Hide video from public page'}
      className={`flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        isHidden ? 'bg-amber-600' : 'bg-cms-surface-hover'
      }`}
      aria-label="Hidden"
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          isHidden ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

interface PinButtonProps {
  videoId: string
  channelId: string
  pinnedUntil: string | null
  hasExistingPin: boolean
}

export function PinButton({ videoId, channelId, pinnedUntil, hasExistingPin }: PinButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showUnpinConfirm, setShowUnpinConfirm] = useState(false)
  const [customDays, setCustomDays] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isPinned = !!pinnedUntil && new Date(pinnedUntil) > new Date()

  const closeDropdown = useCallback(() => {
    setShowDropdown(false)
    setCustomDays('')
  }, [])

  useEffect(() => {
    if (!showDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) closeDropdown()
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showDropdown, closeDropdown])

  const handlePin = (days: number) => {
    const d = Math.floor(days)
    if (d < 1 || d > 90) return
    startTransition(async () => {
      await pinWeeklyPick({ videoId, channelId, durationDays: d })
      closeDropdown()
    })
  }

  const handleUnpin = () => {
    startTransition(async () => {
      await unpinWeeklyPick({ channelId })
      setShowUnpinConfirm(false)
    })
  }

  if (isPinned) {
    const until = new Date(pinnedUntil!).toLocaleDateString('en', { month: 'short', day: 'numeric' })
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center rounded-full bg-amber-900/30 px-2 py-0.5 text-xs font-semibold text-amber-400">
          ★ Pinned until {until}
        </span>
        {showUnpinConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-cms-text-muted">Remove pin?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleUnpin}
              className="text-[10px] font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setShowUnpinConfirm(false)}
              className="text-[10px] text-cms-text-dim hover:text-cms-text"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowUnpinConfirm(true)}
            className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Unpin
          </button>
        )}
      </div>
    )
  }

  const presets = [7, 15, 30] as const

  function untilDate(days: number): string {
    const d = new Date(Date.now() + days * 86_400_000)
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setShowDropdown(!showDropdown)}
        className="text-xs text-cms-text-dim hover:text-cms-text disabled:opacity-50"
        title="Pin as weekly pick"
      >
        ☆ Pin as Weekly Pick
      </button>
      {hasExistingPin && !isPinned && (
        <span className="block text-[9px] italic text-cms-text-dim">replaces current</span>
      )}
      {showDropdown && (
        <div className="absolute right-0 top-6 z-10 min-w-[220px] rounded-lg border border-cms-border bg-cms-surface p-1 shadow-lg">
          <div className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-cms-text-dim">
            Pin Duration
          </div>
          {presets.map(d => (
            <button
              key={d}
              type="button"
              disabled={isPending}
              onClick={() => handlePin(d)}
              className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
            >
              <span>{d} days</span>
              <span className="text-cms-text-dim">until {untilDate(d)}</span>
            </button>
          ))}
          <div className="mt-1 flex items-center gap-1.5 border-t border-cms-border px-2.5 pt-2 pb-1">
            <span className="text-[10px] text-cms-text-dim">Custom:</span>
            <input
              type="number"
              min={1}
              max={90}
              step={1}
              value={customDays}
              onChange={e => setCustomDays(e.target.value)}
              placeholder="days"
              className="w-14 rounded border border-cms-border bg-cms-surface px-1.5 py-0.5 text-[10px] text-cms-text"
            />
            <button
              type="button"
              disabled={isPending || !customDays || Number(customDays) < 1 || Number(customDays) > 90 || !Number.isInteger(Number(customDays))}
              onClick={() => handlePin(Number(customDays))}
              className="rounded bg-cms-accent px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
            >
              Pin
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AbStatusBadge({ test, videoId, isShort }: {
  test: { id: string; status: string; started_at: string | null; result_metadata: { ctr_lift_percent: number } | null } | null
  videoId: string
  isShort: boolean
}) {
  if (isShort) return <span className="text-cms-text-muted">—</span>

  if (!test) {
    return (
      <Link
        href={`/cms/youtube/ab-lab/new?videoId=${videoId}`}
        className="text-[11px] px-2 py-0.5 rounded border border-cms-border text-cms-text-muted hover:text-cms-text hover:border-cms-accent transition-colors"
      >
        Start A/B
      </Link>
    )
  }

  const href = `/cms/youtube/ab-lab/${test.id}`

  if (test.status === 'active') {
    const dayCount = test.started_at
      ? Math.floor((Date.now() - new Date(test.started_at).getTime()) / 86400000)
      : 0
    return (
      <Link href={href} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        D{dayCount}
      </Link>
    )
  }

  if (test.status === 'paused') {
    return (
      <Link href={href} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">
        Paused
      </Link>
    )
  }

  if (test.status === 'completed' && test.result_metadata) {
    const lift = test.result_metadata.ctr_lift_percent
    return (
      <Link href={href} className={`text-[11px] ${lift > 0 ? 'text-green-400' : 'text-cms-text-muted'}`}>
        {lift > 0 ? `+${lift}%` : '= Original'}
      </Link>
    )
  }

  return <span className="text-cms-text-muted">—</span>
}

interface VideoContextMenuProps {
  videoId: string
  isShort: boolean
  abTest: { id: string; status: string } | null
}

export function VideoContextMenu({ videoId, isShort, abTest }: VideoContextMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'pause' | 'end' | null>(null)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const closeMenu = useCallback(() => {
    setOpen(false)
    setConfirmAction(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeMenu()
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, closeMenu])

  const handleConfirm = (action: 'pause' | 'end') => {
    if (!abTest) return
    startTransition(async () => {
      const result = action === 'pause'
        ? await pauseAbTest(abTest.id)
        : await endAbTest(abTest.id)
      if (result.ok) {
        toast.success(action === 'pause' ? 'Teste pausado.' : 'Teste encerrado.')
        router.refresh()
        closeMenu()
      } else {
        toast.error(result.error ?? 'Erro ao executar acao.')
        setConfirmAction(null)
      }
    })
  }

  type MenuItem =
    | { kind: 'link'; label: string; href: string; className?: string }
    | { kind: 'action'; action: 'pause' | 'end'; label: string; className: string }

  const items: MenuItem[] = []

  if (!isShort && !abTest) {
    items.push({ kind: 'link', label: 'Start A/B Test', href: `/cms/youtube/ab-lab/new?videoId=${videoId}` })
  }
  if (abTest) {
    items.push({ kind: 'link', label: 'View Test Details', href: `/cms/youtube/ab-lab/${abTest.id}` })
  }
  if (abTest?.status === 'active') {
    items.push({ kind: 'action', action: 'pause', label: 'Pause Test', className: 'text-amber-400' })
    items.push({ kind: 'action', action: 'end', label: 'End Test', className: 'text-red-400' })
  }

  if (items.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1 rounded text-cms-text-dim hover:text-cms-text hover:bg-cms-surface-hover"
        aria-label="More actions"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 min-w-[180px] rounded-lg border border-cms-border bg-cms-surface p-1 shadow-lg">
          {items.map((item) => {
            if (item.kind === 'link') {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => closeMenu()}
                  className={`block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-cms-surface-hover ${item.className ?? 'text-cms-text'}`}
                >
                  {item.label}
                </a>
              )
            }

            // Action item with confirmation
            if (confirmAction === item.action) {
              return (
                <div key={item.label} className="flex items-center gap-1 px-3 py-1.5">
                  <span className={`text-[10px] ${item.className}`}>
                    {item.action === 'pause' ? 'Pausar?' : 'Encerrar?'}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleConfirm(item.action)}
                    className="text-[10px] font-medium text-green-400 hover:text-green-300 disabled:opacity-50"
                  >
                    {isPending ? 'Aguarde...' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setConfirmAction(null)}
                    className="text-[10px] text-cms-text-dim hover:text-cms-text disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )
            }

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setConfirmAction(item.action)}
                className={`block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-cms-surface-hover ${item.className}`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface SyncButtonProps {
  onSync: () => Promise<void>
}

export function SyncButton({ onSync }: SyncButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(onSync)}
      className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-60"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        className={isPending ? 'animate-spin' : ''}
      >
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6" />
        <path d="M21 12a9 9 0 01-15 6.7L3 16" />
      </svg>
      {isPending ? 'Syncing…' : 'Sync Now'}
    </button>
  )
}
