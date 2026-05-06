'use client'

import { useState } from 'react'
import { getCmsEditorLabels } from './labels'

export function generateSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

interface SlugFieldProps {
  value: string
  onChange: (slug: string) => void
  siteUrl: string
  locale: string
}

export function SlugField({ value, onChange, siteUrl, locale }: SlugFieldProps) {
  const l = getCmsEditorLabels()
  const [editing, setEditing] = useState(false)
  const charCount = value.length
  const prefix = locale === 'en' ? '/blog/' : '/pt/blog/'
  const permalink = `${siteUrl}${prefix}${value}`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span className="font-mono text-xs text-neutral-400">{prefix}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          className="flex-1 bg-transparent border border-neutral-700 rounded px-2 py-1 font-mono text-xs text-indigo-300 outline-none focus:border-indigo-500"
        />
        {value && <span className="text-green-500 text-xs">✓</span>}
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-neutral-500">🔗 {permalink}</span>
        <span className={`font-mono text-[10px] ${charCount > 80 ? 'text-red-400' : 'text-green-500'}`}>
          {charCount} {l.characters}
        </span>
      </div>
    </div>
  )
}
