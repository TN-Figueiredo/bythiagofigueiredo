// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { visitarCanal, type EntradaDaVisita } from '@/lib/youtube/observatorio/playlists/visitar'
import { ErroX3, criarOpsX3, type EstadoDoCanal, type OpsX3, type PlaylistConhecida } from '@/lib/youtube/observatorio/playlists/gravar'
import { X3_RULES } from '@/lib/youtube/observatorio/playlists/regras'

const AGORA = Date.parse('2026-03-20T15:00:00Z')
const DIA = 86_400_000
const vazio = (): EstadoDoCanal => ({ playlists: [], empty_streak: 0, sections_empty_streak: 0, ultima_secao_vazia: null })
const conhecida = (n: number, o: Partial<PlaylistConhecida> = {}): PlaylistConhecida => ({
  id: `ref-${n}`, playlist_id: `PL${n}`, items_read_at: null, items_status: null, items_reason: null, missing_since: null, item_count: 3, ...o,
})

type Rota = (params: URLSearchParams, n: number) => { status?: number; json?: unknown; lanca?: boolean }
const playlistItem = (n: number) => ({ id: `PL${n}`, snippet: { title: `P${n}`, publishedAt: '2026-01-01T00:00:00Z' }, contentDetails: { itemCount: 3 }, status: { privacyStatus: 'public' } })
const paginaPlaylists = (ids: number[], proxima?: string, total?: number) => ({ items: ids.map(playlistItem), ...(proxima ? { nextPageToken: proxima } : {}), ...(total !== undefined ? { pageInfo: { totalResults: total } } : {}) })
const video = (i: number) => `vid${String(i).padStart(8, '0')}`
const paginaItens = (n: number, de = 0, proxima?: string, total?: number) => ({
  items: Array.from({ length: n }, (_, i) => ({ id: `it${de + i}`, snippet: { position: de + i, publishedAt: '2026-01-02T00:00:00Z', videoOwnerChannelId: 'UCx' }, contentDetails: { videoId: video(de + i), videoPublishedAt: '2026-01-01T00:00:00Z' }, status: { privacyStatus: 'public' } })),
  ...(proxima ? { nextPageToken: proxima } : {}), ...(total !== undefined ? { pageInfo: { totalResults: total } } : {}),
})

function montar(rotas: { secoes?: Rota; playlists?: Rota; itens?: Rota }) {
  const contagem = { channelSections: 0, playlists: 0, playlistItems: 0 }
  const chamadas: string[] = []
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    const u = new URL(String(url))
    const recurso = u.pathname.split('/').pop() as keyof typeof contagem
    contagem[recurso]++
    chamadas.push(recurso)
    const rota = recurso === 'channelSections' ? rotas.secoes : recurso === 'playlists' ? rotas.playlists : rotas.itens
    const r = rota ? rota(u.searchParams, contagem[recurso]) : { json: { items: [] } }
    if (r.lanca) throw new Error('rede')
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200 })
  }) as unknown as typeof fetch
  return { fetchImpl, contagem, chamadas }
}
const secoesOk: Rota = () => ({ json: { items: [{ snippet: { position: 0, type: 'allPlaylists' } }] } })

function opsFalsos(sobre: Partial<OpsX3> = {}) {
  const log: { fn: string; a: unknown }[] = []
  const ops: OpsX3 = {
    schemaPresente: async () => true,
    lerLeituras: async () => new Map(),
    cotaDoDia: async () => new Map(),
    lerCanais: async () => new Map(),
    itensPresentes: async () => 0,
    playlistsRecord: vi.fn(async a => { log.push({ fn: 'playlistsRecord', a }); return { ids: new Map(a.rows.map(r => [r.playlist_id, `ref-${r.playlist_id.slice(2)}`])), atrasada: false, sumidas: 0, versoes: 0 } }),
    itemsRecord: vi.fn(async a => { log.push({ fn: 'itemsRecord', a }); return { gravados: a.rows.length, saidos: 0, massa: false, atrasada: false } }),
    sectionsRecord: vi.fn(async a => { log.push({ fn: 'sectionsRecord', a }); return 1 }),
    visitClose: vi.fn(async a => { log.push({ fn: 'visitClose', a }) }),
    registrarCota: vi.fn(async a => { log.push({ fn: 'registrarCota', a }) }),
    ...sobre,
  }
  return { ops, log }
}

