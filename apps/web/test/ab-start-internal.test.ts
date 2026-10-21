// @vitest-environment node
// startAbTestInternal (P4a T10): código real contra o banco falso único (helpers/banco-ab) e o YouTubeFalso.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { YouTubeFalso, H, imagemComDhash } from './helpers/youtube-falso'
import { AGORA, BLOB, IMG, SITE, criarBanco } from './helpers/banco-ab'
import type { Fila, OpcoesBanco } from './helpers/banco-ab'

const { fanOut, ensureFreshToken, canal, put } = vi.hoisted(() => ({
  fanOut: vi.fn(), ensureFreshToken: vi.fn(), canal: vi.fn(), put: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@vercel/blob', () => ({ put }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: canal,
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('serviço real não é para testes') } }))

import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { MSG_EM_ANDAMENTO } from '@/lib/youtube/ab-acao-saida'

const MINUTO = 60_000
const antes = (ms: number) => new Date(AGORA.getTime() - ms).toISOString()
const campo = (o: Fila) => ({ estado: 'falhou', destino: 'original', em: antes(10 * MINUTO), forcado: false, escreveu: false, erro: null, attempts: 1, ...o })

/** Rascunho de 2 variantes (A original, B). `primeiraB` põe a B em sort_order 0 (a 1ª do ciclo 0 deixa de ser a original). */
async function montar(o: OpcoesBanco & { primeiraB?: boolean; thumb?: Buffer; titulo?: string; ytOpcoes?: Partial<ConstructorParameters<typeof YouTubeFalso>[0]> } = {}) {
  const banco = criarBanco({
    status: 'draft', semCiclos: true, restoreSeq: 0, ...o,
    ajustar: (v) => { if (o.primeiraB) { v[0]!.sort_order = 1; v[1]!.sort_order = 0 }; o.ajustar?.(v) },
  })
  const yt = new YouTubeFalso({ titulo: o.titulo ?? 'Título A', thumb: o.thumb ?? IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B }, ...o.ytOpcoes })
  vi.stubGlobal('fetch', yt.fetch)
  const iniciar = () => startAbTestInternal('teste-1', SITE, { supabase: banco.supabase })
  return { banco, yt, iniciar }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  ensureFreshToken.mockResolvedValue({ accessToken: 'tok' })
  canal.mockResolvedValue('UCpt')
  let n = 0
  put.mockImplementation(async () => ({ url: `https://abc.public.blob.vercel-storage.com/ab-originals/novo-${++n}.jpg` }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('startAbTestInternal: reivindicação e ciclo 0', () => {
  it('E1 do ensaio: combo com A original no ciclo 0 -> nenhuma escrita no YouTube, restore_seq 1, restore_status {}, ciclo 0 aberto', async () => {
    const { banco, yt, iniciar } = await montar({ testType: 'combo' })
    const r = await iniciar()
    expect(r).toEqual({ ok: true })
    expect(yt.escritas()).toEqual([])
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 1 })
    expect(banco.teste().restore_status).toEqual({})
    expect(banco.teste().started_at).toBe(AGORA.toISOString())
    expect(banco.ciclosAbertos()).toHaveLength(1)
    expect(banco.cicloAberto()).toMatchObject({ cycle_number: 0, variant_id: 'A' })
  })
  it('F-P3: iniciar grava restore_status {} (nunca nulo) na reivindicação, e preserva o valor existente', async () => {
    const a = await montar()
    let naReivindicacao: unknown = 'não visto'
    a.banco.antesDaReleitura(() => { naReivindicacao ??= null })
    a.yt.antesDeEscrever(() => {})
    const original = a.banco.supabase.rpc.bind(a.banco.supabase)
    ;(a.banco.supabase as unknown as { rpc: unknown }).rpc = (n: string, x: Record<string, unknown>) => {
      if (n === 'ab_resume_commit') naReivindicacao = structuredClone(a.banco.teste().restore_status) // antes do fecho: o valor da reivindicação
      return original(n as never, x as never)
    }
    await a.iniciar()
    expect(naReivindicacao).toEqual({})
    expect(a.banco.teste().restore_status).toEqual({})
  })
  it('a reivindicação já vale durante a escrita: status active, restore_seq 1 e restore_status {} antes do ciclo 0', async () => {
    const { banco, yt, iniciar } = await montar({ primeiraB: true })
    let visto: Fila | null = null
    yt.antesDeEscrever(() => { visto = { ...banco.teste() }; expect(banco.ciclosAbertos()).toHaveLength(0) })
    await iniciar()
    expect(visto).toMatchObject({ status: 'active', restore_seq: 1 })
    expect((visto as unknown as Fila).restore_status).toEqual({}) // nunca nulo (toEqual: toMatchObject deixa passar null)
  })
  it('1ª variante que não é a original: escreve a thumbnail e abre o ciclo 0 com applied_metadata', async () => {
    const { banco, yt, iniciar } = await montar({ primeiraB: true })
    const r = await iniciar()
    expect(r.ok).toBe(true)
    expect(yt.escritas()).toEqual(['thumbnails.set'])
    expect(banco.cicloAberto()).toMatchObject({ cycle_number: 0, variant_id: 'B', applied_metadata: { thumbnail_set: true, youtube_thumbnail_url: 'https://i.ytimg.com/x.jpg' } })
  })
  it('1ª variante não original e a escrita é recusada -> volta a draft, ok:false, nenhum ciclo', async () => {
    const { banco, yt, iniciar } = await montar({ primeiraB: true })
    yt.recusar('thumbnails.set', 403, 'forbidden')
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(banco.teste()).toMatchObject({ status: 'draft', started_at: null })
    expect(banco.ciclos()).toHaveLength(0)
  })
  it('perde a vez antes da escrita (outra ação reivindica): não escreve, não desfaz o que é do outro, devolve em andamento', async () => {
    const { banco, yt, iniciar } = await montar({ primeiraB: true })
    banco.antesDaReleitura(() => { banco.setTeste({ restore_seq: 9, status: 'paused' }) })
    const r = await iniciar()
    expect(r).toEqual({ ok: false, error: MSG_EM_ANDAMENTO })
    expect(banco.teste()).toMatchObject({ status: 'paused', restore_seq: 9 })
    expect(yt.escritas()).toEqual([])
  })
  it('falha na escrita depois que OUTRO escritor reivindicou (restore_seq mudou): não desfaz o que é do outro', async () => {
    const { banco, yt, iniciar } = await montar({ primeiraB: true })
    yt.antesDeEscrever(() => { banco.setTeste({ restore_seq: 7 }) }) // status segue active: só o restore_seq separa os escritores
    yt.recusar('thumbnails.set', 403, 'forbidden')
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 7 })
  })
  it('fecho devolve nulo (pausa entre a escrita e o ciclo 0): ok:false, nenhum ciclo aberto, status do outro escritor', async () => {
    const { banco, yt, iniciar } = await montar({ primeiraB: true })
    yt.depoisDeEscrever(() => { banco.setTeste({ restore_seq: 5, status: 'paused' }) })
    const r = await iniciar()
    expect(r).toEqual({ ok: false, error: MSG_EM_ANDAMENTO })
    expect(banco.ciclosAbertos()).toHaveLength(0)
    expect(banco.teste().status).toBe('paused')
  })
  it('ab_resume_commit com erro -> volta a draft e devolve a mensagem', async () => {
    const { banco, iniciar } = await montar()
    const original = banco.supabase.rpc.bind(banco.supabase)
    ;(banco.supabase as unknown as { rpc: unknown }).rpc = (nome: string, a: Record<string, unknown>) =>
      nome === 'ab_resume_commit' ? Promise.resolve({ data: null, error: { message: 'deadlock' } }) : original(nome as never, a as never)
    const r = await iniciar()
    expect(r).toEqual({ ok: false, error: 'deadlock' })
    expect(banco.teste().status).toBe('draft')
  })
  it('1ª variante original com YOUTUBE_API_KEY: o ciclo 0 guarda a URL atual como base de drift', async () => {
    const { banco, yt, iniciar } = await montar()
    vi.stubEnv('YOUTUBE_API_KEY', 'fake-key')
    vi.stubGlobal('fetch', (async (url: string, init?: RequestInit) =>
      String(url).includes('key=fake-key')
        ? new Response(JSON.stringify({ items: [{ snippet: { thumbnails: { high: { url: 'https://i.ytimg.com/vi/yt-1/hqdefault.jpg' } } } }] }))
        : yt.fetch(url, init)) as typeof fetch)
    expect((await iniciar()).ok).toBe(true)
    expect(banco.cicloAberto()?.applied_metadata).toEqual({ youtube_thumbnail_url: 'https://i.ytimg.com/vi/yt-1/hqdefault.jpg' })
  })
})

