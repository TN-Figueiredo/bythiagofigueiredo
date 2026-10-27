// Manutenção M5, Tarefa 7 (integração, banco 54422). Yannis I-7 / r2 N-5: o SQL e a lista fechada do Zod andam juntos, e a saída REAL passa no leitor.
// Os leitores aviso-leve, canais-removidos e online-desde (Tarefas 8 e 11) ganham o seu caso real quando existirem; aqui só a página.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearCanal, q1, SITE_TESTE } from '../helpers/m3b'
import { prepararM5 } from '../helpers/m5'
import { CHAVES_LINHA_MES, CHAVES_CASA, lerPaginaBruta } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'
import { montarPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

const URL_INT = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const bruto = async (c: Client, sql: string, p: unknown[]) => (await q1(c, sql, p)).x // jsonb vem como objeto do `pg`, igual ao PostgREST

describe.skipIf(skipIfNoLocalDb())('as chaves do SQL são as da lista fechada do Zod', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  it('linha de mês, com e sem registro, e a casa', async () => {
    await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month) values ($1, 'serie', 'competitor_video_daily', '2026-10-01')`, [SITE_TESTE])
    await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at, updated_at, nas_ok) values ($1, 'copiador', now(), now(), true)`, [SITE_TESTE])
    const p = (await q1(c, `select public.obs_archive_pagina($1) as p`, [SITE_TESTE])).p as { meses: Record<string, unknown>[]; casa: Record<string, unknown>[] }
    const com = p.meses.find(m => m.tem_linha === true)!, sem = p.meses.find(m => m.tem_linha === false)!
    expect(Object.keys(com).sort()).toEqual([...CHAVES_LINHA_MES].sort())
    expect(Object.keys(sem).sort()).toEqual([...CHAVES_LINHA_MES].sort())
    expect(Object.keys(p.casa[0]!).sort()).toEqual([...CHAVES_CASA].sort())
  })

  it('obs_archive_pagina REAL passa em lerPaginaBruta: sem linha, com linha, com b2 atestado, com batimento e com unidade; e montarPagina a monta', async () => {
    const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    // (1) só canais: toda a grade é "sem linha"
    const r1 = lerPaginaBruta(await bruto(c, `select public.obs_archive_pagina($1) as x`, [SITE_TESTE]))
    expect(r1).toMatchObject({ ok: true })
    // (2) linha de registro + atestação B2 + batimento
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, b2_attested_at, b2_attested_via) values ($1, 'serie', 'competitor_video_daily', '2026-10-01', now(), 'forja')`, [SITE_TESTE])
    await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at, updated_at, nas_ok, nas_checked_at) values ($1, 'copiador', now(), now(), true, now())`, [SITE_TESTE])
    // (3) uma unidade recebida
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp) values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 1, 0, repeat('a', 64), repeat('b', 64))`, [SITE_TESTE, canal])
    const r = lerPaginaBruta(await bruto(c, `select public.obs_archive_pagina($1) as x`, [SITE_TESTE]))
    expect(r).toMatchObject({ ok: true })
    if (!r.ok) throw new Error('esquema')
    expect(r.pagina.meses.some(m => m.tem_linha)).toBe(true)
    const m = montarPagina(r.pagina, { arquivoLigado: true })
    expect(m.tipos.length).toBeGreaterThan(0)
    expect(m.tipos.flatMap(t => t.linhas).every(l => l.frase.trim().length > 0)).toBe(true)
  })

  it('b2 de meses[] NÃO traz `por` (Phil r3 N5: o identificador de pessoa não chega ao navegador de quem só edita)', async () => {
    await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, b2_attested_at, b2_attested_via, b2_attested_by) values ($1, 'serie', 'competitor_video_daily', '2026-10-01', now(), 'dono', gen_random_uuid())`, [SITE_TESTE])
    const pg = await bruto(c, `select public.obs_archive_pagina($1) as x`, [SITE_TESTE]) as { meses: { b2: Record<string, unknown> }[] }
    expect(pg.meses.filter(m => m.b2 && m.b2.via != null).length).toBeGreaterThan(0)
    for (const m of pg.meses) expect(Object.keys(m.b2)).not.toContain('por')
  })
  it('Phil r2 N6: os limiares de atraso (5, 6, 30, 31 dias) são os mesmos no SQL (obs_archive_atraso) e na página (montarPagina)', async () => {
    await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await c.query(`insert into public.obs_archive_switch (site_id, class, first_month) values ($1, 'serie', '2026-10-01')`, [SITE_TESTE])
    const devido = Date.parse('2026-11-28T00:00:00Z') // último dia de outubro + 28
    const gravidadePagina = (p: ReturnType<typeof montarPagina>) => p.tipos.find(t => t.tipo === 'serie')!.linhas.find(l => l.chave === 'serie:2026-10-01')!.gravidade
    const visto: string[] = []
    for (const n of [5, 6, 30, 31]) {
      const d = new Date(devido + n * 86_400_000).toISOString().slice(0, 10)
      await c.query(`select set_config('obs_archive.hoje', $1, true), set_config('obs_archive.agora', $2, true)`, [d, d + ' 12:00-03'])
      const at = (await q1(c, `select public.obs_archive_atraso($1) as x`, [SITE_TESTE])).x as { amarelos: number; vermelhos: number }
      const r = lerPaginaBruta(await bruto(c, `select public.obs_archive_pagina($1) as x`, [SITE_TESTE]))
      if (!r.ok) throw new Error('esquema')
      const sql = at.vermelhos > 0 ? 'vermelho' : at.amarelos > 0 ? 'ambar' : 'nenhuma'
      const ts = gravidadePagina(montarPagina(r.pagina, { arquivoLigado: true }))
      visto.push(`${n}:${sql}/${ts}`)
      expect(ts).toBe(sql)
    }
    expect(visto).toEqual(['5:nenhuma/nenhuma', '6:ambar/ambar', '30:ambar/ambar', '31:vermelho/vermelho'])
  })
})
