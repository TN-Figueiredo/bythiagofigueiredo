// apps/web/e2e/tests/cms/observatorio/seed.spec.ts — smoke of the fidelity seed (no browser page):
// oracle → rows of the localhost site → loadDataset → engine gives the mockup's tab counts.
// The same round trip runs without Playwright in test/integration/observatorio-seed.test.ts.
import '../../../fixtures/server-only-shim' // first: load.ts imports 'server-only'
import { test, expect } from '@playwright/test'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { seedObservatory, seedOwnL2, clearObservatory, localServiceClient, ORACLE_NOW, PERFIS_L2, MAPA_RETENCAO, RET, RET_1139, RET_MAGRO, RET_DIA_1139, RET_DIA_MAGRO, diaYoutube, somaDias, ownSeedUuid } from '../../../fixtures/observatorio-seed'
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
    diario: await ler('yt_own_video_daily', 'youtube_video_id, day_pt, views, avg_view_percentage, avg_view_duration_seconds'),
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
    // todo perfil com views grava % assistido e duração média no dia COM view e nulos no dia sem view (como a coleta); a unidade é de 0 a 100 em diante
    for (const perfil of ['cheio', 'curto', 'ativo', 'grande', 'lacunas', 'velho'] as const) {
      await seedOwnL2(siteId, perfil, undefined, supabase)
      p = await privado(supabase, siteId, canal)
      const com = p.diario.filter(r => Number(r.views) > 0), sem = p.diario.filter(r => Number(r.views) === 0)
      expect(com.length, perfil).toBeGreaterThan(0)
      expect(com.every(r => r.avg_view_percentage != null && r.avg_view_duration_seconds != null && Number(r.avg_view_percentage) > 0), perfil + ': dia com view tem os dois').toBe(true)
      expect(sem.length, perfil + ': há dia com 0 view entre os dias com view').toBeGreaterThan(0)
      expect(sem.every(r => r.avg_view_percentage == null && r.avg_view_duration_seconds == null), perfil + ': dia sem view tem os dois nulos').toBe(true)
    }
    await seedOwnL2(siteId, 'parado', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    expect(p.diario.every(r => r.avg_view_percentage == null)).toBe(true)
    // um dia acima de 100% no perfil cheio (e só um)
    await seedOwnL2(siteId, 'cheio', undefined, supabase)
    p = await privado(supabase, siteId, canal)
    expect(p.diario.filter(r => Number(r.avg_view_percentage) > 100).map(r => Number(r.avg_view_percentage))).toEqual([139.38])

    // retencao: o perfil desenhado (casos da prova em navegador). Idempotente: semear duas vezes dá o mesmo.
    await seedOwnL2(siteId, 'retencao', undefined, supabase)
    const lerRet = async () => { const q = await privado(supabase, siteId, canal); return JSON.stringify([q.rels, q.reach, q.diario].map(a => a.map(r => JSON.stringify(r)).sort())) }
    const umaVez = await lerRet()
    await seedOwnL2(siteId, 'retencao', undefined, supabase)
    expect(await lerRet(), 'semear duas vezes dá o mesmo').toBe(umaVez)
    p = await privado(supabase, siteId, canal)
    const pctDe = (yt: string): number => {
      const l = p.diario.filter(r => r.youtube_video_id === yt && Number(r.views) > 0)
      return l.reduce((a, r) => a + Number(r.views) * Number(r.avg_view_percentage), 0) / l.reduce((a, r) => a + Number(r.views), 0)
    }
    const viewsDe = (yt: string): number => p.diario.filter(r => r.youtube_video_id === yt).reduce((a, r) => a + Number(r.views), 0)
    // faixa "5 a 15 min": 5 vídeos com 10 views ou mais; normal 50; um a 2 pontos e outro a 3
    const medios = ['Fv7Orf5gRqx', 'DvP4RC_VIjz', 'cY76nv73Qkf', 'lqqH14-w84j', 'zSvhy3lJc4u']
    expect(medios.map(y => Math.round(pctDe(y))).sort((a, b) => a - b)).toEqual([38, 45, 50, 52, 53])
    expect(medios.every(y => viewsDe(y) >= 10)).toBe(true)
    // um vídeo com menos de 10 views na janela (7), com % assistido
    expect(viewsDe('YSsFxMlqbOA')).toBe(7)
    // faixa "acima de 15 min": exatamente 4 com views; um passa de 100% sempre, outro tem um dia de 139,38
    const longosAcima = ['DNxcPR2DNIV', 'F1llCrDzvR2', 'xsi7iiX5Hvd', 'bsUv93jytXZ']
    expect(longosAcima.every(y => viewsDe(y) >= 10)).toBe(true)
    expect(Math.round(pctDe('xsi7iiX5Hvd') * 10) / 10).toBe(112.5)
    expect(p.diario.filter(r => r.youtube_video_id === 'DNxcPR2DNIV' && Number(r.avg_view_percentage) > 100)).toHaveLength(1)
    // os vídeos que o mapa não nomeia não têm linha de diário nenhuma
    expect(new Set(p.diario.map(r => String(r.youtube_video_id)))).toEqual(new Set(MAPA_RETENCAO.map(m => m.yt)))
    // o diário de um vídeo cobre só 14 dos 28 dias
    expect(p.diario.filter(r => r.youtube_video_id === 'zSvhy3lJc4u')).toHaveLength(14)
    // alcance: o magro (18 impressões, 2 cliques) em UM dia, o 1.139 sozinho no seu dia, e o dia anterior a ele é "listado" (não medido)
    const alcanceDe = (yt: string) => p.reach.filter(r => r.youtube_video_id === yt)
    expect(alcanceDe(RET.magro).map(r => [Number(r.thumbnail_impressions), Number(r.thumbnail_ctr)])).toEqual([[RET_MAGRO.imp, RET_MAGRO.ctr]])
    expect(Math.round(RET_MAGRO.imp * RET_MAGRO.ctr)).toBe(2)
    const dia1139 = somaDias(somaDias(hoje, -3 - 28), RET_DIA_1139)
    const dosDia = p.reach.filter(r => r.day_pt === dia1139)
    expect(dosDia.map(r => [r.youtube_video_id, Number(r.thumbnail_impressions)])).toEqual([[RET.volumeAlto, RET_1139.imp]])
    expect(Math.round(RET_1139.imp * RET_1139.ctr)).toBe(1139)
    expect(p.rels.find(r => String(r.start_time).slice(0, 10) === somaDias(dia1139, -1))!.status).toBe('listado')
    expect(RET_DIA_MAGRO).toBeGreaterThan(18)
    // o vídeo novo (publicado há 2 dias) não tem alcance nem diário depois da publicação: o último dia coletado é anterior
    expect(alcanceDe(RET.novo)).toHaveLength(0)
    expect(Object.keys(PERFIS_L2).sort()).toEqual(['ativo', 'cheio', 'curto', 'grande', 'lacunas', 'parado', 'retencao', 'velho'])
  } finally {
    await clearObservatory(siteId, supabase)
    const depois = await privado(supabase, siteId, canal)
    expect([depois.jobs.length, depois.rels.length, depois.reach.length, depois.diario.length]).toEqual([0, 0, 0, 0])
    await clearSeeded()
  }
})
