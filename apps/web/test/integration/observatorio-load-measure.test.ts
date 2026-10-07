// @vitest-environment node
// apps/web/test/integration/observatorio-load-measure.test.ts — the loader against a real database, counting the
// HTTP requests and the bytes received. READ ONLY: it only runs selects. Runs when OBS_MEASURE_SITE_ID is set.
import { describe, it, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadRows } from '@/lib/youtube/observatorio/load'

/**
 * OBS_MEASURE_NO_PIN=1: the measured database has not received the pinned_at migration yet. The column is dropped from
 * the select list on the wire (the loader itself refuses to read without it), so every video reads as "not pinned".
 */
const NO_PIN = process.env.OBS_MEASURE_NO_PIN === '1'
function withoutPinnedAt(input: Parameters<typeof fetch>[0]): Parameters<typeof fetch>[0] {
  if (typeof input !== 'string' && !(input instanceof URL)) return input
  const url = new URL(String(input)), select = url.searchParams.get('select')
  if (!select) return input
  url.searchParams.set('select', select.split(',').filter(c => c.trim() !== 'pinned_at').join(','))
  return url.toString()
}

function countingClient(): { client: SupabaseClient; stat: { trips: number; bytes: number } } {
  const stat = { trips: 0, bytes: 0 }
  const counting: typeof fetch = async (input, init) => {
    const res = await fetch(NO_PIN ? withoutPinnedAt(input) : input, init)
    stat.trips++
    stat.bytes += (await res.clone().arrayBuffer()).byteLength
    return res
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: counting },
  })
  return { client, stat }
}

const SITE = process.env.OBS_MEASURE_SITE_ID
describe.skipIf(!SITE)('medição no banco configurado (somente leitura)', () => {
  it('sem cache: loadRows', async () => {
    const { client, stat } = countingClient()
    const t0 = Date.now()
    const rows = await loadRows({ siteId: SITE!, now: Date.now(), supabase: client })
    console.info('[medicao-real] sem cache | idas', stat.trips, '| bytes', stat.bytes, '| ms', Date.now() - t0, '| canais', rows.channels.length, '| vídeos', rows.videos.length, '| versões', rows.versions.length, '| diários', rows.daily.length)
    expect(rows.channels.length).toBeGreaterThan(0)
  }, 120_000)
})
