// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  classificarLiberacoes, lerEstadoDaPessoa, mostraItemDoMenu, iaInicial, type EstadoDaPessoa,
} from '@/lib/youtube/observatorio/acesso-ia/estado-da-pessoa'

const AGORA = Date.parse('2026-11-12T12:00:00Z')
const FUTURO = '2027-02-11T03:00:00Z'
const L = (o: Record<string, unknown>) => ({ expires_at: FUTURO, revoked_at: null, revogada_por: null, bloqueios: [], created_at: '2026-11-01T00:00:00Z', ...o })

describe('classificarLiberacoes', () => {
  it('aberta e futura: ativa com a data de São Paulo', () => {
    expect(classificarLiberacoes([L({})], AGORA)).toEqual({ tipo: 'ativa', ate: '11/02/2027', bloqueadas: [] })
  })
  it('aberta com expires_at = agora: vencida (fronteira estrita)', () => {
    const iso = new Date(AGORA).toISOString()
    expect(classificarLiberacoes([L({ expires_at: iso })], AGORA)).toEqual({ tipo: 'vencida', em: '12/11/2026' })
  })
  it('aberta com expires_at inválido: ativa sem data', () => {
    expect(classificarLiberacoes([L({ expires_at: 'lixo' })], AGORA)).toEqual({ tipo: 'ativa', ate: null, bloqueadas: [] })
  })
  it('M3: aberta com data inválida e as duas IAs bloqueadas = cortada', () => {
    expect(classificarLiberacoes([L({ expires_at: 'lixo', bloqueios: ['chatgpt', 'claude'] })], AGORA)).toEqual({ tipo: 'cortada' })
    expect(classificarLiberacoes([L({ expires_at: 'lixo', bloqueios: ['chatgpt'] })], AGORA)).toEqual({ tipo: 'ativa', ate: null, bloqueadas: ['chatgpt'] })
  })
  it('bloqueios', () => {
    expect(classificarLiberacoes([L({ bloqueios: ['chatgpt'] })], AGORA)).toMatchObject({ tipo: 'ativa', bloqueadas: ['chatgpt'] })
    expect(classificarLiberacoes([L({ bloqueios: ['chatgpt', 'claude'] })], AGORA)).toEqual({ tipo: 'cortada' })
    expect(classificarLiberacoes([L({ bloqueios: ['gemini'] })], AGORA)).toMatchObject({ tipo: 'ativa', bloqueadas: [] })
  })
  it('só revogada: dono = cortada; vencida = vencida com a data; lgpd = nunca', () => {
    const rev = (por: string) => L({ revoked_at: '2026-11-02T00:00:00Z', revogada_por: por, expires_at: '2026-11-05T02:00:00Z' })
    expect(classificarLiberacoes([rev('dono')], AGORA)).toEqual({ tipo: 'cortada' })
    expect(classificarLiberacoes([rev('vencida')], AGORA)).toEqual({ tipo: 'vencida', em: '04/11/2026' })
    expect(classificarLiberacoes([rev('lgpd')], AGORA)).toEqual({ tipo: 'nunca' })
  })
  it('aberta + revogada antiga: vale a aberta', () => {
    const velha = L({ revoked_at: '2026-10-01T00:00:00Z', revogada_por: 'dono' })
    expect(classificarLiberacoes([L({}), velha], AGORA).tipo).toBe('ativa')
  })
  it('lista vazia = nunca; não lista = erro', () => {
    expect(classificarLiberacoes([], AGORA)).toEqual({ tipo: 'nunca' })
    expect(classificarLiberacoes(null, AGORA)).toEqual({ tipo: 'erro' })
    expect(classificarLiberacoes({}, AGORA)).toEqual({ tipo: 'erro' })
  })
})

function fakeSb(res: () => unknown) {
  const eq = vi.fn()
  const q: Record<string, unknown> = {}
  const order = vi.fn(() => q)
  const limit = vi.fn(async () => res())
  q.select = vi.fn(() => q); q.eq = eq.mockImplementation(() => q); q.order = order
  q.limit = limit
  const from = vi.fn(() => q)
  return { sb: { from } as unknown as SupabaseClient, eq, from, order, limit }
}

describe('lerEstadoDaPessoa', () => {
  const q = { userId: 'u1', siteId: 's1', agoraMs: AGORA }
  it('M2: ordena por created_at desc e limita a 20 (a "mais recente" depende disso)', async () => {
    const { sb, order, limit } = fakeSb(() => ({ data: [], error: null }))
    await lerEstadoDaPessoa(sb, q)
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(20)
  })
  it('filtra por user_id e site_id', async () => {
    const { sb, eq, from } = fakeSb(() => ({ data: [L({})], error: null }))
    expect((await lerEstadoDaPessoa(sb, q)).tipo).toBe('ativa')
    expect(from).toHaveBeenCalledWith('obs_ai_liberacoes')
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(eq).toHaveBeenCalledWith('site_id', 's1')
  })
  it('error do Supabase = erro; data null sem error = erro', async () => {
    expect((await lerEstadoDaPessoa(fakeSb(() => ({ data: null, error: { message: 'x' } })).sb, q)).tipo).toBe('erro')
    expect((await lerEstadoDaPessoa(fakeSb(() => ({ data: null, error: null })).sb, q)).tipo).toBe('erro')
  })
  it('exceção = erro', async () => {
    expect((await lerEstadoDaPessoa(fakeSb(() => { throw new Error('boom') }).sb, q)).tipo).toBe('erro')
  })
})

describe('mostraItemDoMenu / iaInicial', () => {
  it('falha fechado', () => {
    const e = (t: EstadoDaPessoa['tipo']) => ({ tipo: t }) as EstadoDaPessoa
    expect(['ativa', 'vencida', 'cortada', 'nunca', 'erro'].map((t) => mostraItemDoMenu(e(t as EstadoDaPessoa['tipo'])))).toEqual([true, true, true, false, false])
  })
  it('iaInicial', () => {
    expect(iaInicial('claude', [])).toBe('claude')
    expect(iaInicial('gemini', [])).toBe('chatgpt')
    expect(iaInicial(undefined, ['chatgpt'])).toBe('claude')
    expect(iaInicial(['claude', 'chatgpt'], [])).toBe('claude')
    expect(iaInicial('chatgpt', ['chatgpt'])).toBe('claude')
  })
})
