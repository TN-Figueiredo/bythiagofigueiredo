// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({
  leituraValida: (l: unknown) => l !== null && typeof l === 'object' && 'siteId' in (l as object),
  leituraDoEditor: vi.fn(),
}))
const requireEditUser = vi.fn()
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: (...a: unknown[]) => requireEditUser(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
const lerPaginaMock = vi.fn()
vi.mock('@/lib/youtube/teste-youtube/nativo/lista-borda', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/teste-youtube/nativo/lista-borda')>()
  return { ...real, lerPaginaDoCanal: (...a: unknown[]) => lerPaginaMock(...a) }
})

import * as borda from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import { leituraDoEditor } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerVideosDoCanal } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'

const { normalizarBusca, POR_PAGINA } = borda
const lerPaginaDoCanal = borda.lerPaginaDoCanal
const real = (await vi.importActual<typeof import('@/lib/youtube/teste-youtube/nativo/lista-borda')>('@/lib/youtube/teste-youtube/nativo/lista-borda')).lerPaginaDoCanal

const agora = new Date('2026-10-26T15:00:00Z')
const token = { siteId: 's' } as unknown as LeituraPrivadaDoSite
const recorte = (o: Partial<borda.RecorteDaLista> = {}): borda.RecorteDaLista => ({ busca: null, filtro: 'todos', pagina: 0, incluirYtId: null, ...o })

