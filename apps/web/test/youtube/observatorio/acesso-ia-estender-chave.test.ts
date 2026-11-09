// @vitest-environment node
// O comando de estender a chave do perfil (A3b): mesmo segredo, nova validade, um update com CAS.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { estenderChaveDoPerfil, lerArgumentosDeEstender, type DepsDeEstender } from '@/lib/youtube/observatorio/acesso-ia/estender-chave'
import { descreverResultadoDeEstender } from '@/lib/youtube/observatorio/acesso-ia/estender-chave'
import { conferenciaDeVencimento } from '@/lib/youtube/observatorio/acesso-ia/vencimento'

const DIA = 86_400_000
const AGORA = Math.floor(Date.now() / DIA) * DIA + 15 * 3_600_000
const ymd = (ms: number): string => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10)
const NOME = `observatorio-${ymd(AGORA - 150 * DIA).replace(/-/g, '')}-abcd`
const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const ANA = '9a1b2c3d-0000-4000-8000-00000000aaaa'
const PERFIL = 'observatorio_leitura'

interface Linha { name: string; site_id: string; user_id: string | null; expires_at: string; permissions: string[]; revoked_at: string | null }
const linha = (o: Partial<Linha> = {}): Linha => ({ name: NOME, site_id: SITE, user_id: ANA, expires_at: new Date(AGORA + 10 * DIA).toISOString(), permissions: [PERFIL], revoked_at: null, ...o })

function fazer(o: { linhas?: Linha[]; ve?: boolean; banidoAte?: string | null; usuario?: boolean; casPerde?: boolean; updateErro?: boolean; userErro?: { status?: number; code?: string }; rpc?: 'erro' | 'forma'; lancaNoUpdate?: boolean } = {}) {
  const cen = { linhas: [linha()], ve: true, banidoAte: null as string | null, usuario: true, casPerde: false, updateErro: false, userErro: undefined as { status?: number; code?: string } | undefined, rpc: undefined as 'erro' | 'forma' | undefined, lancaNoUpdate: false, ...o }
  const selects: string[] = []
  const updates: Array<{ set: Record<string, unknown>; filtros: Array<[string, unknown]> }> = []
  const sb = {
    rpc: async () => (cen.rpc === 'erro' ? { data: null, error: { code: 'XX000' } } : cen.rpc === 'forma' ? { data: 'sim', error: null } : { data: cen.ve, error: null }),
    auth: { admin: { getUserById: async () => (cen.userErro ? { data: { user: null }, error: cen.userErro } : { data: { user: cen.usuario ? { id: ANA, banned_until: cen.banidoAte } : null }, error: null }) } },
    from: () => ({
      select: (colunas?: string) => { selects.push(String(colunas)); return { eq: async (_c: string, nome: string) => ({ data: cen.linhas.filter((l) => l.name === nome), error: null }) } },
      update: (set: Record<string, unknown>) => {
        const filtros: Array<[string, unknown]> = []
        const q = {
          eq: (c: string, v: unknown) => { filtros.push([c, v]); return q },
          is: (c: string, v: unknown) => { filtros.push([c, v]); return q },
          select: async () => {
            updates.push({ set, filtros })
            if (cen.lancaNoUpdate) throw new Error('rede')
            if (cen.updateErro) return { data: null, error: { code: 'XX000' } }
            return { data: cen.casPerde ? [] : [{ name: NOME }], error: null }
          },
        }
        return q
      },
    }),
  }
  const deps: DepsDeEstender = { sb: sb as never, agora: () => AGORA, e19: () => ({ ok: true }), excecaoEm: ymd(AGORA - 9 * DIA) }
  return { deps, updates, selects }
}
const pedido = { chave: NOME }

