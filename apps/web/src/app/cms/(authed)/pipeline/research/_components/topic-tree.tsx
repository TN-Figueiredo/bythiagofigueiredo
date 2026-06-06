/** @deprecated Topic tree hierarchy replaced by theme-based filtering in the 3-tab redesign. */

'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import type { ResearchTopic, TopicItemCounts } from '@/lib/pipeline/research-types'

interface TopicTreeProps {
  topics: ResearchTopic[]
  topicItemCounts: TopicItemCounts
  selectedTopicId: string | null
  onSelectTopic: (topicId: string | null) => void
  onCreateTopic: () => void
  totalItemCount: number
  totalUnreadCount: number
}

interface TreeNode extends ResearchTopic {
  children: TreeNode[]
  totalCount: number
  unreadCount: number
}

function buildTree(topics: ResearchTopic[], counts: TopicItemCounts): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const t of topics) {
    const c = counts[t.id] ?? { total: 0, unread: 0 }
    map.set(t.id, { ...t, children: [], totalCount: c.total, unreadCount: c.unread })
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function bubbleUp(node: TreeNode): { total: number; unread: number } {
    let total = counts[node.id]?.total ?? 0
    let unread = counts[node.id]?.unread ?? 0
    for (const child of node.children) {
      const childCounts = bubbleUp(child)
      total += childCounts.total
      unread += childCounts.unread
    }
    node.totalCount = total
    node.unreadCount = unread
    return { total, unread }
  }

  for (const root of roots) bubbleUp(root)
  return roots
}

export function TopicTree({
  topics,
  topicItemCounts,
  selectedTopicId,
  onSelectTopic,
  onCreateTopic,
  totalItemCount,
  totalUnreadCount,
}: TopicTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>()
    for (const t of topics) {
      if (t.depth === 0) set.add(t.id)
    }
    return set
  })
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const tree = useMemo(() => buildTree(topics, topicItemCounts), [topics, topicItemCounts])

  const filteredTopics = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return topics.filter((t) => t.name.toLowerCase().includes(q))
  }, [topics, search])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const renderNode = (node: TreeNode, level: number) => {
    const isSelected = selectedTopicId === node.id
    const isExpanded = expanded.has(node.id)
    const hasChildren = node.children.length > 0

    return (
      <div key={node.id}>
        <button
          onClick={() => onSelectTopic(node.id)}
          className="transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[rgba(255,130,64,0.3)] focus-visible:outline-none"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            textAlign: 'left',
            padding: '5px 8px',
            paddingLeft: 8 + level * 16,
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'rgba(255,130,64,0.08)' : 'transparent',
            borderLeft: isSelected ? '2px solid var(--gem-accent)' : '2px solid transparent',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          {hasChildren && (
            <button
              type="button"
              aria-label={isExpanded ? 'Recolher' : 'Expandir'}
              aria-expanded={isExpanded}
              onClick={(e) => { e.stopPropagation(); toggle(node.id) }}
              style={{
                fontSize: 9,
                color: 'var(--gem-muted)',
                cursor: 'pointer',
                width: 12,
                textAlign: 'center',
                transition: 'transform 0.15s',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              {'▶'}
            </button>
          )}
          {!hasChildren && <span style={{ width: 12 }} />}
          <span style={{ fontSize: 14 }}>{node.icon}</span>
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
            {node.name}
          </span>
          {node.totalCount > 0 && (
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
              {node.totalCount}
            </span>
          )}
          {node.unreadCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.15)',
                borderRadius: 9999,
                padding: '0 5px',
                lineHeight: '16px',
              }}
            >
              {node.unreadCount}
            </span>
          )}
        </button>
        {hasChildren && (
          <div style={{
            overflow: 'hidden',
            maxHeight: isExpanded ? 500 : 0,
            transition: 'max-height 0.2s ease-in-out, opacity 0.15s ease-in-out',
            opacity: isExpanded ? 1 : 0,
          }}>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav
      aria-label="Temas de pesquisa"
      style={{
        width: 220,
        minWidth: 220,
        borderRight: '1px solid var(--gem-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--gem-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gem-text)' }}>Topics</span>
          <button
            onClick={onCreateTopic}
            title="Criar novo tema"
            aria-label="Criar novo tema"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--gem-muted)',
              padding: '0 4px',
            }}
          >
            +
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar temas..."
            aria-label="Filtrar temas"
            style={{
              width: '100%',
              padding: '5px 8px',
              paddingRight: search ? 28 : 8,
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--gem-border)',
              backgroundColor: 'var(--gem-well)',
              color: 'var(--gem-text)',
              outline: 'none',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); searchRef.current?.focus() }}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--gem-muted)',
                padding: '0 2px',
                lineHeight: 1,
              }}
              aria-label="Limpar filtro"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* "Todas" entry */}
        <button
          onClick={() => onSelectTopic(null)}
          className="transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[rgba(255,130,64,0.3)] focus-visible:outline-none"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            textAlign: 'left',
            padding: '6px 8px',
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: selectedTopicId === null ? 'rgba(255,130,64,0.08)' : 'transparent',
            borderLeft: selectedTopicId === null ? '2px solid var(--gem-accent)' : '2px solid transparent',
          }}
          onMouseEnter={(e) => {
            if (selectedTopicId !== null) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'
          }}
          onMouseLeave={(e) => {
            if (selectedTopicId !== null) e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <span style={{ width: 12 }} />
          <span style={{ fontSize: 14 }}>{'📚'}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: selectedTopicId === null ? 'var(--gem-text)' : 'var(--gem-muted)',
              flex: 1,
            }}
          >
            Todas
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
            {totalItemCount}
          </span>
          {totalUnreadCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.15)',
                borderRadius: 9999,
                padding: '0 5px',
                lineHeight: '16px',
              }}
            >
              {totalUnreadCount}
            </span>
          )}
        </button>

        {/* Topic tree or filtered list */}
        {tree.length === 0 && !filteredTopics && (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <span style={{ fontSize: 20, opacity: 0.2 }}>{'🗂️'}</span>
            <span className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
              Nenhum tema criado.
            </span>
            <button
              type="button"
              onClick={onCreateTopic}
              className="text-[11px] font-medium rounded-md px-3 py-1 cursor-pointer transition-all duration-150"
              style={{
                color: 'var(--gem-accent)',
                border: '1px solid var(--gem-border)',
                backgroundColor: 'transparent',
              }}
            >
              + Criar primeiro tema
            </button>
          </div>
        )}
        {filteredTopics
          ? filteredTopics.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 8px',
                  borderRadius: 5,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: selectedTopicId === t.id ? 'rgba(255,130,64,0.08)' : 'transparent',
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--gem-text)' }}>{t.name}</span>
                <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{t.path}</span>
              </button>
            ))
          : tree.map((node) => renderNode(node, 0))}
      </div>
    </nav>
  )
}
