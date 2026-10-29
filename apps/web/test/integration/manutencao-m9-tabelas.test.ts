// @vitest-environment node
/** M9 Tarefa 1: parte 1 do rascunho (guardas, tabelas, interruptor). Tudo em begin … rollback no bythiago_int (54422). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, tenta, semearCanal, SITE_TESTE } from '../helpers/m3b'
import { aplicarM9, semearE9, sqlM9Ate } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['obs_archive_item_targets', 'obs_archive_absence', 'obs_archive_m9_interruptor']
const UUID = '11111111-1111-1111-1111-111111111111'

describe.skipIf(skipIfNoLocalDb())('M9 parte 1: guardas, tabelas e interruptor', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: () => Promise<void>, parte = true): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      if (parte) await aplicarM9(pg, 1)
      await fn()
    } finally { await pg.query('rollback') }
  }
  const alvo = (o: Record<string, unknown> = {}) => {
    const v = { site_id: SITE_TESTE, item_kind: 'video', item_refs: '{abc}', class: 'serie', table_name: 'competitor_video_daily', channel_ref: UUID,
      month: '2026-09-01', keys: '{k1,k2,k3}', from_unit_id: UUID, from_version: 1, estado: 'copiar', ...o }
    const cols = Object.keys(v)
    return { text: `insert into public.obs_archive_item_targets (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`, values: Object.values(v) }
  }
  const ausencia = (o: Record<string, unknown> = {}) => {
    const v = { site_id: SITE_TESTE, alvo: `canal:${UUID}`, canal_ref: UUID, filho: 'numerico', prefixo: 'a/b', e_prefixo: true, ...o }
    const cols = Object.keys(v)
    return { text: `insert into public.obs_archive_absence (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`, values: Object.values(v) }
  }
  const ins = (q: { text: string; values: unknown[] }) => tenta(pg, q.text, q.values)

  it('guardas: sem a E9 falha m9_sem_e9; sem a M3b, m9_m3b_ausente', async () => {
    await emTx(async () => {
      const f = await pg.query(`select oid::regprocedure::text as r from pg_proc where proname = 'competitor_channel_purge' and pronamespace = 'public'::regnamespace`)
      for (const x of f.rows) await pg.query(`drop function ${x.r as string}`)
      const r = await tenta(pg, sqlM9Ate(1))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toContain('m9_sem_e9')
    }, false)
    await emTx(async () => {
      await pg.query('alter table public.competitor_removed_items rename to competitor_removed_items_x')
      const r = await tenta(pg, sqlM9Ate(1))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toContain('m9_m3b_ausente')
    }, false)
  })

  it('guarda: M3b sem expurgo falha m9_m3b_sem_expurgo', async () => {
    await emTx(async () => {
      const nome = (await pg.query(`select c.conname from pg_constraint c where c.conrelid = 'public.obs_archive_months'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%unsealed_reason%'`)).rows[0].conname as string
      await pg.query(`update public.obs_archive_months set unsealed_reason = null`)
      await pg.query(`alter table public.obs_archive_months drop constraint "${nome}"`)
      await pg.query(`alter table public.obs_archive_months add constraint "${nome}" check (unsealed_reason in ('conteudo_mudou', 'mudou_no_destaque', 'unidade_nova'))`)
      await semearE9(pg)
      const r = await tenta(pg, sqlM9Ate(1))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toContain('m9_m3b_sem_expurgo')
    }, false)
  })

  it('tabelas novas com RLS e sem escrita', async () => {
    await emTx(async () => {
      for (const t of TABELAS) {
        expect(await escalar<boolean>(pg, `select relrowsecurity from pg_class where oid = $1::regclass`, [`public.${t}`])).toBe(true)
        const pol = await pg.query(`select cmd, qual from pg_policies where schemaname = 'public' and tablename = $1`, [t])
        expect(pol.rows).toHaveLength(1)
        expect(pol.rows[0].cmd).toBe('SELECT')
        expect(String(pol.rows[0].qual)).toContain('can_edit_site(site_id)')
        for (const p of ['INSERT', 'UPDATE', 'DELETE']) expect(await escalar<boolean>(pg, `select has_table_privilege('service_role', $1, $2)`, [`public.${t}`, p])).toBe(false)
        expect(await escalar<boolean>(pg, `select has_table_privilege('anon', $1, 'SELECT')`, [`public.${t}`])).toBe(false)
      }
    })
  })

  it('alvo: keys esvaziadas ao concluir', async () => {
    await emTx(async () => {
      const a = await ins(alvo({ esperadas: 5 }))
      expect(a.ok).toBe(true)
      const id = a.ok ? a.rows[0].id : null
      const f = await pg.query(`update public.obs_archive_item_targets set estado = 'concluido', motivo_fim = 'canal_apagado', done_at = now() where id = $1 returning keys, keys_n`, [id])
      expect(f.rows[0].keys).toEqual([]); expect(Number(f.rows[0].keys_n)).toBe(3)
      const s = await ins(alvo({ geracao: 2, keys: '{}' }))
      expect(s.ok).toBe(false); if (!s.ok) expect(s.code).toBe('23514')
      const sl = await ins(alvo({ geracao: 3, keys: '{k}', estado: 'sem_linhas', done_at: new Date().toISOString() }))
      expect(sl.ok).toBe(true)
      // a tela não lê `keys` de função nenhuma (as funções de leitura nascem nas partes seguintes)
      const vazam = await escalar<number>(pg, `select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'obs_archive%' and pg_get_function_result(p.oid) ~* '\\mkeys\\M'`)
      expect(vazam).toBe(0)
    })
  })

  it('alvo: estados e motivo', async () => {
    await emTx(async () => {
      const casos: Record<string, unknown>[] = [
        { geracao: 1, estado: 'bloqueado' },
        { geracao: 2, estado: 'copiar', motivo: 'antiga_ausente' },
        { geracao: 3, estado: 'concluido', keys: '{}' },
        { geracao: 4, estado: 'copiar', motivo_fim: 'canal_apagado' },
      ]
      for (const c of casos) { const r = await ins(alvo(c)); expect(r.ok, JSON.stringify(c)).toBe(false); if (!r.ok) expect(r.code).toBe('23514') }
      expect((await ins(alvo({ geracao: 5, estado: 'bloqueado', motivo: 'depende_m10b' }))).ok).toBe(true)
    })
  })

  it('alvo: unicidade por geração', async () => {
    await emTx(async () => {
      expect((await ins(alvo())).ok).toBe(true)
      const d = await ins(alvo()); expect(d.ok).toBe(false); if (!d.ok) expect(d.code).toBe('23505')
      expect((await ins(alvo({ geracao: 2 }))).ok).toBe(true)
    })
  })

  it('ausência: alvo tipado', async () => {
    await emTx(async () => {
      const ruins = [ausencia({ alvo: 'canal:xyz' }), ausencia({ canal_ref: null }), ausencia({ alvo: 'alvo:5', alvo_id: 5 }), ausencia({ alvo: `antiga:${UUID}`, unidade_id: UUID })]
      const r0 = await ins(ruins[0]); expect(r0.ok).toBe(false); if (!r0.ok) expect(r0.code).toBe('23514')
      const r1 = await ins(ruins[1]); expect(r1.ok).toBe(false); if (!r1.ok) expect(r1.code).toBe('23514')
      const r2 = await ins(ruins[2]); expect(r2.ok).toBe(false)   // alvo:5 com canal_ref preenchido (padrão do helper)
      const o1 = await ins(ausencia({ alvo: 'alvo:5', alvo_id: 5, canal_ref: null })); expect(o1.ok, JSON.stringify(o1)).toBe(true)
      expect((await ins(ausencia({ alvo: `antiga:${UUID}`, unidade_id: UUID, canal_ref: null }))).ok).toBe(true)
    })
  })

  it('ausência: marcos em cadeia', async () => {
    await emTx(async () => {
      const t = new Date().toISOString(); const sha = 'a'.repeat(64)
      const ruins = [{ nas_absent_at: t }, { snap_absent_at: t }, { b2_absent_at: t }, { nova_caminho: 'x' }]
      for (const [i, o] of ruins.entries()) {
        const r = await ins(ausencia({ prefixo: `p${i}`, ...o })); expect(r.ok, JSON.stringify(o)).toBe(false); if (!r.ok) expect(r.code).toBe('23514')
      }
      const o2 = await ins(ausencia({ prefixo: 'ok', nas_absent_first_at: t, nas_absent_at: t, snap_absent_at: t, b2_absent_at: t, nova_caminho: 'x', nova_sha256: sha })); expect(o2.ok, JSON.stringify(o2)).toBe(true)
    })
  })

  it('resumo ganha origem', async () => {
    await emTx(async () => {
      const d = await pg.query(`select column_default from information_schema.columns where table_schema = 'public' and table_name = 'obs_archive_summaries' and column_name = 'origem'`)
      expect(String(d.rows[0].column_default)).toContain('rota')
      const def = await escalar<string>(pg, `select pg_get_constraintdef(oid) from pg_constraint where conname = 'obs_archive_summaries_origem_check'`)
      expect(def).toContain('rota'); expect(def).toContain('expurgo')
    })
  })

  it('congela_dias: mês fora do banco mantém os dias; online muda', async () => {
    await emTx(async () => {
      const mes = async (detached: boolean, mesData: string) => escalar<string>(pg,
        `insert into public.obs_archive_months (site_id, class, table_name, month, days_measured, days_in_month, detached_at) values ($1, 'serie', 'competitor_video_daily', $2, 30, 30, ${detached ? 'now()' : 'null'}) returning id`, [SITE_TESTE, mesData])
      const fora = await mes(true, '2026-08-01'); const on = await mes(false, '2026-07-01')
      await pg.query(`update public.obs_archive_months set days_measured = 1 where id in ($1, $2)`, [fora, on])
      expect(await escalar<number>(pg, `select days_measured from public.obs_archive_months where id = $1`, [fora])).toBe(30)
      expect(await escalar<number>(pg, `select days_measured from public.obs_archive_months where id = $1`, [on])).toBe(1)
    })
  })

  it('interruptor: padrão desligado e privilégios', async () => {
    await emTx(async () => {
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_ligado($1)`, [SITE_TESTE])).toBe(false)
      const l = await tenta(pg, `select public.obs_archive_m9_ligar($1, true)`, [SITE_TESTE])   // a captura nasce na parte 2
      expect(l.ok).toBe(false)
      // ligar(site, false) também só roda depois da parte 2: o plpgsql resolve obs_archive_m9_captura_presente() ao executar a expressão
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_ligado($1)`, [SITE_TESTE])).toBe(false)
      for (const f of ['obs_archive_m9_ligar(uuid,boolean)', 'obs_archive_m9_ligado(uuid)']) for (const r of ['service_role', 'anon', 'authenticated']) {
        expect(await escalar<boolean>(pg, `select has_function_privilege($1, $2, 'EXECUTE')`, [r, `public.${f}`]), `${r} ${f}`).toBe(false)
      }
    })
  })

  it('rodar duas vezes não erra (idempotência)', async () => {
    await emTx(async () => { await pg.query(sqlM9Ate(1)) })
  })
})
