// @vitest-environment node
/**
 * A5 · E9, Tarefa 11b: "sem resposta o dado fica", 400 dias à frente. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e9-400-dias.test.ts --no-file-parallelism
 *
 * Semeia (commit de verdade, porque a poda de retratos fala com o banco pela API) um vídeo ausente e um canal ausente, ambos SEM decisão,
 * com série, primeiras horas, versões (com URL do Blob), histórico de campo, bruto e comentário com identidade. Com o relógio 400 dias à frente,
 * roda cada rotina que existe no banco e apaga de `competitor_*` ou é chamada pelo cron de concorrentes. Contagem por tabela igual, com UMA
 * exceção escrita aqui: a linha de identidade do autor some aos 28 dias (lista de 9.2, linha 3; decisão 20 do dono). `afterAll` apaga o que criou.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY, SUPABASE_URL } from '../helpers/db-seed'
import { semearCena, escalar, type Cena } from '../helpers/mg6'
import { podarRetratosDeCanal } from '@/lib/youtube/competitor-snapshot-prune'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIA = 86_400_000

const TABELAS_DO_VIDEO: Array<[string, string]> = [
  ['competitor_video_daily', 'video_id'], ['competitor_video_early', 'video_id'], ['competitor_video_hourly', 'video_id'],
  ['competitor_video_versions', 'video_id'], ['competitor_field_versions', 'video_id'], ['competitor_raw', 'video_id'],
  ['competitor_changes', 'video_id'], ['competitor_hour_fold_log', 'video_id'], ['competitor_video_comment_snaps', 'video_id'],
  ['competitor_video_tier_spans', 'video_id'], ['competitor_video_comments', 'video_id'], ['competitor_readings', 'video_id'],
]
const TABELAS_DO_CANAL: Array<[string, string]> = [
  ['competitor_channel_snapshots', 'competitor_channel_id'], ['competitor_field_versions', 'competitor_channel_id'], ['competitor_raw', 'competitor_channel_id'],
  ['competitor_channel_hour_map', 'competitor_channel_id'], ['competitor_video_comments', 'competitor_channel_id'],
]

describe.skipIf(skipIfNoLocalDb())('A5 E9 Tarefa 11b: 400 dias depois, o ausente sem resposta tem as mesmas linhas (commit de verdade, limpeza no fim)', () => {
  let pg: Client
  let c: Cena
  const api = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const aMais400 = `now() + interval '400 days'`

  const n = (tabela: string, coluna: string, id: string) => escalar<number>(pg, `select count(*)::int from public.${tabela} where ${coluna} = $1`, [id])
  async function contagens(): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const [id, rotulo] of [[c.videoA, 'videoA'], [c.videoB, 'videoB']] as const) {
      for (const [t, col] of TABELAS_DO_VIDEO) out[`${rotulo}:${t}`] = await n(t, col, id)
    }
    for (const [t, col] of TABELAS_DO_CANAL) out[`canalB:${t}`] = await n(t, col, c.canalB)
    out['autores_do_site'] = await escalar<number>(pg, `select count(*)::int from public.competitor_video_comment_authors where site_id = $1`, [c.site])
    return out
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    c = await semearCena(pg)
    // retratos de 400 dias: um do canal ausente (B) e um do canal no ar (A)
    await pg.query(`insert into public.competitor_channel_snapshots (competitor_channel_id, snapshot_date, view_count) values ($1, current_date - 400, 1), ($2, current_date - 400, 1)`, [c.canalB, c.canalA])
    // o vídeo A saiu do YouTube; o canal B inteiro saiu; nenhum dos dois tem decisão
    await pg.query(`update public.competitor_videos set missing_since = current_date - 5 where id = $1`, [c.videoA])
    await pg.query(`update public.competitor_channels set missing_since = current_date - 5 where id = $1`, [c.canalB])
  })
  afterAll(async () => {
    if (!c) { await pg.end(); return }
    try {
      await pg.query(`delete from public.audit_log where site_id = $1`, [c.site])
      await pg.query(`delete from public.competitor_removed_items where site_id = $1`, [c.site])
      await pg.query(`delete from public.youtube_intelligence_tasks where site_id = $1`, [c.site])
      await pg.query(`delete from public.youtube_niches where site_id = $1`, [c.site])
      await apagarCanais(pg, 'site_id = $1', [c.site])
      await apagarSites(pg, 'id = $1', [c.site])
      await pg.query(`delete from public.organizations where id = $1`, [c.org])
      await pg.query(`delete from auth.users where id in ($1, $2)`, [c.admin, c.comum])
    } catch (e) { console.error('limpeza da 400-dias falhou', c.site, e instanceof Error ? e.message : e) }
    await pg.end()
  })

  it('a semente tem linha em cada tabela da lista (senão contar 0 com 0 não prova nada)', async () => {
    const antes = await contagens()
    for (const [k, v] of Object.entries(antes)) expect(v, k).toBeGreaterThan(0)
    expect(antes['autores_do_site']).toBeGreaterThan(0)
  })

  it('com o relógio 400 dias à frente, cada rotina roda e as linhas do vídeo e do canal ausentes são as mesmas; só a identidade do autor some', async () => {
    const antes = await contagens()

    // as rotinas que existem no banco e que o cron de concorrentes chama (ou que apagam de competitor_*)
    const prova = await escalar<Record<string, number>>(pg, `select public.competitor_missing_proof($1, ${aMais400})`, [c.site])
    expect(prova.videos_ausentes).toBeGreaterThanOrEqual(2)
    expect(prova.ausentes_com_queda).toBe(0)
    await pg.query(`select public.competitor_capture_health($1, ${aMais400})`, [c.site])
    await pg.query(`select public.competitor_series_health($1, ${aMais400})`, [c.site])
    await pg.query(`select public.competitor_agenda_lease_release($1, $2)`, ['n6-400-dias', randomUUID()])
    // a identidade do autor vence em 28 dias: a linha vencida sai (a única exceção); o comentário, não
    await pg.query(`update public.competitor_video_comment_authors set expires_at = now() - interval '1 day' where site_id = $1`, [c.site])
    const purga = await escalar<Record<string, number>>(pg, `select public.competitor_comment_identity_purge($1)`, [c.site])
    expect(purga.apagadas).toBeGreaterThan(0)
    // a poda de retratos de canal, com o relógio 400 dias à frente (cliente da API, como no ab-watchdog)
    const poda = await podarRetratosDeCanal(api, Date.now() + 400 * DIA)
    expect(poda).toEqual({ ok: true })

    const depois = await contagens()
    const esperado = { ...antes, autores_do_site: 0 }
    expect(depois).toEqual(esperado)
    // os retratos do canal ausente ficam (inclusive o de 400 dias); os do canal no ar saem
    expect(await n('competitor_channel_snapshots', 'competitor_channel_id', c.canalB)).toBe(antes['canalB:competitor_channel_snapshots'])
    expect(await n('competitor_channel_snapshots', 'competitor_channel_id', c.canalA)).toBe(0)
    expect((await escalar<Record<string, number>>(pg, `select public.competitor_missing_proof($1, ${aMais400})`, [c.site])).ausentes_com_queda).toBe(0)
  })

  it('o caso inverso: um delete direto de uma linha de série faz ausentes_com_queda = 1', async () => {
    await pg.query(`delete from public.competitor_video_daily where video_id = $1 and snap_date = (select min(snap_date) from public.competitor_video_daily where video_id = $1)`, [c.videoA])
    const prova = await escalar<Record<string, number>>(pg, `select public.competitor_missing_proof($1, ${aMais400})`, [c.site])
    expect(prova.ausentes_com_queda).toBe(1)
  })
})
