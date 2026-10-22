// @vitest-environment node
// T5: leitura, recomeço (parte sem banco real), título da A no servidor e cópia da A em marcarStudioAberto/jaIniciei.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { criarSupabaseMemoria, type Tabelas } from '../../../helpers/supabase-memoria'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
const acesso = vi.hoisted(() => ({ requireEditUser: vi.fn() }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => acesso)
const servico = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: servico.get }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { lerFichaDoVideoCore, salvarFichaCore, resolverTituloOriginal, recomecarFichaCore, type FichaLinha } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { marcarStudioAbertoComCopiaCore, jaIniciouCore } from '@/lib/youtube/teste-youtube/nativo/ficha-fluxo'
import { INATIVIDADE_DESCARTE_MS } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import { lerFichaDoVideo, recomecarFicha, marcarStudioAberto, jaIniciei } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'

const S = '11111111-1111-4111-8111-111111111111'
const F = '22222222-2222-4222-8222-222222222222'
const V = '33333333-3333-4333-8333-333333333333'
const HOST = 'https://x.public.blob.vercel-storage.com'
const AGORA = new Date('2026-10-22T12:00:00Z')
const agora = () => AGORA
const ms = (d: number) => new Date(AGORA.getTime() - d).toISOString()

const jpg = (w = 1280, h = 720) => sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } }).jpeg().toBuffer()
function putFalso() {
  const fn = vi.fn(async (path: string) => ({ url: `${HOST}/${path}`, pathname: path }))
  return fn as unknown as typeof import('@vercel/blob').put & typeof fn
}
function rede(mapa: Record<string, () => Response | Promise<Response>>) {
  const pedidos: string[] = []
  const f = vi.fn(async (u: string | URL | Request) => { const url = String(u); pedidos.push(url); const h = mapa[url]; return h ? h() : new Response('', { status: 404 }) })
  return { f: f as unknown as typeof fetch, pedidos, spy: f }
}
const imagemOk = (b: Buffer) => () => new Response(new Uint8Array(b), { headers: { 'content-type': 'image/jpeg' } })
const MAXRES = 'https://i.ytimg.com/vi/abc/maxresdefault.jpg'

const ficha = (extra: Record<string, unknown> = {}) => ({
  id: F, site_id: S, video_id: V, campos: [], variantes: [], criada_em: ms(1000), criada_por: null, atualizada_em: ms(1000),
  studio_aberto_em: null, lembrar_em: null, descartada_em: null, registro_id: null, ...extra,
})
const base = (extra: Partial<Tabelas> = {}): Tabelas => ({
  ab_native_fichas: [ficha()],
  youtube_videos: [{ id: V, site_id: S, youtube_video_id: 'abc', title: 'Título do YouTube' }],
  ab_tests: [], ab_test_variants: [], yt_own_video_meta_daily: [], ...extra,
})
const variantesDe = (t: Tabelas): Array<{ n: number; titulo?: string; imagem?: { url: string } }> => t.ab_native_fichas![0]!.variantes as never