let relogio = 0
function visitar(m: ReturnType<typeof montar>, ops: OpsX3, estado: EstadoDoCanal = vazio(), extra: Partial<EntradaDaVisita> = {}) {
  const t0 = AGORA
  return visitarCanal({ siteId: 's1', channelId: 'c1', youtubeChannelId: 'UCx', apiKey: 'k', ops, fetchImpl: m.fetchImpl, agora: () => t0 + relogio, t0, estado, ...extra })
}
afterEach(() => { relogio = 0; vi.useRealTimers() })

const fechos = (log: { fn: string; a: unknown }[]) => log.filter(l => l.fn === 'visitClose').map(l => l.a as Record<string, unknown>)
const itens = (log: { fn: string; a: unknown }[]) => log.filter(l => l.fn === 'itemsRecord').map(l => l.a as Record<string, unknown>)

describe('X3 visitar: caminho feliz e lista', () => {
  it('2 playlists de 3 itens: 4 chamadas, ok, p_complete verdadeiro em todas as gravações', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1, 2], undefined, 2) }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r).toMatchObject({ iniciada: true, estado: 'ok', motivo: null, unidades: 4, playlistsLeft: 0 })
    expect(m.chamadas).toEqual(['channelSections', 'playlists', 'playlistItems', 'playlistItems'])
    expect(log.filter(l => l.fn === 'playlistsRecord').every(l => (l.a as { complete: boolean }).complete)).toBe(true)
    expect(itens(log).every(a => a.complete === true && a.status === 'ok')).toBe(true)
    expect(fechos(log)[0]).toMatchObject({ status: 'ok', ciclo: true, units: 4, left: 0, listaVazia: false, secoesVazias: false })
  })

  it('erro 500 na 2ª página das playlists: parcial lista_cortada, p_complete falso, nenhuma chamada de itens das não vistas', async () => {
    const m = montar({ secoes: secoesOk, playlists: (_p, n) => (n === 1 ? { json: paginaPlaylists([1], 'T2', 2) } : { status: 500, json: {} }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'lista_cortada' })
    const rec = log.find(l => l.fn === 'playlistsRecord')!.a as { complete: boolean; rows: unknown[] }
    expect(rec.complete).toBe(false)
    expect(m.contagem.playlistItems).toBe(1)
    expect(fechos(log)[0]).toMatchObject({ status: 'parcial', reason: 'lista_cortada', ciclo: false, listaVazia: null })
  })

  it('120 playlists de 1 item e teto 40: para em exatamente 40 unidades, teto_por_canal, extra da cota só nela', async () => {
    const ids = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i)
    const m = montar({
      secoes: secoesOk,
      playlists: (_p, n) => ({ json: paginaPlaylists(ids((n - 1) * 50, Math.min(n * 50, 120)), n < 3 ? `T${n + 1}` : undefined, 120) }),
      itens: () => ({ json: paginaItens(1, 0, undefined, 1) }),
    })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r.unidades).toBe(40)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'teto_por_canal', tetoPorCanal: true })
    expect(r.playlistsLeft).toBe(120 - 36)
    expect(fechos(log)[0]).toMatchObject({ ciclo: false, left: 84, units: 40 })
    expect(ops.registrarCota).toHaveBeenCalledWith(expect.objectContaining({ units: 40, extra: { x3_teto_por_canal: 1 } }))
  })

  it('visita não cortada pelo teto: cota sem extra', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const { ops } = opsFalsos()
    await visitar(m, ops, { ...vazio(), empty_streak: 1 })
    expect(ops.registrarCota).toHaveBeenCalledWith({ siteId: 's1', nowMs: AGORA, units: 2 })
  })

  it('playlist com 11 páginas: lê 10, teto_itens, p_complete falso', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1], undefined, 1) }), itens: (_p, n) => ({ json: paginaItens(50, (n - 1) * 50, `T${n + 1}`, 550) }) })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops, vazio(), { unidadesPorVisita: 100 })
    expect(m.contagem.playlistItems).toBe(10)
    expect(r.motivo).toBe('teto_itens')
    expect(itens(log)[0]).toMatchObject({ complete: false, status: 'parcial', reason: 'teto_itens' })
    expect(fechos(log)[0]).toMatchObject({ ciclo: true })
  })

  it('lista vazia com playlist presente: a confirmar; segunda vez em outro dia (empty_streak 1): grava completo e ok', async () => {
    const m1 = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const a = opsFalsos()
    const r1 = await visitar(m1, a.ops, { ...vazio(), playlists: [conhecida(1)] })
    expect(r1).toMatchObject({ estado: 'parcial', motivo: 'lista_vazia_a_confirmar' })
    expect(a.log.some(l => l.fn === 'playlistsRecord')).toBe(false)
    expect(fechos(a.log)[0]).toMatchObject({ listaVazia: true, ciclo: false })
    expect(m1.contagem.playlistItems).toBe(0)
    const m2 = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const b = opsFalsos()
    const r2 = await visitar(m2, b.ops, { ...vazio(), playlists: [conhecida(1)], empty_streak: 1 })
    expect(r2).toMatchObject({ estado: 'ok', motivo: null })
    expect(b.log.find(l => l.fn === 'playlistsRecord')!.a).toMatchObject({ rows: [], complete: true })
    expect(fechos(b.log)[0]).toMatchObject({ listaVazia: false, ciclo: true })
  })

  it('1º vazio de canal sem histórico: lista_vazia_a_confirmar, parcial', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const { ops } = opsFalsos()
    expect(await visitar(m, ops)).toMatchObject({ estado: 'parcial', motivo: 'lista_vazia_a_confirmar' })
  })

  it('pageInfo.totalResults 12 e 10 lidas sem nextPageToken: contagem_difere, sem p_complete', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1, 2], undefined, 12) }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r.motivo).toBe('contagem_difere')
    expect((log.find(l => l.fn === 'playlistsRecord')!.a as { complete: boolean }).complete).toBe(false)
  })

  it('a playlist UU vinda da API nunca chega aos ops', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: { items: [playlistItem(1), { id: 'UUabc', snippet: { title: 'envios' } }], pageInfo: { totalResults: 2 } } }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r.estado).toBe('ok')
    const rows = (log.find(l => l.fn === 'playlistsRecord')!.a as { rows: { playlist_id: string }[] }).rows
    expect(rows.map(x => x.playlist_id)).toEqual(['PL1'])
  })
})

