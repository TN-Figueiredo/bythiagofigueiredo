import type { ResearchStatus } from './research-schemas'

export const RESEARCH_STATUS_COLORS: Record<ResearchStatus, string> = {
  new: '#fbbf24',
  reviewed: '#34d399',
  starred: '#f472b6',
  archived: '#64748b',
}

export interface ResearchTopic {
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

export interface ResearchSource {
  url: string
  title: string
  accessed_at?: string
}

export interface ResearchItemSummary {
  id: string
  title: string
  topic_id: string
  summary: string | null
  status: ResearchStatus
  word_count: number
  sources: ResearchSource[]
  version: number
  created_at: string
  updated_at: string
}

export interface ResearchItemFull extends ResearchItemSummary {
  content_json: Record<string, unknown> | null
  content_md: string | null
  topic_path?: string
  topic_name?: string
  topic_icon?: string
  linked_items?: ResearchLinkedItem[]
}

export interface ResearchLinkedItem {
  link_id: string
  pipeline_item_id: string
  note: string | null
  title: string
  format?: string
  stage?: string
}

export interface ResearchStats {
  total: number
  unread: number
  starred: number
  reviewed: number
  archived: number
}

export interface TopicItemCounts {
  [topicId: string]: { total: number; unread: number }
}
