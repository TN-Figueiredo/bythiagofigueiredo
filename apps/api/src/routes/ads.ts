import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createAdRoutesPlugin } from '@tn-figueiredo/ad-engine/fastify'
import type { AdKillSwitchId } from '@tn-figueiredo/ad-engine'
import { getServiceClient } from '../lib/supabase.js'
import { SupabaseAdConfigRepository } from '../infrastructure/repositories/supabase-ad-config-repository.js'
import { SupabaseAdEventRepository } from '../infrastructure/repositories/supabase-ad-event-repository.js'

const APP_ID = 'bythiagofigueiredo'

const supabase = getServiceClient()
const adConfigRepo = new SupabaseAdConfigRepository(supabase, APP_ID)
const adEventRepo = new SupabaseAdEventRepository(supabase)

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

/**
 * Returns kill switch states for ad delivery.
 * Starter: all switches hardcoded to enabled.
 * TODO(future): fetch from kill_switches table for live control.
 */
async function getKillSwitches(
  _userId: string,
): Promise<Record<AdKillSwitchId, boolean>> {
  return {
    kill_ads: true,
    ads_house_enabled: true,
    ads_cpa_enabled: true,
    ads_placeholder_enabled: true,
  }
}

/**
 * Returns audience segments for the requesting user.
 * Starter: returns empty array — extend with reading-habit segmentation.
 * TODO(future): query user_segments table or derive from reading habits.
 */
async function getUserSegments(_userId: string): Promise<string[]> {
  return []
}

export async function adsPlugin(fastify: FastifyInstance): Promise<void> {
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
