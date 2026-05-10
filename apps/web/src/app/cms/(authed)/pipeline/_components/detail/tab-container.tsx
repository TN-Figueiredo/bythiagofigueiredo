'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Format } from '@/lib/pipeline/schemas'
import { getSectionsForFormat, type SectionDefinition } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'

interface TabContainerProps {
  format: Format
  itemId: string
  itemVersion: number
  sections: Record<string, SectionData>
  itemCode: string
  itemTitle: string
  children: (props: {
    activeTab: string
    activeSub: string | null
    lang: string
    sections: Record<string, SectionData>
    sectionDefs: SectionDefinition[]
    setActiveTab: (tab: string) => void
    setActiveSub: (sub: string | null) => void
    setLang: (lang: string) => void
  }) => React.ReactNode
}

export function TabContainer({ format, itemId, itemVersion, sections, itemCode, itemTitle, children }: TabContainerProps) {
  const sectionDefs = getSectionsForFormat(format)
  const [activeTab, setActiveTab] = useState(sectionDefs[0]?.key ?? '')
  const [activeSub, setActiveSub] = useState<string | null>(null)
  const [lang, setLang] = useState('en')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const parts = hash.split('/')
    const tab = parts[0] ?? ''
    const sub = parts.length === 3 ? (parts[1] ?? null) : null
    const hashLang = parts[parts.length - 1] ?? ''
    if (tab && sectionDefs.some(s => s.key === tab)) setActiveTab(tab)
    if (sub) setActiveSub(sub)
    if (hashLang === 'pt' || hashLang === 'en') setLang(hashLang)
  }, [sectionDefs])

  useEffect(() => {
    const hashParts = [activeTab]
    if (activeSub) hashParts.push(activeSub)
    if (lang !== 'en') hashParts.push(lang)
    window.history.replaceState(null, '', `#${hashParts.join('/')}`)
  }, [activeTab, activeSub, lang])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === 's') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('pipeline:save-section'))
        return
      }
      if (isEditable && e.key !== 'l') return

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        const def = sectionDefs[idx]
        if (def) {
          setActiveTab(def.key)
          setActiveSub(null)
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const currentIdx = sectionDefs.findIndex(s => s.key === activeTab)
        const newIdx = e.key === 'ArrowLeft' ? Math.max(0, currentIdx - 1) : Math.min(sectionDefs.length - 1, currentIdx + 1)
        const newDef = sectionDefs[newIdx]
        if (newDef) setActiveTab(newDef.key)
        setActiveSub(null)
        return
      }
      if (e.key === 'l') {
        e.preventDefault()
        setLang(prev => prev === 'en' ? 'pt' : 'en')
        return
      }
      if (e.key === 'e') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('pipeline:toggle-edit'))
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, sectionDefs])

  const activeDef = sectionDefs.find(s => s.key === activeTab)
  const hasSubs = activeDef?.subSections && activeDef.subSections.length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Primary tabs + language toggle */}
      <div className="flex items-end justify-between" style={{ borderBottom: '1px solid var(--gem-border)' }}>
        <div className="flex overflow-x-auto" role="tablist" aria-label="Seções do pipeline item" style={{ scrollbarWidth: 'none' }}>
          {sectionDefs.map((def, i) => {
            const isActive = activeTab === def.key
            const sectionKey = def.shared ? `${def.key}_shared` : `${def.key}_${lang}`
            const hasContent = !!sections[sectionKey]
            return (
              <button
                key={def.key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${def.key}`}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap select-none transition-colors"
                style={{
                  color: isActive ? 'var(--gem-text)' : 'var(--gem-dim)',
                  borderBottom: isActive ? '2px solid var(--gem-accent)' : '2px solid transparent',
                }}
                onClick={() => { setActiveTab(def.key); setActiveSub(null) }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hasContent ? 'var(--gem-done)' : 'transparent', border: hasContent ? 'none' : '1px solid var(--gem-dim)' }} />
                {def.label_pt}
                {def.subSections && <span className="text-[9px] ml-0.5" style={{ color: 'var(--gem-dim)' }}>{def.subSections.length}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex mb-2 rounded overflow-hidden" style={{ border: '1px solid var(--gem-border)' }}>
          {['pt', 'en'].map(l => (
            <button
              key={l}
              className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider transition-colors"
              style={{
                background: lang === l ? 'var(--gem-accent)' : 'transparent',
                color: lang === l ? 'white' : 'var(--gem-dim)',
              }}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs for sections with sub-sections (e.g., postprod) */}
      {hasSubs && (
        <div className="flex gap-0 px-4" role="tablist" aria-label={`Sub-seções de ${activeDef.label_pt}`} style={{ background: 'var(--gem-well)', borderBottom: '1px solid var(--gem-border)' }}>
          {activeDef.subSections!.map(sub => {
            const isSubActive = activeSub === sub.key || (!activeSub && sub === activeDef.subSections![0])
            return (
              <button
                key={sub.key}
                role="tab"
                aria-selected={isSubActive}
                className="px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors"
                style={{
                  color: isSubActive ? '#22d3ee' : 'var(--gem-dim)',
                  borderBottom: isSubActive ? '2px solid #22d3ee' : '2px solid transparent',
                }}
                onClick={() => setActiveSub(sub.key)}
              >
                {sub.label_pt}
              </button>
            )
          })}
        </div>
      )}

      {/* Render children with tab state */}
      {children({
        activeTab,
        activeSub: activeSub ?? activeDef?.subSections?.[0]?.key ?? null,
        lang,
        sections,
        sectionDefs,
        setActiveTab,
        setActiveSub,
        setLang,
      })}
    </div>
  )
}
