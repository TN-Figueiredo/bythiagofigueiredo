'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSidebar } from '@tn-figueiredo/cms-ui/client'
import type { SidebarBadgeData, UrgencySlot, UrgencyColor } from '@/lib/cms/sidebar-badges'

const COLOR_CLASSES: Record<UrgencyColor | 'yellow', { bg: string; text: string }> = {
  yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  red:    { bg: 'bg-red-500/15',    text: 'text-red-400' },
}

const DOT_COLORS: Record<UrgencyColor | 'yellow', string> = {
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-400',
  red:    'bg-red-400',
}

function formatCount(n: number): string {
  return n > 99 ? '99+' : String(n)
}

function formatSlotDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function computeSlotColor(daysUntil: number): UrgencyColor {
  if (daysUntil <= 4) return 'red'
  if (daysUntil <= 9) return 'orange'
  return 'yellow'
}

interface PillProps {
  count: number
  color: UrgencyColor | 'yellow'
  ariaLabel: string
  tooltipContent?: React.ReactNode
}

function Pill({ count, color, ariaLabel, tooltipContent }: PillProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const { bg, text } = COLOR_CLASSES[color]

  return (
    <span
      className={`relative text-[11px] px-1.5 py-px rounded-full font-medium ${bg} ${text} cursor-default`}
      aria-label={ariaLabel}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {formatCount(count)}
      {showTooltip && tooltipContent && (
        <span className="absolute top-full right-0 mt-2 z-50 pointer-events-none">
          <span className="block bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
            {tooltipContent}
          </span>
        </span>
      )}
    </span>
  )
}

function BadgePortal({ href, children }: { href: string; children: React.ReactNode }) {
  const { isExpanded } = useSidebar()
  const [target, setTarget] = useState<Element | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-area="cms"] a[href="${href}"]`)
      setTarget(el)
    })
    return () => cancelAnimationFrame(raf)
  }, [href, isExpanded])

  if (!target) return null
  return createPortal(children, target)
}

function WipTooltip({ draft, ready, label }: { draft: number; ready: number; label: string }) {
  return (
    <>
      <span className="block text-[11px] text-slate-400 font-semibold mb-1">Work in progress</span>
      {draft > 0 && <span className="block text-[12px] text-slate-200">{draft} draft {label}</span>}
      {ready > 0 && <span className="block text-[12px] text-slate-200">{ready} ready {label}</span>}
    </>
  )
}

function UrgencyTooltip({ slots }: { slots: UrgencySlot[] }) {
  return (
    <>
      <span className="block text-[11px] text-slate-400 font-semibold mb-1">Unfilled slots (next 15 days)</span>
      {slots.map((s, i) => (
        <span key={i} className="flex items-center gap-2 text-[12px] text-slate-200">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.typeColor }} />
          <span className="flex-1 truncate">{s.typeName}</span>
          <span className={`text-[11px] ${COLOR_CLASSES[computeSlotColor(s.daysUntil)].text}`}>
            {formatSlotDate(s.slotDate)}
          </span>
        </span>
      ))}
    </>
  )
}

function CollapsedDot({ href, color }: { href: string; color: UrgencyColor | 'yellow' }) {
  const [target, setTarget] = useState<Element | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-area="cms"] a[href="${href}"]`)
      setTarget(el)
    })
    return () => cancelAnimationFrame(raf)
  }, [href])

  if (!target) return null

  return createPortal(
    <span
      className={`absolute top-1 right-1 w-2 h-2 rounded-full ${DOT_COLORS[color]} border-2 border-[#0f1729]`}
      aria-hidden="true"
    />,
    target,
  )
}

export function SidebarBadges({ data }: { data: SidebarBadgeData }) {
  const { isExpanded } = useSidebar()

  const postsHasBadge = data.posts.wip > 0
  const nlHasWip = data.newsletters.wip > 0
  const nlHasUrgency = data.newsletters.urgency !== null

  if (!postsHasBadge && !nlHasWip && !nlHasUrgency) return null

  if (!isExpanded) {
    return (
      <>
        {postsHasBadge && <CollapsedDot href="/cms/blog" color="yellow" />}
        {(nlHasWip || nlHasUrgency) && (
          <CollapsedDot
            href="/cms/newsletters"
            color={data.newsletters.urgency?.color ?? 'yellow'}
          />
        )}
      </>
    )
  }

  return (
    <>
      {postsHasBadge && (
        <BadgePortal href="/cms/blog">
          <span className="ml-auto flex items-center gap-1">
            <Pill
              count={data.posts.wip}
              color="yellow"
              ariaLabel={`${data.posts.wip} draft and ready posts`}
            />
          </span>
        </BadgePortal>
      )}

      {(nlHasWip || nlHasUrgency) && (
        <BadgePortal href="/cms/newsletters">
          <span className="ml-auto flex items-center gap-1">
            {nlHasWip && (
              <Pill
                count={data.newsletters.wip}
                color="yellow"
                ariaLabel={`${data.newsletters.wip} draft and ready editions`}
                tooltipContent={
                  <WipTooltip
                    draft={data.newsletters.wipDraft}
                    ready={data.newsletters.wipReady}
                    label="editions"
                  />
                }
              />
            )}
            {nlHasUrgency && (
              <Pill
                count={data.newsletters.urgency!.count}
                color={data.newsletters.urgency!.color}
                ariaLabel={`${data.newsletters.urgency!.count} unfilled newsletter slots within ${Math.min(...data.newsletters.urgency!.slots.map((s) => s.daysUntil))} days`}
                tooltipContent={<UrgencyTooltip slots={data.newsletters.urgency!.slots} />}
              />
            )}
          </span>
        </BadgePortal>
      )}
    </>
  )
}