describe('X3 visitar: itens', () => {
  const base = (rotaItens: Rota, total = 1) => montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1], undefined, total) }), itens: rotaItens })

  it('11 itens lidos, totalResults 12, sem nextPageToken: p_complete falso, contagem_difere', async () => {
    const { ops, log } = opsFalsos()
    const r = await visitar(base(() => ({ json: paginaItens(11, 0, undefined, 12) })), ops)
    expect(r.motivo).toBe('contagem_difere')
    expect(itens(log)[0]).toMatchObject({ complete: false, status: 'parcial', reason: 'contagem_difere' })
  })
  it('totalResults ausente: idem', async () => {
    const { ops, log } = opsFalsos()
    const r = await visitar(base(() => ({ json: paginaItens(3) })), ops)
    expect(r.motivo).toBe('contagem_difere')
    expect(itens(log)[0]).toMatchObject({ complete: false })
  })
  it('saída em massa: o código passa p_complete e o retorno do banco vira parcial saida_em_massa_a_confirmar', async () => {
    const { ops, log } = opsFalsos({ itemsRecord: vi.fn(async () => ({ gravados: 0, saidos: 0, massa: true, atrasada: false })) })
    const r = await visitar(base(() => ({ json: paginaItens(10, 0, undefined, 10) })), ops)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'saida_em_massa_a_confirmar' })
    expect(ops.itemsRecord).toHaveBeenCalledWith(expect.objectContaining({ complete: true }))
    expect(fechos(log)[0]).toMatchObject({ ciclo: false })
  })
  it('itens vazios com item_count nulo e itens já presentes: itens_incoerentes', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: { items: [{ id: 'PL1', snippet: { title: 'x' } }], pageInfo: { totalResults: 1 } } }), itens: () => ({ json: { items: [], pageInfo: { totalResults: 0 } } }) })
    const { ops, log } = opsFalsos({ itensPresentes: async () => 7 })
    const r = await visitar(m, ops)
    expect(r.motivo).toBe('itens_incoerentes')
    expect(itens(log)[0]).toMatchObject({ rows: [], complete: false, status: 'parcial', reason: 'itens_incoerentes' })
    expect(fechos(log)[0]).toMatchObject({ ciclo: true })
  })
  it('itens vazios com item_count 0 e totalResults 0: completo ok', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: { items: [{ id: 'PL1', snippet: { title: 'x' }, contentDetails: { itemCount: 0 } }], pageInfo: { totalResults: 1 } } }), itens: () => ({ json: { items: [], pageInfo: { totalResults: 0 } } }) })
    const { ops, log } = opsFalsos()
    expect((await visitar(m, ops)).estado).toBe('ok')
    expect(itens(log)[0]).toMatchObject({ complete: true, status: 'ok' })
  })
  it('playlist some entre a lista e os itens (404): erro da playlist, parcial playlist_sumiu_no_meio, recuperável (p_ciclo falso)', async () => {
    const { ops, log } = opsFalsos()
    const r = await visitar(base(() => ({ status: 404, json: { error: { errors: [{ reason: 'playlistNotFound' }] } } })), ops)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'playlist_sumiu_no_meio' })
    expect(itens(log)[0]).toMatchObject({ status: 'erro', reason: 'playlist_sumiu_no_meio', complete: false })
    expect(fechos(log)[0]).toMatchObject({ ciclo: false })
  })
  it('resposta de itens sem items na 1ª página: resposta_invalida, nada gravado como completo', async () => {
    const { ops, log } = opsFalsos()
    const r = await visitar(base(() => ({ json: { foo: 1 } })), ops)
    expect(r.motivo).toBe('resposta_invalida')
    expect(itens(log)[0]).toMatchObject({ rows: [], complete: false, status: 'erro' })
  })
  it('a ordem das playlists: items_read_at nulo primeiro, depois o mais antigo', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1, 2, 3], undefined, 3) }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const { ops, log } = opsFalsos()
    const est: EstadoDoCanal = { ...vazio(), playlists: [
      conhecida(1, { items_read_at: new Date(AGORA - 9 * DIA).toISOString() }), conhecida(2), conhecida(3, { items_read_at: new Date(AGORA - 20 * DIA).toISOString() }),
    ] }
    await visitar(m, ops, est)
    expect(itens(log).map(a => a.playlistRef)).toEqual(['ref-2', 'ref-3', 'ref-1'])
  })
  it('playlist com motivo recuperável de ontem é relida; teto_itens de 3 dias atrás não', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1, 2], undefined, 2) }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const { ops, log } = opsFalsos()
    const est: EstadoDoCanal = { ...vazio(), playlists: [
      conhecida(1, { items_read_at: new Date(AGORA - 1 * DIA).toISOString(), items_status: 'parcial', items_reason: 'itens_cortados' }),
      conhecida(2, { items_read_at: new Date(AGORA - 3 * DIA).toISOString(), items_status: 'parcial', items_reason: 'teto_itens' }),
    ] }
    await visitar(m, ops, est)
    expect(itens(log).map(a => a.playlistRef)).toEqual(['ref-1'])
  })
})

