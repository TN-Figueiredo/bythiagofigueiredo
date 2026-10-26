// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'
import { makeTestWithVariants } from './helpers/ab-fixtures'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({
  leituraValida: (l: unknown) => l !== null && typeof l === 'object' && 'siteId' in (l as object),
  leituraDoEditor: (...a: unknown[]) => leituraDoEditorMock(...a),
}))
const leituraDoEditorMock = vi.fn()
const escopo = vi.fn()
vi.mock('@/lib/cms/auth-guards', () => ({ requireSiteAdminScope: (...a: unknown[]) => escopo(...a) }))

let cliente: SupabaseClient
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => cliente }))

let testes: { active: AbTestWithVariants[]; draft: AbTestWithVariants[]; completed: AbTestWithVariants[]; paused: AbTestWithVariants[] }
const sugeridos = vi.fn()
vi.mock('@/app/cms/(authed)/youtube/ab-lab/queries', async (orig) => {
  const real = await orig<typeof import('@/app/cms/(authed)/youtube/ab-lab/queries')>()
  return {
    ...real,
    getAbTestsForSite: async () => testes,
    getAbSiteSettings: async () => ({}),
    getChannelLearnings: async () => null,
    getEligibleVideosForPicker: async () => [],
    getSuggestedVideos: (...a: unknown[]) => sugeridos(...a),
  }
})

const lerPaginaSpy = vi.fn()
const lerLinhasSpy = vi.fn()
vi.mock('@/lib/youtube/teste-youtube/nativo/lista-borda', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/teste-youtube/nativo/lista-borda')>()
  return {
    ...real,
    lerPaginaDoCanal: (...a: Parameters<typeof real.lerPaginaDoCanal>) => { lerPaginaSpy(...a); return real.lerPaginaDoCanal(...a) },
    lerLinhasDoCaminho: (...a: unknown[]) => lerLinhasSpy(...a),
  }
})
const lerDiasSpy = vi.fn()
vi.mock('@/lib/youtube/ab-gravacao/placar-leitura', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/ab-gravacao/placar-leitura')>()
  return { ...real, lerDiasDosTestes: (...a: Parameters<typeof real.lerDiasDosTestes>) => { lerDiasSpy(...a); return real.lerDiasDosTestes(...a) } }
})

import { lerPaginaDoLab } from '@/app/cms/(authed)/youtube/ab-lab/pagina-borda'

const agora = new Date('2026-10-26T15:00:00Z')
const dia = (day: string, variant: string, ctr: number, testId: string) => ({
  test_id: testId, day_pt: day, site_id: 's', variant_id: variant, motivo_sem_variante: null, alcance_estado: 'medido',
  impressoes: 1000, ctr, views: null, views_estado: 'nao_medido', retratado_em: '2026-10-25T00:00:00Z', final: true,
})

interface Cfg { dias?: unknown[]; diasErro?: boolean; videos?: unknown[]; rpcErro?: boolean }
function stub(c: Cfg = {}) {
  const tabelas: string[] = []
  const from = (tabela: string) => {
    tabelas.push(tabela)
    const resolve = (): { data: unknown; error: { message: string } | null } => {
      if (tabela === 'youtube_videos') return { data: c.videos ?? [], error: null }
      if (tabela === 'ab_test_dias') return c.diasErro ? { data: null, error: { message: 'boom' } } : { data: c.dias ?? [], error: null }
      return { data: [], error: null }
    }
    const cadeia: Record<string, unknown> = new Proxy({}, {
      get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve(resolve()).then(ok) : () => cadeia),
    })
    return cadeia
  }
  const rpc = (nome: string) => Promise.resolve(c.rpcErro && nome === 'ab_lab_volume' ? { data: null, error: { message: 'boom' } } : { data: [], error: null })
  return { sb: { from, rpc } as unknown as SupabaseClient, conta: (t: string) => tabelas.filter(x => x === t).length }
}

function teste(id: string, o: Partial<AbTestWithVariants> & { video?: string } = {}): AbTestWithVariants {
  const base = makeTestWithVariants()
  const { video, ...resto } = o
  return {
    ...base, id, status: 'active', youtube_video_id: video ?? `vid-${id}`, regra_duracao: 'v2',
    variants: [
      { ...base.variants[0]!, id: 'var-a', test_id: id },
      { ...base.variants[1]!, id: 'var-b', test_id: id, title_text: 'Título B' },
    ],
    ciclos: [], ...resto,
  } as unknown as AbTestWithVariants
}
const RESTORE_OK = { thumbnail: { estado: 'ok', destino: 'original', em: '2026-10-20T00:00:00Z', forcado: false, attempts: 1 } }
/** Concluído com a sugerida B por aplicar (regra v2). */
const comAplicar = (id: string, o: Partial<AbTestWithVariants> & { video?: string } = {}) => teste(id, {
  status: 'completed', completed_reason: 'regra_v2', completed_at: '2026-10-21T00:00:00Z', winner_variant_id: null,
  result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: 'var-b', provisorio: false, encerrado_em_dia: '2026-10-20' } }, ...o,
})
/** Concluído com a aplicação desfeita (Voltar) do mesmo desfecho: pode "Aplicar de novo". */
const desfeita = (id: string, video: string) => teste(id, {
  video, status: 'completed', completed_reason: 'manual_winner', completed_at: '2026-10-21T00:00:00Z', winner_variant_id: 'var-b', winner_applied_at: null,
  restore_status: RESTORE_OK,
  result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: 'var-b', provisorio: false, encerrado_em_dia: '2026-10-20' } },
} as Partial<AbTestWithVariants>)

