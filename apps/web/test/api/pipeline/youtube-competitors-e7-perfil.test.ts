// @vitest-environment node
// A5 · E7, Tarefa 3: o leitor do perfil do canal (handle, país, data de criação) e a regra
// "o YouTube não informou" (null dentro de `lido`) contra "ainda não lemos" (`nao_lido`).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const capturarMensagem = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => capturarMensagem(...a), captureException: vi.fn() }))

import { lerPerfis, perfilDe, FRASES_DE_PERFIL } from '@/lib/pipeline/services/competitors-perfil'
import { baseE7, criarBancoFalso, SITE_A, SITE_B, CANAL_A1, CANAL_A2, CANAL_A3, CANAL_B1, SENTINELA_ERRO, aoDia, type Linha, type Tabelas } from './e7-fixture'

const versao = (id: number, canal: string, campo: 'custom_url' | 'country', valor: unknown, site = SITE_A): Linha => ({
  id, site_id: site, competitor_channel_id: canal, video_id: null, field: campo, value: valor, is_current: true,
  first_seen_at: aoDia(1), last_seen_at: aoDia(0), window_start: null, precision: 'first',
})
const comPerfil = (t: Tabelas, canal: string, campos: Partial<Linha>): void => {
  const l = t['competitor_channels']!.find(c => c['id'] === canal)!
  Object.assign(l, campos)
}
function mundo(mut?: (t: Tabelas) => void) {
  const t = baseE7()
  comPerfil(t, CANAL_A1, { published_at: aoDia(900), last_seen_at: aoDia(0, 3) })
  t['competitor_field_versions'] = [versao(1, CANAL_A1, 'custom_url', '@alfa'), versao(2, CANAL_A1, 'country', 'BR')]
  mut?.(t)
  return criarBancoFalso(t)
}
async function lerOk(b: ReturnType<typeof criarBancoFalso>, site = SITE_A) {
  const r = await lerPerfis(b.sb, site)
  if (!r.lido) throw new Error('esperava lido, veio ' + r.motivo)
  return r
}

beforeEach(() => capturarMensagem.mockReset())

