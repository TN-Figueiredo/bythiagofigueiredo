import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q } from '../helpers/db-seed'
import { YouTubeFalso, imagemComDhash, H } from '../helpers/youtube-falso'

// P4a T10 r1 (desvio 11): retomar e iniciar contra o bythiago_int (gatilho do histórico e ab_resume_commit REAIS).
// Só o YouTube (falso, por fetch), o token, o canal e o aviso são dublês.
const { fanOut } = vi.hoisted(() => ({ fanOut: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn(async () => ({ accessToken: 'tok' })) }))
vi.mock('@vercel/blob', () => ({ put: vi.fn(async () => ({ url: 'https://t10.public.blob.vercel-storage.com/novo.jpg' })) }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: vi.fn(async () => 'UCint'),
}))

import { retomarTeste } from '@/lib/youtube/ab-resume'
import { startAbTestInternal } from '@/lib/youtube/ab-start'

const BLOB = (v: string) => `https://t10.public.blob.vercel-storage.com/${v}.png`
const MIN = 60_000
const DIA = 86_400_000
const iso = (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString()
const campoOk = (extra: Record<string, unknown> = {}) => ({ estado: 'ok', destino: 'original', em: iso(-DIA), forcado: false, escreveu: true, erro: null, attempts: 0, ...extra })

type Semente = { testId: string; varA: string; varB: string; siteId: string }

describe.skipIf(skipIfNoLocalDb())('P4a T10 r1: retomar e iniciar no banco real', () => {
  let yt: YouTubeFalso
  const db = clienteServico()

  async function pausado(testType: 'thumbnail' | 'combo', opcoes: { cicloAberto?: { end_reason: string | null } | null; falhas?: number } = {}): Promise<Semente> {
    const t = await semearTesteAb({ status: 'paused', cicloAberto: 0, testType })
    await db.from('ab_test_variants').update({ blob_url: BLOB('A'), thumbnail_dhash: H.A, title_text: 'Título A' }).eq('id', t.varA)
    await db.from('ab_test_variants').update({ blob_url: BLOB('B'), thumbnail_dhash: H.B, title_text: 'Título B' }).eq('id', t.varB)
    // restore_seq e restore_status juntos: o gatilho grava a linha anterior (seq 3) como a reivindicação anterior faria.
    await db.from('ab_tests').update({
      original_title: 'Título A', paused_at: iso(-2 * DIA), restore_seq: 3, restore_status: { thumbnail: campoOk() },
      config: { max_duration_days: 14, confidence_threshold: 0.95, burn_in_days: 2, rotation_pattern: 'abba', consecutive_failures: opcoes.falhas ?? 0 },
    }).eq('id', t.testId)
    if (opcoes.cicloAberto) await db.from('ab_test_cycles').update({ end_reason: opcoes.cicloAberto.end_reason, started_at: iso(-3 * DIA) }).eq('test_id', t.testId)
    else await db.from('ab_test_cycles').update({ ended_at: iso(-2 * DIA), end_reason: 'pausa', started_at: iso(-3 * DIA) }).eq('test_id', t.testId)
    return t
  }
  const retomar = (t: Semente) => retomarTeste(t.testId, t.siteId, { supabase: db, agora: () => new Date(), token: async () => 'tok' })
  const restores = async (t: Semente) => (await db.from('ab_test_restores').select('seq, campo, estado, destino, escreveu, em').eq('test_id', t.testId).order('seq').order('campo')).data ?? []
  const ciclos = async (t: Semente) => (await db.from('ab_test_cycles').select('cycle_number, ended_at, end_reason, variant_id').eq('test_id', t.testId).order('cycle_number')).data ?? []
  const teste = async (t: Semente) => (await db.from('ab_tests').select('status, restore_seq, restore_status, config').eq('id', t.testId).single()).data!

  beforeEach(async () => {
    vi.clearAllMocks()
    fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
    yt = new YouTubeFalso({ thumb: await imagemComDhash(H.A), titulo: 'Título A', blobs: { [BLOB('A')]: await imagemComDhash(H.A), [BLOB('B')]: await imagemComDhash(H.B) } })
    const fetchReal = globalThis.fetch
    vi.stubGlobal('fetch', ((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('127.0.0.1') ? fetchReal(input, init) : yt.fetch(input, init)) as typeof fetch)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('sucesso: restore_status = {} (jsonb), ciclo novo = max + 1, consecutive_failures zerado, ciclo antigo aberto fecha na pausa', async () => {
    const t = await pausado('thumbnail', { cicloAberto: { end_reason: null }, falhas: 2 })
    const r = await retomar(t)
    expect(r).toMatchObject({ ok: true })
    const t1 = await teste(t)
    expect(t1).toMatchObject({ status: 'active', restore_seq: 4, restore_status: {} })
    expect((t1.config as { consecutive_failures: number }).consecutive_failures).toBe(0)
    const cs = await ciclos(t)
    expect(cs.map((c) => c.cycle_number)).toEqual([0, 1])
    expect(cs[0]).toMatchObject({ end_reason: 'pausa' })
    expect(cs.filter((c) => c.ended_at === null)).toEqual([expect.objectContaining({ cycle_number: 1, variant_id: t.varB })])
  })

  it('ab_resume_commit só fecha o ciclo ABERTO: o ciclo já fechado com end_reason mantém o dele, o aberto fecha com "pausa" (o CHECK so_fechado impede end_reason em ciclo aberto)', async () => {
    const t = await pausado('thumbnail', { cicloAberto: { end_reason: null } })
    await db.from('ab_test_cycles').update({ ended_at: iso(-4 * DIA), end_reason: 'rotacao', started_at: iso(-5 * DIA) }).eq('test_id', t.testId)
    await db.from('ab_test_cycles').insert({ test_id: t.testId, variant_id: t.varB, cycle_number: 1, started_at: iso(-3 * DIA) })
    expect((await retomar(t)).ok).toBe(true)
    const cs = await ciclos(t)
    expect(cs.map((c) => [c.cycle_number, c.end_reason])).toEqual([[0, 'rotacao'], [1, 'pausa'], [2, null]])
  })

  it('F-B2: nenhuma escrita (thumbnails.set recusa) -> restore_status igual ao anterior e count(ab_test_restores) igual', async () => {
    const t = await pausado('thumbnail')
    const antes = await restores(t)
    expect(antes).toHaveLength(1) // a linha da reivindicação anterior (seq 3)
    const rsAntes = (await teste(t)).restore_status
    yt.recusar('thumbnails.set', 403, 'forbidden')
    const r = await retomar(t)
    expect(r).toMatchObject({ ok: false })
    expect(await restores(t)).toHaveLength(antes.length)
    const t1 = await teste(t)
    expect(t1.status).toBe('paused')
    expect(t1.restore_status).toEqual(rsAntes)
    expect((await ciclos(t)).filter((c) => c.ended_at === null)).toHaveLength(0)
  })

  it('falha parcial do combo (thumbnail entrou, título 403) -> exatamente UMA linha nova: thumbnail ok, escreveu true, destino = a variante B', async () => {
    const t = await pausado('combo')
    const antes = await restores(t)
    yt.recusar('videos.update', 403, 'forbidden')
    const r = await retomar(t)
    expect(r.ok).toBe(false)
    const depois = await restores(t)
    expect(depois).toHaveLength(antes.length + 1)
    expect(depois[depois.length - 1]).toMatchObject({ campo: 'thumbnail', estado: 'ok', escreveu: true, destino: t.varB })
    expect((await teste(t)).status).toBe('paused')
    expect((await ciclos(t)).filter((c) => c.ended_at === null)).toHaveLength(0)
  })

  it('Y-D4: outro escritor reivindica entre a escrita e o fecho -> ab_resume_commit devolve nulo, ZERO ciclo novo, nada de ciclo aberto', async () => {
    const t = await pausado('thumbnail')
    yt.depoisDeEscrever(async () => { await db.from('ab_tests').update({ restore_seq: 99 }).eq('id', t.testId) })
    const antes = (await ciclos(t)).length
    const r = await retomar(t)
    expect(r.ok).toBe(false)
    expect(await ciclos(t)).toHaveLength(antes)
    expect((await ciclos(t)).filter((c) => c.ended_at === null)).toHaveLength(0)
    expect((await teste(t)).status).toBe('paused')
    expect(fanOut).toHaveBeenCalledTimes(1) // o aviso do cruzamento
  })

  it('F-D2: iniciar com teste antigo do mesmo vídeo em_andamento há 16 min -> DUAS linhas, seq crescente, falhou antes de desistiu; o novo teste fica active com o ciclo 0', async () => {
    const t2 = await semearTesteAb({ status: 'draft', cicloAberto: null })
    await db.from('ab_test_variants').update({ blob_url: BLOB('A'), thumbnail_dhash: H.A }).eq('id', t2.varA)
    await db.from('ab_test_variants').update({ blob_url: BLOB('B'), thumbnail_dhash: H.B }).eq('id', t2.varB)
    await db.from('ab_tests').update({ original_title: 'Título A' }).eq('id', t2.testId)
    const { youtube_video_id: video } = (await q<{ youtube_video_id: string }>('select youtube_video_id from ab_tests where id = $1', [t2.testId]))[0]!
    const { data: t1 } = await db.from('ab_tests').insert({
      site_id: t2.siteId, youtube_video_id: video, name: 'Antigo', status: 'completed', test_type: 'thumbnail',
      config: { rotation_pattern: 'abba' }, original_thumbnail_url: BLOB('A'), restore_seq: 3,
      restore_status: { thumbnail: { estado: 'em_andamento', destino: 'original', em: iso(-16 * MIN), forcado: false, escreveu: null, erro: null, attempts: 0 } },
    }).select('id').single()
    const r = await startAbTestInternal(t2.testId, t2.siteId, { supabase: db, agora: () => new Date() })
    expect(r).toEqual({ ok: true })
    const linhas = (await db.from('ab_test_restores').select('seq, campo, estado, escreveu').eq('test_id', t1!.id).order('seq')).data!
    expect(linhas.map((l) => [l.seq, l.estado, l.escreveu])).toEqual([[4, 'falhou', null], [5, 'desistiu', false]])
    expect(await teste({ ...t2, testId: t1!.id })).toMatchObject({ restore_seq: 5 })
    expect(await teste(t2)).toMatchObject({ status: 'active', restore_seq: 1, restore_status: {} })
    expect((await ciclos(t2)).filter((c) => c.ended_at === null)).toEqual([expect.objectContaining({ cycle_number: 0, variant_id: t2.varA })])
  })
})
