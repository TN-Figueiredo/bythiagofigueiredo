// @vitest-environment node
/**
 * A/B Lab S8-F1 (Task 5, C-3/C-3b/C-4, B2): `rodarRetrato` contra o `bythiago_int`. Banco: SÓ o 54422:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f1-retrato.test.ts --no-file-parallelism
 * O banco tem testes de outras suítes: toda asserção filtra pelo test_id semeado aqui.
 */
import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q } from '../helpers/db-seed'
import { rodarRetrato } from '@/lib/youtube/ab-gravacao/retrato-step'
import { janelaDesde } from '@/lib/youtube/ab-gravacao/retrato'
import { addDays, boundsAnalytics, ontemPt, dayPt } from '@/lib/youtube/coleta/day-pt'

vi.setConfig({ testTimeout: 120_000 })

const DIA_MS = 86_400_000
const ha = (d: number, de = Date.now()) => new Date(de - d * DIA_MS).toISOString()

interface Semente { testId: string; varA: string; varB: string; siteId: string; vid: string; canal: string }

async function semear(inicioDiasAtras: number, status = 'active', fimDiasAtras: number | null = null): Promise<Semente> {
  const t = await semearTesteAb({ cicloAberto: null, status: status as 'active' })
  const [v] = await q<{ vid: string; canal: string }>(
    'select yv.youtube_video_id as vid, yv.channel_id as canal from ab_tests a join youtube_videos yv on yv.id = a.youtube_video_id where a.id = $1', [t.testId])
  await q('update ab_tests set started_at = $2 where id = $1', [t.testId, ha(inicioDiasAtras)])
  await q('insert into ab_test_cycles (test_id, variant_id, cycle_number, started_at, ended_at) values ($1, $2, 0, $3, $4)',
    [t.testId, t.varA, ha(inicioDiasAtras), fimDiasAtras === null ? null : ha(fimDiasAtras)])
  return { ...t, vid: v!.vid, canal: v!.canal }
}

async function relatorio(s: Semente, day: string, status: string, normalizado: boolean, createOffsetH = 0): Promise<void> {
  const b = boundsAnalytics(day)
  await q(`insert into yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, is_backfill, status, download_attempts, normalized_at)
           values ($1, $2, 'job1', $3, 'channel_reach_basic_a1', $4, $5, $6, 'https://example.test/r', false, $7, 0, $8)`,
  [randomUUID(), s.siteId, s.canal, new Date(b.start).toISOString(), new Date(b.end).toISOString(), new Date(b.end + (createOffsetH + 12) * 3_600_000).toISOString(), status, normalizado ? new Date().toISOString() : null])
}

async function alcance(s: Semente, day: string, imp: number): Promise<void> {
  await q(`insert into yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, channel_id, thumbnail_impressions, thumbnail_ctr, source_report_id, report_create_time, source, collected_at, metric_version)
           values ($1, $2, $3, $4, $5, 0.05, 'rep-x', now(), 'reporting_api', now(), 'views_desde_2026-08-27') on conflict (youtube_video_id, day_pt) do update set thumbnail_impressions = excluded.thumbnail_impressions`,
  [s.vid, day, s.siteId, s.canal, imp]).catch((e) => { throw new Error(`alcance: ${e.message}`) })
}