describe('lerFichaDoVideoCore', () => {
  it('vídeo sem ficha: ficha null, vencida false e nenhuma linha criada', async () => {
    const { sb, tabelas } = criarSupabaseMemoria(base({ ab_native_fichas: [] }))
    expect(await lerFichaDoVideoCore({ sb, siteId: S, videoId: V, agora })).toEqual({ ok: true, ficha: null, vencida: false })
    expect(tabelas.ab_native_fichas).toHaveLength(0)
  })
  it('fronteira de 14 d pela constante única: exatos 14 d não vencem, +1 ms vence; segue aberta no banco', async () => {
    for (const [extra, vencida] of [[INATIVIDADE_DESCARTE_MS, false], [INATIVIDADE_DESCARTE_MS + 1, true], [15 * 86_400_000, true]] as const) {
      const { sb, tabelas } = criarSupabaseMemoria(base({ ab_native_fichas: [ficha({ criada_em: ms(extra), atualizada_em: ms(extra) })] }))
      const r = await lerFichaDoVideoCore({ sb, siteId: S, videoId: V, agora })
      expect(r.ok && r.vencida).toBe(vencida)
      expect(r.ok && r.ficha?.id).toBe(F)
      expect(tabelas.ab_native_fichas![0]!.descartada_em).toBeNull()
    }
  })
  it('Studio aberto ontem mantém viva uma ficha criada há 20 d (greatest)', async () => {
    const { sb } = criarSupabaseMemoria(base({ ab_native_fichas: [ficha({ criada_em: ms(20 * 86_400_000), atualizada_em: ms(20 * 86_400_000), studio_aberto_em: ms(86_400_000) })] }))
    const r = await lerFichaDoVideoCore({ sb, siteId: S, videoId: V, agora })
    expect(r.ok && r.vencida).toBe(false)
  })
  it('só a aberta e a mais recente; vinculada, descartada e de outro site ficam de fora', async () => {
    const outra = { ...ficha({ id: 'nova', criada_em: ms(10) }) }
    const { sb } = criarSupabaseMemoria(base({ ab_native_fichas: [
      ficha({ id: 'vinc', registro_id: 'r', criada_em: ms(1) }), ficha({ id: 'desc', descartada_em: 'x', criada_em: ms(2) }),
      ficha({ id: 'alheia', site_id: 'zz', criada_em: ms(3) }), ficha({ id: 'velha', criada_em: ms(5000) }), outra,
    ] }))
    const r = await lerFichaDoVideoCore({ sb, siteId: S, videoId: V, agora })
    expect(r.ok && r.ficha?.id).toBe('nova')
  })
})

describe('título da A resolvido no servidor', () => {
  const t = (extra: Partial<Tabelas>) => criarSupabaseMemoria(base(extra))
  it('teste nosso ativo com B no ar: a is_original vence o retrato e o youtube_videos', async () => {
    const { sb } = t({
      ab_tests: [{ id: 'T', site_id: S, youtube_video_id: 'abc', status: 'active' }],
      ab_test_variants: [{ test_id: 'T', is_original: false, title_text: 'Título da B' }, { test_id: 'T', is_original: true, title_text: 'Título da original' }],
      yt_own_video_meta_daily: [{ site_id: S, video_id: V, day_pt: '2026-10-21', ab_variant_id: null, title_at_capture: 'Retrato' }],
    })
    expect(await resolverTituloOriginal(sb, S, V)).toBe('Título da original')
  })
  it('sem teste: último retrato sem variante; sem retrato: youtube_videos.title; nada: null', async () => {
    const { sb } = t({ yt_own_video_meta_daily: [
      { site_id: S, video_id: V, day_pt: '2026-10-19', ab_variant_id: null, title_at_capture: 'Velho' },
      { site_id: S, video_id: V, day_pt: '2026-10-21', ab_variant_id: null, title_at_capture: 'Recente' },
      { site_id: S, video_id: V, day_pt: '2026-10-22', ab_variant_id: 'v', title_at_capture: 'Da variante' },
    ] })
    expect(await resolverTituloOriginal(sb, S, V)).toBe('Recente')
    expect(await resolverTituloOriginal(t({}).sb, S, V)).toBe('Título do YouTube')
    expect(await resolverTituloOriginal(t({ youtube_videos: [{ id: V, site_id: S, youtube_video_id: 'abc', title: '  ' }] }).sb, S, V)).toBeNull()
    expect(await resolverTituloOriginal(t({}).sb, 'outro-site', V)).toBeNull()
  })
  it('1ª gravação com a n=1 vazia fixa o título; gravação posterior com o título do vídeo trocado mantém; o cliente não regrava', async () => {
    const m = criarSupabaseMemoria(base({
      ab_tests: [{ id: 'T', site_id: S, youtube_video_id: 'abc', status: 'paused' }],
      ab_test_variants: [{ test_id: 'T', is_original: true, title_text: 'Original do Lab' }],
    }))
    const dados = { campos: ['titulo' as const], variantes: [{ n: 2, tipo: 'titulo' as const, titulo: 'Nova' }] }
    const a = await salvarFichaCore({ sb: m.sb, siteId: S, fichaId: F, lido: m.tabelas.ab_native_fichas![0]!.atualizada_em as string, dados, agora })
    expect(a.ok).toBe(true)
    expect(variantesDe(m.tabelas)).toEqual([{ n: 1, tipo: 'titulo', titulo: 'Original do Lab' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }])
    m.tabelas.youtube_videos![0]!.title = 'Título trocado'
    m.tabelas.ab_test_variants![0]!.title_text = 'Outro'
    const lido = a.ok ? a.ficha.atualizada_em : ''
    const b = await salvarFichaCore({ sb: m.sb, siteId: S, fichaId: F, lido, agora, dados: { campos: ['titulo'], variantes: [{ n: 1, tipo: 'titulo', titulo: 'Cliente tentou' }, { n: 2, tipo: 'titulo', titulo: 'Nova 2' }] } })
    expect(b.ok).toBe(true)
    expect(variantesDe(m.tabelas).map((v) => v.titulo)).toEqual(['Original do Lab', 'Nova 2'])
  })
  it('gravação vazia não inventa a n=1', async () => {
    const m = criarSupabaseMemoria(base())
    await salvarFichaCore({ sb: m.sb, siteId: S, fichaId: F, lido: m.tabelas.ab_native_fichas![0]!.atualizada_em as string, dados: { campos: [], variantes: [] }, agora })
    expect(variantesDe(m.tabelas)).toEqual([])
  })
  it('a imagem da A (cópia do servidor) sobrevive à gravação do cliente que não a traz', async () => {
    const img = { url: `${HOST}/ab-native-ficha/s/f/${'a'.repeat(64)}.jpg`, sha256: 'a'.repeat(64), largura: 1280, altura: 720, origem: 'ytimg' }
    const m = criarSupabaseMemoria(base({ ab_native_fichas: [ficha({ variantes: [{ n: 1, tipo: 'miniatura', titulo: 'A', imagem: img }] })] }))
    const r = await salvarFichaCore({ sb: m.sb, siteId: S, fichaId: F, lido: m.tabelas.ab_native_fichas![0]!.atualizada_em as string, agora,
      dados: { campos: ['titulo'], variantes: [{ n: 1, tipo: 'titulo', titulo: 'A' }, { n: 2, tipo: 'titulo', titulo: 'B' }] } })
    expect(r.ok).toBe(true)
    expect(variantesDe(m.tabelas)[0]!.imagem).toMatchObject({ origem: 'ytimg', sha256: 'a'.repeat(64) })
  })
})

