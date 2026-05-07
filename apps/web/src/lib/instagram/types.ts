export interface InstagramAccountRow {
  id: string
  site_id: string
  locale: 'pt' | 'en'
  handle: string
  ig_user_id: string | null
  access_token: string | null
  token_expires_at: string | null
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface InstagramPostRow {
  id: string
  account_id: string
  ig_media_id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string | null
  thumbnail_url: string | null
  cached_image_url: string | null
  caption: string | null
  permalink: string
  like_count: number
  comments_count: number
  ig_timestamp: string
  created_at: string
  updated_at: string
}

export interface InstagramFeedSlotRow {
  id: string
  account_id: string
  position: number
  post_id: string | null
  created_at: string
  updated_at: string
}

export interface InstagramSyncLogRow {
  id: string
  site_id: string
  account_id: string | null
  mode: InstagramSyncMode
  status: 'started' | 'completed' | 'failed'
  posts_found: number
  posts_inserted: number
  posts_updated: number
  media_cached: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface InstagramPostView {
  id: string
  igMediaId: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  cachedImageUrl: string | null
  caption: string | null
  permalink: string
  likeCount: number
  commentsCount: number
  igTimestamp: string
}

export interface ResolvedSlot {
  position: number
  post: InstagramPostView
  pinned: boolean
}

export interface InstagramAccountView {
  id: string
  locale: 'pt' | 'en'
  handle: string
  syncEnabled: boolean
  displaySlots: number
  layoutType: 'grid' | 'scatter'
  lastSyncedAt: string | null
  tokenExpiresAt: string | null
}

export interface InstagramAccountPublic {
  id: string
  site_id: string
  locale: 'pt' | 'en'
  handle: string
  ig_user_id: string | null
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  last_synced_at: string | null
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

export type InstagramSyncMode = 'daily' | 'manual' | 'token_refresh'

export interface SyncResult {
  postsFound: number
  postsInserted: number
  postsUpdated: number
  mediaCached: number
}

export function toPostView(row: InstagramPostRow): InstagramPostView {
  return {
    id: row.id,
    igMediaId: row.ig_media_id,
    mediaType: row.media_type,
    cachedImageUrl: row.cached_image_url,
    caption: row.caption,
    permalink: row.permalink,
    likeCount: row.like_count,
    commentsCount: row.comments_count,
    igTimestamp: row.ig_timestamp,
  }
}

export function toAccountView(row: InstagramAccountRow): InstagramAccountView {
  return {
    id: row.id,
    locale: row.locale,
    handle: row.handle,
    syncEnabled: row.sync_enabled,
    displaySlots: row.display_slots,
    layoutType: row.layout_type,
    lastSyncedAt: row.last_synced_at,
    tokenExpiresAt: row.token_expires_at,
  }
}
