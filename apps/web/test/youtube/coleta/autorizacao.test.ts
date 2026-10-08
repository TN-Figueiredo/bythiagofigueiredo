// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import { classificarErroDeToken, marcarAutorizado, marcarReautorizar, obterToken, voltarAOk } from '@/lib/youtube/coleta/autorizacao'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import { avisarEntrada, avisarSaida } from '@/lib/youtube/coleta/alerts'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const canal = (extra: Partial<ColetaChannel> = {}): ColetaChannel => ({
  id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true,
  collection_status: 'ok', video_count: 1, ...extra,
})
const linhaCanal = (extra: Row = {}): Row => ({ id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', collection_status: 'ok', authorization_verified_at: null, ...extra })
const conexao = (extra: Row = {}): Row => ({ id: 'c1', site_id: 'site-1', provider: 'youtube', account_id: 'UC1', revoked_at: null, ...extra })
const ctxDe = (db: FakeDb, prazoMs = 30_000): StepCtx => ({ supabase: db.client, channels: [], deadline: Date.now() + prazoMs, falhas: [], tentativas: [] })
/** Com os dois conjuntos da execução (quem passou numa chamada autenticada e quem foi negado). */
const ctxComConjuntos = (db: FakeDb) => ({ ...ctxDe(db), autorizados: new Set<string>(), negados: new Set<string>() })
const base = { site_id: 'site-1', scope_type: 'canal' as const, scope_id: 'ch-1', kind: 'sondagem' as const, channel_id: 'ch-1' }
const semConexao = () => new NoActiveConnectionError('youtube', 'site-1')

beforeEach(() => { vi.clearAllMocks() })

describe('classificarErroDeToken', () => {
  it('token revogado → reautorizar, sem ler o banco', async () => {
    const db = fakeSupabase()
    expect(await classificarErroDeToken(ctxDe(db), canal(), new TokenRevokedError('youtube', 'c1'))).toBe('reautorizar')
  })

  it('sem conexão, com conexão revogada deste canal → reautorizar', async () => {
    const db = fakeSupabase({ social_connections: [conexao({ revoked_at: '2026-10-01T00:00:00.000Z' })] })
    expect(await classificarErroDeToken(ctxDe(db), canal(), semConexao())).toBe('reautorizar')
  })

  it('sem conexão e nenhuma conexão revogada → sem_conexao', async () => {
    const db = fakeSupabase({ social_connections: [] })
    expect(await classificarErroDeToken(ctxDe(db), canal(), semConexao())).toBe('sem_conexao')
  })

  it('conexão revogada de OUTRO canal, de outro site ou de outro provedor não conta', async () => {
    const db = fakeSupabase({ social_connections: [
      conexao({ account_id: 'UC2', revoked_at: '2026-10-01T00:00:00.000Z' }),
      conexao({ site_id: 'site-2', revoked_at: '2026-10-01T00:00:00.000Z' }),
      conexao({ provider: 'instagram', revoked_at: '2026-10-01T00:00:00.000Z' }),
    ] })
    expect(await classificarErroDeToken(ctxDe(db), canal(), semConexao())).toBe('sem_conexao')
  })

  it('leitura das conexões falha → outro, e a falha de banco fica visível (não vira "sem conexão")', async () => {
    const db = fakeSupabase()
    db.errors.social_connections = { code: '57014', message: 'timeout' }
    const ctx = ctxDe(db)
    expect(await classificarErroDeToken(ctx, canal(), semConexao())).toBe('outro')
    expect(ctx.falhas).toEqual(['erro de banco ao ler social_connections'])
  })

  it('canal JÁ em reautorizar e sem conexão nenhuma (apagada): continua reautorizar, sem ler as conexões', async () => {
    const db = fakeSupabase({ social_connections: [] })
    // Se lesse, a leitura falharia e a resposta seria 'outro'.
    db.errors.social_connections = { code: '57014', message: 'timeout' }
    const ctx = ctxDe(db)
    expect(await classificarErroDeToken(ctx, canal({ collection_status: 'reautorizar' }), semConexao())).toBe('reautorizar')
    expect(ctx.falhas).toEqual([])
  })

  it('erro qualquer → outro', async () => {
    expect(await classificarErroDeToken(ctxDe(fakeSupabase()), canal(), new Error('rede'))).toBe('outro')
  })
})

describe('marcarReautorizar / marcarAutorizado', () => {
  it('marcarReautorizar grava o estado, muda a memória e avisa', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const c = canal()
    await marcarReautorizar(ctxDe(db), c)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(c.collection_status).toBe('reautorizar')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), c, 'reautorizar')
  })

  it('canal cuja memória já diz reautorizar: grava mesmo assim (a memória pode estar velha), registra em negados e pede o lembrete', async () => {
    // O banco diz ok (por exemplo: o callback do OAuth acabou de devolver o canal) e a memória ainda diz reautorizar.
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'ok' })] })
    const ctx = ctxComConjuntos(db)
    await marcarReautorizar(ctx, canal({ collection_status: 'reautorizar' }))
    expect(db.writes.filter(w => w.table === 'youtube_channels')).toEqual([{ table: 'youtube_channels', op: 'update', payload: { collection_status: 'reautorizar' } }])
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect([...ctx.negados]).toEqual(['ch-1'])
    expect([...ctx.autorizados]).toEqual([])
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
  })

  it('gravação que falha: não avisa e não muda a memória, mas a negação fica registrada', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    db.writeErrors.youtube_channels = { code: '57014', message: 'timeout' }
    const ctx = ctxComConjuntos(db)
    const c = canal()
    await marcarReautorizar(ctx, c)
    expect(c.collection_status).toBe('ok')
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect([...ctx.negados]).toEqual(['ch-1'])
    expect(ctx.falhas).toEqual(['erro de banco ao gravar youtube_channels'])
  })

  it('sem os conjuntos no contexto (são opcionais): marca e avisa do mesmo jeito', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    await marcarReautorizar(ctxDe(db), canal())
    await marcarAutorizado(ctxDe(db), canal())
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
  })

  it('migration não aplicada (coluna ausente): schema_ausente, sem aviso e memória inalterada', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    db.writeErrors.youtube_channels = { code: 'PGRST204', message: 'coluna' }
    const ctx = ctxDe(db)
    const c = canal()
    await marcarReautorizar(ctx, c)
    expect(ctx.falhas).toEqual(['schema_ausente: youtube_channels'])
    expect(c.collection_status).toBe('ok')
    expect(avisarEntrada).not.toHaveBeenCalled()
  })

  it('marcarAutorizado num canal ok só grava authorization_verified_at', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00.000Z'), toFake: ['Date'] })
    try {
      const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
      await marcarAutorizado(ctxDe(db), canal())
      expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok', authorization_verified_at: '2026-10-08T12:00:00.000Z' })
      expect(avisarSaida).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it('marcarAutorizado num canal em reautorizar SÓ carimba a data: o estado não muda, nenhuma saída, e o sucesso fica registrado', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00.000Z'), toFake: ['Date'] })
    try {
      const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })] })
      const ctx = ctxComConjuntos(db)
      const c = canal({ collection_status: 'reautorizar' })
      await marcarAutorizado(ctx, c)
      expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar', authorization_verified_at: '2026-10-08T12:00:00.000Z' })
      expect(db.writes.filter(w => w.table === 'youtube_channels').map(w => w.payload)).toEqual([{ authorization_verified_at: '2026-10-08T12:00:00.000Z' }])
      expect(c.collection_status).toBe('reautorizar')
      expect(avisarSaida).not.toHaveBeenCalled()
      expect([...ctx.autorizados]).toEqual(['ch-1'])
      expect([...ctx.negados]).toEqual([])
    } finally { vi.useRealTimers() }
  })

  it('voltarAOk: banco e memória em ok, e pede a saída do aviso reautorizar', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })] })
    const c = canal({ collection_status: 'reautorizar' })
    await voltarAOk(ctxDe(db), c)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
    expect(c.collection_status).toBe('ok')
    expect(avisarSaida).toHaveBeenCalledWith(expect.anything(), c, ['reautorizar'])
  })

  it('voltarAOk com a gravação falhando: memória inalterada, nenhuma saída, falha visível, sem lançar', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })] })
    db.writeErrors.youtube_channels = { code: '57014', message: 'timeout' }
    const ctx = ctxDe(db)
    const c = canal({ collection_status: 'reautorizar' })
    await voltarAOk(ctx, c)
    expect(c.collection_status).toBe('reautorizar')
    expect(avisarSaida).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual(['erro de banco ao gravar youtube_channels'])
  })
})