describe('lerPerfis e perfilDe', () => {
  it('canal relido com tudo', async () => {
    const r = await lerOk(mundo())
    expect(perfilDe(CANAL_A1, r)).toEqual({ estado: 'lido', lido_em: aoDia(0, 3), handle: '@alfa', pais: 'BR', criado_em: aoDia(900) })
  })

  it('canal relido sem país', async () => {
    const r = await lerOk(mundo(t => { t['competitor_field_versions']![1]!['value'] = null }))
    expect(perfilDe(CANAL_A1, r)).toMatchObject({ estado: 'lido', handle: '@alfa', pais: null })
  })

  it('canal relido sem handle', async () => {
    const r = await lerOk(mundo(t => { t['competitor_field_versions']![0]!['value'] = null }))
    expect(perfilDe(CANAL_A1, r)).toMatchObject({ estado: 'lido', handle: null, pais: 'BR' })
  })

  it('canal nunca relido: sem as chaves handle, pais e criado_em', async () => {
    const r = await lerOk(mundo())
    const p = perfilDe(CANAL_A2, r)
    expect(p).toEqual({ estado: 'nao_lido', motivo: 'canal_ainda_nao_relido', frase: FRASES_DE_PERFIL.canal_ainda_nao_relido })
    expect(Object.keys(p)).not.toContain('handle')
    expect(Object.keys(p)).not.toContain('pais')
    expect(Object.keys(p)).not.toContain('criado_em')
    expect(FRASES_DE_PERFIL.canal_ainda_nao_relido.length).toBeGreaterThan(10)
  })

  it('colunas com valor mas sem versão: nao_lido (a prova é a versão)', async () => {
    const r = await lerOk(mundo(t => comPerfil(t, CANAL_A3, { custom_url: '@gama', country: 'PT', published_at: aoDia(100), last_seen_at: aoDia(0) })))
    expect(perfilDe(CANAL_A3, r)).toMatchObject({ estado: 'nao_lido', motivo: 'canal_ainda_nao_relido' })
  })

  it('versão de handle sem versão de país: nao_lido', async () => {
    const r = await lerOk(mundo(t => { t['competitor_field_versions'] = [versao(1, CANAL_A1, 'custom_url', '@alfa')] }))
    expect(perfilDe(CANAL_A1, r)).toMatchObject({ estado: 'nao_lido', motivo: 'canal_ainda_nao_relido' })
  })

  it('handle e país vêm da versão, não da coluna; as colunas pedidas não incluem custom_url nem country', async () => {
    const b = mundo(t => comPerfil(t, CANAL_A1, { custom_url: '@antigo', country: 'XX' }))
    const r = await lerOk(b)
    expect(perfilDe(CANAL_A1, r)).toMatchObject({ handle: '@alfa', pais: 'BR' })
    const colunas = b.doTabela('competitor_channels').flatMap(c => c.colunas)
    expect(colunas).not.toContain('custom_url')
    expect(colunas).not.toContain('country')
    expect(colunas).not.toContain('description')
    expect([...new Set(colunas)].sort()).toEqual(['id', 'last_seen_at', 'published_at'])
  })

  it('o select de versões não pede description e pede só as três colunas', async () => {
    const b = mundo()
    await lerOk(b)
    expect([...new Set(b.doTabela('competitor_field_versions').flatMap(c => c.colunas))].sort()).toEqual(['competitor_channel_id', 'field', 'value'])
  })

  it('valor que não é texto nem nulo: tratado como nulo, com aviso', async () => {
    const r = await lerOk(mundo(t => { t['competitor_field_versions']![0]!['value'] = { x: 1 } }))
    expect(perfilDe(CANAL_A1, r)).toMatchObject({ estado: 'lido', handle: null })
    expect(capturarMensagem).toHaveBeenCalledWith('e7.perfil_valor_inesperado', expect.anything())
  })

  it('site sem canal: lido, mapa vazio', async () => {
    const r = await lerOk(mundo(), 'site-que-nao-existe')
    expect(r.porCanal.size).toBe(0)
  })

  it('o resultado não lido dá o motivo dele a todo canal', () => {
    expect(perfilDe(CANAL_A1, { lido: false, motivo: 'erro_do_banco' })).toEqual({ estado: 'nao_lido', motivo: 'erro_do_banco', frase: FRASES_DE_PERFIL.erro_do_banco })
  })

  it('a frase de canal não relido não afirma a causa', () => {
    expect(FRASES_DE_PERFIL.canal_ainda_nao_relido).not.toContain('ainda não foi relido')
    expect(FRASES_DE_PERFIL.canal_ainda_nao_relido).toBe('o histórico do perfil deste canal ainda não tem a primeira leitura de handle e país')
  })
})

describe('falhas do banco', () => {
  it.each(['competitor_channels', 'competitor_field_versions'])('tabela ausente em %s: lido false, tabela_ausente, nunca mapa vazio', async tabela => {
    const b = mundo(); b.falha(tabela, 'ausente')
    expect(await lerPerfis(b.sb, SITE_A)).toEqual({ lido: false, motivo: 'tabela_ausente' })
  })

  it.each([['erro'], ['lanca'], ['aborta'], ['nulo']] as const)('modo %s em cada tabela: erro_do_banco, sem a mensagem do banco', async modo => {
    for (const tabela of ['competitor_channels', 'competitor_field_versions']) {
      const b = mundo(); b.falha(tabela, modo)
      const r = await lerPerfis(b.sb, SITE_A)
      expect(r).toEqual({ lido: false, motivo: 'erro_do_banco' })
      expect(JSON.stringify(r)).not.toContain(SENTINELA_ERRO)
    }
  })

  it('o Sentry recebe só o código, nunca a mensagem do banco', async () => {
    const b = mundo(); b.falha('competitor_channels', 'erro')
    await lerPerfis(b.sb, SITE_A)
    expect(JSON.stringify(capturarMensagem.mock.calls)).not.toContain(SENTINELA_ERRO)
  })
})

