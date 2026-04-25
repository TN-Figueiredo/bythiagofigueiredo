import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createAdRoutesPlugin } from '@tn-figueiredo/ad-engine/fastify'
import type { AdKillSwitchId } from '@tn-figueiredo/ad-engine'
import { getServiceClient } from '../lib/supabase.js'
import { SupabaseAdConfigRepository } from '../infrastructure/repositories/supabase-ad-config-repository.js'
import { SupabaseAdEventRepository } from '../infrastructure/repositories/supabase-ad-event-repository.js'

const APP_ID = 'bythiagofigueiredo'

/**
 * Extracts the user ID from the request.
 * Falls back to 'anonymous' for unauthenticated requests.
 */
function getUserId(request: FastifyRequest): string {
  const auth = request.headers.authorization
  if (!auth) return 'anonymous'
  // JWT sub is used as userId — parse from Bearer token payload
  try {
    const token = auth.replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())
    return (payload.sub as string) ?? 'anonymous'
  } catch {
    return 'anonymous'
  }
}

export async function adsPlugin(fastify: FastifyInstance): Promise<void> {
  const supabase = getServiceClient()
  const adConfigRepo = new SupabaseAdConfigRepository(supabase, APP_ID)
  const adEventRepo = new SupabaseAdEventRepository(supabase)

  const getKillSwitches = async (_userId: string): Promise<Record<AdKillSwitchId, boolean>> => {
    const ids: AdKillSwitchId[] = ['kill_ads', 'ads_house_enabled', 'ads_cpa_enabled', 'ads_placeholder_enabled']
    const { data } = await supabase.from('kill_switches').select('id, enabled').in('id', ids)
    const switchMap = Object.fromEntries((data ?? []).map((r) => [r.id, r.enabled as boolean]))
    return {
      kill_ads:                switchMap['kill_ads']                ?? true,
      ads_house_enabled:       switchMap['ads_house_enabled']       ?? true,
      ads_cpa_enabled:         switchMap['ads_cpa_enabled']         ?? false,
      ads_placeholder_enabled: switchMap['ads_placeholder_enabled'] ?? true,
    }
  }

  const getUserSegments = async (_userId: string): Promise<string[]> => {
    return []
  }

  await fastify.register(createAdRoutesPlugin, {
    prefix: '/ads',
    appId: APP_ID,
    adConfigRepo,
    adEventRepo,
    getUserId,
    getKillSwitches,
    getUserSegments,
  })
}
