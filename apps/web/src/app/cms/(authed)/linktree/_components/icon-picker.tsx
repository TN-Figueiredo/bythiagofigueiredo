'use client'

import { useState } from 'react'
import {
  Link2, Mail, MessageCircle, Phone, Globe, Book, Code, Coffee,
  Heart, Star, Zap, Camera, Music, Video, FileText, ShoppingBag,
  Briefcase, Calendar, Map, Gift, Award, Bookmark, Download, ExternalLink,
  Headphones, Mic, Radio, Rss, Send, Share2, Tv, Users,
} from 'lucide-react'

const ICONS = [
  { name: 'link-2', Icon: Link2 }, { name: 'mail', Icon: Mail },
  { name: 'message-circle', Icon: MessageCircle }, { name: 'phone', Icon: Phone },
  { name: 'globe', Icon: Globe }, { name: 'book', Icon: Book },
  { name: 'code', Icon: Code }, { name: 'coffee', Icon: Coffee },
  { name: 'heart', Icon: Heart }, { name: 'star', Icon: Star },
  { name: 'zap', Icon: Zap }, { name: 'camera', Icon: Camera },
  { name: 'music', Icon: Music }, { name: 'video', Icon: Video },
  { name: 'file-text', Icon: FileText }, { name: 'shopping-bag', Icon: ShoppingBag },
  { name: 'briefcase', Icon: Briefcase }, { name: 'calendar', Icon: Calendar },
  { name: 'map', Icon: Map }, { name: 'gift', Icon: Gift },
  { name: 'award', Icon: Award }, { name: 'bookmark', Icon: Bookmark },
  { name: 'download', Icon: Download }, { name: 'external-link', Icon: ExternalLink },
  { name: 'headphones', Icon: Headphones }, { name: 'mic', Icon: Mic },
  { name: 'radio', Icon: Radio }, { name: 'rss', Icon: Rss },
  { name: 'send', Icon: Send }, { name: 'share-2', Icon: Share2 },
  { name: 'tv', Icon: Tv }, { name: 'users', Icon: Users },
] as const

interface Props {
  value: string
  onChange: (icon: string) => void
  disabled?: boolean
}

export function IconPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = ICONS.find((i) => i.name === value) ?? ICONS[0]!
  const filtered = search
    ? ICONS.filter((i) => i.name.includes(search.toLowerCase()))
    : ICONS

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        aria-label="Trocar ícone"
        className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:border-primary disabled:opacity-50"
      >
        <selected.Icon size={14} />
        <span>Trocar ícone</span>
      </button>
    )
  }

  return (
    <div className="rounded border border-border bg-background p-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar ícone..."
        className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
        autoFocus
      />
      <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto">
        {filtered.map(({ name, Icon }) => (
          <button
            key={name}
            type="button"
            onClick={() => { onChange(name); setOpen(false); setSearch('') }}
            className={`flex h-8 w-8 items-center justify-center rounded hover:bg-accent/10 ${
              value === name ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            }`}
            title={name}
            aria-label={name}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    </div>
  )
}
