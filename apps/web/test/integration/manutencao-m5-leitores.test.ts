// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { q1, SITE_TESTE, semearCanal } from '../helpers/m3b'
import { prepararM5 } from '../helpers/m5'

/** Banco de integração (54422), nunca o 54322 do navegador. */
const URL_INT = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'

describe.skipIf(skipIfNoLocalDb())('M5 parte 1: online desde', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c, 1) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  const fora = (site: string, classe: string, tabela: string, mes: string, col: 'detached_at' | 'dropped_at') =>
    c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, ${col}) values ($1, $2, $3, $4, now())`, [site, classe, tabela, mes])
  const linha = (tabela: string) => q1(c, `select online_since::text as d, divergencia from public.obs_archive_online_since($1) where table_name = $2`, [SITE_TESTE, tabela])

  it('window_months da política: serie 6, horaria 3', async () => {
    const r = await c.query(`select class, table_name, window_months from public.obs_archive_policy() where class in ('serie','horaria')`)
    for (const l of r.rows) expect(l.window_months, l.table_name).toBe(l.class === 'serie' ? 6 : 3)
  })
  it('nenhum mês saiu: só horária e série, todas nulas, sem divergência', async () => {
    const r = await c.query(`select class, table_name, online_since, divergencia from public.obs_archive_online_since($1) order by 2`, [SITE_TESTE])
    expect(r.rows.map(x => x.table_name)).toEqual(['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'])
    expect(r.rows.every(x => x.online_since === null && x.divergencia === false)).toBe(true)
    expect(new Set(r.rows.map(x => x.class))).toEqual(new Set(['serie', 'horaria']))
  })
  it('mês destacado conta como fora; trazer de volta recua', async () => {
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-04-01', 'detached_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
    await c.query(`update public.obs_archive_months set detached_at = null where site_id = $1`, [SITE_TESTE])
    expect((await linha('competitor_video_daily')).d).toBeNull()
  })
  it('descartado e destacado: vale o mês seguinte ao último fora', async () => {
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-03-01', 'dropped_at')
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-04-01', 'detached_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
  })
  it('a saída é da tabela, não do site: o mês de outro site também conta', async () => {
    await fora(randomUUID(), 'serie', 'competitor_video_daily', '2027-04-01', 'dropped_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
  })
  it('registro vazio com a partição mais antiga depois do primeiro mês: divergência, nunca "nada saiu"', async () => {
    expect((await q1(c, `select relkind::text as k from pg_class where oid = 'public.competitor_video_daily'::regclass`)).k).toBe('p')
    await c.query(`insert into public.obs_archive_switch (site_id, class, first_month) values ($1, 'serie', '2020-01-01')`, [SITE_TESTE])
    const r = await linha('competitor_video_daily')
    expect(r).toMatchObject({ d: null, divergencia: true })
  })
  it('a função é só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('anon', 'public.obs_archive_online_since(uuid)', 'execute') as anon,
                                 has_function_privilege('authenticated', 'public.obs_archive_online_since(uuid)', 'execute') as auth,
                                 has_function_privilege('service_role', 'public.obs_archive_online_since(uuid)', 'execute') as svc`)
    expect(r).toEqual({ anon: false, auth: false, svc: true })
  })
})

