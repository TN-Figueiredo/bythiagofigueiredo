// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import {
  resolverChave,
  PERFIL,
  ehDoPerfil,
  ehSoDoPerfil,
  fraseDeVencida,
  instanteValido,
} from '@/lib/pipeline/chave'

/** Tempo fixo do arquivo: nada de data escrita à mão no futuro, tudo relativo a este instante. */
const AGORA = Date.parse('2026-10-13T15:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

interface Resposta { data?: unknown; error?: { code?: string; message?: string } | null }

/** Cliente simulado: registra cada chamada da cadeia e responde `resposta` em `.single()`. */
function clienteSimulado(resposta: Resposta | (() => never)) {
  const chamadas: Array<{ metodo: string; args: unknown[] }> = []
  const single = vi.fn(async () => {
    chamadas.push({ metodo: 'single', args: [] })
    if (typeof resposta === 'function') return resposta()
    return resposta
  })
  const cadeia: Record<string, unknown> = {}
  const passo = (metodo: string) =>
    vi.fn((...args: unknown[]) => {
      chamadas.push({ metodo, args })
      return cadeia
    })
  cadeia.select = passo('select')
  cadeia.eq = passo('eq')
  cadeia.is = passo('is')
  cadeia.single = single
  const from = vi.fn((tabela: string) => {
    chamadas.push({ metodo: 'from', args: [tabela] })
    return cadeia
  })
  return { sb: { from } as never, chamadas, from }
}

const LINHA = {
  id: 'key-1',
  site_id: 'site-1',
  name: 'cowork',
  permissions: ['read'],
  user_id: null,
  expires_at: null,
}

describe('resolverChave: a consulta', () => {
  it('a consulta pede * (e não uma lista de colunas), na tabela certa', async () => {
    const { sb, chamadas } = clienteSimulado({ data: LINHA, error: null })
    await resolverChave(sb, 'hash-a', AGORA)
    expect(chamadas.find((c) => c.metodo === 'from')?.args).toEqual(['pipeline_api_keys'])
    expect(chamadas.find((c) => c.metodo === 'select')?.args).toEqual(['*'])
  })

  it('filtra pelo hash pedido e só por chave não revogada', async () => {
    const { sb, chamadas } = clienteSimulado({ data: LINHA, error: null })
    await resolverChave(sb, 'hash-pedido', AGORA)
    expect(chamadas.find((c) => c.metodo === 'eq')?.args).toEqual(['key_hash', 'hash-pedido'])
    expect(chamadas.find((c) => c.metodo === 'is')?.args).toEqual(['revoked_at', null])
  })
})

describe('resolverChave: linha viva', () => {
  it('linha sem as colunas user_id e expires_at (banco antes da MG11): ativa, com os dois nulos', async () => {
    const { user_id: _u, expires_at: _e, ...semColunas } = LINHA
    const { sb } = clienteSimulado({ data: semColunas, error: null })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(r).toEqual({
      estado: 'ativa',
      chave: { id: 'key-1', siteId: 'site-1', name: 'cowork', permissions: ['read'], userId: null, expiresAt: null },
    })
  })

  it('expires_at nula: ativa', async () => {
    const { sb } = clienteSimulado({ data: { ...LINHA, expires_at: null }, error: null })
    expect((await resolverChave(sb, 'h', AGORA)).estado).toBe('ativa')
  })

  it('fronteira da validade: um ms no futuro ativa; igual a agora vencida; no passado vencida', async () => {
    const futuro = clienteSimulado({ data: { ...LINHA, expires_at: iso(AGORA + 1) }, error: null })
    expect((await resolverChave(futuro.sb, 'h', AGORA)).estado).toBe('ativa')
    const igual = clienteSimulado({ data: { ...LINHA, expires_at: iso(AGORA) }, error: null })
    expect((await resolverChave(igual.sb, 'h', AGORA)).estado).toBe('vencida')
    const passado = clienteSimulado({ data: { ...LINHA, expires_at: iso(AGORA - 1) }, error: null })
    const r = await resolverChave(passado.sb, 'h', AGORA)
    expect(r.estado).toBe('vencida')
    if (r.estado === 'vencida') expect(r.chave.expiresAt).toBe(iso(AGORA - 1))
  })

  it('linha sem o campo name (fixtures de test/api/mcp/route.test.ts e test/api/pipeline-auth.test.ts): ativa, name nulo', async () => {
    const { sb } = clienteSimulado({ data: { id: 'key-1', site_id: 'site-1', permissions: ['read', 'write'] } })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(r.estado).toBe('ativa')
    if (r.estado === 'ativa') {
      expect(r.chave.name).toBeNull()
      expect(r.chave.permissions).toEqual(['read', 'write'])
    }
  })

  it('linha sem o campo permissions: ativa, lista vazia', async () => {
    const { sb } = clienteSimulado({ data: { id: 'key-1', site_id: 'site-1', name: 'x' }, error: null })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(r.estado === 'ativa' && r.chave.permissions).toEqual([])
  })

  it.each([
    ['nulo', null],
    ['texto', 'read'],
    ['objeto', { read: true }],
    ['número', 3],
  ])('permissions %s: lista vazia', async (_nome, valor) => {
    const { sb } = clienteSimulado({ data: { ...LINHA, permissions: valor }, error: null })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(r.estado === 'ativa' && r.chave.permissions).toEqual([])
  })

  it('id key-1 e site_id site-1 (fixtures dos testes que existem, sem forma de uuid): ativa', async () => {
    const { sb } = clienteSimulado({ data: LINHA, error: null })
    expect((await resolverChave(sb, 'h', AGORA)).estado).toBe('ativa')
  })

  it('user_id preenchido sai como userId', async () => {
    const { sb } = clienteSimulado({ data: { ...LINHA, user_id: 'u-1' }, error: null })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(r.estado === 'ativa' && r.chave.userId).toBe('u-1')
  })
})

describe('resolverChave: ausente', () => {
  it.each([
    ['dado nulo sem erro', { data: null, error: null }],
    ['dado nulo sem a propriedade error', { data: null }],
    ['dado nulo com PGRST116', { data: null, error: { code: 'PGRST116', message: 'The result contains 0 rows' } }],
    ['duas linhas com o mesmo hash (PGRST116 e dado nulo)', { data: null, error: { code: 'PGRST116', message: 'The result contains 2 rows' } }],
  ])('%s: ausente', async (_nome, resposta) => {
    const { sb } = clienteSimulado(resposta as Resposta)
    expect(await resolverChave(sb, 'h', AGORA)).toEqual({ estado: 'ausente' })
  })

  it('duas linhas: nenhum campo de linha nenhuma sai no retorno', async () => {
    const { sb } = clienteSimulado({ data: null, error: { code: 'PGRST116', message: '2 rows' } })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(Object.keys(r)).toEqual(['estado'])
  })
})

describe('resolverChave: erro', () => {
  it('erro do banco com outro code: erro com o code', async () => {
    const { sb } = clienteSimulado({ data: null, error: { code: '57014', message: 'timeout' } })
    expect(await resolverChave(sb, 'h', AGORA)).toEqual({ estado: 'erro', code: '57014' })
  })

  it('erro do banco sem code: erro com code desconhecido', async () => {
    const { sb } = clienteSimulado({ data: null, error: { message: 'sem code' } })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(r.estado).toBe('erro')
  })

  it('a chamada lança: resolverChave rejeita com a MESMA exceção, sem embrulhar', async () => {
    const falha = new Error('conexão caiu')
    const { sb } = clienteSimulado(() => {
      throw falha
    })
    await expect(resolverChave(sb, 'h', AGORA)).rejects.toBe(falha)
  })

  it.each([
    ['id vazio', { ...LINHA, id: '' }],
    ['id ausente', { site_id: 'site-1', permissions: ['read'] }],
    ['site_id vazio', { ...LINHA, site_id: '' }],
    ['site_id ausente', { id: 'key-1', permissions: ['read'] }],
    ['user_id vazio', { ...LINHA, user_id: '' }],
  ])('%s: erro (linha fora de forma)', async (_nome, linha) => {
    const { sb } = clienteSimulado({ data: linha, error: null })
    expect((await resolverChave(sb, 'h', AGORA)).estado).toBe('erro')
  })

  it.each(['amanhã', '2026', '2026-12-11', '2026-12-11T12:00:00', ''])(
    'expires_at %j: erro validade_invalida',
    async (texto) => {
      const { sb } = clienteSimulado({ data: { ...LINHA, expires_at: texto }, error: null })
      expect(await resolverChave(sb, 'h', AGORA)).toEqual({ estado: 'erro', code: 'validade_invalida' })
    },
  )

  it('expires_at que não é texto (número): erro validade_invalida', async () => {
    const { sb } = clienteSimulado({ data: { ...LINHA, expires_at: 1234 }, error: null })
    const r = await resolverChave(sb, 'h', AGORA)
    expect(r.estado).toBe('erro')
  })

  it('expires_at no formato que o banco devolve: as três valem, e dão o mesmo instante', async () => {
    const formatos = ['2026-12-11T12:00:00+00:00', '2026-12-11T12:00:00.123456+00:00', '2026-12-11T12:00:00Z']
    for (const f of formatos) {
      // vence depois do AGORA: comparado ao AGORA fixo de 2026 está no futuro, então é ativa
      const { sb } = clienteSimulado({ data: { ...LINHA, expires_at: f }, error: null })
      const r = await resolverChave(sb, 'h', AGORA)
      expect(r.estado, f).toBe('ativa')
    }
    expect(Date.parse('2026-12-11T12:00:00+00:00')).toBe(Date.parse('2026-12-11T12:00:00Z'))
    for (const f of formatos) expect(instanteValido(f)).toBe(true)
  })
})

describe('instanteValido', () => {
  it('aceita data e hora completas com fuso, com ou sem fração', () => {
    expect(instanteValido('2026-12-11T12:00:00Z')).toBe(true)
    expect(instanteValido('2026-12-11T12:00:00.5Z')).toBe(true)
    expect(instanteValido('2026-12-11T09:00:00-03:00')).toBe(true)
  })
  it('recusa o que não tem hora, fuso ou existência', () => {
    expect(instanteValido('2026-12-11')).toBe(false)
    expect(instanteValido('2026-12-11T12:00:00')).toBe(false)
    expect(instanteValido('2026-13-45T99:00:00Z')).toBe(false)
    expect(instanteValido('')).toBe(false)
    expect(instanteValido('amanhã')).toBe(false)
  })
})

describe('perfil observatorio_leitura', () => {
  it('o nome do perfil é fixo', () => {
    expect(PERFIL).toBe('observatorio_leitura')
  })
  it('ehDoPerfil: contém a permissão', () => {
    expect(ehDoPerfil(['observatorio_leitura'])).toBe(true)
    expect(ehDoPerfil(['read', 'observatorio_leitura'])).toBe(true)
    expect(ehDoPerfil(['read'])).toBe(false)
    expect(ehDoPerfil([])).toBe(false)
  })
  it('ehSoDoPerfil: exatamente um item, e é ele', () => {
    expect(ehSoDoPerfil(['observatorio_leitura'])).toBe(true)
    expect(ehSoDoPerfil([])).toBe(false)
    expect(ehSoDoPerfil(['observatorio_leitura', 'read'])).toBe(false)
    expect(ehSoDoPerfil([' observatorio_leitura'])).toBe(false)
    expect(ehSoDoPerfil(['observatorio_leitura', 'observatorio_leitura'])).toBe(false)
  })
})

describe('fraseDeVencida', () => {
  it('escreve dd/mm no dia de São Paulo', () => {
    expect(fraseDeVencida('2026-12-11T15:00:00Z')).toBe('chave vencida em 11/12: peça outra ao dono')
  })
  it('um instante às 02:00 UTC cai no dia anterior de São Paulo (fronteira de fuso)', () => {
    expect(fraseDeVencida('2026-12-11T02:00:00Z')).toBe('chave vencida em 10/12: peça outra ao dono')
    expect(fraseDeVencida('2026-12-11T03:00:00Z')).toBe('chave vencida em 11/12: peça outra ao dono')
  })
  it('virada de ano', () => {
    expect(fraseDeVencida('2026-01-01T01:00:00Z')).toBe('chave vencida em 31/12: peça outra ao dono')
  })
  it('instante inválido não inventa data', () => {
    expect(fraseDeVencida('lixo')).toBe('chave vencida: peça outra ao dono')
  })
})
