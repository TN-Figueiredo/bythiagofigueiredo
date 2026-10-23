// @vitest-environment node
/**
 * F3 T6: a ação `dispensarSugestao` e os dados da página. Ordem: Zod -> guarda (admin) -> cliente de serviço -> `dispensarSinal` -> mapeamento.
 * Quem não administra NUNCA chega ao cliente de serviço (o mock registra a criação).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const UUID = '11111111-1111-4111-8111-111111111111'
interface Opcoes { admin?: boolean; edit?: boolean; dispensar?: { ok: boolean; motivo?: string } | 'lanca' }
interface Registro { ordem: string[]; chamadas: unknown[][]; paths: unknown[][]; tags: unknown[][] }

async function montar(o: Opcoes = {}) {
  const r: Registro = { ordem: [], chamadas: [], paths: [], tags: [] }
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-ctx' }) }))
  vi.doMock('@/lib/cms/auth-guards', () => ({
    denyUnlessSiteAdmin: async (siteId: string) => { r.ordem.push(`admin:${siteId}`); return o.admin === false ? { ok: false, error: 'x' } : null },
    requireSiteAdminScope: async () => ({ ok: o.admin !== false, user: { id: 'u1' } }),
  }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
    requireSiteScope: async () => { r.ordem.push('edit'); return o.edit === false ? { ok: false } : { ok: true, user: { id: 'u1' } } },
  }))
  vi.doMock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => { r.paths.push(a) }, revalidateTag: (...a: unknown[]) => { r.tags.push(a) } }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { r.ordem.push('service'); return { marca: 'sb' } } }))
  vi.doMock('@/lib/youtube/observatorio/sinais/leitura', () => ({
    dispensarSinal: async (...a: unknown[]) => {
      r.chamadas.push(a)
      if (o.dispensar === 'lanca') throw new Error('postgres: relation niche_signals secret')
      return o.dispensar ?? { ok: true }
    },
  }))
  const mod = await import('@/app/cms/(authed)/youtube/competitors/_sugestoes/actions')
  return { r, ...mod }
}

beforeEach(() => { vi.restoreAllMocks() })

describe('dispensarSugestao', () => {
  it('sem admin: sem_permissao e o cliente de serviço nunca é criado', async () => {
    const { r, dispensarSugestao } = await montar({ admin: false })
    expect(await dispensarSugestao(UUID, 'nao_interessa')).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(r.ordem).not.toContain('service')
    expect(r.chamadas).toHaveLength(0)
  })
  it.each([['não-uuid', 'abc', 'nao_interessa'], ['uuid com lixo', UUID + 'x', 'nao_interessa'], ['motivo fora do enum', UUID, 'feito'], ['motivo vazio', UUID, '']])(
    'entrada inválida (%s) é recusada sem guarda nem banco', async (_n, id, motivo) => {
      const { r, dispensarSugestao } = await montar()
      const res = await dispensarSugestao(id as string, motivo as 'ja_fiz')
      expect(res).toEqual({ ok: false, motivo: 'motivo_invalido' })
      expect(r.ordem).toEqual([])
      expect(r.chamadas).toHaveLength(0)
    })
  it('entrada que não é string (objeto) também é recusada', async () => {
    const { r, dispensarSugestao } = await montar()
    expect(await dispensarSugestao({ x: 1 } as unknown as string, 'ja_fiz')).toEqual({ ok: false, motivo: 'motivo_invalido' })
    expect(r.ordem).toEqual([])
  })
  it('sucesso: dispensarSinal com por = user:<uid>, site do contexto, status dispensado; duas revalidações; guarda antes do serviço', async () => {
    const { r, dispensarSugestao } = await montar()
    expect(await dispensarSugestao(UUID, 'ja_fiz')).toEqual({ ok: true })
    expect(r.chamadas).toEqual([[{ marca: 'sb' }, 'site-ctx', UUID, 'dispensado', 'ja_fiz', 'user:u1']])
    expect(r.ordem.indexOf('admin:site-ctx')).toBeLessThan(r.ordem.indexOf('service'))
    expect(r.paths).toEqual([['/cms/youtube/competitors', 'layout'], ['/cms/youtube/ab-lab']])
  })
  it('os quatro motivos do enum passam', async () => {
    for (const m of ['lugar_errado', 'nao_interessa', 'nao_e_parecido', 'ja_fiz'] as const) {
      const { r, dispensarSugestao } = await montar()
      expect(await dispensarSugestao(UUID, m)).toEqual({ ok: true })
      expect(r.chamadas[0]![4]).toBe(m)
    }
  })
  it('nao_aberto é repassado', async () => {
    const { dispensarSugestao } = await montar({ dispensar: { ok: false, motivo: 'nao_aberto' } })
    expect(await dispensarSugestao(UUID, 'ja_fiz')).toEqual({ ok: false, motivo: 'nao_aberto' })
  })
  it.each([['nao_encontrado', 'nao_encontrado'], ['motivo_invalido', 'motivo_invalido'], ['coisa_do_banco', 'falhou'], [undefined, 'falhou']])(
    'mapeamento por tabela: %s -> %s', async (vindo, esperado) => {
      const { dispensarSugestao } = await montar({ dispensar: { ok: false, ...(vindo === undefined ? {} : { motivo: vindo }) } })
      expect(await dispensarSugestao(UUID, 'ja_fiz')).toEqual({ ok: false, motivo: esperado })
    })
  it('exceção vira falhou, sem texto do banco', async () => {
    const { dispensarSugestao } = await montar({ dispensar: 'lanca' })
    const res = await dispensarSugestao(UUID, 'ja_fiz')
    expect(res).toEqual({ ok: false, motivo: 'falhou' })
    expect(JSON.stringify(res)).not.toContain('postgres')
  })
  it('editor sem admin (edit ok, admin não): sem_permissao', async () => {
    const { dispensarSugestao } = await montar({ admin: false, edit: true })
    expect(await dispensarSugestao(UUID, 'ja_fiz')).toEqual({ ok: false, motivo: 'sem_permissao' })
  })
})
