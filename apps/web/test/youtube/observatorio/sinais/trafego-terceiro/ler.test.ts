// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Sentry from '@sentry/nextjs'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ rpc: () => ({ abortSignal: async () => ({ data: true, error: null }) }) }) }))
vi.mock('@/lib/youtube/observatorio/proprio/edicao', () => ({
  provarEdicaoComAviso: async (siteId: string) => ({ token: { siteId }, avisou: false }), edicaoValida: () => true,
}))

import { leituraDoEditor, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerTrafegoDoTerceiro, provaValida } from '@/lib/youtube/observatorio/sinais/trafego-terceiro/ler'
import { ORIGEM_SUGERIDOS } from '@/lib/youtube/reporting/codigos'
import { fakeSb, type Consulta, type Resposta } from '../fake-sb'

const SITE = '11111111-1111-4111-8111-111111111111'
const OUTRO = '22222222-2222-4222-8222-222222222222'
const HOJE = '2026-10-29'
const T1 = 'term-uuid-1'
const ITEM = 'sinal-1'

let leitura: LeituraPrivadaDoSite
let leituraOutro: LeituraPrivadaDoSite
beforeAll(async () => {
  leitura = (await leituraDoEditor(SITE))!
  leituraOutro = (await leituraDoEditor(OUTRO))!
})

interface Mundo {
  nossos?: Array<{ id: string; youtube_video_id: string }>
  terceiros?: Array<{ id: string; video_id: string; published_at: string | null }>
  cobertura?: Array<{ youtube_video_id: string; metric_set: string; covered_from: string; covered_to: string }> | 'ausente'
  linhas?: Array<{ youtube_video_id: string; day_pt: string; source_type: string; detail: string; detail_hash: string; views: unknown; watch_time_minutes: unknown }>
  semOrigem?: Array<{ youtube_video_id: string; day_pt: string }>
  codigo32?: number
  erro?: string
}
const mundo = (m: Mundo) => fakeSb((c: Consulta): Resposta => {
  if (m.erro === c.tabela) throw new TypeError('detail=abc123')
  if (c.tabela === 'youtube_videos') return { data: m.nossos ?? [] }
  if (c.tabela === 'competitor_videos') {
    const ids = c.filtros.find((f) => f.op === 'in')?.val as string[]
    return { data: (m.terceiros ?? []).filter((t) => ids.includes(t.id)) }
  }
  if (c.tabela === 'youtube_channels') return { data: [{ id: 'canal-1' }] }
  if (c.tabela === 'yt_own_video_coverage') {
    if (m.cobertura === 'ausente') return { data: null, error: { code: '42P01', message: 'x' } }
    const ids = c.filtros.find((f) => f.col === 'youtube_video_id')?.val as string[]
    return { data: (m.cobertura ?? []).filter((r) => ids.includes(r.youtube_video_id)) }
  }
  if (c.tabela === 'yt_own_video_traffic_detail_daily') {
    if (c.opcoes?.head) return { data: null, count: m.codigo32 ?? 0 }
    const ids = c.filtros.find((f) => f.col === 'youtube_video_id')?.val as string[]
    if (c.filtros.some((f) => f.op === 'eq' && f.col === 'detail' && f.val === '')) return { data: (m.semOrigem ?? []).filter((r) => ids.includes(r.youtube_video_id)) }
    const det = c.filtros.find((f) => f.op === 'in' && f.col === 'detail')?.val as string[]
    return { data: (m.linhas ?? []).filter((r) => ids.includes(r.youtube_video_id) && det.includes(r.detail)) }
  }
  return { data: [] }
})

const ev = (video_id = T1) => ({ outliers: [{ video_id, canal_id: 'c', published_at: '2026-10-01T12:00:00Z', mult_vpd7: 5, mult_tela: 3, vpd7: 100, formato: 'long' as const }], outliers_total: 1, canais: 1, proprios: [] })
const item = (proprios: string[] | null, n: number | null = proprios?.length ?? null, id = ITEM) => ({ id, evidence: ev(), proprios_agora: proprios, proprios_agora_n: n })
const base: Mundo = {
  nossos: [{ id: 'n1', youtube_video_id: 'YTNOSSO0001' }],
  terceiros: [{ id: T1, video_id: 'YTTERC00001', published_at: '2026-10-01T18:00:00Z' }],
  cobertura: [{ youtube_video_id: 'YTNOSSO0001', metric_set: 'detalhe', covered_from: '2026-09-08', covered_to: '2026-10-27' }],
}
const linha = (detail: string, dia = '2026-10-05', views: unknown = 4) => ({ youtube_video_id: 'YTNOSSO0001', day_pt: dia, source_type: ORIGEM_SUGERIDOS, detail, detail_hash: 'h', views, watch_time_minutes: 1 })
const SEM_ARG = Symbol('sem')
const rodar = (m: Mundo, itens = [item(['n1'])], acessoArg: Parameters<typeof lerTrafegoDoTerceiro>[2] | typeof SEM_ARG = SEM_ARG, env: NodeJS.ProcessEnv = {}) => {
  const w = mundo(m)
  const acesso = acessoArg === SEM_ARG ? leitura : acessoArg
  return lerTrafegoDoTerceiro(w.sb, SITE, acesso, itens, HOJE, env).then((r) => ({ ...r, w }))
}
const estado = (r: Awaited<ReturnType<typeof rodar>>) => r.porItem.get(ITEM)!