describe('X3 visitar: volta (p_ciclo), erros e cota', () => {
  it('só teto_itens e contagem_difere (estruturais) com todas tentadas: p_ciclo verdadeiro', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1], undefined, 1) }), itens: () => ({ json: paginaItens(3, 0, undefined, 9) }) })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r.motivo).toBe('contagem_difere')
    expect(fechos(log)[0]).toMatchObject({ ciclo: true })
  })
  it('lista_vazia_a_confirmar: p_ciclo falso', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const { ops, log } = opsFalsos()
    await visitar(m, ops)
    expect(fechos(log)[0]).toMatchObject({ ciclo: false })
  })
  it('403 quotaExceeded no meio: para, cota_esgotada, nenhuma chamada depois', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1, 2], undefined, 2) }), itens: (_p, n) => (n === 1 ? { json: paginaItens(3, 0, undefined, 3) } : { status: 403, json: { error: { errors: [{ reason: 'quotaExceeded' }] } } }) })
    const { ops } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'cota_esgotada', cotaEsgotada: true })
    expect(m.contagem.playlistItems).toBe(2)
  })
  it('resposta sem items na 1ª chamada de lista: erro resposta_invalida', async () => {
    const m = montar({ secoes: () => ({ json: { x: 1 } }), playlists: () => ({ json: { x: 1 } }) })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r).toMatchObject({ estado: 'erro', motivo: 'resposta_invalida' })
    expect(fechos(log)[0]).toMatchObject({ status: 'erro' })
    expect(log.some(l => l.fn === 'playlistsRecord')).toBe(false)
  })
  it('seções: lista vazia e havia seção: não grava, a confirmar; com streak 1 grava', async () => {
    const mk = () => montar({ secoes: () => ({ json: { items: [] } }), playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const a = opsFalsos()
    const r = await visitar(mk(), a.ops, { ...vazio(), empty_streak: 1, ultima_secao_vazia: false })
    expect(r.motivo).toBe('secoes_vazias_a_confirmar')
    expect(a.log.some(l => l.fn === 'sectionsRecord')).toBe(false)
    expect(fechos(a.log)[0]).toMatchObject({ secoesVazias: true })
    const b = opsFalsos()
    const r2 = await visitar(mk(), b.ops, { ...vazio(), empty_streak: 1, ultima_secao_vazia: false, sections_empty_streak: 1 })
    expect(r2.estado).toBe('ok')
    expect(b.log.some(l => l.fn === 'sectionsRecord')).toBe(true)
    expect(fechos(b.log)[0]).toMatchObject({ secoesVazias: false })
  })
  it('gravação lança X3:canal_indisponivel: erro canal_pausado, nenhuma chamada depois, sem visit_close', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1, 2], undefined, 2) }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const { ops } = opsFalsos({ playlistsRecord: vi.fn(async () => { throw new ErroX3('canal_pausado', null) }) })
    const r = await visitar(m, ops)
    expect(r).toMatchObject({ estado: 'erro', motivo: 'canal_pausado' })
    expect(m.contagem.playlistItems).toBe(0)
    expect(ops.visitClose).not.toHaveBeenCalled()
    expect(ops.registrarCota).toHaveBeenCalled()
  })
  it('visit_close lança: a cota da visita É registrada (finally) e o motivo é gravacao_falhou', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const { ops } = opsFalsos({ visitClose: vi.fn(async () => { throw new ErroX3('gravacao_falhou', '23505') }) })
    const r = await visitar(m, ops)
    expect(r).toMatchObject({ estado: 'erro', motivo: 'gravacao_falhou', cotaNaoRegistrada: 0 })
    expect(ops.registrarCota).toHaveBeenCalledWith(expect.objectContaining({ units: 2 }))
  })
  it('recordQuota chamada depois do visit_close, com as unidades da visita', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1], undefined, 1) }), itens: () => ({ json: paginaItens(3, 0, undefined, 3) }) })
    const ordem: string[] = []
    const { ops } = opsFalsos({ visitClose: vi.fn(async () => { ordem.push('close') }), registrarCota: vi.fn(async () => { ordem.push('cota') }) })
    await visitar(m, ops)
    expect(ordem).toEqual(['close', 'cota'])
  })
  it('recordQuota que lança: cotaNaoRegistrada = unidades e a visita termina', async () => {
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const { ops } = opsFalsos({ registrarCota: vi.fn(async () => { throw new Error('x') }) })
    const r = await visitar(m, ops, { ...vazio(), empty_streak: 1 })
    expect(r).toMatchObject({ estado: 'ok', cotaNaoRegistrada: 2 })
  })
  it('recordQuota que nunca resolve: estoura em BANCO_MS (cota_nao_registrada) e a visita termina', async () => {
    vi.useFakeTimers()
    const m = montar({ secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([], undefined, 0) }) })
    const { ops } = opsFalsos({ registrarCota: vi.fn(() => new Promise<void>(() => undefined)) })
    const p = visitar(m, ops, { ...vazio(), empty_streak: 1 })
    await vi.advanceTimersByTimeAsync(6_000)
    expect(await p).toMatchObject({ estado: 'ok', cotaNaoRegistrada: 2 })
  })
})

