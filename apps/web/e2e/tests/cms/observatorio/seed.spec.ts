// apps/web/e2e/tests/cms/observatorio/seed.spec.ts — smoke of the fidelity seed (no browser page):
// oracle → rows of the localhost site → loadDataset → engine gives the mockup's tab counts.
// The same round trip runs without Playwright in test/integration/observatorio-seed.test.ts.
import '../../../fixtures/server-only-shim' // first: load.ts imports 'server-only'
import { test, expect } from '@playwright/test'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { seedObservatory, seedOwnL2, clearObservatory, localServiceClient, ORACLE_NOW, PERFIS_L2, diaYoutube, somaDias, ownSeedUuid } from '../../../fixtures/observatorio-seed'
import { clearSeeded } from './fidelity'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test('oracle seed loads into the engine with the mockup counts', async () => {
  test.setTimeout(120_000)
  const supabase = localServiceClient()
  const siteId = await getSeedSiteId(supabase)
  await seedObservatory(siteId, {}, supabase)
  try {
    expect(ORACLE_NOW).toBe(Date.parse('2026-10-24T15:02:00-03:00'))
    const obs = createObservatory(await loadDataset({ siteId, now: ORACLE_NOW, supabase }))
    expect(obs.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
  } finally {
    // also forgets the fidelity specs' seed marker: the site no longer holds what it says
    await clearSeeded()
  }
})

/** Conta as linhas das quatro tabelas privadas do site (só o que a semente escreve: filtra pelo canal). */
async function privado(sb: ReturnType<typeof localServiceClient>, siteId: string, canalId: string) {
  const ler = async (t: string, cols: string) => {
    const r = await sb.from(t).select(cols).eq('site_id', siteId).eq('channel_id', canalId).limit(5000)
    if (r.error) throw new Error(t + ': ' + r.error.message)
    return r.data as unknown as Array<Record<string, unknown>>
  }
  return {
    jobs: await ler('yt_reporting_jobs', 'job_id, status'),
    rels: await ler('yt_reporting_reports', 'report_id, status, start_time, normalized_at'),
    reach: await ler('yt_own_video_reach_daily', 'youtube_video_id, video_id, day_pt, thumbnail_impressions, thumbnail_ctr, source_report_id'),
    diario: await ler('yt_own_video_daily', 'youtube_video_id, day_pt, views'),
  }
}

test('ownL2: a semente do dado privado escreve o que o perfil diz (datas relativas ao relógio do oráculo) e a limpeza deixa as tabelas vazias', async () => {
  test.setTimeout(120_000)
  const supabase = localServiceClient()
  const siteId = await getSeedSiteId(supabase)
  const canal = ownSeedUuid(siteId, 'tnfigueiredo')
  const hoje = diaYoutube(ORACLE_NOW)
  expect(hoje).toBe('2026-10-24')
  try {
    // sem ownL2: nenhuma linha (as telas dizem "ainda sem relatório")
    await seedObservatory(siteId, {}, supabase)
    let p = await privado(supabase, siteId, canal)
    expect([p.jobs.length, p.rels.length, p.reach.length, p.diario.length]).toEqual([0, 0, 0, 0])

    // cheio: 29 dias terminando 3 dias antes do relógio, 11 com impressão, 8 vazios, 10 listados
    await seedObservatory(siteId, { ownL2: 'cheio' }, supabase)
    p = await privado(supabase, siteId, canal)
    expect(p.jobs).toHaveLength(1)
    expect(p.rels).toHaveLength(29)
    const dias = p.rels.map(r => String(r.start_time).slice(0, 10)).sort()
    expect(dias[0]).toBe(somaDias(hoje, -3 - 28))
    expect(dias[28]).toBe(somaDias(hoje, -3))
    expect(new Set(dias).size).toBe(29)
    const por = (st: string) => p.rels.filter(r => r.status === st)
    expect([por('baixado').length, por('vazio').length, por('listado').length]).toEqual([11, 8, 10])
    for (const r of por('listado')) expect(r.normalized_at).toBeNull()
    for (const r of [...por('baixado'), ...por('vazio')]) expect(r.normalized_at).not.toBeNull()
    // alcance: 6 vídeos, só nos 11 dias baixados, um CTR nulo, todos apontando para um relatório semeado e baixado
    expect(new Set(p.reach.map(r => r.youtube_video_id)).size).toBe(6)
    const baixados = new Set(por('baixado').map(r => String(r.start_time).slice(0, 10)))
    expect(new Set(p.reach.map(r => r.day_pt))).toEqual(baixados)
    expect(p.reach.filter(r => r.thumbnail_ctr == null)).toHaveLength(1)
    expect(p.reach.every(r => Number(r.thumbnail_impressions) > 0)).toBe(true)
    const ids = new Set(p.rels.map(r => r.report_id))
    expect(p.reach.every(r => ids.has(r.source_report_id))).toBe(true)
    // diário: 28 dias de cada longo, três vídeos com views, o resto zero medido (linha com 0)
    const dd = new Set(p.diario.map(r => r.day_pt))
    expect(dd.size).toBe(28)
    expect([...dd].sort()[27]).toBe(somaDias(hoje, -3))
    const vids = new Set(p.diario.map(r => r.youtube_video_id))
    expect(p.diario).toHaveLength(vids.size * 28)
    const comViews = new Set(p.diario.filter(r => Number(r.views) > 0).map(r => r.youtube_video_id))
    expect(comViews.size).toBe(3)
    expect(vids.size).toBeGreaterThan(6)
    expect(p.diario.filter(r => r.views == null)).toHaveLength(0)

    // os outros perfis, sem reescrever o oráculo
    await seedOwnL2(siteId, 'curto', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    expect([p.rels.length, new Set(p.diario.map(r => r.day_pt)).size]).toEqual([2, 2])
    await seedOwnL2(siteId, 'parado', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    expect(p.rels).toHaveLength(29)
    expect(p.rels.every(r => r.status === 'vazio')).toBe(true)
    expect(p.reach).toHaveLength(0)
    expect(p.diario.length).toBeGreaterThan(0)
    expect(p.diario.every(r => Number(r.views) === 0)).toBe(true)
    await seedOwnL2(siteId, 'velho', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    expect(p.rels.map(r => String(r.start_time).slice(0, 10)).sort().at(-1)).toBe(somaDias(hoje, -12))
    await seedOwnL2(siteId, 'ativo', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    expect(p.reach.every(r => r.thumbnail_ctr != null)).toBe(true)
    expect(new Set(p.diario.filter(r => Number(r.views) > 0).map(r => r.youtube_video_id)).size).toBeGreaterThan(10)
    // grande: o mesmo que ativo, com impressões de 4 dígitos (a base 2713 entra em toda linha de alcance)
    await seedOwnL2(siteId, 'grande', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    expect(p.reach.length).toBeGreaterThan(0)
    expect(p.reach.every(r => Number(r.thumbnail_impressions) >= 2713 + 40)).toBe(true)
    expect(p.reach.filter(r => r.video_id == null).map(r => r.youtube_video_id)).toEqual(['orfaoRel001'])
    // lacunas: 4 longos com só 5 dias de diário e um vídeo com alcance e SEM diário
    await seedOwnL2(siteId, 'lacunas', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    const linhasPorVideo = new Map<string, number>()
    for (const r of p.diario) linhasPorVideo.set(String(r.youtube_video_id), (linhasPorVideo.get(String(r.youtube_video_id)) ?? 0) + 1)
    expect([...linhasPorVideo.values()].filter(n => n === 5)).toHaveLength(4)
    expect([...linhasPorVideo.values()].filter(n => n === 28).length).toBeGreaterThan(10)
    expect([...new Set(p.reach.map(r => String(r.youtube_video_id)))].filter(y => !linhasPorVideo.has(y)).length).toBeGreaterThanOrEqual(1)
    expect(Object.keys(PERFIS_L2).sort()).toEqual(['ativo', 'cheio', 'curto', 'grande', 'lacunas', 'parado', 'velho'])
  } finally {
    await clearObservatory(siteId, supabase)
    const depois = await privado(supabase, siteId, canal)
    expect([depois.jobs.length, depois.rels.length, depois.reach.length, depois.diario.length]).toEqual([0, 0, 0, 0])
    await clearSeeded()
  }
})
