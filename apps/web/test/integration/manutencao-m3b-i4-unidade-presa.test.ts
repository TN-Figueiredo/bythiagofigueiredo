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

  const payload = (canal: string, hash: string, n: number, partes: number, shaParte = HEX('e')): string => JSON.stringify({
    classe: 'serie', tabela: DAILY, canal, mes: MES, row_count: n, control_sum: null, hash_conteudo: hash, schema_fp: HEX('b'),
    sha256_bytes: HEX('c'), csv_sha256: HEX('d'), file_bytes: 100, partes, min_key: null, max_key: null,
    parts: Array.from({ length: partes }, (_, i) => ({ parte: i + 1, sha256_bytes: shaParte, csv_sha256: HEX('f'), file_bytes: 50, row_count: i === 0 ? n - (partes - 1) : 1,
      control_sum: null, row_offset: i === 0 ? 0 : n - (partes - 1) + i - 1, min_key: null, max_key: null })),
  })
  const gravar = async (site: string, p: string): Promise<{ status: string; arquivo_id?: string }> =>
    (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [site, p])).rows[0].r

  async function preparar(): Promise<{ site: string; canal: string; hash: string; n: number }> {
    const { site, canal, videos } = await semearCanal(c, { videos: 3 })
    await semearDiaria(c, videos, '2026-10-01', 5)
    const l = (await c.query(`select * from public.obs_archive_read_unit($1, 'serie', $2, $3, $4::date, 0, 1000)`, [site, DAILY, canal, MES])).rows[0]
    return { site, canal, n: Number(l.row_count), hash: l.hash_conteudo as string }
  }
  async function semear(partes: number): Promise<{ site: string; canal: string; id: string; hash: string; n: number }> {
    const { site, canal, hash, n } = await preparar()
    const r = await gravar(site, payload(canal, hash, n, partes))
    expect(r.status).toBe('nova')
    return { site, canal, id: r.arquivo_id!.slice(2), hash, n }
  }

  const receberParte1 = (id: string) => c.query(`update public.obs_archive_unit_parts set received_at = now(), received_sha256 = sha256_bytes, received_row_count = row_count where unit_id = $1 and part = 1`, [id])

  // Yannis I1: regravar na mesma versão colidiria com a parte 1 que já está no NAS (divergente falso). Vai para a v+1.
  it.each(['parte_mudou', 'mudou_durante_a_leitura'])('parte 1 recebida + %s + mesmo hash: abre a versão 2 e o receive seguinte não dá divergente', async (marca) => {
    await emTx(async () => {
      const u = await semear(2)
      await receberParte1(u.id)
      await c.query(`update public.obs_archive_units set redo_reason = $2 where id = $1`, [u.id, marca])
      const SHA_NOVO = HEX('9')
      const r = await gravar(u.site, payload(u.canal, u.hash, u.n, 2, SHA_NOVO))
      expect(r.status).toBe('nova')
      expect(r.arquivo_id).not.toBe('u:' + u.id)
      const v2 = r.arquivo_id!.slice(2)
      expect(await escalar<number>(c, `select version from public.obs_archive_units where id = $1`, [v2])).toBe(2)
      // a v1 guarda o registro do que está no NAS
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1 and received_at is not null`, [u.id])).toBe(1)
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1`, [v2])).toBe(2)
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1 and received_at is not null`, [v2])).toBe(0)
      // sonda: o copiador informa a parte 1 com o sha novo
      const rec = (await c.query(`select public.obs_archive_receive($1, $2::jsonb) as r`,
        [u.site, JSON.stringify([{ arquivo_id: `p:${v2}:01`, sha256: SHA_NOVO, bytes: 50, linhas: u.n - 1, soma: null }])])).rows[0].r
      expect(JSON.stringify(rec)).toContain('recebida')
      expect(JSON.stringify(rec)).not.toContain('divergente')
      expect(await escalar<string | null>(c, `select redo_reason from public.obs_archive_units where id = $1`, [v2])).toBeNull()
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1 and received_at is not null`, [v2])).toBe(1)
    })
  })

  // Phil I1: lote de recibos partido (parte 1 recebida, parte 2 não, sem marca). Partes batem -> mesma sem apagar nada; senão nao_devida.
  it('sem marca, recebimento parcial e partes iguais ao payload: mesma, nada apagado, a parte 2 segue devida', async () => {
    await emTx(async () => {
      const u = await semear(2)
      await receberParte1(u.id)
      const r = await gravar(u.site, payload(u.canal, u.hash, u.n, 2))
      expect(r.status).toBe('mesma')
      expect(r.arquivo_id).toBe('u:' + u.id)
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1 and received_at is not null`, [u.id])).toBe(1)
      const info = (await c.query(`select public.obs_archive_unit_part_info($1, 'serie', $2, $3, $4::date, 2) as r`, [u.site, DAILY, u.canal, MES])).rows[0].r
      expect(info.status).toBe('ok')
    })
  })

  it('sem marca, recebimento parcial e sha da parte 1 diferente do payload: segue nao_devida (M16), nada apagado', async () => {
    await emTx(async () => {
      const u = await semear(2)
      await receberParte1(u.id)
      const r = await gravar(u.site, payload(u.canal, u.hash, u.n, 2, HEX('9')))
      expect(r.status).toBe('nao_devida')
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_unit_parts where unit_id = $1 and received_at is not null`, [u.id])).toBe(1)
    })
  })

  // Yannis M1 = Phil m1: a guarda vale para a primeira gravação
  it('primeira gravação com partes 2 e 1 item em parts: partes_invalidas, nenhuma unidade gravada', async () => {
    await emTx(async () => {
      const u = await preparar()
      const ruim = JSON.parse(payload(u.canal, u.hash, u.n, 2)) as { parts: unknown[] }
      ruim.parts = ruim.parts.slice(0, 1)
      const r = await tenta(c, `select public.obs_archive_record($1, 'unidade', $2::jsonb)`, [u.site, JSON.stringify(ruim)])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/partes_invalidas/)
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_units where site_id = $1`, [u.site])).toBe(0)
    })
  })

  it('dado ausente: parte_mudou com parte recebida e payload que declara 2 partes mas manda 1 falha alto, sem apagar as partes', async () => {
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
