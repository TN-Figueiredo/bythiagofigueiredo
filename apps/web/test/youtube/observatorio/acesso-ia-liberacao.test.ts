// @vitest-environment node
// Comandos do dono da C1 (liberar, estender --liberacao, cortar): tudo por rpc, simulado aqui.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerSubcomando, executarSubcomando, entradaDeConferencia, FRASE_DO_TETO } from '@/lib/youtube/observatorio/acesso-ia/liberacao'
import type { DepsDeCriar } from '@/lib/youtube/observatorio/acesso-ia/criar-chave'

const ANA = '9a1b2c3d-0000-4000-8000-00000000aaaa'
const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const LIB = '3f2a1b2c-1111-4222-8333-444455556666'
const AGORA = Date.parse('2026-11-11T12:00:00Z')

function fazer(respostas: Record<string, unknown> = {}) {
  const chamadas: Array<{ nome: string; args: Record<string, unknown> }> = []
  const sb = {
    rpc: async (nome: string, args: Record<string, unknown>) => {
      if (nome === 'can_view_site_as') return { data: true, error: null }
      chamadas.push({ nome, args })
      return { data: respostas[nome] ?? [], error: null }
    },
    auth: { admin: { listUsers: async () => ({ data: { users: [{ id: ANA, email: 'ana@example.com' }] }, error: null }) } },
    from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: [{ id: SITE }], error: null }) }) }) }),
  } as unknown as SupabaseClient
  const deps: DepsDeCriar = { sb, agora: () => AGORA, e19: () => ({ ok: true }), excecaoEm: null, aleatorio: () => Buffer.alloc(0) }
  return { deps, chamadas }
}

describe('lerSubcomando', () => {
  it('lê cada forma', () => {
    expect(lerSubcomando(['liberar', '--usuario', 'a@b.c', '--dias', '30'])).toEqual({ ok: true, s: { tipo: 'liberar', email: 'a@b.c', dias: 30 } })
    expect(lerSubcomando(['liberar', '--cliente', 'claude', '--usuario', 'a@b.c'])).toEqual({ ok: true, s: { tipo: 'liberar_cliente', email: 'a@b.c', cliente: 'claude' } })
    expect(lerSubcomando(['estender', '--liberacao', LIB, '--dias', '10'])).toEqual({ ok: true, s: { tipo: 'estender_liberacao', liberacao: LIB, dias: 10 } })
    expect(lerSubcomando(['cortar', '--usuario', 'a@b.c'])).toEqual({ ok: true, s: { tipo: 'cortar', email: 'a@b.c' } })
    expect(lerSubcomando(['cortar', '--usuario', 'a@b.c', '--cliente', 'gemini'])).toEqual({ ok: true, s: { tipo: 'cortar', email: 'a@b.c', cliente: 'gemini' } })
  })
  it('recusas', () => {
    const r = (a: string[]) => { const x = lerSubcomando(a); return x.ok ? 'ok' : x.recusa }
    expect(r(['criar'])).toBe('subcomando')
    expect(r(['liberar', '--x', '1'])).toBe('opcao_desconhecida')
    expect(r(['liberar', '--usuario'])).toBe('opcao_desconhecida')
    expect(r(['liberar', '--dias', '3'])).toBe('email_ausente')
    expect(r(['liberar', '--usuario', 'a@b.c', '--dias', '0'])).toBe('validade_invalida')
    expect(r(['liberar', '--usuario', 'a@b.c', '--dias', '367'])).toBe('validade_invalida')
    expect(r(['liberar', '--usuario', 'a@b.c', '--cliente', 'outro'])).toBe('cliente_invalido')
    expect(r(['cortar', '--usuario', 'a@b.c', '--cliente', 'outro'])).toBe('cliente_invalido')
    expect(r(['estender', '--dias', '3'])).toBe('liberacao_ausente')
    expect(r(['estender', '--liberacao', LIB])).toBe('validade_invalida')
  })
})

describe('entradaDeConferencia', () => {
  it('id com 8 do id e data 14 dias antes (dia de SP)', () => {
    const t = entradaDeConferencia(LIB, '2027-05-10T03:00:00Z')
    expect(t).toContain("id: 'e17d2-liberacao-3f2a1b2c-vence-20270510'")
    expect(t).toContain("data: '2027-04-26'")
    expect(entradaDeConferencia(LIB, '2027-05-10T02:59:00Z')).toContain("vence-20270509'")
  })
})

