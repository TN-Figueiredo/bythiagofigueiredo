// @vitest-environment node
/**
 * F1a-tela-1 T3: RPC `ab_lab_volume` e `lerLinhasDoCaminho` contra o banco. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-tela-lista --no-file-parallelism
 * O banco é compartilhado e sujo: toda asserção filtra pelo site semeado aqui.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerLinhasDoCaminho } from '../helpers/linhas-do-canal'
import { versoesDoDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-estado'
import { lerVolumes } from '@/lib/youtube/teste-youtube/nativo/volume-leitor'
import { leituraDoEditor, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { apagarSites } from '../helpers/limpa-cena'

// a prova de edição (`leituraDoEditor`) que a lista repete na borda: a guarda simulada aceita
const sentryMsgs = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', async (orig) => ({ ...(await orig<typeof import('@sentry/nextjs')>()), captureMessage: sentryMsgs }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u-teste' } })) }))
const tok = async (site: string): Promise<LeituraPrivadaDoSite> => {
  const l = await leituraDoEditor(site)
  if (!l) throw new Error('sem prova de edição no teste')
  return l
}

vi.setConfig({ testTimeout: 90_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TIPO = 'channel_reach_basic_a1'
const DIA = 86_400_000

describe.skipIf(skipIfNoLocalDb())('F1a-tela-1 T3: volume por vídeo (RPC) e linhas da lista', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let outroSite: string
  let canal: string
  let canalSemRelatorio: string
  let outroCanal: string
  const sites: string[] = []

  const novoCanal = async (site: string): Promise<string> => {
    const k = randomUUID().replace(/-/g, '')
    return String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + k.slice(0, 20), '@t3' + k.slice(0, 8), 'UU' + k.slice(0, 20), 't3-' + k.slice(0, 8)])).rows[0].id)
  }
  const yt = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
  const video = async (site: string, canalId: string, diasAtras: number): Promise<{ id: string; yt: string }> => {
    const y = yt()
    const id = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds)
      values ($1, $2, $3, 'Título ' || $3, now() - make_interval(days => $4::int), 600) returning id`, [site, canalId, y, diasAtras])).rows[0].id)
    return { id, yt: y }
  }
  /** Relatório normalizado de alcance para os `dias` mais recentes (dia = hoje_PT − i). */
  const relatorios = async (site: string, canalId: string, dias: number[], status = 'baixado'): Promise<void> => {
    for (const i of dias) {
      await pg.query(`insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, normalized_at)
        select $1, $2, 'job', $3, $4, d::timestamp at time zone 'UTC', d::timestamp at time zone 'UTC' + interval '1 day', now(), 'u', $6, now()
          from (select (now() at time zone 'America/Sao_Paulo')::date - $5::int as d) x`, ['r' + randomUUID(), site, canalId, TIPO, i, status])
    }
  }
  const alcance = async (site: string, canalId: string, v: { id: string; yt: string }, dia: number, impressoes: number): Promise<void> => {
    await pg.query(`insert into public.yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
      values ($1, (now() at time zone 'America/Sao_Paulo')::date - $5::int, $2, $3, $4, $6, 'r', now(), 'views_desde_2026-08-27')`, [v.yt, site, v.id, canalId, dia, impressoes])
  }
  const meta = (site: string, canalId: string, v: { yt: string }, privacidade: string, isShort: boolean | null): Promise<unknown> =>
    pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, is_short, privacy_status, captured_at)
      values ($1, (now() at time zone 'America/Sao_Paulo')::date, $2, $3, $4, $5, now())`, [v.yt, site, canalId, isShort, privacidade])

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    outroSite = (await seedSite(sb)).siteId
    sites.push(siteId, outroSite)
    canal = await novoCanal(siteId)
    canalSemRelatorio = await novoCanal(siteId)
    outroCanal = await novoCanal(outroSite)
  })
  afterAll(async () => {
    try {
      for (const t of ['ab_native_fichas', 'ab_native_tests', 'ab_tests', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_state_raw', 'yt_own_video_versions', 'yt_reporting_reports', 'youtube_videos', 'youtube_channels']) {
        await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
      }
      await apagarSites(pg, 'id = any($1::uuid[])', [sites])
    } finally {
      await pg.end()
    }
  })

  describe('RPC ab_lab_volume', () => {
    it('o cliente de serviço recebe soma e dias_cobertos (nunca vazio por falta de auth.uid()); 3 linhas de 200 em 14 dias = 600', async () => {
      const v = await video(siteId, canal, 60)
      await relatorios(siteId, canal, Array.from({ length: 14 }, (_, i) => i + 1))
      for (const d of [2, 5, 9]) await alcance(siteId, canal, v, d, 200)
      const m = await lerVolumes(sb, await tok(siteId), [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 600, diasCobertos: 14 })
    })

    it('vídeo sem relatório (canal sem cobertura) vem com dias_cobertos = 0, nunca ausente', async () => {
      const v = await video(siteId, canalSemRelatorio, 60)
      const m = await lerVolumes(sb, await tok(siteId), [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 0, diasCobertos: 0 })
    })

    it('cobertura é por canal: o canal coberto não empresta dias ao canal sem relatório', async () => {
      const a = await video(siteId, canal, 60)
      const b = await video(siteId, canalSemRelatorio, 60)
      const m = await lerVolumes(sb, await tok(siteId), [a.id, b.id])
      expect(m.get(a.id)?.diasCobertos).toBe(14)
      expect(m.get(b.id)?.diasCobertos).toBe(0)
    })

    it('vídeo de outro site em p_videos não aparece', async () => {
      const meu = await video(siteId, canal, 60)
      const alheio = await video(outroSite, outroCanal, 60)
      const m = await lerVolumes(sb, await tok(siteId), [meu.id, alheio.id])
      expect(m.has(meu.id)).toBe(true)
      expect(m.has(alheio.id)).toBe(false)
    })

    it('28 dias cobertos e 3 linhas de 200 só fora dos 14 mais recentes: soma 0, 14 dias (a janela corta)', async () => {
      const c = await novoCanal(siteId)
      const v = await video(siteId, c, 60)
      await relatorios(siteId, c, Array.from({ length: 28 }, (_, i) => i + 1))
      for (const d of [20, 22, 25]) await alcance(siteId, c, v, d, 200)
      const m = await lerVolumes(sb, await tok(siteId), [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 0, diasCobertos: 14 })
    })

    it('relatório vazio conta como dia coberto (zero medido); dia sem relatório não entra', async () => {
      const c = await novoCanal(siteId)
      const v = await video(siteId, c, 60)
      await relatorios(siteId, c, [1, 2, 3, 4], 'vazio')
      await relatorios(siteId, c, [10]) // dias 5..9 sem relatório
      await alcance(siteId, c, v, 1, 50)
      const m = await lerVolumes(sb, await tok(siteId), [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 50, diasCobertos: 5 })
    })

    it('a janela começa em publicado + 1: dias anteriores à publicação não cobrem', async () => {
      const c = await novoCanal(siteId)
      const v = await video(siteId, c, 3) // publicado há 3 dias (PT): contam os dias 2 e 1 atrás e hoje não há relatório
      await relatorios(siteId, c, [1, 2, 3, 4, 5, 6])
      const m = await lerVolumes(sb, await tok(siteId), [v.id])
      expect(m.get(v.id)?.diasCobertos).toBeLessThanOrEqual(3)
      expect(m.get(v.id)?.diasCobertos).toBeGreaterThanOrEqual(2)
    })

    it('anon e authenticated NÃO têm EXECUTE (conferido por has_function_privilege, sem chamar a função)', async () => {
      const r = await pg.query(`select has_function_privilege('anon', 'public.ab_lab_volume(uuid, uuid[])', 'execute') as anon,
        has_function_privilege('authenticated', 'public.ab_lab_volume(uuid, uuid[])', 'execute') as auth,
        has_function_privilege('service_role', 'public.ab_lab_volume(uuid, uuid[])', 'execute') as svc`)
      expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true })
    })

    it('40 vídeos × 28 dias de alcance (mais de 1000 linhas): nenhum perde volume', async () => {
      const c = await novoCanal(siteId)
      await relatorios(siteId, c, Array.from({ length: 28 }, (_, i) => i + 1))
      const vs = await Promise.all(Array.from({ length: 40 }, () => video(siteId, c, 90)))
      await pg.query(`insert into public.yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
        select v.yt, (now() at time zone 'America/Sao_Paulo')::date - g, $1, v.id, $2, 400, 'r', now(), 'views_desde_2026-08-27'
          from jsonb_to_recordset($3::jsonb) as v(id uuid, yt text), generate_series(1, 28) g`, [siteId, c, JSON.stringify(vs)])
      const m = await lerVolumes(sb, await tok(siteId), vs.map((v) => v.id))
      expect(m.size).toBe(40)
      for (const v of vs) expect(m.get(v.id)).toMatchObject({ soma: 400 * 14, diasCobertos: 14 })
    })
  })

  describe('lerLinhasDoCaminho', () => {
    it('25 vídeos (um privado), 1 ficha aberta num antigo, 1 registro em_andamento: 22 linhas, ≤ 7 consultas, nada de outro site', async () => {
      const s = (await seedSite(sb)).siteId
      const o = (await seedSite(sb)).siteId
      sites.push(s, o)
      const c = await novoCanal(s)
      const co = await novoCanal(o)
      await relatorios(s, c, Array.from({ length: 14 }, (_, i) => i + 1))
      const vs: { id: string; yt: string }[] = []
      for (let i = 1; i <= 25; i++) vs.push(await video(s, c, 30 + i))
      // vs[i] publicado há 31+i dias: vs[0] é o mais novo. O privado é o 3º; a ficha vai no 24º e o registro no 25º.
      for (let i = 0; i < 25; i++) await meta(s, c, vs[i]!, i === 2 ? 'private' : 'public', i === 23 ? null : false)
      const alheio = await video(o, co, 1)
      await meta(o, co, alheio, 'public', false)
      await pg.query(`insert into public.ab_native_fichas (site_id, video_id, campos, variantes) values ($1, $2, '{titulo}', $3::jsonb)`,
        [s, vs[23]!.id, JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'A' }, { n: 2, tipo: 'titulo', titulo: 'B' }])])
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra)
        values ($1, $2, $3, 'detectado', '{titulo}', 'em_andamento', '["A","B"]'::jsonb, now() - interval '2 days', 1)`, [s, vs[24]!.id, vs[24]!.yt])

      let consultas = 0
      const espiao = new Proxy(sb as SupabaseClient, {
        get(alvo, prop, recv) {
          const real = Reflect.get(alvo, prop, recv) as unknown
          if ((prop === 'from' || prop === 'rpc') && typeof real === 'function') {
            return (...a: unknown[]) => { consultas++; return (real as (...x: unknown[]) => unknown).apply(alvo, a) }
          }
          return real
        },
      })
      const linhas = await lerLinhasDoCaminho(espiao, s, new Date(), await tok(s))
      expect(linhas).toHaveLength(22)
      expect(consultas).toBeLessThanOrEqual(8) // 7 + a consulta em lote do título de antes (há 1 derivada)
      const ids = new Set(linhas.map((l) => l.videoId))
      expect(ids.has(vs[2]!.id)).toBe(false) // privado fora
      expect(ids.has(vs[23]!.id)).toBe(true) // ficha
      expect(ids.has(vs[24]!.id)).toBe(true) // registro
      expect(ids.has(alheio.id)).toBe(false)
      expect(linhas.find((l) => l.videoId === vs[24]!.id)?.estado).toBe('em_teste_studio')
      expect(linhas.find((l) => l.videoId === vs[23]!.id)?.estado).toBe('em_preparo')
      expect(linhas.find((l) => l.videoId === vs[23]!.id)?.fichaId).not.toBeNull()
    })

    it('volume por dia chega à linha; vídeo de canal sem relatório fica com impressoesPorDia nulo', async () => {
      const s = (await seedSite(sb)).siteId
      sites.push(s)
      const c = await novoCanal(s)
      const c2 = await novoCanal(s)
      await relatorios(s, c, Array.from({ length: 14 }, (_, i) => i + 1))
      const a = await video(s, c, 40)
      const b = await video(s, c2, 41)
      for (let d = 1; d <= 14; d++) await alcance(s, c, a, d, 300)
      for (const v of [a, b]) await meta(s, v === a ? c : c2, v, 'public', false)
      // O bruto diz que não é para crianças: sem ele o roteador cai, com razão, em "formato não confirmado".
      await pg.query(`insert into public.yt_own_video_state_raw (youtube_video_id, site_id, channel_id, state_sha256, raw, observed_at)
        values ($1, $2, $3, $4, '{"status":{"madeForKids":false}}'::jsonb, now())`, [a.yt, s, c, randomUUID().replace(/-/g, '')])
      const linhas = await lerLinhasDoCaminho(sb, s, new Date(), await tok(s))
      expect(linhas.find((l) => l.videoId === a.id)?.impressoesPorDia).toBe(300)
      expect(linhas.find((l) => l.videoId === a.id)?.estado).toBe('sugerido_youtube')
      expect(linhas.find((l) => l.videoId === b.id)?.impressoesPorDia).toBeNull()
      expect(linhas.find((l) => l.videoId === b.id)?.estado).toBe('formato_nao_confirmado')
    })

    it('registro.variantes: ficha já vinculada (2 versões) vem preenchida; origem derivada vem nula', async () => {
      const s = (await seedSite(sb)).siteId
      sites.push(s)
      const c = await novoCanal(s)
      const a = await video(s, c, 20)
      const b = await video(s, c, 21)
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, confirmado_em, primeira_vista, variantes, variantes_titulo, versao_regra)
        values ($1, $2, $3, 'confirmado', '{titulo}', 'em_andamento', now() - interval '15 days', now() - interval '15 days', $4::jsonb, null, 1)`,
        [s, a.id, a.yt, JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'A' }, { n: 2, tipo: 'titulo', titulo: 'B', imagem: { url: 'https://x/y.png' } }])])
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, primeira_vista, variantes_titulo, versao_regra)
        values ($1, $2, $3, 'detectado', '{titulo}', 'em_andamento', now() - interval '3 days', '["A","B"]'::jsonb, 1)`, [s, b.id, b.yt])
      const linhas = await lerLinhasDoCaminho(sb, s, new Date(), await tok(s))
      const la = linhas.find((l) => l.videoId === a.id)!
      const lb = linhas.find((l) => l.videoId === b.id)!
      expect(la.estado).toBe('resultado_pronto')
      expect(la.registro?.variantes).toEqual([{ n: 1, titulo: 'A', imagem: null }, { n: 2, titulo: 'B', imagem: { url: 'https://x/y.png' } }])
      expect(lb.registro?.variantes).toBeNull()
      expect(lb.registro?.variantesTitulo).toEqual(['A', 'B'])
      expect(lb.estado).toBe('em_teste_studio')
    })

    it('nosso teste pausado com registro aberto: labPausadoAte é o instante início + 16 d', async () => {
      const s = (await seedSite(sb)).siteId
      sites.push(s)
      const c = await novoCanal(s)
      const a = await video(s, c, 20)
      const ini = new Date(Date.now() - 3 * 86_400_000)
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, primeira_vista, variantes_titulo, versao_regra)
        values ($1, $2, $3, 'detectado', '{titulo}', 'em_andamento', $4, '["A","B"]'::jsonb, 1)`, [s, a.id, a.yt, ini.toISOString()])
      await pg.query(`insert into public.ab_tests (site_id, youtube_video_id, name, status, original_thumbnail_url, started_at, paused_at)
        values ($1, $2, 'n', 'paused', 'https://x/t.png', now() - interval '2 days', now())`, [s, a.id])
      const l = (await lerLinhasDoCaminho(sb, s, new Date(), await tok(s))).find((x) => x.videoId === a.id)!
      expect(l.nosso?.status).toBe('paused')
      expect(l.labPausadoAte).toBe(new Date(ini.getTime() + 16 * 86_400_000).toISOString())
      expect(l.nosso?.restoreStatus ?? null).toBeNull()
    })

    it('nosso teste pausado com restauro feito: restoreStatus chega na linha (a ficha libera o Studio ao recarregar)', async () => {
      const s = (await seedSite(sb)).siteId
      sites.push(s)
      const c = await novoCanal(s)
      const a = await video(s, c, 20)
      const campo = { estado: 'ok', destino: 'original', em: new Date().toISOString(), forcado: false, escreveu: true, erro: null, attempts: 1 }
      await pg.query(`insert into public.ab_tests (site_id, youtube_video_id, name, status, original_thumbnail_url, started_at, paused_at, restore_status)
        values ($1, $2, 'n', 'paused', 'https://x/t.png', now() - interval '2 days', now(), $3::jsonb)`, [s, a.id, JSON.stringify({ title: campo, thumbnail: campo })])
      const l = (await lerLinhasDoCaminho(sb, s, new Date(), await tok(s))).find((x) => x.videoId === a.id)!
      expect(l.nosso?.restoreStatus).toMatchObject({ title: { estado: 'ok' }, thumbnail: { estado: 'ok' } })
    })

    describe('F1a-tela-2 T4: versões do dia 14', () => {
      const espiar = (): { cliente: SupabaseClient; tabelas: string[] } => {
        const tabelas: string[] = []
        const cliente = new Proxy(sb as SupabaseClient, {
          get(alvo, prop, recv) {
            const real = Reflect.get(alvo, prop, recv) as unknown
            if ((prop === 'from' || prop === 'rpc') && typeof real === 'function') {
              return (...a: unknown[]) => { tabelas.push(String(a[0])); return (real as (...x: unknown[]) => unknown).apply(alvo, a) }
            }
            return real
          },
        })
        return { cliente, tabelas }
      }
      const versaoDeTitulo = async (s: string, c: string, ytId: string, texto: string, dias: number, origin = 'linha_de_base'): Promise<void> => {
        const quando = new Date(Date.now() - dias * DIA).toISOString()
        const lab = origin === 'ab_lab'
        await pg.query(`insert into public.yt_own_video_versions (youtube_video_id, site_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt,
            first_seen_at, last_seen_at, window_precision, origin, ab_event, is_current, window_start, window_end)
          values ($1, $2, $3, 'title', $4, $5, ($6::timestamptz at time zone 'America/Sao_Paulo')::date, ($6::timestamptz at time zone 'America/Sao_Paulo')::date, $6, $6, $7, $8, $9, false,
            case when $7 = 'first' then null else $6::timestamptz end, case when $7 = 'first' then null else $6::timestamptz end)`,
        [ytId, s, c, texto, randomUUID().replace(/-/g, '').slice(0, 32), quando, lab ? 'min' : origin === 'linha_de_base' ? 'first' : '1d', origin, lab ? 'rotacao' : null])
      }
      const registro = async (s: string, v: { id: string; yt: string }, titulos: unknown, extra = ''): Promise<string> =>
        String((await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, confirmado_em, primeira_vista, variantes_titulo, versao_regra)
          values ($1, $2, $3, 'detectado', '{titulo}', 'em_andamento', now() - interval '15 days', now() - interval '15 days', $4::jsonb, 1) ${extra} returning id`,
        [s, v.id, v.yt, JSON.stringify(titulos)])).rows[0].id)

      it('derivada com versão anterior a primeira_vista: o título de antes (sem as versões do Lab) vai para a A com original; UMA consulta em lote', async () => {
        const s = (await seedSite(sb)).siteId
        sites.push(s)
        const c = await novoCanal(s)
        const a = await video(s, c, 30)
        const b = await video(s, c, 31)
        await registro(s, a, ['Novo', 'Velho'])
        await registro(s, b, ['X', 'Y'])
        await versaoDeTitulo(s, c, a.yt, 'Velho', 40)
        await versaoDeTitulo(s, c, a.yt, 'Do Lab', 20, 'ab_lab') // anterior a primeira_vista, mas é do próprio Lab: ignorada
        await versaoDeTitulo(s, c, a.yt, 'Depois', 5) // posterior a primeira_vista: fora do corte
        const { cliente, tabelas } = espiar()
        const linhas = await lerLinhasDoCaminho(cliente, s, new Date(), await tok(s))
        expect(tabelas.filter((t) => t === 'yt_own_video_versions')).toHaveLength(1)
        expect(tabelas.length).toBeLessThanOrEqual(8)
        const la = linhas.find((l) => l.videoId === a.id)!
        const lb = linhas.find((l) => l.videoId === b.id)!
        expect(la.registro?.tituloAntes).toBe('Velho')
        expect(lb.registro?.tituloAntes).toBeNull() // sem versão anterior: título de antes desconhecido, nunca inventado
        const pa = versoesDoDia14(la.registro!)
        expect(pa).toMatchObject({ tipo: 'versoes', origem: 'derivada', originalConhecido: true })
        if (pa.tipo === 'versoes') expect(pa.versoes.map((x) => [x.letra, x.titulo, x.original])).toEqual([['A', 'Velho', true], ['B', 'Novo', false]])
        const pb = versoesDoDia14(lb.registro!)
        expect(pb).toMatchObject({ tipo: 'versoes', originalConhecido: false })
        expect(la.registro?.inicio).toBeTruthy()
      })

      it('sem linha derivada: zero consultas a yt_own_video_versions', async () => {
        const s = (await seedSite(sb)).siteId
        sites.push(s)
        const c = await novoCanal(s)
        const a = await video(s, c, 30)
        await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, confirmado_em, primeira_vista, variantes, versao_regra)
          values ($1, $2, $3, 'confirmado', '{titulo}', 'em_andamento', now() - interval '15 days', now() - interval '15 days', $4::jsonb, 1)`,
        [s, a.id, a.yt, JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'A' }, { n: 2, tipo: 'titulo', titulo: 'B' }])])
        const { cliente, tabelas } = espiar()
        await lerLinhasDoCaminho(cliente, s, new Date(), await tok(s))
        expect(tabelas.filter((t) => t === 'yt_own_video_versions')).toHaveLength(0)
        expect(tabelas.length).toBeLessThanOrEqual(7)
      })

      it('variantes_titulo ilegível (JSON de outra forma): sem_versoes e UM aviso ao Sentry com registroId, mesmo em duas leituras', async () => {
        const s = (await seedSite(sb)).siteId
        sites.push(s)
        const c = await novoCanal(s)
        const a = await video(s, c, 30)
        const id = await registro(s, a, [1, 2])
        sentryMsgs.mockClear()
        for (let i = 0; i < 2; i++) {
          const l = (await lerLinhasDoCaminho(sb, s, new Date(), await tok(s))).find((x) => x.videoId === a.id)!
          expect(versoesDoDia14(l.registro!)).toEqual({ tipo: 'sem_versoes' })
        }
        const deste = sentryMsgs.mock.calls.filter((c2) => (c2[1] as { extra?: { registroId?: string } } | undefined)?.extra?.registroId === id)
        expect(deste).toHaveLength(1)
        expect((deste[0]![1] as { level: string }).level).toBe('warning')
      })

      it('variantes_titulo cheio (3; a `variantes_demais` do registrador mora na avaliação e a lista não a lê): a pergunta sai com as 3 versões (limite declarado)', async () => {
        const s = (await seedSite(sb)).siteId
        sites.push(s)
        const c = await novoCanal(s)
        const a = await video(s, c, 30)
        await registro(s, a, ['x', 'y', 'z'])
        const l = (await lerLinhasDoCaminho(sb, s, new Date(), await tok(s))).find((x) => x.videoId === a.id)!
        const p = versoesDoDia14(l.registro!)
        expect(p.tipo).toBe('versoes')
        if (p.tipo === 'versoes') expect(p.versoes.map((x) => x.letra)).toEqual(['A', 'B', 'C'])
      })
    })
  })
})
