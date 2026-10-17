// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { contadoresDoVideo, estadoDoCanal, estadoDoVideo, gravarEstadoProprio, type CapturaDoEstado } from '@/lib/youtube/coleta/estado-proprio'

const item = (over: Record<string, unknown> = {}) => ({
  id: 'v1', etag: 'e1',
  snippet: { title: 'T', description: 'D', tags: ['a'], thumbnails: { high: { url: 'u' } }, localized: { title: 'T' }, categoryId: '19', defaultLanguage: 'pt', channelId: 'UC1' },
  contentDetails: { duration: 'PT5M', definition: 'hd', caption: 'false' },
  status: { privacyStatus: 'public', uploadStatus: 'processed', license: 'youtube', embeddable: true, madeForKids: false, publicStatsViewable: true },
  statistics: { viewCount: '100', likeCount: '5', commentCount: '2' },
  ...over,
})

describe('estadoDoVideo (X1)', () => {
  it('tira o que nunca é público e o que o E18 versiona; mantém categoria, idioma, licença, kids', () => {
    const { estado, ausentes } = estadoDoVideo(item())
    expect(ausentes).toEqual([])
    const raw = estado!.raw as { snippet: Record<string, unknown>; status: Record<string, unknown>; statistics?: unknown; etag?: unknown }
    expect(raw.snippet).toEqual({ categoryId: '19', defaultLanguage: 'pt', channelId: 'UC1' })
    expect(raw.status).toEqual({ privacyStatus: 'public', license: 'youtube', embeddable: true, madeForKids: false, publicStatsViewable: true })
    expect(raw.statistics).toBeUndefined()
    expect(raw.etag).toBeUndefined()
  })
  it('o hash não gira com statistics, título, descrição, tags nem uploadStatus, e gira com a licença', () => {
    const a = estadoDoVideo(item()).estado!.sha
    const b = estadoDoVideo(item({ statistics: { viewCount: '999' }, etag: 'e2' })).estado!.sha
    expect(b).toBe(a)
    const base = item()
    const c = estadoDoVideo({ ...base, snippet: { ...base.snippet, title: 'outro', tags: ['z'] }, status: { ...base.status, uploadStatus: 'uploaded' } }).estado!.sha
    expect(c).toBe(a)
    const d = estadoDoVideo({ ...base, status: { ...base.status, license: 'creativeCommon' } }).estado!.sha
    expect(d).not.toBe(a)
  })
  it.each(['snippet', 'contentDetails', 'status'])('parte %s ausente: estado nulo e a parte nomeada (não grava hash parcial)', (p) => {
    const it = item() as Record<string, unknown>
    delete it[p]
    expect(estadoDoVideo(it)).toEqual({ estado: null, ausentes: [p] })
  })
})

describe('contadoresDoVideo (X5)', () => {
  it('lê os três', () => expect(contadoresDoVideo(item())).toEqual({ views: 100, likes: 5, comments: 2 }))
  it('curtida oculta (campo ausente) é nula, não 0', () => {
    expect(contadoresDoVideo(item({ statistics: { viewCount: '100', commentCount: '0' } }))).toEqual({ views: 100, likes: null, comments: 0 })
  })
  it('parte statistics ausente: nulo', () => {
    const it = item() as Record<string, unknown>
    delete it.statistics
    expect(contadoresDoVideo(it)).toBeNull()
  })
  it('valor que não é inteiro não negativo vira nulo', () => {
    expect(contadoresDoVideo(item({ statistics: { viewCount: 'abc', likeCount: '-1', commentCount: '1.5' } }))).toEqual({ views: null, likes: null, comments: null })
  })
})

describe('estadoDoCanal (X2)', () => {
  const canal = { id: 'UC1', etag: 'e', snippet: { title: 'C' }, status: { privacyStatus: 'public' }, statistics: { viewCount: '9' }, brandingSettings: { channel: { keywords: 'x' } } }
  it('mantém branding e status, tira statistics e etag; topicDetails/localizations ausentes são normais', () => {
    const { estado, ausentes } = estadoDoCanal(canal)
    expect(ausentes).toEqual([])
    expect(estado!.raw).toEqual({ id: 'UC1', snippet: { title: 'C' }, status: { privacyStatus: 'public' }, brandingSettings: { channel: { keywords: 'x' } } })
    expect(estadoDoCanal({ ...canal, statistics: { viewCount: '10' } }).estado!.sha).toBe(estado!.sha)
  })
  it('sem status: nulo e nomeado; sem item: nulo', () => {
    const { status: _s, ...semStatus } = canal
    expect(estadoDoCanal(semStatus)).toEqual({ estado: null, ausentes: ['status'] })
    expect(estadoDoCanal(undefined)).toEqual({ estado: null, ausentes: ['item'] })
  })
})

