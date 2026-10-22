// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as Sentry from '@sentry/nextjs'
import { criarSupabaseMemoria, type Tabelas } from '../../../helpers/supabase-memoria'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
const acesso = vi.hoisted(() => ({ requireEditUser: vi.fn() }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => acesso)
const servico = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: servico.get }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import {
  eUrlDaFicha, guardarImagemDaFichaCore, copiarOriginalParaFichaCore, PREFIXO_FICHA,
} from '@/lib/youtube/teste-youtube/nativo/imagem-ficha'
import { FichaRascunhoSchema, VarianteFichaSchema } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { enviarImagemDaFicha } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'

const S = '11111111-1111-4111-8111-111111111111'
const F = '22222222-2222-4222-8222-222222222222'
const V = '33333333-3333-4333-8333-333333333333'
const HOST = 'https://x.public.blob.vercel-storage.com'
const SHA = 'a'.repeat(64)
const AGORA = new Date('2026-10-22T12:00:00Z')

describe('módulo leve ficha-url', () => {
  it('não arrasta sharp, @vercel/blob nem server-only; ficha.ts importa dele e imagem-ficha reexporta', async () => {
    const leve = readFileSync('src/lib/youtube/teste-youtube/nativo/ficha-url.ts', 'utf8').replace(/^\/\/.*$/gm, '')
    expect(leve).not.toMatch(/sharp|@vercel\/blob|server-only|^import /m)
    const ficha = readFileSync('src/lib/youtube/teste-youtube/nativo/ficha.ts', 'utf8')
    expect(ficha).toContain("nativo/ficha-url'")
    expect(ficha).not.toContain('imagem-ficha')
    const leveMod = await import('@/lib/youtube/teste-youtube/nativo/ficha-url')
    expect(leveMod.eUrlDaFicha).toBe(eUrlDaFicha)
  })
})

describe('eUrlDaFicha e o Zod da ficha', () => {
  const img = (url: string) => ({ n: 2, tipo: 'miniatura' as const, imagem: { url, sha256: SHA, largura: 1280, altura: 720 } })
  it('aceita o prefixo da ficha; recusa rascunho, http e outro host', () => {
    expect(PREFIXO_FICHA).toBe('ab-native-ficha/')
    expect(eUrlDaFicha(`${HOST}/ab-native-ficha/s/f/x.jpg`)).toBe(true)
    expect(VarianteFichaSchema.safeParse(img(`${HOST}/ab-native-ficha/s/f/x.jpg`)).success).toBe(true)
    expect(VarianteFichaSchema.safeParse(img(`${HOST}/ab-test/abc/B.jpg`)).success).toBe(false)
    expect(VarianteFichaSchema.safeParse(img(`http://x.public.blob.vercel-storage.com/ab-native-ficha/s/f/x.jpg`)).success).toBe(false)
    expect(VarianteFichaSchema.safeParse(img('https://evil.example.com/ab-native-ficha/s/f/x.jpg')).success).toBe(false)
    expect(VarianteFichaSchema.safeParse(img('https://evil.example.com/?h=a.blob.vercel-storage.com/ab-native-ficha/')).success).toBe(false)
  })
  it('origem e capturada_em passam; origem desconhecida não', () => {
    const base = { url: `${HOST}/ab-native-ficha/s/f/x.jpg`, sha256: SHA, largura: 1, altura: 1 }
    const ok = FichaRascunhoSchema.safeParse({ campos: ['miniatura'], variantes: [{ n: 1, tipo: 'miniatura', imagem: { ...base, origem: 'ytimg', capturada_em: AGORA.toISOString() } }] })
    expect(ok.success).toBe(true)
    expect(VarianteFichaSchema.safeParse({ n: 1, tipo: 'miniatura', imagem: { ...base, origem: 'outra' } }).success).toBe(false)
  })
})

const jpg = (w = 1280, h = 720, cor = '#c33') => sharp({ create: { width: w, height: h, channels: 3, background: cor } }).jpeg().toBuffer()
const png = () => sharp({ create: { width: 640, height: 360, channels: 3, background: '#33c' } }).png().toBuffer()
const webp = () => sharp({ create: { width: 640, height: 360, channels: 3, background: '#3c3' } }).webp().toBuffer()