describe('marcarStudioAbertoComCopiaCore', () => {
  it('1ª abertura copia a A (ytimg permitido) e devolve a ficha nova com atualizada_em novo; a 2ª não faz fetch nem put nem mexe na imagem', async () => {
    const m = criarSupabaseMemoria(base())
    const put = putFalso(); const net = rede({ [MAXRES]: imagemOk(await jpg()) })
    const antes = m.tabelas.ab_native_fichas![0]!.atualizada_em
    const r1 = await marcarStudioAbertoComCopiaCore({ sb: m.sb, siteId: S, fichaId: F, buscar: net.f, put, agora })
    expect(r1.ok && r1.ficha.variantes.find((v) => v.n === 1)?.imagem).toMatchObject({ origem: 'ytimg' })
    expect(r1.ok && r1.ficha.atualizada_em).toBe(m.tabelas.ab_native_fichas![0]!.atualizada_em)
    expect(r1.ok && r1.ficha.atualizada_em).not.toBe(antes)
    expect(r1.ok && r1.ficha.studio_aberto_em).not.toBeNull()
    const gravada = JSON.stringify(variantesDe(m.tabelas))
    net.spy.mockClear(); put.mockClear()
    const r2 = await marcarStudioAbertoComCopiaCore({ sb: m.sb, siteId: S, fichaId: F, buscar: net.f, put, agora })
    expect(r2.ok && r2.ficha.atualizada_em).toBe(m.tabelas.ab_native_fichas![0]!.atualizada_em)
    expect(net.spy).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled()
    expect(JSON.stringify(variantesDe(m.tabelas))).toBe(gravada)
  })
  it('depois de uma 1ª cópia que falhou, a 2ª abertura não faz nenhum fetch nem put', async () => {
    const m = criarSupabaseMemoria(base())
    const put = putFalso(); const falha = rede({})
    const r1 = await marcarStudioAbertoComCopiaCore({ sb: m.sb, siteId: S, fichaId: F, buscar: falha.f, put, agora })
    expect(r1.ok && r1.ficha.studio_aberto_em).not.toBeNull() // a falha da cópia não aparece
    expect(variantesDe(m.tabelas)).toEqual([])
    const net = rede({ [MAXRES]: imagemOk(await jpg()) })
    await marcarStudioAbertoComCopiaCore({ sb: m.sb, siteId: S, fichaId: F, buscar: net.f, put, agora })
    expect(net.spy).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled()
    expect(variantesDe(m.tabelas)).toEqual([])
  })
  it('ficha de outro site: não encontrado, sem fetch', async () => {
    const m = criarSupabaseMemoria(base())
    const net = rede({})
    const r = await marcarStudioAbertoComCopiaCore({ sb: m.sb, siteId: 'outro', fichaId: F, buscar: net.f, put: putFalso(), agora })
    expect(r.ok).toBe(false)
    expect(net.spy).not.toHaveBeenCalled()
  })
  it('duas primeiras aberturas concorrentes gravam uma só imagem', async () => {
    const m = criarSupabaseMemoria(base())
    const bytes = await jpg()
    const um = () => marcarStudioAbertoComCopiaCore({ sb: m.sb, siteId: S, fichaId: F, buscar: rede({ [MAXRES]: imagemOk(bytes) }).f, put: putFalso(), agora })
    const rs = await Promise.all([um(), um()])
    expect(rs.every((r) => r.ok)).toBe(true)
    expect(variantesDe(m.tabelas).filter((v) => v.imagem)).toHaveLength(1)
  })
  describe('rede que nunca responde', () => {
    afterEach(() => { vi.useRealTimers() })
    it('a action devolve em até 8 s, com a ficha e sem imagem', async () => {
      vi.useFakeTimers({ now: AGORA })
      const m = criarSupabaseMemoria(base())
      const nunca = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch
      const p = marcarStudioAbertoComCopiaCore({ sb: m.sb, siteId: S, fichaId: F, buscar: nunca, put: putFalso(), agora })
      await vi.advanceTimersByTimeAsync(8_000)
      const r = await p
      expect(r.ok && r.ficha.studio_aberto_em).not.toBeNull()
      expect(variantesDe(m.tabelas)).toEqual([])
    })
  })
})

