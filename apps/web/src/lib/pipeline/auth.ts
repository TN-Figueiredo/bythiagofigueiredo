import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PipelineAuth {
  siteId: string
  permissions: string[]
  source: 'api_key' | 'session'
  keyHash?: string
}

const rateLimitMap = new Map<string, { count: number; window_start: number }>()
const RATE_LIMIT = 100
const WINDOW_MS = 60_000

function checkRateLimit(keyHash: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(keyHash)

  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.window_start > WINDOW_MS) rateLimitMap.delete(key)
    }
  }

  if (!entry || now - entry.window_start > WINDOW_MS) {
    rateLimitMap.set(keyHash, { count: 1, window_start: now })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export function getRateLimitHeaders(keyHash: string): Record<string, string> {
  const entry = rateLimitMap.get(keyHash)
  if (!entry) return { 'X-RateLimit-Remaining': String(RATE_LIMIT), 'X-RateLimit-Reset': '0' }
  const remaining = Math.max(0, RATE_LIMIT - entry.count)
  const resetMs = entry.window_start + WINDOW_MS - Date.now()
  return { 'X-RateLimit-Remaining': String(remaining), 'X-RateLimit-Reset': String(Math.ceil(Math.max(0, resetMs) / 1000)) }
}

export async function authenticatePipeline(req: NextRequest): Promise<
  { ok: true; auth: PipelineAuth } | { ok: false; status: number; error: string }
> {
  const apiKey = req.headers.get('X-Pipeline-Key')

  if (apiKey) {
    const keyHash = createHash('sha256').update(apiKey).digest('hex')

    if (!checkRateLimit(keyHash)) {
      return { ok: false, status: 429, error: 'Rate limit exceeded. Max 100 requests per minute.' }
    }

    const supabase = getSupabaseServiceClient()
    const { data: keyRow } = await supabase
      .from('pipeline_api_keys')
      .select('id, site_id, permissions')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .single()

    if (!keyRow) {
      return { ok: false, status: 401, error: 'Invalid or revoked API key' }
    }

    await supabase
      .from('pipeline_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id)

    return { ok: true, auth: { siteId: keyRow.site_id, permissions: keyRow.permissions, source: 'api_key', keyHash } }
  }

  // Fall back to session auth
  try {
    const { siteId } = await getSiteContext()
    const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!res.ok) {
      return { ok: false, status: 403, error: 'Forbidden' }
    }
    return { ok: true, auth: { siteId, permissions: ['read', 'write'], source: 'session' } }
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
}

export function buildRateLimitHeaders(auth: PipelineAuth): HeadersInit | undefined {
  if (auth.source !== 'api_key' || !auth.keyHash) return undefined
  return getRateLimitHeaders(auth.keyHash)
}

export function requirePermission(auth: PipelineAuth, required: 'read' | 'write' | 'admin'): boolean {
  if (required === 'read') return auth.permissions.includes('read') || auth.permissions.includes('write') || auth.permissions.includes('admin')
  if (required === 'write') return auth.permissions.includes('write') || auth.permissions.includes('admin')
  return auth.permissions.includes('admin')
}