describe('estenderChaveDoPerfil', () => {
  it('caminho feliz: um update com CAS, padrão 366 dias, sem texto de chave', async () => {
    const c = fazer()
    const r = await estenderChaveDoPerfil(c.deps, pedido)
    expect(r).toMatchObject({ ok: true, nome: NOME, venceAgora: new Date(AGORA + 366 * DIA).toISOString() })
    expect(JSON.stringify(r)).not.toContain('obs_')
    expect(c.updates).toHaveLength(1)
    expect(c.updates[0]!.set).toEqual({ expires_at: new Date(AGORA + 366 * DIA).toISOString() })
    expect(c.updates[0]!.filtros).toEqual([['name', NOME], ['permissions', '{observatorio_leitura}'], ['revoked_at', null], ['expires_at', new Date(AGORA + 10 * DIA).toISOString()]])
  })
  it('--dias respeitado', async () => {
    const r = await estenderChaveDoPerfil(fazer().deps, { chave: NOME, dias: 30 })
    expect(r).toMatchObject({ ok: true, venceAgora: new Date(AGORA + 30 * DIA).toISOString() })
  })
  it('vencida há menos de 30 dias ainda estende', async () => {
    const r = await estenderChaveDoPerfil(fazer({ linhas: [linha({ expires_at: new Date(AGORA - 20 * DIA).toISOString() })] }).deps, pedido)
    expect(r.ok).toBe(true)
  })
  async function recusa(c: ReturnType<typeof fazer>, p = pedido) {
    const r = await estenderChaveDoPerfil(c.deps, p)
    expect(c.updates, 'zero updates').toHaveLength(0)
    return r
  }
  it.each([
    ['dias 0', { chave: NOME, dias: 0 }, 'validade_invalida'],
    ['dias 367', { chave: NOME, dias: 367 }, 'validade_invalida'],
    ['dias 1.5', { chave: NOME, dias: 1.5 }, 'validade_invalida'],
    ['nome fora do formato', { chave: 'cowork-permanent' }, 'nome_invalido'],
    ['nome vazio', { chave: ' ' }, 'chave_ausente'],
    ['inexistente', { chave: 'observatorio-20200101-ffff' }, 'chave_inexistente'],
  ] as const)('recusa %s', async (_t, p, esperado) => {
    expect((await recusa(fazer(), p as never))).toMatchObject({ ok: false, recusa: esperado })
  })
  it('recusa E19 e exceção ausentes', async () => {
    const a = fazer(); a.deps.e19 = () => ({ ok: false, motivo: 'x' })
    expect(await recusa(a)).toMatchObject({ recusa: 'travas' })
    const b = fazer(); b.deps.excecaoEm = null
    expect(await recusa(b)).toMatchObject({ recusa: 'excecao_ausente' })
  })
  it('recusa revogada, permissões diferentes (inclusive extra), vencida há mais de 30 dias, nova data anterior', async () => {
    expect(await recusa(fazer({ linhas: [linha({ revoked_at: new Date(AGORA).toISOString() })] }))).toMatchObject({ recusa: 'chave_revogada' })
    expect(await recusa(fazer({ linhas: [linha({ permissions: ['pipeline_all'] })] }))).toMatchObject({ recusa: 'perfil_diferente' })
    expect(await recusa(fazer({ linhas: [linha({ permissions: [PERFIL, 'outra'] })] }))).toMatchObject({ recusa: 'perfil_diferente' })
    expect(await recusa(fazer({ linhas: [linha({ expires_at: new Date(AGORA - 31 * DIA).toISOString() })] }))).toMatchObject({ recusa: 'vencida_ha_mais_de_30_dias' })
    const r = await recusa(fazer({ linhas: [linha({ expires_at: new Date(AGORA + 300 * DIA).toISOString() })] }), { chave: NOME, dias: 30 })
    expect(r).toMatchObject({ recusa: 'ja_vale_ate', venceEm: ymd(AGORA + 300 * DIA) })
  })
  it('recusa pessoa apagada, sem vínculo, inexistente no Auth ou banida', async () => {
    expect(await recusa(fazer({ linhas: [linha({ user_id: null })] }))).toMatchObject({ recusa: 'sem_vinculo' })
    expect(await recusa(fazer({ ve: false }))).toMatchObject({ recusa: 'sem_vinculo' })
    expect(await recusa(fazer({ usuario: false }))).toMatchObject({ recusa: 'sem_vinculo' })
    expect(await recusa(fazer({ banidoAte: new Date(AGORA + DIA).toISOString() }))).toMatchObject({ recusa: 'pessoa_banida' })
  })
  it('CAS perdido (0 linhas): nada_mudou; erro do banco: nao_conferido', async () => {
    expect(await estenderChaveDoPerfil(fazer({ casPerde: true }).deps, pedido)).toMatchObject({ ok: false, recusa: 'nada_mudou' })
    expect(await estenderChaveDoPerfil(fazer({ updateErro: true }).deps, pedido)).toMatchObject({ ok: false, recusa: 'nao_conferido', code: 'XX000' })
  })
})

