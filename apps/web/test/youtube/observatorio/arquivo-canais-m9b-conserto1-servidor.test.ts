// @vitest-environment node
// M9b conserto 1, itens 8 e 10: a leitura única por requisição, e os testes que matam os mutantes vivos (administra, pend no chrome).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { paginaVazia } from './fixtures/arquivo-pagina'

const rpc = vi.fn()
const criar = vi.fn(() => ({ rpc }))
const captureMessage = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: vi.fn() }))
// `cache` do React só memoriza dentro de uma renderização do servidor; aqui, uma "requisição" é a vida do módulo (vi.resetModules zera)
vi.mock('react', async orig => {
  const real = await orig<typeof import('react')>()
  const memo = <A extends unknown[], R>(fn: (...a: A) => R) => { const m = new Map<unknown, R>(); return (...a: A): R => { if (!m.has(a[0])) m.set(a[0], fn(...a)); return m.get(a[0])! } }
  return { ...real, default: real, cache: memo }
})
const COMP = '@/app/cms/(authed)/youtube/competitors'
const SITE = '00000000-0000-0000-0000-00000000a3b0'
const PEND = { versao: 2, lido_em: '2028-05-03T15:00:00Z', total: 0, itens: [] }

beforeEach(() => { vi.resetModules(); rpc.mockReset(); criar.mockClear(); captureMessage.mockClear(); process.env.OBS_ARQUIVO = 'on' })

describe('item 8: uma leitura por requisição e por site', () => {
  it('a lista de removidos: bloco, chrome e fila dividem UMA chamada ao banco; outro site faz outra', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { listaDosRemovidos } = await import(`${COMP}/_arquivo/leituras`)
    const [a, b] = await Promise.all([listaDosRemovidos(SITE), listaDosRemovidos(SITE)])
    expect(a).toBe(b)
    expect(rpc.mock.calls.filter(c => c[0] === 'obs_archive_removed_channel_list')).toHaveLength(1)
    await listaDosRemovidos('outro')
    expect(rpc.mock.calls.filter(c => c[0] === 'obs_archive_removed_channel_list')).toHaveLength(2)
  })
  it('as pendências: a fila e o bloco dos canais dividem UMA chamada a obs_archive_owner_pending', async () => {
    rpc.mockResolvedValue({ data: PEND, error: null })
    const { lerPendenciasDosCanais } = await import(`${COMP}/_arquivo/pendencias-dos-canais`)
    const { lerPendenciasDaFila } = await import(`${COMP}/_canais/pendencias-da-fila`)
    const bloco = await lerPendenciasDosCanais(SITE)
    const fila = await lerPendenciasDaFila(SITE, { podeEditar: true, canUnlock: true } as never, new Date('2028-05-03T15:00:00Z'))
    expect(bloco).toMatchObject({ ok: true })
    expect(fila).toMatchObject({ estado: 'zero' })
    expect(rpc.mock.calls.filter(c => c[0] === 'obs_archive_owner_pending')).toHaveLength(1)
  })
  it('falha da leitura: os dois dizem não medido, sem lista vazia, e o Sentry é avisado uma vez só', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    const { lerPendenciasDosCanais } = await import(`${COMP}/_arquivo/pendencias-dos-canais`)
    const { lerPendenciasDaFila } = await import(`${COMP}/_canais/pendencias-da-fila`)
    expect(await lerPendenciasDosCanais(SITE)).toEqual({ ok: false })
    expect(await lerPendenciasDaFila(SITE, { podeEditar: true, canUnlock: true } as never, new Date())).toEqual({ estado: 'nao_medido' })
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
  it('a fila usa a lista do cache para os nomes (sem segunda chamada)', async () => {
    const ref = 'aaaaaaaa-1111-2222-3333-444444444444'
    const item = { item_id: `canal:${ref}`, kind: 'canal', tempo: 'copiar', desde: '2028-05-01T00:00:00Z', mes: null, channel_ref: ref, youtube_id: null, marcado_rodado_em: null, apagar: [], b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null }
    rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_owner_pending' ? { data: { ...PEND, total: 1, itens: [item] }, error: null } : { data: [], error: null })
    const { listaDosRemovidos } = await import(`${COMP}/_arquivo/leituras`)
    await listaDosRemovidos(SITE)
    const { lerPendenciasDaFila } = await import(`${COMP}/_canais/pendencias-da-fila`)
    await lerPendenciasDaFila(SITE, { podeEditar: true, canUnlock: true } as never, new Date('2028-05-03T15:00:00Z'))
    expect(rpc.mock.calls.filter(c => c[0] === 'obs_archive_removed_channel_list')).toHaveLength(1)
  })
})