describe.skipIf(skipIfNoLocalDb())('M5 parte 2: a página e o aviso', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  type Prog = { class: string; month: string; canais_esperados: number; canais_prontos: number; canais_perdidos: number }
  const hoje = (d: string) => c.query(`select set_config('obs_archive.hoje', $1, true)`, [d])
  const pagina = async () => (await q1(c, `select public.obs_archive_pagina($1) as p`, [SITE_TESTE])).p as Record<string, unknown> & { meses: Record<string, unknown>[]; progresso: Prog[] }
  const unidade = (canal: string, tabela: string, extra: { versao?: number; recebida?: boolean; redo?: string | null } = {}) =>
    c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at, redo_reason)
             values ($1, 'serie', $2, $3, '2026-10-01', $4, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, ${extra.recebida === false ? 'null' : 'now()'}, $5)`,
      [SITE_TESTE, tabela, canal, extra.versao ?? 1, extra.redo ?? null])
  const DIARIA = 'competitor_video_daily', CEDO = 'competitor_video_early'
  const progDe = (p: { progresso: Prog[] }, classe: string, mes: string) => p.progresso.find(x => x.class === classe && x.month === mes)

  it('C1: dois canais, 40 dias depois de outubro, nenhuma unidade: o mês devido aparece, esperado 2, pronto 0, devido em 28/11', async () => {
    await semearCanal(c, { site: SITE_TESTE, videos: 0 }); await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await hoje('2026-12-10')
    const p = await pagina()
    const out = p.meses.find(m => m.class === 'serie' && m.table_name === DIARIA && m.month === '2026-10-01')
    expect(out).toMatchObject({ tem_linha: false, devido_em: '2026-11-28', sealed_at: null })
    expect(p.meses.some(m => m.month === '2026-12-01')).toBe(true)
    expect(progDe(p, 'serie', '2026-10-01')).toEqual({ class: 'serie', month: '2026-10-01', canais_esperados: 2, canais_prontos: 0, canais_perdidos: 0 })
    expect(progDe(p, 'horaria', '2026-10-01')).toMatchObject({ canais_esperados: 2, canais_prontos: 0 })
  })
  it('site vazio: grade sem linha de registro, zero esperado, casa vazia', async () => {
    const p = await pagina()
    expect(p.versao).toBe(1); expect(typeof p.lido_em).toBe('string'); expect(p.casa).toEqual([])
    expect(p.meses.length).toBeGreaterThan(0)
    expect(p.meses.every(m => m.tem_linha === false)).toBe(true)
    expect(p.progresso.every(x => x.canais_esperados === 0)).toBe(true)
  })
  it('progresso conta canais com todas as tabelas terminadas; unidade a refazer não conta', async () => {
    const a = await semearCanal(c, { videos: 0 }), b = await semearCanal(c, { videos: 0 }), d = await semearCanal(c, { videos: 0 })
    await unidade(a.canal, DIARIA); await unidade(a.canal, CEDO)
    await unidade(b.canal, DIARIA); await unidade(b.canal, CEDO, { redo: 'conteudo_mudou' })
    void d
    await hoje('2026-12-10')
    expect(progDe(await pagina(), 'serie', '2026-10-01')).toMatchObject({ canais_esperados: 3, canais_prontos: 1 })
  })
  it('vale a maior versão, sem filtro: v2 ainda não recebida desfaz a v1 recebida', async () => {
    const a = await semearCanal(c, { videos: 0 })
    await unidade(a.canal, DIARIA); await unidade(a.canal, CEDO)
    await unidade(a.canal, DIARIA, { versao: 2, recebida: false })
    await hoje('2026-12-10')
    expect(progDe(await pagina(), 'serie', '2026-10-01')).toMatchObject({ canais_esperados: 1, canais_prontos: 0 })
  })
  it('os vermelhos do site chegam à página (paridade com o pulso)', async () => {
    await semearCanal(c, { videos: 0 }); await hoje('2027-01-15')
    const p = await pagina() as unknown as { vermelhos: string[]; atraso: { vermelhos: number } }
    expect(p.vermelhos.some(v => v.startsWith('atraso de cópia'))).toBe(true)
    expect(p.atraso.vermelhos).toBeGreaterThan(0)
  })
  it('o registro vai por lista fechada: nenhum *_by, nem id, nem site_id', async () => {
    await semearCanal(c, { videos: 0 })
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at, detached_by) values ($1, 'serie', $2, '2026-10-01', now(), gen_random_uuid())`, [SITE_TESTE, DIARIA])
    const m = (await pagina()).meses.find(x => x.tem_linha === true)!
    expect(Object.keys(m).filter(k => k.endsWith('_by') || k === 'id' || k === 'site_id')).toEqual([])
    expect(m).toHaveProperty('reattach_out_of_order', false)
  })
  it('não grava first_month (a função é stable)', async () => {
    await pagina()
    expect((await q1(c, `select count(*)::int as n from public.obs_archive_switch where site_id = $1`, [SITE_TESTE])).n).toBe(0)
  })
  it('recuperação: leva o fp atual da tabela, e ele muda com um alter table (o visto da época deixa de valer)', async () => {
    const fp = async () => ((await pagina()).recuperacao as { table_name: string; schema_fp_atual: string | null }[]).find(r => r.table_name === DIARIA)!.schema_fp_atual
    const antes = await fp()
    expect(antes).toMatch(/^[0-9a-f]{64}$/)
    await c.query(`alter table public.competitor_video_daily add column zz_m5 integer`)
    expect(await fp()).not.toBe(antes)
  })
  it('meses à frente: uma linha por tabela da série, com months_ahead número ou nulo', async () => {
    const a = (await pagina()).meses_a_frente as { table_name: string; months_ahead: number | null; converted_at: string | null }[]
    expect(a.map(x => x.table_name).sort()).toEqual([DIARIA, CEDO, 'competitor_video_hourly'].sort())
    for (const m of a) expect(m.months_ahead === null || Number.isInteger(m.months_ahead)).toBe(true)
  })
  it('aviso: leve, só com o que o 18-v2 usa', async () => {
    await semearCanal(c, { videos: 0 })
    const a = (await q1(c, `select public.obs_archive_aviso($1) as a`, [SITE_TESTE])).a as Record<string, unknown>
    expect(Object.keys(a).sort()).toEqual(['atraso', 'casa', 'hoje', 'lido_em', 'primeira_devida_em', 'proximo_mes', 'ultima_copia', 'vermelhos_n', 'versao'])
    expect(a.proximo_mes).toBeNull(); expect(a.ultima_copia).toBeNull(); expect(a.primeira_devida_em).toBe('2026-11-28'); expect(typeof a.vermelhos_n).toBe('number')
  })
  // Passo 4: a medida do caso cheio (75 canais x 6 tabelas = 450 unidades/mês, 19 meses, 03/05/2028). Só com M5_MEDIR=1.
  it.skipIf(!process.env.M5_MEDIR)('medida: caso cheio', async () => {
    for (let i = 0; i < 75; i++) await semearCanal(c, { site: SITE_TESTE, videos: 0, addedAt: '2026-09-15T12:00:00Z' })
    await c.query(`select set_config('obs_archive.hoje', '2028-05-03', true), set_config('obs_archive.agora', '2028-05-03 12:00-03', true)`)
    await c.query(`do $$ declare g record; begin
      for g in select x.class as cl, m::date as mes from (values ('horaria'), ('serie'), ('texto')) x(class), generate_series(date '2026-10-01', date '2028-04-01', interval '1 month') m loop
        insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at, redo_reason)
        select '${SITE_TESTE}', g.cl, e.table_name, e.channel_ref, g.mes, 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100,
               case when random() < 0.9 then now() end, case when random() < 0.05 then 'conteudo_mudou' end
          from public.obs_archive_expected_units('${SITE_TESTE}', g.cl, g.mes) e;
      end loop; end $$`)
    const n = (await q1(c, `select count(*)::int as n from public.obs_archive_units where site_id = $1`, [SITE_TESTE])).n
    const tempo = async (sql: string) => { const t0 = performance.now(); await c.query(sql, [SITE_TESTE]); return Math.round(performance.now() - t0) }
    const pag = await tempo(`select public.obs_archive_pagina($1)`)
    const avi = await tempo(`select public.obs_archive_aviso($1)`)
    const atr = await tempo(`select public.obs_archive_atraso($1)`)
    const ver = await tempo(`select public.obs_archive_vermelhos($1)`)
    const plano = await c.query(`explain (analyze, buffers) select public.obs_archive_pagina('${SITE_TESTE}')`)
    console.log(`M5_MEDIDA unidades=${n} pagina_ms=${pag} aviso_ms=${avi} atraso_ms=${atr} vermelhos_ms=${ver}\n` + plano.rows.map(r => r['QUERY PLAN']).join('\n'))
  }, 240_000)
  it('as duas funções são só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('anon', 'public.obs_archive_pagina(uuid)', 'execute') as a1, has_function_privilege('authenticated', 'public.obs_archive_pagina(uuid)', 'execute') as a2,
                                 has_function_privilege('service_role', 'public.obs_archive_pagina(uuid)', 'execute') as a3, has_function_privilege('anon', 'public.obs_archive_aviso(uuid)', 'execute') as b1,
                                 has_function_privilege('authenticated', 'public.obs_archive_aviso(uuid)', 'execute') as b2, has_function_privilege('service_role', 'public.obs_archive_aviso(uuid)', 'execute') as b3`)
    expect(r).toEqual({ a1: false, a2: false, a3: true, b1: false, b2: false, b3: true })
  })
})
