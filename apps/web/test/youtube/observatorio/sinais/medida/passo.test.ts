// @vitest-environment node
// F2b T4: o passo diário `medirD2` e a tarefa `medida_d2`, com cliente falso. Séries e proprios simulados; literais, relógio fixo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fakeSb, type Consulta, type Resposta } from '../fake-sb'

const gravadorSpy = vi.fn()
vi.mock('@/lib/youtube/observatorio/sinais/gravador', () => ({ rodarSinaisDoNicho: (...a: unknown[]) => gravadorSpy(...a) }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

const proprios = [
  { id: 'pa', youtube_video_id: 'ytA', title: 'a', description: null, tags: [], is_short: false, published_at: '2026-08-01T12:00:00Z' },
  { id: 'pb', youtube_video_id: 'ytB', title: 'b', description: null, tags: [], is_short: false, published_at: '2026-08-02T12:00:00Z' },
  { id: 'pc', youtube_video_id: 'ytC', title: 'c', description: null, tags: [], is_short: false, published_at: '2026-08-03T12:00:00Z' },
]
vi.mock('@/lib/youtube/observatorio/sinais/lugares-do-site', async orig => ({
  ...(await orig<object>()), lerProprios: async () => proprios,
}))
const somarBraco = vi.fn()
const presenca = vi.fn()
vi.mock('@/lib/youtube/observatorio/sinais/medida/series', () => ({
  ehSchemaAusenteDaMedida: () => false,
  lerSeriesDoSite: async () => ({
    somarBraco, presenca, coberturaDeFecho: () => ({ ateReporting: '2026-12-15', ateAnalytics: '2026-12-15' }),
  }),
}))

import { medirD2, CHAVES_DO_DETALHE } from '@/lib/youtube/observatorio/sinais/medida/passo'
import { medidaD2 } from '@/lib/youtube/agenda/tarefas/medida-d2'
import { ligadaPorVariavel, tarefasDesligadas } from '@/lib/youtube/agenda/definicoes'
import { CATALOGO } from '@/lib/youtube/agenda/catalogo'
import { METRICAS_PARA_TESTE } from './metricas-teste'

const AGORA = Date.parse('2026-12-20T15:00:00Z')
const SITE = 'site-1', SIG = 'sig-1', OUT = 'out-1'
const FILA = [{ signal_id: SIG, outlier_video_id: OUT, canal_id: 'can-1', outlier_published_at: '2026-11-08T12:00:00+00:00', chave: 'pais:th', metricas_faltantes: METRICAS_PARA_TESTE }]

interface Cena { fila?: unknown[]; sem_entrada?: number; gravar?: unknown; vistos?: unknown[]; falhaEm?: { rpc: string; code: string }; v0?: string | null }
function montar(cena: Cena = {}) {
  let gravado = false
  const r = fakeSb((c: Consulta): Resposta => {
    switch (c.tabela) {
      case 'competitor_channels': return { data: [{ site_id: SITE }] }
      case 'rpc:niche_signal_medida_contagem':
        if (cena.falhaEm?.rpc === 'contagem') return { data: null, error: { code: cena.falhaEm.code, message: 'x' } }
        return { data: { pares_abertos: gravado ? 0 : 1, eventos_fechados: 0, sem_ancora: 0, fora_de_evidence: 0, sem_entrada: cena.sem_entrada ?? 0, v0: cena.v0 === undefined ? '2026-09-01' : cena.v0 } }
      case 'rpc:niche_signal_pares_abertos': return { data: gravado ? [] : cena.fila ?? FILA }
      case 'rpc:niche_signal_efeitos_gravar': gravado = true; return { data: cena.gravar ?? { inseridas: 24, ignoradas: 0, bracos_inseridos: 6, bracos_ignorados: 0, de_outro_site: 0 } }
      case 'video_lugares': return { data: [{ video_id: 'pa', chaves: ['pais:th'] }, { video_id: 'pb', chaves: ['pais:th'] }, { video_id: 'pc', chaves: ['pais:vn'] }] }
      case 'youtube_videos': return { data: null, count: 4 }
      case 'niche_signals': return { data: [{ id: SIG, subject_key: 'pais:th', first_seen_at: '2026-11-09T00:00:00Z', dispensado_em: null, expires_at: '2026-12-09T00:00:00Z', evidence: { proprios: ['pa', 'pb'] } }] }
      case 'niche_outliers_vistos': return { data: cena.vistos ?? [{ video_id: OUT, published_at: '2026-11-08T12:00:00Z', chaves: ['pais:th'] }] }
      case 'competitor_videos': return { data: [{ id: OUT, video_id: 'ytOut' }] }
      default: return { data: [] }
    }
  })
  return r
}
const ctx = (sb: ReturnType<typeof montar>['sb'], over: { fimMs?: number } = {}) => ({ sb, t0: AGORA, agora: () => AGORA, fimMs: over.fimMs ?? 285_000 })

beforeEach(() => {
  gravadorSpy.mockReset()
  somarBraco.mockReset().mockImplementation((_m: string, ids: string[], dias: string[]) => ({ soma: ids.length * dias.length }))
  presenca.mockReset().mockReturnValue({ apareceu: 2, semCobertura: 0 })
  process.env.OBS_SINAIS_NICHO = 'on'
})
afterEach(() => { delete process.env.OBS_SINAIS_NICHO; delete process.env.OBS_MEDIDA_D2 })

describe('medirD2', () => {
  it('fecha as 10 métricas nos dois braços, placebo só de views_total, braços uma vez; detalhe só com a lista de permissão', async () => {
    const { sb, rpc } = montar()
    const r = await medirD2(ctx(sb))
    const g = rpc.filter(x => x.nome === 'niche_signal_efeitos_gravar')
    expect(g).toHaveLength(1)
    const args = g[0]!.args as { p_site: string; p_bracos: Array<{ papel: string; anos_atras: number; videos: string[]; chave: string }>; p_linhas: Array<{ metrica: string; papel: string; anos_atras: number; pre: number | null; pos: number | null; estado: string }> }
    expect(args.p_site).toBe(SITE)
    expect(args.p_linhas).toHaveLength(2 * 10 + 4)
    expect(args.p_linhas.filter(l => l.anos_atras > 0).every(l => l.metrica === 'views_total')).toBe(true)
    expect(args.p_linhas.some(l => l.metrica === 'volume' || l.metrica === 'base_zero')).toBe(false)
    const prova = args.p_linhas.find(l => l.metrica === 'prova_related' && l.papel === 'alvo')!
    expect(prova).toMatchObject({ pre: 0, pos: 4, estado: 'medido' }) // 2 vídeos no braço alvo x 2 dias
    expect(args.p_bracos).toHaveLength(6)
    const alvo = args.p_bracos.find(b => b.papel === 'alvo' && b.anos_atras === 0)!
    expect(alvo.videos.sort()).toEqual(['ytA', 'ytB'])
    expect(args.p_bracos.find(b => b.papel === 'controle' && b.anos_atras === 0)!.videos).toEqual(['ytC'])
    expect(Object.keys(r.detalhe).sort()).toEqual([...CHAVES_DO_DETALHE].sort())
    expect(Object.values(r.detalhe).every(Number.isFinite)).toBe(true)
    expect(r.detalhe).toMatchObject({ d2_pares_abertos: 1, d2_fechados_hoje: 10, d2_nao_medidos_hoje: 0, d2_sem_entrada: 0, d2_proprios_sem_lugar: 0, d2_proprios_fora_do_universo: 1, d2_coletando: 1 })
    expect(r.motivo).toBeUndefined()
  })

  it('reexecução no mesmo dia: a fila volta vazia e nada é gravado de novo', async () => {
    const { sb, rpc } = montar()
    await medirD2(ctx(sb))
    const r2 = await medirD2(ctx(sb))
    expect(rpc.filter(x => x.nome === 'niche_signal_efeitos_gravar')).toHaveLength(1)
    expect(r2.detalhe.d2_fechados_hoje).toBe(0)
    expect(r2.motivo).toBeUndefined()
  })

  it('métrica sem cobertura vira nao_medido com motivo e dias; pre/pos nulos', async () => {
    somarBraco.mockImplementation((m: string) => (m === 'views_busca' ? { nao_medido: 'limiar', diasSemCobertura: 3 } : { soma: 5 }))
    const { sb, rpc } = montar()
    const r = await medirD2(ctx(sb))
    const l = (rpc.find(x => x.nome === 'niche_signal_efeitos_gravar')!.args as { p_linhas: Array<{ metrica: string; papel: string; estado: string; motivo: string | null; dias_sem_cobertura: number | null; pre: number | null }> }).p_linhas
      .find(x => x.metrica === 'views_busca' && x.papel === 'alvo')!
    expect(l).toMatchObject({ estado: 'nao_medido', motivo: 'limiar', dias_sem_cobertura: 6, pre: null })
    expect(r.detalhe.d2_nao_medidos_hoje).toBe(1)
  })

  it('sem entrada (site sem vistos e sem sinal): d2_sem_entrada 1, nenhuma fila lida', async () => {
    const { sb, rpc } = montar({ sem_entrada: 1 })
    const r = await medirD2(ctx(sb))
    expect(r.detalhe.d2_sem_entrada).toBe(1)
    expect(rpc.map(x => x.nome)).toEqual(['niche_signal_medida_contagem'])
  })

  it('OBS_SINAIS_NICHO lida na chamada: ausente = sem entrada, sem tocar o banco; on = mede (mesmo módulo)', async () => {
    const a = montar()
    delete process.env.OBS_SINAIS_NICHO
    const r1 = await medirD2(ctx(a.sb))
    expect(r1.detalhe.d2_sem_entrada).toBe(1)
    expect(a.rpc).toHaveLength(0)
    process.env.OBS_SINAIS_NICHO = 'on'
    const b = montar()
    const r2 = await medirD2(ctx(b.sb))
    expect(r2.detalhe.d2_fechados_hoje).toBe(10)
  })

  it('contaminacao_desconhecida: uma linha `par` e nenhuma métrica; o braço não é gravado', async () => {
    const { sb, rpc } = montar({ v0: '2026-12-01' }) // pub - 28 < v0 - 2
    await medirD2(ctx(sb))
    const a = rpc.find(x => x.nome === 'niche_signal_efeitos_gravar')!.args as { p_bracos: unknown[]; p_linhas: Array<{ metrica: string; motivo: string; estado: string }> }
    expect(a.p_linhas).toEqual([expect.objectContaining({ metrica: 'par', motivo: 'contaminacao_desconhecida', estado: 'nao_medido' })])
    expect(a.p_bracos).toEqual([])
  })

  it('pre_contaminado: outro outlier da mesma chave em pub-10 vira uma linha `par`', async () => {
    const { sb, rpc } = montar({ vistos: [
      { video_id: OUT, published_at: '2026-11-08T12:00:00Z', chaves: ['pais:th'] },
      { video_id: 'outro', published_at: '2026-10-29T12:00:00Z', chaves: ['pais:th'] },
    ] })
    await medirD2(ctx(sb))
    const a = rpc.find(x => x.nome === 'niche_signal_efeitos_gravar')!.args as { p_linhas: Array<{ metrica: string; motivo: string }> }
    expect(a.p_linhas).toEqual([expect.objectContaining({ metrica: 'par', motivo: 'pre_contaminado' })])
  })

  it('braço fixado vindo da fila (videos_alvo/videos_controle) vale mais que o recálculo; alvo e controle da métrica vão no mesmo lote', async () => {
    const { sb, rpc } = montar({ fila: [{ ...FILA[0]!, videos_alvo: ['ytA'], videos_controle: ['ytB', 'ytC'] }] })
    await medirD2(ctx(sb))
    const g = rpc.filter(x => x.nome === 'niche_signal_efeitos_gravar')
    expect(g).toHaveLength(1)
    const a = g[0]!.args as { p_bracos: Array<{ papel: string; anos_atras: number; videos: string[] }> }
    expect(a.p_bracos.find(b => b.papel === 'alvo' && b.anos_atras === 0)!.videos).toEqual(['ytA'])
    expect(a.p_bracos.find(b => b.papel === 'controle' && b.anos_atras === 0)!.videos).toEqual(['ytB', 'ytC'])
  })

  it('par ainda novo (idade < 34): nada a gravar, sem ler séries', async () => {
    const { sb, rpc } = montar({ fila: [{ ...FILA[0]!, outlier_published_at: '2026-12-10T12:00:00+00:00' }] })
    const r = await medirD2(ctx(sb))
    expect(rpc.some(x => x.nome === 'niche_signal_efeitos_gravar')).toBe(false)
    expect(r.feitas).toBe(0)
  })

  it('RPC de gravar devolve {}: medida_falhou, nunca inseridas 0 verde', async () => {
    const { sb } = montar({ gravar: {} })
    const r = await medirD2(ctx(sb))
    expect(r.motivo).toBe('medida_falhou')
  })

  it('de_outro_site > 0: medida_falhou', async () => {
    const { sb } = montar({ gravar: { inseridas: 1, ignoradas: 0, bracos_inseridos: 0, bracos_ignorados: 0, de_outro_site: 2 } })
    expect((await medirD2(ctx(sb))).motivo).toBe('medida_falhou')
  })

  it('restante do prazo 0: sem_prazo e nenhuma RPC', async () => {
    const { sb, rpc } = montar()
    const r = await medirD2(ctx(sb, { fimMs: 0 }))
    expect(r.motivo).toBe('sem_prazo')
    expect(rpc).toHaveLength(0)
  })
})

describe('tarefa medida_d2', () => {
  const c = (sb: ReturnType<typeof montar>['sb']) => ({ t0: AGORA, agora: () => AGORA, apiKey: '', sb, linhas: null })

  it('flag: apagada, ON, 1, vazio = desligada; só on liga; o despachante a marca desligada', () => {
    delete process.env.OBS_MEDIDA_D2
    expect(ligadaPorVariavel(medidaD2, process.env)).toBe(false)
    expect(tarefasDesligadas({}, CATALOGO).desligadas.has('medida_d2')).toBe(true)
    for (const v of ['ON', '1', '']) expect(ligadaPorVariavel(medidaD2, { OBS_MEDIDA_D2: v }), v).toBe(false)
    expect(ligadaPorVariavel(medidaD2, { OBS_MEDIDA_D2: 'on' })).toBe(true)
    expect(tarefasDesligadas({ OBS_MEDIDA_D2: 'on' }, CATALOGO).desligadas.has('medida_d2')).toBe(false)
  })

  it('42P01: erro schema_ausente e a F2 nunca é chamada', async () => {
    const { sb } = montar({ falhaEm: { rpc: 'contagem', code: '42P01' } })
    const r = await medidaD2.rodar(c(sb))
    expect(r).toMatchObject({ estado: 'erro', motivo: 'schema_ausente' })
    expect(gravadorSpy).not.toHaveBeenCalled()
  })

  it('ok: detalhe só números e chaves exatamente da lista de permissão', async () => {
    const { sb } = montar()
    const r = await medidaD2.rodar(c(sb))
    expect(r.estado).toBe('ok')
    expect(Object.keys(r.detalhe!).sort()).toEqual([
      'd2_coletando', 'd2_eventos_fechados', 'd2_fechados_hoje', 'd2_fora_de_evidence', 'd2_nao_medidos_hoje', 'd2_pares_abertos',
      'd2_proprios_fora_do_universo', 'd2_proprios_sem_lugar', 'd2_sem_ancora', 'd2_sem_entrada',
    ])
    expect(Object.values(r.detalhe!).every(Number.isFinite)).toBe(true)
    expect(r.feitas).toBe(10)
    expect(gravadorSpy).not.toHaveBeenCalled()
  })

  it('definição: pesada, diária, 8h SP, cede à F2, motivos fechados', () => {
    expect(medidaD2).toMatchObject({ nome: 'medida_d2', peso: 'pesada', periodo: 'dia', aPartirDaHoraSP: 8, ligaCom: 'OBS_MEDIDA_D2' })
    expect(medidaD2.cedeA).toContain('sinais_do_nicho')
    expect(Object.keys(medidaD2.motivos).sort()).toEqual(['medida_falhou', 'schema_ausente', 'sem_prazo'])
  })
})