describe('erros do Auth e do banco', () => {
  it('I-3: erro passageiro do getUserById vira nao_conferido; 404 / user_not_found vira sem_vinculo', async () => {
    expect(await estenderChaveDoPerfil(fazer({ userErro: { status: 500, code: 'unexpected_failure' } }).deps, pedido)).toMatchObject({ ok: false, recusa: 'nao_conferido', code: 'unexpected_failure' })
    expect(await estenderChaveDoPerfil(fazer({ userErro: { status: 404, code: 'user_not_found' } }).deps, pedido)).toMatchObject({ ok: false, recusa: 'sem_vinculo' })
    expect(await estenderChaveDoPerfil(fazer({ userErro: { code: 'user_not_found' } }).deps, pedido)).toMatchObject({ ok: false, recusa: 'sem_vinculo' })
  })
})

describe('colunas lidas, banimento e fronteiras', () => {
  it('M-1: lista as colunas, sem key_hash e sem *', async () => {
    const c = fazer()
    await estenderChaveDoPerfil(c.deps, pedido)
    expect(c.selects).toEqual(['name, site_id, user_id, expires_at, permissions, revoked_at'])
  })
  it('M-3: banned_until preenchido bane, como em lib/lgpd (passado, futuro ou ilegível)', async () => {
    for (const b of [new Date(AGORA - DIA).toISOString(), new Date(AGORA + DIA).toISOString(), 'lixo']) {
      const c = fazer({ banidoAte: b })
      expect(await estenderChaveDoPerfil(c.deps, pedido)).toMatchObject({ ok: false, recusa: 'pessoa_banida' })
      expect(c.updates).toHaveLength(0)
    }
  })
  it('M-4: vencida há exatamente 30 dias estende; nova data igual à atual estende', async () => {
    expect((await estenderChaveDoPerfil(fazer({ linhas: [linha({ expires_at: new Date(AGORA - 30 * DIA).toISOString() })] }).deps, pedido)).ok).toBe(true)
    expect((await estenderChaveDoPerfil(fazer({ linhas: [linha({ expires_at: new Date(AGORA + 30 * DIA).toISOString() })] }).deps, { chave: NOME, dias: 30 })).ok).toBe(true)
  })
  it('M-4: nome repetido, relógio inválido, rpc com erro ou forma inválida: nao_conferido, zero updates', async () => {
    const a = fazer({ linhas: [linha(), linha()] })
    expect(await estenderChaveDoPerfil(a.deps, pedido)).toMatchObject({ recusa: 'nao_conferido', code: 'nome_repetido' })
    const b = fazer(); b.deps.agora = () => Number.NaN
    expect(await estenderChaveDoPerfil(b.deps, pedido)).toMatchObject({ recusa: 'nao_conferido', code: 'relogio' })
    const c = fazer({ rpc: 'erro' })
    expect(await estenderChaveDoPerfil(c.deps, pedido)).toMatchObject({ recusa: 'nao_conferido', code: 'XX000' })
    const d = fazer({ rpc: 'forma' })
    expect(await estenderChaveDoPerfil(d.deps, pedido)).toMatchObject({ recusa: 'nao_conferido', code: 'forma_invalida' })
    for (const x of [a, b, c, d]) expect(x.updates).toHaveLength(0)
  })
  it('exceção na escrita: nao_conferido (resultado desconhecido)', async () => {
    expect(await estenderChaveDoPerfil(fazer({ lancaNoUpdate: true }).deps, pedido)).toMatchObject({ ok: false, recusa: 'nao_conferido', code: 'excecao' })
  })
})