describe('startAbTestInternal: recusas antes de escrever', () => {
  it('rascunho antigo de descrição: recusa com a mensagem do 422, sem reivindicar', async () => {
    const { banco, yt, iniciar } = await montar({ testType: 'description' as never })
    expect(await iniciar()).toEqual({ ok: false, error: 'A descrição não participa mais do teste A/B' })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
    expect(yt.escritas()).toEqual([])
  })
  it('tipo desconhecido: recusa e não inicia', async () => {
    const { banco, iniciar } = await montar({ testType: 'xyz' as never })
    expect(await iniciar()).toEqual({ ok: false, error: 'Tipo de teste desconhecido' })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
  })
  it('returns error if test is not draft', async () => {
    const { iniciar } = await montar({ status: 'active' })
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(r.error).toContain('draft')
  })
  it('P4a-I11: variante B de thumbnail sem blob_url -> ok:false "a variante B não tem imagem"; status draft; restore_seq igual; zero escritas', async () => {
    const { banco, yt, iniciar } = await montar({ ajustar: (v) => { v[1]!.blob_url = null } })
    const antesSeq = banco.teste().restore_seq
    const r = await iniciar()
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('a variante B não tem imagem') })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: antesSeq })
    expect(yt.escritas()).toEqual([])
    expect(yt.chamadas).toEqual([])
  })
  it('teste de título não exige imagem da variante', async () => {
    const { iniciar } = await montar({ testType: 'title', ajustar: (v) => { v[1]!.blob_url = null } })
    expect((await iniciar()).ok).toBe(true)
  })
  it('usa o token do canal dono do vídeo (UC…) e o site do teste', async () => {
    const { iniciar } = await montar()
    await iniciar()
    expect(ensureFreshToken).toHaveBeenCalledWith(SITE, 'youtube', 'UCpt')
    expect(canal).toHaveBeenCalledWith(expect.anything(), SITE, 'video-interno')
  })
  it('falha ao LER o canal: mensagem genérica ao usuário, detalhe no Sentry, nada reivindicado', async () => {
    const { banco, iniciar } = await montar()
    canal.mockRejectedValue(new Error('channelAccountIdForVideo: statement timeout'))
    const r = await iniciar()
    expect(r.error).toBe('Could not start the test: the YouTube channel could not be read. Try again.')
    expect(Sentry.captureException).toHaveBeenCalled()
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
  })
  it('canal do vídeo não identificado: recusa com mensagem legível, sem pedir token e sem reivindicar', async () => {
    const { banco, iniciar } = await montar()
    canal.mockResolvedValue(null)
    const r = await iniciar()
    expect(r.error).toMatch(/Could not identify which YouTube channel owns this video/)
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
  })
})