describe('paginação', () => {
  const canais = (n: number): Linha[] => Array.from({ length: n }, (_, i) => ({
    id: 'k' + String(i).padStart(5, '0'), site_id: SITE_A, published_at: null, last_seen_at: null,
  }))

  it('teto de páginas atingido com a última cheia: cortado', async () => {
    const b = criarBancoFalso({ competitor_channels: canais(1000), competitor_field_versions: [] })
    expect(await lerPerfis(b.sb, SITE_A, { maxPaginas: 1 })).toEqual({ lido: false, motivo: 'cortado' })
    expect(b.total('competitor_channels')).toBe(1)
  })

  it('exatamente 1.000 linhas e a página seguinte vazia é leitura completa', async () => {
    const b = criarBancoFalso({ competitor_channels: canais(1000), competitor_field_versions: [] })
    const r = await lerOk(b)
    expect(r.porCanal.size).toBe(1000)
    expect(b.total('competitor_channels')).toBe(2)
  })

  it('duas páginas, sem repetir nem pular, ordenando por id', async () => {
    const t: Tabelas = { competitor_channels: canais(750), competitor_field_versions: [] }
    const vs: Linha[] = []
    t['competitor_channels']!.forEach((c, i) => {
      vs.push(versao(2 * i + 1, String(c['id']), 'custom_url', '@h' + i), versao(2 * i + 2, String(c['id']), 'country', 'BR'))
    })
    // fora de ordem: o falso respeita o order('id') e a faixa
    t['competitor_field_versions'] = vs.reverse()
    const b = criarBancoFalso(t)
    const r = await lerOk(b)
    expect(r.porCanal.size).toBe(750)
    for (const [i, c] of t['competitor_channels']!.entries()) expect(perfilDe(String(c['id']), r)).toMatchObject({ estado: 'lido', handle: '@h' + i })
    for (const c of b.doTabela('competitor_field_versions')) expect(c.ordens).toEqual([{ coluna: 'id', ascendente: true, nullsFirst: undefined }])
    expect(b.total('competitor_field_versions')).toBe(2)
  })
})

describe('filtro de site e tempo', () => {
  it('toda consulta leva o tempo limite', async () => {
    const b = mundo(); await lerOk(b)
    expect(b.consultas.length).toBeGreaterThanOrEqual(2)
    for (const c of b.consultas) expect(c.abortSignal).toBe(true)
  })

  it('as duas consultas filtram pelo site: canal de B com versão e colunas não entra no mapa de A', async () => {
    const b = mundo(t => {
      comPerfil(t, CANAL_B1, { published_at: aoDia(5), last_seen_at: aoDia(0) })
      t['competitor_field_versions']!.push(versao(3, CANAL_B1, 'custom_url', '@do-b', SITE_B), versao(4, CANAL_B1, 'country', 'US', SITE_B))
    })
    const r = await lerOk(b)
    expect(r.porCanal.has(CANAL_B1)).toBe(false)
    expect(perfilDe(CANAL_B1, r)).toMatchObject({ estado: 'nao_lido' })
    for (const c of b.consultas) expect(c.filtros).toContainEqual({ op: 'eq', coluna: 'site_id', valor: SITE_A })
    const rb = await lerOk(b, SITE_B)
    expect(perfilDe(CANAL_B1, rb)).toMatchObject({ estado: 'lido', handle: '@do-b' })
  })

  it('o módulo é de servidor e nunca pede description', () => {
    const t = readFileSync(join(process.cwd(), 'src/lib/pipeline/services/competitors-perfil.ts'), 'utf8')
    expect(t).toContain("import 'server-only'")
    expect(t.replace(/\/\/.*$/gm, '')).not.toMatch(/select\([^)]*description/)
  })
})
