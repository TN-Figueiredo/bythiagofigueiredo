// @vitest-environment node
/**
 * A5 · S4 (T10): tabelas yt_watch_* contra Postgres de verdade (CHECKs, gravação atômica, deduplicação de miniatura).
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-s4-watch-schema.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { paraLinhas, type LinhaLeitura, type LinhaThumb } from '@/lib/youtube/watch/expansor'
import type { ResultadoLeitor } from '@/lib/youtube/watch/leitor'
import type { AlvoAtivo } from '@/lib/youtube/watch/alvos'
import { gravarComDegrau, type PayloadDisparo } from '@/lib/youtube/watch/gravar'
import { mulberry32, gerar } from '../fixtures/watch-html/gerador'
import { CASOS_RECUSADOS, leituraValida, thumbValida } from '../fixtures/watch-html/casos-recusados'

vi.setConfig({ testTimeout: 120_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const COLUNAS_LEITURA = ['site_id', 'youtube_video_id', 'lida_em', 'rodada_id', 'origem_rede', 'versao_leitor', 'http', 'erro', 'idioma', 'titulo_oficial',
  'titulo_oficial_fonte', 'titulo_exibido', 'renderers_presentes', 'titulos_divergentes', 'rendicoes_sqp', 'jogador_bloqueado'] as const
const COLUNAS_THUMB = ['site_id', 'youtube_video_id', 'host', 'variante', 'http', 'etag', 'sha16', 'dhash', 'largura', 'altura'] as const

describe.skipIf(skipIfNoLocalDb())('A5 S4: yt_watch_* (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      for (let i = 0; i < 8 && sites.length > 0; i++) {
        try { await pg.query('delete from public.sites where id = any($1::uuid[])', [sites]); break } catch (e) {
          if ((e as { code?: string }).code !== '40P01' || i >= 7) throw e
          await new Promise(r => setTimeout(r, 150 * (i + 1)))
        }
      }
    } finally { await pg.end() }
  })

  async function novoSite(): Promise<string> {
    const s = (await seedSite(sb, { siteSlug: 's4-' + randomUUID(), siteName: 'S4 teste' })).siteId
    sites.push(s)
    return s
  }
  const n = async (sql: string, args: unknown[]): Promise<number> => Number((await pg.query(sql, args)).rows[0].n)
  const contar = (tabela: string, site: string): Promise<number> => n(`select count(*)::int as n from public.${tabela} where site_id = $1`, [site])

  function valoresJson(l: object, colunas: readonly string[]): unknown[] {
    const o = l as Record<string, unknown>
    return colunas.map(c => (c === 'titulos_divergentes' && o[c] !== null && o[c] !== undefined ? JSON.stringify(o[c]) : o[c] ?? null))
  }
  async function inserirLeitura(l: object, site: string): Promise<void> {
    const vals = valoresJson({ ...l, site_id: site }, COLUNAS_LEITURA)
    await pg.query(`insert into public.yt_watch_readings (${COLUNAS_LEITURA.join(', ')}) values (${COLUNAS_LEITURA.map((_, i) => '$' + (i + 1)).join(', ')})`, vals)
  }
  async function inserirThumb(t: LinhaThumb, site: string): Promise<void> {
    const vals = valoresJson({ ...t, site_id: site }, COLUNAS_THUMB)
    await pg.query(`insert into public.yt_watch_thumbs (${COLUNAS_THUMB.join(', ')}, primeira_vista, ultima_vista) values (${COLUNAS_THUMB.map((_, i) => '$' + (i + 1)).join(', ')}, $${COLUNAS_THUMB.length + 1}, $${COLUNAS_THUMB.length + 1})`, [...vals, t.vista_em])
  }
  async function codigoDoErro(f: () => Promise<void>): Promise<string | undefined> {
    try { await f() } catch (e) { return (e as { code?: string }).code }
    return undefined
  }

  /** Monta o `p` do RPC como o gravador da T12 faz: uma miniatura por k, as leituras apontam para ela. */
  function disparo(rs: readonly ResultadoLeitor[], site: string): { p: { thumbs: LinhaThumb[]; leituras: LinhaLeitura[] }; fora: number } {
    const thumbs: LinhaThumb[] = []; const leituras: LinhaLeitura[] = []; let fora = 0
    rs.forEach((r, i) => {
      const x = paraLinhas(r, site, i + 1)
      if (x.foraDoFormato) fora++
      if (x.thumb !== null) thumbs.push(x.thumb)
      leituras.push(x.leitura)
    })
    return { p: { thumbs, leituras }, fora }
  }

  describe('B1: o banco recusa o que o Zod recusa', () => {
    it.each(CASOS_RECUSADOS.map(c => [c.nome, c] as const))('%s -> 23514', async (_nome, c) => {
      const site = await novoSite()
      const cod = await codigoDoErro(() => (c.alvo === 'leitura' ? inserirLeitura(c.linha as object, site) : inserirThumb(c.linha as LinhaThumb, site)))
      expect(cod).toBe('23514')
    })

    it('controle: a leitura e a miniatura válidas das fixtures entram', async () => {
      const site = await novoSite()
      await inserirLeitura(leituraValida(), site)
      await inserirThumb(thumbValida(), site)
      expect(await contar('yt_watch_readings', site)).toBe(1)
      expect(await contar('yt_watch_thumbs', site)).toBe(1)
    })

    it("titulos_divergentes: elemento JSON null e elemento 'null' (string) caem; o TEXTO 'null' dentro de um objeto passa", async () => {
      const site = await novoSite()
      const base = { ...leituraValida(), titulo_exibido: null }
      expect(await codigoDoErro(() => inserirLeitura({ ...base, titulos_divergentes: [null] }, site))).toBe('23514')
      expect(await codigoDoErro(() => inserirLeitura({ ...base, titulos_divergentes: ['null'] }, site))).toBe('23514')
      await inserirLeitura({ ...base, titulos_divergentes: [{ renderer: 'r', texto: 'null' }, { renderer: 's', texto: null }] }, site)
      expect(await contar('yt_watch_readings', site)).toBe(1)
    })

    it('as 300 leituras do gerador de A11, por paraLinhas -> yt_watch_gravar_disparo: nenhum erro', async () => {
      const site = await novoSite()
      const rs = gerar(mulberry32(11), 300).map((r, i): ResultadoLeitor => {
        const l = r.leitura
        if (i % 5 === 0) return { ...r, leitura: { ...l, erro: 'timeout', tituloOficial: 'Oficial', titulo_oficial_fonte: 'og_title', idioma: 'es-419' } }
        if (i % 5 === 1) return { ...r, leitura: { ...l, idioma: 'es-419', miniaturas: [{ url: 'https://i.ytimg.com/vi/x/h.jpg', host: 'i.ytimg.com', variante: 'a'.repeat(30), largura: 10, altura: 10, http: 200, etag: 'e'.repeat(150), sha16: null, dhash: null }] } }
        if (i % 5 === 2) return { ...r, leitura: { ...l, miniaturas: [{ url: 'https://i.ytimg.com/vi/x/H.jpg', host: 'i.ytimg.com', variante: 'HQ', largura: null, altura: null, http: null, etag: null, sha16: null, dhash: null }] } }
        return r
      })
      const { p, fora } = disparo(rs, site)
      expect(fora).toBeGreaterThan(0)
      const { data, error } = await sb.rpc('yt_watch_gravar_disparo', { p })
      expect(error).toBeNull()
      expect(data).toMatchObject({ leituras: 300, thumbs: p.thumbs.length })
      expect(await contar('yt_watch_readings', site)).toBe(300)
      expect(await n(`select count(*)::int as n from public.yt_watch_readings where site_id = $1 and erro = 'fora_do_formato'`, [site])).toBe(fora)
    })

    it('16 leituras com 1 inválida injetada sem passar por linhaCabeNoBanco: o RPC único falha (classe 23), o degrau grava as 15 e a inválida recebe proxima_rodada_em + 20 min', async () => {
      const site = await novoSite()
      const ids = Array.from({ length: 16 }, (_, i) => 'dg' + String(i).padStart(9, '0'))
      const antes = new Date(Date.now() - 60_000)
      const alvos: AlvoAtivo[] = []
      for (const [i, yt] of ids.entries()) {
        const r = await pg.query(
          `insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em)
           values ($1, $2, 'concorrente', 'janela_concorrente', now() + interval '10 days', $3, $4) returning id`,
          [site, yt, i, antes.toISOString()],
        )
        alvos.push({ id: Number(r.rows[0].id), siteId: site, ytId: yt, horaBaseMin: i, rodadasPorDia: 4, proximaRodadaEm: antes.toISOString(),
          coletaAte: new Date(Date.now() + 10 * 86_400_000).toISOString(), motivoAte: 'janela_concorrente', extensoesCurtas: 0, indisponivelSeguidas: 0, rodadas: 0, temTesteNosso: false })
      }
      const ruim = 7
      const leituras: LinhaLeitura[] = ids.map((yt, i) => ({
        ...leituraValida(), site_id: site, youtube_video_id: yt, rodada_id: randomUUID(), ...(i === ruim ? { http: 99 } : {}),
      }))
      const payload: PayloadDisparo = { thumbs: [], leituras, alvos: alvos.map(a => ({ id: a.id, rodadas_mais: 1, ultima_rodada_em: antes.toISOString() })) }

      const direto = await sb.rpc('yt_watch_gravar_disparo', { p: payload })
      expect(direto.error?.code?.startsWith('23')).toBe(true)
      expect(await contar('yt_watch_readings', site)).toBe(0)

      const r = await gravarComDegrau(sb, payload, { agora: Date.now, ateMs: Date.now() + 83_000, alvos })
      expect(r).toMatchObject({ ok: false, degrau: true })
      expect(await contar('yt_watch_readings', site)).toBe(15)
      expect(await n(`select count(*)::int as n from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [site, ids[ruim]])).toBe(0)
      expect(await n(`select count(*)::int as n from public.yt_watch_alvos where site_id = $1 and rodadas = 1`, [site])).toBe(15)
      const a = (await pg.query(`select rodadas, proxima_rodada_em from public.yt_watch_alvos where id = $1`, [alvos[ruim]!.id])).rows[0]
      expect(a.rodadas).toBe(0)
      const delta = new Date(a.proxima_rodada_em).getTime() - antes.getTime()
      expect(delta).toBeGreaterThanOrEqual(20 * 60_000)
      expect(delta).toBeLessThanOrEqual(23 * 60_000)
    })


    it('um lote de 10 com 1 fora_do_formato grava as 10', async () => {
      const site = await novoSite()
      const rs = gerar(mulberry32(5), 10)
      rs[3] = { ...rs[3]!, leitura: { ...rs[3]!.leitura, origemRede: 'nuvem' } }
      const { p, fora } = disparo(rs, site)
      expect(fora).toBe(1)
      const { data, error } = await sb.rpc('yt_watch_gravar_disparo', { p })
      expect(error).toBeNull()
      expect(data).toMatchObject({ leituras: 10 })
      expect(await contar('yt_watch_readings', site)).toBe(10)
      expect(await n(`select count(*)::int as n from public.yt_watch_readings where site_id = $1 and erro = 'fora_do_formato'`, [site])).toBe(1)
    })
  })

  describe('B3: atomicidade e deduplicação', () => {
    async function alvo(site: string, yt: string): Promise<number> {
      return Number((await pg.query(
        `insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em)
         values ($1, $2, 'proprio', 'janela_propria', now() + interval '10 days', 100, now()) returning id`, [site, yt])).rows[0].id)
    }

    it('leitura de rodada_id inválido no fim: nada gravado (miniaturas, leituras) e o alvo fica intacto', async () => {
      const site = await novoSite()
      const id = await alvo(site, 'qIg9a7vqcNo')
      const ok = leituraValida()
      const p = {
        thumbs: [{ ...thumbValida(), site_id: site }],
        leituras: [{ ...ok, site_id: site, thumb_k: 1 }, { ...ok, site_id: site, lida_em: '2026-10-18T12:05:00.000Z' }, { ...ok, site_id: site, rodada_id: 'nao-e-uuid' }],
        alvos: [{ id, rodadas_mais: 1, ultima_rodada_em: '2026-10-18T12:00:00.000Z', proxima_rodada_em: '2026-10-19T12:00:00.000Z' }],
      }
      const r = await sb.rpc('yt_watch_gravar_disparo', { p })
      expect(r.error).not.toBeNull()
      expect(await contar('yt_watch_readings', site)).toBe(0)
      expect(await contar('yt_watch_thumbs', site)).toBe(0)
      const a = (await pg.query('select rodadas, ultima_rodada_em from public.yt_watch_alvos where id = $1', [id])).rows[0]
      expect(a.rodadas).toBe(0)
      expect(a.ultima_rodada_em).toBeNull()
    })

    it('a mesma miniatura 2 vezes: 1 linha com vistas 2, as duas leituras apontam para ela', async () => {
      const site = await novoSite()
      const ok = leituraValida()
      const p = {
        thumbs: [{ ...thumbValida(), site_id: site, k: 1 }, { ...thumbValida(), site_id: site, k: 2, vista_em: '2026-10-18T13:00:00.000Z' }],
        leituras: [{ ...ok, site_id: site, thumb_k: 1 }, { ...ok, site_id: site, thumb_k: 2, lida_em: '2026-10-18T13:00:00.000Z' }],
      }
      const r = await sb.rpc('yt_watch_gravar_disparo', { p })
      expect(r.error).toBeNull()
      const t = (await pg.query('select id, vistas, primeira_vista, ultima_vista from public.yt_watch_thumbs where site_id = $1', [site])).rows
      expect(t).toHaveLength(1)
      expect(t[0].vistas).toBe(2)
      expect(new Date(t[0].ultima_vista).getTime()).toBeGreaterThan(new Date(t[0].primeira_vista).getTime())
      const ids = (await pg.query('select distinct miniatura_id from public.yt_watch_readings where site_id = $1', [site])).rows
      expect(ids.map(x => String(x.miniatura_id))).toEqual([String(t[0].id)])
    })
  })
})
