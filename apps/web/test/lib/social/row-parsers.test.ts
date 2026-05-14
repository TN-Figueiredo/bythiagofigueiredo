import { describe, it, expect } from 'vitest'
import {
  toSocialPost,
  toSocialPosts,
  toSocialDelivery,
  toSocialDeliveries,
  toSocialConnection,
  toSafeConnection,
  toSafeConnections,
} from '@/lib/social/row-parsers'

const VALID_POST_ROW = {
  id: 'post-1',
  site_id: 'site-1',
  created_by: 'user-1',
  type: 'link',
  status: 'scheduled',
  scheduled_at: '2026-06-01T10:00:00Z',
  user_timezone: 'Europe/Lisbon',
  published_at: null,
  content: { title: 'Hello', body: 'World' },
  template_id: 'tpl-1',
  idempotency_key: 'idem-1',
  created_at: '2026-05-14T00:00:00Z',
  updated_at: '2026-05-14T01:00:00Z',
}

const VALID_DELIVERY_ROW = {
  id: 'del-1',
  post_id: 'post-1',
  connection_id: 'conn-1',
  provider: 'bluesky',
  status: 'pending',
  platform_post_id: 'plat-1',
  platform_url: 'https://bsky.app/post/1',
  content_override: { body: 'override' },
  attempt: 2,
  max_attempts: 5,
  last_error: 'timeout',
  error_type: 'transient',
  published_at: '2026-05-14T12:00:00Z',
  created_at: '2026-05-14T00:00:00Z',
}

const VALID_CONNECTION_ROW = {
  id: 'conn-1',
  site_id: 'site-1',
  provider: 'youtube',
  account_id: 'acc-1',
  account_name: 'My Channel',
  access_token_enc: 'enc-token-123',
  refresh_token_enc: 'enc-refresh-456',
  page_token_enc: 'enc-page-789',
  token_expires_at: '2026-12-31T23:59:59Z',
  scopes: ['upload', 'publish'],
  metadata: { channel_id: 'UC123' },
  connected_at: '2026-01-01T00:00:00Z',
  revoked_at: null,
  updated_at: '2026-05-14T00:00:00Z',
}

describe('toSocialPost', () => {
  it('maps a valid row to correct fields', () => {
    const post = toSocialPost(VALID_POST_ROW)

    expect(post.id).toBe('post-1')
    expect(post.site_id).toBe('site-1')
    expect(post.created_by).toBe('user-1')
    expect(post.type).toBe('link')
    expect(post.status).toBe('scheduled')
    expect(post.scheduled_at).toBe('2026-06-01T10:00:00Z')
    expect(post.user_timezone).toBe('Europe/Lisbon')
    expect(post.published_at).toBeNull()
    expect(post.content).toEqual({ title: 'Hello', body: 'World' })
    expect(post.template_id).toBe('tpl-1')
    expect(post.idempotency_key).toBe('idem-1')
    expect(post.created_at).toBe('2026-05-14T00:00:00Z')
    expect(post.updated_at).toBe('2026-05-14T01:00:00Z')
  })

  it('applies defaults for missing fields', () => {
    const post = toSocialPost({ id: 'post-2' })

    expect(post.id).toBe('post-2')
    expect(post.site_id).toBe('')
    expect(post.created_by).toBe('')
    expect(post.type).toBe('text')
    expect(post.status).toBe('draft')
    expect(post.scheduled_at).toBeNull()
    expect(post.user_timezone).toBe('America/Sao_Paulo')
    expect(post.published_at).toBeNull()
    expect(post.content).toEqual({})
    expect(post.template_id).toBeNull()
    expect(post.idempotency_key).toBe('')
    expect(post.created_at).toBe('')
    expect(post.updated_at).toBe('')
  })

  it('handles empty row', () => {
    const post = toSocialPost({})

    expect(post.id).toBe('')
    expect(post.type).toBe('text')
    expect(post.status).toBe('draft')
  })
})

describe('toSocialPosts', () => {
  it('maps an array of rows', () => {
    const posts = toSocialPosts([VALID_POST_ROW, { id: 'post-3' }])

    expect(posts).toHaveLength(2)
    expect(posts[0].id).toBe('post-1')
    expect(posts[1].id).toBe('post-3')
  })

  it('returns empty array for empty input', () => {
    expect(toSocialPosts([])).toEqual([])
  })
})

describe('toSocialDelivery', () => {
  it('maps a valid row to correct fields', () => {
    const d = toSocialDelivery(VALID_DELIVERY_ROW)

    expect(d.id).toBe('del-1')
    expect(d.post_id).toBe('post-1')
    expect(d.connection_id).toBe('conn-1')
    expect(d.provider).toBe('bluesky')
    expect(d.status).toBe('pending')
    expect(d.platform_post_id).toBe('plat-1')
    expect(d.platform_url).toBe('https://bsky.app/post/1')
    expect(d.content_override).toEqual({ body: 'override' })
    expect(d.attempt).toBe(2)
    expect(d.max_attempts).toBe(5)
    expect(d.last_error).toBe('timeout')
    expect(d.error_type).toBe('transient')
    expect(d.published_at).toBe('2026-05-14T12:00:00Z')
    expect(d.created_at).toBe('2026-05-14T00:00:00Z')
  })

  it('applies defaults for missing optional fields', () => {
    const d = toSocialDelivery({ id: 'del-2', provider: 'facebook' })

    expect(d.id).toBe('del-2')
    expect(d.post_id).toBe('')
    expect(d.connection_id).toBe('')
    expect(d.provider).toBe('facebook')
    expect(d.status).toBe('pending')
    expect(d.platform_post_id).toBeNull()
    expect(d.platform_url).toBeNull()
    expect(d.content_override).toBeNull()
    expect(d.attempt).toBe(0)
    expect(d.max_attempts).toBe(3)
    expect(d.last_error).toBeNull()
    expect(d.error_type).toBeNull()
    expect(d.published_at).toBeNull()
    expect(d.created_at).toBe('')
  })
})