describe('obterToken', () => {
  it('token bom: devolve o token e não grava tentativa', async () => {
    vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' })
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const ctx = ctxDe(db)
    expect(await obterToken(ctx, canal(), base)).toBe('tok')
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UC1')
    expect(db.tables.yt_own_collection_attempts ?? []).toEqual([])
  })

  it('token revogado: reautorizar no banco, tentativa sem_autorizacao, devolve null', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const ctx = ctxDe(db)
    const c = canal()
    expect(await obterToken(ctx, c, base)).toBeNull()
    expect(c.collection_status).toBe('reautorizar')
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'sem_autorizacao', scope_id: 'ch-1', kind: 'sondagem' })
    expect(ctx.falhas).toEqual([])
  })

  it('sem conexão e sem conexão revogada: tentativa sem_conexao, nenhum aviso, estado inalterado', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(semConexao())
    const db = fakeSupabase({ youtube_channels: [linhaCanal()], social_connections: [] })
    const ctx = ctxDe(db)
    const c = canal()
    expect(await obterToken(ctx, c, base)).toBeNull()
    expect(c.collection_status).toBe('ok')
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'sem_conexao' })
    expect(avisarEntrada).not.toHaveBeenCalled()
  })

  it('canal em reautorizar cujo token volta a passar: devolve o token e o canal CONTINUA reautorizar (refresh não prova a autorização)', async () => {
    vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' })
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })] })
    const ctx = ctxComConjuntos(db)
    const c = canal({ collection_status: 'reautorizar' })
    expect(await obterToken(ctx, c, base)).toBe('tok')
    expect(c.collection_status).toBe('reautorizar')
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(db.writes.filter(w => w.table === 'youtube_channels')).toEqual([])
    expect(avisarSaida).not.toHaveBeenCalled()
    // Refresh que passa não conta como chamada autenticada: quem registra o sucesso é quem chamou a API.
    expect([...ctx.autorizados]).toEqual([])
  })

  it('canal em reautorizar e sem conexão (apagada): continua reautorizar, tentativa sem_autorizacao e lembrete pedido', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(semConexao())
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })], social_connections: [] })
    const ctx = ctxComConjuntos(db)
    const c = canal({ collection_status: 'reautorizar' })
    expect(await obterToken(ctx, c, base)).toBeNull()
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
    expect([...ctx.negados]).toEqual(['ch-1'])
  })

  it('erro de rede no refresh: relança (falha do passo), estado inalterado, nenhuma tentativa de pulo', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new Error('Google token refresh failed (500)'))
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const c = canal()
    await expect(obterToken(ctxDe(db), c, base)).rejects.toThrow('Google token refresh failed')
    expect(c.collection_status).toBe('ok')
    expect(db.tables.yt_own_collection_attempts ?? []).toEqual([])
  })

  it('prazo do passo vencido: SemTempoError, sem tocar no estado', async () => {
    vi.mocked(ensureFreshToken).mockReturnValue(new Promise(() => undefined))
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    await expect(obterToken(ctxDe(db, 0), canal(), base)).rejects.toBeInstanceOf(SemTempoError)
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })
})