describe('startAbTestInternal: o original é relido depois da reivindicação', () => {
  it('24 (= E0 do ensaio): título mudado e thumbnail trocada depois da criação -> original_title = o do YouTube, nova blob_url da is_original, thumbnail_dhash recalculado', async () => {
    const { banco, iniciar } = await montar({ testType: 'combo', thumb: await imagemComDhash(H.C), titulo: 'Título Y' })
    const antesBlob = banco.variantes()[0]!.blob_url
    expect((await iniciar()).ok).toBe(true)
    expect(banco.teste().original_title).toBe('Título Y')
    const a = banco.variantes()[0]!
    expect(a.blob_url).not.toBe(antesBlob)
    expect(banco.teste().original_thumbnail_url).toBe(a.blob_url)
    expect(a.thumbnail_dhash).toMatch(/^[0-9a-f]{16}$/)
    expect(a.thumbnail_dhash).not.toBe(H.A)
    expect(put).toHaveBeenCalledTimes(1)
  })
  it('nada mudou: título igual e thumbnail dentro de 6 bits -> nenhuma cópia nova no Blob, original intacto', async () => {
    const { banco, iniciar } = await montar({ testType: 'combo' })
    await iniciar()
    expect(put).not.toHaveBeenCalled()
    expect(banco.variantes()[0]).toMatchObject({ blob_url: BLOB('A'), thumbnail_dhash: H.A })
    expect(banco.teste().original_title).toBe('Título A')
  })
  it('o campo que não está em teste não é relido: teste de thumbnail ignora o título', async () => {
    const { banco, yt, iniciar } = await montar({ testType: 'thumbnail', titulo: 'Outro título' })
    await iniciar()
    expect(banco.teste().original_title).toBe('Título A')
    expect(yt.chamadas).not.toContain('videos.list')
  })
  it('releitura que falha (videos.list 500) recusa o início e volta a draft', async () => {
    const { banco, yt, iniciar } = await montar({ testType: 'title' })
    yt.recusar('videos.list', 500, 'backendError')
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(banco.teste()).toMatchObject({ status: 'draft', started_at: null })
    expect(banco.ciclos()).toHaveLength(0)
    expect(yt.escritas()).toEqual([])
  })
  it('vídeo que não vem na leitura (apagado) recusa o início e volta a draft', async () => {
    const banco = criarBanco({ status: 'draft', semCiclos: true, testType: 'title' })
    const yt = new YouTubeFalso({ thumb: IMG.A, videoApagado: true })
    vi.stubGlobal('fetch', yt.fetch)
    const r = await startAbTestInternal('teste-1', SITE, { supabase: banco.supabase })
    expect(r.ok).toBe(false)
    expect(banco.teste().status).toBe('draft')
  })
  it('thumbnail ilegível (HEAD 404) recusa o início e volta a draft', async () => {
    const { banco, yt, iniciar } = await montar()
    const original = yt.fetch
    vi.stubGlobal('fetch', (async (u: string, i?: RequestInit) => (String(u).startsWith('https://i.ytimg.com') ? new Response(null, { status: 404 }) : original(u, i))) as typeof fetch)
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(banco.teste().status).toBe('draft')
  })
  it('falha ao guardar a cópia no Blob volta a draft', async () => {
    const { banco, iniciar } = await montar({ thumb: await imagemComDhash(H.C) })
    put.mockRejectedValue(new Error('blob fora'))
    const r = await iniciar()
    expect(r).toEqual({ ok: false, error: 'blob fora' })
    expect(banco.teste().status).toBe('draft')
  })
})

