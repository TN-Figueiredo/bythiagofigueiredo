// @vitest-environment node
/**
 * A5 · E18 (Tarefa 10): o passo `versoes` REAL (`passoVersoes`) e o leitor (`lerVersoes`) contra Postgres de verdade, com a MG12
 * aplicada. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/observatorio-a5-e18-passo.test.ts
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site, o SEU canal e os SEUS vídeos (ids sintéticos), e só olha para
 * eles; o arquivo semeia e limpa. Datas sempre relativas a ontem (Pacífico). Nenhum nome de canal ou título reais.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const guarda = vi.hoisted(() => ({ edita: true }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: async () => (guarda.edita ? { ok: true, user: { id: 'u1' } } : { ok: false }),
}))

import { addDays, ontemPt } from '@/lib/youtube/coleta/day-pt'
import { passoVersoes, type VersoesResumo } from '@/lib/youtube/coleta/versoes-step'
import type { ColetaChannel } from '@/lib/youtube/coleta/types'
import { provarLeituraPrivada } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerVersoes } from '@/lib/youtube/observatorio/proprio-versoes/ler'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 90_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const ONTEM = ontemPt(new Date())
const HOJE = addDays(ONTEM, 1)
const dia = (n: number): string => addDays(ONTEM, -n)
const cap = (d: string): string => `${addDays(d, 1)}T12:00:00.000Z`
const H0 = '0000000000000000'
const H1 = 'ffffffffffffffff'
const DESC_A = 'a'.repeat(64)
const DESC_B = 'b'.repeat(64)

type Linha = Record<string, unknown>
interface Cen { site: string; canal: string; uc: string; nome: string }
interface Vid { id: string; yt: string }
interface OpcDia { priv?: string | null; titulo?: string; desc?: string; descTexto?: string; dhash?: string; sha?: string; blob?: string }

describe.skipIf(skipIfNoLocalDb())('A5 E18 (Tarefa 10): passo de versões e leitor contra o banco (bythiago_int)', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        await pg.query('delete from public.ab_tests where site_id = any($1::uuid[])', [sites])
        for (const t of ['yt_own_video_versions', 'yt_own_versions_state', 'yt_own_video_meta_daily', 'yt_own_collection_attempts', 'youtube_videos', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
        await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      }
    } finally {
      await pg.end()
    }
  })
  beforeEach(() => { guarda.edita = true })

  // ───────────────────────── semeadura e leitura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  async function cenario(): Promise<Cen> {
    const site = (await seedSite(sb)).siteId
    sites.push(site)
    const x = randomUUID().replace(/-/g, '')
    const uc = 'UC' + x.slice(0, 22), nome = 'Canal ' + x.slice(0, 6)
    const r = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1, $2, 'pt', $3, $4, $5, $6, true) returning id`, [site, uc, '@t' + x.slice(0, 8), nome, 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])
    return { site, canal: String(r[0]!.id), uc, nome }
  }
  const canalDe = (c: Cen): ColetaChannel => ({ id: c.canal, channel_id: c.uc, site_id: c.site, name: c.nome, sync_enabled: true, collection_status: 'ok', video_count: null })
  async function video(c: Cen): Promise<Vid> {
    const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'Teste', $4) returning id`, [c.site, c.canal, yt, `${dia(100)}T12:00:00Z`])
    return { id: String(r[0]!.id), yt }
  }
  async function linha(c: Cen, v: Vid, d: string, o: OpcDia = {}): Promise<void> {
    const t = o.titulo ?? 'Titulo sintetico A'
    await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, title_at_capture,
        description_sha256, description_text, thumbnail_dhash, thumbnail_sha256_at_capture, thumbnail_blob_url, privacy_status, captured_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [v.yt, d, c.site, v.id, c.canal, t, o.desc ?? DESC_A, o.descTexto ?? 'Texto sintetico A', o.dhash ?? H0, o.sha ?? 'sha-A',
      o.blob ?? 'https://blob.test/a.jpg', o.priv === undefined ? 'public' : o.priv, cap(d)])
  }
  async function passo(c: Cen, ontem: string = ONTEM): Promise<{ r: VersoesResumo; falhas: string[] }> {
    const falhas: string[] = []
    const r = await passoVersoes({ supabase: sb, channels: [canalDe(c)], deadline: Date.now() + 60_000, falhas, tentativas: [], ontem })
    return { r, falhas }
  }
  const versoes = (c: Cen, extra = ''): Promise<Linha[]> =>
    q(`select * from public.yt_own_video_versions where site_id = $1 and channel_id = $2 ${extra} order by youtube_video_id, field, first_seen_at, id`, [c.site, c.canal])
  const derivadoAte = async (c: Cen): Promise<string | null> => {
    const r = await q('select derived_through::text as d from public.yt_own_versions_state where site_id = $1 and channel_id = $2', [c.site, c.canal])
    return (r[0]?.d as string | undefined) ?? null
  }
  /** Vídeo(s) com a linha de base em dia(2) e o passo já rodado até lá: o estado de partida de quase todos os casos de troca. */
  async function comBase(c: Cen, n = 1): Promise<Vid[]> {
    const vs: Vid[] = []
    for (let i = 0; i < n; i++) { const v = await video(c); vs.push(v); await linha(c, v, dia(2)) }
    const { falhas } = await passo(c, dia(2))
    expect(falhas).toEqual([])
    return vs
  }
  /** Cria o teste do A/B Lab (vídeo, uma variante) e devolve os ids. */
  async function teste(c: Cen, v: Vid, o: { tipo: 'title' | 'thumbnail' | 'combo'; status?: string; pausadoEm?: string; concluidoEm?: string; motivo?: string; vencedorAplicadoEm?: string; tituloOriginal?: string; vencedor?: boolean }): Promise<{ id: string; variante: string }> {
    const t = await q(`insert into public.ab_tests (site_id, youtube_video_id, name, status, original_thumbnail_url, test_type, paused_at, completed_at, completed_reason, winner_applied_at, original_title)
      values ($1,$2,'Teste sintetico',$3,'https://blob.test/orig.jpg',$4,$5,$6,$7,$8,$9) returning id`,
    [c.site, v.id, o.status ?? 'completed', o.tipo, o.pausadoEm ?? null, o.concluidoEm ?? null, o.motivo ?? null, o.vencedorAplicadoEm ?? null, o.tituloOriginal ?? null])
    const id = String(t[0]!.id)
    const va = await q(`insert into public.ab_test_variants (test_id, label) values ($1,'A') returning id`, [id])
    const variante = String(va[0]!.id)
    if (o.vencedor) await pg.query('update public.ab_tests set winner_variant_id = $1 where id = $2', [variante, id])
    return { id, variante }
  }
  async function ciclo(t: { id: string; variante: string }, iniciadoEm: string, meta: Record<string, unknown>): Promise<void> {
    await pg.query(`insert into public.ab_test_cycles (test_id, variant_id, cycle_number, started_at, applied_metadata) values ($1,$2,1,$3,$4)`, [t.id, t.variante, iniciadoEm, JSON.stringify(meta)])
  }

  // ───────────────────────── os treze casos ─────────────────────────
  it('1. item 188: 35 vídeos e 5 dias (o primeiro sem captura): 105 linhas de base, zero trocas, estado em ontem', async () => {
    const c = await cenario()
    for (let i = 0; i < 35; i++) {
      const v = await video(c)
      for (let n = 4; n >= 0; n--) await linha(c, v, dia(n), n === 4 ? { priv: null } : {})
    }
    const { r, falhas } = await passo(c)
    expect(falhas.filter(f => !f.includes('guardado'))).toEqual([])
    expect(r.dias_derivados).toBe(5)
    expect(await derivadoAte(c)).toBe(ONTEM)
    const todas = await versoes(c)
    expect(todas).toHaveLength(105)
    expect(todas.every(v => v.origin === 'linha_de_base')).toBe(true)
    expect(todas.filter(v => v.is_current)).toHaveLength(105)
  })

  it('2. item 186: o passo de novo não altera nenhuma linha (md5 do conteúdo)', async () => {
    const c = await cenario()
    const vs = await comBase(c, 3)
    for (const v of vs) await linha(c, v, dia(1))
    await passo(c, dia(1))
    const md5 = async (): Promise<string> => String((await q(
      `select md5(coalesce(string_agg(v::text, '|' order by v.id), '')) as h from public.yt_own_video_versions v where v.site_id = $1`, [c.site]))[0]!.h)
    const antes = await md5()
    const { r } = await passo(c, dia(1))
    expect(r.dias_derivados).toBe(0)
    expect(await md5()).toBe(antes)
  })

  it('3. item 187: dia 1 só confirma, dia 2 troca; a janela da troca nasce da captura do dia 1', async () => {
    const c = await cenario()
    const [v] = await comBase(c, 1) as [Vid]
    await linha(c, v, dia(1))
    await linha(c, v, dia(0), { titulo: 'Titulo sintetico B' })
    const { r, falhas } = await passo(c)
    expect(falhas).toEqual([])
    expect(r.dias_derivados).toBe(2)
    const t = (await versoes(c, "and field = 'title'"))
    expect(t).toHaveLength(2)
    const nova = t.find(x => x.is_current)!
    expect(nova).toMatchObject({ origin: 'fora_do_sistema', window_precision: '1d', value_text: 'Titulo sintetico B' })
    expect(new Date(nova.window_start as string).toISOString()).toBe(cap(dia(1)))
    expect(t.find(x => !x.is_current)!.last_day_pt).toBeDefined()
  })

  it('4. item 189: sem as linhas do último dia, a nota vermelha sai e derived_through não anda', async () => {
    const c = await cenario()
    const [v] = await comBase(c, 1) as [Vid]
    await linha(c, v, dia(1))
    await passo(c, dia(1))
    const { falhas, r } = await passo(c) // ontem não tem linha
    expect(falhas).toContain(`versões: ${c.nome} sem nenhuma linha diária em ${ONTEM}`)
    expect(await derivadoAte(c)).toBe(dia(1))
    expect(r.atraso_dias[c.canal]).toBe(1)
  })

  it('5. item 185: uma abertura que a restrição recusa não grava nada do dia', async () => {
    const c = await cenario()
    const v = await video(c)
    await linha(c, v, dia(0))
    const supabase = new Proxy(sb, {
      get(alvo, prop, rec) {
        if (prop !== 'rpc') return Reflect.get(alvo, prop, rec)
        return (nome: string, args: { p_open?: Array<Record<string, unknown>> }) =>
          sb.rpc(nome, nome === 'yt_own_versions_apply_day' && args.p_open ? { ...args, p_open: args.p_open.map((o, i) => (i === 0 ? { ...o, origin: 'valor_que_a_restricao_recusa' } : o)) } : args)
      },
    }) as SupabaseClient
    const falhas: string[] = []
    await passoVersoes({ supabase, channels: [canalDe(c)], deadline: Date.now() + 60_000, falhas, tentativas: [], ontem: ONTEM })
    expect(falhas.some(f => f.includes(`não gravou o dia ${ONTEM}`))).toBe(true)
    expect(await versoes(c)).toHaveLength(0)
    expect(await derivadoAte(c)).toBeNull()
  })

  it('6. troca de título com ciclo do A/B Lab semeado na janela: ab_lab, rotacao, min', async () => {
    const c = await cenario()
    const [v] = await comBase(c, 1) as [Vid]
    await linha(c, v, dia(1), { titulo: 'Titulo sintetico B' })
    const t = await teste(c, v, { tipo: 'title', status: 'active' })
    await ciclo(t, `${dia(1)}T20:00:00.000Z`, { title_set: 'Titulo sintetico B' })
    const { falhas } = await passo(c, dia(1))
    expect(falhas).toEqual([])
    const nova = (await versoes(c, "and field = 'title' and is_current"))[0]!
    expect(nova).toMatchObject({ origin: 'ab_lab', ab_event: 'rotacao', window_precision: 'min', ab_test_id: t.id, ab_variant_id: t.variante })
  })

  it('7. item 201: com versões, youtube_channel_remove devolve serie_coletada e não remove; canal sem linha: removed', async () => {
    const c = await cenario()
    await comBase(c, 1)
    const remover = async (x: Cen): Promise<Linha> => {
      const slug = String((await q('select slug from public.youtube_channels where id = $1', [x.canal]))[0]!.slug)
      return (await q('select public.youtube_channel_remove($1::uuid, $2::uuid, $3)::jsonb as r', [x.site, x.canal, slug]))[0]!.r as Linha
    }
    const recusa = await remover(c)
    expect(recusa.status).toBe('serie_coletada')
    expect(Number(recusa.serie_coletada)).toBeGreaterThan(0)
    expect(await q('select 1 from public.yt_own_video_versions where channel_id = $1', [c.canal])).not.toHaveLength(0)
    const vazio = await cenario()
    expect((await remover(vazio)).status).toBe('removed')
  })

  it('11. S-I6: todas as colunas das versões abertas batem com a linha diária e com o ciclo semeado', async () => {
    const c = await cenario()
    const [v] = await comBase(c, 1) as [Vid]
    await linha(c, v, dia(1), { titulo: 'Titulo sintetico B', dhash: H1, sha: 'sha-B', blob: 'https://blob.test/b.jpg', desc: DESC_B, descTexto: 'Texto sintetico B' })
    const t = await teste(c, v, { tipo: 'title', status: 'active' })
    const inicio = `${dia(1)}T20:00:00.000Z`
    await ciclo(t, inicio, { title_set: 'Titulo sintetico B' })
    await passo(c, dia(1))
    const [linhaDia] = await q('select * from public.yt_own_video_meta_daily where youtube_video_id = $1 and day_pt = $2', [v.yt, dia(1)]) as [Linha]
    const th = (await versoes(c, "and field = 'thumb' and is_current"))[0]!
    expect(th).toMatchObject({ thumb_dhash: H1, thumb_anchor_dhash: H1, thumb_sha256: 'sha-B', thumb_blob_url: 'https://blob.test/b.jpg', video_id: v.id })
    expect(new Date(th.first_seen_at as string).toISOString()).toBe(new Date(linhaDia.captured_at as string).toISOString())
    expect(new Date(th.last_seen_at as string).toISOString()).toBe(new Date(linhaDia.captured_at as string).toISOString())
    const ti = (await versoes(c, "and field = 'title' and is_current"))[0]!
    expect(ti).toMatchObject({ origin: 'ab_lab', ab_test_id: t.id, ab_variant_id: t.variante, value_text: 'Titulo sintetico B' })
    for (const k of ['first_seen_at', 'window_start', 'window_end']) expect(new Date(ti[k] as string).toISOString(), k).toBe(inicio)
    const de = (await versoes(c, "and field = 'desc' and is_current"))[0]!
    expect(de.value_text).toBe('Texto sintetico B')
    expect(de.value_hash).toBe(DESC_B)
  })

  it('12. S-I1: vencedor, restauro (combo pausado) e manual_winner de combo sem winner_applied_at, lidos do banco de verdade', async () => {
    // vencedor: teste de título com winner_applied_at na janela
    const a = await cenario()
    const [va] = await comBase(a, 1) as [Vid]
    await linha(a, va, dia(1), { titulo: 'Titulo sintetico B' })
    const ta = await teste(a, va, { tipo: 'title', vencedorAplicadoEm: `${dia(1)}T20:00:00.000Z`, vencedor: true, motivo: 'auto_resolve' })
    await passo(a, dia(1))
    expect((await versoes(a, "and field = 'title' and is_current"))[0]).toMatchObject({ origin: 'ab_lab', ab_event: 'vencedor', ab_test_id: ta.id, ab_variant_id: ta.variante })
    // restauro: combo pausado na janela; título volta ao original e a thumbnail muda junto
    const b = await cenario()
    const [vb] = await comBase(b, 1) as [Vid]
    await linha(b, vb, dia(1), { titulo: 'Titulo sintetico B', dhash: H1, sha: 'sha-B', blob: 'https://blob.test/b.jpg' })
    await teste(b, vb, { tipo: 'combo', status: 'paused', pausadoEm: `${dia(1)}T20:00:00.000Z`, tituloOriginal: 'Titulo sintetico B' })
    await passo(b, dia(1))
    expect((await versoes(b, "and field = 'title' and is_current"))[0]).toMatchObject({ origin: 'ab_lab', ab_event: 'restauro' })
    expect((await versoes(b, "and field = 'thumb' and is_current"))[0]).toMatchObject({ origin: 'ab_lab', ab_event: 'restauro' })
    // manual_winner de combo com winner_applied_at nulo: a thumbnail sai vencedor, com a variante vencedora
    const d = await cenario()
    const [vd] = await comBase(d, 1) as [Vid]
    await linha(d, vd, dia(1), { dhash: H1, sha: 'sha-B', blob: 'https://blob.test/b.jpg' })
    const td = await teste(d, vd, { tipo: 'combo', motivo: 'manual_winner', concluidoEm: `${dia(1)}T20:00:00.000Z`, vencedor: true })
    await passo(d, dia(1))
    expect((await versoes(d, "and field = 'thumb' and is_current"))[0]).toMatchObject({ origin: 'ab_lab', ab_event: 'vencedor', ab_variant_id: td.variante })
  })

  it('13. D-I1: "dia 1 confirma, dia 2 troca" numa execução acumulada e em três diárias dão as mesmas linhas, fora id e created_at', async () => {
    const monta = async (c: Cen): Promise<Vid[]> => {
      const vs = [await video(c), await video(c)]
      for (const [i, v] of vs.entries()) {
        await linha(c, v, dia(2))
        await linha(c, v, dia(1))
        await linha(c, v, dia(0), i === 0 ? { titulo: 'Titulo sintetico B' } : { dhash: H1, sha: 'sha-B', blob: 'https://blob.test/b.jpg' })
      }
      return vs
    }
    const projeta = async (c: Cen, vs: Vid[]): Promise<unknown[]> => {
      const idx = new Map(vs.map((v, i) => [v.yt, i]))
      return (await versoes(c)).map(l => {
        const o: Linha = {}
        for (const [k, x] of Object.entries(l)) if (!/^(id|created_at|updated_at|youtube_video_id|video_id|channel_id|site_id)$/.test(k)) o[k] = x
        return { video: idx.get(l.youtube_video_id as string), ...o }
      }).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))
    }
    const acum = await cenario(); const va = await monta(acum)
    await passo(acum)
    const dias = await cenario(); const vd = await monta(dias)
    for (const n of [2, 1, 0]) await passo(dias, dia(n))
    expect(await derivadoAte(acum)).toBe(ONTEM)
    expect(await derivadoAte(dias)).toBe(ONTEM)
    const pa = await projeta(acum, va), pd = await projeta(dias, vd)
    expect(pa.length).toBeGreaterThan(6)
    expect(pd).toEqual(pa)
  })

  it('9 e 10. leitor: sem edição não lê (item 190); com edição devolve os três estados de registro por campo', async () => {
    const c = await cenario()
    const [a] = await comBase(c, 1) as [Vid]
    const b = await video(c) // sem nenhuma linha diária
    await linha(c, a, dia(1), { titulo: 'Titulo sintetico B' })
    await passo(c, dia(1))
    guarda.edita = false
    const negada = await provarLeituraPrivada(c.site)
    expect(negada).toBeNull()
    expect(await lerVersoes(sb, { leitura: negada, canalId: c.canal, hoje: HOJE, ytIds: [a.yt] })).toEqual({ acesso: 'negado' })
    guarda.edita = true
    const leitura = await provarLeituraPrivada(c.site)
    const lido = await lerVersoes(sb, { leitura, canalId: c.canal, hoje: HOJE, ytIds: [a.yt, b.yt] })
    if (lido.acesso !== 'ok') throw new Error('leitura negada')
    expect(lido.dado.estado).toMatchObject({ estado: 'registrando', conferidoAte: dia(1), atrasoDias: 1 })
    const [va, vb] = lido.dado.videos as [typeof lido.dado.videos[number], typeof lido.dado.videos[number]]
    expect(va.registro.title.estado).toBe('com_trocas')
    expect(va.registro.thumb.estado).toBe('so_linha_de_base')
    expect(va.registro.desc.estado).toBe('so_linha_de_base')
    expect(vb.registro).toEqual({
      title: { estado: 'sem_versao', conferidoAte: null }, thumb: { estado: 'sem_versao', conferidoAte: null }, desc: { estado: 'sem_versao', conferidoAte: null },
    })
  })

  it('8. item 203: nenhuma versão com origem cms depois de tudo', async () => {
    const r = await q(`select count(*)::int as n from public.yt_own_video_versions where origin = 'cms' and site_id = any($1::uuid[])`, [sites])
    expect(r[0]!.n).toBe(0)
  })
})