describe('item 10: montarArquivo entrega administra e pend ao montarBloco', () => {
  const montarBloco = vi.fn()
  const permissoes = vi.fn(), abrir = vi.fn()
  const importar = async () => {
    vi.doMock(`${COMP}/_chrome/permissoes`, () => ({ permissoesDoSite: (s: string) => permissoes(s) }))
    vi.doMock(`${COMP}/_chrome/page-data`, () => ({ openObservatoryPage: (f: (s: string) => unknown) => abrir(f) }))
    vi.doMock(`${COMP}/_arquivo-saida/encaixar`, () => ({ encaixarSaida: async (m: unknown) => m }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
    vi.doMock('@/lib/youtube/observatorio/arquivo-mensal/canais-removidos', async orig => {
      const real = await orig<typeof import('@/lib/youtube/observatorio/arquivo-mensal/canais-removidos')>()
      return { ...real, montarBloco: (...a: Parameters<typeof real.montarBloco>) => { montarBloco(...a); return real.montarBloco(...a) } }
    })
    return (await import(`${COMP}/_arquivo/montar`)).montarArquivo
  }
  const ref = 'aaaaaaaa-1111-2222-3333-444444444444'
  const canal = { versao: 2, channel_ref: ref, estado: 'pedido', decided_at: '2028-04-28T00:00:00Z', nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
    blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: '2028-04-28T00:00:00Z', removido_via: 'botao', primeiro_mes: '2026-10', ultimo_mes: '2027-11', meses: 14, registros: 1, classes: [] }
  const item = { item_id: `canal:${ref}`, kind: 'canal', tempo: 'apagar_antigas', desde: '2028-04-28T00:00:00Z', mes: null, channel_ref: ref, youtube_id: null, marcado_rodado_em: null, apagar: [{ filho: 'numerico', caminho: 'a/b.csv', sha256: 'a'.repeat(64), nova: null }], b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null }
  beforeEach(() => {
    montarBloco.mockReset()
    rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_pagina' ? { data: paginaVazia(), error: null } : nome === 'obs_archive_removed_channel_list' ? { data: [canal], error: null } : nome === 'obs_archive_owner_pending' ? { data: { ...PEND, total: 1, itens: [item] }, error: null } : { data: [], error: null })
  })
  it.each([[true, 'administra'], [false, 'edita']] as const)('canUnlock=%s: administra=%s chega ao montarBloco, com a leitura das pendências do canal', async (admin) => {
    abrir.mockResolvedValue({ userId: 'u1', siteId: SITE, now: Date.parse('2028-05-03T15:00:00Z'), obs: {}, meuCanalLembrado: null, extra: { canUnlock: admin, podeEditar: true } })
    const r = await (await importar())()
    if (r.acesso === 'so_le') throw new Error('x')
    const o = montarBloco.mock.calls[0]![1]
    expect(o.administra).toBe(admin)
    expect(o.pend.ok).toBe(true)
    expect(o.pend.canais.get(ref)).toMatchObject({ tempo: 'apagar_antigas' })
    expect(r.bloco).toMatchObject({ ok: true })
  })
  it('a leitura das pendências falhou: pend {ok:false} chega ao montarBloco (a linha diz não medido)', async () => {
    abrir.mockResolvedValue({ userId: 'u1', siteId: SITE, now: Date.parse('2028-05-03T15:00:00Z'), obs: {}, meuCanalLembrado: null, extra: { canUnlock: true, podeEditar: true } })
    rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_pagina' ? { data: paginaVazia(), error: null } : nome === 'obs_archive_removed_channel_list' ? { data: [canal], error: null } : { data: null, error: { code: '57014' } })
    await (await importar())()
    expect(montarBloco.mock.calls[0]![1].pend).toEqual({ ok: false })
  })
})

describe('item 10: o chrome passa pend à marca da pastilha e só lê o que precisa', () => {
  const marca = vi.fn(), lerPend = vi.fn()
  const ref = 'aaaaaaaa-1111-2222-3333-444444444444'
  const nas = (o: Record<string, unknown>) => ({ versao: 2, channel_ref: ref, estado: 'apagado_nas', ...o })
  const PEND_LIDA = { ok: true as const, canais: new Map() }
  let lista: unknown[] = []
  const montar = async () => {
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's' }) }))
    vi.doMock(`${COMP}/_chrome/arquivo-do-chrome`, () => ({ arquivoNoChrome: async () => ({ arquivoVisivel: true, aviso: { ok: true, leve: { casa: [] } }, banco: { x: 1 } }) }))
    vi.doMock(`${COMP}/_chrome/page-data`, () => ({ lerMeuCanalLembrado: async () => null, openObservatoryPage: async () => ({ obs: { scopeOf: (n: string) => n } }) }))
    vi.doMock(`${COMP}/niche-actions`, () => ({ setUserNiche: vi.fn() }))
    vi.doMock(`${COMP}/actions`, () => ({ syncCompetitorsNow: vi.fn() }))
    vi.doMock(`${COMP}/forja-actions`, () => ({ askForjaReading: vi.fn() }))
    vi.doMock(`${COMP}/_chrome/observatory-chrome`, () => ({ ObservatoryChrome: () => null }))
    vi.doMock(`${COMP}/_chrome/resolve-niche`, () => ({ resolveNiche: async () => ({ niche: 'todos', dropParam: false, fromParam: false }) }))
    vi.doMock(`${COMP}/_saiu/dados`, () => ({ contarParaAAba: async () => ({ visivel: false, n: 0 }) }))
    vi.doMock(`${COMP}/_sugestoes/dados-da-tela`, () => ({ contarParaAAbaSugestoes: async () => ({ visivel: false, n: 0, velho: false, calculado: false }) }))
    vi.doMock(`${COMP}/_chrome/view-model`, async orig => ({ ...(await orig<object>()), buildChromeView: () => ({ cowork: '' }) }))
    vi.doMock('@/lib/youtube/observatorio/arquivo-mensal/aviso-v2', () => ({ montarAvisoV2: () => null }))
    vi.doMock(`${COMP}/_arquivo/leituras`, () => ({ listaDosRemovidos: async () => ({ ok: true, lista }) }))
    vi.doMock(`${COMP}/_arquivo/pendencias-dos-canais`, () => ({ lerPendenciasDosCanais: (...a: unknown[]) => lerPend(...a) }))
    vi.doMock('@/lib/youtube/observatorio/arquivo-mensal/canais-removidos', async orig => {
      const real = await orig<typeof import('@/lib/youtube/observatorio/arquivo-mensal/canais-removidos')>()
      return { ...real, marcaAoLadoDaPastilha: (...a: unknown[]) => { marca(...a); return null } }
    })
    const { ObservatoryChromeServer } = await import(`${COMP}/_chrome/chrome-server`)
    await ObservatoryChromeServer({ tab: 'outliers', searchParams: undefined, obs: { scopeOf: (n: string) => n } as never, children: null })
  }
  beforeEach(() => { marca.mockReset(); lerPend.mockReset(); lerPend.mockResolvedValue(PEND_LIDA); process.env.OBS_ARQUIVO_LIMPEZA_CANAL = 'on' })
  it('apagado_nas esperando snapshots: lê as pendências UMA vez e as entrega como pend à marca', async () => {
    lista = [nas({ snapshots_clear_on: null })]
    await montar()
    expect(lerPend).toHaveBeenCalledTimes(1)
    expect(marca).toHaveBeenCalledTimes(1)
    expect(marca.mock.calls[0]![1].pend).toBe(PEND_LIDA)
  })
  it('só pedido, ou apagado_nas com prazo vencido: não lê as pendências (pend ausente)', async () => {
    lista = [{ ...nas({ snapshots_clear_on: '2020-01-01' }) }, { ...nas({ estado: 'pedido' }) }]
    await montar()
    expect(lerPend).not.toHaveBeenCalled()
    expect(marca.mock.calls[0]![1].pend).toBeUndefined()
  })
  it('comando de limpeza desligado: nem a lista é lida para a marca', async () => {
    delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL
    lista = [nas({})]
    await montar()
    expect(lerPend).not.toHaveBeenCalled(); expect(marca).not.toHaveBeenCalled()
  })
})