describe('X3 visitar: tempo', () => {
  it('relógio em 60,1 s antes da 1ª chamada: a visita não começou (nenhum fecho, nenhuma cota)', async () => {
    relogio = X3_RULES.chamadaComecaAteMs + 100
    const m = montar({})
    const { ops } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r.iniciada).toBe(false)
    expect(m.fetchImpl).not.toHaveBeenCalled()
    expect(ops.visitClose).not.toHaveBeenCalled()
    expect(ops.registrarCota).not.toHaveBeenCalled()
  })
  it('em 59,9 s a chamada sai; passando de 60 s nenhuma chamada nova, mas o que foi lido está gravado e o visit_close sai', async () => {
    relogio = X3_RULES.chamadaComecaAteMs - 100
    const m = montar({
      secoes: () => { relogio += 200; return { json: { items: [] } } },
      playlists: () => ({ json: paginaPlaylists([1], undefined, 1) }),
    })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops, { ...vazio(), ultima_secao_vazia: true })
    expect(m.contagem.channelSections).toBe(1)
    expect(m.contagem.playlists).toBe(0)
    expect(r.estado).toBe('parcial')
    expect(r.motivo).toBe('lista_cortada')
    expect(fechos(log).length).toBe(1)
    expect(log.some(l => l.fn === 'sectionsRecord')).toBe(true)
  })
  it('tempo acaba entre playlists: sobrou, a lida está gravada e a esquerda conta', async () => {
    const m = montar({
      secoes: secoesOk, playlists: () => ({ json: paginaPlaylists([1, 2], undefined, 2) }),
      itens: () => { relogio = X3_RULES.chamadaComecaAteMs + 1; return { json: paginaItens(3, 0, undefined, 3) } },
    })
    const { ops, log } = opsFalsos()
    const r = await visitar(m, ops)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'sobrou', playlistsLeft: 1 })
    expect(itens(log).length).toBe(1)
    expect(fechos(log)[0]).toMatchObject({ ciclo: false })
  })
})

