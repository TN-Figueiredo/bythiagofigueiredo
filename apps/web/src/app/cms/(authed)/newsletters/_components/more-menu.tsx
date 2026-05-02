'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Mail, Copy, Send, Trash2, ExternalLink } from 'lucide-react'

interface MoreMenuProps {
  status: string
  onSendTest?: () => void
  onDuplicate?: () => void
  onSendNow?: () => void
  onDelete?: () => void
  webArchiveUrl?: string | null
}

export function MoreMenu({ status, onSendTest, onDuplicate, onSendNow, onDelete, webArchiveUrl }: MoreMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // Build items based on status
  type MenuItem = { label: string; icon: React.ReactNode; onClick?: () => void; href?: string; className?: string }
  const items: Array<MenuItem | 'separator'> = []

  if (status === 'sent') {
    if (onDuplicate) items.push({ label: 'Duplicate as New Draft', icon: <Copy size={14} />, onClick: onDuplicate })
    if (webArchiveUrl) items.push({ label: 'View Web Archive', icon: <ExternalLink size={14} />, href: webArchiveUrl })
  } else if (status === 'failed') {
    if (onSendTest) items.push({ label: 'Send Test Email', icon: <Mail size={14} />, onClick: onSendTest })
    if (onDuplicate) items.push({ label: 'Duplicate', icon: <Copy size={14} />, onClick: onDuplicate })
    items.push('separator')
    if (onDelete) items.push({ label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, className: 'text-[#ef4444]' })
  } else {
    // draft, scheduled, ephemeral
    if (onSendTest) items.push({ label: 'Send Test Email', icon: <Mail size={14} />, onClick: onSendTest })
    if (onDuplicate) items.push({ label: 'Duplicate', icon: <Copy size={14} />, onClick: onDuplicate })
    items.push('separator')
    if (onSendNow) items.push({
      label: status === 'scheduled' ? 'Send Now (skip schedule)...' : 'Send Now...',
      icon: <Send size={14} />,
      onClick: onSendNow,
      className: 'text-[#f59e0b]',
    })
    items.push('separator')
    if (onDelete) items.push({ label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, className: 'text-[#ef4444]' })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="More actions"
        className="p-1.5 rounded-md text-[#4b5563] hover:text-[#9ca3af] hover:bg-white/5 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg py-1 min-w-48">
          {items.map((item, i) => {
            if (item === 'separator') return <div key={`sep-${i}`} className="h-px bg-[#1f2937] my-1" />
            if (item.href) {
              return (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3.5 py-[7px] text-xs hover:bg-white/5 transition-colors ${item.className ?? 'text-[#d1d5db]'}`}
                  onClick={() => setOpen(false)}>
                  {item.icon}{item.label}
                </a>
              )
            }
            return (
              <button key={item.label} type="button"
                onClick={() => { item.onClick?.(); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3.5 py-[7px] text-xs hover:bg-white/5 transition-colors text-left ${item.className ?? 'text-[#d1d5db]'}`}>
                {item.icon}{item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
