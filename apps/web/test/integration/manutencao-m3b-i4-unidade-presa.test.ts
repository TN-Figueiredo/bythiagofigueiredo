// apps/web/test/integration/manutencao-m3b-i4-unidade-presa.test.ts
// @vitest-environment node
/**
 * M3b-I4 (Yannis, revisão T11): `parte_mudou` com uma parte já recebida prendia a unidade para sempre (record_core devolvia nao_devida).
 * Banco: SÓ o `bythiago_int` (54422). Tudo em `begin … rollback`. Com o rascunho supabase/rascunhos/m3b-i4.sql aplicado, passa.
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/manutencao-m3b-i4-unidade-presa.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, escalar, semearCanal, semearDiaria, tenta } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const DAILY = 'competitor_video_daily'
const HEX = (n: string): string => n.repeat(64).slice(0, 64)
const RASCUNHO = resolve(__dirname, '../../../../supabase/rascunhos/m3b-i4.sql')

describe.skipIf(skipIfNoLocalDb())('M3b-I4: parte_mudou com parte recebida não prende a unidade', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })

  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')   // TRAVA_DDL_TESTES na 1ª instrução
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 5)
      // O rascunho só entra quando I4_APLICAR=1: sem ele o teste roda contra o SQL vigente (o vermelho).
      if (process.env.I4_APLICAR === '1' && existsSync(RASCUNHO)) await c.query(readFileSync(RASCUNHO, 'utf8'))
      await c.query(`select set_config('obs_archive.hoje', '2026-11-28', true)`)
      return await fn()
    } finally { await c.query('rollback') }
  }

  const payload = (canal: string, hash: string, n: number, partes: number): string => JSON.stringify({
    classe: 'serie', tabela: DAILY, canal, mes: MES, row_count: n, control_sum: null, hash_conteudo: hash, schema_fp: HEX('b'),
    sha256_bytes: HEX('c'), csv_sha256: HEX('d'), file_bytes: 100, partes, min_key: null, max_key: null,
    parts: Array.from({ length: partes }, (_, i) => ({ parte: i + 1, sha256_bytes: HEX('e'), csv_sha256: HEX('f'), file_bytes: 50, row_count: i === 0 ? n - (partes - 1) : 1,
      control_sum: null, row_offset: i === 0 ? 0 : n - (partes - 1) + i - 1, min_key: null, max_key: null })),
  })
  const gravar = async (site: string, p: string): Promise<{ status: string; arquivo_id?: string }> =>
    (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [site, p])).rows[0].r

  async function semear(partes: number): Promise<{ site: string; canal: string; id: string; hash: string; n: number }> {
    const { site, canal, videos } = await semearCanal(c, { videos: 3 })
    await semearDiaria(c, videos, '2026-10-01', 5)
    const l = (await c.query(`select * from public.obs_archive_read_unit($1, 'serie', $2, $3, $4::date, 0, 1000)`, [site, DAILY, canal, MES])).rows[0]
    const n = Number(l.row_count), hash = l.hash_conteudo as string
    const r = await gravar(site, payload(canal, hash, n, partes))
    expect(r.status).toBe('nova')
    return { site, canal, id: r.arquivo_id!.slice(2), hash, n }
  }

  it('parte 1 recebida + redo_reason parte_mudou + mesmo hash: regrava as partes, nunca nao_devida', async () => {
    await emTx(async () => {
      const u = await semear(2)
      await c.query(`update public.obs_archive_unit_parts set received_at = now(), received_sha256 = sha256_bytes, received_row_count = row_count where unit_id = $1 and part = 1`, [u.id])
      await c.query(`update public.obs_archive_units set redo_reason = 'parte_mudou' where id = $1`, [u.id])
      const r = await gravar(u.site, payload(u.canal, u.hash, u.n, 2))
      expect(r.status).toBe('mesma')
      expect(r.arquivo_id).toBe('u:' + u.id)
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1`, [u.id])).toBe(2)
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1 and received_at is not null`, [u.id])).toBe(0)
      expect(await escalar<string | null>(c, `select redo_reason from public.obs_archive_units where id = $1`, [u.id])).toBeNull()
    })
  })

  it('sem marca (redo_reason nulo) a parte recebida segue nao_devida (M16, a retentativa do copiador)', async () => {
    await emTx(async () => {
      const u = await semear(2)
      await c.query(`update public.obs_archive_unit_parts set received_at = now(), received_sha256 = sha256_bytes, received_row_count = row_count where unit_id = $1 and part = 1`, [u.id])
      const r = await gravar(u.site, payload(u.canal, u.hash, u.n, 2))
      expect(r.status).toBe('nao_devida')
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1 and received_at is not null`, [u.id])).toBe(1)
    })
  })

  it('dado ausente: parte_mudou e payload que declara 2 partes mas manda 1 falha alto, sem apagar as partes', async () => {
    await emTx(async () => {
      const u = await semear(2)
      await c.query(`update public.obs_archive_unit_parts set received_at = now(), received_sha256 = sha256_bytes, received_row_count = row_count where unit_id = $1 and part = 1`, [u.id])
      await c.query(`update public.obs_archive_units set redo_reason = 'parte_mudou' where id = $1`, [u.id])
      const ruim = JSON.parse(payload(u.canal, u.hash, u.n, 2)) as { parts: unknown[] }
      ruim.parts = ruim.parts.slice(0, 1)
      const r = await tenta(c, `select public.obs_archive_record($1, 'unidade', $2::jsonb)`, [u.site, JSON.stringify(ruim)])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/partes_invalidas/)
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1`, [u.id])).toBe(2)
    })
  })
})
