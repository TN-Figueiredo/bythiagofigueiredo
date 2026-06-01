'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { Format } from '@/lib/pipeline/schemas'
import { getSectionsForFormat, getSectionKey, type SectionDefinition } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'

const BLOG_TAB_ACCESS: Record<string, string[]> = {
  idea: ['ideia'],
  draft: ['ideia', 'draft'],
  ready: ['ideia', 'draft', 'seo', 'images'],
  scheduled: ['ideia', 'draft', 'seo', 'images', 'publish'],
  published: ['ideia', 'draft', 'seo', 'images', 'publish'],
}

interface TabContainerProps {
  format: Format
  stage?: string
  itemId: string
  itemVersion: number
  sections: Record<string, SectionData>
  itemCode: string
  itemTitle: string
  itemLanguage: 'pt-br' | 'en' | 'both'
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

export function TabContainer({ format, stage, itemId, itemVersion, sections, itemCode, itemTitle, itemLanguage, children }: TabContainerProps) {
  const sectionDefs = useMemo(() => getSectionsForFormat(format), [format])
  const [activeTab, setActiveTab] = useState(() => {
    const skip = new Set(['seo', 'images', 'publish'])
    for (let i = sectionDefs.length - 1; i >= 0; i--) {
      const def = sectionDefs[i]!
      if (skip.has(def.key)) continue
      if (hasAnyContent(def, sections)) return def.key
    }
    return sectionDefs[0]?.key ?? ''
  })
  const [activeSub, setActiveSub] = useState<string | null>(null)
  const [lang, setLang] = useState(() => itemLanguage === 'en' ? 'en' : 'pt')
  const [langTransition, setLangTransition] = useState(false)
  const [showScrollRight, setShowScrollRight] = useState(false)
  const [showScrollLeft, setShowScrollLeft] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  const shortcutsRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  const enabledTabs = useMemo(() => {
    const enabled = new Set<string>()
    const defsByKey = new Map(sectionDefs.map(d => [d.key, d]))

    // For blog_post, use stage-based progressive disclosure
    const stageAllowedKeys = format === 'blog_post' && stage
      ? (BLOG_TAB_ACCESS[stage] ?? Object.values(BLOG_TAB_ACCESS).at(-1) ?? [])
      : null

    for (const def of sectionDefs) {
      // Stage gate: if we have a stage-based allowlist, check it first
      if (stageAllowedKeys && !stageAllowedKeys.includes(def.key)) continue

      const deps = TAB_DEPENDENCIES[def.key]
      if (!deps) {
        enabled.add(def.key)
        continue
      }
      const relevantDeps = deps.filter(depKey => defsByKey.has(depKey))
      const allDepsMet = relevantDeps.length === 0 || relevantDeps.every(depKey => {
        const depDef = defsByKey.get(depKey)!
        return hasAnyContent(depDef, sections)
      })
      if (allDepsMet) enabled.add(def.key)
    }

    return enabled
  }, [format, stage, sectionDefs, sections])

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

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    const check = () => {
      setShowScrollRight(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
      setShowScrollLeft(el.scrollLeft > 4)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [sectionDefs])

  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null
    el?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  }, [activeTab])

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
      // Escape closes shortcuts panel regardless of meta key
      if (e.key === 'Escape' && showShortcuts) {
        e.preventDefault()
        setShowShortcuts(false)
        return
      }

