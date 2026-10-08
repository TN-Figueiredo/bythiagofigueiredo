// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { registrarTentativa, contarPorResultado, scopeJob } from '@/lib/youtube/coleta/attempts'
import type { Tentativa } from '@/lib/youtube/coleta/types'
import { fakeSupabase } from './fake-supabase'

const base: Tentativa = { site_id: 'site-1', scope_type: 'video', scope_id: 'yt-1', kind: 'meta', outcome: 'ok', channel_id: 'ch-1' }

describe('registrarTentativa', () => {
  it('chama yt_own_attempt_record com os oito parâmetros, grava também quando é ok, e soma attempts na reexecução', async () => {
    const db = fakeSupabase()
    const ctx = { supabase: db.client, falhas: [] as string[], tentativas: [] as Tentativa[] }
    await registrarTentativa(ctx, base)
    await registrarTentativa(ctx, { ...base, outcome: 'erro_http', http_status: 503, error: 'YouTube API 503' })
    expect(db.rpcCalls[0]).toEqual({
      name: 'yt_own_attempt_record',
      args: { p_site_id: 'site-1', p_scope_type: 'video', p_scope_id: 'yt-1', p_kind: 'meta', p_outcome: 'ok', p_http_status: null, p_error: null, p_channel_id: 'ch-1' },
    })
    expect(db.tables.yt_own_collection_attempts).toHaveLength(1)
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'erro_http', http_status: 503, attempts: 2 })
    expect(ctx.tentativas).toHaveLength(2)
    expect(ctx.falhas).toEqual([])
  })

  it('função ausente em produção (PGRST202): vira schema_ausente em falhas, uma vez, e não lança', async () => {
    const db = fakeSupabase()
    db.errors['rpc:yt_own_attempt_record'] = { code: 'PGRST202', message: 'Could not find the function' }
    const ctx = { supabase: db.client, falhas: [] as string[], tentativas: [] as Tentativa[] }
    await registrarTentativa(ctx, base)
    await registrarTentativa(ctx, { ...base, scope_id: 'yt-2' })
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_collection_attempts'])
    expect(ctx.tentativas).toHaveLength(2)
  })

  it('cliente que lança (rede) vira falha de banco, sem derrubar o passo', async () => {
    const supabase = { rpc: () => { throw new Error('fetch failed') } } as never
    const ctx = { supabase, falhas: [] as string[], tentativas: [] as Tentativa[] }
    await expect(registrarTentativa(ctx, base)).resolves.toBeUndefined()
    expect(ctx.falhas).toEqual(['erro de banco ao gravar yt_own_collection_attempts'])
  })
})

describe('contarPorResultado e scopeJob', () => {
  it('conta só os kinds pedidos', () => {
    const t: Tentativa[] = [
      base,
      { ...base, scope_id: 'yt-2' },
      { ...base, kind: 'thumbnail', outcome: 'erro_http' },
      { ...base, kind: 'sondagem', outcome: 'sem_conexao' },
    ]
    expect(contarPorResultado(t, ['meta', 'thumbnail'])).toEqual({ ok: 2, erro_http: 1 })
    expect(contarPorResultado(t, ['relatorio'])).toEqual({})
  })

  it('scopeJob junta o uuid do canal e o tipo de relatório', () => {
    expect(scopeJob('ch-1', 'channel_reach_basic_a1')).toBe('ch-1:channel_reach_basic_a1')
  })
})
