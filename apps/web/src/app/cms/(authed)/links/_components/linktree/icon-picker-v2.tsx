'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Link2, Mail, BookOpen, Youtube, Globe, Users, Phone, Heart,
  Briefcase, GraduationCap, Mic, Camera, Music, ShoppingBag, Coffee, Star,
} from 'lucide-react'

const ICONS = [
  { id: 'link-2', Icon: Link2, label: 'Link' },
  { id: 'mail', Icon: Mail, label: 'Email' },
  { id: 'blog', Icon: BookOpen, label: 'Blog' },
  { id: 'youtube', Icon: Youtube, label: 'YouTube' },
  { id: 'globe', Icon: Globe, label: 'Website' },
  { id: 'authors', Icon: Users, label: 'Equipe' },
  { id: 'contacts', Icon: Phone, label: 'Telefone' },
  { id: 'heart', Icon: Heart, label: 'Favorito' },
  { id: 'briefcase', Icon: Briefcase, label: 'Trabalho' },
  { id: 'education', Icon: GraduationCap, label: 'Educacao' },
  { id: 'mic', Icon: Mic, label: 'Podcast' },
  { id: 'camera', Icon: Camera, label: 'Foto' },
  { id: 'music', Icon: Music, label: 'Musica' },
  { id: 'shop', Icon: ShoppingBag, label: 'Loja' },
  { id: 'coffee', Icon: Coffee, label: 'Cafe' },
  { id: 'star', Icon: Star, label: 'Destaque' },
] as const

interface IconPickerProps {
  value: string
  onChange: (iconId: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentIcon = ICONS.find(i => i.id === value) ?? ICONS[0]
  const CurrentIcon = currentIcon.Icon

  const handleSelect = useCallback((id: string) => {
    onChange(id)
    setOpen(false)
  }, [onChange])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={`Selecionar icone (atual: ${currentIcon.label})`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <CurrentIcon size={16} />
      </button>

      {open && (
        <div
          data-icon-grid
          role="listbox"
          aria-label="Icones disponiveis"
          className="absolute left-0 top-full z-50 mt-1 grid grid-cols-6 gap-1 rounded-xl border border-white/10 bg-[#1E1B16] p-2 shadow-xl"
          style={{ width: 220 }}
        >
          {ICONS.map((icon) => (
            <button
              key={icon.id}
              data-icon-option
              type="button"
              role="option"
              aria-selected={value === icon.id}
              aria-label={icon.label}
              title={icon.label}
              onClick={() => handleSelect(icon.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                value === icon.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <icon.Icon size={15} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