beforeEach(() => {
  testes = { active: [], draft: [], completed: [], paused: [] }
  for (const m of [escopo, sugeridos, lerPaginaSpy, lerLinhasSpy, lerDiasSpy]) m.mockReset()
  escopo.mockResolvedValue({ ok: true })
  leituraDoEditorMock.mockReset()
  leituraDoEditorMock.mockResolvedValue({ siteId: 's' })
  vi.mocked(Sentry.captureMessage).mockClear()
  cliente = stub().sb
})

describe('lerPaginaDoLab: guarda do dado privado (Phil I1, herdada de ListaCaminhoServidor)', () => {
  it('com a prova de edição, passa o token à leitura da lista', async () => {
    const token = { siteId: 's' }
    leituraDoEditorMock.mockResolvedValueOnce(token)
    await lerPaginaDoLab('s', agora, null)
    expect(leituraDoEditorMock).toHaveBeenCalledWith('s')
    expect(lerPaginaSpy.mock.calls[0]![3]).toBe(token)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })
  it('sem prova: a lista abre SEM volume (token nulo, não erro) e o Sentry é avisado', async () => {
    leituraDoEditorMock.mockResolvedValueOnce(null)
    await expect(lerPaginaDoLab('s', agora, null)).resolves.toBeTruthy()
    expect(lerPaginaSpy.mock.calls[0]![3]).toBeNull()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('sem prova em visitas seguidas do mesmo site: o aviso ao Sentry sai uma vez só', async () => {
    for (let i = 0; i < 3; i++) leituraDoEditorMock.mockResolvedValueOnce(null)
    await lerPaginaDoLab('s-repetido', agora, null)
    await lerPaginaDoLab('s-repetido', agora, null)
    await lerPaginaDoLab('s-repetido', agora, null)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})

describe('lerPaginaDoLab: uma leitura por visita', () => {
  it('1 select em youtube_videos, 1 em ab_native_tests, 1 em ab_test_dias e 0 chamadas a getSuggestedVideos', async () => {
    testes.active = [teste('a1')]
    testes.completed = [comAplicar('c1')]
    const s = stub({ dias: [dia('2026-10-20', 'var-b', 0.05, 'a1')] })
    cliente = s.sb
    await lerPaginaDoLab('s', agora, null)
    expect(s.conta('youtube_videos')).toBe(1)
    expect(s.conta('ab_native_tests')).toBe(1)
    expect(s.conta('ab_test_dias')).toBe(1)
    expect(sugeridos).not.toHaveBeenCalled()
  })

  it('lerPaginaDoCanal UMA vez, com o recorte inicial; as linhas alimentam a listaInicial; lerLinhasDoCaminho não é chamado', async () => {
    const r = await lerPaginaDoLab('s', agora, 'dQw4w9WgXcQ')
    expect(lerPaginaSpy).toHaveBeenCalledTimes(1)
    expect(lerPaginaSpy.mock.calls[0]![4]).toEqual({ busca: null, filtro: 'testaveis', pagina: 0, incluirYtId: 'dQw4w9WgXcQ' })
    expect(lerLinhasSpy).not.toHaveBeenCalled()
    expect(r.listaInicial.linhas).toEqual([])
  })

  it('lerDiasDosTestes UMA vez, só com os ids dos ativos e dos concluídos com ação possível', async () => {
    testes.active = [teste('a1'), teste('q1', { status: 'queued' })]
    testes.completed = [
      comAplicar('c-aplicar'),
      teste('c-sem-acao', { status: 'completed', completed_reason: 'regra_v2', result_metadata: { v2: { desfecho: 'sem_diferenca_detectavel', encerrado_em_dia: '2026-10-20' } } }),
    ]
    await lerPaginaDoLab('s', agora, null)
    expect(lerDiasSpy).toHaveBeenCalledTimes(1)
    expect([...(lerDiasSpy.mock.calls[0]![2] as string[])].sort()).toEqual(['a1', 'c-aplicar'])
  })

  it('sem ativo nem concluído com ação: nenhuma ida a ab_test_dias', async () => {
    testes.completed = [teste('c-sem-acao', { status: 'completed', completed_reason: 'regra_v2', result_metadata: { v2: { desfecho: 'sem_diferenca_detectavel', encerrado_em_dia: '2026-10-20' } } })]
    await lerPaginaDoLab('s', agora, null)
    expect(lerDiasSpy).not.toHaveBeenCalled()
  })
})

describe('lerPaginaDoLab: dias e CTR', () => {
  it('no concluído o CTR é o dos dias até encerrado_em_dia (dia depois do encerramento não entra)', async () => {
    testes.completed = [comAplicar('c1')]
    cliente = stub({ dias: [dia('2026-10-19', 'var-b', 0.05, 'c1'), dia('2026-10-20', 'var-b', 0.05, 'c1'), dia('2026-10-23', 'var-b', 0.5, 'c1')] }).sb
    const r = await lerPaginaDoLab('s', agora, null)
    const painel = r.pagina.concluidos.linhas[0]!.acao!.painel
    expect(painel.opcoes.find(o => o.varianteId === 'var-b')!.ctr).toBeCloseTo(0.05, 6)
  })

  it('erro em lerDiasDosTestes lança (a fronteira mostra o estado e); nunca devolve CTR 0', async () => {
    testes.active = [teste('a1')]
    cliente = stub({ diasErro: true }).sb
    await expect(lerPaginaDoLab('s', agora, null)).rejects.toThrow(/ab_test_dias/)
  })

  it('linha inválida isola o teste: CTR nulo ("não medido"), o outro teste e a página seguem normais, nada vira 0', async () => {
    testes.active = [teste('a-inv'), teste('a-ok')]
    cliente = stub({ dias: [{ test_id: 'a-inv', day_pt: '2026-10-20', lixo: true }, dia('2026-10-20', 'var-b', 0.04, 'a-ok')] }).sb
    const r = await lerPaginaDoLab('s', agora, null)
    const lab = r.pagina.emTeste.filter(c => c.tipo === 'lab')
    const ctrs = (id: string) => lab.find(c => c.tipo === 'lab' && c.card.id === id)!.tipo === 'lab'
      ? (lab.find(c => c.tipo === 'lab' && c.card.id === id) as Extract<(typeof lab)[number], { tipo: 'lab' }>).painel!.opcoes.map(o => o.ctr)
      : []
    expect(ctrs('a-inv')).toEqual([null, null])
    expect(ctrs('a-ok')).toContain(0.04)
    expect(ctrs('a-ok')).not.toContain(0)
  })
})

describe('lerPaginaDoLab: outroTesteAberto por Set', () => {
  it('aplicação desfeita sem outro teste aberto no vídeo: oferece "Aplicar B"', async () => {
    testes.completed = [desfeita('c1', 'vid-x')]
    const r = await lerPaginaDoLab('s', agora, null)
    expect(r.pagina.concluidos.linhas[0]!.acao?.rotulo).toBe('Aplicar B')
  })
  it('com rascunho no mesmo vídeo: sem "Aplicar de novo" (a linha do Concluído sem ação)', async () => {
    testes.completed = [desfeita('c1', 'vid-x')]
    testes.draft = [teste('d1', { status: 'draft', video: 'vid-x' })]
    const r = await lerPaginaDoLab('s', agora, null)
    expect(r.pagina.concluidos.linhas[0]!.acao).toBeNull()
  })
  it('com teste ativo no mesmo vídeo: sem "Aplicar de novo"', async () => {
    testes.completed = [desfeita('c1', 'vid-x')]
    testes.active = [teste('a1', { video: 'vid-x' })]
    const r = await lerPaginaDoLab('s', agora, null)
    expect(r.pagina.concluidos.linhas[0]!.acao).toBeNull()
  })
  it('teste aberto em OUTRO vídeo não bloqueia', async () => {
    testes.completed = [desfeita('c1', 'vid-x')]
    testes.active = [teste('a1', { video: 'vid-y' })]
    const r = await lerPaginaDoLab('s', agora, null)
    expect(r.pagina.concluidos.linhas[0]!.acao?.rotulo).toBe('Aplicar B')
  })
})

describe('lerPaginaDoLab: permissão e volume', () => {
  it('usuário editor (requireSiteAdminScope.ok false): B do painel ativo fica "sem_permissao"', async () => {
    escopo.mockResolvedValue({ ok: false })
    testes.active = [teste('a1')]
    const r = await lerPaginaDoLab('s', agora, null)
    const lab = r.pagina.emTeste[0]!
    expect(lab.tipo === 'lab' && lab.painel?.opcoes.find(o => o.letra === 'B')?.estado).toBe('sem_permissao')
  })
  it('administrador: B escolhível', async () => {
    testes.active = [teste('a1')]
    const r = await lerPaginaDoLab('s', agora, null)
    const lab = r.pagina.emTeste[0]!
    expect(lab.tipo === 'lab' && lab.painel?.opcoes.find(o => o.letra === 'B')?.estado).toBe('escolhivel')
  })
  it('RPC de volume com erro: a página monta e motivoNaoLido === "falha"', async () => {
    testes.active = [teste('a1')]
    cliente = stub({ rpcErro: true, videos: [{ id: 'v1', youtube_video_id: 'yt000000001', title: 'V', thumbnail_url: null, published_at: '2026-09-01T00:00:00Z' }] }).sb
    const r = await lerPaginaDoLab('s', agora, null)
    expect(r.listaInicial.contagem.motivoNaoLido).toBe('falha')
    expect(r.pagina.emTeste).toHaveLength(1)
  })
})
