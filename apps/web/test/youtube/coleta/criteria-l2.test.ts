// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { criteriosL2 } from '@/lib/youtube/coleta/criteria-l2'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-20T12:10:00.000Z')
const DIA_MS = 86_400_000
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
const diaUtc = (dias: number) => ha(dias).slice(0, 10)

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 5 }
const ctxDe = (db: FakeDb, channels = [canal]) => ({ supabase: db.client, falhas: [] as string[], channels })

/** Tentativa do passo `diario`: `escopo` = 'canal' ou o id de 11 caracteres do vídeo. */
const tent = (dias: number, escopo: string, outcome: string, extra: Row = {}): Row => ({
  scope_type: escopo === 'canal' ? 'canal' : 'video', scope_id: escopo === 'canal' ? 'ch-1' : escopo,
  kind: 'diario', attempt_day: diaUtc(dias), site_id: 'site-1', channel_id: 'ch-1', outcome, attempts: 1, ...extra,
})
const videos = (n: number, publicadoHa = 100): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `v${i}`, channel_id: 'ch-1', youtube_video_id: `vid${String(i).padStart(8, '0')}`, published_at: ha(publicadoHa) }))
const canalOk = (...dias: number[]): Row[] => dias.map(d => tent(d, 'canal', 'ok'))

const NOTA_A = 'diário: Canal Um não tem nenhum vídeo com diário ok nas 3 últimas execuções'
const NOTA_B = 'alcance: Canal Um recebeu relatório com dado nos últimos 4 dias e não tem linha nova de alcance'
const NOTA_C = (n: number) => `alcance: ${n} relatório(s) baixado(s) há mais de 2 dias sem normalizar`
const job = (status: string, criadoHa: number, extra: Row = {}): Row => ({
  channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status, job_create_time: ha(criadoHa), created_at: ha(criadoHa), ...extra,
})
const alcance = (coletadoHa: number): Row => ({ youtube_video_id: 'vid00000000', day_pt: '2026-10-10', channel_id: 'ch-1', collected_at: ha(coletadoHa) })
const relat = (id: string, status: string, baixadoHa: number | null, extra: Row = {}): Row => ({
  report_id: id, channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status,
  downloaded_at: baixadoHa === null ? null : ha(baixadoHa), normalized_at: null, ...extra,
})

beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
afterEach(() => { vi.useRealTimers() })

describe('critério A: diário sem dado', () => {
  const semDado = [...canalOk(1, 2, 3), ...['vid00000000', 'vid00000001'].flatMap(v => [1, 2, 3].map(d => tent(d, v, 'sem_dado_na_janela')))]

  it('3 dias de canal ok e nenhum vídeo ok: nota', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: semDado }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([NOTA_A])
  })

  it('um vídeo ok no dia do meio: sem nota', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: [...semDado, tent(2, 'vid00000003', 'ok')] }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('só 2 dias de canal ok: ainda cedo', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: canalOk(1, 2) }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('canal com 4 vídeos: fora do critério', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: videos(4), yt_own_collection_attempts: semDado }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('vídeo sem published_at não conta para os 5', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: [...videos(4), { id: 'x', channel_id: 'ch-1', published_at: null }], yt_own_collection_attempts: semDado }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('dia com canal sem_autorizacao não conta como execução: vídeo ok só nesse dia => nota', async () => {
    const tentativas = [
      tent(1, 'canal', 'ok'), tent(2, 'canal', 'sem_autorizacao'), tent(3, 'canal', 'ok'), tent(4, 'canal', 'ok'),
      tent(2, 'vid00000000', 'ok'),
    ]
    const ctx = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: tentativas }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([NOTA_A])
  })

  it('vídeo ok só no 4º dia (fora dos 3 considerados) => nota; dentro do 3º => sem nota', async () => {
    const base = [...canalOk(1, 2, 3, 4)]
    const fora = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: [...base, tent(4, 'vid00000000', 'ok')] }))
    await criteriosL2(fora)
    expect(fora.falhas).toEqual([NOTA_A])
    const dentro = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: [...base, tent(3, 'vid00000000', 'ok')] }))
    await criteriosL2(dentro)
    expect(dentro.falhas).toEqual([])
  })

  it('vídeo ok de OUTRO channel_id não cala a nota deste canal', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: [...semDado, tent(2, 'vid00000009', 'ok', { channel_id: 'ch-2' })] }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([NOTA_A])
  })

  it('sync_enabled false: sem nota', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: semDado }), [{ ...canal, sync_enabled: false }])
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('leitura de yt_own_collection_attempts falhando: erro e nota de não avaliado, sem nota do critério', async () => {
    const db = fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: semDado })
    db.errors.yt_own_collection_attempts = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosL2(ctx)
    expect(ctx.falhas).toContain('erro de banco ao ler yt_own_collection_attempts')
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar diário de Canal Um (yt_own_collection_attempts)')
    expect(ctx.falhas).not.toContain(NOTA_A)
  })

  it('leitura de youtube_videos falhando: nota de não avaliado', async () => {
    const db = fakeSupabase({ youtube_videos: videos(5), yt_own_collection_attempts: semDado })
    db.errors.youtube_videos = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosL2(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar diário de Canal Um (youtube_videos)')
    expect(ctx.falhas).not.toContain(NOTA_A)
  })
})

