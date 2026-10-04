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
  }).select('id, slug, name').single())

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
    must(await sb.from('ab_test_variants').insert([{ test_id: done, label: 'A' }, { test_id: done, label: 'B' }]).select('id'))
    must(await sb.from('optimization_cycles').insert({ site_id: siteId, youtube_video_id: v1, ab_test_id: done }).select('id'))
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
    }
  }

  it('o impacto conta o que depende do canal, sem apagar nada', async () => {
    const { ch, v1, v2 } = await fullChannel(siteA, `@impacto${run}`)
    const { data, error } = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })
    expect(error).toBeNull()
    expect(data).toEqual({
      status: 'ok', name: ch.name, slug: ch.slug,
      videos: 2, comments: 3, sync_logs: 2, ab_tests: 2, analyses: 2, tasks: 1, notes: 1, pipeline_links: 1, blockers: [],
    })
    expect((await counts(ch.id as string, [v1, v2])).videos).toBe(2)
  })

  it('canal sem nada dependente: impacto todo zero e a remoção apaga só o canal', async () => {
    const ch = await addChannel(siteA, `@vazio${run}`)
    const { data: impact } = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })
    expect(impact).toMatchObject({ status: 'ok', videos: 0, comments: 0, sync_logs: 0, ab_tests: 0, analyses: 0, tasks: 0, notes: 0, pipeline_links: 0, blockers: [] })
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'removed', videos: 0 })
    expect((await sb.from('youtube_channels').select('id').eq('id', ch.id)).data).toEqual([])
  })

  it('remove o canal com tudo: vídeos, comentários, log, testes encerrados, ciclos, análises, tarefas e notas; o item do pipeline fica sem o vínculo', async () => {
    const { ch, v1, v2, pipeline, done } = await fullChannel(siteA, `@tudo${run}`)
    const { data, error } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'removed', videos: 2, comments: 3, sync_logs: 2, ab_tests: 2, pipeline_links: 1 })
    expect(await counts(ch.id as string, [v1, v2])).toEqual({ channel: 0, videos: 0, comments: 0, logs: 0, tests: 0, cycles: 0, analyses: 0, tasks: 0, notes: 0 })
    expect((await sb.from('ab_test_variants').select('id').eq('test_id', done)).data).toEqual([])
    const { data: item } = await sb.from('content_pipeline').select('id, youtube_video_id, youtube_channel_id').eq('id', pipeline).single()
    expect(item).toEqual({ id: pipeline, youtube_video_id: null, youtube_channel_id: null })
  })

  it.each(['active', 'paused'])('teste A/B %s bloqueia ANTES de apagar qualquer coisa e diz qual é', async (status) => {
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
    expect((data as { ab_tests: number }).ab_tests).toBe(2)
  })

  it('rascunho e teste na fila não bloqueiam: nunca rodaram, e são apagados junto', async () => {
    const ch = await addChannel(siteA, `@rasc${run}`)
    const v1 = await addVideo(siteA, ch.id as string, 'A')
    const v2 = await addVideo(siteA, ch.id as string, 'B')
    await addTest(siteA, v1, 'Rascunho', 'draft')
    await addTest(siteA, v2, 'Na fila', 'queued')
    const { data } = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(data).toMatchObject({ status: 'removed', ab_tests: 2 })
    expect((await counts(ch.id as string, [v1, v2])).tests).toBe(0)
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