describe('jaIniciouCore', () => {
  const confirmar = () => vi.fn(async () => ({ ok: true as const, registroId: 'R', pausados: [], naoPausados: [] }))
  it('n=1 sem imagem e Studio nunca aberto: copia (inclusive ytimg), antes de confirmar', async () => {
    const m = criarSupabaseMemoria(base()); const c = confirmar()
    const net = rede({ [MAXRES]: imagemOk(await jpg()) })
    c.mockImplementation(async () => { expect(variantesDe(m.tabelas)[0]?.imagem).toBeDefined(); return { ok: true as const, registroId: 'R', pausados: [], naoPausados: [] } })
    const r = await jaIniciouCore({ sb: m.sb, siteId: S, userId: 'u', fichaId: F, buscar: net.f, put: putFalso(), agora, confirmar: c })
    expect(r.ok).toBe(true); expect(c).toHaveBeenCalledTimes(1)
    expect(net.pedidos).toEqual([MAXRES])
  })
  it('Studio já aberto: tenta só (a)/(b) e nunca i.ytimg.com', async () => {
    const m = criarSupabaseMemoria(base({ ab_native_fichas: [ficha({ studio_aberto_em: ms(1000) })] }))
    const net = rede({ [MAXRES]: imagemOk(await jpg()) })
    await jaIniciouCore({ sb: m.sb, siteId: S, userId: 'u', fichaId: F, buscar: net.f, put: putFalso(), agora, confirmar: confirmar() })
    expect(net.pedidos.filter((u) => u.includes('ytimg.com'))).toEqual([])
    expect(variantesDe(m.tabelas)).toEqual([])
  })
  it('Studio já aberto com retrato diário anterior: copia pela fonte (b)', async () => {
    const retrato = `${HOST}/obs/dia.jpg`
    const m = criarSupabaseMemoria(base({
      ab_native_fichas: [ficha({ studio_aberto_em: ms(1000) })],
      yt_own_video_meta_daily: [{ site_id: S, video_id: V, day_pt: '2026-10-21', ab_variant_id: null, thumbnail_blob_url: retrato }],
    }))
    const net = rede({ [retrato]: imagemOk(await jpg()) })
    await jaIniciouCore({ sb: m.sb, siteId: S, userId: 'u', fichaId: F, buscar: net.f, put: putFalso(), agora, confirmar: confirmar() })
    expect(variantesDe(m.tabelas)[0]?.imagem).toBeDefined()
  })
  it('n=1 já com imagem: nenhum fetch; a falha da cópia não impede a confirmação', async () => {
    const img = { url: `${HOST}/ab-native-ficha/s/f/${'a'.repeat(64)}.jpg`, sha256: 'a'.repeat(64), largura: 1, altura: 1 }
    const m = criarSupabaseMemoria(base({ ab_native_fichas: [ficha({ variantes: [{ n: 1, tipo: 'miniatura', imagem: img }] })] }))
    const net = rede({}); const c = confirmar()
    await jaIniciouCore({ sb: m.sb, siteId: S, userId: 'u', fichaId: F, buscar: net.f, put: putFalso(), agora, confirmar: c })
    expect(net.spy).not.toHaveBeenCalled(); expect(c).toHaveBeenCalledTimes(1)
    const m2 = criarSupabaseMemoria(base()); const c2 = confirmar()
    expect((await jaIniciouCore({ sb: m2.sb, siteId: S, userId: 'u', fichaId: F, buscar: rede({}).f, put: putFalso(), agora, confirmar: c2 })).ok).toBe(true)
    expect(c2).toHaveBeenCalledTimes(1)
  })
})

