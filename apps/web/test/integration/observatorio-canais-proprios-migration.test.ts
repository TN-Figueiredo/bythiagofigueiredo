import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('migration observatorio_canais_proprios_nicho', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let channelRowId: string | null = null
  const channelId = `UCnichoprop${Date.now()}`

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
  })

  afterAll(async () => {
    if (channelRowId) await sb.from('youtube_channels').delete().eq('id', channelRowId)
    await sb.from('youtube_channels').delete().eq('site_id', siteId)
    await sb.from('sites').delete().eq('id', siteId)
  })

  const base = () => ({
    site_id: siteId,
    channel_id: channelId,
    locale: 'pt',
    handle: '@nichoprop',
    name: 'Nicho Próprio',
    uploads_playlist_id: 'UUnichoprop',
  })

  it('youtube_channels has a niche column', async () => {
    const { error } = await sb.from('youtube_channels').select('niche').limit(1)
    expect(error).toBeNull()
  })

  it('niche rejects unknown values', async () => {
    const { error } = await sb.from('youtube_channels').insert({ ...base(), niche: 'culinaria' })
    expect(error?.message).toMatch(/foreign key/i)
  })

  it('a channel inserted with niche omitted is null (no backfill after the migration)', async () => {
    const { data, error } = await sb.from('youtube_channels').insert(base()).select('id, niche').single()
    expect(error).toBeNull()
    expect(data!.niche).toBeNull()
    channelRowId = data!.id
  })

  it('accepts ia and null on update', async () => {
    expect(channelRowId).not.toBeNull()
    const a = await sb.from('youtube_channels').update({ niche: 'ia' }).eq('id', channelRowId!)
    expect(a.error).toBeNull()
    const b = await sb.from('youtube_channels').update({ niche: null }).eq('id', channelRowId!)
    expect(b.error).toBeNull()
  })

  it('accepts niche null on insert', async () => {
    const { data, error } = await sb.from('youtube_channels')
      .insert({ ...base(), channel_id: `${channelId}b`, locale: 'en', niche: null }).select('id, niche').single()
    expect(error).toBeNull()
    expect(data!.niche).toBeNull()
  })
})

describe('migration observatorio_canais_proprios_nicho (arquivo)', () => {
  it('o backfill viagem está dentro do bloco que cria a coluna', () => {
    const dir = join(__dirname, '../../../../supabase/migrations')
    const file = readdirSync(dir).find((n) => n.endsWith('_observatorio_canais_proprios_nicho.sql'))
    expect(file).toBeDefined()
    const sql = readFileSync(join(dir, file!), 'utf8')
    const block = sql.slice(sql.indexOf('do $$'), sql.indexOf('end $$;'))
    expect(block).toMatch(/if not exists[\s\S]*add column niche text;[\s\S]*update youtube_channels set niche = 'viagem';[\s\S]*end if;/)
    expect(sql.match(/update youtube_channels/g)).toHaveLength(1)
    expect(sql.indexOf('drop constraint if exists youtube_channels_niche_check'))
      .toBeLessThan(sql.indexOf('add constraint youtube_channels_niche_check'))
  })
})