describe('provaValida', () => {
  it('undefined, null e objeto imitado: sem_direito', () => {
    expect(provaValida(undefined, SITE)).toEqual({ ok: false, motivo: 'sem_direito' })
    expect(provaValida(null, SITE)).toEqual({ ok: false, motivo: 'sem_direito' })
    expect(provaValida({ siteId: SITE } as never, SITE)).toEqual({ ok: false, motivo: 'sem_direito' })
    expect(provaValida({ leitura: { siteId: SITE }, edita: false, negativa: null } as never, SITE)).toEqual({ ok: false, motivo: 'sem_direito' })
  })
  it('prova de A com siteId B: sem_direito; mesmo site: ok; AcessoPrivado também', () => {
    expect(provaValida(leituraOutro, SITE).ok).toBe(false)
    expect(provaValida(leitura, SITE).ok).toBe(true)
    expect(provaValida({ leitura, edita: false, negativa: null }, SITE).ok).toBe(true)
  })
  it('negativa nao_foi_possivel_conferir: nao_conferido', () => {
    expect(provaValida({ leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' }, SITE)).toEqual({ ok: false, motivo: 'nao_conferido' })
  })
})

describe('lerTrafegoDoTerceiro: sem prova nada é lido', () => {
  it.each([
    ['sem prova', undefined, 'sem_direito'],
    ['null', null, 'sem_direito'],
    ['prova de outro site', leituraOutro, 'sem_direito'],
    ['não conferido', { leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' } as const, 'nao_conferido'],
  ])('%s: motivo %s e ZERO chamadas', async (_n, acesso, motivo) => {
    const w = mundo(base)
    const r = await lerTrafegoDoTerceiro(w.sb, SITE, acesso as never, [item(['n1'])], HOJE, {})
    expect(r.porItem.get(ITEM)).toMatchObject({ estado: 'nao_medido', motivo })
    expect(w.consultas).toHaveLength(0)
    expect(r.codigo32).toBeNull()
  })
})

describe('lerTrafegoDoTerceiro: com prova', () => {
  it('linha da origem com detail = id do terceiro: sim, com as views', async () => {
    const r = await rodar({ ...base, linhas: [linha('YTTERC00001')] })
    expect(estado(r)).toMatchObject({ estado: 'sim', terceiro_video_id: T1, videos_com_trafego: 1, videos_medidos: 1, videos_total: 1, views: 4 })
  })
  it('sem linha do terceiro e cobertura boa: nao, com a data', async () => {
    const r = await rodar(base)
    expect(estado(r)).toMatchObject({ estado: 'nao', ate: '2026-10-27' })
  })
  it('nao_medido leva desde (publicação do terceiro) e coberto_ate (maior fim de cobertura)', async () => {
    const r = await rodar({ ...base, semOrigem: [{ youtube_video_id: 'YTNOSSO0001', day_pt: '2026-10-10' }] })
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', desde: '2026-10-01', coberto_ate: '2026-10-27' })
  })
  it('nao_medido sem cobertura: coberto_ate nulo, desde preenchido; sem terceiro: os dois nulos', async () => {
    const r = await rodar({ ...base, cobertura: [] })
    expect(estado(r)).toMatchObject({ motivo: 'sem_cobertura', desde: '2026-10-01', coberto_ate: null })
    const sem = await rodar(base, [{ id: ITEM, evidence: { outliers: [], outliers_total: 0, canais: 0, proprios: [] } as never, proprios_agora: ['n1'], proprios_agora_n: 1 }])
    expect(estado(sem)).toMatchObject({ motivo: 'sem_terceiro', desde: null, coberto_ate: null })
  })
  it('detail vazio e sem linha do terceiro: origem_nao_informada', async () => {
    const r = await rodar({ ...base, semOrigem: [{ youtube_video_id: 'YTNOSSO0001', day_pt: '2026-10-10' }] })
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', motivo: 'origem_nao_informada' })
  })
  it('detail vazio mas há linha do terceiro: sim', async () => {
    const r = await rodar({ ...base, linhas: [linha('YTTERC00001')], semOrigem: [{ youtube_video_id: 'YTNOSSO0001', day_pt: '2026-10-10' }] })
    expect(estado(r).estado).toBe('sim')
  })
  it('linha com detail de vídeo nosso (ou de qualquer vídeo do site) não conta', async () => {
    const m = { ...base, nossos: [...base.nossos!, { id: 'n2', youtube_video_id: 'YTNOSSO0002' }], linhas: [linha('YTNOSSO0002')] }
    expect(estado(await rodar(m)).estado).toBe('nao')
  })
  it('terceiro que é vídeo do nosso canal é descartado: nao_se_aplica', async () => {
    const m = { ...base, terceiros: [{ id: T1, video_id: 'YTNOSSO0001', published_at: '2026-10-01T18:00:00Z' }] }
    expect(estado(await rodar(m)).estado).toBe('nao_se_aplica')
  })
  it('linha do código 32: estado inalterado, codigo32 = 1 e nenhuma chamada ao Sentry', async () => {
    vi.mocked(Sentry.captureMessage).mockClear(); vi.mocked(Sentry.captureException).mockClear()
    const r = await rodar({ ...base, codigo32: 1 })
    expect(estado(r).estado).toBe('nao')
    expect(r.codigo32).toBe(1)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
  it('zero linhas no 32: codigo32 = 0; a contagem filtra por channel_id in (...) e por site', async () => {
    const r = await rodar(base)
    expect(r.codigo32).toBe(0)
    const c = r.w.consultas.find((x) => x.opcoes?.head)!
    expect(c.filtros).toEqual(expect.arrayContaining([{ op: 'in', col: 'channel_id', val: ['canal-1'] }, { op: 'eq', col: 'site_id', val: SITE }, { op: 'eq', col: 'source_type', val: '32' }]))
    expect(c.filtros.some((f) => f.col === 'detail')).toBe(false)
  })
  it('terceiro sem competitor_videos: par sem_id', async () => {
    const r = await rodar({ ...base, terceiros: [] })
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_id' })
  })
  it('terceiro sem data de publicação: sem_id', async () => {
    const r = await rodar({ ...base, terceiros: [{ id: T1, video_id: 'YTTERC00001', published_at: null }] })
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_id' })
  })
  it('21 próprios (lista de 20): lista_truncada', async () => {
    const nossos = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, youtube_video_id: `YTNOSSO${String(i).padStart(4, '0')}` }))
    const cobertura = nossos.map((n) => ({ youtube_video_id: n.youtube_video_id, metric_set: 'detalhe', covered_from: '2026-09-08', covered_to: '2026-10-27' }))
    const r = await rodar({ ...base, nossos, cobertura }, [item(nossos.map((n) => n.id), 21)])
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', motivo: 'lista_truncada', videos_total: 21 })
  })
  it('51 vídeos nossos: 2 blocos de cobertura', async () => {
    const nossos = Array.from({ length: 51 }, (_, i) => ({ id: `n${i}`, youtube_video_id: `YTNOSSO${String(i).padStart(4, '0')}` }))
    const r = await rodar({ ...base, nossos }, [item(nossos.map((n) => n.id), 51)])
    expect(r.w.consultas.filter((c) => c.tabela === 'yt_own_video_coverage')).toHaveLength(2)
  })
  it('sem terceiro na evidência e sem próprios medidos: motivo do item', async () => {
    const r = await rodar(base, [{ id: ITEM, evidence: { ...ev(), outliers: [] }, proprios_agora: ['n1'], proprios_agora_n: 1 }, item(null, null, 'b')])
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_terceiro' })
    expect(r.porItem.get('b')).toMatchObject({ estado: 'nao_medido', motivo: 'sem_proprios_medidos' })
  })
  it('lugar sem próprios (lista vazia): nao_se_aplica, sem consulta de dado privado', async () => {
    const r = await rodar(base, [item([], 0)])
    expect(estado(r).estado).toBe('nao_se_aplica')
    expect(r.w.consultas.some((c) => c.tabela.startsWith('yt_own'))).toBe(false)
  })
  it('terceirosYt vazio: só a consulta semOrigem roda e "" nunca entra num in', async () => {
    const r = await rodar({ ...base, terceiros: [] })
    const det = r.w.consultas.filter((c) => c.tabela === 'yt_own_video_traffic_detail_daily' && !c.opcoes?.head)
    expect(det).toHaveLength(0) // sem par utilizável nenhuma consulta de detalhe roda
    for (const c of r.w.consultas) for (const f of c.filtros) if (f.op === 'in') expect(f.val as string[]).not.toContain('')
  })
  it('com terceiro: a consulta com ids e a semOrigem; "" só no eq', async () => {
    const r = await rodar(base)
    const det = r.w.consultas.filter((c) => c.tabela === 'yt_own_video_traffic_detail_daily' && !c.opcoes?.head)
    expect(det).toHaveLength(2)
    expect(det.filter((c) => c.filtros.some((f) => f.op === 'eq' && f.col === 'detail' && f.val === ''))).toHaveLength(1)
    expect(det.find((c) => !c.filtros.some((f) => f.col === 'detail' && f.op === 'eq'))!.filtros).toContainEqual({ op: 'in', col: 'detail', val: ['YTTERC00001'] })
    for (const c of r.w.consultas) for (const f of c.filtros) if (f.op === 'in') expect(f.val as string[]).not.toContain('')
  })
  it('cobertura ausente (tabela inexistente): schema_ausente, nunca nao', async () => {
    expect(estado(await rodar({ ...base, cobertura: 'ausente' }))).toMatchObject({ estado: 'nao_medido', motivo: 'schema_ausente' })
  })
  it('sem cobertura de um par com linha ausente: nao_medido, nunca nao (Hanna)', async () => {
    expect(estado(await rodar({ ...base, cobertura: [] }))).toMatchObject({ estado: 'nao_medido', motivo: 'sem_cobertura' })
  })
  it('qualquer exceção (TypeError) vira erro_de_leitura em todos os itens', async () => {
    const r = await rodar({ ...base, erro: 'competitor_videos' }, [item(['n1']), item(['n1'], 1, 'b')])
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', motivo: 'erro_de_leitura' })
    expect(r.porItem.get('b')).toMatchObject({ motivo: 'erro_de_leitura' })
  })
  it('exceção: um captureException sem conteúdo (nem detail nem message)', async () => {
    vi.mocked(Sentry.captureException).mockClear()
    const r = await rodar({ ...base, erro: 'competitor_videos' }, [item(['n1']), item(['n1'], 1, 'b')])
    expect(r.porItem.get(ITEM)).toMatchObject({ motivo: 'erro_de_leitura' })
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('abc123')
  })
  it('a paginação de youtube_videos ordena por id', async () => {
    const r = await rodar(base)
    const c = r.w.consultas.find((x) => x.tabela === 'youtube_videos')!
    expect(c.ordem).toEqual([{ col: 'id', asc: true }])
  })
  it('erro de banco na cobertura: erro_de_leitura', async () => {
    const w = fakeSb((c) => (c.tabela === 'yt_own_video_coverage' ? { data: null, error: { code: 'XX000', message: 'segredo' } } : mundo(base).sb ? { data: c.tabela === 'youtube_videos' ? base.nossos : c.tabela === 'competitor_videos' ? base.terceiros : [] } : { data: [] }))
    const r = await lerTrafegoDoTerceiro(w.sb, SITE, leitura, [item(['n1'])], HOJE, {})
    expect(r.porItem.get(ITEM)).toMatchObject({ motivo: 'erro_de_leitura' })
  })
  it('YT_OWN_STEPS_OFF apagada: o passo conta como ligado; ligada com normalizadores: coleta_desligada', async () => {
    delete process.env.YT_OWN_STEPS_OFF
    expect(estado(await rodar(base, [item(['n1'])], leitura, process.env)).motivo).not.toBe('coleta_desligada')
    const r = await rodar(base, [item(['n1'])], leitura, { YT_OWN_STEPS_OFF: 'normalizadores' })
    expect(estado(r)).toMatchObject({ estado: 'nao_medido', motivo: 'coleta_desligada' })
    expect(r.w.consultas).toHaveLength(0)
  })
  it('fronteira do dia: publicado às 23h30 BRT cai no dia PT certo (ainda 01/10 no Pacífico)', async () => {
    // 2026-10-02T02:30Z = 01/10 19:30 no Pacífico (PDT): a janela começa em 01/10, a linha de 01/10 conta
    const m = { ...base, terceiros: [{ id: T1, video_id: 'YTTERC00001', published_at: '2026-10-02T02:30:00Z' }], linhas: [linha('YTTERC00001', '2026-10-01')] }
    expect(estado(await rodar(m)).estado).toBe('sim')
  })
})

describe('ler.ts: amarras de código', () => {
  const src = readFileSync(join(__dirname, '../../../../../src/lib/youtube/observatorio/sinais/trafego-terceiro/ler.ts'), 'utf8')
  it('chama provaValida antes de qualquer leitura e não faz .from da tabela privada', () => {
    expect(src.indexOf('provaValida(acesso')).toBeGreaterThan(-1)
    expect(src.indexOf('provaValida(acesso')).toBeLessThan(src.indexOf('lerCobertura('))
    expect(src).not.toMatch(/from\('yt_own/)
    expect(src).not.toMatch(/'7'|RELATED_VIDEO/)
  })
})