describe('recomecarFichaCore (guardas; o fluxo completo está na integração)', () => {
  it('id de outro site ou ficha já fechada: não encontrado, sem tocar nada', async () => {
    const m = criarSupabaseMemoria(base({ ab_native_fichas: [ficha(), ficha({ id: 'f2', descartada_em: 'x' })] }))
    expect(await recomecarFichaCore({ sb: m.sb, siteId: 'outro', userId: 'u', fichaVencidaId: F })).toEqual({ ok: false, error: 'não encontrado' })
    expect(await recomecarFichaCore({ sb: m.sb, siteId: S, userId: 'u', fichaVencidaId: 'f2' })).toEqual({ ok: false, error: 'não encontrado' })
  })
})

describe('actions: acesso e entrada', () => {
  beforeEach(() => { acesso.requireEditUser.mockReset(); servico.get.mockReset() })
  it('sem permissão recusa antes de ler o banco (as quatro)', async () => {
    acesso.requireEditUser.mockRejectedValue(new Error('forbidden'))
    expect(await lerFichaDoVideo(V)).toEqual({ ok: false, error: 'forbidden' })
    expect(await recomecarFicha(F)).toEqual({ ok: false, error: 'forbidden' })
    expect(await marcarStudioAberto(F)).toEqual({ ok: false, error: 'forbidden' })
    expect(await jaIniciei(F)).toMatchObject({ ok: false, erro: 'sem_permissao' })
    expect(servico.get).not.toHaveBeenCalled()
  })
  it('id que não é uuid é recusado antes do banco', async () => {
    acesso.requireEditUser.mockResolvedValue({ siteId: S, userId: S })
    expect((await lerFichaDoVideo('x')).ok).toBe(false)
    expect((await recomecarFicha('x')).ok).toBe(false)
    expect(servico.get).not.toHaveBeenCalled()
  })
  it('lerFichaDoVideo usa o site do contexto', async () => {
    acesso.requireEditUser.mockResolvedValue({ siteId: 'outro-site', userId: S })
    servico.get.mockReturnValue(criarSupabaseMemoria(base()).sb)
    expect(await lerFichaDoVideo(V)).toEqual({ ok: true, ficha: null, vencida: false })
  })
})

export type _Usado = FichaLinha