describe('startAbTestInternal: testes anteriores do mesmo vídeo (Y-5)', () => {
  const T1 = (extra: Fila): Fila => ({ id: 'teste-0', name: 'Antigo', status: 'completed', restore_seq: 3, youtube_video_id: 'video-interno', ...extra })

  it('P4a-I9 (parte 2): T1 em falhou no mesmo vídeo -> desistiu/novo_teste, em = agora, escreveu false, attempts mantido, uma linha nova no histórico e UM aviso', async () => {
    const t1 = T1({ restore_status: { thumbnail: campo({ attempts: 2, escreveu: null, erro: { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' } }) } })
    const { banco, iniciar } = await montar({ extras: [t1] })
    expect((await iniciar()).ok).toBe(true)
    const rs = banco.outro('teste-0').restore_status as Record<string, Fila>
    expect(rs.thumbnail).toMatchObject({ estado: 'desistiu', motivo: 'novo_teste', em: AGORA.toISOString(), escreveu: false, attempts: 2 })
    expect(banco.outro('teste-0').restore_seq).toBe(4)
    expect(banco.restores()).toEqual([expect.objectContaining({ test_id: 'teste-0', seq: 4, campo: 'thumbnail', estado: 'desistiu', escreveu: false })])
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(fanOut.mock.calls[0]![0]).toMatchObject({ siteId: SITE, type: 'youtube.ab_restore_failed' })
  })
  it('pulado_sem_original e pulado_drift também viram desistiu; campo ok do mesmo teste fica como estava', async () => {
    const ok = campo({ estado: 'ok', escreveu: true })
    const t1 = T1({ test_type: 'combo', restore_status: { title: campo({ estado: 'pulado_drift' }), thumbnail: ok } })
    const { banco, iniciar } = await montar({ extras: [t1] })
    await iniciar()
    const rs = banco.outro('teste-0').restore_status as Record<string, Fila>
    expect(rs.title).toMatchObject({ estado: 'desistiu', motivo: 'novo_teste' })
    expect(rs.thumbnail).toEqual(ok)
  })
  it('F-D2: T1 com campo em_andamento de 16 min -> converte em falhou/interrompido ANTES de marcar desistiu; o histórico guarda os dois, na ordem', async () => {
    const t1 = T1({ restore_status: { thumbnail: campo({ estado: 'em_andamento', em: antes(16 * MINUTO), attempts: 0, escreveu: null }) } })
    const { banco, iniciar } = await montar({ extras: [t1] })
    await iniciar()
    expect(banco.restores().map((r) => [r.seq, r.estado, r.escreveu])).toEqual([[4, 'falhou', null], [5, 'desistiu', false]])
    expect(banco.outro('teste-0').restore_seq).toBe(5)
    expect((banco.outro('teste-0').restore_status as Record<string, Fila>).thumbnail).toMatchObject({ estado: 'desistiu', motivo: 'novo_teste', attempts: 1 })
  })
  it('P4b Y-2: outro teste do vídeo com thumbnail em_andamento de 30 s -> start recusa com MSG_EM_ANDAMENTO, nada escrito', async () => {
    const voo = campo({ estado: 'em_andamento', em: antes(30_000), escreveu: null })
    const { banco, yt, iniciar } = await montar({ extras: [T1({ restore_status: { thumbnail: voo } })] })
    const r = await iniciar()
    expect(r).toEqual({ ok: false, error: MSG_EM_ANDAMENTO })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
    expect(banco.outro('teste-0')).toMatchObject({ restore_seq: 3, restore_status: { thumbnail: voo } })
    expect(yt.escritas()).toEqual([])
    expect(banco.ciclos()).toHaveLength(0)
  })
  it('Y-A7: a leitura dos outros testes do vídeo falha -> start recusa (não falha aberto), nada escrito', async () => {
    const { banco, yt, iniciar } = await montar()
    const from = banco.supabase.from.bind(banco.supabase)
    ;(banco.supabase as unknown as { from: unknown }).from = (tabela: string) => {
      const base = from(tabela as never) as unknown as { select: (c?: string) => unknown }
      if (tabela !== 'ab_tests') return base
      return new Proxy(base, { get(alvo, prop, recv) {
        if (prop !== 'select') return Reflect.get(alvo, prop, recv)
        return (cols?: string) => {
          if (cols !== 'id, site_id, name, restore_seq, restore_status') return alvo.select(cols)
          const q: Record<string, unknown> = {}
          q.eq = () => q
          q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'banco caiu' } }).then(ok)
          return q
        }
      } })
    }
    const r = await iniciar()
    expect(r).toEqual({ ok: false, error: MSG_EM_ANDAMENTO })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
    expect(yt.escritas()).toEqual([])
    expect(Sentry.captureException).toHaveBeenCalled()
  })
  it('P4b: ab-start converte o interrompido com a conta de tentativas (attempts 2 -> desistiu/tres_falhas, depois novo_teste não sobrescreve o motivo)', async () => {
    const t1 = T1({ restore_status: { thumbnail: campo({ estado: 'em_andamento', em: antes(16 * MINUTO), attempts: 2, escreveu: null }) } })
    const { banco, iniciar } = await montar({ extras: [t1] })
    await iniciar()
    expect(banco.restores().map((r) => [r.seq, r.estado])).toEqual([[4, 'desistiu']])
    expect((banco.outro('teste-0').restore_status as Record<string, Fila>).thumbnail).toMatchObject({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 })
  })
  it('campo em_andamento há 10 min (ainda dentro dos 15) não é tocado', async () => {
    const parado = campo({ estado: 'em_andamento', em: antes(10 * MINUTO), escreveu: null })
    const { banco, iniciar } = await montar({ extras: [T1({ restore_status: { thumbnail: parado } })] })
    await iniciar()
    expect(banco.outro('teste-0')).toMatchObject({ restore_seq: 3, restore_status: { thumbnail: parado } })
    expect(fanOut).not.toHaveBeenCalled()
  })
  it('campo já desistiu não é regravado: sem linha nova, sem segundo aviso', async () => {
    const d = campo({ estado: 'desistiu', motivo: 'novo_teste' })
    const { banco, iniciar } = await montar({ extras: [T1({ restore_status: { thumbnail: d } })] })
    await iniciar()
    expect(banco.outro('teste-0')).toMatchObject({ restore_seq: 3, restore_status: { thumbnail: d } })
    expect(banco.restores()).toEqual([])
    expect(fanOut).not.toHaveBeenCalled()
  })
  it('teste de outro vídeo ou sem restore_status não é tocado', async () => {
    const outroVideo = T1({ id: 'teste-9', youtube_video_id: 'outro', restore_status: { thumbnail: campo({}) } })
    const nulo = T1({ id: 'teste-8', restore_status: null })
    const { banco, iniciar } = await montar({ extras: [outroVideo, nulo] })
    await iniciar()
    expect(banco.outro('teste-9').restore_seq).toBe(3)
    expect(banco.outro('teste-8').restore_seq).toBe(3)
  })
  it('falha no aviso do outro teste vai ao Sentry e NÃO impede o início', async () => {
    const t1 = T1({ restore_status: { thumbnail: campo({}) } })
    const { banco, iniciar } = await montar({ extras: [t1] })
    fanOut.mockRejectedValueOnce(new Error('ntfy fora'))
    const r = await iniciar()
    expect(r.ok).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalled()
    expect(banco.teste().status).toBe('active')
  })
})

describe('startAbTestInternal: escrita parcial, prazo e guarda de conteúdo (T10 r1)', () => {
  const avancar = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms))
  it('DEVE 1: combo, a thumbnail da B entrou e o título foi recusado -> a thumbnail ORIGINAL volta ao ar antes do rascunho', async () => {
    const { banco, yt, iniciar } = await montar({ testType: 'combo', primeiraB: true })
    yt.recusar('videos.update', 403, 'forbidden')
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(banco.teste()).toMatchObject({ status: 'draft', started_at: null })
    expect(yt.escritas()).toEqual(['thumbnails.set', 'videos.update', 'thumbnails.set']) // B, título recusado, a original
    expect(Buffer.compare(yt.thumb, IMG.A)).toBe(0)
    expect(banco.ciclos()).toHaveLength(0)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(fanOut).not.toHaveBeenCalled()
  })
  it('DEVE 1: a volta da thumbnail também falha -> Sentry nível error e UM aviso ao dono (tipo ab_start_partial)', async () => {
    const { yt, iniciar } = await montar({ testType: 'combo', primeiraB: true })
    yt.recusar('videos.update', 403, 'forbidden')
    const f = yt.fetch
    let sets = 0
    vi.stubGlobal('fetch', (async (u: string, i?: RequestInit) =>
      String(u).includes('thumbnails/set') && ++sets === 2 ? new Response('{}', { status: 500 }) : f(u, i)) as typeof fetch)
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('ficou no ar'), expect.objectContaining({ level: 'error' }))
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(fanOut.mock.calls[0]![0]).toMatchObject({ siteId: SITE, type: 'youtube.ab_start_partial' })
  })
  it('prazo antes da escrita: o relógio andou 45 s nas leituras -> rascunho, zero escritas, zero ciclos', async () => {
    const { banco, yt, iniciar } = await montar({
      testType: 'combo', primeiraB: true,
      ytOpcoes: { avancaPorChamada: 15_000, relogio: { avancar } },
    })
    const r = await iniciar()
    expect(r).toEqual({ ok: false, error: expect.stringContaining('demorou demais') })
    expect(banco.teste()).toMatchObject({ status: 'draft', started_at: null })
    expect(yt.escritas()).toEqual([])
    expect(yt.chamadas).not.toContain('blob') // a checagem do início poupa a leitura do Blob
    expect(banco.ciclos()).toHaveLength(0)
  })
  it('prazo entre as duas escritas do combo: a thumbnail entrou, o relógio estoura, o título não é escrito e nem a volta é tentada (sem tempo): Sentry + aviso', async () => {
    const { banco, yt, iniciar } = await montar({ testType: 'combo', primeiraB: true })
    yt.depoisDeEscrever((c) => { if (c === 'thumbnails.set') avancar(40_000) })
    const r = await iniciar()
    expect(r.ok).toBe(false)
    expect(yt.escritas()).toEqual(['thumbnails.set'])
    expect(banco.teste().status).toBe('draft')
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('ficou no ar'), expect.objectContaining({ level: 'error' }))
    expect(fanOut).toHaveBeenCalledTimes(1)
  })
  it('desvio 10: 1ª variante (B) sem texto de título num teste de título -> recusa antes de reivindicar, zero escritas', async () => {
    const { banco, yt, iniciar } = await montar({ testType: 'title', primeiraB: true, ajustar: (v) => { v[1]!.title_text = '  ' } })
    const r = await iniciar()
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('sem texto de título') })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
    expect(yt.chamadas).toEqual([])
  })
  it('desvio 10: variante com blob_url que não é cópia no Blob (i.ytimg) -> recusa, nada reivindicado', async () => {
    const { banco, iniciar } = await montar({ primeiraB: true, ajustar: (v) => { v[1]!.blob_url = 'https://i.ytimg.com/vi/x/hqdefault.jpg' } })
    const r = await iniciar()
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('sem a imagem da thumbnail') })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
  })
})
