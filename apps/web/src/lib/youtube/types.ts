export interface YouTubeChannelRow {
  id: string
  site_id: string
  channel_id: string
  locale: 'pt' | 'en'
  handle: string
  name: string
  description: string | null
  uploads_playlist_id: string
  subscriber_count: number
  video_count: number
  thumbnail_url: string | null
  banner_url: string | null
  custom_url: string | null
  sync_enabled: boolean
  sync_schedules: SyncScheduleEntry[]
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface SyncScheduleEntry {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  hour: number
  tz: string
  label: string
}

export interface YouTubeCategoryRow {
  id: string
  site_id: string
  slug: string
  name_pt: string
  name_en: string
  description_pt: string | null
  description_en: string | null
  color: string
  sort_order: number
  match_keywords: string[]
  auto_approve: boolean
  created_at: string
  updated_at: string
}

export interface YouTubeVideoRow {
  id: string
  site_id: string
  channel_id: string
  youtube_video_id: string
  title: string
  title_translation: string | null
  description: string | null
  description_translation: string | null
  duration: string
  duration_seconds: number
  published_at: string
  thumbnail_url: string | null
  thumbnail_hq_url: string | null
  tags: string[]
  view_count: number
  like_count: number
  comment_count: number
  category_id: string | null
  auto_suggested_category_id: string | null
  is_featured: boolean
  is_hidden: boolean
  cms_notes: string | null
  created_at: string
  updated_at: string
}

export interface YouTubeCuratedCommentRow {
  id: string
  site_id: string
  video_id: string
  author_handle: string
  author_avatar_url: string | null
  text_pt: string
  text_en: string
  like_count: number
  display_order: number
  target_locale: 'pt' | 'en' | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface YouTubeSyncLogRow {
  id: string
  site_id: string
  channel_id: string | null
  mode: 'schedule' | 'catchall' | 'metrics' | 'manual'
  status: 'started' | 'completed' | 'failed' | 'skipped'
  videos_found: number
  videos_inserted: number
  videos_updated: number
  error_message: string | null
  quota_used: number
  started_at: string
  completed_at: string | null
  created_at: string
}

// ── Frontend view types (serialized from server → client) ──

export interface YouTubeVideoView {
  id: string
  youtubeVideoId: string
  title: string
  titleTranslation: string | null
  description: string | null
  descriptionTranslation: string | null
  duration: string
  durationSeconds: number
  publishedAt: string
  thumbnailUrl: string | null
  thumbnailHqUrl: string | null
  tags: string[]
  viewCount: number
  likeCount: number
  commentCount: number
  locale: 'pt' | 'en'
  channelHandle: string
  categorySlug: string | null
  categoryName: string | null
  categoryColor: string | null
  isFeatured: boolean
}

export interface YouTubeChannelView {
  id: string
  locale: 'pt' | 'en'
  handle: string
  name: string
  description: string | null
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  url: string
}

export interface YouTubeCategoryView {
  slug: string
  namePt: string
  nameEn: string
  color: string
  count: number
}

export interface YouTubeCuratedCommentView {
  id: string
  videoId: string
  videoTitle: string
  videoYoutubeId: string
  authorHandle: string
  authorAvatarUrl: string | null
  textPt: string
  textEn: string
  likeCount: number
  channelLocale: 'pt' | 'en'
  publishedAt: string | null
}

export interface YouTubePageData {
  videos: YouTubeVideoView[]
  channels: YouTubeChannelView[]
  categories: YouTubeCategoryView[]
  comments: YouTubeCuratedCommentView[]
  totalVideoCount: number
  totalDurationSeconds: number
}

export type SyncMode = 'schedule' | 'catchall' | 'metrics' | 'manual'