describe('critério B: alcance sem linha nova', () => {
  const base = (extra: Record<string, Row[]> = {}) => ({
    yt_reporting_jobs: [job('ativo', 7)], youtube_videos: videos(1, 30), yt_own_video_reach_daily: [] as Row[],
    yt_reporting_reports: [relat('r1', 'baixado', 1, { normalized_at: ha(1) })], ...extra,
  })

  it('job ativo há 7 dias, vídeo há 30 dias, nenhuma linha: nota', async () => {
    const ctx = ctxDe(fakeSupabase(base()))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([NOTA_B])
  })

  it('linha de 3 dias atrás: sem nota; de 5 dias atrás: nota', async () => {
    const nova = ctxDe(fakeSupabase(base({ yt_own_video_reach_daily: [alcance(3)] })))
    await criteriosL2(nova)
    expect(nova.falhas).toEqual([])
    const velha = ctxDe(fakeSupabase(base({ yt_own_video_reach_daily: [alcance(5)] })))
    await criteriosL2(velha)
    expect(velha.falhas).toEqual([NOTA_B])
  })

  it('job novo (5 dias), sem_acesso ou ausente: sem nota', async () => {
    for (const jobs of [[job('ativo', 5)], [job('sem_acesso', 7)], []]) {
      const ctx = ctxDe(fakeSupabase(base({ yt_reporting_jobs: jobs })))
      await criteriosL2(ctx)
      expect(ctx.falhas).toEqual([])
    }
  })

  it('idade vem de created_at quando job_create_time é nulo', async () => {
    const ctx = ctxDe(fakeSupabase(base({ yt_reporting_jobs: [job('ativo', 7, { job_create_time: null })] })))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([NOTA_B])
  })

  it('última publicação há 200 dias: sem nota', async () => {
    const ctx = ctxDe(fakeSupabase(base({ youtube_videos: videos(1, 200) })))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('leitura de yt_own_video_reach_daily falhando: nota de não avaliado, nunca verde', async () => {
    const db = fakeSupabase(base())
    db.errors.yt_own_video_reach_daily = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosL2(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar alcance de Canal Um (yt_own_video_reach_daily)')
    expect(ctx.falhas).not.toContain(NOTA_B)
  })

  it('sync_enabled false: sem nota', async () => {
    const ctx = ctxDe(fakeSupabase(base()), [{ ...canal, sync_enabled: false }])
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('só relatórios vazio nos últimos 4 dias, nenhuma linha: sem nota (silêncio legítimo)', async () => {
    const ctx = ctxDe(fakeSupabase(base({ yt_reporting_reports: [relat('r1', 'vazio', 1), relat('r2', 'vazio', 2), relat('r3', 'vazio', 3, { normalized_at: ha(3) })] })))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('relatório baixado de 5 dias atrás e nenhum mais recente: sem nota', async () => {
    const ctx = ctxDe(fakeSupabase(base({ yt_reporting_reports: [relat('r1', 'baixado', 5, { normalized_at: ha(4) })] })))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('relatório baixado de outro canal não conta para este', async () => {
    const ctx = ctxDe(fakeSupabase(base({ yt_reporting_reports: [relat('r1', 'baixado', 1, { channel_id: 'ch-2', normalized_at: ha(1) })] })))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('leitura de yt_reporting_reports falhando: nota do critério B (alcance de Canal Um), nunca verde', async () => {
    const db = fakeSupabase(base())
    db.errors.yt_reporting_reports = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosL2(ctx)
    // Nota do B (por canal) e nota do C (relatórios sem normalizar) são distintas: as duas leem a mesma tabela.
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar alcance de Canal Um (yt_reporting_reports)')
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar relatórios sem normalizar (yt_reporting_reports)')
    expect(ctx.falhas).not.toContain(NOTA_B)
  })

  it('job ativo sem job_create_time nem created_at: nota de idade ausente, não sai calado', async () => {
    const ctx = ctxDe(fakeSupabase(base({ yt_reporting_jobs: [job('ativo', 7, { job_create_time: null, created_at: null })] })))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual(['critérios: não foi possível avaliar alcance de Canal Um (yt_reporting_jobs): idade do job ausente'])
  })

  it('contagem ausente (count nulo) vira nota de não avaliado, nunca verde', async () => {
    const db = fakeSupabase({ youtube_videos: videos(5) })
    const real = db.client
    const casca = { ...real, from: (t: string) => {
      const q = real.from(t)
      if (t !== 'youtube_videos') return q
      return { select: () => ({ eq: () => ({ not: () => Promise.resolve({ data: null, error: null, count: null }) }) }) }
    } } as unknown as typeof real
    const ctx = { supabase: casca, falhas: [] as string[], channels: [canal] }
    await criteriosL2(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar diário de Canal Um (youtube_videos): contagem ausente')
  })
})

describe('critério C: baixado e não normalizado', () => {
  it('um baixado e um vazio de 3 dias atrás sem normalizar: nota com 2', async () => {
    const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: [relat('a', 'baixado', 3), relat('b', 'vazio', 3)] }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([NOTA_C(2)])
  })

  it('1 dia atrás, normalizado, outro tipo, em erro ou sem downloaded_at: sem nota', async () => {
    const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: [
      relat('a', 'baixado', 1),
      relat('b', 'baixado', 3, { normalized_at: ha(2) }),
      relat('c', 'baixado', 3, { report_type_id: 'channel_reach_combined_a1' }),
      relat('d', 'erro', 3),
      relat('e', 'baixado', null),
    ] }))
    await criteriosL2(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('leitura falhando: nota de não avaliado', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relat('a', 'baixado', 3)] })
    db.errors.yt_reporting_reports = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosL2(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar relatórios sem normalizar (yt_reporting_reports)')
  })
})

describe('independência entre os critérios', () => {
  it('erro de leitura em um não impede os outros dois', async () => {
    const db = fakeSupabase({
      youtube_videos: videos(5, 30),
      yt_own_collection_attempts: [...canalOk(1, 2, 3), ...[1, 2, 3].map(d => tent(d, 'vid00000000', 'sem_dado_na_janela'))],
      yt_reporting_jobs: [job('ativo', 7)],
      yt_own_video_reach_daily: [],
      yt_reporting_reports: [relat('a', 'baixado', 3)],
    })
    db.errors.yt_own_video_reach_daily = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosL2(ctx)
    expect(ctx.falhas).toContain(NOTA_A)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar alcance de Canal Um (yt_own_video_reach_daily)')
    expect(ctx.falhas).toContain(NOTA_C(1))
  })
})
