// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(),
  archiveThumb: vi.fn(),
}))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))

import { passoMetadados } from '@/lib/youtube/coleta/meta-step'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import { probeThumb, archiveThumb } from '@/lib/youtube/thumb-fingerprint'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

// Cron às 12:00 UTC de 07/10/2026 → o dia fechado do Pacífico é 06/10/2026 (07:00Z de 06/10 a 07:00Z de 07/10).
const AGORA = new Date('2026-10-07T12:00:00.000Z')
const DIA = '2026-10-06'
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
const BYTES = Buffer.from('imagem')

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const video = (n: number, extra: Row = {}): Row => ({
  id: `v-${n}`, youtube_video_id: `yt-${n}`, channel_id: 'ch-1', site_id: 'site-1',
  title: `Título ${n}`, description: `Descrição ${n}`, tags: ['a', 'b'], duration_seconds: 600,
  published_at: '2026-09-01T00:00:00.000Z', ...extra,
})
const anterior = (n: number, extra: Row = {}): Row => ({
  youtube_video_id: `yt-${n}`, day_pt: '2026-10-05', channel_id: 'ch-1', site_id: 'site-1',
  description_sha256: sha(`Descrição ${n}`), tags_sha256: sha(JSON.stringify(['a', 'b'])),
  thumbnail_dhash: 'ffffffffffffffff', thumbnail_blob_url: 'https://blob.test/antiga.jpg', ...extra,
})
const probe = (dhash: string | null, bytes: Buffer | null = BYTES) => ({ etag: null, lastModified: null, dhash, bytes, url: 'u' })
const ctxDe = (db: FakeDb, prazoMs = 30_000): StepCtx => ({
  supabase: db.client, channels: [canal], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const linha = (db: FakeDb, yt: string, dia = DIA) => db.tables.yt_own_video_meta_daily?.find(r => r.youtube_video_id === yt && r.day_pt === dia)
/** Chave omitida do upsert = nula no primeiro dia (o banco põe NULL); presente = tem de ser nula mesmo. */
const nula = (l: Row | undefined, ...chaves: string[]) => chaves.forEach(k => expect(l?.[k] ?? null, k).toBeNull())
const tentativa = (db: FakeDb, yt: string, kind: string) => db.tables.yt_own_collection_attempts?.find(r => r.scope_id === yt && r.kind === kind)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(probeThumb).mockResolvedValue(probe('ffffffffffffffff'))
  vi.mocked(archiveThumb).mockResolvedValue('https://blob.test/nova.jpg')
})
afterEach(() => {
  vi.useRealTimers()
})