      if (!(e.metaKey || e.ctrlKey)) return
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowShortcuts(s => !s)
        return
      }

      if (e.key === 's') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('pipeline:save-section'))
        return
      }
      if (isEditable && e.key !== 'l' && e.key !== 'e') return

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
        const direction = e.key === 'ArrowLeft' ? -1 : 1
        let newIdx = currentIdx + direction
        while (newIdx >= 0 && newIdx < sectionDefs.length) {
          const candidate = sectionDefs[newIdx]
          if (candidate && enabledTabs.has(candidate.key)) break
          newIdx += direction
        }
        const newDef = sectionDefs[newIdx]
        if (newDef && enabledTabs.has(newDef.key)) handleTabSwitch(newDef.key)
        return
      }
      if (e.key === 'l' && itemLanguage === 'both') {
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
  }, [activeTab, sectionDefs, lang, itemLanguage, handleTabSwitch, handleLangSwitch, showShortcuts])

  useEffect(() => {
    if (!showShortcuts) return
    previousFocusRef.current = document.activeElement
    const el = shortcutsRef.current
    if (el) el.focus()
    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !el) return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const items = Array.from(focusable).filter(f => f.offsetParent !== null)
      if (items.length === 0) { e.preventDefault(); el.focus(); return }
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === el) {
          e.preventDefault(); last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => {
      document.removeEventListener('keydown', trapFocus)
      if (previousFocusRef.current instanceof HTMLElement) previousFocusRef.current.focus()
    }
  }, [showShortcuts])

  const activeDef = sectionDefs.find(s => s.key === activeTab)
  const hasSubs = activeDef?.subSections && activeDef.subSections.length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Primary tabs + language toggle */}
      <div className="flex items-end justify-between" style={{ borderBottom: '1px solid var(--gem-border)' }}>
        <div className="relative flex-1 min-w-0">
          <div ref={tabsRef} className="flex overflow-x-auto" role="tablist" aria-label="Seções do pipeline item" style={{ scrollbarWidth: 'none' }}>
            {sectionDefs.map((def, i) => {
              const isActive = activeTab === def.key
              const hasContent = hasAnyContent(def, sections)
              const isEnabled = enabledTabs.has(def.key)
              const isStageLocked = !isEnabled && format === 'blog_post' && stage
                ? !(BLOG_TAB_ACCESS[stage] ?? []).includes(def.key)
                : false
              const disabledTitle = isStageLocked
                ? 'Avance o stage para desbloquear'
                : !isEnabled
                  ? 'Complete a seção anterior primeiro'
                  : undefined
              return (
                <button
                  key={def.key}
                  id={`tab-${def.key}`}
                  data-tab={def.key}
                  role="tab"
                  aria-selected={isActive}
                  aria-disabled={!isEnabled}
                  aria-controls={`panel-${def.key}`}
                  tabIndex={isEnabled ? 0 : -1}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap select-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30"
                  style={{
                    color: !isEnabled ? 'var(--gem-border)' : isActive ? 'var(--gem-text)' : 'var(--gem-dim)',
                    borderBottom: isActive ? '2px solid var(--gem-accent)' : '2px solid transparent',
                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                    opacity: isEnabled ? 1 : 0.4,
                    outline: 'none',
                  }}
                  onClick={() => handleTabSwitch(def.key)}
                  title={disabledTitle}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hasContent ? 'var(--gem-done)' : 'transparent', border: hasContent ? 'none' : '1px solid var(--gem-dim)' }} />
                  {def.label_pt}
                  {def.subSections && <span className="text-[10px] ml-0.5" style={{ color: 'var(--gem-dim)' }}>{def.subSections.length}</span>}
                </button>
              )
            })}
          </div>
          {showScrollLeft && (
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(to left, transparent, var(--gem-surface))', pointerEvents: 'none', zIndex: 5 }} />
          )}
          {showScrollRight && (
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(to right, transparent, var(--gem-surface))', pointerEvents: 'none', zIndex: 5 }} />
          )}
        </div>
        {itemLanguage === 'both' && !(activeDef?.shared) && (
          <div className="flex mb-2 rounded overflow-hidden" style={{ border: '1px solid var(--gem-border)' }}>
            {(['pt', 'en'] as const).map(l => {
              const isShared = activeDef?.shared ?? false
              const sectionKey = getSectionKey(activeTab, isShared ? 'en' : l)
              const hasContent = !!sections[sectionKey]
              return (
                <button
                  key={l}
                  className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 outline-none"
                  style={{
                    background: lang === l ? 'var(--gem-accent)' : 'transparent',
                    color: lang === l ? 'white' : 'var(--gem-dim)',
                  }}
                  onClick={() => handleLangSwitch(l)}
                >
                  {l.toUpperCase()}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: hasContent ? 'var(--gem-done)' : 'transparent',
                      border: hasContent ? 'none' : `1px solid ${lang === l ? 'rgba(255,255,255,0.4)' : 'var(--gem-dim)'}`,
                    }}
                  />
                </button>
              )
            })}
          </div>
        )}
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
                className="px-3 py-1.5 text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 outline-none"
                style={{
                  color: isSubActive ? 'var(--gem-accent)' : 'var(--gem-dim)',
                  borderBottom: isSubActive ? '2px solid var(--gem-accent)' : '2px solid transparent',
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
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
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

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowShortcuts(false)}>
          <div ref={shortcutsRef} tabIndex={-1} className="rounded-xl p-6 max-w-sm w-full relative" style={{ background: 'var(--gem-surface)', border: '1px solid var(--gem-border)', outline: 'none' }} onClick={e => e.stopPropagation()}>
            <button
              aria-label="Fechar"
              className="absolute top-3 right-3 p-1 rounded transition-colors hover:bg-[var(--gem-well)]"
              style={{ color: 'var(--gem-dim)' }}
              onClick={() => setShowShortcuts(false)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
            <h3 id="shortcuts-title" className="text-sm font-semibold mb-4" style={{ color: 'var(--gem-text)' }}>Atalhos de Teclado</h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {([
                ['Salvar seção', '⌘S'],
                ['Toggle edição', '⌘E'],
                ['Ir para tab N', '⌘1-9'],
                ['Tab anterior/próx', '⌘← →'],
                ['Trocar idioma', '⌘L'],
                ['Este painel', '⌘?'],
              ] as const).map(([label, key]) => (
                <div key={key} className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid var(--gem-border)' }}>
                  <span style={{ color: 'var(--gem-muted)' }}>{label}</span>
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'var(--gem-well)', color: 'var(--gem-dim)', border: '1px solid var(--gem-border)' }}>{key}</kbd>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-4 text-center" style={{ color: 'var(--gem-dim)' }}>
              Pressione Esc ou {'⌘'}? para fechar
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