/** `put` falso fiel ao @vercel/blob 2.5.0: lança se o caminho existe e `allowOverwrite` não vem. */
function putFalso() {
  const existentes = new Set<string>()
  const fn = vi.fn(async (path: string, _b: unknown, opts?: { allowOverwrite?: boolean }) => {
    if (existentes.has(path) && !opts?.allowOverwrite) throw new Error('This blob already exists')
    existentes.add(path)
    return { url: `${HOST}/${path}`, pathname: path }
  })
  return fn as unknown as typeof import('@vercel/blob').put & typeof fn
}

const ficha = (extra: Record<string, unknown> = {}) => ({
  id: F, site_id: S, video_id: V, campos: [], variantes: [], criada_em: 'c', criada_por: null, atualizada_em: 't0',
  studio_aberto_em: null, lembrar_em: null, descartada_em: null, registro_id: null, ...extra,
})
const base = (extra: Partial<Tabelas> = {}): Tabelas => ({
  ab_native_fichas: [ficha()],
  youtube_videos: [{ id: V, site_id: S, youtube_video_id: 'abc' }],
  ab_tests: [], ab_test_variants: [], yt_own_video_meta_daily: [], ...extra,
})

describe('guardarImagemDaFichaCore', () => {
  it('EXIF é removido: JPEG com GPS/Copyright entra e o que vai ao put não tem exif; mede e hasheia o re-codificado', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    const comExif = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#c33' } })
      .jpeg().withExif({ IFD0: { Copyright: 'segredo', ImageDescription: 'GPS -23.5,-46.6' } }).toBuffer()
    expect((await sharp(comExif).metadata()).exif).toBeDefined()
    const r = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: comExif, put })
    expect(r.ok).toBe(true)
    const enviado = put.mock.calls[0][1] as Buffer
    const m = await sharp(enviado).metadata()
    expect(m.exif).toBeUndefined()
    expect(m.format).toBe('jpeg')
    if (r.ok) expect(r.imagem.sha256).toBe(createHash('sha256').update(enviado).digest('hex'))
  })
  it('EXIF: a orientação é aplicada antes de tirar os metadados (largura e altura trocadas)', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    const girada = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#c33' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const r = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: girada, put })
    expect(r.ok && r.imagem.largura).toBe(100)
    expect(r.ok && r.imagem.altura).toBe(200)
  })
  it('PNG segue PNG depois de re-codificar', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: await png(), put })
    expect((await sharp(put.mock.calls[0][1] as Buffer).metadata()).format).toBe('png')
  })
  it('JPEG: caminho ab-native-ficha/<site>/<ficha>/<sha>.jpg, dimensões do metadata, ficha devolvida', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    const bytes = await jpg()
    const r = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes, put })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.imagem).toMatchObject({ largura: 1280, altura: 720 })
    expect(r.imagem.url).toBe(`${HOST}/${PREFIXO_FICHA}${S}/${F}/${r.imagem.sha256}.jpg`)
    expect(eUrlDaFicha(r.imagem.url)).toBe(true)
    expect(r.ficha.id).toBe(F)
  })
  it('PNG vira .png', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const r = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: await png(), put: putFalso() })
    expect(r.ok && r.imagem.url.endsWith('.png')).toBe(true)
  })
  it('WebP recusado sem put (inclusive quando o navegador diria image/jpeg: o tipo vem do conteúdo)', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    const r = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: await webp(), put })
    expect(r).toEqual({ ok: false, error: 'A imagem precisa ser JPEG ou PNG.' })
    expect(put).not.toHaveBeenCalled()
  })
  it('lixo que não é imagem recusado sem put', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    expect((await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: Buffer.from('nada'), put })).ok).toBe(false)
    expect(put).not.toHaveBeenCalled()
  })
  it('2 MB passam; 2 MB + 1 byte recusado sem put', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    const r = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: Buffer.alloc(2 * 1024 * 1024 + 1), put })
    expect(r).toEqual({ ok: false, error: 'A imagem precisa ter até 2 MB.' })
    expect(put).not.toHaveBeenCalled()
  })
  it.each([
    ['de outro site', { site_id: '99999999-9999-4999-8999-999999999999' }],
    ['vinculada', { registro_id: 'r1' }],
    ['descartada', { descartada_em: 'd' }],
  ])('ficha %s: "não encontrado" sem put', async (_n, extra) => {
    const { sb } = criarSupabaseMemoria(base({ ab_native_fichas: [ficha(extra)] }))
    const put = putFalso()
    const r = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes: await jpg(), put })
    expect(r).toEqual({ ok: false, error: 'não encontrado' })
    expect(put).not.toHaveBeenCalled()
  })
  it('2º envio do mesmo arquivo passa, devolve a mesma URL e o put leva allowOverwrite (put falso lança sem a opção)', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const put = putFalso()
    const bytes = await jpg()
    const a = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes, put })
    const b = await guardarImagemDaFichaCore({ sb, siteId: S, fichaId: F, bytes, put })
    expect(a.ok && b.ok && a.imagem.url === b.imagem.url).toBe(true)
    expect(put.mock.calls[1]![2]).toMatchObject({ allowOverwrite: true, addRandomSuffix: false, access: 'public' })
  })
})