describe('gravarEstadoProprio', () => {
  const AGORA = Date.parse('2026-10-17T15:00:00Z')
  const dias = (n: number) => new Date(AGORA - n * 86_400_000).toISOString()
  const vid = (id: string, idade: number) => ({ youtube_video_id: id, channel_id: 'c1', site_id: 's1', published_at: dias(idade) })
  const cap = (over: Partial<CapturaDoEstado> = {}): CapturaDoEstado => ({
    privacyStatus: 'public', estado: { sha: 'h', raw: { a: 1 } }, estadoAusentes: [], contadores: { views: 7, likes: 1, comments: 0 }, ...over,
  })
  function db(rpcRes: unknown = { data: 2, error: null }, upRes: unknown = { error: null }) {
    const rpc = vi.fn(async () => rpcRes)
    const upsert = vi.fn(async () => upRes)
    return { rpc, upsert, supabase: { rpc, from: vi.fn(() => ({ upsert })) } as unknown as Parameters<typeof gravarEstadoProprio>[0]['supabase'] }
  }

  it('estado de todos; contador só de vídeo com mais de 14 dias e não privado', async () => {
    const { supabase, rpc, upsert } = db()
    const falhas: string[] = []
    const r = await gravarEstadoProprio({ supabase, falhas }, [vid('novo', 3), vid('velho', 40), vid('priv', 40)],
      new Map([['novo', cap()], ['velho', cap()], ['priv', cap({ privacyStatus: 'private' })]]), AGORA)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect((rpc.mock.calls[0] as unknown[])[0]).toBe('yt_own_video_state_record')
    expect(r).toEqual({ estado_gravado: 2, estado_sem_parte: 0, publicos_gravados: 1, publicos_sem_contador: 0 })
    const linhas = (upsert.mock.calls[0] as unknown[])[0] as Array<Record<string, unknown>>
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ youtube_video_id: 'velho', day_pt: '2026-10-17', view_count: 7, like_count: 1, comment_count: 0 })
    expect((upsert.mock.calls[0] as unknown[])[1]).toEqual({ onConflict: 'youtube_video_id,day_pt', ignoreDuplicates: true })
    expect(falhas).toEqual([])
  })

  it('dia de São Paulo: 02:30 UTC ainda é o dia anterior', async () => {
    const { supabase, upsert } = db()
    await gravarEstadoProprio({ supabase, falhas: [] }, [vid('velho', 40)], new Map([['velho', cap()]]), Date.parse('2026-10-17T02:30:00Z'))
    expect(((upsert.mock.calls[0] as unknown[])[0] as Array<Record<string, unknown>>)[0]).toMatchObject({ day_pt: '2026-10-16' })
  })

  it('parte ausente: não grava estado nem dia, conta e deixa nota (nunca zero, nunca ok calado)', async () => {
    const { supabase, rpc, upsert } = db()
    const falhas: string[] = []
    const r = await gravarEstadoProprio({ supabase, falhas }, [vid('velho', 40)],
      new Map([['velho', cap({ estado: null, estadoAusentes: ['status'], contadores: null })]]), AGORA)
    expect(rpc).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
    expect(r).toMatchObject({ estado_gravado: 0, estado_sem_parte: 1, publicos_gravados: 0, publicos_sem_contador: 1 })
    expect(falhas).toHaveLength(2)
  })

  it('contadores todos nulos não viram linha', async () => {
    const { supabase, upsert } = db()
    const r = await gravarEstadoProprio({ supabase, falhas: [] }, [vid('velho', 40)],
      new Map([['velho', cap({ contadores: { views: null, likes: null, comments: null } })]]), AGORA)
    expect(upsert).not.toHaveBeenCalled()
    expect(r.publicos_sem_contador).toBe(1)
  })

  it('vídeo que não veio na resposta é ignorado (nem estado, nem contador)', async () => {
    const { supabase, rpc, upsert } = db()
    const r = await gravarEstadoProprio({ supabase, falhas: [] }, [vid('some', 40)], new Map(), AGORA)
    expect(rpc).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
    expect(r).toEqual({ estado_gravado: 0, estado_sem_parte: 0, publicos_gravados: 0, publicos_sem_contador: 0 })
  })

  it('erro do banco e schema ausente viram nota, sem contar como gravado, sem lançar', async () => {
    const { supabase } = db({ data: null, error: { code: '42883', message: 'x' } }, { error: { code: 'PGRST205', message: 'y' } })
    const falhas: string[] = []
    const r = await gravarEstadoProprio({ supabase, falhas }, [vid('velho', 40)], new Map([['velho', cap()]]), AGORA)
    expect(r).toMatchObject({ estado_gravado: 0, publicos_gravados: 0 })
    expect(falhas).toEqual(['schema_ausente: yt_own_video_state_raw', 'schema_ausente: yt_own_video_public_daily'])
  })

  it('o cliente lança: nota e resumo zerado', async () => {
    const supabase = { rpc: () => { throw new Error('rede') }, from: () => ({ upsert: () => { throw new Error('rede') } }) } as unknown as Parameters<typeof gravarEstadoProprio>[0]['supabase']
    const falhas: string[] = []
    const r = await gravarEstadoProprio({ supabase, falhas }, [vid('velho', 40)], new Map([['velho', cap()]]), AGORA)
    expect(r.estado_gravado).toBe(0)
    expect(falhas).toContain('erro ao gravar o estado do vídeo próprio')
  })
})