describe('X3 gravar: lerCanais paginado (I-1)', () => {
  type Linha = Record<string, unknown>
  function sbFalso(playlists: Linha[], opts: { pagina?: number } = {}) {
    const consultas: { tabela: string; de: number; ate: number }[] = []
    const sb = {
      from(tabela: string) {
        const st = { de: 0, ate: 999 }
        const b: Record<string, unknown> = {}
        const encadeia = () => b
        for (const m of ['select', 'eq', 'in', 'order', 'is', 'limit', 'abortSignal']) b[m] = encadeia
        b.range = (de: number, ate: number) => { st.de = de; st.ate = ate; return b }
        b.then = (res: (v: unknown) => unknown) => {
          const fonte = tabela === 'competitor_playlists' ? playlists : []
          consultas.push({ tabela, de: st.de, ate: st.ate })
          return Promise.resolve({ data: tabela === 'competitor_playlists' ? fonte.slice(st.de, st.ate + 1) : [], error: null }).then(res)
        }
        void opts
        return b
      },
    }
    return { sb, consultas }
  }
  const muitas = (n: number): Linha[] => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, competitor_channel_id: 'c1', playlist_id: `PL${i}`, items_read_at: null, items_status: null, items_reason: null, item_count: 1, missing_since: null }))

  it('2.500 playlists de um canal: 3 páginas e todas chegam ao Map', async () => {
    const { sb, consultas } = sbFalso(muitas(2500))
    const ops = criarOpsX3(sb as never)
    const m = await ops.lerCanais('s1', ['c1'])
    expect(m.get('c1')!.playlists.length).toBe(2500)
    expect(consultas.filter(c => c.tabela === 'competitor_playlists').length).toBe(3)
  })
  it('exatamente 1000 linhas dispara a página seguinte', async () => {
    const { sb, consultas } = sbFalso(muitas(1000))
    const m = await criarOpsX3(sb as never).lerCanais('s1', ['c1'])
    expect(m.get('c1')!.playlists.length).toBe(1000)
    expect(consultas.filter(c => c.tabela === 'competitor_playlists').length).toBe(2)
  })
  it('teto de páginas estourado: lança gravacao_falhou, nunca trunca', async () => {
    const infinitas = { from: () => { const b: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'in', 'order', 'range', 'abortSignal']) b[m] = () => b; b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: muitas(1000), error: null }).then(res); return b } }
    await expect(criarOpsX3(infinitas as never).lerCanais('s1', ['c1'])).rejects.toMatchObject({ codigo: 'gravacao_falhou' })
  })
  it('erro de leitura lança (nunca "nenhuma vista")', async () => {
    const quebrado = { from: () => { const b: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'in', 'order', 'range', 'abortSignal']) b[m] = () => b; b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { code: '57014', message: 'texto do banco' } }).then(res); return b } }
    await expect(criarOpsX3(quebrado as never).lerCanais('s1', ['c1'])).rejects.toMatchObject({ codigo: 'gravacao_falhou', sqlstate: '57014', message: 'gravacao_falhou' })
  })
})
