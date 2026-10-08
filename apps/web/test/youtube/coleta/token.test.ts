// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { TokenRevokedError, NoActiveConnectionError } from '@/lib/social/token-refresh'
import { ReportingHttpError, REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'
import { descreverErro, HABILITADOS, registrarSemConexao, statusHttp } from '@/lib/youtube/coleta/token'
import { fakeSupabase } from './fake-supabase'

const base = { site_id: 'site-1', scope_type: 'canal' as const, scope_id: 'ch-1', kind: 'sondagem' as const, channel_id: 'ch-1' }
const ctxDe = () => {
  const db = fakeSupabase()
  return { db, ctx: { supabase: db.client, falhas: [] as string[], tentativas: [] } }
}

describe('token.ts', () => {
  it('statusHttp: status do ReportingHttpError, nulo para o resto', () => {
    expect(statusHttp(new ReportingHttpError(503, null))).toBe(503)
    expect(statusHttp(new Error('x'))).toBeNull()
    expect(statusHttp(null)).toBeNull()
  })

  it('descreverErro: status e reason, nunca o corpo', () => {
    expect(descreverErro(new ReportingHttpError(403, 'accessNotConfigured'))).toBe('HTTP 403 accessNotConfigured')
    expect(descreverErro(new ReportingHttpError(500, null))).toBe('HTTP 500')
    expect(descreverErro(new Error('relation "segredo" does not exist'))).toBe('database error')
  })

  it('HABILITADOS espelha REPORT_TYPES_ENABLED', () => {
    expect([...HABILITADOS]).toEqual([...REPORT_TYPES_ENABLED])
  })

  it.each([
    ['TokenRevokedError', new TokenRevokedError('youtube', 'c1')],
    ['NoActiveConnectionError', new NoActiveConnectionError('youtube', 's1')],
  ])('registrarSemConexao: %s grava sem_conexao e devolve true', async (_n, erro) => {
    const { db, ctx } = ctxDe()
    expect(await registrarSemConexao(ctx, base, erro)).toBe(true)
    expect(db.tables.yt_own_collection_attempts).toHaveLength(1)
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'sem_conexao', scope_id: 'ch-1' })
    expect(ctx.falhas).toEqual([])
  })

  it('registrarSemConexao: outro erro devolve false e não grava nada', async () => {
    const { db, ctx } = ctxDe()
    expect(await registrarSemConexao(ctx, base, new Error('boom'))).toBe(false)
    expect(db.tables.yt_own_collection_attempts ?? []).toEqual([])
  })
})