describe('passoMetadados: a linha do dia', () => {
  it('grava uma linha por vídeo no dia fechado, sem token, com is_short e privacy_status nulos', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo).toMatchObject({ gravados: 2, pendentes: 0, day_pt: DIA, dias_sem_meta: { 'ch-1': 0 } })
    expect(resumo.tentativas).toEqual({ ok: 4 })
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(linha(db, 'yt-1')).toMatchObject({
      site_id: 'site-1', video_id: 'v-1', channel_id: 'ch-1', day_pt: DIA,
      title: 'Título 1', title_at_capture: 'Título 1', duration_seconds: 600,
      is_short: null, privacy_status: null,
      description_sha256: sha('Descrição 1'), description_text: 'Descrição 1',
      tags_sha256: sha(JSON.stringify(['a', 'b'])), tags: ['a', 'b'],
      thumbnail_dhash: 'ffffffffffffffff', thumbnail_sha256_at_capture: sha(BYTES), thumbnail_sha256: sha(BYTES),
      thumbnail_blob_url: 'https://blob.test/nova.jpg',
      ab_test_id: null, ab_variant_id: null, seconds_on_air_analytics: null, seconds_other_reporting: null,
      captured_at: AGORA.toISOString(),
    })
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'ok', scope_type: 'video', channel_id: 'ch-1' })
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'ok' })
    expect(ctx.falhas).toEqual([])
  })

  it('canal com sync desligado também é coberto; vídeo publicado depois do fim do dia fica de fora', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2, { published_at: '2026-10-07T08:00:00.000Z' })] })
    const ctx = { ...ctxDe(db), channels: [{ ...canal, sync_enabled: false }] }
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(linha(db, 'yt-2')).toBeUndefined()
    expect(ctx.falhas).toEqual([])
  })

  it('o probe recebe um fetch próprio (o do prazo do passo), nunca o estado anterior', async () => {
    const rede = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', rede) // fetchComPrazo captura o fetch global ao ser criado
    try {
      const db = fakeSupabase({ youtube_videos: [video(1)] })
      const ctx = ctxDe(db)
      await passoMetadados(ctx)
      const [id, prev, f] = vi.mocked(probeThumb).mock.calls[0]!
      expect(id).toBe('yt-1')
      expect(prev).toBeNull()
      expect(typeof f).toBe('function')
      // É o fetch do prazo: repassa a rede com um AbortSignal e, sem tempo, lança SemTempoError sem tocar nela.
      await f!('https://img.test/x.jpg')
      expect(rede).toHaveBeenCalledTimes(1)
      expect(rede.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal)
      vi.setSystemTime(ctx.deadline + 1)
      await expect(f!('https://img.test/y.jpg')).rejects.toBeInstanceOf(SemTempoError)
      expect(rede).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('passoMetadados: thumbnail', () => {
  it('probeThumb devolve dhash nulo sem lançar: linha gravada com campos de thumbnail nulos, URL repetida e tentativa erro_http', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(linha(db, 'yt-1')).toMatchObject({ thumbnail_blob_url: 'https://blob.test/antiga.jpg', title: 'Título 1' })
    nula(linha(db, 'yt-1'), 'thumbnail_dhash', 'thumbnail_sha256_at_capture', 'thumbnail_sha256')
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'erro_http', http_status: null })
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'ok' })
    expect(archiveThumb).not.toHaveBeenCalled()
  })

  it('probeThumb lança (timeout): mesma coisa, sem derrubar o passo', async () => {
    vi.mocked(probeThumb).mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const resumo = await passoMetadados(ctxDe(db))
    expect(resumo.gravados).toBe(2)
    nula(linha(db, 'yt-1'), 'thumbnail_dhash', 'thumbnail_sha256')
    expect(linha(db, 'yt-1')!.thumbnail_blob_url).toBeUndefined()
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'erro_http', error: 'request timed out' })
  })

  it('archiveThumb devolve nulo: campos de thumbnail nulos e tentativa erro_http (amanhã tenta arquivar de novo)', async () => {
    vi.mocked(archiveThumb).mockResolvedValue(null)
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    await passoMetadados(ctxDe(db))
    nula(linha(db, 'yt-1'), 'thumbnail_dhash', 'thumbnail_sha256_at_capture')
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'erro_http' })
  })

  it('imagem igual à última (distância ≤ 6): não arquiva e repete a URL', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe('fffffffffffffffe'))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    expect(archiveThumb).not.toHaveBeenCalled()
    expect(linha(db, 'yt-1')).toMatchObject({ thumbnail_dhash: 'fffffffffffffffe', thumbnail_blob_url: 'https://blob.test/antiga.jpg' })
  })

  it('imagem diferente (distância > 6): arquiva e grava a URL nova', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe('0000000000000000'))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    expect(archiveThumb).toHaveBeenCalledTimes(1)
    expect(vi.mocked(archiveThumb).mock.calls[0]![0]).toBe('v-1')
    expect(linha(db, 'yt-1')).toMatchObject({ thumbnail_blob_url: 'https://blob.test/nova.jpg' })
  })

  it('a linha anterior falhou a thumbnail (dhash nulo): hoje arquiva de novo', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1, { thumbnail_dhash: null })] })
    await passoMetadados(ctxDe(db))
    expect(archiveThumb).toHaveBeenCalledTimes(1)
  })
})

