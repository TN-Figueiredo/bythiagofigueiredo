'use client'

import { useMemo, useState } from 'react'

interface ResearchItem {
  id: string
  title: string
  topic_id: string
  summary: string | null
  status: string
  word_count: number
  sources: any[]
  version: number
  created_at: string
  updated_at: string
}

interface Topic {
  id: string
  name: string
  icon: string
  path: string
}

interface ResearchListProps {
  items: ResearchItem[]
  topics: Topic[]
  selectedItemId: string | null
  selectedTopicId: string | null
  onSelectItem: (id: string) => void
}

type SortKey = 'recent' | 'title' | 'size'

const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24',
  reviewed: '#34d399',
  starred: '#f472b6',
  archived: '#64748b',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function ResearchList({
  items,
  topics,
  selectedItemId,
  selectedTopicId,
  onSelectItem,
}: ResearchListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('recent')

  const topicMap = useMemo(() => {
    const m = new Map<string, Topic>()
    for (const t of topics) m.set(t.id, t)
    return m
  }, [topics])

  const sorted = useMemo(() => {
    const list = [...items]
    switch (sortKey) {
      case 'recent':
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'title':
        list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
        break
      case 'size':
        list.sort((a, b) => b.word_count - a.word_count)
        break
    }
    return list
  }, [items, sortKey])

  const currentTopic = selectedTopicId ? topicMap.get(selectedTopicId) : null
  const breadcrumb = currentTopic
    ? `${currentTopic.icon} ${currentTopic.name}`
    : '📚 Todas'

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        borderRight: '1px solid var(--gem-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--gem-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gem-text)' }}>
            {breadcrumb}
          </span>
          <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{sorted.length}</span>
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: 11,
            borderRadius: 5,
            border: '1px solid var(--gem-border)',
            backgroundColor: 'var(--gem-well)',
            color: 'var(--gem-text)',
            outline: 'none',
          }}
        >
          <option value="recent">Recentes</option>
          <option value="title">Titulo</option>
          <option value="size">Tamanho</option>
        </select>
      </div>

      {/* Item list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {sorted.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 12 }}>
            Nenhuma pesquisa neste tema.
          </div>
        )}
        {sorted.map((item) => {
          const isSelected = selectedItemId === item.id
          const isArchived = item.status === 'archived'
          const topic = topicMap.get(item.topic_id)
          const snippet = item.summary?.slice(0, 100) || ''

          return (
            <button
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 0,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                borderLeft: isSelected ? '3px solid rgb(99,102,241)' : '3px solid transparent',
                opacity: isArchived ? 0.5 : 1,
              }}
            >
              {/* Row 1: status dot + title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[item.status] ?? '#64748b',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--gem-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {item.title}
                </span>
              </div>
              {/* Row 2: snippet */}
              {snippet && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--gem-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingLeft: 13,
                  }}
                >
                  {snippet}
                </span>
              )}
              {/* Row 3: meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 13 }}>
                {selectedTopicId === null && topic && (
                  <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                    {topic.icon} {topic.name}
                  </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                  {item.word_count.toLocaleString()} palavras
                </span>
                <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                  {timeAgo(item.updated_at)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
