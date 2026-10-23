// @vitest-environment node
/**
 * F1a-dado T13: registro de purga com 32 entradas e `competitor_channel_remove_archived` que apaga as duas tabelas novas. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-native-observados-registro.test.ts --no-file-parallelism
 * Cada caso: transação com a MG6 e a F1 (registro de 30 entradas), depois as duas migrations da T13 DENTRO da transação; termina em `rollback`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { emTransacao, semearCena, exportarConferirConfirmar, q1, escalar, tenta, codigoE10, semearWatchDoVideo, type Cena } from '../helpers/mg6'

vi.setConfig({ testTimeout: 40_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))
const sqlDe = (sufixo: string): string => {
  const a = readdirSync(DIR).filter(f => f.endsWith(sufixo))
  if (a.length !== 1) throw new Error(`esperava 1 migration *${sufixo}, achei ${a.length}`)
  return readFileSync(DIR + a[0], 'utf8')
}
const NOVAS = ['ab_native_observados', 'ab_native_obs_cursor']

describe.skipIf(skipIfNoLocalDb())('F1a-dado T13: registro de purga e remoção do canal', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  /** Dentro da transação da MG6+F1: tabelas (idempotente) e registro da T13. */
  const aplicar = async (): Promise<void> => {
    await pg.query(sqlDe('_ab_native_observados.sql'))
    await pg.query(sqlDe('_ab_native_observados_registro.sql'))
  }
  const ytDe = async (video: string) => (await q1(pg, `select video_id from public.competitor_videos where id = $1`, [video])).video_id as string

  async function cena(): Promise<{ c: Cena; ytA: string; ytB: string }> {
    const c = await semearCena(pg, { semWatch: true })
    const ytA = await ytDe(c.videoA), ytB = await ytDe(c.videoB)
    await semearWatchDoVideo(pg, c.site, ytA, { leituras: 3, miniaturas: 1, alvo: true })
    await semearWatchDoVideo(pg, c.site, ytB, { leituras: 1, miniaturas: 0, alvo: true })
    for (const yt of [ytA, ytB]) {
      await pg.query(`insert into public.ab_native_observados (site_id, youtube_video_id, campo, tipo_troca, veredito, versao_regra, trocas, n_versoes, ficou, ficou_estado, primeira_troca_em)
        values ($1, $2, 'titulo', 'sequencial', 'troca_observada', 1, '[{"v":0},{"v":1}]', 2, '{"titulo":"x"}', 'em_andamento', now() - interval '3 days')`, [c.site, yt])
      await pg.query(`insert into public.ab_native_obs_cursor (site_id, youtube_video_id, avaliado_ate_rodada, avaliado_em, avaliado_motivo) values ($1, $2, 8, now() - interval '3 days', 'ok')`, [c.site, yt])
    }
    return { c, ytA, ytB }
  }
  const conta = async (site: string, yt: string) => ({
    o: await escalar<number>(pg, `select count(*)::int from public.ab_native_observados where site_id = $1 and youtube_video_id = $2`, [site, yt]),
    k: await escalar<number>(pg, `select count(*)::int from public.ab_native_obs_cursor where site_id = $1 and youtube_video_id = $2`, [site, yt]),
  })

  it('o registro passa de 30 para 32, com as duas linhas no fim e as cinco colunas; nenhuma tabela sem export', async () => {
    await emTransacao(pg, async () => {
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_registry()`)).toBe(30)
      await aplicar()
      const r = (await pg.query(`select * from public.obs_archive_registry()`)).rows as Record<string, string | null>[]
      expect(r).toHaveLength(32)
      expect(r.slice(-2).map(x => x.table_name)).toEqual(NOVAS)
      for (const x of r.slice(-2)) {
        expect(x.sum_sql).not.toBeNull()
        expect(x.order_sql).not.toBeNull()
        expect(x.filter_sql).toContain('competitor_videos')
      }
      expect(await escalar<unknown>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
    })
  })

  it('reaplicar a migration do registro uma 2ª vez é idempotente (32 de novo)', async () => {
    await emTransacao(pg, async () => {
      await aplicar(); await aplicar()
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_registry()`)).toBe(32)
    })
  })

  it('a guarda recusa um registro com número inesperado de entradas (pede reconciliação)', async () => {
    await emTransacao(pg, async () => {
      await pg.query(sqlDe('_ab_native_observados.sql'))
      await pg.query(`create or replace function public.obs_archive_registry() returns table(table_name text, filter_sql text, period_sql text, sum_sql text, order_sql text)
        language sql stable set search_path = '' as $$ values ('competitor_channels', 't.id = $1', null, null, 't.id') $$`)
      const t = await tenta(pg, sqlDe('_ab_native_observados_registro.sql').replace(/^--.*$/gm, ''))
      expect(t.ok).toBe(false)
      if (!t.ok) expect(t.message).toMatch(/esperado 30 ou 32/)
    })
  })

  it('ida e volta: arquivar e remover o canal com linhas observadas -> sucesso, contagens iguais, o controle fica', async () => {
    await emTransacao(pg, async () => {
      await aplicar()
      const { c, ytA, ytB } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-t13-ok')
      const arquivadas = await escalar<number>(pg, `select coalesce(sum(row_count), 0)::int from public.obs_archive_batches where batch = 'lote-t13-ok' and table_name = any($1::text[])`, [NOVAS])
      expect(arquivadas).toBe(2)
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])
      expect(t.ok, t.ok ? '' : t.message).toBe(true)
      if (!t.ok) return
      const r = t.rows[0]!.r as { status: string; watch: Record<string, number> }
      expect(r.status).toBe('removido')
      expect(r.watch).toMatchObject({ readings: 3, thumbs: 1, alvos: 1, observados: 1, obs_cursor: 1 })
      expect(await conta(c.site, ytA)).toEqual({ o: 0, k: 0 })
      expect(await conta(c.site, ytB)).toEqual({ o: 1, k: 1 })
      const aud = (await q1(pg, `select after_data from public.audit_log where action = 'observatorio_canal_removido_com_arquivo' and resource_id = $1`, [c.canalA])).after_data as { watch: Record<string, number> }
      expect(aud.watch).toMatchObject({ observados: 1, obs_cursor: 1 })
    })
  })

  it('sem a migration do registro (30 entradas) a remoção não conhece as tabelas: a nossa recusa só aparece com a migration aplicada (controle do teste)', async () => {
    await emTransacao(pg, async () => {
      await pg.query(sqlDe('_ab_native_observados.sql'))
      const { c, ytA } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-t13-sem')
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      // com o registro de 30 entradas as tabelas novas não estão no lote e a cascata não as toca: a remoção passa e deixa a linha órfã
      // (por isso a T13 não vai ao db:push:prod sem a migration ..._registro)
      expect(t.ok).toBe(true)
      expect((await conta(c.site, ytA)).o).toBe(1)
    })
  })

  it('vídeo compartilhado com outro canal do site: remoção recusada (E10:video_compartilhado), as duas tabelas intactas', async () => {
    await emTransacao(pg, async () => {
      await aplicar()
      const { c, ytA } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-t13-comp')
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at) values ($1, $2, 'x', now(), now())`, [c.canalB, ytA])
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) expect(codigoE10(t.message)).toBe('video_compartilhado')
      expect(await conta(c.site, ytA)).toEqual({ o: 1, k: 1 })
    })
  })

  it('troca de linha depois do export (mesma contagem, n_versoes diferente) recusa a remoção e nada some', async () => {
    await emTransacao(pg, async () => {
      await aplicar()
      const { c, ytA } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-t13-diff')
      await pg.query(`update public.ab_native_observados set n_versoes = 3 where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) expect(codigoE10(t.message)).toBe('banco_difere_do_manifesto')
      expect(await conta(c.site, ytA)).toEqual({ o: 1, k: 1 })
    })
  })

  it('as privilégios das duas funções recriadas: só service_role executa', async () => {
    await emTransacao(pg, async () => {
      await aplicar()
      for (const f of ['public.obs_archive_registry()', 'public.competitor_channel_remove_archived(uuid,uuid,uuid)', 'public.competitor_channel_delete_unarchived(uuid,uuid,uuid,text,text)', 'public.obs_unarchived_watch_sweep(timestamptz)']) {
        const r = (await pg.query(`select has_function_privilege('service_role', $1, 'execute') s, has_function_privilege('authenticated', $1, 'execute') a, has_function_privilege('anon', $1, 'execute') n`, [f])).rows[0]
        expect(r, f).toEqual({ s: true, a: false, n: false })
      }
    })
  })

  const apagarSemGuardar = (c: Cena) =>
    tenta(pg, `select public.competitor_channel_delete_unarchived($1, $2, $3, 'Canal de teste', 'entrou_por_engano') as r`, [c.site, c.canalA, c.admin])
  const preparaApagar = async (c: Cena) => {
    await pg.query(`update public.competitor_channels set added_at = now() - interval '10 days', channel_name = 'Canal de teste' where id = $1`, [c.canalA])
  }

  it('apagar sem guardar (Phil C4 / Yannis I4): apaga as trocas observadas e o cursor do canal; o controle fica; rows_deleted traz as duas chaves', async () => {
    await emTransacao(pg, async () => {
      await aplicar()
      const { c, ytA, ytB } = await cena()
      await preparaApagar(c)
      const t = await apagarSemGuardar(c)
      expect(t.ok, t.ok ? '' : t.message).toBe(true)
      if (!t.ok) return
      const r = t.rows[0]!.r as { linhas: Record<string, number> }
      expect(r.linhas).toMatchObject({ ab_native_observados: 1, ab_native_obs_cursor: 1 })
      expect(await conta(c.site, ytA)).toEqual({ o: 0, k: 0 })
      expect(await conta(c.site, ytB)).toEqual({ o: 1, k: 1 })
    })
  })

  it('apagar sem guardar sem as tabelas novas no retorno: canal sem linha observada devolve as duas chaves com zero', async () => {
    await emTransacao(pg, async () => {
      await aplicar()
      const c = await semearCena(pg, { semWatch: true })
      await preparaApagar(c)
      const t = await apagarSemGuardar(c)
      expect(t.ok, t.ok ? '' : t.message).toBe(true)
      if (t.ok) expect((t.rows[0]!.r as { linhas: Record<string, number> }).linhas).toMatchObject({ ab_native_observados: 0, ab_native_obs_cursor: 0 })
    })
  })

  it('a varredura do disparo em voo (obs_unarchived_watch_sweep) apaga o cursor/troca gravado DEPOIS do apagamento, e poupa o vídeo que voltou', async () => {
    await emTransacao(pg, async () => {
      await aplicar()
      const { c, ytA } = await cena()
      await preparaApagar(c)
      expect((await apagarSemGuardar(c)).ok).toBe(true)
      const grava = async (): Promise<void> => {
        await pg.query(`insert into public.ab_native_observados (site_id, youtube_video_id, campo, tipo_troca, veredito, versao_regra, trocas, n_versoes, ficou, ficou_estado, primeira_troca_em)
          values ($1, $2, 'titulo', 'sequencial', 'troca_observada', 1, '[{"v":0},{"v":1}]', 2, '{"titulo":"x"}', 'em_andamento', now()) on conflict do nothing`, [c.site, ytA])
        await pg.query(`insert into public.ab_native_obs_cursor (site_id, youtube_video_id, avaliado_ate_rodada, avaliado_em, avaliado_motivo) values ($1, $2, 9, now(), 'ok') on conflict do nothing`, [c.site, ytA])
      }
      await grava()
      await pg.query(`select public.obs_unarchived_watch_sweep(now())`)
      expect(await conta(c.site, ytA)).toEqual({ o: 0, k: 0 })
      // o vídeo voltou (competitor_videos em outro canal do site): a varredura poupa
      await grava()
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at) values ($1, $2, 'volta', now(), now())`, [c.canalB, ytA])
      await pg.query(`select public.obs_unarchived_watch_sweep(now())`)
      expect(await conta(c.site, ytA)).toEqual({ o: 1, k: 1 })
    })
  })

  it('a guarda de md5 (Yannis M3): função emendada depois da F1 recusa a migration em vez de desfazer a emenda; a F1 pura e a já migrada passam', async () => {
    for (const [fn, ancora] of [
      ['competitor_channel_remove_archived(uuid,uuid,uuid)', 'begin\n  if p_site'],
      ['competitor_channel_delete_unarchived(uuid,uuid,uuid,text,text)', 'begin\n  if p_site'],
      ['obs_unarchived_watch_sweep(timestamptz)', 'begin\n  if p_agora'],
    ] as const) {
      await emTransacao(pg, async () => {
        await pg.query(sqlDe('_ab_native_observados.sql'))
        const def = await escalar<string>(pg, `select pg_get_functiondef('public.${fn}'::regprocedure)`)
        const emendada = def.replace(ancora.replace('\\n', '\n'), ancora.replace('\\n', '\n').replace('begin\n', 'begin\n  -- emenda de outra frente\n'))
        expect(emendada).not.toBe(def)
        await pg.query(emendada)
        const t = await tenta(pg, sqlDe('_ab_native_observados_registro.sql'))
        expect(t.ok, fn).toBe(false)
        if (!t.ok) expect(t.message).toMatch(/emendada depois da F1/)
      })
    }
    await emTransacao(pg, async () => {
      await pg.query(sqlDe('_ab_native_observados.sql'))
      expect((await tenta(pg, sqlDe('_ab_native_observados_registro.sql'))).ok).toBe(true)
    })
  })
})