describe('passoMetadados: descrição e tags', () => {
  it('descrição e tags que não mudaram: os hashes são gravados, o texto fica de fora', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    const l = linha(db, 'yt-1')!
    expect(l.description_sha256).toBe(sha('Descrição 1'))
    expect(l.description_text).toBeUndefined()
    expect(l.tags).toBeUndefined()
  })

  it('descrição que mudou: o texto novo é gravado', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1, { description: 'Nova' })], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ description_text: 'Nova', description_sha256: sha('Nova') })
  })

  it('segunda execução no mesmo dia mantém o description_text e a URL já gravados', async () => {
    const jaGravada = { ...anterior(1), day_pt: DIA, description_text: 'texto de hoje cedo', tags: ['x'], thumbnail_blob_url: 'https://blob.test/hoje.jpg' }
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1, { thumbnail_blob_url: null }), jaGravada] })
    await passoMetadados(ctxDe(db))
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(2)
    expect(linha(db, 'yt-1')).toMatchObject({ description_text: 'texto de hoje cedo', tags: ['x'], thumbnail_blob_url: 'https://blob.test/hoje.jpg' })
  })

  it('"último gravado" é a linha de maior day_pt estritamente menor que o dia', async () => {
    const db = fakeSupabase({
      youtube_videos: [video(1)],
      yt_own_video_meta_daily: [
        anterior(1, { day_pt: '2026-10-01', description_sha256: 'velho' }),
        anterior(1, { day_pt: '2026-10-05' }),
      ],
    })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')!.description_text).toBeUndefined()
  })
})

describe('passoMetadados: teste A/B', () => {
  const testeAtivo = { id: 't1', youtube_video_id: 'v-1', status: 'active', paused_at: null, completed_at: null, original_title: 'Original' }
  const cicloAberto = { id: 'c1', test_id: 't1', variant_id: 'var-a', started_at: '2026-09-20T00:00:00.000Z', ended_at: null, applied_metadata: null }

  it('teste só de thumbnail no ar o dia inteiro: variante gravada, title é o original, thumbnail copia a captura', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)], ab_tests: [testeAtivo], ab_test_cycles: [cicloAberto] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({
      ab_test_id: 't1', ab_variant_id: 'var-a', title: 'Original', title_at_capture: 'Título 1',
      seconds_on_air_analytics: 86_400, seconds_other_analytics: 0,
      seconds_on_air_reporting: 86_400, seconds_other_reporting: 0,
      thumbnail_sha256: sha(BYTES),
    })
    expect(linha(db, 'yt-2')).toMatchObject({ ab_test_id: null, title: 'Título 2' })
  })

  it('pausa e retomada no mesmo dia: ab_test_id fica, variante, título e thumbnail do dia ficam nulos', async () => {
    const retomado = { ...cicloAberto, id: 'c2', variant_id: 'var-b', started_at: '2026-10-06T15:00:00.000Z' }
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: [cicloAberto, retomado] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({
      ab_test_id: 't1', ab_variant_id: null, title: null, thumbnail_sha256: null,
      title_at_capture: 'Título 1', thumbnail_sha256_at_capture: sha(BYTES),
    })
  })

  it('ab_tests ilegível: falha crítica, e a linha sai com a captura e o "valeu para o dia" nulo', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    db.errors.ab_tests = { code: '57014', message: 'statement timeout' }
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(ctx.falhas).toContain('erro de banco ao ler ab_tests')
    expect(linha(db, 'yt-1')).toMatchObject({ title_at_capture: 'Título 1', thumbnail_sha256_at_capture: sha(BYTES) })
    nula(linha(db, 'yt-1'), 'title', 'thumbnail_sha256', 'ab_test_id', 'ab_variant_id', 'seconds_on_air_analytics')
  })
})