describe('toSocialDeliveries', () => {
  it('maps an array of rows', () => {
    const deliveries = toSocialDeliveries([
      VALID_DELIVERY_ROW,
      { id: 'del-3', provider: 'instagram' },
    ])

    expect(deliveries).toHaveLength(2)
    expect(deliveries[0].id).toBe('del-1')
    expect(deliveries[1].id).toBe('del-3')
    expect(deliveries[1].provider).toBe('instagram')
  })

  it('returns empty array for empty input', () => {
    expect(toSocialDeliveries([])).toEqual([])
  })
})

describe('toSocialConnection', () => {
  it('maps a valid row to correct fields', () => {
    const c = toSocialConnection(VALID_CONNECTION_ROW)

    expect(c.id).toBe('conn-1')
    expect(c.site_id).toBe('site-1')
    expect(c.provider).toBe('youtube')
    expect(c.account_id).toBe('acc-1')
    expect(c.account_name).toBe('My Channel')
    expect(c.access_token_enc).toBe('enc-token-123')
    expect(c.refresh_token_enc).toBe('enc-refresh-456')
    expect(c.page_token_enc).toBe('enc-page-789')
    expect(c.token_expires_at).toBe('2026-12-31T23:59:59Z')
    expect(c.scopes).toEqual(['upload', 'publish'])
    expect(c.metadata).toEqual({ channel_id: 'UC123' })
    expect(c.connected_at).toBe('2026-01-01T00:00:00Z')
    expect(c.revoked_at).toBeNull()
    expect(c.updated_at).toBe('2026-05-14T00:00:00Z')
  })

  it('applies defaults for missing fields', () => {
    const c = toSocialConnection({ id: 'conn-2', provider: 'bluesky' })

    expect(c.id).toBe('conn-2')
    expect(c.site_id).toBe('')
    expect(c.account_id).toBe('')
    expect(c.account_name).toBeNull()
    expect(c.access_token_enc).toBe('')
    expect(c.refresh_token_enc).toBeNull()
    expect(c.page_token_enc).toBeNull()
    expect(c.token_expires_at).toBeNull()
    expect(c.scopes).toEqual([])
    expect(c.metadata).toEqual({})
    expect(c.connected_at).toBe('')
    expect(c.revoked_at).toBeNull()
    expect(c.updated_at).toBe('')
  })
})

describe('toSafeConnection', () => {
  it('strips token fields from connection row', () => {
    const safe = toSafeConnection(VALID_CONNECTION_ROW)

    expect(safe.id).toBe('conn-1')
    expect(safe.site_id).toBe('site-1')
    expect(safe.provider).toBe('youtube')
    expect(safe.account_id).toBe('acc-1')
    expect(safe.account_name).toBe('My Channel')
    expect(safe.token_expires_at).toBe('2026-12-31T23:59:59Z')
    expect(safe.scopes).toEqual(['upload', 'publish'])
    expect(safe.metadata).toEqual({ channel_id: 'UC123' })
    expect(safe.connected_at).toBe('2026-01-01T00:00:00Z')
    expect(safe.revoked_at).toBeNull()
    expect(safe.updated_at).toBe('2026-05-14T00:00:00Z')
    expect('access_token_enc' in safe).toBe(false)
    expect('refresh_token_enc' in safe).toBe(false)
    expect('page_token_enc' in safe).toBe(false)
  })

  it('applies defaults for missing non-token fields', () => {
    const safe = toSafeConnection({ id: 'conn-3', provider: 'facebook' })

    expect(safe.id).toBe('conn-3')
    expect(safe.provider).toBe('facebook')
    expect(safe.account_name).toBeNull()
    expect(safe.scopes).toEqual([])
    expect(safe.metadata).toEqual({})
    expect('access_token_enc' in safe).toBe(false)
    expect('refresh_token_enc' in safe).toBe(false)
    expect('page_token_enc' in safe).toBe(false)
  })
})

describe('toSafeConnections', () => {
  it('maps an array of rows stripping tokens', () => {
    const safes = toSafeConnections([
      VALID_CONNECTION_ROW,
      { id: 'conn-4', provider: 'instagram', access_token_enc: 'secret' },
    ])

    expect(safes).toHaveLength(2)
    expect(safes[0].id).toBe('conn-1')
    expect(safes[1].id).toBe('conn-4')
    expect('access_token_enc' in safes[0]).toBe(false)
    expect('access_token_enc' in safes[1]).toBe(false)
  })

  it('returns empty array for empty input', () => {
    expect(toSafeConnections([])).toEqual([])
  })
})