interface Vid { id: string; youtube_video_id: string; title: string; thumbnail_url: null; published_at: string }
const yt = (i: number) => `yt${String(i).padStart(9, '0')}`.slice(0, 11).padEnd(11, 'x')
function vid(i: number, o: Partial<Vid> = {}): Vid {
  return { id: `v${String(i).padStart(5, '0')}`, youtube_video_id: yt(i), title: `Vídeo ${i}`, thumbnail_url: null,
    published_at: new Date(agora.getTime() - (i + 30) * 86_400_000).toISOString(), ...o }
}
interface Cfg {
  videos: Vid[]
  /** por id: [soma, diasCobertos, publico] */
  volume?: (id: string) => [number, number, boolean | null] | undefined
  volumeErro?: boolean
  formatoErro?: boolean
  fichas?: unknown[]; testes?: unknown[]; nossos?: unknown[]
  isShort?: (ytId: string) => boolean | null
}
function cliente(c: Cfg) {
  const calls = { ranges: [] as Array<[number, number]>, volume: [] as number[], formato: [] as number[], tabelas: [] as string[] }
  const from = (tabela: string) => {
    calls.tabelas.push(tabela)
    let range: [number, number] | null = null
    const resolve = (): { data: unknown; error: null } => {
      if (tabela === 'youtube_videos') {
        if (range) { calls.ranges.push(range); return { data: c.videos.slice(range[0], range[1] + 1), error: null } }
        return { data: [], error: null }
      }
      if (tabela === 'ab_native_fichas') return { data: c.fichas ?? [], error: null }
      if (tabela === 'ab_native_tests') return { data: c.testes ?? [], error: null }
      if (tabela === 'ab_tests') return { data: c.nossos ?? [], error: null }
      return { data: [], error: null }
    }
    const cadeia: Record<string, unknown> = new Proxy({}, {
      get: (_t, k) => {
        if (k === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(resolve()).then(ok)
        if (k === 'range') return (a: number, b: number) => { range = [a, b]; return cadeia }
        return () => cadeia
      },
    })
    return cadeia
  }
  const rpc = (nome: string, args: Record<string, unknown>) => {
    if (nome === 'ab_lab_volume') {
      const ids = args.p_videos as string[]
      calls.volume.push(ids.length)
      if (c.volumeErro) return Promise.resolve({ data: null, error: { message: 'boom' } })
      const rows = ids.map((id) => { const v = c.volume?.(id); return v ? { video_id: id, soma: v[0], dias_cobertos: v[1], publico: v[2] } : { video_id: id, soma: 0, dias_cobertos: 0, publico: null } })
      return Promise.resolve({ data: rows, error: null })
    }
    const ids = args.p_ids as string[]
    calls.formato.push(ids.length)
    if (c.formatoErro) return Promise.resolve({ data: null, error: { message: 'boom' } })
    return Promise.resolve({ data: ids.map((y) => ({ youtube_video_id: y, raw: null, is_short: c.isShort ? c.isShort(y) : false })), error: null })
  }
  return { sb: { from, rpc } as unknown as SupabaseClient, calls }
}
/** 220 por dia = piso com 2 versões; 10 dias cobertos. */
const ACIMA: [number, number, boolean | null] = [2200, 10, true]
const ABAIXO: [number, number, boolean | null] = [100, 10, true]
const POUCOS: [number, number, boolean | null] = [900, 2, true]

beforeEach(() => { vi.mocked(Sentry.captureMessage).mockClear(); vi.mocked(Sentry.captureException).mockClear(); lerPaginaMock.mockReset(); requireEditUser.mockReset() })

describe('lerPaginaDoCanal: leitura do canal', () => {
  it('lê em blocos de 1000 com .range() até o teto; 2.001 vídeos → 2000, truncado e Sentry warning', async () => {
    const videos = Array.from({ length: 2001 }, (_, i) => vid(i))
    const { sb, calls } = cliente({ videos, volume: () => ACIMA })
    const p = await real(sb, 's', agora, token, recorte())
    expect(calls.ranges).toEqual([[0, 999], [1000, 1999], [2000, 2000]])
    expect(p.contagem.total).toBe(2000); expect(p.truncado).toBe(true)
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })
  it('exatamente 2000 vídeos não é truncado', async () => {
    const { sb } = cliente({ videos: Array.from({ length: 2000 }, (_, i) => vid(i)), volume: () => ABAIXO })
    const p = await real(sb, 's', agora, token, recorte())
    expect(p.contagem.total).toBe(2000); expect(p.truncado).toBe(false)
  })
  it('volume em lotes de 500 ids (2000 ids = 4 idas)', async () => {
    const { sb, calls } = cliente({ videos: Array.from({ length: 2000 }, (_, i) => vid(i)), volume: () => ABAIXO })
    await real(sb, 's', agora, token, recorte())
    expect(calls.volume).toEqual([500, 500, 500, 500])
  })
  it('ordem estável: published_at igual nas posições 20/21 não repete nem perde entre as páginas', async () => {
    const mesma = new Date(agora.getTime() - 5 * 86_400_000).toISOString()
    const videos = Array.from({ length: 45 }, (_, i) => vid(i, i === 20 || i === 21 ? { published_at: mesma } : {}))
    // as posições 20/21 ficam com a mesma data: o desempate é por id crescente
    videos.sort((a, b) => (Date.parse(b.published_at) - Date.parse(a.published_at)) || (a.id < b.id ? -1 : 1))
    const { sb } = cliente({ videos, volume: () => ABAIXO })
    const p0 = await real(sb, 's', agora, token, recorte({ pagina: 0 }))
    const p1 = await real(sb, 's', agora, token, recorte({ pagina: 1 }))
    const ids = [...p0.linhas, ...p1.linhas].map((l) => l.videoId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(vid(20).id); expect(ids).toContain(vid(21).id)
    expect(p0.linhas).toHaveLength(POR_PAGINA)
  })
})

describe('lerPaginaDoCanal: volume e contagem', () => {
  it('sem prova de leitura: tudo não lido, 0 testáveis, motivo sem_leitura e filtro efetivo "todos" com 20 linhas', async () => {
    const { sb } = cliente({ videos: Array.from({ length: 30 }, (_, i) => vid(i)) })
    const p = await real(sb, 's', agora, null, recorte({ filtro: 'testaveis' }))
    expect(p.contagem).toMatchObject({ naoLido: 30, testaveis: 0, semVolume: 0, motivoNaoLido: 'sem_leitura' })
    expect(p.filtroEfetivo).toBe('todos'); expect(p.linhas).toHaveLength(20)
  })
  it('RPC de volume com erro não lança: tudo em naoLido, motivo falha, Sentry registra', async () => {
    const { sb } = cliente({ videos: Array.from({ length: 5 }, (_, i) => vid(i)), volumeErro: true })
    const p = await real(sb, 's', agora, token, recorte())
    expect(p.contagem).toMatchObject({ naoLido: 5, semVolume: 0, testaveis: 0, motivoNaoLido: 'falha' })
    expect(Sentry.captureException).toHaveBeenCalled()
  })
  it('menos de 3 dias de relatório: poucos_dias, nunca semVolume nem testável', async () => {
    const { sb } = cliente({ videos: [vid(0), vid(1)], volume: () => POUCOS })
    const p = await real(sb, 's', agora, token, recorte())
    expect(p.contagem).toMatchObject({ naoLido: 2, semVolume: 0, testaveis: 0, motivoNaoLido: 'poucos_dias' })
  })
  it('canal sem relatório de alcance (0 dias cobertos): sem_relatorio, não poucos_dias eterno', async () => {
    const { sb } = cliente({ videos: [vid(0), vid(1)], volume: () => [0, 0, true] })
    const p = await real(sb, 's', agora, token, recorte())
    expect(p.contagem).toMatchObject({ naoLido: 2, motivoNaoLido: 'sem_relatorio' })
  })
  it('classifica: acima do piso e não Short = testável; abaixo = sem volume; privado sai; publico nulo conta como público', async () => {
    const videos = [vid(0), vid(1), vid(2), vid(3), vid(4)]
    const vol: Record<string, [number, number, boolean | null]> = { [videos[0]!.id]: ACIMA, [videos[1]!.id]: ABAIXO, [videos[2]!.id]: [2200, 10, false], [videos[3]!.id]: [2200, 10, null], [videos[4]!.id]: ACIMA }
    const { sb } = cliente({ videos, volume: (id) => vol[id], isShort: (y) => y === videos[4]!.youtube_video_id })
    const p = await real(sb, 's', agora, token, recorte())
    expect(p.contagem).toMatchObject({ total: 4, testaveis: 2, semVolume: 1, naoLido: 0, shorts: 1, motivoNaoLido: null })
    const c = p.contagem
    expect(c.testaveis + c.semVolume + c.naoLido + c.shorts).toBe(c.total)
  })
  it('contagem do canal não muda com a busca; totalDoFiltro muda', async () => {
    const videos = [vid(0, { title: 'Água de coco em Bangkok' }), vid(1), vid(2)]
    const { sb } = cliente({ videos, volume: () => ACIMA })
    const sem = await real(sb, 's', agora, token, recorte())
    const com = await real(sb, 's', agora, token, recorte({ busca: 'agua' }))
    expect(com.contagem).toEqual(sem.contagem)
    expect(sem.totalDoFiltro).toBe(3); expect(com.totalDoFiltro).toBe(1)
  })
  it('filtro testaveis devolve 20 por página, do mais novo ao mais velho; temMais', async () => {
    const { sb } = cliente({ videos: Array.from({ length: 45 }, (_, i) => vid(i)), volume: () => ACIMA })
    const p = await real(sb, 's', agora, token, recorte({ filtro: 'testaveis' }))
    expect(p.linhas.map((l) => l.videoId)).toEqual(Array.from({ length: 20 }, (_, i) => vid(i).id))
    expect(p.temMais).toBe(true); expect(p.filtroEfetivo).toBe('testaveis')
    const p2 = await real(sb, 's', agora, token, recorte({ filtro: 'testaveis', pagina: 2 }))
    expect(p2.linhas).toHaveLength(5); expect(p2.temMais).toBe(false)
  })
  it('filtro padrão: sem testáveis e com não lidos cai em "todos"; sem não lidos mantém "testaveis"', async () => {
    const a = cliente({ videos: [vid(0)], volume: () => POUCOS })
    expect((await real(a.sb, 's', agora, token, recorte({ filtro: 'testaveis' }))).filtroEfetivo).toBe('todos')
    const b = cliente({ videos: [vid(0)], volume: () => ABAIXO })
    expect((await real(b.sb, 's', agora, token, recorte({ filtro: 'testaveis' }))).filtroEfetivo).toBe('testaveis')
  })
  it('formato só para os acima do piso e para as linhas da página, nunca para os 300', async () => {
    const videos = Array.from({ length: 300 }, (_, i) => vid(i))
    const { sb, calls } = cliente({ videos, volume: (id) => (Number(id.slice(1)) < 10 ? ACIMA : ABAIXO) })
    await real(sb, 's', agora, token, recorte())
    // 10 acima do piso na primeira ida; 10 restantes das 20 da página na segunda
    expect(calls.formato.reduce((a, b) => a + b, 0)).toBe(20)
  })
})

describe('lerPaginaDoCanal: busca e extras', () => {
  it('busca sem acento: "agua" acha "Água de coco em Bangkok"; "%" e "_" são texto', async () => {
    const videos = [vid(0, { title: 'Água de coco em Bangkok' }), vid(1, { title: '100% real' }), vid(2, { title: 'a_b' }), vid(3, { title: 'abc' })]
    const { sb } = cliente({ videos, volume: () => ACIMA })
    expect((await real(sb, 's', agora, token, recorte({ busca: 'agua' }))).linhas.map((l) => l.videoId)).toEqual([vid(0).id])
    expect((await real(sb, 's', agora, token, recorte({ busca: '%%' }))).linhas.map((l) => l.videoId)).toEqual([])
    expect((await real(sb, 's', agora, token, recorte({ busca: '0% r' }))).linhas.map((l) => l.videoId)).toEqual([vid(1).id])
    expect((await real(sb, 's', agora, token, recorte({ busca: 'a_b' }))).linhas.map((l) => l.videoId)).toEqual([vid(2).id])
    expect(normalizarBusca('  ÁGUA   de  Côco ')).toBe('agua de coco')
  })
  it('busca com menos de 2 letras é tratada como sem busca', async () => {
    const { sb } = cliente({ videos: [vid(0), vid(1)], volume: () => ACIMA })
    expect((await real(sb, 's', agora, token, recorte({ busca: 'v' }))).linhas).toHaveLength(2)
  })
  it('página 0 sem busca inclui as extras de hoje mesmo fora do filtro; elas não reaparecem na página 1', async () => {
    const videos = Array.from({ length: 45 }, (_, i) => vid(i))
    const extra = videos[40]!
    const nossos = [{ id: 't1', youtube_video_id: extra.id, status: 'active', started_at: agora.toISOString(), restore_seq: 0, restore_status: null, config: { max_duration_days: 15 } }]
    const { sb } = cliente({ videos, volume: (id) => (id === extra.id ? ABAIXO : ACIMA), nossos })
    const p0 = await real(sb, 's', agora, token, recorte({ filtro: 'testaveis' }))
    expect(p0.linhas[0]!.videoId).toBe(extra.id)
    expect(p0.linhas).toHaveLength(21)
    const p1 = await real(sb, 's', agora, token, recorte({ filtro: 'testaveis', pagina: 1 }))
    expect(p1.linhas.map((l) => l.videoId)).not.toContain(extra.id)
    expect(p0.linhas.map((l) => l.videoId).slice(1).concat(p1.linhas.map((l) => l.videoId))).toHaveLength(40)
  })
  it('25 testáveis + 6 extras fora do filtro: restantes = 5, página 1 traz 5 e fecha; extrasForaDoFiltro = 6', async () => {
    const videos = Array.from({ length: 31 }, (_, i) => vid(i))
    const extrasIds = new Set(videos.slice(25).map((v) => v.id))
    const nossos = videos.slice(25).map((v, i) => ({ id: `t${i}`, youtube_video_id: v.id, status: 'active', started_at: agora.toISOString(), restore_seq: 0, restore_status: null, config: { max_duration_days: 15 } }))
    const { sb } = cliente({ videos, volume: (id) => (extrasIds.has(id) ? ABAIXO : ACIMA), nossos })
    const p0 = await real(sb, 's', agora, token, recorte({ filtro: 'testaveis' }))
    expect(p0.linhas).toHaveLength(26)
    expect(p0.totalDoFiltro).toBe(25)
    expect(p0.extrasForaDoFiltro).toBe(6)
    expect(p0.temMais).toBe(true)
    expect(p0.restantes).toBe(5)
    const p1 = await real(sb, 's', agora, token, recorte({ filtro: 'testaveis', pagina: 1 }))
    expect(p1.linhas).toHaveLength(5)
    expect(p1.restantes).toBe(0)
    expect(p1.temMais).toBe(false)
    expect(p1.extrasForaDoFiltro).toBe(0)
  })
  it('RPC de formato com erro: a página volta com linhas e contagem (formato nulo conta como testável), Sentry avisa, não lança', async () => {
    const videos = Array.from({ length: 5 }, (_, i) => vid(i))
    const { sb } = cliente({ videos, volume: () => ACIMA, formatoErro: true })
    const p = await real(sb, 's', agora, token, recorte({ filtro: 'testaveis' }))
    expect(p.linhas).toHaveLength(5)
    expect(p.contagem.testaveis).toBe(5)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
  it('incluirYtId fora da página entra nela; desconhecido é ignorado', async () => {
    const videos = Array.from({ length: 45 }, (_, i) => vid(i))
    const { sb } = cliente({ videos, volume: () => ACIMA })
    const p = await real(sb, 's', agora, token, recorte({ incluirYtId: videos[44]!.youtube_video_id }))
    expect(p.linhas.map((l) => l.videoId)).toContain(videos[44]!.id)
    const q = await real(sb, 's', agora, token, recorte({ incluirYtId: 'zzzzzzzzzzz' }))
    expect(q.linhas).toHaveLength(20)
  })
  it('nosso.teto: lê config; max_duration_days 15 → teto 15; sem config → padrão', async () => {
    const v = vid(0)
    const nossos = [{ id: 't1', youtube_video_id: v.id, status: 'active', started_at: agora.toISOString(), restore_seq: 2, restore_status: null, config: { max_duration_days: 15 } }]
    const { sb } = cliente({ videos: [v], volume: () => ACIMA, nossos })
    const p = await real(sb, 's', agora, token, recorte())
    expect(p.linhas[0]!.nosso).toMatchObject({ testId: 't1', teto: 15, restoreSeq: 2 })
    const sem = cliente({ videos: [v], volume: () => ACIMA, nossos: [{ ...nossos[0]!, config: null }] })
    expect((await real(sem.sb, 's', agora, token, recorte())).linhas[0]!.nosso?.teto).toBeGreaterThan(0)
  })
})

describe('lerVideosDoCanal (action)', () => {
  const pedido = { busca: null, filtro: 'todos', pagina: 0, incluirYtId: null }
  it('sem edição → sem_permissao', async () => {
    requireEditUser.mockRejectedValueOnce(new Error('forbidden'))
    expect(await lerVideosDoCanal(pedido)).toEqual({ ok: false, erro: 'sem_permissao' })
  })
  it('pedido fora do schema → pedido_invalido', async () => {
    requireEditUser.mockResolvedValue({ siteId: 's', userId: 'u' })
    expect(await lerVideosDoCanal({ ...pedido, pagina: -1 })).toEqual({ ok: false, erro: 'pedido_invalido' })
    expect(await lerVideosDoCanal({ ...pedido, incluirYtId: 'curto' })).toEqual({ ok: false, erro: 'pedido_invalido' })
    expect(await lerVideosDoCanal(null)).toEqual({ ok: false, erro: 'pedido_invalido' })
  })
  it('erro de banco → falha + Sentry; sucesso devolve a página com o site da sessão', async () => {
    requireEditUser.mockResolvedValue({ siteId: 'site-da-sessao', userId: 'u' })
    vi.mocked(leituraDoEditor).mockResolvedValue(token)
    lerPaginaMock.mockRejectedValueOnce(new Error('banco'))
    expect(await lerVideosDoCanal(pedido)).toEqual({ ok: false, erro: 'falha' })
    expect(Sentry.captureException).toHaveBeenCalled()
    lerPaginaMock.mockResolvedValueOnce({ linhas: [] })
    expect(await lerVideosDoCanal(pedido)).toEqual({ ok: true, pagina: { linhas: [] } })
    expect(lerPaginaMock.mock.calls[1]![1]).toBe('site-da-sessao')
  })
  it('guarda do dado privado: passa o token da prova de edição; sem prova passa nulo (lista sem volume, nunca erro)', async () => {
    requireEditUser.mockResolvedValue({ siteId: 's', userId: 'u' })
    lerPaginaMock.mockReset()
    lerPaginaMock.mockResolvedValue({ linhas: [] })
    vi.mocked(leituraDoEditor).mockResolvedValueOnce(token)
    await lerVideosDoCanal(pedido)
    expect(lerPaginaMock.mock.calls[0]![3]).toBe(token)
    vi.mocked(leituraDoEditor).mockResolvedValueOnce(null)
    expect(await lerVideosDoCanal(pedido)).toEqual({ ok: true, pagina: { linhas: [] } })
    expect(lerPaginaMock.mock.calls[1]![3]).toBeNull()
  })
})
void lerPaginaDoCanal