describe('passoMetadados: critérios e orçamento', () => {
  it('dias_sem_meta no primeiro dia é 0 e não entra em falhas', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.dias_sem_meta).toEqual({ 'ch-1': 0 })
    expect(ctx.falhas).toEqual([])
  })

  it('última linha do canal em 03/10 e hoje gravando 06/10: dias_sem_meta = 2, uma falha', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1, { day_pt: '2026-10-03' })] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.dias_sem_meta).toEqual({ 'ch-1': 2 })
    expect(ctx.falhas).toEqual(['metadados: Canal Um ficou 2 dia(s) sem linha antes de 2026-10-06'])
  })

  it('escrita recusada: falha de banco e o critério "menos linhas que vídeos"', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    db.writeErrors.yt_own_video_meta_daily = { code: '23514', message: 'check violation' }
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(0)
    expect(ctx.falhas).toEqual([
      'erro de banco ao gravar yt_own_video_meta_daily',
      'metadados: Canal Um tem 0 de 2 vídeos com linha em 2026-10-06',
    ])
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'erro_http', error: 'erro de banco' })
  })

  it('tabela ausente em produção (42P01): schema_ausente em falhas, tentativa por canal, sem lançar', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    db.errors.yt_own_video_meta_daily = { code: '42P01', message: 'relation "yt_own_video_meta_daily" does not exist' }
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(0)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_video_meta_daily'])
    expect(db.tables.yt_own_collection_attempts).toEqual([expect.objectContaining({ scope_type: 'canal', scope_id: 'ch-1', kind: 'meta', outcome: 'schema_ausente' })])
    expect(probeThumb).not.toHaveBeenCalled()
  })

  it('thumbnail falhando em metade ou mais dos vídeos pelo segundo dia: falha crítica', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const ontemUtc = (yt: string): Row => ({ scope_type: 'video', scope_id: yt, kind: 'thumbnail', attempt_day: '2026-10-06', channel_id: 'ch-1', site_id: 'site-1', outcome: 'erro_http', attempts: 1 })
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)], yt_own_collection_attempts: [ontemUtc('yt-1'), ontemUtc('yt-2')] })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas).toEqual(['metadados: thumbnail falhou em metade ou mais dos vídeos de Canal Um por 2 dias'])
  })

  it('thumbnail falhando só hoje: ainda não é falha crítica', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('passo que recebe 0 s: nao_alcancado_orcamento por canal e por vídeo, pendentes = vídeos, nenhuma linha', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const ctx = ctxDe(db, -1)
    const resumo = await passoMetadados(ctx)
    expect(resumo).toMatchObject({ gravados: 0, pendentes: 2 })
    expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 3 })
    expect(db.tables.yt_own_video_meta_daily ?? []).toEqual([])
    expect(db.tables.yt_own_collection_attempts!.map(r => `${r.scope_type}:${r.scope_id}`).sort()).toEqual(['canal:ch-1', 'video:yt-1', 'video:yt-2'])
    expect(probeThumb).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual([])
  })

  it('quem nunca foi coletado vem primeiro', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2), video(3)], yt_own_video_meta_daily: [anterior(1), anterior(3, { day_pt: '2026-10-02' })] })
    await passoMetadados({ ...ctxDe(db), channels: [canal] })
    const ordem = vi.mocked(probeThumb).mock.calls.map(c => c[0])
    expect(ordem.indexOf('yt-2')).toBeLessThan(ordem.indexOf('yt-3'))
    expect(ordem.indexOf('yt-3')).toBeLessThan(ordem.indexOf('yt-1'))
  })

  it('canal sem vídeos fica fora dos critérios por vídeo', async () => {
    const db = fakeSupabase({ youtube_videos: [] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(0)
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoMetadados: A/B, ciclos que chegam à função', () => {
  const testeAtivo = { id: 't1', youtube_video_id: 'v-1', status: 'active', paused_at: null, completed_at: null, original_title: 'Original' }
  const cicloAberto = { id: 'c1', test_id: 't1', variant_id: 'var-a', started_at: '2026-09-20T00:00:00.000Z', ended_at: null, applied_metadata: null }

  it('ciclo aberto que começou DEPOIS do dia chega à função: ciclo aberto duplicado anula a variante', async () => {
    const depois = { ...cicloAberto, id: 'c2', variant_id: 'var-b', started_at: '2026-10-07T09:00:00.000Z' }
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: [cicloAberto, depois] })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(linha(db, 'yt-1')).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, title: null, thumbnail_sha256: null })
    expect(ctx.falhas).toEqual([])
  })

  it('ciclo que terminou depois do começo do dia entra; o que terminou antes fica de fora', async () => {
    const antigo = { ...cicloAberto, id: 'c0', variant_id: 'var-x', started_at: '2026-09-01T00:00:00.000Z', ended_at: '2026-09-02T00:00:00.000Z' }
    const fechadoNoDia = { ...cicloAberto, id: 'c3', variant_id: 'var-b', started_at: '2026-10-06T07:00:00.000Z', ended_at: '2026-10-06T19:00:00.000Z' }
    const aberto = { ...cicloAberto, id: 'c4', variant_id: 'var-a', started_at: '2026-10-06T19:00:00.000Z' }
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: [antigo, fechadoNoDia, aberto] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ ab_test_id: 't1', seconds_on_air_analytics: 43_200, seconds_other_analytics: 43_200 })
  })

  it('ab_test_cycles ilegível: falha crítica e linha com o "valeu para o dia" nulo', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo] })
    db.errors.ab_test_cycles = { code: '57014', message: 'statement timeout' }
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(ctx.falhas).toContain('erro de banco ao ler ab_test_cycles')
    expect(linha(db, 'yt-1')).toMatchObject({ title_at_capture: 'Título 1' })
    nula(linha(db, 'yt-1'), 'ab_test_id', 'title', 'thumbnail_sha256')
  })
})

