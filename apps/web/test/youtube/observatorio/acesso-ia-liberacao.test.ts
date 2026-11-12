// @vitest-environment node
// Comandos do dono da C1 (liberar, estender --liberacao, cortar): tudo por rpc, simulado aqui.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerSubcomando, executarSubcomando, entradaDeConferencia, ehSubcomandoDeLiberacao, FRASE_DO_TETO } from '@/lib/youtube/observatorio/acesso-ia/liberacao'

const ANA = '9a1b2c3d-0000-4000-8000-00000000aaaa'
const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const LIB = '3f2a1b2c-1111-4222-8333-444455556666'
const SITE_B = '7c9d1e2f-5a47-4d0e-9b1c-7e6a2d4f8bbb'
const AGORA = Date.parse('2026-11-11T12:00:00Z')

interface Opcoes { sites?: string[]; usuarios?: Array<{ id: string; email: string }>; ve?: (site: string) => boolean | { erro: string } }

function fazer(respostas: Record<string, unknown> = {}, o: Opcoes = {}) {
  const chamadas: Array<{ nome: string; args: Record<string, unknown> }> = []
  const sites = o.sites ?? [SITE]
  const usuarios = o.usuarios ?? [{ id: ANA, email: 'ana@example.com' }]
  const sb = {
    rpc: async (nome: string, args: Record<string, unknown>) => {
      if (nome === 'can_view_site_as') {
        const v = o.ve ? o.ve(String(args.p_site)) : true
        return typeof v === 'boolean' ? { data: v, error: null } : { data: null, error: { code: v.erro } }
      }
      chamadas.push({ nome, args })
      return { data: respostas[nome] ?? [], error: null }
    },
    auth: { admin: { listUsers: async () => ({ data: { users: usuarios }, error: null }) } },
    from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: sites.map((id) => ({ id })), error: null }) }) }) }),
  } as unknown as SupabaseClient
  const deps = { sb, agora: () => AGORA }
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
  it('--site: liberar (as duas formas) e cortar aceitam; estender não', () => {
    expect(lerSubcomando(['liberar', '--usuario', 'a@b.c', '--site', SITE])).toEqual({ ok: true, s: { tipo: 'liberar', email: 'a@b.c', siteId: SITE } })
    expect(lerSubcomando(['liberar', '--cliente', 'claude', '--usuario', 'a@b.c', '--site', SITE.toUpperCase()])).toEqual({ ok: true, s: { tipo: 'liberar_cliente', email: 'a@b.c', cliente: 'claude', siteId: SITE } })
    expect(lerSubcomando(['cortar', '--usuario', 'a@b.c', '--site', SITE])).toEqual({ ok: true, s: { tipo: 'cortar', email: 'a@b.c', siteId: SITE } })
    const x = lerSubcomando(['estender', '--liberacao', LIB, '--dias', '3', '--site', SITE])
    expect(x.ok ? 'ok' : x.recusa).toBe('opcao_desconhecida')
  })
  it('--site que não é uuid é recusa de leitura', () => {
    const x = lerSubcomando(['cortar', '--usuario', 'a@b.c', '--site', 'xyz'])
    expect(x.ok ? 'ok' : x.recusa).toBe('site_invalido')
  })
  it('o despacho: estender --liberacao é do liberacao.ts; estender --chave e criar não', () => {
    expect(ehSubcomandoDeLiberacao(['estender', '--liberacao', LIB, '--dias', '3'])).toBe(true)
    expect(ehSubcomandoDeLiberacao(['estender', '--chave', 'observatorio-20261111-abcd'])).toBe(false)
    expect(ehSubcomandoDeLiberacao(['liberar', '--usuario', 'a@b.c'])).toBe(true)
    expect(ehSubcomandoDeLiberacao(['cortar', '--usuario', 'a@b.c'])).toBe(true)
    expect(ehSubcomandoDeLiberacao(['criar', '--usuario', 'a@b.c'])).toBe(false)
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
  it('pessoa e site: email_ambiguo, e-mail sem usuário, sem_acesso_ao_site, site_ambiguo, nao_conferido de veOSite', async () => {
    const dois = fazer({}, { usuarios: [{ id: ANA, email: 'ana@example.com' }, { id: SITE_B, email: 'ana@example.com' }] })
    expect(await executarSubcomando(dois.deps, { tipo: 'cortar', email: 'ana@example.com' })).toEqual({ ok: false, recusa: 'email_ambiguo' })
    const nenhum = fazer({}, { usuarios: [] })
    expect(await executarSubcomando(nenhum.deps, { tipo: 'cortar', email: 'ana@example.com' })).toEqual({ ok: false, recusa: 'email_ausente' })
    const nao = fazer({}, { ve: () => false })
    expect(await executarSubcomando(nao.deps, { tipo: 'cortar', email: 'ana@example.com' })).toEqual({ ok: false, recusa: 'sem_acesso_ao_site' })
    const amb = fazer({}, { sites: [SITE, SITE_B] })
    expect(await executarSubcomando(amb.deps, { tipo: 'cortar', email: 'ana@example.com' })).toEqual({ ok: false, recusa: 'site_ambiguo' })
    expect(amb.chamadas).toHaveLength(0)
    const erro = fazer({}, { ve: () => ({ erro: 'XX000' }) })
    expect(await executarSubcomando(erro.deps, { tipo: 'cortar', email: 'ana@example.com' })).toEqual({ ok: false, recusa: 'nao_conferido', code: 'XX000' })
  })
  it('--site com 2 sites visíveis: chama a rpc com aquele p_site (liberar, liberar_cliente e cortar)', async () => {
    const a = fazer({ obs_ai_cortar: [{ tabela: 'obs_ai_liberacoes', id: LIB, motivo: null }], obs_ai_liberar: [{ motivo: null, liberacao_id: LIB, expires_at: '2027-05-10T12:00:00Z' }],
                      obs_ai_liberar_cliente: [{ motivo: null, bloqueios: [] }] }, { sites: [SITE, SITE_B] })
    await executarSubcomando(a.deps, { tipo: 'cortar', email: 'ana@example.com', siteId: SITE_B })
    await executarSubcomando(a.deps, { tipo: 'liberar', email: 'ana@example.com', siteId: SITE_B })
    await executarSubcomando(a.deps, { tipo: 'liberar_cliente', email: 'ana@example.com', cliente: 'claude', siteId: SITE_B })
    expect(a.chamadas.map((c) => c.args.p_site)).toEqual([SITE_B, SITE_B, SITE_B])
  })
  it('--site que a pessoa não vê = sem_acesso_ao_site; que não é uuid (chamada direta) idem; erro do veOSite = nao_conferido', async () => {
    const a = fazer({}, { sites: [SITE, SITE_B], ve: (s) => s === SITE })
    expect(await executarSubcomando(a.deps, { tipo: 'cortar', email: 'ana@example.com', siteId: SITE_B })).toEqual({ ok: false, recusa: 'sem_acesso_ao_site' })
    expect(await executarSubcomando(a.deps, { tipo: 'cortar', email: 'ana@example.com', siteId: 'xyz' })).toEqual({ ok: false, recusa: 'sem_acesso_ao_site' })
    const e = fazer({}, { ve: () => ({ erro: 'XX000' }) })
    expect(await executarSubcomando(e.deps, { tipo: 'cortar', email: 'ana@example.com', siteId: SITE })).toEqual({ ok: false, recusa: 'nao_conferido', code: 'XX000' })
    expect(a.chamadas).toHaveLength(0)
  })
  it('Phil I1: cortar sem liberação mas com chave afetada é corte feito, não falha', async () => {
    const { deps } = fazer({ obs_ai_cortar: [{ tabela: 'pipeline_api_keys', id: 'k1', motivo: null }, { tabela: 'pipeline_api_keys', id: 'k2', motivo: null }, { tabela: null, id: null, motivo: 'sem_liberacao' }] })
    const r = await executarSubcomando(deps, { tipo: 'cortar', email: 'ana@example.com' })
    expect(r).toEqual({ ok: true, linhas: ['corte feito: 2 chave(s) Bearer; a pessoa não tinha liberação', 'pipeline_api_keys: k1', 'pipeline_api_keys: k2'] })
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
