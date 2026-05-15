'use client'

import type { FilterState, ContentType, FilterLanguage } from '@/lib/playlists/types'
import { CONTENT_TYPES, FILTER_LANGUAGES } from '@/lib/playlists/types'

const TYPE_CHIP_CONFIG: Record<ContentType, { label: string; activeColor: string }> = {
  video:      { label: 'Video', activeColor: 'bg-red-500 text-white' },
  blog_post:  { label: 'Blog',  activeColor: 'bg-indigo-500 text-white' },
  newsletter: { label: 'News',  activeColor: 'bg-green-500 text-white' },
  pipeline:   { label: 'Pipe',  activeColor: 'bg-purple-500 text-white' },
}

const LANG_CHIP_CONFIG: Record<FilterLanguage, { label: string; activeColor: string }> = {
  'pt-br': { label: 'PT-BR', activeColor: 'bg-amber-400/20 text-amber-400' },
  en:      { label: 'EN',    activeColor: 'bg-blue-400/20 text-blue-400' },
}

interface FilterBarProps {
  filter: FilterState
  counts: Record<ContentType, number>
  totalCount: number
  onChange: (filter: FilterState) => void
}

export function FilterBar({ filter, counts, totalCount, onChange }: FilterBarProps) {
  const toggleType = (type: ContentType) => {
    const next = new Set(filter.types)
    if (next.has(type)) next.delete(type); else next.add(type)
    onChange({ ...filter, types: next })
  }

  const toggleLanguage = (lang: FilterLanguage) => {
    const next = new Set(filter.languages)
    if (next.has(lang)) next.delete(lang); else next.add(lang)
    onChange({ ...filter, languages: next })
  }

  const clearTypes = () => onChange({ ...filter, types: new Set() })

  const setMode = (mode: FilterState['mode']) => onChange({ ...filter, mode })

  const allActive = filter.types.size === 0

  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-[#0a0a12] px-4 py-1.5">
      <div className="flex items-center gap-1">
        <Chip label="All" count={totalCount} active={allActive} activeClass="bg-white/10 text-white" onClick={clearTypes} />
        {CONTENT_TYPES.map(type => (
          <Chip key={type} label={TYPE_CHIP_CONFIG[type].label} count={counts[type]} active={filter.types.has(type)} activeClass={TYPE_CHIP_CONFIG[type].activeColor} onClick={() => toggleType(type)} />
        ))}
      </div>

      <span className="h-4 w-px bg-white/10" />

      <div className="flex items-center gap-1">
        {FILTER_LANGUAGES.map(lang => (
          <Chip key={lang} label={LANG_CHIP_CONFIG[lang].label} active={filter.languages.has(lang)} activeClass={LANG_CHIP_CONFIG[lang].activeColor} onClick={() => toggleLanguage(lang)} />
        ))}
      </div>

      <span className="h-4 w-px bg-white/10" />

      <div className="flex items-center gap-0.5 rounded-md bg-white/5 p-0.5">
        {(['all', 'dim', 'hide'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            aria-pressed={filter.mode === mode}
            onClick={() => setMode(mode)}
            className={`rounded px-2 py-0.5 text-[0.6rem] font-medium transition-colors ${
              filter.mode === mode ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {mode === 'all' ? 'Show' : mode === 'dim' ? 'Dim' : 'Hide'}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ label, count, active, activeClass, onClick }: {
  label: string; count?: number; active: boolean; activeClass: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.6rem] font-medium transition-colors ${
        active ? activeClass : 'text-white/30 hover:text-white/50'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[0.55rem] ${active ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
      )}
    </button>
  )
}