describe('estender adia o aviso de vencimento', () => {
  it('a conferência segue o expires_at novo', async () => {
    const antes = conferenciaDeVencimento(NOME, new Date(AGORA + 10 * DIA).toISOString())!
    const r = await estenderChaveDoPerfil(fazer().deps, pedido)
    if (!r.ok) throw new Error('esperava ok')
    const depois = conferenciaDeVencimento(NOME, r.venceAgora)!
    // I-1: o id carrega o vencimento, então a entrada feita (antiga) e a nova convivem com ids únicos
    expect(depois.id).not.toBe(antes.id)
    expect(new Set([antes.id, depois.id]).size).toBe(2)
    expect(depois.data > antes.data).toBe(true)
    expect(depois.data).toBe(ymd(AGORA + 366 * DIA - 14 * DIA))
  })
})

describe('lerArgumentosDeEstender', () => {
  it('aceita --chave e --dias; recusa o resto', () => {
    expect(lerArgumentosDeEstender(['estender', '--chave', NOME])).toEqual({ ok: true, pedido: { chave: NOME } })
    expect(lerArgumentosDeEstender(['estender', '--chave', NOME, '--dias', '30'])).toEqual({ ok: true, pedido: { chave: NOME, dias: 30 } })
    expect(lerArgumentosDeEstender(['criar'])).toEqual({ ok: false, recusa: 'subcomando' })
    expect(lerArgumentosDeEstender(['estender'])).toEqual({ ok: false, recusa: 'chave_ausente' })
    expect(lerArgumentosDeEstender(['estender', '--chave', NOME, '--site', 'x'])).toEqual({ ok: false, recusa: 'opcao_desconhecida' })
    expect(lerArgumentosDeEstender(['estender', '--chave', NOME, '--chave', NOME])).toEqual({ ok: false, recusa: 'opcao_desconhecida' })
    expect(lerArgumentosDeEstender(['estender', '--chave', NOME, '--dias', 'abc'])).toEqual({ ok: false, recusa: 'validade_invalida' })
  })
})

describe('estrutura: o estender só faz UM update de expires_at', () => {
  const texto = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/acesso-ia/estender-chave.ts'), 'utf8')
  const c = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  it('um .update(, sem insert/delete/upsert, sem escrever revoked_at, sem rpc de escrita', () => {
    expect([...c.matchAll(/\.update\s*\(/g)]).toHaveLength(1)
    expect(c).not.toMatch(/\.(insert|delete|upsert)\s*\(/)
    expect(c).toMatch(/\.update\(\{ expires_at: venceAgora \}\)/)
    expect(c).not.toMatch(/revoked_at\s*:/)
    for (const m of c.matchAll(/\.rpc\s*\(\s*['"]([a-z_]+)['"]/g)) expect(['can_view_site_as']).toContain(m[1])
  })
})

describe('descreverResultadoDeEstender (frases da casca)', () => {
  it('ok: imprime o expires_at ISO completo e o passo de conferencias.ts', () => {
    const t = descreverResultadoDeEstender({ ok: true, nome: NOME, venceAntes: '2027-05-08T15:00:00.000Z', venceAgora: '2028-05-08T15:00:00.000Z' }).texto
    expect(t).toContain('2028-05-08T15:00:00.000Z')
    expect(t).toContain(`e17d2-chave-${NOME}-vence-20270508`)
    expect(t).toContain('conferencias.ts')
  })
  it('nao_conferido: resultado desconhecido, nunca "recusado"', () => {
    const t = descreverResultadoDeEstender({ ok: false, recusa: 'nao_conferido', code: 'XX000' }, NOME).texto
    expect(t).toContain('resultado desconhecido')
    expect(t).toContain(NOME)
    expect(t).not.toContain('recusado')
  })
  it('nada_mudou e recusa comum', () => {
    expect(descreverResultadoDeEstender({ ok: false, recusa: 'nada_mudou' }).texto).toContain('rode de novo')
    expect(descreverResultadoDeEstender({ ok: false, recusa: 'ja_vale_ate', venceEm: '2028-01-01' }).texto).toBe('recusado: ja_vale_ate (já vale até 2028-01-01)')
  })
})
