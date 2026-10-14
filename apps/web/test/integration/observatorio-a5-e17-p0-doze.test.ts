// @vitest-environment node
/**
 * A5 · E17 passo 0 (MG11), Tarefa 3 (item 191, OP-16): a lista das doze tabelas privadas do canal próprio que passam a ser lidas
 * por `can_view_private_site(site_id)`, e as exceções, pelo nome. Cada `it` aplica a MG11 numa transação (`garantirMg11`),
 * lê o catálogo e DESFAZ. Nada fica gravado. Banco: SÓ o `bythiago_int` (fora da CI):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e17-p0-doze.test.ts --no-file-parallelism
 * Erro 55P03 ou `lock_timeout` = banco ocupado por outro teste: esperar um minuto e repetir.
 *
 * ESTE TESTE FICA VERMELHO DE PROPÓSITO quando uma trilha cria tabela `yt_own_*` (ou view) e não a classifica aqui: quem cria o
 * objeto edita a lista no mesmo commit, com a frase da classe. É o que o item 191 pede ("tabela nova sem classificação derruba").
 *
 * Os três bancos (emenda 1: S-I2): (1) `bythiago_int` tem também as tabelas de ensaio dos lotes B e C; (2) a CI de hoje só tem o
 * que está em `supabase/migrations/`; (3) a CI depois do lote C tem as doze, menos o que a MG12 ainda não tiver criado. A regra
 * "o que existe tem de estar classificado e certo" vale nos três. "Ausente" só é aceito pela lista PODEM_FALTAR.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg11 } from '../helpers/mg11'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** As doze: leitura por can_view_private_site(site_id) depois da MG11. */
const DOZE = [
  'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_coverage',
  'yt_own_video_retention', 'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily',
  'yt_own_video_versions', 'yt_own_versions_state', 'competitor_video_comments', 'competitor_video_comment_marks',
] as const

/** Exceção 1: continuam em can_edit_site(site_id). Só quem edita lê (diagnóstico de coleta, texto de comentário de outro canal, resposta crua, relatórios em fila). */
const EM_EDICAO = ['yt_own_collection_attempts', 'competitor_video_comment_authors', 'competitor_raw', 'yt_reporting_reports', 'yt_reporting_jobs'] as const
/** Exceção 2: continuam em can_view_site(site_id). Dado de vídeo PÚBLICO (visualizações por hora de vídeo público): quem vê o site vê. */
const EM_LEITURA_DO_SITE = ['yt_own_public_video_hourly', 'yt_own_public_video_early', 'yt_own_public_hour_map', 'yt_own_public_hour_fold_log'] as const
/** Exceção 3: RLS ligada e NENHUMA policy: só a service role lê. A última é a cópia de segurança da MG15 (classificação que a OP-16 pede). */
const SEM_POLICY = ['yt_own_collection_runs', 'yt_reporting_report_blobs', 'yt_own_video_daily_zeros_bkp'] as const

/**
 * Pode faltar no banco do teste (dado ausente aceito): as duas da MG12 e a cópia da MG15 ainda não existem em nenhum banco
 * (nem em produção, nem em `supabase/migrations/`). A Tarefa 11 encolhe esta lista no commit do envio.
 */
const PODEM_FALTAR: readonly string[] = ['yt_own_video_versions', 'yt_own_versions_state', 'yt_own_video_daily_zeros_bkp']

const CLASSIFICADAS: readonly string[] = [...DOZE, ...EM_EDICAO, ...EM_LEITURA_DO_SITE, ...SEM_POLICY]

