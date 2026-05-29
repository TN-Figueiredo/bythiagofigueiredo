import type {
  DeliveryStatus,
  ErrorType,
  PostStatus,
  PostType,
  Provider,
  SocialConnection,
  SocialDelivery,
  SocialPost,
  SocialPostContent,
} from '@tn-figueiredo/social'
import type { SafeConnection } from './actions/_shared'

// Pipeline fields exist on the DB row but not yet in the @tn-figueiredo/social
// package type. We extend SocialPost locally so callers can access them without
// casting.
export type SocialPostWithPipeline = SocialPost & {
  source_pipeline_id: string | null
  pipeline_snapshot: Record<string, unknown> | null
  graduated_at: string | null
  origin: string | null
  queue_position: number | null
}

// ---------------------------------------------------------------------------
// SocialPost
// ---------------------------------------------------------------------------

export function toSocialPost(row: Record<string, unknown>): SocialPostWithPipeline {
  const content = (row.content ?? {}) as SocialPostContent
  return {
    id: String(row.id ?? ''),
    site_id: String(row.site_id ?? ''),
    created_by: String(row.created_by ?? ''),
    type: (row.type as PostType) ?? 'text',
    status: (row.status as PostStatus) ?? 'draft',
    scheduled_at: (row.scheduled_at as string) ?? null,
    user_timezone: String(row.user_timezone ?? 'America/Sao_Paulo'),
    published_at: (row.published_at as string) ?? null,
    content,
    template_id: (row.template_id as string) ?? null,
    idempotency_key: String(row.idempotency_key ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    source_pipeline_id: (row.source_pipeline_id as string) ?? null,
    pipeline_snapshot: row.pipeline_snapshot != null ? (row.pipeline_snapshot as Record<string, unknown>) : null,
    graduated_at: (row.graduated_at as string) ?? null,
    origin: (row.origin as string) ?? null,
    queue_position: (row.queue_position as number) ?? null,
  }
}

export function toSocialPosts(rows: unknown[]): SocialPostWithPipeline[] {
  return rows.map((row) => toSocialPost(row as Record<string, unknown>))
}

// ---------------------------------------------------------------------------
// SocialDelivery
// ---------------------------------------------------------------------------

export function toSocialDelivery(row: Record<string, unknown>): SocialDelivery {
  return {
    id: String(row.id ?? ''),
    post_id: String(row.post_id ?? ''),
    connection_id: String(row.connection_id ?? ''),
    provider: row.provider as Provider,
    status: (row.status as DeliveryStatus) ?? 'pending',
    platform_post_id: (row.platform_post_id as string) ?? null,
    platform_url: (row.platform_url as string) ?? null,
    content_override: (row.content_override as Record<string, unknown>) ?? null,
    attempt: Number(row.attempt ?? 0),
    max_attempts: Number(row.max_attempts ?? 3),
    last_error: (row.last_error as string) ?? null,
    error_type: (row.error_type as ErrorType) ?? null,
    published_at: (row.published_at as string) ?? null,
    created_at: String(row.created_at ?? ''),
  }
}

export function toSocialDeliveries(rows: unknown[]): SocialDelivery[] {
  return rows.map((row) => toSocialDelivery(row as Record<string, unknown>))
}

// ---------------------------------------------------------------------------
// SocialConnection / SafeConnection
// ---------------------------------------------------------------------------

export function toSocialConnection(row: Record<string, unknown>): SocialConnection {
  return {
    id: String(row.id ?? ''),
    site_id: String(row.site_id ?? ''),
    provider: row.provider as Provider,
    account_id: String(row.account_id ?? ''),
    account_name: (row.account_name as string) ?? null,
    access_token_enc: String(row.access_token_enc ?? ''),
    refresh_token_enc: (row.refresh_token_enc as string) ?? null,
    page_token_enc: (row.page_token_enc as string) ?? null,
    token_expires_at: (row.token_expires_at as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    connected_at: String(row.connected_at ?? ''),
    revoked_at: (row.revoked_at as string) ?? null,
    updated_at: String(row.updated_at ?? ''),
  }
}

export function toSafeConnection(row: Record<string, unknown>): SafeConnection {
  return {
    id: String(row.id ?? ''),
    site_id: String(row.site_id ?? ''),
    provider: row.provider as Provider,
    account_id: String(row.account_id ?? ''),
    account_name: (row.account_name as string) ?? null,
    token_expires_at: (row.token_expires_at as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    connected_at: String(row.connected_at ?? ''),
    revoked_at: (row.revoked_at as string) ?? null,
    updated_at: String(row.updated_at ?? ''),
  }
}

export function toSafeConnections(rows: unknown[]): SafeConnection[] {
  return rows.map((row) => toSafeConnection(row as Record<string, unknown>))
}
