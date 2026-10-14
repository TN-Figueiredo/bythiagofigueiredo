// @vitest-environment node
/**
 * A5 · E10 (Tarefa 10, itens 78, 81 e 231): a lista fechada do que apaga, parte de integração. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e10-lista-fechada.test.ts --no-file-parallelism
 * Cada teste abre uma transação, aplica o ensaio da MG6 e termina em `rollback`.
 *
 * Lê do catálogo toda função de `public` com `delete from` cujo nome começa por `competitor_`, `yt_`, `youtube_channel_` ou `obs_` e casa cada
 * (função, tabela) com a lista abaixo. Função com `delete` fora da lista falha; par da lista sem função falha. A lista é a F17 da reconciliação,
 * mais as funções que nasceram depois. Parte de teste, de propósito, redundante com a revisão de migration: é o que impede um `delete` novo de
 * entrar numa função de passagem sem alguém decidir a classe dele.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { emTransacao, escalar, q1, tenta, semearCena, type Cena } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

interface Par {
  funcao: string
  tabela: string
  /** Linha de 9.2 do spec, ou o motivo (função nascida depois do spec). */
  linha: string
  disparo: 'cron' | 'dono' | 'coleta' | 'agenda'
}

const LISTA: Par[] = [
  // MG6 (esta etapa)
  { funcao: 'competitor_channel_remove_archived', tabela: 'competitor_channels', linha: '2', disparo: 'dono' },
  { funcao: 'obs_archive_register', tabela: 'obs_archive_batches', linha: '15', disparo: 'dono' },
  // canal de concorrente: agenda e comentários
  { funcao: 'competitor_agenda_lease_release', tabela: 'competitor_agenda_lease', linha: '3 (estado de execução, MG10)', disparo: 'agenda' },
  { funcao: 'competitor_comment_identity_purge', tabela: 'competitor_video_comment_authors', linha: '6 (identidade de autor vence em 30 dias, LGPD; não apaga texto nem série)', disparo: 'cron' },
  // canal próprio: remoção pelo dono
  { funcao: 'youtube_channel_remove', tabela: 'ab_tests', linha: '9 (remoção de canal próprio)', disparo: 'dono' },
  { funcao: 'youtube_channel_remove', tabela: 'optimization_cycles', linha: '9', disparo: 'dono' },
  { funcao: 'youtube_channel_remove', tabela: 'youtube_channels', linha: '9', disparo: 'dono' },
  { funcao: 'youtube_channel_remove', tabela: 'youtube_sync_log', linha: '9', disparo: 'dono' },
  { funcao: 'youtube_channel_remove', tabela: 'youtube_videos', linha: '9', disparo: 'dono' },
  { funcao: 'youtube_channel_remove', tabela: 'yt_notifications', linha: '9', disparo: 'dono' },
  // canal próprio: regravação do dia pela coleta (apaga e regrava o MESMO recorte, nunca por idade)
  { funcao: 'yt_own_daily_apply', tabela: 'yt_own_video_daily', linha: '11 (MG14: regrava o dia)', disparo: 'coleta' },
  { funcao: 'yt_own_daily_apply', tabela: 'yt_own_video_coverage', linha: '11', disparo: 'coleta' },
  { funcao: 'yt_own_dim_apply', tabela: 'yt_own_video_dim_daily', linha: '14 (MG7: regrava o dia)', disparo: 'coleta' },
  { funcao: 'yt_own_dim_cover_idle', tabela: 'yt_own_video_dim_daily', linha: '14', disparo: 'coleta' },
  { funcao: 'yt_own_dim_coverage_extend', tabela: 'yt_own_video_coverage', linha: '14', disparo: 'coleta' },
  { funcao: 'yt_own_reach_dim_apply', tabela: 'yt_own_video_reach_dim_daily', linha: '14', disparo: 'coleta' },
  { funcao: 'yt_own_traffic_detail_apply', tabela: 'yt_own_video_traffic_detail_daily', linha: '14', disparo: 'coleta' },
  // fase de manutenção, M1 (pedido 8; disparo: cron; classe: estado de execução): `20261014000001_manutencao_m1_podas_execucao.sql`, aplicada no `bythiago_int` fora de transação.
  { funcao: 'yt_own_collection_attempts_purge', tabela: 'yt_own_collection_attempts', linha: 'manutenção, pedido 8 (estado de execução)', disparo: 'cron' },
]

/** Item 78: nenhuma série, versão, texto de comentário ou bruto sai por cron nem por idade. */
const PROIBIDAS = [
  'competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly', 'competitor_video_versions', 'competitor_field_versions',
  'competitor_raw', 'competitor_video_comments', 'competitor_channel_snapshots', 'yt_reporting_report_blobs', 'yt_own_video_daily',
]

const DELETES_SQL = `
  select p.proname as funcao, m[1] as tabela
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral regexp_matches(pg_get_functiondef(p.oid), 'delete\\s+from\\s+(?:only\\s+)?(?:public\\.)?([a-z_0-9]+)', 'gi') m
   where n.nspname = 'public' and p.prokind = 'f'
     and p.proname ~ '^(competitor_|yt_|youtube_channel_|obs_)'
   group by 1, 2
   order by 1, 2`

