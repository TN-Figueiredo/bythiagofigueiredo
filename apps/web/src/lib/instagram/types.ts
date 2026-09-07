export interface InstagramAccountRow {
  id: string
  site_id: string
  locale: 'pt' | 'en' | 'all'
  handle: string
  ig_user_id: string | null
  access_token: string | null
  token_expires_at: string | null
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  section_title_pt: string | null
  section_title_en: string | null
  section_subtitle_pt: string | null
  section_subtitle_en: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
  // ── M1 (commit C1): saúde do token ──────────────────────────────────────
  // No schema as 9 são nullable, exceto ig_user_id_source (not null default
  // 'legacy'). No tipo entram OPCIONAIS em C1 para que os literais de
  // InstagramAccountRow já existentes em test/instagram/{sync,cron-route,
  // token-refresh}.test.ts continuem compilando um commit antes de qualquer
  // código que as escreva. C2 escreve a coluna, e o schema a tem
  // `not null default 'legacy'` — por isso o `?` sai aqui.
  token_refreshed_at?: string | null
  token_error?: string | null
  token_error_at?: string | null
  token_error_mode?: 'daily' | 'token_refresh' | null
  token_alert_sent_at?: string | null
  token_alert_attempt_at?: string | null
  token_reprobe_at?: string | null
  ig_professional_id?: string | null
  ig_user_id_source: 'oauth' | 'legacy'
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
  locale: 'pt' | 'en' | 'all'
  handle: string
  syncEnabled: boolean
  displaySlots: number
  layoutType: 'grid' | 'scatter'
  lastSyncedAt: string | null
  tokenExpiresAt: string | null
}

/** As 16 colunas da view public.instagram_accounts_public (20260507220000:41-49).
 *  Nem access_token nem nenhuma das 9 colunas de saúde do token saem daqui. */
export type InstagramAccountPublic = Omit<
  InstagramAccountRow,
  | 'access_token'
  | 'token_refreshed_at'
  | 'token_error'
  | 'token_error_at'
  | 'token_error_mode'
  | 'token_alert_sent_at'
  | 'token_alert_attempt_at'
  | 'token_reprobe_at'
  | 'ig_professional_id'
  | 'ig_user_id_source'
>

/** Espelha instagram_sync_log_mode_check depois de M1 (6 valores). */
export type InstagramSyncMode =
  | 'daily'
  | 'manual'
  | 'token_refresh'
  | 'deauthorize'
  | 'data_deletion'
  | 'rebind'

export interface SyncResult {
  postsFound: number
  postsInserted: number
  postsUpdated: number
  mediaCached: number
  /** true quando o prazo (`opts.deadlineAt`) cortou o cache de imagens antes do fim. */
  partial: boolean
  /** `newItems.length - cachedUrls.size` — imagens novas que não viraram blob neste run. */
  mediaFailed: number
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