describe('passoMetadados: dado que não existe', () => {
  it('descrição nula no vídeo: hash e texto não inventam string vazia', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1, { description: null })] })
    await passoMetadados(ctxDe(db))
    const l = linha(db, 'yt-1')!
    expect(l.description_sha256).toBeNull()
    expect(l.description_text).toBeUndefined()
  })
})

describe('passoMetadados: leituras que alimentam decisão', () => {
  /** Faz falhar só os selects de yt_own_video_meta_daily cuja lista de colunas satisfaz `quando`. */
  function falharLeitura(db: FakeDb, quando: (cols: string, head: boolean) => boolean) {
    const real = db.client.from.bind(db.client)
    db.client.from = ((tabela: string) => {
      const q = real(tabela)
      if (tabela !== 'yt_own_video_meta_daily') return q
      const select = q.select.bind(q)
      q.select = ((cols?: string, o?: { head?: boolean }) => {
        if (!quando(cols ?? '*', !!o?.head)) return select(cols, o as never)
        const cadeia: Record<string, unknown> = {}
        for (const m of ['eq', 'lt', 'order', 'limit', 'maybeSingle']) cadeia[m] = () => cadeia
        cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { code: '57014', message: 'statement timeout' }, count: null }).then(ok)
        return cadeia as never
      }) as typeof q.select
      return q
    }) as typeof db.client.from
  }

  it('leitura da linha anterior falha: o vídeo não é gravado como se fosse o primeiro dia', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    falharLeitura(db, cols => cols.includes('description_sha256'))
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(0)
    expect(linha(db, 'yt-1')).toBeUndefined()
    expect(db.writes.filter(w => w.table === 'yt_own_video_meta_daily')).toEqual([])
    expect(probeThumb).not.toHaveBeenCalled()
    expect(ctx.falhas).toContain('erro de banco ao ler yt_own_video_meta_daily')
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'erro_http' })
  })

  it('contagem de linhas do dia falha: entra em falhas e não vira "0 de N"', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    falharLeitura(db, (_c, head) => head)
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(ctx.falhas).toEqual(['erro de banco ao ler yt_own_video_meta_daily'])
  })

  it('leitura das tentativas de ontem falha: entra em falhas, sem inventar "2 dias"', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    db.errors.yt_own_collection_attempts = { code: '57014', message: 'statement timeout' }
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas).toContain('erro de banco ao ler yt_own_collection_attempts')
    expect(ctx.falhas.some(f => f.includes('por 2 dias'))).toBe(false)
  })
})

