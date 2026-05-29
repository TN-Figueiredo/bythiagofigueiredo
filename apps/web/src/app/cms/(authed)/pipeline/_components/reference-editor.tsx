'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { REFERENCE_USAGE } from '@/lib/pipeline/reference-groups'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { ApiCatalogView } from './api-catalog-view'

type ActiveTab = 'references' | 'catalog'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GroupDef {
  id: string
  label: string
  color: string
}

interface ReferenceDoc {
  key: string
  title: string
  content_md: string | null
  content_compact: Record<string, unknown> | null
  ref_group: string
  sort_order: number
  updated_at: string
}

type SaveState = 'idle' | 'saving' | 'saved'

const SKILL_COLORS: Record<string, string> = {
  Ideator: '#a78bfa',
  Writer: '#fbbf24',
  Producer: '#22d3ee',
  'Product Eval': '#fb7185',
  'Perf Review': '#38bdf8',
}

const COLLAPSE_KEY = 'ref-groups-collapsed'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'just now'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function isRecentlyEdited(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ backgroundColor: 'rgba(99,102,241,0.25)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ReferenceEditor({ docs, groups, onUpsert }: { docs: ReferenceDoc[]; groups: GroupDef[]; onUpsert: (key: string, data: { title: string; content_md?: string; content_compact?: Record<string, unknown>; ref_group?: string; sort_order?: number }) => Promise<unknown> }) {
  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('references')
  const totalEndpoints = useMemo(
    () => API_REGISTRY.capabilities.reduce((s, c) => s + c.endpoint_count, 0),
    [],
  )

  // State
  const [selected, setSelected] = useState<string | null>(docs[0]?.key ?? null)
  const [title, setTitle] = useState(docs[0]?.title ?? '')
  const [content, setContent] = useState(docs[0]?.content_md ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const firstGroup = docs[0]?.ref_group ?? ''
    const initial: Record<string, boolean> = {}
    for (const g of groups) {
      initial[g.id] = g.id !== firstGroup
    }
    return initial
  })
  const [copiedKey, setCopiedKey] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coworkBtnRef = useRef<HTMLDivElement>(null)

  // Hydrate collapse state from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY)
      if (stored) setCollapsed(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  // Persist collapse state
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed))
    } catch { /* ignore */ }
  }, [collapsed])

  // Grouped docs (memoized)
  const grouped = useMemo(() => {
    const map = new Map<string, ReferenceDoc[]>()
    for (const g of groups) {
      map.set(g.id, [])
    }
    for (const doc of docs) {
      const list = map.get(doc.ref_group)
      if (list) {
        list.push(doc)
      } else {
        map.get(groups[0]?.id ?? '')?.push(doc)
      }
    }
    // Sort each group by sort_order then key
    for (const [, list] of map) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key))
    }
    return map
  }, [docs, groups])

  // Filtered docs for search mode
  const filtered = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return docs.filter(
      (d) => d.title.toLowerCase().includes(q) || d.key.toLowerCase().includes(q)
    )
  }, [docs, search])

  // Select a doc
  const selectDoc = useCallback((key: string) => {
    const doc = docs.find((d) => d.key === key)
    if (!doc) return
    setSelected(key)
    setTitle(doc.title)
    setContent(doc.content_md ?? '')
    setSaveState('idle')
  }, [docs])

  // Save handler
  const handleSave = useCallback(async () => {
    if (!selected) return
    setSaveState('saving')
    try {
      await onUpsert(selected, { title, content_md: content })
      setSaveState('saved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('idle')
    }
  }, [selected, title, content, onUpsert])

  // New reference handler
  const handleNewReference = useCallback(async () => {
    const key = window.prompt('Reference API key (e.g. writer-voice-guide):')
    if (!key || !key.trim()) return
    const trimmed = key.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!trimmed || !/^[a-z][a-z0-9-]{0,99}$/.test(trimmed)) {
      window.alert('Invalid key. Must start with a letter and contain only lowercase letters, numbers, and hyphens.')
      return
    }
    const refTitle = trimmed
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    const firstGroup = groups[0]?.id ?? 'pessoal'
    await onUpsert(trimmed, {
      title: refTitle,
      content_md: '',
      ref_group: firstGroup,
      sort_order: 9999,
    })
    // Select the new doc (optimistic)
    setSelected(trimmed)
    setTitle(refTitle)
    setContent('')
    setSaveState('idle')
  }, [onUpsert, groups])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+S: save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
        return
      }
      // Cmd+K: focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      // Cmd+P: open Cowork deep link (delegates to CoworkDeepLink button)
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        const btn = coworkBtnRef.current?.querySelector('button')
        btn?.click()
        return
      }
      // Esc: clear search when search is focused
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        e.preventDefault()
        setSearch('')
        searchRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // Copy API key
  const copyKey = useCallback(() => {
    if (!selected) return
    navigator.clipboard.writeText(selected)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 1500)
  }, [selected])

  // Toggle group collapse
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }, [])

  const collapseAll = useCallback(() => {
    const all: Record<string, boolean> = {}
    for (const g of groups) all[g.id] = true
    setCollapsed(all)
  }, [groups])

  const expandAll = useCallback(() => {
    const all: Record<string, boolean> = {}
    for (const g of groups) all[g.id] = false
    setCollapsed(all)
  }, [groups])

  // Current doc for detail view
  const currentDoc = useMemo(() => docs.find((d) => d.key === selected), [docs, selected])
  const currentGroup = currentDoc ? (groups.find((g) => g.id === currentDoc.ref_group) ?? groups[0]) : null
  const usedBy = selected ? REFERENCE_USAGE[selected] ?? [] : []

  return (
    <div
      className="flex flex-col h-[calc(100vh-10rem)]"
      style={{ gap: 0 }}
    >
      {/* ─── Tab bar ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          borderBottom: '1px solid var(--gem-border)',
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        {(['references', 'catalog'] as const).map((tab) => {
          const isActive = activeTab === tab
          const label = tab === 'references' ? 'References' : 'API Catalog'
          const count = tab === 'references' ? docs.length : totalEndpoints
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-[#7a8ba3] hover:text-[#c4cbda]'}`}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                backgroundColor: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: isActive ? '2px solid rgb(129,140,248)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {label}{' '}
              <span
                style={{
                  fontSize: 10,
                  color: isActive ? 'rgb(165,180,252)' : 'var(--gem-muted)',
                  backgroundColor: isActive ? 'rgba(99,102,241,0.12)' : 'var(--gem-well)',
                  borderRadius: 9999,
                  padding: '1px 7px',
                  marginLeft: 4,
                  transition: 'all 0.15s',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <div ref={coworkBtnRef} style={{ marginBottom: 6 }}>
          <CoworkDeepLink
            instruction={buildCoworkInstruction('reference-overview', {} as Record<string, never>)}
            variant="button"
            shortcut="⌘P"
          />
        </div>
      </div>

      {/* ─── Tab content ───────────────────────────────────────────────── */}
      {activeTab === 'catalog' ? (
        <div key="catalog" style={{ flex: 1, overflow: 'hidden', animation: 'fade-in 0.15s ease' }}>
          <ApiCatalogView />
        </div>
      ) : (
      <div key="references" className="flex" style={{ flex: 1, gap: 0, overflow: 'hidden', animation: 'fade-in 0.15s ease' }}>
      {/* ─── Sidebar ────────────────────────────────────────────────────── */}
      <div
        style={{
          width: 264,
          minWidth: 264,
          borderRight: '1px solid var(--gem-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: '12px 12px 8px',
            borderBottom: '1px solid var(--gem-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gem-text)' }}>
                References
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--gem-muted)',
                  backgroundColor: 'var(--gem-well)',
                  borderRadius: 9999,
                  padding: '1px 7px',
                }}
              >
                {docs.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={expandAll}
                title="Expand all"
                aria-label="Expand all reference groups"
                type="button"
                className="rounded transition-colors hover:bg-white/[0.06]"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px 4px',
                  color: 'var(--gem-muted)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="1" y="1" width="10" height="10" rx="1.5" />
                  <path d="M6 3.5v5M3.5 6h5" />
                </svg>
              </button>
              <button
                onClick={collapseAll}
                title="Collapse all"
                aria-label="Collapse all reference groups"
                type="button"
                className="rounded transition-colors hover:bg-white/[0.06]"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px 4px',
                  color: 'var(--gem-muted)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="1" y="1" width="10" height="10" rx="1.5" />
                  <path d="M3.5 6h5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="transition-shadow focus:ring-1 focus:ring-indigo-500/40"
              style={{
                width: '100%',
                padding: '5px 8px',
                paddingRight: 52,
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--gem-border)',
                backgroundColor: 'var(--gem-well)',
                color: 'var(--gem-text)',
                outline: 'none',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 9,
                color: 'var(--gem-muted)',
                opacity: 0.6,
                pointerEvents: 'none',
                fontFamily: 'monospace',
              }}
            >
              {'⌘'}K
            </span>
          </div>
        </div>

        {/* Sidebar body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filtered !== null ? (
            /* ── Search results (flat) ────────────────────────────── */
            <div style={{ padding: '4px 8px' }}>
              <div style={{ fontSize: 10, color: 'var(--gem-muted)', marginBottom: 6, paddingLeft: 4 }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </div>
              {filtered.map((doc) => {
                const gm = groups.find((g) => g.id === doc.ref_group) ?? groups[0] ?? { id: '', label: '', color: '#888' }
                return (
                  <button
                    key={doc.key}
                    onClick={() => selectDoc(doc.key)}
                    className={`transition-colors ${selected !== doc.key ? 'hover:bg-white/[0.04]' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      marginBottom: 2,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: selected === doc.key ? 'rgba(99,102,241,0.12)' : undefined,
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 28,
                        borderRadius: 2,
                        backgroundColor: gm.color,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--gem-text)', lineHeight: '16px' }}>
                        {highlightMatch(doc.title || doc.key, search)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--gem-muted)', marginTop: 1 }}>
                        <span style={{ opacity: 0.7 }}>{gm.label}</span>
                        {' · '}
                        <span style={{ fontFamily: 'monospace', opacity: 0.5 }}>
                          {highlightMatch(doc.key, search)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--gem-muted)', textAlign: 'center', padding: '16px 0' }}>
                  No matches found
                </div>
              )}
            </div>
          ) : (
            /* ── Grouped accordion ────────────────────────────────── */
            <div>
              {groups.map((group) => {
                const groupDocs = grouped.get(group.id) ?? []
                if (groupDocs.length === 0) return null
                const isCollapsed = collapsed[group.id] ?? false

                return (
                  <div key={group.id} style={{ marginBottom: 2 }}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="transition-colors hover:bg-white/[0.03]"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 10px',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 4,
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          color: 'var(--gem-muted)',
                          flexShrink: 0,
                          transition: 'transform 0.15s',
                          transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                        }}
                      >
                        <path d="M3 1.5l3.5 3.5L3 8.5" />
                      </svg>
                      <div
                        style={{
                          width: 3,
                          height: 14,
                          borderRadius: 2,
                          backgroundColor: group.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)', flex: 1 }}>
                        {group.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--gem-muted)',
                          backgroundColor: 'var(--gem-well)',
                          borderRadius: 9999,
                          padding: '0 6px',
                          lineHeight: '16px',
                        }}
                      >
                        {groupDocs.length}
                      </span>
                    </button>

                    {/* Group items */}
                    {!isCollapsed && (
                      <div style={{ paddingLeft: 12, paddingRight: 4 }}>
                        {groupDocs.map((doc) => {
                          const isSelected = selected === doc.key
                          const recent = isRecentlyEdited(doc.updated_at)

                          return (
                            <button
                              key={doc.key}
                              onClick={() => selectDoc(doc.key)}
                              className={`transition-colors ${!isSelected ? 'hover:bg-white/[0.04]' : ''}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                width: '100%',
                                textAlign: 'left',
                                padding: '5px 8px',
                                marginBottom: 1,
                                borderRadius: 5,
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : undefined,
                                borderLeft: isSelected ? '2px solid rgb(99,102,241)' : '2px solid transparent',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  color: isSelected ? 'var(--gem-text)' : 'var(--gem-muted)',
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.title || doc.key}
                              </span>
                              {recent && (
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: '#34d399',
                                    flexShrink: 0,
                                  }}
                                  title="Edited recently"
                                />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--gem-border)' }}>
          <button
            onClick={handleNewReference}
            className="transition-colors hover:border-[#334155] hover:text-[#c4cbda]"
            style={{
              width: '100%',
              padding: '6px 0',
              fontSize: 12,
              color: 'var(--gem-muted)',
              border: '1px dashed var(--gem-border)',
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: 'transparent',
            }}
          >
            + New Reference
          </button>
        </div>
      </div>

      {/* ─── Detail view ────────────────────────────────────────────────── */}
      {currentDoc && currentGroup ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Detail header */}
          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            {/* Row 1: group badge + updated + copy key */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: currentGroup.color,
                  backgroundColor: `${currentGroup.color}18`,
                  borderRadius: 4,
                  padding: '2px 8px',
                }}
              >
                <span
                  style={{
                    width: 3,
                    height: 10,
                    borderRadius: 1,
                    backgroundColor: currentGroup.color,
                  }}
                />
                {currentGroup.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
                Updated {timeAgo(currentDoc.updated_at)}
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={copyKey}
                title="Copy API key"
                style={{
                  fontSize: 11,
                  color: copiedKey ? '#34d399' : 'var(--gem-muted)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--gem-border)',
                  borderRadius: 5,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  transition: 'color 0.2s',
                }}
              >
                {copiedKey ? 'Copied!' : 'Copy Key'}
              </button>
            </div>

            {/* Row 2: Title input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reference title"
              style={{
                width: '100%',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--gem-text)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '4px 0',
              }}
            />

            {/* Row 3: Metadata chips */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                padding: '10px 0',
                marginTop: 4,
                borderTop: '1px solid var(--gem-border)',
              }}
            >
              {/* API key chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  API KEY
                </span>
                <code
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--gem-text)',
                    backgroundColor: 'var(--gem-well)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    border: '1px solid var(--gem-border)',
                  }}
                >
                  {currentDoc.key}
                </code>
              </div>

              {/* Used by pills */}
              {usedBy.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    USED BY
                  </span>
                  {usedBy.map((skill) => {
                    const pillColor = SKILL_COLORS[skill] ?? 'var(--gem-muted)'
                    return (
                      <span
                        key={skill}
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: pillColor,
                          backgroundColor: `${pillColor}18`,
                          borderRadius: 9999,
                          padding: '1px 8px',
                          lineHeight: '16px',
                        }}
                      >
                        {skill}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Editor textarea */}
          <div style={{ flex: 1, padding: '0 20px', overflow: 'hidden', display: 'flex' }}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Markdown content..."
              style={{
                flex: 1,
                width: '100%',
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: '20px',
                color: 'var(--gem-text)',
                backgroundColor: 'var(--gem-well)',
                border: '1px solid var(--gem-border)',
                borderRadius: 8,
                padding: '12px 14px',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>

          {/* Save bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 20px',
              borderTop: '1px solid var(--gem-border)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
              {content.length.toLocaleString()} chars
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--gem-muted)', fontFamily: 'monospace', opacity: 0.6 }}>
                {'⌘'}S
              </span>
              <button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                style={{
                  padding: '6px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saveState === 'saving' ? 'default' : 'pointer',
                  transition: 'background-color 0.2s',
                  backgroundColor:
                    saveState === 'saved'
                      ? '#34d399'
                      : saveState === 'saving'
                        ? 'rgba(99,102,241,0.5)'
                        : 'rgb(99,102,241)',
                }}
              >
                {saveState === 'saved'
                  ? '✓ Saved'
                  : saveState === 'saving'
                    ? 'Saving...'
                    : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gem-muted)',
            fontSize: 13,
          }}
        >
          {docs.length === 0
            ? 'No references yet. Create one to get started.'
            : 'Select a reference from the sidebar.'}
        </div>
      )}
    </div>
      )}
    </div>
  )
}
