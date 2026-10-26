// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { q1, SITE_TESTE, semearCanal } from '../helpers/m3b'
import { prepararM5, M5_SQL_CAMINHO } from '../helpers/m5'

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
  const DIARIA1 = 'competitor_video_daily'
  const hoje1 = (d: string) => c.query(`select set_config('obs_archive.hoje', $1, true)`, [d])
  const inicio = (fm: string) => c.query(`insert into public.obs_archive_switch (site_id, class, first_month) values ($1, 'serie', $2)`, [SITE_TESTE, fm])
  const destacar = (tabela: string, mes: string) => c.query(`alter table public.${tabela} detach partition obs_part.${tabela}_${mes.slice(0, 4)}${mes.slice(5, 7)}`)
  /** a tabela "começa" depois: solta toda partição até o mês dado (a M2 cria as partições a partir do dado mais antigo DE CADA tabela) */
  const comecarDepoisDe = (tabela: string, ateMes: string) => c.query(`do $$ declare f record; begin
    for f in select n.nspname as ns, c.relname as rel from pg_inherits h join pg_class c on c.oid = h.inhrelid join pg_namespace n on n.oid = c.relnamespace
              where h.inhparent = 'public.${tabela}'::regclass and n.nspname = 'obs_part' and right(c.relname, 6) <= '${ateMes.slice(0, 4)}${ateMes.slice(5, 7)}' loop
      execute format('drop table %I.%I', f.ns, f.rel); end loop; end $$`)
  const unidadeSerie = (mes: string, linhas: number) => c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
    values ($1, 'serie', $2, $3, $4, 1, $5, md5('a') || md5('a'), md5('s') || md5('s'), ${linhas > 0 ? "md5('b') || md5('b')" : 'null'}, md5('c') || md5('c'), 100, now())`, [SITE_TESTE, DIARIA1, randomUUID(), mes, linhas])

  it('divergência (a): o início da classe em 10/2026, registro vazio e a partição de outubro fora da tabela-mãe: divergência (o "nada saiu" é falso)', async () => {
    expect((await q1(c, `select relkind::text as k from pg_class where oid = 'public.competitor_video_daily'::regclass`)).k).toBe('p')
    await inicio('2026-10-01')
    expect(await linha(DIARIA1)).toMatchObject({ d: null, divergencia: false })   // negativo: nada saiu de fato
    await destacar(DIARIA1, '2026-10-01')
    expect(await linha(DIARIA1)).toMatchObject({ d: null, divergencia: true })
  })
  it('divergência (a): buraco no meio da tabela, com a tela em 01/2027', async () => {
    await inicio('2026-10-01'); await hoje1('2027-01-15')
    await destacar(DIARIA1, '2026-12-01')
    expect(await linha(DIARIA1)).toMatchObject({ d: null, divergencia: true })
  })
  it('divergência (b): a tabela começou depois do 1º mês da classe (sem dado de antes): NÃO é divergência', async () => {
    await inicio('2026-10-01'); await hoje1('2026-12-10')
    await comecarDepoisDe(DIARIA1, '2026-10-01')   // a tabela só tem dado desde 11/2026; a classe começou em 10/2026
    expect(await linha(DIARIA1)).toMatchObject({ d: null, divergencia: false })
  })
  it('divergência (b): a mesma tabela com uma unidade copiada de 10/2026, que já não está na tabela: divergência', async () => {
    await inicio('2026-10-01'); await hoje1('2026-12-10')
    await comecarDepoisDe(DIARIA1, '2026-10-01')
    await unidadeSerie('2026-10-01', 5)
    expect(await linha(DIARIA1)).toMatchObject({ d: null, divergencia: true })
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
  it('aviso: proximo_mes = selo (em São Paulo) + wait_days; mês destacado não conta; atraso igual ao do pulso', async () => {
    await semearCanal(c, { videos: 0 })
    // série selada em 2027-05-03 (wait_days 7): pronto em 2027-05-10. Horária de outubro já destacada: fora da fila.
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind) values ($1, 'serie', $2, '2026-11-01', '2027-05-03 12:00-03', 'com_dado')`, [SITE_TESTE, DIARIA])
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind, detached_at) values ($1, 'horaria', 'competitor_video_hourly', '2026-10-01', '2027-04-01 12:00-03', 'com_dado', now())`, [SITE_TESTE])
    await hoje('2027-05-04')
    const a = (await q1(c, `select public.obs_archive_aviso($1) as a, public.obs_archive_atraso($1) as at`, [SITE_TESTE]))
    expect((a.a as { proximo_mes: unknown }).proximo_mes).toEqual({ class: 'serie', month: '2026-11-01', pronto_em: '2027-05-10' })
    expect((a.a as { atraso: unknown }).atraso).toEqual(a.at)
  })
  it('aviso: a última cópia não conta a classe de ensaio', async () => {
    const x = (cl: string, mes: string, quando: string) => c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
      values ($1, $2, $6, $3, $4, 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, $5::timestamptz)`, [SITE_TESTE, cl, randomUUID(), mes, quando, cl === 'ensaio' ? 'obs_archive_rehearsal' : 'competitor_video_daily'])
    await x('ensaio', '2026-10-01', '2026-11-20 10:00-03')
    const ultima = async () => ((await q1(c, `select public.obs_archive_aviso($1) as a`, [SITE_TESTE])).a as { ultima_copia: string | null }).ultima_copia
    expect(await ultima()).toBeNull()
    await x('serie', '2026-10-01', '2026-11-02 10:00-03')
    expect(new Date((await ultima())!).toISOString()).toBe('2026-11-02T13:00:00.000Z')
  })
  it('canais_perdidos: a unidade perdida conta como perdida E como pronta (regra terminal)', async () => {
    const a = await semearCanal(c, { videos: 0 }); const b = await semearCanal(c, { videos: 0 })
    await unidade(a.canal, DIARIA); await unidade(a.canal, CEDO)
    await unidade(b.canal, DIARIA); await unidade(b.canal, CEDO)
    await c.query(`set local session_replication_role = replica`)   // semente: o gatilho recusaria perda de canal que existe; aqui só importa a leitura
    await c.query(`update public.obs_archive_units set lost_at = now(), lost_by = gen_random_uuid(), lost_reason = 'nunca_recebida', received_at = null where channel_ref = $1 and table_name = $2`, [b.canal, CEDO])
    await c.query(`set local session_replication_role = origin`)
    await hoje('2026-12-10')
    expect(progDe(await pagina(), 'serie', '2026-10-01')).toEqual({ class: 'serie', month: '2026-10-01', canais_esperados: 2, canais_prontos: 2, canais_perdidos: 1 })
  })
  /** A função da M3b (migration 02), recriada com outro nome dentro da transação, para comparar com a da M5. */
  const criarAtrasoM3b = async () => {
    const dir = resolve(__dirname, '../../../../supabase/migrations')
    const src = readFileSync(resolve(dir, readdirSync(dir).find(n => /_manutencao_m3b_arquivo\.sql$/.test(n))!), 'utf8')
    const i = src.indexOf('create or replace function public.obs_archive_atraso_itens(p_site uuid)'), j = src.indexOf('revoke all on function public.obs_archive_atraso_itens', i)
    expect(i).toBeGreaterThan(0)
    await c.query(src.slice(i, j).replace('obs_archive_atraso_itens(p_site uuid)', 'obs_archive_atraso_itens_m3b(p_site uuid)'))
  }
  it('atraso_itens (versão da M5) devolve o mesmo conjunto que a da M3b, num cenário variado', async () => {
    await criarAtrasoM3b()
    const a = await semearCanal(c, { videos: 0 }), b = await semearCanal(c, { videos: 0 }), d = await semearCanal(c, { videos: 0 }), e = await semearCanal(c, { videos: 0 })
    await unidade(a.canal, DIARIA); await unidade(a.canal, CEDO)                                        // pronto
    await unidade(b.canal, DIARIA); await unidade(b.canal, CEDO, { redo: 'conteudo_mudou' })            // a refazer
    await unidade(d.canal, DIARIA); await unidade(d.canal, CEDO); await unidade(d.canal, CEDO, { versao: 2, recebida: false })   // v2 não recebida
    void e                                                                                              // sem unidade nenhuma
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind) values ($1, 'serie', $2, '2026-11-01', now(), 'com_dado')`, [SITE_TESTE, DIARIA])   // mês selado
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind, unsealed_at, unsealed_reason) values ($1, 'serie', $2, '2026-10-01', now(), 'com_dado', now(), 'unidade_nova')`, [SITE_TESTE, CEDO])   // mês reaberto
    await hoje('2027-03-15')
    const ler = async (fn: string) => (await c.query(`select tipo, classe, tabela, canal, mes::text, desde::text from public.${fn}($1) order by 1, 2, 3 nulls first, 4 nulls first, 5`, [SITE_TESTE])).rows
    const novo = await ler('obs_archive_atraso_itens'), velho = await ler('obs_archive_atraso_itens_m3b')
    expect(novo.length).toBeGreaterThan(10)
    expect(new Set(novo.map(x => x.tipo))).toEqual(new Set(['unidade', 'mes']))
    expect(novo).toEqual(velho)
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
    await criarAtrasoM3b()
    const md5De = async (fn: string) => (await q1(c, `select md5(coalesce(string_agg(concat_ws('|', tipo, classe, tabela, canal, mes::text, desde::text), ',' order by tipo, classe, tabela nulls first, canal nulls first, mes), '')) as h, count(*)::int as n from public.${fn}($1)`, [SITE_TESTE]))
    const novo = await md5De('obs_archive_atraso_itens'), velho = await md5De('obs_archive_atraso_itens_m3b')
    console.log(`M5_MD5 novo=${JSON.stringify(novo)} velho=${JSON.stringify(velho)}`)
    expect(novo).toEqual(velho)
    expect(pag, 'pagina_ms').toBeLessThan(1500); expect(avi, 'aviso_ms').toBeLessThan(400)
  }, 240_000)
  it('as duas funções são só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('anon', 'public.obs_archive_pagina(uuid)', 'execute') as a1, has_function_privilege('authenticated', 'public.obs_archive_pagina(uuid)', 'execute') as a2,
                                 has_function_privilege('service_role', 'public.obs_archive_pagina(uuid)', 'execute') as a3, has_function_privilege('anon', 'public.obs_archive_aviso(uuid)', 'execute') as b1,
                                 has_function_privilege('authenticated', 'public.obs_archive_aviso(uuid)', 'execute') as b2, has_function_privilege('service_role', 'public.obs_archive_aviso(uuid)', 'execute') as b3`)
    expect(r).toEqual({ a1: false, a2: false, a3: true, b1: false, b2: false, b3: true })
  })
})

describe.skipIf(skipIfNoLocalDb())('M5 parte 3: lista v2, desde da horária, impacto', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c) })
  afterEach(async () => { await c.query('rollback'); await c.end() })
  const lista = async () => (await q1(c, `select public.obs_archive_removed_channel_list($1) as l`, [SITE_TESTE])).l as Record<string, unknown>[]
  const U = (canal: string, tabela: string, mes: string, linhas = 5) =>
    c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
             values ($1, 'serie', $2, $3, $4, 1, $5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [SITE_TESTE, tabela, canal, mes, linhas])

  it('lista v2: nome, removido_em e faixa para a remoção com linha', async () => {
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, name_at_removal, removed_at, removed_via, archive_decision, decided_at, units_at_removal, first_month, last_month, online_thumbs_known)
                   values ($1, 'aaaaaaaa-0000-0000-0000-000000000001', 'Viagem Lenta', '2028-04-28', 'botao', 'apagar', '2028-04-28', 14, '2026-10-01', '2027-11-01', true)`, [SITE_TESTE])
    const l = await lista()
    expect(l[0]).toMatchObject({ versao: 2, nome: 'Viagem Lenta', primeiro_mes: '2026-10', ultimo_mes: '2027-11', removido_via: 'botao' })
    expect(String(l[0]!.removido_em)).toMatch(/^2028-04-28/)
  })
  it('lista v2: linha da vigia sem nome nem data, com o código', async () => {
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known)
                   values ($1, '7f3a91c2-0000-0000-0000-000000000002', 'vigia', 'apagar', now(), false)`, [SITE_TESTE])
    expect((await lista())[0]).toMatchObject({ nome: null, removido_em: null, removido_via: 'vigia', channel_ref: '7f3a91c2-0000-0000-0000-000000000002' })
  })
  it('Phil I5: duas tabelas em três meses são 3 meses (não 6, não units_at_removal)', async () => {
    const ref = 'aaaaaaaa-0000-0000-0000-000000000004'
    // divergência do plano: o gatilho da M3b (canal_removido) recusa unidade depois da remoção; as unidades entram antes
    for (const mes of ['2026-10-01', '2026-11-01', '2026-12-01']) for (const t of ['competitor_video_daily', 'competitor_video_early']) await U(ref, t, mes)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, units_at_removal, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), 99, true)`, [SITE_TESTE, ref])
    expect((await lista())[0]).toMatchObject({ meses: 3, registros: 30, primeiro_mes: '2026-10', ultimo_mes: '2026-12' })
  })
  it('Phil I5: remoção sem nenhuma unidade tem meses e registros nulos, não zero', async () => {
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, units_at_removal, online_thumbs_known) values ($1, 'aaaaaaaa-0000-0000-0000-000000000005', 'botao', 'apagar', now(), 14, true)`, [SITE_TESTE])
    const r = (await lista())[0]!
    expect(r.meses).toBeNull(); expect(r.registros).toBeNull(); expect(r.estado).toBe('sem_arquivo')
  })
  it('Yannis I-14: horária com outubro fora diz 1º de outubro à meia-noite de São Paulo, precisão mês', async () => {
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind, detached_at) values ($1, 'horaria', 'competitor_video_hourly', '2026-10-01', now(), 'com_dado', now())`, [SITE_TESTE])
    const r = await q1(c, `select desde, precisao from public.obs_archive_horaria_desde($1)`, [SITE_TESTE])
    expect(new Date(r.desde as string).toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(r.precisao).toBe('mes')
  })
  it('horária sem mês fora: desde é a primeira leitura, precisão hora', async () => {
    const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 1 })
    await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) select v.id, '2026-11-02 14:00-03', '2026-11-02 14:00-03', $1, 10 from public.competitor_videos v where v.competitor_channel_id = $2`, [SITE_TESTE, canal])
    const r = await q1(c, `select desde, precisao from public.obs_archive_horaria_desde($1)`, [SITE_TESTE])
    expect(new Date(r.desde as string).toISOString()).toBe('2026-11-02T17:00:00.000Z'); expect(r.precisao).toBe('hora')
  })
  it('horária sem leitura nenhuma: desde e precisão nulos', async () => {
    const r = await q1(c, `select desde, precisao from public.obs_archive_horaria_desde($1)`, [SITE_TESTE])
    expect(r).toEqual({ desde: null, precisao: null })
  })
  it('hourly health: desde vem do mês fora (1º de outubro, precisão mês) e online_desde é a 1ª leitura real', async () => {
    const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 1 })
    await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) select v.id, '2026-11-02 14:00-03', '2026-11-02 14:00-03', $1, 10 from public.competitor_videos v where v.competitor_channel_id = $2`, [SITE_TESTE, canal])
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind, detached_at) values ($1, 'horaria', 'competitor_video_hourly', '2026-10-01', now(), 'com_dado', now())`, [SITE_TESTE])
    const h = (await q1(c, `select public.competitor_hourly_health($1, now(), 14, 100) as h`, [SITE_TESTE])).h as { desde: string; desde_precisao: string; online_desde: string }
    expect(new Date(h.desde).toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(h.desde_precisao).toBe('mes')
    expect(new Date(h.online_desde).toISOString()).toBe('2026-11-02T17:00:00.000Z')
  })
  it('hourly health sem mês fora: desde e online_desde são a 1ª leitura, precisão hora', async () => {
    const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 1 })
    await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) select v.id, '2026-11-02 14:00-03', '2026-11-02 14:00-03', $1, 10 from public.competitor_videos v where v.competitor_channel_id = $2`, [SITE_TESTE, canal])
    const h = (await q1(c, `select public.competitor_hourly_health($1, now(), 14, 100) as h`, [SITE_TESTE])).h as { desde: string; desde_precisao: string; online_desde: string }
    expect(new Date(h.desde).toISOString()).toBe('2026-11-02T17:00:00.000Z'); expect(h.desde_precisao).toBe('hora'); expect(h.online_desde).toBe(h.desde)
  })
  it('o bloco da competitor_hourly_health colado no rascunho é a saída atual do gerador (Yannis m-2)', () => {
    const raiz = resolve(__dirname, '../../../..')
    const saida = resolve(raiz, 'supabase/rascunhos/.gerado-teste-hourly-health.sql')
    execFileSync('python3', [resolve(raiz, 'supabase/rascunhos/gerar-m5-parte3.py'), saida], { cwd: raiz })
    const corta = (t: string) => t.slice(t.indexOf('create or replace function public.competitor_hourly_health('), t.indexOf('to service_role;', t.indexOf('grant execute on function public.competitor_hourly_health(')) + 'to service_role;'.length)
    try { expect(corta(readFileSync(M5_SQL_CAMINHO, 'utf8'))).toBe(corta(readFileSync(saida, 'utf8'))) } finally { execFileSync('rm', ['-f', saida]) }
  })
  it('lista v2: canal com apagar concluído (unidades expurgadas) mantém os N meses', async () => {
    const ref = 'aaaaaaaa-0000-0000-0000-000000000006'
    for (const mes of ['2026-10-01', '2026-11-01']) await U(ref, 'competitor_video_daily', mes)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [SITE_TESTE, ref])
    await c.query(`set local session_replication_role = replica`)   // semente: só a leitura importa
    await c.query(`update public.obs_archive_units set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 'x' where channel_ref = $1`, [ref])
    await c.query(`set local session_replication_role = origin`)
    // regra: a lista v2 mostra "Limpeza pedida: N meses" e conta também o que já foi expurgado/perdido (o impacto, ao contrário, só olha o que ainda existe)
    expect((await lista())[0]).toMatchObject({ meses: 2, registros: 10 })
  })
  it('impacto: fora_do_banco leva registros e por_tabela; a soma online + arquivo não cai depois de uma saída', async () => {
    const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await U(canal, 'competitor_video_daily', '2026-10-01', 10); await U(canal, 'competitor_video_early', '2026-10-01', 4)
    const antes = (await q1(c, `select public.obs_archive_channel_archive_impact($1, $2) as r`, [SITE_TESTE, canal])).r as { registros: number; fora_do_banco: { registros: number } }
    expect(antes.registros).toBe(14); expect(antes.fora_do_banco.registros).toBe(0)
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind, dropped_at) values
                   ($1, 'serie', 'competitor_video_daily', '2026-10-01', now(), 'com_dado', now()), ($1, 'serie', 'competitor_video_early', '2026-10-01', now(), 'com_dado', now())`, [SITE_TESTE])
    const depois = (await q1(c, `select public.obs_archive_channel_archive_impact($1, $2) as r`, [SITE_TESTE, canal])).r as { registros: number; fora_do_banco: { registros: number; por_tabela: { table_name: string; registros: number }[] } }
    expect(depois.registros).toBe(14)
    expect(depois.fora_do_banco.registros).toBe(14)
    expect(depois.fora_do_banco.por_tabela.map(t => t.table_name).sort()).toEqual(['competitor_video_daily', 'competitor_video_early'])
  })
  it('as duas funções novas são só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('authenticated', 'public.obs_archive_horaria_desde(uuid)', 'execute') as a, has_function_privilege('service_role', 'public.obs_archive_horaria_desde(uuid)', 'execute') as b`)
    expect(r).toEqual({ a: false, b: true })
  })
})