const linhas = (testId: string) => q<Record<string, any>>('select * from ab_test_dias where test_id = $1 order by day_pt', [testId]) // eslint-disable-line @typescript-eslint/no-explicit-any
const porDia = (ls: Array<Record<string, any>>, day: string) => ls.find((l) => l.day_pt.toISOString?.().slice(0, 10) === day || l.day_pt === day) // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(skipIfNoLocalDb())('S8-F1 Task 5: rodarRetrato contra o banco', () => {
  it('C-3: estado do alcance por dia (aguardando, zero_medido, velho+novo, ausente_no_relatorio, expirado)', async () => {
    const s = await semear(6)
    const ontem = ontemPt(new Date())
    const d = (n: number) => addDays(ontem, -n)
    await relatorio(s, d(4), 'vazio', true)
    await relatorio(s, d(3), 'vazio', true, 0)
    await relatorio(s, d(3), 'listado', false, 5)
    await relatorio(s, d(2), 'baixado', true)
    await relatorio(s, d(1), 'expirado_sem_baixar', false)
    const r = await rodarRetrato(clienteServico(), new Date())
    expect(r.status === 'error' ? r.error : 'ok').toBe('ok')
    const ls = await linhas(s.testId)
    const est = (n: number) => porDia(ls, d(n))?.alcance_estado
    expect(est(5)).toBe('aguardando')
    expect(est(4)).toBe('zero_medido')
    expect(est(3)).toBe('aguardando')
    expect(est(2)).toBe('ausente_no_relatorio')
    expect(est(1)).toBe('nao_medido')
    expect(ls.every((l) => l.final === false)).toBe(true)
  })

  it('C-4: meta apagada vira variante nula com meta_ausente (nunca a variante do ciclo)', async () => {
    const s = await semear(3)
    const ontem = ontemPt(new Date())
    await q(`insert into yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, ab_test_id, ab_variant_id, seconds_on_air_analytics, captured_at)
             values ($1, $2, $3, $4, $5, $6, 86000, now())`, [s.vid, ontem, s.siteId, s.canal, s.testId, s.varA])
    await rodarRetrato(clienteServico(), new Date())
    expect(porDia(await linhas(s.testId), ontem)?.variant_id).toBe(s.varA)
    await q('delete from yt_own_video_meta_daily where youtube_video_id = $1 and day_pt = $2', [s.vid, ontem])
    await rodarRetrato(clienteServico(), new Date())
    const l = porDia(await linhas(s.testId), ontem)
    expect(l?.variant_id).toBeNull()
    expect(l?.motivo_sem_variante).toBe('meta_ausente')
  })

  it('C-3b: linha final não muda na 2ª rodada; as abertas mudam só o número e o retratado_em', async () => {
    const s = await semear(12)
    const ontem = ontemPt(new Date())
    await alcance(s, addDays(ontem, -10), 50)
    await alcance(s, addDays(ontem, -3), 100)
    const t1 = new Date()
    await rodarRetrato(clienteServico(), t1)
    const antes = await linhas(s.testId)
    expect(porDia(antes, addDays(ontem, -10))).toMatchObject({ final: true, impressoes: '50' })
    expect(porDia(antes, addDays(ontem, -3))).toMatchObject({ final: false, impressoes: '100' })
    await alcance(s, addDays(ontem, -10), 999)
    await alcance(s, addDays(ontem, -3), 300)
    const t2 = new Date(t1.getTime() + 60_000)
    await rodarRetrato(clienteServico(), t2)
    const depois = await linhas(s.testId)
    expect(porDia(depois, addDays(ontem, -10))).toEqual(porDia(antes, addDays(ontem, -10)))
    const aberta = porDia(depois, addDays(ontem, -3))!
    expect(aberta.impressoes).toBe('300')
    expect(aberta.retratado_em.toISOString()).toBe(t2.toISOString())
  })

  it('teste completed às 00:30 PT e 11 rodadas diárias: todas as linhas viram final', async () => {
    const s = await semear(4, 'completed', 2)
    const meiaNoite = boundsAnalytics(dayPt(new Date(Date.now() - 2 * DIA_MS))).start
    await q("update ab_tests set completed_at = $2, completed_reason = 'manual_apply' where id = $1", [s.testId, new Date(meiaNoite + 30 * 60_000).toISOString()])
    const base = Date.now()
    for (let k = 0; k <= 11; k++) {
      const r = await rodarRetrato(clienteServico(), new Date(base + k * DIA_MS))
      expect(r.status === 'error' ? r.error : 'ok').toBe('ok')
    }
    const ls = await linhas(s.testId)
    expect(ls.length).toBeGreaterThan(0)
    expect(ls.every((l) => l.final === true)).toBe(true)
    expect(ls.every((l) => l.alcance_estado === 'nao_medido')).toBe(true)
  })

  it('teste apagado com linhas abertas: nenhuma fica aguardando para sempre', async () => {
    const s = await semear(4)
    await rodarRetrato(clienteServico(), new Date())
    expect((await linhas(s.testId)).some((l) => l.alcance_estado === 'aguardando')).toBe(true)
    await q('delete from ab_tests where id = $1', [s.testId])
    const r = await rodarRetrato(clienteServico(), new Date())
    expect(r.status === 'ok' && r.fechadas_apagados).toBeGreaterThan(0)
    const ls = await linhas(s.testId)
    expect(ls.length).toBeGreaterThan(0)
    expect(ls.every((l) => l.final === true && l.alcance_estado !== 'aguardando')).toBe(true)
    expect(ls.some((l) => l.motivo_sem_variante === 'teste_apagado')).toBe(true)
  })

  it('B2: linha aberta antiga demais vira final/nao_medido sem tocar a variante', async () => {
    const s = await semear(3)
    const antigo = addDays(janelaDesde(ontemPt(new Date())), -20)
    const variante = randomUUID()
    await q(`insert into ab_test_dias (test_id, day_pt, site_id, youtube_video_id, regra_duracao, variant_id, segundos_no_ar, segundos_do_dia, dia_de_troca, ciclos, alcance_estado, views_estado, retratado_em, final)
             values ($1, $2, $3, $4, 'v1', $5, 80000, 86400, false, '[{"id":"c","started_at":"2026-01-01T00:00:00Z","ended_at":null}]'::jsonb, 'aguardando', 'nao_medido', now(), false)`,
    [s.testId, antigo, s.siteId, s.vid, variante])
    await rodarRetrato(clienteServico(), new Date())
    const l = porDia(await linhas(s.testId), antigo)
    expect(l).toMatchObject({ final: true, alcance_estado: 'nao_medido', variant_id: variante })
    const todas = await linhas(s.testId)
    expect(todas.filter((x) => x.final && x.alcance_estado !== 'nao_medido' && x.day_pt !== antigo)).toHaveLength(0)
  })

  it('só escreve em ab_test_dias: ab_tests e ciclos do teste ficam como estavam', async () => {
    const s = await semear(3)
    const antes = await q('select updated_at, status, completed_reason from ab_tests where id = $1', [s.testId])
    const ciclosAntes = await q('select * from ab_test_cycles where test_id = $1', [s.testId])
    await rodarRetrato(clienteServico(), new Date())
    expect(await q('select updated_at, status, completed_reason from ab_tests where id = $1', [s.testId])).toEqual(antes)
    expect(await q('select * from ab_test_cycles where test_id = $1', [s.testId])).toEqual(ciclosAntes)
  })
})
