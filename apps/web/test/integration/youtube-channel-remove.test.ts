// @vitest-environment node
/**
 * Remoção de um canal próprio (função public.youtube_channel_remove + youtube_channel_removal_impact).
 * Tudo ou nada: ou o canal some com tudo o que depende dele, ou nenhuma linha é apagada.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('youtube_channel_remove', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteA: string
  let siteB: string
  const run = `${Date.now()}`
  let seq = 0
  const n = () => { seq += 1; return seq }

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteA = (await seedSite(sb)).siteId
    siteB = (await seedSite(sb)).siteId
  })

  afterAll(async () => {
    for (const siteId of [siteA, siteB]) {
      const { data: vids } = await sb.from('youtube_videos').select('id').eq('site_id', siteId)
      const ids = (vids ?? []).map(v => v.id as string)
      await sb.from('yt_notifications').delete().eq('site_id', siteId)
      await sb.from('social_connections').delete().eq('site_id', siteId)
      await sb.from('tracked_links').delete().eq('site_id', siteId)
      await sb.from('optimization_cycles').delete().eq('site_id', siteId)
      if (ids.length) await sb.from('ab_tests').delete().in('youtube_video_id', ids)
      await sb.from('content_pipeline').delete().eq('site_id', siteId)
      await sb.from('youtube_videos').delete().eq('site_id', siteId)
      await sb.from('youtube_sync_log').delete().eq('site_id', siteId)
      await sb.from('youtube_channels').delete().eq('site_id', siteId)
      await sb.from('sites').delete().eq('id', siteId)
    }
  })

  const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error || res.data == null) throw new Error(res.error?.message ?? 'no data')
    return res.data
  }

  const addChannel = async (siteId: string, handle: string) => must(await sb.from('youtube_channels').insert({
    site_id: siteId, channel_id: `UCrm${run}${n()}`, locale: 'pt', handle, name: `Canal ${handle}`, uploads_playlist_id: `UUrm${run}${seq}`,
  }).select('id, slug, name, channel_id').single())

  /** A conexão OAuth do YouTube de um canal (account_id = id do canal no YouTube). */
  const addConnection = async (siteId: string, ytChannelId: string) => must(await sb.from('social_connections').insert({
    site_id: siteId, provider: 'youtube', account_id: ytChannelId, account_name: 'conta', access_token_enc: 'enc-access', refresh_token_enc: 'enc-refresh',
    token_expires_at: new Date(Date.now() + 3600e3).toISOString(),
  }).select('id').single()).id as string

  const addVideo = async (siteId: string, channelId: string, title: string) => must(await sb.from('youtube_videos').insert({
    site_id: siteId, channel_id: channelId, youtube_video_id: `v${run}${n()}`, title, published_at: new Date(Date.now() - 864e5).toISOString(),
  }).select('id').single()).id as string

  const addTest = async (siteId: string, videoId: string, name: string, status: string, startedAt: string | null = null) => must(await sb.from('ab_tests').insert({
    site_id: siteId, youtube_video_id: videoId, name, status, original_thumbnail_url: 'https://example.com/o.jpg', started_at: startedAt,
  }).select('id').single()).id as string

  /** Um canal com um pouco de tudo o que depende dele. */
  const fullChannel = async (siteId: string, handle: string) => {
    const ch = await addChannel(siteId, handle)
    const v1 = await addVideo(siteId, ch.id as string, 'Vídeo um')
    const v2 = await addVideo(siteId, ch.id as string, 'Vídeo dois')
    must(await sb.from('youtube_curated_comments').insert([
      { site_id: siteId, video_id: v1, author_handle: '@a', text_pt: 'oi', text_en: 'hi' },
      { site_id: siteId, video_id: v1, author_handle: '@b', text_pt: 'oi', text_en: 'hi' },
      { site_id: siteId, video_id: v2, author_handle: '@c', text_pt: 'oi', text_en: 'hi' },
    ]).select('id'))
    must(await sb.from('youtube_sync_log').insert([
      { site_id: siteId, channel_id: ch.id, mode: 'manual', status: 'completed' },
      { site_id: siteId, channel_id: ch.id, mode: 'schedule', status: 'completed' },
    ]).select('id'))
    const done = await addTest(siteId, v1, 'Encerrado', 'completed', new Date(Date.now() - 10 * 864e5).toISOString())
    const archived = await addTest(siteId, v2, 'Arquivado', 'archived')
    // o teste encerrado como ele existe em produção: vencedor, um ciclo por variante, polls, link rastreado, playoff
    const variants = must(await sb.from('ab_test_variants').insert([{ test_id: done, label: 'A', is_original: true }, { test_id: done, label: 'B', is_original: false }]).select('id, label'))
    const [va, vb] = [variants.find(v => v.label === 'A')!.id as string, variants.find(v => v.label === 'B')!.id as string]
    must(await sb.from('ab_tests').update({ winner_variant_id: vb, last_applied_variant_id: vb, completed_at: new Date().toISOString(), completed_reason: 'manual_winner' }).eq('id', done).select('id'))
    must(await sb.from('ab_test_cycles').insert([
      { test_id: done, variant_id: va, cycle_number: 1, started_at: new Date(Date.now() - 9 * 864e5).toISOString(), ended_at: new Date(Date.now() - 8 * 864e5).toISOString() },
      { test_id: done, variant_id: vb, cycle_number: 2, started_at: new Date(Date.now() - 8 * 864e5).toISOString(), ended_at: new Date(Date.now() - 7 * 864e5).toISOString() },
    ]).select('id'))
    must(await sb.from('ab_test_polls').insert([{ test_id: done, variant_id: va, views: 10 }, { test_id: done, variant_id: vb, views: 20 }]).select('id'))
    const link = must(await sb.from('tracked_links').insert({ site_id: siteId, code: `rm${run}${n()}`, destination_url: 'https://example.com' }).select('id').single()).id as string
    must(await sb.from('ab_test_tracked_links').insert({ ab_test_id: done, variant_id: vb, link_id: link, template_name: 'desc', short_code: `rm${run}${seq}` }).select('id'))
    // playoff: um teste encerrado filho do primeiro, no mesmo vídeo, com variante copiada da vencedora
    const playoff = await addTest(siteId, v1, 'Playoff', 'completed', new Date(Date.now() - 5 * 864e5).toISOString())
    must(await sb.from('ab_tests').update({ parent_test_id: done, round_number: 2 }).eq('id', playoff).select('id'))
    must(await sb.from('ab_tests').update({ playoff_test_id: playoff }).eq('id', done).select('id'))
    const pv = must(await sb.from('ab_test_variants').insert({ test_id: playoff, label: 'A', source_variant_id: vb }).select('id').single()).id as string
    must(await sb.from('ab_tests').update({ winner_variant_id: pv }).eq('id', playoff).select('id'))
    const cycle = must(await sb.from('optimization_cycles').insert({ site_id: siteId, youtube_video_id: v1, ab_test_id: done }).select('id').single()).id as string
    must(await sb.from('youtube_fatigue_alerts').insert({ site_id: siteId, video_id: v1, z_score: 2.5, resolved_by_test_id: done }).select('id'))
    must(await sb.from('youtube_video_analytics').insert({ site_id: siteId, youtube_video_id: v1, date: new Date(Date.now() - 864e5).toISOString().slice(0, 10) }).select('id'))
    must(await sb.from('video_grade_history').insert({ site_id: siteId, youtube_video_id: v1, grade: 'B', score: 70, week_iso: '2026-W01' }).select('id'))
    // notificações: uma por vídeo, uma por teste, uma por ciclo — e uma do site, sem vínculo com o canal
    must(await sb.from('yt_notifications').insert([
      { site_id: siteId, type: 'grade_drop', priority: 3, title: 't', message: 'm', dedup_key: `v-${run}-${n()}`, youtube_video_id: v1 },
      { site_id: siteId, type: 'ab_test_completed', priority: 3, title: 't', message: 'm', dedup_key: `t-${run}-${n()}`, ab_test_id: done },
      { site_id: siteId, type: 'optimization_available', priority: 3, title: 't', message: 'm', dedup_key: `c-${run}-${n()}`, optimization_cycle_id: cycle },
    ]).select('id'))
    must(await sb.from('youtube_intelligence').insert([
      { site_id: siteId, channel_id: ch.id, type: 'channel' },
      { site_id: siteId, channel_id: ch.id, type: 'video', video_id: v1 },
    ]).select('id'))
    must(await sb.from('youtube_intelligence_tasks').insert({ site_id: siteId, channel_id: ch.id, trigger_type: 'manual', task_type: 'diagnostico' }).select('id'))
    must(await sb.from('youtube_notes').insert({ site_id: siteId, channel_id: ch.id, author_name: 'Dono', text: 'nota' }).select('id'))
    const pipeline = must(await sb.from('content_pipeline').insert({
      site_id: siteId, code: `RM-${run}-${n()}`, format: 'video', stage: 'published', youtube_video_id: v1, youtube_channel_id: ch.id,
    }).select('id').single()).id as string
    return { ch, v1, v2, done, archived, pipeline }
  }

  const counts = async (channelId: string, videoIds: string[]) => {
    const c = async (table: string, col: string, vals: string[]) =>
      (await sb.from(table).select('id', { count: 'exact', head: true }).in(col, vals)).count ?? -1
    return {
      channel: await c('youtube_channels', 'id', [channelId]),
      videos: await c('youtube_videos', 'id', videoIds),
      comments: await c('youtube_curated_comments', 'video_id', videoIds),
      logs: await c('youtube_sync_log', 'channel_id', [channelId]),
      tests: await c('ab_tests', 'youtube_video_id', videoIds),
      cycles: await c('optimization_cycles', 'youtube_video_id', videoIds),
      analyses: await c('youtube_intelligence', 'channel_id', [channelId]),
      tasks: await c('youtube_intelligence_tasks', 'channel_id', [channelId]),
      notes: await c('youtube_notes', 'channel_id', [channelId]),
      analytics: await c('youtube_video_analytics', 'youtube_video_id', videoIds),
      grades: await c('video_grade_history', 'youtube_video_id', videoIds),
      alerts: await c('youtube_fatigue_alerts', 'video_id', videoIds),
      notifications: await c('yt_notifications', 'youtube_video_id', videoIds),
    }
  }

  it('o impacto conta o que depende do canal, sem apagar nada', async () => {
    const { ch, v1, v2 } = await fullChannel(siteA, `@impacto${run}`)
    const { data, error } = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })
    expect(error).toBeNull()
    expect(data).toEqual({
      status: 'ok', name: ch.name, slug: ch.slug,
      videos: 2, comments: 3, sync_logs: 2, ab_tests: 3, ab_drafts: 0, analyses: 2, tasks: 1, notes: 1, notifications: 3, connections: 0, pipeline_links: 1, blockers: [],
    })
    expect((await counts(ch.id as string, [v1, v2])).videos).toBe(2)
  })

  it('canal sem nada dependente: impacto todo zero e a remoção apaga só o canal', async () => {
    const ch = await addChannel(siteA, `@vazio${run}`)
    const { data: impact } = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })
    expect(impact).toMatchObject({ status: 'ok', videos: 0, comments: 0, sync_logs: 0, ab_tests: 0, ab_drafts: 0, analyses: 0, tasks: 0, notes: 0, notifications: 0, connections: 0, pipeline_links: 0, blockers: [] })
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'removed', videos: 0 })
    expect((await sb.from('youtube_channels').select('id').eq('id', ch.id)).data).toEqual([])
  })

  it('remove o canal com tudo — teste encerrado COM vencedor, ciclos, polls, link rastreado e playoff; notificações do canal somem; o item do pipeline e a notificação do site ficam', async () => {
    const { ch, v1, v2, pipeline, done } = await fullChannel(siteA, `@tudo${run}`)
    const siteWide = must(await sb.from('yt_notifications').insert({ site_id: siteA, type: 'trending_viral', priority: 3, title: 't', message: 'm', dedup_key: `s-${run}-${n()}` }).select('id').single()).id as string
    const before = (await sb.from('yt_notifications').select('id', { count: 'exact', head: true }).eq('site_id', siteA)).count ?? 0
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'removed', videos: 2, comments: 3, sync_logs: 2, ab_tests: 3, notifications: 3, pipeline_links: 1 })
    expect(await counts(ch.id as string, [v1, v2])).toEqual({ channel: 0, videos: 0, comments: 0, logs: 0, tests: 0, cycles: 0, analyses: 0, tasks: 0, notes: 0, analytics: 0, grades: 0, alerts: 0, notifications: 0 })
    expect((await sb.from('ab_test_cycles').select('id').eq('test_id', done)).data).toEqual([])
    expect((await sb.from('ab_test_polls').select('id').eq('test_id', done)).data).toEqual([])
    expect((await sb.from('ab_test_tracked_links').select('id').eq('ab_test_id', done)).data).toEqual([])
    const after = (await sb.from('yt_notifications').select('id', { count: 'exact', head: true }).eq('site_id', siteA)).count ?? 0
    expect(before - after).toBe(3)
    expect((await sb.from('yt_notifications').select('id').eq('id', siteWide)).data).toHaveLength(1)
    expect((await sb.from('ab_test_variants').select('id').eq('test_id', done)).data).toEqual([])
    const { data: item } = await sb.from('content_pipeline').select('id, youtube_video_id, youtube_channel_id').eq('id', pipeline).single()
    expect(item).toEqual({ id: pipeline, youtube_video_id: null, youtube_channel_id: null })
  })

  it.each(['active', 'paused', 'queued'])('teste A/B %s bloqueia ANTES de apagar qualquer coisa e diz qual é', async (status) => {
    const { ch, v1, v2 } = await fullChannel(siteA, `@bloq${status}${run}`)
    const v3 = await addVideo(siteA, ch.id as string, 'Quanto custa viajar?')
    const started = new Date(Date.now() - 3 * 864e5).toISOString()
    const testId = await addTest(siteA, v3, 'Thumbnail: mapa vs rosto', status, started)
    const before = await counts(ch.id as string, [v1, v2, v3])
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'blocked', name: ch.name })
    const blockers = (data as { blockers: Array<Record<string, unknown>> }).blockers
    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatchObject({ id: testId, name: 'Thumbnail: mapa vs rosto', status, paused_at: null, video_title: 'Quanto custa viajar?' })
    expect(new Date(blockers[0]!.started_at as string).getTime()).toBe(new Date(started).getTime())
    expect(await counts(ch.id as string, [v1, v2, v3])).toEqual(before)
    // os encerrados não entram na conta dos que bloqueiam
    expect((data as { ab_tests: number }).ab_tests).toBe(3)
  })

  it('rascunho não bloqueia (nunca rodou) e é apagado junto, com contagem PRÓPRIA, fora dos encerrados', async () => {
    const ch = await addChannel(siteA, `@rasc${run}`)
    const v1 = await addVideo(siteA, ch.id as string, 'A')
    const v2 = await addVideo(siteA, ch.id as string, 'B')
    await addTest(siteA, v1, 'Rascunho', 'draft')
    await addTest(siteA, v2, 'Arquivado', 'archived')
    const { data } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(data).toMatchObject({ status: 'removed', ab_tests: 1, ab_drafts: 1 })
    expect((await counts(ch.id as string, [v1, v2])).tests).toBe(0)
  })

  it('a conexão OAuth do canal é desligada na mesma transação (revoked_at + tokens zerados); a de OUTRO canal do mesmo site fica intacta', async () => {
    const ch = await addChannel(siteA, `@oauth${run}`)
    const other = await addChannel(siteA, `@oauth-outro${run}`)
    const mine = await addConnection(siteA, ch.channel_id as string)
    const theirs = await addConnection(siteA, other.channel_id as string)
    // o mesmo canal do YouTube conectado em OUTRO site também não é tocado
    const otherSite = await addConnection(siteB, ch.channel_id as string)
    const impact = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })
    expect(impact.data).toMatchObject({ connections: 1 })
    expect(JSON.stringify(impact.data)).not.toContain('enc-')
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'removed', connections: 1 })
    // nenhum token sai do banco: o retorno só tem status, identificação, contagens e blockers
    expect(Object.keys(data as object).sort()).toEqual(['ab_drafts', 'ab_tests', 'analyses', 'blockers', 'comments', 'connections', 'name', 'notes', 'notifications', 'pipeline_links', 'slug', 'status', 'sync_logs', 'tasks', 'videos'])
    expect(JSON.stringify(data)).not.toMatch(/enc-|token/i)
    const row = async (id: string) => (await sb.from('social_connections').select('revoked_at, access_token_enc, refresh_token_enc, page_token_enc, token_expires_at').eq('id', id).single()).data!
    const gone = await row(mine)
    expect(gone.revoked_at).not.toBeNull()
    expect([gone.access_token_enc, gone.refresh_token_enc, gone.page_token_enc, gone.token_expires_at]).toEqual(['', null, null, null])
    for (const id of [theirs, otherSite]) {
      const kept = await row(id)
      expect([kept.revoked_at, kept.access_token_enc, kept.refresh_token_enc]).toEqual([null, 'enc-access', 'enc-refresh'])
    }
  })

  it('remoção bloqueada ou que falha no meio NÃO desliga a conexão', async () => {
    const ch = await addChannel(siteA, `@oauth-bloq${run}`)
    const conn = await addConnection(siteA, ch.channel_id as string)
    const v = await addVideo(siteA, ch.id as string, 'V')
    await addTest(siteA, v, 'Rodando', 'active', new Date().toISOString())
    const { data } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(data).toMatchObject({ status: 'blocked' })
    expect(JSON.stringify(data)).not.toContain('enc-')
    expect((await sb.from('social_connections').select('revoked_at, refresh_token_enc').eq('id', conn).single()).data).toEqual({ revoked_at: null, refresh_token_enc: 'enc-refresh' })
  })

  it('falha no meio: nada é apagado (nem os comentários, que a action antiga apagava antes de parar)', async () => {
    const { ch, v1, v2 } = await fullChannel(siteA, `@meio${run}`)
    const before = await counts(ch.id as string, [v1, v2])
    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const fn = `tg_test_rm_fail_${run}`
    try {
      // o log de sincronização é apagado DEPOIS de comentários, testes e vídeos: a falha cai no meio da remoção
      await pg.query(`create function public.${fn}() returns trigger language plpgsql as $$
        begin if old.channel_id = '${ch.id}'::uuid then raise exception 'falha forçada no meio'; end if; return old; end $$`)
      await pg.query(`create trigger ${fn} before delete on public.youtube_sync_log for each row execute function public.${fn}()`)
      const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
      expect(data).toBeNull()
      expect(error?.message).toMatch(/falha forçada no meio/)
      expect(await counts(ch.id as string, [v1, v2])).toEqual(before)
    } finally {
      await pg.query(`drop trigger if exists ${fn} on public.youtube_sync_log`)
      await pg.query(`drop function if exists public.${fn}()`)
      await pg.end()
    }
    // sem a falha, a mesma chamada passa
    const { data } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(data).toMatchObject({ status: 'removed' })
  })

  it('canal de outro site: not_found, e nada é tocado', async () => {
    const { ch, v1, v2 } = await fullChannel(siteB, `@outro${run}`)
    const before = await counts(ch.id as string, [v1, v2])
    const impact = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })
    expect(impact.data).toEqual({ status: 'not_found' })
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toEqual({ status: 'not_found' })
    expect(await counts(ch.id as string, [v1, v2])).toEqual(before)
  })

  it('slug de confirmação errado (ou nulo): slug_mismatch, nada apagado', async () => {
    const ch = await addChannel(siteA, `@slug${run}`)
    for (const wrong of ['outro-slug', '', null]) {
      const { data } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: wrong })
      expect(data).toEqual({ status: 'slug_mismatch' })
    }
    expect((await sb.from('youtube_channels').select('id').eq('id', ch.id)).data).toHaveLength(1)
  })

  it('um ciclo de otimização de OUTRO canal que aponta para um teste apagado perde o vínculo, não trava a remoção', async () => {
    const { ch, done } = await fullChannel(siteA, `@ciclo${run}`)
    const other = await addChannel(siteA, `@ciclo-outro${run}`)
    const ov = await addVideo(siteA, other.id as string, 'De outro canal')
    const cycle = must(await sb.from('optimization_cycles').insert({ site_id: siteA, youtube_video_id: ov, ab_test_id: done }).select('id').single()).id as string
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'removed' })
    expect((await sb.from('optimization_cycles').select('id, ab_test_id').eq('id', cycle).single()).data).toEqual({ id: cycle, ab_test_id: null })
  })

  it('anon e authenticated não executam nenhuma das duas funções', async () => {
    const ch = await addChannel(siteA, `@anon${run}`)
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const a = await anon.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(a.error).not.toBeNull()
    const b = await anon.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })
    expect(b.error).not.toBeNull()
    expect((await sb.from('youtube_channels').select('id').eq('id', ch.id)).data).toHaveLength(1)
    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    try {
      const { rows } = await pg.query(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
          has_function_privilege('authenticated', p.oid, 'execute') as auth, has_function_privilege('service_role', p.oid, 'execute') as svc,
          p.prosecdef, p.proconfig
        from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('youtube_channel_remove', 'youtube_channel_removal_impact') order by 1`)
      expect(rows).toHaveLength(2)
      for (const r of rows) {
        expect([r.proname, r.anon, r.auth, r.svc, r.prosecdef]).toEqual([r.proname, false, false, true, true])
        expect(r.proconfig).toEqual(['search_path=""'])
      }
    } finally { await pg.end() }
  })
})