describe('action enviarImagemDaFicha', () => {
  beforeEach(() => { acesso.requireEditUser.mockReset(); servico.get.mockReset() })
  const form = (f: File) => { const d = new FormData(); d.set('file', f); return d }
  it('sem permissão recusa antes de tocar o banco; id inválido e arquivo ausente também', async () => {
    acesso.requireEditUser.mockRejectedValue(new Error('forbidden'))
    expect(await enviarImagemDaFicha(F, form(new File([new Uint8Array(3)], 'a.jpg')))).toEqual({ ok: false, error: 'forbidden' })
    acesso.requireEditUser.mockResolvedValue({ siteId: S, userId: S })
    expect((await enviarImagemDaFicha('nao-uuid', form(new File([new Uint8Array(3)], 'a.jpg')))).ok).toBe(false)
    expect((await enviarImagemDaFicha(F, new FormData())).ok).toBe(false)
    expect(servico.get).not.toHaveBeenCalled()
  })
  it('arquivo acima de 2 MB recusado antes de ler o banco', async () => {
    acesso.requireEditUser.mockResolvedValue({ siteId: S, userId: S })
    const r = await enviarImagemDaFicha(F, form(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' })))
    expect(r).toEqual({ ok: false, error: 'A imagem precisa ter até 2 MB.' })
    expect(servico.get).not.toHaveBeenCalled()
  })
  it('usa o siteId do contexto: ficha de outro site é "não encontrado"', async () => {
    acesso.requireEditUser.mockResolvedValue({ siteId: '99999999-9999-4999-8999-999999999999', userId: S })
    servico.get.mockReturnValue(criarSupabaseMemoria(base()).sb)
    const r = await enviarImagemDaFicha(F, form(new File([new Uint8Array(await jpg())], 'a.jpg', { type: 'image/jpeg' })))
    expect(r).toEqual({ ok: false, error: 'não encontrado' })
  })
})

describe('copiarOriginalParaFichaCore', () => {
  const warn = vi.mocked(Sentry.captureMessage)
  beforeEach(() => { warn.mockClear() })
  afterEach(() => { vi.useRealTimers() })

  /** fetch falso por URL; registra o que foi pedido. */
  function rede(mapa: Record<string, () => Response | Promise<Response>>) {
    const pedidos: string[] = []
    const f = vi.fn(async (u: string | URL | Request) => {
      const url = String(u); pedidos.push(url)
      const h = mapa[url]
      return h ? h() : new Response('', { status: 404 })
    })
    return { f: f as unknown as typeof fetch, pedidos }
  }
  const imagemOk = (b: Buffer) => () => new Response(new Uint8Array(b), { headers: { 'content-type': 'image/jpeg' } })
  const YT = (v: string) => `https://i.ytimg.com/vi/abc/${v}.jpg`
  const externos = (p: string[]) => p.filter((u) => u.includes('ytimg.com'))

  it('(a) teste nosso ativo: a fonte é a is_original, sem fetch externo', async () => {
    const orig = `${HOST}/ab-originals/o.jpg`
    const { sb, tabelas } = criarSupabaseMemoria(base({
      ab_tests: [{ id: 'T', site_id: S, youtube_video_id: 'abc', status: 'active' }],
      ab_test_variants: [{ test_id: 'T', is_original: true, blob_url: orig }, { test_id: 'T', is_original: false, blob_url: `${HOST}/ab-test/T/B.jpg` }],
    }))
    const { f, pedidos } = rede({ [orig]: imagemOk(await jpg()) })
    const r = await copiarOriginalParaFichaCore({ sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: f, put: putFalso(), agora: () => AGORA })
    expect(r.ok && r.imagem.origem).toBe('teste_nosso')
    expect(externos(pedidos)).toEqual([])
    const v = (tabelas.ab_native_fichas![0]!.variantes as Array<{ n: number; imagem: { origem: string; capturada_em: string; url: string } }>)[0]!
    expect(v).toMatchObject({ n: 1, imagem: { origem: 'teste_nosso', capturada_em: AGORA.toISOString() } })
    expect(eUrlDaFicha(v.imagem.url)).toBe(true)
  })

  it('(b) retrato diário anterior ao dia: sem fetch externo; ignora o do dia e o de variante', async () => {
    const certo = `${HOST}/observatorio/thumbs/dia-30.jpg`
    const { sb } = criarSupabaseMemoria(base({
      yt_own_video_meta_daily: [
        { site_id: S, video_id: V, day_pt: '2026-10-20', ab_variant_id: null, thumbnail_blob_url: `${HOST}/velho.jpg` },
        { site_id: S, video_id: V, day_pt: '2026-10-21', ab_variant_id: null, thumbnail_blob_url: certo },
        { site_id: S, video_id: V, day_pt: '2026-10-21', ab_variant_id: 'x', thumbnail_blob_url: `${HOST}/da-variante.jpg` },
        { site_id: S, video_id: V, day_pt: '2026-10-22', ab_variant_id: null, thumbnail_blob_url: `${HOST}/de-hoje.jpg` },
      ],
    }))
    const { f, pedidos } = rede({ [certo]: imagemOk(await jpg()) })
    const r = await copiarOriginalParaFichaCore({ sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: f, put: putFalso(), agora: () => AGORA })
    expect(r.ok && r.imagem.origem).toBe('retrato_diario')
    expect(pedidos).toEqual([certo])
  })

  it('(c) maxres 404 cai no sd; sd 404 cai no hq; content-type que não é imagem é pulado', async () => {
    const bytes = await jpg(640, 480)
    const t1 = rede({ [YT('sddefault')]: imagemOk(bytes) })
    const a = await copiarOriginalParaFichaCore({ sb: criarSupabaseMemoria(base()).sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: t1.f, put: putFalso(), agora: () => AGORA })
    expect(a.ok && a.imagem).toMatchObject({ origem: 'ytimg', largura: 640 })
    expect(t1.pedidos[0]).toBe(YT('maxresdefault'))

    const t2 = rede({
      [YT('maxresdefault')]: () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
      [YT('hqdefault')]: imagemOk(bytes),
    })
    const b = await copiarOriginalParaFichaCore({ sb: criarSupabaseMemoria(base()).sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: t2.f, put: putFalso(), agora: () => AGORA })
    expect(b.ok && b.imagem.origem).toBe('ytimg')
  })

  it('tudo 404: sem_miniatura, nada gravado, Sentry só com fichaId e motivo', async () => {
    const { sb, tabelas } = criarSupabaseMemoria(base())
    const put = putFalso()
    const r = await copiarOriginalParaFichaCore({ sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: rede({}).f, put, agora: () => AGORA })
    expect(r).toEqual({ ok: false, motivo: 'sem_miniatura' })
    expect(tabelas.ab_native_fichas![0]!.variantes).toEqual([])
    expect(put).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { fichaId: F, motivo: 'sem_miniatura' } })
    expect(Object.keys((warn.mock.calls[0]![1] as { extra: object }).extra).sort()).toEqual(['fichaId', 'motivo'])
  })

  it('permitirYtimg=false com (a) e (b) vazias: sem_miniatura sem nenhum fetch', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const { f, pedidos } = rede({})
    const r = await copiarOriginalParaFichaCore({ sb, siteId: S, fichaId: F, permitirYtimg: false, buscar: f, put: putFalso(), agora: () => AGORA })
    expect(r).toEqual({ ok: false, motivo: 'sem_miniatura' })
    expect(pedidos).toEqual([])
  })

  it('a 2ª chamada não troca a A (ja_tem) e não grava de novo', async () => {
    const { sb, tabelas } = criarSupabaseMemoria(base())
    const put = putFalso()
    const bytes = await jpg()
    const pedido = { sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: rede({ [YT('maxresdefault')]: imagemOk(bytes) }).f, put, agora: () => AGORA }
    expect((await copiarOriginalParaFichaCore(pedido)).ok).toBe(true)
    const antes = JSON.stringify(tabelas.ab_native_fichas![0]!.variantes)
    const outra = rede({ [YT('maxresdefault')]: imagemOk(await jpg(1280, 720, '#0f0')) })
    const r = await copiarOriginalParaFichaCore({ ...pedido, buscar: outra.f })
    expect(r).toEqual({ ok: false, motivo: 'ja_tem' })
    expect(JSON.stringify(tabelas.ab_native_fichas![0]!.variantes)).toBe(antes)
    expect(put).toHaveBeenCalledTimes(1)
    expect(outra.pedidos).toEqual([])
  })

  it('preserva as demais versões da ficha ao gravar a A', async () => {
    const outra = { n: 2, tipo: 'titulo', titulo: 'Novo' }
    const { sb, tabelas } = criarSupabaseMemoria(base({ ab_native_fichas: [ficha({ variantes: [outra] })] }))
    const r = await copiarOriginalParaFichaCore({ sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: rede({ [YT('maxresdefault')]: imagemOk(await jpg()) }).f, put: putFalso(), agora: () => AGORA })
    expect(r.ok).toBe(true)
    const vs = tabelas.ab_native_fichas![0]!.variantes as Array<{ n: number }>
    expect(vs.map((v) => v.n)).toEqual([1, 2])
    expect(vs[1]).toEqual(outra)
  })

  it('fetch que nunca responde: devolve em até 8 s com falhou e sem imagem', async () => {
    vi.useFakeTimers({ now: AGORA })
    const { sb, tabelas } = criarSupabaseMemoria(base())
    const nunca = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch
    const inicio = Date.now()
    const p = copiarOriginalParaFichaCore({ sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: nunca, put: putFalso(), agora: () => AGORA })
    await vi.advanceTimersByTimeAsync(8_000)
    const r = await p
    expect(r).toEqual({ ok: false, motivo: 'falhou' })
    expect(Date.now() - inicio).toBeLessThanOrEqual(8_000)
    expect(tabelas.ab_native_fichas![0]!.variantes).toEqual([])
    expect(warn.mock.calls.at(-1)![1]).toMatchObject({ extra: { fichaId: F, motivo: 'falhou' } })
  })

  it('duas chamadas concorrentes gravam uma só imagem', async () => {
    const { sb, tabelas } = criarSupabaseMemoria(base())
    const bytes = await jpg()
    const pedido = () => copiarOriginalParaFichaCore({ sb, siteId: S, fichaId: F, permitirYtimg: true, buscar: rede({ [YT('maxresdefault')]: imagemOk(bytes) }).f, put: putFalso(), agora: () => AGORA })
    const rs = await Promise.all([pedido(), pedido()])
    expect(rs.filter((r) => r.ok)).toHaveLength(1)
    expect(rs.filter((r) => !r.ok && r.motivo === 'ja_tem')).toHaveLength(1)
    const vs = tabelas.ab_native_fichas![0]!.variantes as Array<{ n: number; imagem?: unknown }>
    expect(vs.filter((v) => v.imagem)).toHaveLength(1)
  })

  it('ficha de outro site: falhou, nada gravado', async () => {
    const { sb } = criarSupabaseMemoria(base())
    const r = await copiarOriginalParaFichaCore({ sb, siteId: '99999999-9999-4999-8999-999999999999', fichaId: F, permitirYtimg: true, buscar: rede({}).f, put: putFalso() })
    expect(r).toEqual({ ok: false, motivo: 'falhou' })
  })
})
