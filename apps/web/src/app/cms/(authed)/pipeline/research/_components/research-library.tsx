/** @deprecated Replaced by research-module.tsx in the 3-tab redesign (Foco / Pesquisas / Decisoes). */

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { TopicTree } from './topic-tree'
import { ResearchList } from './research-list'
import { ResearchDetail } from './research-detail'
import type {
  ResearchTopic,
  ResearchItemSummary,
  ResearchItemFull,
  ResearchStats,
  TopicItemCounts,
  ResearchFoco,
  ResearchDecision,
  ResearchTheme,
} from '@/lib/pipeline/research-types'

interface ResearchLibraryProps {
  topics: ResearchTopic[]
  items: ResearchItemSummary[]
  stats: ResearchStats
  topicItemCounts: TopicItemCounts
  focos: ResearchFoco[]
  decisions: ResearchDecision[]
  themes: ResearchTheme[]
}

export function ResearchLibrary({
  topics,
  items: initialItems,
  stats,
  topicItemCounts,
  focos: _focos,
  decisions: _decisions,
  themes: _themes,
}: ResearchLibraryProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [detailItem, setDetailItem] = useState<ResearchItemFull | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState(false)

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
    return items.filter((item) => item.topic_id && topicChildIds.has(item.topic_id))
  }, [items, topicChildIds])

  const handleSelectItem = useCallback(async (id: string) => {
    setSelectedItemId(id)
    setIsEditing(false)
    setLoadingDetail(true)
    setDetailError(false)

    try {
      const res = await fetch(`/api/pipeline/research/${id}`)
      if (res.ok) {
        const { data } = await res.json()
        setDetailItem(data)
      } else {
        setDetailError(true)
      }
    } catch {
      setDetailError(true)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleItemUpdated = useCallback((updated: Partial<ResearchItemFull> & { id: string }) => {
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

  const handleCreateTopic = useCallback(async () => {
    const name = window.prompt('Nome do topic:')
    if (!name) return
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { createResearchTopic } = await import('../actions')
    await createResearchTopic({ name, slug, parent_id: selectedTopicId })
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
    <div className="flex" style={{ height: '100%', gap: 0, position: 'relative' }}>
      <TopicTree
        topics={topics}
        topicItemCounts={topicItemCounts}
        selectedTopicId={selectedTopicId}
        onSelectTopic={setSelectedTopicId}
        onCreateTopic={handleCreateTopic}
        totalItemCount={stats.total}
        totalUnreadCount={stats.fresca}
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
        loading={loadingDetail}
        error={detailError}
        isEditing={isEditing}
        onToggleEdit={setIsEditing}
        onItemUpdated={handleItemUpdated}
        onItemDeleted={handleItemDeleted}
        onSelectTopic={setSelectedTopicId}
        onRetry={() => selectedItemId && handleSelectItem(selectedItemId)}
      />
    </div>
  )
}