describe.skipIf(skipIfNoLocalDb())('A5 E10 T10: a lista fechada do que apaga (catálogo do banco, ensaio dentro de transação desfeita)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  it('toda função com delete tem par e todo par tem função', async () => {
    await emTransacao(pg, async () => {
      const achadas = (await pg.query(DELETES_SQL)).rows as { funcao: string; tabela: string }[]
      const chaves = new Set(achadas.map(a => `${a.funcao}::${a.tabela}`))
      const daLista = new Set(LISTA.map(p => `${p.funcao}::${p.tabela}`))
      expect([...chaves].filter(k => !daLista.has(k)).sort(), 'delete em função fora da lista: classifique-o de propósito').toEqual([])
      const semFuncao = LISTA.filter(p => !chaves.has(`${p.funcao}::${p.tabela}`))
      expect(semFuncao.map(p => `${p.funcao}::${p.tabela}`), 'par da lista sem função').toEqual([])
    })
  })

  it('o teste enxerga: uma função com delete fora da lista é acusada', async () => {
    await emTransacao(pg, async () => {
      await pg.query(`create function public.obs_e10_ruim() returns void language sql as $f$ delete from public.competitor_video_daily where false $f$`)
      const achadas = (await pg.query(DELETES_SQL)).rows as { funcao: string; tabela: string }[]
      const daLista = new Set(LISTA.map(p => `${p.funcao}::${p.tabela}`))
      expect(achadas.map(a => `${a.funcao}::${a.tabela}`).filter(k => !daLista.has(k))).toEqual(['obs_e10_ruim::competitor_video_daily'])
    })
  })

  it('nenhuma função de cron ou de agenda da lista aponta para tabela de série, versão, texto de comentário ou bruto', () => {
    const ruins = LISTA.filter(p => (p.disparo === 'cron' || p.disparo === 'agenda') && PROIBIDAS.includes(p.tabela))
    expect(ruins).toEqual([])
    // yt_own_video_daily é apagada pela regravação do mesmo dia (disparo "coleta"): a classe é declarada, não ignorada
    expect(LISTA.filter(p => PROIBIDAS.includes(p.tabela)).every(p => p.disparo === 'coleta')).toBe(true)
  })

  it('24 meses depois nada de série foi apagado (itens 78 e 67): toda função de cron da lista, com o relógio adiantado', async () => {
    await emTransacao(pg, async () => {
      const cena: Cena = await semearCena(pg)
      const video = cena.videoA
      // 30 meses atrás, nas três séries e nas versões
      await pg.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date - 900, 7, now() - interval '900 days')`, [video])
      await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, date_trunc('hour', now() - interval '900 days'), date_trunc('hour', now() - interval '900 days'), $2, 7)`, [video, cena.site])
      await pg.query(`insert into public.competitor_video_early (video_id, taken_at, site_id, views) values ($1, now() - interval '900 days', $2, 7)`, [video, cena.site])
      await pg.query(`insert into public.competitor_channel_snapshots (competitor_channel_id, snapshot_date, subscriber_count) values ($1, current_date - 900, 5)`, [cena.canalA])
      await pg.query(`insert into public.competitor_video_versions (video_id, field, value_hash, precision, first_seen_at, last_seen_at, is_current) values ($1, 'title', 'velha', '1d', now() - interval '900 days', now() - interval '899 days', false)`, [video])

      const contar = async (): Promise<Record<string, number>> => {
        const saida: Record<string, number> = {}
        for (const t of PROIBIDAS) {
          if (!(await escalar<string | null>(pg, `select to_regclass('public.' || $1)::text`, [t]))) continue
          saida[t] = await escalar<number>(pg, `select count(*)::int from public.${t}`)
        }
        return saida
      }
      const antes = await contar()
      expect(antes.competitor_video_daily).toBeGreaterThan(0)
      expect(antes.competitor_video_hourly).toBeGreaterThan(0)
      expect(antes.competitor_video_early).toBeGreaterThan(0)
      expect(antes.competitor_channel_snapshots).toBeGreaterThan(0)

      // as funções de cron da lista, com o relógio em hoje + 24 meses (as que aceitam instante) ou como estão (as outras)
      const daqui24 = `now() + interval '24 months'`
      const chamadas: Array<{ funcao: string; sql: string }> = [
        { funcao: 'yt_own_collection_attempts_purge', sql: `select public.yt_own_collection_attempts_purge(90, 5000, 20, ${daqui24})` },
        { funcao: 'competitor_comment_identity_purge', sql: `select public.competitor_comment_identity_purge(null)` },
        { funcao: 'yt_reporting_blobs_purge', sql: `select public.yt_reporting_blobs_purge(array['x'])` },
      ]
      const cronDaLista = LISTA.filter(p => p.disparo === 'cron').map(p => p.funcao)
      expect(chamadas.filter(c => cronDaLista.includes(c.funcao)).length, 'toda função de cron da lista tem chamada neste teste').toBeGreaterThan(0)
      for (const f of cronDaLista) expect(chamadas.map(c => c.funcao), `${f} sem chamada de 24 meses`).toContain(f)
      for (const c of chamadas) {
        const existe = await escalar<boolean>(pg, `select exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = $1)`, [c.funcao])
        if (!existe) continue // M1 ainda não aplicada neste banco: o par vale pelo texto da migration (teste anterior)
        const r = await tenta(pg, c.sql)
        expect(r.ok, `${c.funcao}: ${r.ok ? '' : r.message}`).toBe(true)
      }
      expect(await contar()).toEqual(antes)
    })
  }, 60_000)

  it('limpeza do bruto: 0 (item 81), também com o relógio adiantado em 24 meses', async () => {
    await emTransacao(pg, async () => {
      const corpoSemDelete = await escalar<boolean>(pg, `select p.prosrc !~* 'delete' from pg_proc p where p.oid = 'public.yt_reporting_blobs_purge(text[])'::regprocedure`)
      expect(corpoSemDelete).toBe(true)
      const r = await q1(pg, `select public.yt_reporting_blobs_purge(array['x']) as n`)
      expect(Number(r.n)).toBe(0)
    })
  })
})