describe('executarSubcomando', () => {
  it('liberar chama obs_ai_liberar e imprime a entrada', async () => {
    const { deps, chamadas } = fazer({ obs_ai_liberar: [{ motivo: null, liberacao_id: LIB, expires_at: '2027-05-10T12:00:00Z' }] })
    const r = await executarSubcomando(deps, { tipo: 'liberar', email: ' ANA@example.com ' })
    expect(chamadas).toEqual([{ nome: 'obs_ai_liberar', args: { p_user: ANA, p_site: SITE, p_dias: 180, p_agora: new Date(AGORA).toISOString() } }])
    expect(r.ok && r.linhas.join('\n')).toContain('e17d2-liberacao-3f2a1b2c-vence-20270510')
  })
  it('liberar com motivo recusa', async () => {
    const { deps } = fazer({ obs_ai_liberar: [{ motivo: 'teto', liberacao_id: null, expires_at: null }] })
    expect(await executarSubcomando(deps, { tipo: 'liberar', email: 'ana@example.com', dias: 5 })).toEqual({ ok: false, recusa: FRASE_DO_TETO })
  })
  it('liberar_cliente', async () => {
    const { deps, chamadas } = fazer({ obs_ai_liberar_cliente: [{ motivo: null, bloqueios: ['chatgpt'] }] })
    const r = await executarSubcomando(deps, { tipo: 'liberar_cliente', email: 'ana@example.com', cliente: 'claude' })
    expect(chamadas[0]).toEqual({ nome: 'obs_ai_liberar_cliente', args: { p_user: ANA, p_site: SITE, p_cliente: 'claude' } })
    expect(r.ok && r.linhas[0]).toContain('chatgpt')
  })
  it('estender chama obs_ai_estender_liberacao; teto imprime a frase', async () => {
    const ok = fazer({ obs_ai_estender_liberacao: [{ motivo: null, expires_at: '2027-05-10T12:00:00Z' }] })
    const r = await executarSubcomando(ok.deps, { tipo: 'estender_liberacao', liberacao: LIB, dias: 30 })
    expect(ok.chamadas[0]).toEqual({ nome: 'obs_ai_estender_liberacao', args: { p_liberacao: LIB, p_dias: 30, p_agora: new Date(AGORA).toISOString() } })
    expect(r.ok).toBe(true)
    const teto = fazer({ obs_ai_estender_liberacao: [{ motivo: 'teto', expires_at: '2026-12-01T00:00:00Z' }] })
    expect(await executarSubcomando(teto.deps, { tipo: 'estender_liberacao', liberacao: LIB, dias: 30 })).toEqual({ ok: false, recusa: FRASE_DO_TETO })
    const rev = fazer({ obs_ai_estender_liberacao: [{ motivo: 'revogada', expires_at: null }] })
    expect(await executarSubcomando(rev.deps, { tipo: 'estender_liberacao', liberacao: LIB, dias: 30 })).toEqual({ ok: false, recusa: 'revogada' })
  })
  it('cortar imprime as linhas afetadas e passa cliente nulo sem --cliente', async () => {
    const { deps, chamadas } = fazer({ obs_ai_cortar: [{ tabela: 'obs_ai_liberacoes', id: LIB, motivo: null }, { tabela: 'pipeline_api_keys', id: 'k1', motivo: null }] })
    const r = await executarSubcomando(deps, { tipo: 'cortar', email: 'ana@example.com' })
    expect(chamadas[0]!.args.p_cliente).toBeNull()
    expect(r.ok && r.linhas).toEqual(['corte feito: 2 linha(s) afetada(s)', `obs_ai_liberacoes: ${LIB}`, 'pipeline_api_keys: k1'])
  })
  it('cortar sem liberação recusa; erro de rpc vira nao_conferido', async () => {
    const a = fazer({ obs_ai_cortar: [{ tabela: null, id: null, motivo: 'sem_liberacao' }] })
    expect(await executarSubcomando(a.deps, { tipo: 'cortar', email: 'ana@example.com' })).toEqual({ ok: false, recusa: 'sem_liberacao' })
    const b = fazer({ obs_ai_cortar: 'sim' })
    expect(await executarSubcomando(b.deps, { tipo: 'cortar', email: 'ana@example.com' })).toEqual({ ok: false, recusa: 'nao_conferido', code: 'forma_invalida' })
  })
})

describe('texto do arquivo', () => {
  it('não escreve por .from: todo efeito é rpc', () => {
    const t = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/acesso-ia/liberacao.ts'), 'utf8')
    expect(t).not.toMatch(/\.(update|delete|insert|upsert)\(/)
  })
})
