// @vitest-environment node
/**
 * F2 T8: paridade D16 contra Postgres de verdade. A rota (serviço), o `get_signals` do Cowork e a ação `sugestoes` do Claude Code leem a MESMA
 * lista: o mesmo n, os mesmos ids e o mesmo motivoVazio (a rota e o get_signals em JSON; a sugestoes em texto de pacote, de onde n e ids saem;
 * nunca JSON idêntico). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2-leitura-paridade.test.ts --no-file-parallelism
 * Grava de verdade (site próprio, criado e apagado aqui).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite } from '../helpers/mg6'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const mundo = vi.hoisted(() => ({ siteId: '' as string, permissoes: ['write'] as string[] }))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: mundo.siteId, permissions: mundo.permissoes, keyHash: 'h', keyId: 'chave-int' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u' } }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: mundo.siteId }) }))

import { listNicheSignals } from '@/lib/pipeline/services/niche-signals'
import { youtubeObservatory } from '@/lib/pipeline/mcp/services/youtube-observatory'
import { montarSugestoes } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/montar'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { CONTEXTO } from '../youtube/observatorio/contexto-ia-fixture'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { contarSinaisAbertos, contarAbertosEntre, listarSinaisDoNicho } from '@/lib/youtube/observatorio/sinais/leitura'
import { lerAmostraDasLinhas } from '@/lib/youtube/observatorio/sinais/amostra'
import type { ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { apagarSites } from '../helpers/limpa-cena'

const dia = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString()
const hoje = new Date().toISOString().slice(0, 10)
const SIG = (n: number): string => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`
const EV = { outliers: [{ video_id: randomUUID(), canal_id: randomUUID(), published_at: dia(-3), mult_vpd7: 6, mult_tela: 3, vpd7: 900, formato: 'long' }], outliers_total: 2, canais: 2, proprios: [] }

describe.skipIf(skipIfNoLocalDb())('F2 T8: paridade da leitura (rota, get_signals, sugestoes)', () => {
  let pg: Client
  let org = ''
  let canal = ''
  const sb = (): SupabaseClient => getSupabaseServiceClient() as unknown as SupabaseClient
  const ctx = (): ServiceContext => ({ siteId: mundo.siteId, permissions: ['write'], keyId: 'chave-int', supabase: sb(), source: 'api_key' })

  async function sinal(n: number, chave: string, extra: { status?: string; expira?: string; forca?: number; kind?: string; proprios?: string[] } = {}): Promise<void> {
    await pg.query(
      `insert into public.niche_signals (id, site_id, kind, subject_key, rule_version, evidence, forca, acao, status, first_seen_at, computed_at, expires_at, motivo)
       values ($1, $2, $3, $4, 'sinais-v1+semente-1', $5::jsonb, $6, 'video_novo', $7, now() - interval '2 days', now(), $8, 'dois canais estouraram')`,
      [SIG(n), mundo.siteId, extra.kind ?? 'destino', chave, JSON.stringify({ ...EV, proprios: extra.proprios ?? EV.proprios }), extra.forca ?? 10 + n, extra.status ?? 'aberto', extra.expira ?? dia(20)])
  }
  async function video(yt: string, privacidade: string | null, oculto = false): Promise<string> {
    const id = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, is_hidden)
      values ($1, $2, $3, 'T', now(), $4) returning id`, [mundo.siteId, canal, yt, oculto])).rows[0].id)
    if (privacidade) await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, privacy_status, captured_at) values ($1, $2, $3, $4, $5, $6, now())`,
      [yt, hoje, mundo.siteId, id, canal, privacidade])
    await pg.query(`insert into public.video_lugares (video_id, site_id, origem, chaves, fonte, entrada_hash, semente_versao, computado_em) values ($1, $2, 'proprio', '{pais:JP}', 'texto', 'h', 1, now())`, [id, mundo.siteId])
    return id
  }
  async function estado(motivo: string | null, contagens: Record<string, number> = {}): Promise<void> {
    await pg.query(`insert into public.niche_signals_estado (site_id, computed_at, rule_version, motivo_vazio, contagens) values ($1, now(), 'sinais-v1+semente-1', $2, $3::jsonb)
      on conflict (site_id) do update set motivo_vazio = excluded.motivo_vazio, contagens = excluded.contagens, computed_at = excluded.computed_at`, [mundo.siteId, motivo, JSON.stringify(contagens)])
  }
  async function limpar(): Promise<void> {
    await pg.query('delete from public.niche_signals where site_id = $1', [mundo.siteId])
    await pg.query('delete from public.niche_signals_estado where site_id = $1', [mundo.siteId])
  }

  async function rota(): Promise<ListaDeSinais> { return (await listNicheSignals(ctx())).data }
  async function cowork(): Promise<ListaDeSinais> {
    const r = await youtubeObservatory({ action: 'get_signals' })
    expect(r.isError).toBeFalsy()
    return JSON.parse((r.content[0] as { text: string }).text) as ListaDeSinais
  }
  async function claudeCode(): Promise<{ n: number | null; ids: string[]; vazio: string | null; texto: string }> {
    const m = await montarSugestoes()
    expect(m).not.toBeNull()
    const texto = montarTexto(segmentar(m!.modelo, CONTEXTO), '', 1_000_000, 'todos').texto
    const n = /Sugestões abertas[^\n]*?(\d+)/.exec(texto)?.[1]
    return { n: n === undefined ? null : Number(n), ids: [...new Set(texto.match(/aaaaaaaa-0000-4000-8000-\d{12}/g) ?? [])], vazio: m!.modelo.vazio, texto }
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    const s = await criarSite(pg)
    mundo.siteId = s.site; org = s.org
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [mundo.siteId, 'UC' + k.slice(0, 20), '@f8' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'f2t8-' + k.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.yt_own_video_meta_daily where site_id = $1', [mundo.siteId])
      await pg.query('delete from public.youtube_videos where site_id = $1', [mundo.siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [mundo.siteId])
      await apagarSites(pg, 'id = $1', [mundo.siteId])
      await pg.query('delete from public.organizations where id = $1', [org])
    } finally { await pg.end() }
  })

  it('três caminhos: mesmo n, mesmos ids (na ordem) e mesmo motivoVazio; a linha aberta com expires_at vencido (gravador parado) fica fora nos três', async () => {
    await limpar()
    await sinal(1, 'pais:JP', { forca: 30 }); await sinal(2, 'pais:VN', { forca: 20 }); await sinal(3, 'pais:TR', { expira: dia(-1) })
    await estado(null, { canais_total: 5 })
    const [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    expect(a.n).toBe(2)
    expect(b.n).toBe(a.n); expect(c.n).toBe(a.n)
    expect(b.itens.map((i) => i.id)).toEqual(a.itens.map((i) => i.id))
    expect(a.itens.map((i) => i.id)).toEqual([SIG(1), SIG(2)])
    expect(c.ids).toEqual([SIG(1), SIG(2)])
    expect(a.motivoVazio).toBeNull(); expect(b.motivoVazio).toBeNull(); expect(c.vazio).toBeNull()
  })

  it('mais de 20 abertas: mesmo n e mesmo motivoVazio; os ids da sugestoes (20 mais fortes) são o PREFIXO, na mesma ordem, dos ids da rota e do get_signals', async () => {
    await limpar()
    for (let k = 1; k <= 25; k++) await sinal(k, `pais:P${k}`, { forca: 100 - k })
    await estado(null, { canais_total: 5 })
    const [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    expect(a.n).toBe(25)
    expect(b.n).toBe(25); expect(c.n).toBe(25)
    expect(a.itens).toHaveLength(25)
    expect(b.itens.map((i) => i.id)).toEqual(a.itens.map((i) => i.id))
    expect(c.ids).toHaveLength(20)
    expect(c.ids).toEqual(a.itens.slice(0, 20).map((i) => i.id))
    expect(a.motivoVazio).toBeNull(); expect(b.motivoVazio).toBeNull(); expect(c.vazio).toBeNull()
  })

  it('próprio público entra em proprios_agora; privado e oculto não; a ação derivada e o n_proprios são iguais nos três caminhos', async () => {
    await limpar()
    await sinal(1, 'pais:JP')
    await estado(null)
    const pub = await video('ytpub' + randomUUID().slice(0, 6), 'public')
    await video('ytpri' + randomUUID().slice(0, 6), 'private')
    await video('ythid' + randomUUID().slice(0, 6), 'public', true)
    await video('ytsem' + randomUUID().slice(0, 6), null)
    const [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    expect(a.itens[0]!.proprios_agora).toEqual([pub])
    expect(b.itens[0]!.proprios_agora).toEqual([pub])
    expect(a.itens[0]).toMatchObject({ acao: 'titulo_descricao', acao_gravada: 'video_novo', n_proprios: 1 })
    expect(b.itens[0]).toMatchObject({ acao: 'titulo_descricao', n_proprios: 1 })
    expect(c.texto).toContain(pub)
    expect(c.ids).toEqual([SIG(1)])
    // a leitura não reescreve a coluna
    expect(Number((await pg.query(`select count(*) from public.niche_signals where site_id = $1 and acao = 'video_novo'`, [mundo.siteId])).rows[0].count)).toBe(1)
  })

  it('parecido: proprios_agora vem de evidence.proprios; n_proprios igual nos três caminhos', async () => {
    await limpar()
    const pub = await video('ytpar' + randomUUID().slice(0, 6), 'public')
    const pri = await video('ytpap' + randomUUID().slice(0, 6), 'private')
    await sinal(1, 'outlier:' + randomUUID(), { kind: 'parecido', proprios: [pub, pri] })
    await estado(null)
    const [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    for (const l of [a, b]) expect(l.itens[0]).toMatchObject({ proprios_agora: [pub], proprios_agora_n: 1, n_proprios: 1, acao: 'titulo_descricao', rotulo_acao: 'abrir-seus' })
    expect(c.texto).toContain(pub)
  })

  it('dispensar derruba o N da próxima leitura nos três caminhos; tudo dispensado = tudo-respondido (e a sugestoes diz a frase)', async () => {
    await limpar()
    await sinal(1, 'pais:JP'); await sinal(2, 'pais:VN')
    await estado(null, { canais_total: 5 })
    const r = await youtubeObservatory({ action: 'dismiss_signal', signal_id: SIG(1), status: 'dispensado', motivo: 'ja_fiz' })
    expect(r.isError).toBeFalsy()
    expect((await pg.query(`select dispensado_por from public.niche_signals where id = $1`, [SIG(1)])).rows[0].dispensado_por).toBe('key:chave-int')
    let [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    expect([a.n, b.n, c.n]).toEqual([1, 1, 1])
    expect(c.ids).toEqual([SIG(2)])
    await youtubeObservatory({ action: 'dismiss_signal', signal_id: SIG(2), status: 'dispensado', motivo: 'nao_interessa' });
    [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    expect([a.n, b.n]).toEqual([0, 0])
    expect(a.motivoVazio).toBe('tudo-respondido'); expect(b.motivoVazio).toBe('tudo-respondido')
    expect(a.contagens.respondidos_30d).toBe(2)
    expect(c.vazio).toMatch(/já foram respondidas \(2 nos últimos 30 dias\)/)
  })

  it('id de outro site não é dispensado (nao_encontrado) e o estado vazio carrega o motivo do cálculo nos três caminhos', async () => {
    await limpar()
    await sinal(1, 'pais:JP')
    const outro = (await criarSite(pg))
    try {
      await pg.query('update public.niche_signals set site_id = $1 where id = $2', [outro.site, SIG(1)])
      const r = await youtubeObservatory({ action: 'dismiss_signal', signal_id: SIG(1), status: 'dispensado', motivo: 'ja_fiz' })
      expect(r.isError).toBe(true)
      expect((await pg.query(`select status from public.niche_signals where id = $1`, [SIG(1)])).rows[0].status).toBe('aberto')
    } finally {
      await pg.query('delete from public.niche_signals where id = $1', [SIG(1)])
      await apagarSites(pg, 'id = $1', [outro.site]); await pg.query('delete from public.organizations where id = $1', [outro.org])
    }
    await estado('sem-lugar', { outliers_sem_lugar: 4, outliers_total: 4 })
    const [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    expect([a.n, b.n]).toEqual([0, 0])
    expect([a.motivoVazio, b.motivoVazio]).toEqual(['sem-lugar', 'sem-lugar'])
    expect(c.vazio).toMatch(/nenhum com lugar reconhecido \(4 de 4 sem lugar\)/)
  })

  it('sem estado: nunca-calculado nos três caminhos', async () => {
    await limpar()
    const [a, b, c] = [await rota(), await cowork(), await claudeCode()]
    expect([a.motivoVazio, b.motivoVazio]).toEqual(['nunca-calculado', 'nunca-calculado'])
    expect(c.vazio).toMatch(/cálculo|1º cálculo/)
  })

  it('F3 T2: contarSinaisAbertos dá o mesmo n e os ids de listarSinaisDoNicho coincidem com a rota, o get_signals e a sugestoes; vencida e dispensada ficam fora', async () => {
    await limpar()
    await sinal(1, 'pais:JP', { forca: 30 }); await sinal(2, 'pais:VN', { forca: 20 }); await sinal(3, 'pais:TR', { expira: dia(-1) }); await sinal(4, 'pais:IT', { status: 'dispensado' })
    await estado(null, { canais_total: 5 })
    const agora = new Date()
    const [a, b, c, lista, n] = [await rota(), await cowork(), await claudeCode(), await listarSinaisDoNicho(sb(), mundo.siteId, agora, 100), await contarSinaisAbertos(sb(), mundo.siteId, agora)]
    expect(n).toBe(2)
    expect([a.n, b.n, c.n, lista.n]).toEqual([2, 2, 2, 2])
    expect(lista.itens.map((i) => i.id)).toEqual(a.itens.map((i) => i.id))
    expect(c.ids).toEqual(lista.itens.map((i) => i.id))
  })

  it('F3 T2: contarAbertosEntre conta só abertos vigentes do site (vencido, dispensado e id alheio ficam fora)', async () => {
    await limpar()
    await sinal(1, 'pais:JP'); await sinal(2, 'pais:VN'); await sinal(3, 'pais:TR', { expira: dia(-1) }); await sinal(4, 'pais:IT', { status: 'dispensado' })
    const ids = [SIG(1), SIG(2), SIG(3), SIG(4), randomUUID()]
    expect(await contarAbertosEntre(sb(), mundo.siteId, ids, new Date())).toBe(2)
    const outro = await criarSite(pg)
    try { expect(await contarAbertosEntre(sb(), outro.site, ids, new Date())).toBe(0) }
    finally { await apagarSites(pg, 'id = $1', [outro.site]); await pg.query('delete from public.organizations where id = $1', [outro.org]) }
  })

  it('F3 T2 (DF6): parecido com o próprio privado → proprios_agora [] e abrir-concorrente; com o público → [p1], abrir-seus, n_proprios 1', async () => {
    await limpar()
    const pub = await video('ytdf6a' + randomUUID().slice(0, 6), 'public')
    const pri = await video('ytdf6b' + randomUUID().slice(0, 6), 'private')
    await sinal(1, 'outlier:' + randomUUID(), { kind: 'parecido', proprios: [pub], forca: 30 })
    await sinal(2, 'outlier:' + randomUUID(), { kind: 'parecido', proprios: [pri], forca: 20 })
    await estado(null)
    const [a, b] = [await rota(), await cowork()]
    for (const l of [a, b]) {
      expect(l.itens[0]).toMatchObject({ id: SIG(1), proprios_agora: [pub], rotulo_acao: 'abrir-seus', n_proprios: 1 })
      expect(l.itens[1]).toMatchObject({ id: SIG(2), proprios_agora: [], rotulo_acao: 'abrir-concorrente', n_proprios: 0 })
    }
  })

  it('F3 T2: a amostra traz canal e chaves das duas origens, nada de outro site, e chaves = null sem video_lugares', async () => {
    await limpar()
    const pub = await video('ytam' + randomUUID().slice(0, 6), 'public')
    const m = await lerAmostraDasLinhas(sb(), mundo.siteId, [pub, randomUUID()])
    expect(m.size).toBe(1)
    expect(m.get(pub)).toMatchObject({ origem: 'proprio', canal: null, chaves: ['pais:JP'] })
    await pg.query('delete from public.video_lugares where video_id = $1', [pub])
    expect((await lerAmostraDasLinhas(sb(), mundo.siteId, [pub])).get(pub)?.chaves).toBeNull()
  })
})
