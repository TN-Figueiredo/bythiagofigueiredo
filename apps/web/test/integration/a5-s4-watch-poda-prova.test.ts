// @vitest-environment node
/**
 * A5 · S4 (T10, B4 e B5): yt_watch_poda e yt_watch_prova contra Postgres de verdade.
 * A prova olha o banco inteiro (tabelas yt_watch_* e as execuções da tarefa leitura_watch): cada caso começa limpando-as.
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-s4-watch-poda-prova.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { travarS4, destravarS4 } from '../helpers/a5-s4-trava'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 300_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HORA = 3_600_000
const DIA = 24 * HORA

interface Motivos { leitura_bloqueada: boolean | null; layout_mudou: boolean | null; rodadas_faltando: boolean | null; sem_alvos: boolean | null; capacidade_curta: boolean | null; oficial_sumiu: boolean | null }
interface Prova {
  alvos_ativos: number; alvos_atrasados: number; menos_de_3_rodadas_24h: number; leituras_24h: number
  demanda_rodadas_dia: number; capacidade_razao: number | null; capacidade_rodadas_dia: number; concorrentes_30d: number
  coleta_desde: string | null; motivos: Motivos
}

describe.skipIf(skipIfNoLocalDb())('A5 S4 B4/B5: poda e prova (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let site = ''
  const sites: string[] = []
  const iso = (ms: number): string => new Date(ms).toISOString()
  let AGORA = 0

  async function comRepeticao(sql: string, args: unknown[]): Promise<void> {
    for (let i = 0; ; i++) {
      try { await pg.query(sql, args); return } catch (e) {
        if ((e as { code?: string }).code !== '40P01' || i >= 8) throw e
        await new Promise(r => setTimeout(r, 150 * (i + 1) + Math.random() * 200))
      }
    }
  }
  async function comRepeticaoDe(acao: () => Promise<void>): Promise<void> {   // mesmo laço do comRepeticao, para o helper de limpeza
    for (let i = 0; ; i++) {
      try { await acao(); return } catch (e) {
        if ((e as { code?: string }).code !== '40P01' || i >= 8) throw e
        await new Promise(r => setTimeout(r, 150 * (i + 1) + Math.random() * 200))
      }
    }
  }
  async function limpar(): Promise<void> {
    await comRepeticao('delete from public.yt_watch_readings', [])
    await comRepeticao('delete from public.yt_watch_thumbs', [])
    await comRepeticao('delete from public.yt_watch_alvos', [])
    await comRepeticao(`delete from public.competitor_agenda_runs where task = 'leitura_watch'`, [])
  }

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    await travarS4(pg)
    site = (await seedSite(sb, { siteSlug: 's4pp-' + randomUUID(), siteName: 'S4 poda/prova' })).siteId; sites.push(site)
  })
  beforeEach(async () => { AGORA = Date.now(); await limpar() })
  afterAll(async () => {
    try {
      await limpar()
      await comRepeticaoDe(() => apagarCanais(pg, 'site_id = any($1::uuid[])', [sites]))
      await comRepeticaoDe(() => apagarSites(pg, 'id = any($1::uuid[])', [sites]))
    } finally { await destravarS4(pg); await pg.end() }
  })

  const ytId = (i: number): string => String(i).padStart(11, '0')
  async function alvo(i: number, o: { saiuHa?: number; saiuPor?: string; reterAte?: number; porDia?: 1 | 4; ativoDesde?: number; proxima?: number } = {}): Promise<number> {
    const saiu = o.saiuHa === undefined ? null : iso(AGORA - o.saiuHa * DIA)
    return Number((await pg.query(
      `insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em, rodadas_por_dia, saiu_em, saiu_por, reter_ate, ativo_desde)
       values ($1, $2, 'proprio', 'janela_propria', $3, 100, $4, $5, $6, $7, $8, $9) returning id`,
      [site, ytId(i), iso(AGORA + DIA), iso(o.proxima ?? AGORA + HORA), o.porDia ?? 4, saiu, saiu === null ? null : o.saiuPor ?? 'janela',
        o.reterAte === undefined ? null : iso(o.reterAte), iso(o.ativoDesde ?? AGORA - 5 * DIA)])).rows[0].id)
  }
  /** Uma miniatura e `leituras` leituras do vídeo `i` (todas apontando para a miniatura). */
  async function leituras(i: number, quantas: number, o: { haHoras?: number; erro?: string; semTitulo?: boolean; semOficial?: boolean; rodada?: string } = {}): Promise<void> {
    const t = (await pg.query(`insert into public.yt_watch_thumbs (site_id, youtube_video_id, host, variante, http, primeira_vista, ultima_vista)
      values ($1, $2, 'i.ytimg.com', 'hqdefault', 404, now(), now()) on conflict do nothing returning id`, [site, ytId(i)])).rows[0]
    const miniatura = t === undefined ? null : t.id
    for (let k = 0; k < quantas; k++) {
      const lida = iso(AGORA - ((o.haHoras ?? 1) * HORA) - k * 60_000)
      const comErro = o.erro !== undefined
      const vazio = comErro || o.semTitulo === true
      await pg.query(`insert into public.yt_watch_readings (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, erro, idioma, titulo_oficial, titulo_oficial_fonte, titulo_exibido, renderers_presentes, miniatura_id)
        values ($1, $2, $3, $4, 'vercel', 1, 200, $5, $6, $7, $8, $9, $10, $11)`,
      [site, ytId(i), lida, o.rodada ?? randomUUID(), o.erro ?? null, vazio ? null : 'pt-BR',
        vazio || o.semOficial ? null : 'Título', vazio || o.semOficial ? null : 'videoDetails', vazio ? null : 'Título', vazio ? 0 : 7, miniatura])
    }
  }
  async function execucoes(deHoras: number, ateHoras: number): Promise<void> {
    for (let h = deHoras; h >= ateHoras; h--) {
      await pg.query(`insert into public.competitor_agenda_runs (task, period_key, status, started_at) values ('leitura_watch', $1, 'ok', $2)`, ['p' + h, iso(AGORA - h * HORA)])
    }
  }
  async function prova(ligada: boolean, esperados: number | null): Promise<Prova> {
    return (await pg.query('select public.yt_watch_prova($1, $2, $3) as r', [iso(AGORA), ligada, esperados])).rows[0].r as Prova
  }
  async function poda(lote: number): Promise<{ leituras: number; miniaturas: number; alvos: number; sobrou: boolean }> {
    return (await pg.query('select public.yt_watch_poda($1, $2) as r', [iso(AGORA), lote])).rows[0].r
  }
  const n = async (sql: string): Promise<number> => Number((await pg.query(sql, [site])).rows[0].n)
  const nLeituras = (i: number): Promise<number> => n(`select count(*)::int as n from public.yt_watch_readings where site_id = $1 and youtube_video_id = '${ytId(i)}'`)
  const nThumbs = (i: number): Promise<number> => n(`select count(*)::int as n from public.yt_watch_thumbs where site_id = $1 and youtube_video_id = '${ytId(i)}'`)
  const nAlvo = (i: number): Promise<number> => n(`select count(*)::int as n from public.yt_watch_alvos where site_id = $1 and youtube_video_id = '${ytId(i)}'`)

  describe('B4: poda', () => {
    it('alvo saído há 31 d perde leituras, miniaturas e o próprio alvo; há 29 d, não perde nada', async () => {
      await alvo(1, { saiuHa: 31 }); await leituras(1, 3, { haHoras: 800 })
      await alvo(2, { saiuHa: 29 }); await leituras(2, 3, { haHoras: 800 })
      const r = await poda(50000)
      expect(r).toMatchObject({ leituras: 3, miniaturas: 1, alvos: 1, sobrou: false })
      expect([await nLeituras(1), await nThumbs(1), await nAlvo(1)]).toEqual([0, 0, 0])
      expect([await nLeituras(2), await nThumbs(2), await nAlvo(2)]).toEqual([3, 1, 1])
    })

    it('reter_ate no futuro protege; reter_ate vencido não protege; alvo ativo nunca é podado', async () => {
      await alvo(1, { saiuHa: 31, reterAte: AGORA + HORA }); await leituras(1, 2, { haHoras: 800 })
      await alvo(2, { saiuHa: 31, reterAte: AGORA - HORA }); await leituras(2, 2, { haHoras: 800 })
      await alvo(3); await leituras(3, 2, { haHoras: 800 })
      await poda(50000)
      expect(await nLeituras(1)).toBe(2)
      expect(await nAlvo(1)).toBe(1)
      expect(await nLeituras(2)).toBe(0)
      expect(await nLeituras(3)).toBe(2)
    })

    it('alvo saído há 31 d com reter_ate da extensão (futuro) não perde leituras, e a segunda poda o preserva também', async () => {
      await alvo(1, { saiuHa: 31, reterAte: AGORA + 2 * DIA }); await leituras(1, 4, { haHoras: 800 })
      await poda(50000); await poda(50000)
      expect([await nLeituras(1), await nThumbs(1), await nAlvo(1)]).toEqual([4, 1, 1])
    })

    it('lote 2 com 3 leituras: apaga 2, sobrou true, e miniaturas e alvo ficam para a próxima', async () => {
      await alvo(1, { saiuHa: 31 }); await leituras(1, 3, { haHoras: 800 })
      const r = await poda(2)
      expect(r).toMatchObject({ leituras: 2, miniaturas: 0, alvos: 0, sobrou: true })
      expect(await nLeituras(1)).toBe(1)
      const r2 = await poda(2)
      expect(r2).toMatchObject({ leituras: 1, sobrou: false })
      expect([await nLeituras(1), await nThumbs(1), await nAlvo(1)]).toEqual([0, 0, 0])
    })

    it('p_lote fora de 1..50000 falha com 22023', async () => {
      await expect(poda(0)).rejects.toMatchObject({ code: '22023' })
      await expect(poda(50001)).rejects.toMatchObject({ code: '22023' })
    })
  })

  describe('B5: prova', () => {
    it('Phil I10: 200 alvos ativos a 4/dia -> capacidade_razao 1,44 e capacidade_curta acende', async () => {
      await pg.query(`insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em)
        select $1, lpad(g::text, 11, '0'), 'proprio', 'janela_propria', now() + interval '1 day', 100, now() + interval '1 hour' from generate_series(1, 200) g`, [site])
      const p = await prova(true, null)
      expect(p.demanda_rodadas_dia).toBe(800)
      expect(p.capacidade_rodadas_dia).toBe(1152)
      expect(Number(p.capacidade_razao)).toBe(1.44)
      expect(p.motivos.capacidade_curta).toBe(true)
    })

    it('capacidade folgada: 100 alvos a 4/dia -> razão 2,88 e capacidade_curta false', async () => {
      await pg.query(`insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em)
        select $1, lpad(g::text, 11, '0'), 'proprio', 'janela_propria', now() + interval '1 day', 100, now() + interval '1 hour' from generate_series(1, 100) g`, [site])
      const p = await prova(true, null)
      expect(Number(p.capacidade_razao)).toBe(2.88)
      expect(p.motivos.capacidade_curta).toBe(false)
    })

    it('Phil I10: demanda_rodadas_dia soma rodadas_por_dia dos ativos (o saído não conta)', async () => {
      await alvo(1); await alvo(2); await alvo(3); await alvo(4, { porDia: 1 }); await alvo(5, { porDia: 1 }); await alvo(6, { saiuHa: 1 })
      expect((await prova(true, null)).demanda_rodadas_dia).toBe(14)
    })

    it('Phil M8: concorrentes_30d vai ao detalhe e não vira motivo', async () => {
      const canal = (await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'S4') returning id`, [site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 20)])).rows[0].id
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at, discovered_at)
        values ($1, $2, now() - interval '2 days', now()), ($1, $3, now() - interval '5 days', now()), ($1, $4, now() - interval '60 days', now())`,
      [canal, 'c' + randomUUID().replace(/-/g, '').slice(0, 10), 'd' + randomUUID().replace(/-/g, '').slice(0, 10), 'e' + randomUUID().replace(/-/g, '').slice(0, 10)])
      const p = await prova(true, null)
      expect(p.concorrentes_30d).toBeGreaterThanOrEqual(2)
      expect(Object.keys(p.motivos).sort()).toEqual(['capacidade_curta', 'layout_mudou', 'leitura_bloqueada', 'oficial_sumiu', 'rodadas_faltando', 'sem_alvos'])
    })

    describe('coleta ligada e execuções de hora em hora há 30 h', () => {
      beforeEach(async () => { await execucoes(30, 1) })

      it('leitura_bloqueada: 40 leituras com erro, nenhuma boa', async () => {
        await alvo(1, { proxima: AGORA + HORA }); await leituras(1, 40, { erro: 'timeout' })
        const p = await prova(true, 1)
        expect(p.motivos.leitura_bloqueada).toBe(true)
        expect(p.motivos.layout_mudou).toBe(false)
      })

      it('layout_mudou: leituras sem erro e sem título', async () => {
        await alvo(1, { proxima: AGORA + HORA }); await leituras(1, 10, { semTitulo: true })
        const p = await prova(true, 1)
        expect(p.motivos.layout_mudou).toBe(true)
        expect(p.motivos.leitura_bloqueada).toBe(false)
      })

      it('oficial_sumiu: título exibido sem título oficial e sem jogador bloqueado', async () => {
        await alvo(1, { proxima: AGORA + HORA }); await leituras(1, 10, { semOficial: true })
        const p = await prova(true, 1)
        expect(p.motivos.oficial_sumiu).toBe(true)
        expect(p.motivos.layout_mudou).toBe(false)
      })

      it('rodadas_faltando: alvo ativo há 30 h sem nenhuma leitura', async () => {
        await alvo(1, { ativoDesde: AGORA - 30 * HORA, proxima: AGORA + HORA })
        const p = await prova(true, 1)
        expect(p.menos_de_3_rodadas_24h).toBe(1)
        expect(p.motivos.rodadas_faltando).toBe(true)
      })

      it('sem_alvos: candidatos esperados > 0 e nenhum alvo ativo', async () => {
        const p = await prova(true, 5)
        expect(p.motivos.sem_alvos).toBe(true)
      })

      it('tabela vazia + execuções há 30 h + alvos atrasados -> rodadas_faltando true', async () => {
        await alvo(1, { ativoDesde: AGORA - HORA, proxima: AGORA - 3 * HORA })
        const p = await prova(true, 1)
        expect(p.leituras_24h).toBe(0)
        expect(p.alvos_atrasados).toBe(1)
        expect(p.menos_de_3_rodadas_24h).toBe(0)
        expect(p.motivos.rodadas_faltando).toBe(true)
      })

      it('p_coleta_ligada false -> todos os motivos null', async () => {
        await alvo(1, { ativoDesde: AGORA - 30 * HORA, proxima: AGORA - 3 * HORA }); await leituras(1, 40, { erro: 'timeout' })
        const p = await prova(false, 5)
        expect(p.motivos).toEqual({ leitura_bloqueada: null, layout_mudou: null, rodadas_faltando: null, sem_alvos: null, capacidade_curta: null, oficial_sumiu: null })
      })
    })

    it('candidatos > 0, zero alvos e uma execução há 1 h -> sem_alvos true (sem cor nos outros)', async () => {
      await execucoes(1, 1)
      const p = await prova(true, 3)
      expect(p.motivos.sem_alvos).toBe(true)
      expect([p.motivos.leitura_bloqueada, p.motivos.layout_mudou, p.motivos.rodadas_faltando, p.motivos.oficial_sumiu]).toEqual([null, null, null, null])
    })

    it('zero execuções -> os motivos de coleta ficam null', async () => {
      await alvo(1, { ativoDesde: AGORA - 30 * HORA, proxima: AGORA - 3 * HORA })
      const p = await prova(true, 5)
      expect(p.coleta_desde).toBeNull()
      expect([p.motivos.leitura_bloqueada, p.motivos.layout_mudou, p.motivos.rodadas_faltando, p.motivos.sem_alvos, p.motivos.oficial_sumiu]).toEqual([null, null, null, null, null])
    })

    it('buraco de 10 h nas execuções (religada há 2 h) -> os motivos de coleta ficam null', async () => {
      await execucoes(30, 20); await execucoes(2, 1)
      await alvo(1, { ativoDesde: AGORA - 30 * HORA, proxima: AGORA - 3 * HORA })
      const p = await prova(true, 1)
      expect(new Date(p.coleta_desde!).getTime()).toBe(AGORA - 2 * HORA)
      expect([p.motivos.leitura_bloqueada, p.motivos.layout_mudou, p.motivos.rodadas_faltando, p.motivos.sem_alvos, p.motivos.oficial_sumiu]).toEqual([null, null, null, null, null])
    })
  })
})