describe('passoMetadados: o prazo acaba no meio de um item', () => {
  it('SemTempoError na thumbnail do vídeo 2 de 3: 1 gravado; 2 e 3 nao_alcancado_orcamento, nenhum erro_http', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2), video(3)] })
    const ctx = ctxDe(db)
    vi.mocked(probeThumb).mockImplementation(async (id) => {
      if (id === 'yt-1') return probe('ffffffffffffffff')
      await vi.waitFor(() => expect(linha(db, 'yt-1')).toBeDefined())
      vi.setSystemTime(ctx.deadline + 1)
      throw new SemTempoError()
    })
    const resumo = await passoMetadados(ctx)
    expect(resumo).toMatchObject({ gravados: 1, pendentes: 2 })
    expect(linha(db, 'yt-1')).toBeDefined()
    expect(linha(db, 'yt-2')).toBeUndefined()
    expect(linha(db, 'yt-3')).toBeUndefined()
    expect(tentativa(db, 'yt-2', 'meta')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(tentativa(db, 'yt-3', 'meta')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(db.tables.yt_own_collection_attempts!.some(r => r.outcome === 'erro_http')).toBe(false)
    expect(tentativa(db, 'yt-2', 'thumbnail')).toBeUndefined()
    expect(ctx.falhas).toEqual([])
  })

  it('o prazo vence durante o arquivamento: nao_alcancado_orcamento, não erro_http', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe('0000000000000000'))
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    const ctx = ctxDe(db)
    vi.mocked(archiveThumb).mockImplementation(async () => { vi.setSystemTime(ctx.deadline + 1); return 'https://blob.test/tarde.jpg' })
    const resumo = await passoMetadados(ctx)
    expect(resumo).toMatchObject({ gravados: 0, pendentes: 1 })
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(db.tables.yt_own_collection_attempts!.some(r => r.outcome === 'erro_http')).toBe(false)
  })
})

describe('passoMetadados: segunda execução no mesmo dia não apaga a primeira', () => {
  const testeAtivo = { id: 't1', youtube_video_id: 'v-1', status: 'active', paused_at: null, completed_at: null, original_title: 'Original' }
  const cicloAberto = { id: 'c1', test_id: 't1', variant_id: 'var-a', started_at: '2026-09-20T00:00:00.000Z', ended_at: null, applied_metadata: null }

  it('2ª execução com a thumbnail falhando não apaga a da 1ª', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: [cicloAberto] })
    await passoMetadados(ctxDe(db))
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    await passoMetadados(ctxDe(db))
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(1)
    expect(linha(db, 'yt-1')).toMatchObject({
      thumbnail_dhash: 'ffffffffffffffff', thumbnail_sha256_at_capture: sha(BYTES), thumbnail_sha256: sha(BYTES),
      thumbnail_blob_url: 'https://blob.test/nova.jpg',
    })
  })

  it('2ª execução com a leitura de A/B falhando não apaga a da 1ª', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: [cicloAberto] })
    await passoMetadados(ctxDe(db))
    db.errors.ab_tests = { code: '57014', message: 'statement timeout' }
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas).toContain('erro de banco ao ler ab_tests')
    expect(linha(db, 'yt-1')).toMatchObject({
      title: 'Original', ab_test_id: 't1', ab_variant_id: 'var-a',
      seconds_on_air_analytics: 86_400, seconds_other_analytics: 0, seconds_on_air_reporting: 86_400, seconds_other_reporting: 0,
      thumbnail_sha256: sha(BYTES),
    })
  })
})

