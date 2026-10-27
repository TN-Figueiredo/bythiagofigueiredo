// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { prepararM5, aplicarM5 } from '../helpers/m5'

/** Desfazer da M5 (Yannis N-2): ida e volta com md5 do corpo e ACL. Padrão 54322; local: SUPABASE_DB_URL. Tudo em begin … rollback. */
const URL_INT = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = resolve(__dirname, '../../../../supabase')
const DESFAZER = readFileSync(resolve(RAIZ, 'rascunhos/m5-desfazer.sql'), 'utf8')
const ANTIGAS: ReadonlyArray<{ arq: string; fn: string; assinatura: string }> = [
  { arq: '20261013000002_observatorio_a5_e15_leitura_horaria.sql', fn: 'competitor_hourly_health', assinatura: 'public.competitor_hourly_health(uuid, timestamptz, integer, integer)' },
  { arq: '20261025000002_manutencao_m3b_arquivo.sql', fn: 'obs_archive_policy', assinatura: 'public.obs_archive_policy()' },
  { arq: '20261025000002_manutencao_m3b_arquivo.sql', fn: 'obs_archive_atraso_itens', assinatura: 'public.obs_archive_atraso_itens(uuid)' },
  { arq: '20261025000002_manutencao_m3b_arquivo.sql', fn: 'obs_archive_removed_channel_list', assinatura: 'public.obs_archive_removed_channel_list(uuid)' },
  { arq: '20261025000002_manutencao_m3b_arquivo.sql', fn: 'obs_archive_channel_archive_impact', assinatura: 'public.obs_archive_channel_archive_impact(uuid, uuid)' },
]
const NOVAS = ['public.obs_archive_aviso(uuid)', 'public.obs_archive_pagina(uuid)', 'public.obs_archive_online_since(uuid)', 'public.obs_archive_horaria_desde(uuid)']

/** Corpo e revoke/grant de UMA função, lidos direto da migration anterior (independente do gerador do desfazer). */
function blocoOriginal(arq: string, fn: string): string {
  const sql = readFileSync(resolve(RAIZ, 'migrations', arq), 'utf8')
  const ini = sql.indexOf(`create or replace function public.${fn}(`)
  if (ini < 0) throw new Error(`função ${fn} não encontrada em ${arq}`)
  const fimRevoke = sql.indexOf(`revoke all on function public.${fn}(`, ini)
  const grant = sql.indexOf(`grant execute on function public.${fn}(`, fimRevoke)
  const proximaLinhaRevoke = sql.indexOf('\n', fimRevoke)
  const temGrant = grant >= 0 && grant - proximaLinhaRevoke <= 1
  return sql.slice(ini, temGrant ? sql.indexOf('\n', grant) : proximaLinhaRevoke)
}

async function foto(c: Client, assinaturas: readonly string[]): Promise<Record<string, { md5: string; acl: string } | null>> {
  const o: Record<string, { md5: string; acl: string } | null> = {}
  for (const a of assinaturas) {
    const r = await c.query(`select md5(pg_get_functiondef(p.oid)) as md5, coalesce(p.proacl::text, '') as acl
                               from pg_proc p where p.oid = to_regprocedure($1)`, [a])
    o[a] = r.rows[0] ? { md5: r.rows[0].md5, acl: r.rows[0].acl } : null
  }
  return o
}

describe.skipIf(skipIfNoLocalDb())('M5: desfazer (ida e volta)', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  const sqlDesfazer = (texto = DESFAZER): string => texto.replace(/^begin;$/m, '').replace(/^commit;$/m, '')
  const assinaturasAntigas = ANTIGAS.map(x => x.assinatura)

  it('o desfazer devolve o corpo e a ACL pré-M5; as quatro funções novas somem; reaplicar a M5 volta ao estado da M5', async () => {
    const comM5 = await foto(c, [...assinaturasAntigas, ...NOVAS])
    for (const n of NOVAS) expect(comM5[n], n).not.toBeNull()
    // base: o que as migrations anteriores definem (independente do desfazer), aplicado por cima da M5
    for (const x of ANTIGAS) await c.query(blocoOriginal(x.arq, x.fn))
    const base = await foto(c, assinaturasAntigas)
    // pelo menos uma das cinco mudou com a M5 (senão o teste não prova nada)
    expect(assinaturasAntigas.some(a => base[a]?.md5 !== comM5[a]?.md5)).toBe(true)

    await aplicarM5(c)
    const reM5 = await foto(c, [...assinaturasAntigas, ...NOVAS])
    expect(reM5).toEqual(comM5)
    await c.query(sqlDesfazer())
    const depois = await foto(c, [...assinaturasAntigas, ...NOVAS])
    for (const a of assinaturasAntigas) expect(depois[a], a).toEqual(base[a])
    for (const n of NOVAS) expect(depois[n], n).toBeNull()

    await aplicarM5(c)  // volta
    expect(await foto(c, [...assinaturasAntigas, ...NOVAS])).toEqual(comM5)
  })

  it('mutante: um desfazer que derruba atraso_itens é pego pela foto', async () => {
    const mutante = sqlDesfazer(DESFAZER.replace('drop function if exists public.obs_archive_aviso(uuid);', 'drop function if exists public.obs_archive_atraso_itens(uuid);'))
    await c.query(mutante)
    const depois = await foto(c, ['public.obs_archive_atraso_itens(uuid)'])
    expect(depois['public.obs_archive_atraso_itens(uuid)']).toBeNull()
  })

  it('o desfazer é atômico e na ordem certa: competitor_hourly_health antes do drop de horaria_desde', () => {
    expect(DESFAZER).toMatch(/^begin;$/m)
    expect(DESFAZER).toMatch(/^commit;$/m)
    expect(DESFAZER.indexOf('create or replace function public.competitor_hourly_health(')).toBeLessThan(DESFAZER.indexOf('drop function if exists public.obs_archive_horaria_desde('))
    expect(DESFAZER).not.toMatch(/drop function if exists public\.(obs_archive_atraso_itens|obs_archive_policy|obs_archive_removed_channel_list|obs_archive_channel_archive_impact|competitor_hourly_health)\b/)
  })
})
