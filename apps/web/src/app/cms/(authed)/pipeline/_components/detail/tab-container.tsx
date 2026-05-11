'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Format } from '@/lib/pipeline/schemas'
import { getSectionsForFormat, getSectionKey, type SectionDefinition } from '@/lib/pipeline/sections'
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

function hasAnyContent(def: SectionDefinition, sections: Record<string, SectionData>): boolean {
  const leafKeys = def.subSections
    ? def.subSections.map(s => s.key)
    : [def.key]

  return leafKeys.some(key => {
    if (def.shared || (def.subSections?.some(s => s.key === key && s.shared))) {
      return !!sections[getSectionKey(key, 'en')]
    }
    return !!sections[getSectionKey(key, 'pt')] || !!sections[getSectionKey(key, 'en')]
  })
}

const TAB_DEPENDENCIES: Record<string, string[]> = {
  brolls: ['roteiro'],
  postprod: ['roteiro'],
  publish: ['roteiro'],
  seo: ['draft'],
  images: ['draft'],
  layout: ['content'],
  audience: ['content'],
  send: ['content'],
  lessons: ['curriculum'],
  material: ['curriculum'],
  assets: ['briefing'],
  metrics: ['briefing'],
}

export function TabContainer({ format, itemId, itemVersion, sections, itemCode, itemTitle, children }: TabContainerProps) {
  const sectionDefs = getSectionsForFormat(format)
  const [activeTab, setActiveTab] = useState(sectionDefs[0]?.key ?? '')
  const [activeSub, setActiveSub] = useState<string | null>(null)
  const [lang, setLang] = useState('en')
  const [langTransition, setLangTransition] = useState(false)

  const enabledTabs = useMemo(() => {
    const enabled = new Set<string>()
    const defsByKey = new Map(sectionDefs.map(d => [d.key, d]))

    for (const def of sectionDefs) {
      const deps = TAB_DEPENDENCIES[def.key]
      if (!deps) {
        enabled.add(def.key)
        continue
      }
      const allDepsMet = deps.every(depKey => {
        const depDef = defsByKey.get(depKey)
        return depDef && hasAnyContent(depDef, sections)
      })
      if (allDepsMet) enabled.add(def.key)
    }

    return enabled
  }, [sectionDefs, sections])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const parts = hash.split('/')
    const tab = parts[0] ?? ''
    const sub = parts.length === 3 ? (parts[1] ?? null) : null
    const hashLang = parts[parts.length - 1] ?? ''
    if (tab && sectionDefs.some(s => s.key === tab) && enabledTabs.has(tab)) setActiveTab(tab)
    if (sub) setActiveSub(sub)
    if (hashLang === 'pt' || hashLang === 'en') setLang(hashLang)
  }, [sectionDefs, enabledTabs])

  useEffect(() => {
    const hashParts = [activeTab]
    if (activeSub) hashParts.push(activeSub)
    if (lang !== 'en') hashParts.push(lang)
    window.history.replaceState(null, '', `#${hashParts.join('/')}`)
  }, [activeTab, activeSub, lang])

  const checkDirtyGuard = useCallback((): boolean => {
    const dirty = document.querySelector('[data-section-dirty="true"]')
    if (dirty && !window.confirm('Há alterações não salvas nesta seção. Deseja trocar mesmo assim?')) return false
    return true
  }, [])

  const handleTabSwitch = useCallback((tab: string) => {
    if (!enabledTabs.has(tab)) return
    if (!checkDirtyGuard()) return
    setActiveTab(tab)
    setActiveSub(null)
  }, [checkDirtyGuard, enabledTabs])

  const handleSubSwitch = useCallback((sub: string) => {
    if (!checkDirtyGuard()) return
    setActiveSub(sub)
  }, [checkDirtyGuard])

  const handleLangSwitch = useCallback((l: string) => {
    if (!checkDirtyGuard()) return
    setLangTransition(true)
    setLang(l)
    setTimeout(() => setLangTransition(false), 200)
  }, [checkDirtyGuard])

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
        if (def) handleTabSwitch(def.key)
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const currentIdx = sectionDefs.findIndex(s => s.key === activeTab)
        const newIdx = e.key === 'ArrowLeft' ? Math.max(0, currentIdx - 1) : Math.min(sectionDefs.length - 1, currentIdx + 1)
        const newDef = sectionDefs[newIdx]
        if (newDef) handleTabSwitch(newDef.key)
        return
      }
      if (e.key === 'l') {
        e.preventDefault()
        handleLangSwitch(lang === 'en' ? 'pt' : 'en')
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
  }, [activeTab, sectionDefs, lang, handleTabSwitch, handleLangSwitch])

  const activeDef = sectionDefs.find(s => s.key === activeTab)
  const hasSubs = activeDef?.subSections && activeDef.subSections.length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Primary tabs + language toggle */}
      <div className="flex items-end justify-between" style={{ borderBottom: '1px solid var(--gem-border)' }}>
        <div className="flex overflow-x-auto" role="tablist" aria-label="Seções do pipeline item" style={{ scrollbarWidth: 'none' }}>
          {sectionDefs.map((def, i) => {
            const isActive = activeTab === def.key
            const hasContent = hasAnyContent(def, sections)
            const isEnabled = enabledTabs.has(def.key)
            return (
              <button
                key={def.key}
                role="tab"
                aria-selected={isActive}
                aria-disabled={!isEnabled}
                aria-controls={`panel-${def.key}`}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap select-none transition-colors"
                style={{
                  color: !isEnabled ? 'var(--gem-border)' : isActive ? 'var(--gem-text)' : 'var(--gem-dim)',
                  borderBottom: isActive ? '2px solid var(--gem-accent)' : '2px solid transparent',
                  cursor: isEnabled ? 'pointer' : 'not-allowed',
                  opacity: isEnabled ? 1 : 0.4,
                }}
                onClick={() => handleTabSwitch(def.key)}
                title={!isEnabled ? 'Complete a seção anterior primeiro' : undefined}
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
              onClick={() => handleLangSwitch(l)}
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
                onClick={() => handleSubSwitch(sub.key)}
              >
                {sub.label_pt}
              </button>
            )
          })}
        </div>
      )}

      {/* Render children with tab state + lang transition */}
      <div
        style={{
          opacity: langTransition ? 0.5 : 1,
          transition: 'opacity 150ms ease-in-out',
        }}
      >
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
    </div>
  )
}