describe('passoMetadados: rodada de correção 1', () => {
  const testeAtivo = { id: 't1', youtube_video_id: 'v-1', status: 'active', paused_at: null, completed_at: null, original_title: 'Original' }
  const cicloAberto = { id: 'c1', test_id: 't1', variant_id: 'var-a', started_at: '2026-09-20T00:00:00.000Z', ended_at: null, applied_metadata: null }

  it('leitura da última linha do canal falha: a chave do canal some de dias_sem_meta (ausente = desconhecido)', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    const real = db.client.from.bind(db.client)
    db.client.from = ((t: string) => {
      const q = real(t)
      if (t !== 'yt_own_video_meta_daily') return q
      const select = q.select.bind(q)
      q.select = ((cols?: string, o?: never) => {
        if (cols !== 'day_pt') return select(cols, o)
        const c: Record<string, unknown> = {}
        for (const m of ['eq', 'lt', 'order', 'limit', 'maybeSingle']) c[m] = () => c
        c.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { code: '57014', message: 'x' }, count: null }).then(ok)
        return c as never
      }) as typeof q.select
      return q
    }) as typeof db.client.from
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect('ch-1' in resumo.dias_sem_meta).toBe(false)
    expect(ctx.falhas).toContain('erro de banco ao ler yt_own_video_meta_daily')
  })

  it('upsert que lança: tentativa meta erro_http registrada, falha e passo segue', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const real = db.client.from.bind(db.client)
    db.client.from = ((t: string) => {
      const q = real(t)
      if (t === 'yt_own_video_meta_daily') {
        const up = q.upsert.bind(q)
        q.upsert = ((p: never, o?: never) => {
          if ((p as Row).youtube_video_id === 'yt-1') throw new Error('boom')
          return up(p, o)
        }) as typeof q.upsert
      }
      return q
    }) as typeof db.client.from
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'erro_http', http_status: null })
    expect(tentativa(db, 'yt-1', 'meta')!.error).toEqual(expect.any(String))
    expect(tentativa(db, 'yt-2', 'meta')).toMatchObject({ outcome: 'ok' })
    expect(ctx.falhas.some(f => f.startsWith('metadados: Canal Um:'))).toBe(true)
  })

  it('o início da leitura de ciclos é min(Analytics, Reporting): ciclo que termina entre 07:00Z e 08:00Z conta em _analytics', async () => {
    const velho = { ...cicloAberto, id: 'c0', variant_id: 'var-x', started_at: '2026-10-05T00:00:00.000Z', ended_at: '2026-10-06T07:30:00.000Z' }
    const atual = { ...cicloAberto, id: 'c1', variant_id: 'var-a', started_at: '2026-10-06T07:30:00.000Z' }
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: [velho, atual] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ ab_test_id: 't1', seconds_on_air_analytics: 84_600, seconds_other_analytics: 1_800 })
  })

  it('ab_tests truncado em 1000 linhas: aviso e linha com A/B ilegível, sem variante calculada de dado parcial', async () => {
    const muitos = Array.from({ length: 1000 }, (_, i) => ({ ...testeAtivo, id: `tt${i}`, youtube_video_id: 'v-1' }))
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: muitos, ab_test_cycles: [{ ...cicloAberto, test_id: 'tt0' }] })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas.some(f => f.includes('testes de A/B') && f.includes('truncada'))).toBe(true)
    nula(linha(db, 'yt-1'), 'ab_test_id', 'ab_variant_id', 'title')
  })

  it('ciclos truncados em 1000 linhas: aviso e linha com A/B ilegível', async () => {
    const ciclos = Array.from({ length: 1000 }, (_, i) => ({ ...cicloAberto, id: `cc${i}` }))
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: ciclos })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas.some(f => f.includes('ciclos de A/B') && f.includes('truncada'))).toBe(true)
    nula(linha(db, 'yt-1'), 'ab_test_id', 'ab_variant_id', 'title')
  })

  it('archiveThumb lança: erro_http da thumbnail, campos de thumbnail fora, URL repetida e a linha é gravada', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe('0000000000000000'))
    vi.mocked(archiveThumb).mockRejectedValue(new Error('blob caiu'))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    const resumo = await passoMetadados(ctxDe(db))
    expect(resumo.gravados).toBe(1)
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'erro_http' })
    nula(linha(db, 'yt-1'), 'thumbnail_dhash', 'thumbnail_sha256_at_capture')
    expect(linha(db, 'yt-1')!.thumbnail_blob_url).toBe('https://blob.test/antiga.jpg')
  })
})
