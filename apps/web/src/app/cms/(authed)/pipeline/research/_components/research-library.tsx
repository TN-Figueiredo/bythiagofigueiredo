'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { TopicTree } from './topic-tree'
import { ResearchList } from './research-list'
import { ResearchDetail } from './research-detail'

interface Topic {
  id: string
  parent_id: string | null
  name: string
  slug: string
  path: string
  depth: number
  color: string
  icon: string
  sort_order: number
}

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
  content_json?: any
  content_md?: string | null
}

interface Stats {
  total: number
  unread: number
  starred: number
  reviewed: number
  archived: number
}

interface ResearchLibraryProps {
  topics: Topic[]
  items: ResearchItem[]
  stats: Stats
  topicItemCounts: Record<string, { total: number; unread: number }>
}

export function ResearchLibrary({
  topics,
  items: initialItems,
  stats,
  topicItemCounts,
}: ResearchLibraryProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [detailItem, setDetailItem] = useState<ResearchItem | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const topicChildIds = useMemo(() => {
    if (!selectedTopicId) return null
    const selected = topics.find((t) => t.id === selectedTopicId)
    if (!selected) return new Set<string>()
    const ids = new Set<string>()
    ids.add(selectedTopicId)
    for (const t of topics) {
      if (t.path.startsWith(selected.path + '/') || t.id === selectedTopicId) {
        ids.add(t.id)
      }
    }
    return ids
  }, [selectedTopicId, topics])

  const filteredItems = useMemo(() => {
    if (!topicChildIds) return items
    return items.filter((item) => topicChildIds.has(item.topic_id))
  }, [items, topicChildIds])

  const handleSelectItem = useCallback(async (id: string) => {
    setSelectedItemId(id)
    setIsEditing(false)
    setLoadingDetail(true)

    try {
      const res = await fetch(`/api/pipeline/research/${id}`)
      if (res.ok) {
        const { data } = await res.json()
        setDetailItem(data)
      }
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleItemUpdated = useCallback((updated: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    )
    setDetailItem((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }, [])

  const handleItemDeleted = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    if (selectedItemId === id) {
      setSelectedItemId(null)
      setDetailItem(null)
    }
  }, [selectedItemId])

  const handleCreateTopic = useCallback(() => {
    const name = window.prompt('Nome do topic:')
    if (!name) return
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    fetch('/api/pipeline/research/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, parent_id: selectedTopicId }),
    }).then(() => {
      window.location.reload()
    })
  }, [selectedTopicId])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.isContentEditable || target.closest('.ProseMirror')

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        return
      }

      if (e.key === 'Escape') {
        if (isEditing) { setIsEditing(false); return }
        if (selectedItemId) { setSelectedItemId(null); setDetailItem(null); return }
      }

      if (isTyping) return

      if (e.key === 'e' || e.key === 'E') {
        if (selectedItemId && !isEditing) {
          e.preventDefault()
          setIsEditing(true)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, selectedItemId])

  return (
    <div className="flex" style={{ height: '100%', gap: 0 }}>
      <TopicTree
        topics={topics}
        topicItemCounts={topicItemCounts}
        selectedTopicId={selectedTopicId}
        onSelectTopic={setSelectedTopicId}
        onCreateTopic={handleCreateTopic}
        totalItemCount={stats.total}
        totalUnreadCount={stats.unread}
      />
      <ResearchList
        items={filteredItems}
        topics={topics}
        selectedItemId={selectedItemId}
        selectedTopicId={selectedTopicId}
        onSelectItem={handleSelectItem}
      />
      <ResearchDetail
        item={detailItem}
        isEditing={isEditing}
        onToggleEdit={setIsEditing}
        onItemUpdated={handleItemUpdated}
        onItemDeleted={handleItemDeleted}
      />
    </div>
  )
}