describe.skipIf(skipIfNoLocalDb())('A5 E17 passo 0 (MG11): a lista das doze e as exceções (item 191, OP-16)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    await pg.end()
  })

  async function emTransacao<T>(corpo: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      await garantirMg11(pg)
      return await corpo()
    } finally {
      await pg.query('rollback')
    }
  }

  interface Linha { cmd: string; qual: string | null; policyname: string }
  async function policiesDe(t: string): Promise<Linha[]> {
    const r = await pg.query<Linha>(`select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = $1 order by policyname`, [t])
    return r.rows
  }
  async function existe(t: string): Promise<boolean> {
    return (await pg.query<{ e: boolean }>(`select to_regclass('public.' || $1::text) is not null as e`, [t])).rows[0].e
  }
  async function rlsLigada(t: string): Promise<boolean> {
    return (await pg.query<{ r: boolean }>(`select relrowsecurity as r from pg_class where oid = to_regclass('public.' || $1::text)`, [t])).rows[0].r
  }
  async function dasDozeQueExistem(): Promise<string[]> {
    const lista: string[] = []
    for (const t of DOZE) if (await existe(t)) lista.push(t)
    return lista
  }

  it('dado ausente: banco sem nenhuma das doze falha (banco errado), não passa vazio', async () => {
    await emTransacao(async () => {
      const lista = await dasDozeQueExistem()
      expect(lista.length, 'nenhuma tabela da lista existe: banco errado').toBeGreaterThan(0)
    })
  })

  it('cada uma das doze que existe tem exatamente uma policy, <tabela>_select, de SELECT, com can_view_private_site(site_id)', async () => {
    await emTransacao(async () => {
      for (const t of await dasDozeQueExistem()) {
        const p = await policiesDe(t)
        expect(p.map((x) => [x.policyname, x.cmd, x.qual]), t).toEqual([[`${t}_select`, 'SELECT', 'can_view_private_site(site_id)']])
      }
    })
  })

  it('nenhuma das doze ficou em can_edit_site', async () => {
    await emTransacao(async () => {
      for (const t of await dasDozeQueExistem()) {
        for (const p of await policiesDe(t)) expect(String(p.qual), `${t}: ${p.policyname}`).not.toMatch(/can_edit_site/)
      }
    })
  })

  it('nenhuma das doze tem policy de escrita (insert, update, delete ou all)', async () => {
    await emTransacao(async () => {
      for (const t of await dasDozeQueExistem()) {
        expect((await policiesDe(t)).filter((p) => p.cmd !== 'SELECT').map((p) => p.policyname), t).toEqual([])
      }
    })
  })

  it('as exceções, pelo nome: cinco em can_edit_site, quatro em can_view_site, três sem policy e com RLS ligada', async () => {
    expect(EM_EDICAO).toHaveLength(5)
    expect(EM_LEITURA_DO_SITE).toHaveLength(4)
    expect(SEM_POLICY).toHaveLength(3)
    await emTransacao(async () => {
      for (const t of EM_EDICAO) {
        if (!(await existe(t))) continue
        expect((await policiesDe(t)).map((p) => [p.policyname, p.cmd, p.qual]), t).toEqual([[`${t}_select`, 'SELECT', 'can_edit_site(site_id)']])
      }
      for (const t of EM_LEITURA_DO_SITE) {
        if (!(await existe(t))) continue
        expect((await policiesDe(t)).map((p) => [p.policyname, p.cmd, p.qual]), t).toEqual([[`${t}_select`, 'SELECT', 'can_view_site(site_id)']])
      }
      for (const t of SEM_POLICY) {
        if (!(await existe(t))) continue
        expect(await policiesDe(t), `${t}: nenhuma policy`).toEqual([])
        expect(await rlsLigada(t), `${t}: RLS ligada`).toBe(true)
      }
    })
  })

  it('toda tabela yt_own_* de public está na lista das doze ou nas exceções (tabela nova sem classificação derruba, com o nome)', async () => {
    await emTransacao(async () => {
      const r = await pg.query<{ relname: string }>(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname like 'yt\\_own\\_%' and c.relkind in ('r', 'p', 'v', 'm') order by 1`,
      )
      const semClasse = r.rows.map((x) => x.relname).filter((n) => !CLASSIFICADAS.includes(n))
      expect(semClasse, `tabela(s) yt_own_* sem classificação neste teste: ${semClasse.join(', ')}. Classificar na lista das doze ou nas exceções, no mesmo commit que a cria`).toEqual([])
    })
  })

  it('tabela ausente só é aceita se estiver em PODEM_FALTAR', async () => {
    await emTransacao(async () => {
      const ausentes: string[] = []
      for (const t of CLASSIFICADAS) if (!(await existe(t))) ausentes.push(t)
      const naoAceitas = ausentes.filter((t) => !PODEM_FALTAR.includes(t))
      expect(naoAceitas, `ausente(s) fora de PODEM_FALTAR: ${naoAceitas.join(', ')}`).toEqual([])
    })
  })

  it('as listas não se sobrepõem e somam 12 + 5 + 4 + 3', () => {
    const todas = [...DOZE, ...EM_EDICAO, ...EM_LEITURA_DO_SITE, ...SEM_POLICY]
    expect(new Set(todas).size).toBe(todas.length)
    expect(todas).toHaveLength(24)
  })
})
