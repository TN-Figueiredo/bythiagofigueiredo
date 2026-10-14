// @vitest-environment node
/**
 * A5 · E10, Tarefa 5: o manifesto do arquivo (`arquivo/manifesto.ts`). Puro. Fixture sintética: ids, hashes e nomes inventados.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  VERSAO_DO_MANIFESTO, caminhoDoArquivo, nomeDoLote, validarManifesto, textoDoSha256, paraRegistro, miniaturasAusentes,
  type Manifesto, type ArquivoDoManifesto, type MiniaturaDoManifesto,
} from '@/lib/youtube/observatorio/arquivo/manifesto'

const CANAL = '0a1b2c3d-1111-4222-8333-444455556666'
const SITE = '99999999-aaaa-4bbb-8ccc-dddddddddddd'
const hex = (c: string): string => c.repeat(64)

function arquivo(tabela: string, periodo: string, extra: Partial<ArquivoDoManifesto> = {}): ArquivoDoManifesto {
  const mensal = periodo !== 'unico'
  return {
    tabela, canal: CANAL, periodo,
    periodStart: mensal ? `${periodo}-01` : '1970-01-01', periodEnd: mensal ? `${periodo}-28` : '1970-01-01',
    caminho: caminhoDoArquivo(tabela, CANAL, periodo), linhas: 10, soma: mensal ? '1234567890123456789' : null,
    menorChave: '1', maiorChave: '10', sha256: hex('a'), csvSha256: hex('b'),
    colunas: [{ nome: 'id', tipo: 'bigint', nulo: false }, { nome: 'texto', tipo: 'text', nulo: true }], ...extra,
  }
}
const mini = (id: string, extra: Partial<MiniaturaDoManifesto> = {}): MiniaturaDoManifesto => ({
  url: `https://blob.example.test/observatorio/thumbs/${id}.jpg`, caminhoNoBlob: `observatorio/thumbs/${id}.jpg`,
  caminho: `miniaturas/${id}/capa.jpg`, bytes: 1000, sha256: hex('c'), ausente: false, ...extra,
})

function manifesto(): Manifesto {
  return {
    versao: 1, script: 'obs-arquivo 1.0.0', lote: 'canal-0a1b2c3d-2026-10-13', site: SITE,
    canal: { id: CANAL, youtubeId: 'UCsintetico', nome: 'Canal sintético' },
    geradoEm: '2026-10-13T15:00:00.000Z', sessao: { timezone: 'UTC', extraFloatDigits: 3 },
    arquivos: [
      arquivo('competitor_channels', 'unico'),
      arquivo('competitor_video_versions', '2026-08', { sha256: hex('1') }),
      arquivo('competitor_video_versions', '2026-09', { sha256: hex('2') }),
      arquivo('competitor_video_daily', '2026-09', { sha256: hex('3') }),
    ],
    tabelasSemLinha: ['competitor_readings'], tabelasAusentes: ['competitor_video_marks'],
    excluidas: [{ tabela: 'competitor_video_comment_authors', motivo: 'identidade do autor' }],
    miniaturas: [mini('v1'), mini('v2', { bytes: 500, sha256: hex('d') }), mini('v3', { caminho: null, bytes: null, sha256: null, ausente: true })],
    esquema: { competitor_channels: 'create table competitor_channels (id uuid)' },
  }
}

describe('A5 E10 T5: manifesto', () => {
  it('nome de lote: canal-<8 primeiros do id>-<dia>; entrada inválida lança', () => {
    expect(nomeDoLote(CANAL, '2026-10-13')).toBe('canal-0a1b2c3d-2026-10-13')
    expect(() => nomeDoLote('x', '2026-10-13')).toThrow()
    expect(() => nomeDoLote(CANAL, '13/10/2026')).toThrow()
  })

  it('caminho do arquivo: <tabela>/<canal>/<periodo>.csv.gz; nada que saia da pasta passa', () => {
    expect(caminhoDoArquivo('competitor_videos', CANAL, '2026-09')).toBe(`competitor_videos/${CANAL}/2026-09.csv.gz`)
    expect(caminhoDoArquivo('competitor_channels', CANAL, 'unico')).toBe(`competitor_channels/${CANAL}/unico.csv.gz`)
    expect(() => caminhoDoArquivo('../x', CANAL, '2026-09')).toThrow()
    expect(() => caminhoDoArquivo('a/b', CANAL, '2026-09')).toThrow()
    expect(() => caminhoDoArquivo('t', '../..', '2026-09')).toThrow()
    expect(() => caminhoDoArquivo('t', CANAL, '2026-13')).toThrow()
    expect(() => caminhoDoArquivo('t', CANAL, '../2026')).toThrow()
  })

  it('o manifesto da fixture é válido', () => {
    expect(VERSAO_DO_MANIFESTO).toBe(1)
    const r = validarManifesto(JSON.parse(JSON.stringify(manifesto())))
    expect('valor' in r).toBe(true)
  })

  it('manifesto com chave faltando é recusado (uma por vez), e o motivo nomeia a chave', () => {
    const base = manifesto()
    for (const chave of Object.keys(base)) {
      const copia: Record<string, unknown> = JSON.parse(JSON.stringify(base))
      delete copia[chave]
      const r = validarManifesto(copia)
      expect('porque' in r, chave).toBe(true)
      if ('porque' in r) expect(r.porque, chave).toContain(chave)
    }
    // chave faltando dentro de um arquivo e de uma miniatura
    for (const chave of Object.keys(base.arquivos[0]!)) {
      const copia = JSON.parse(JSON.stringify(base)) as Manifesto
      delete (copia.arquivos[0] as unknown as Record<string, unknown>)[chave]
      expect('porque' in validarManifesto(copia), `arquivos[0].${chave}`).toBe(true)
    }
    for (const chave of Object.keys(base.miniaturas[0]!)) {
      const copia = JSON.parse(JSON.stringify(base)) as Manifesto
      delete (copia.miniaturas[0] as unknown as Record<string, unknown>)[chave]
      expect('porque' in validarManifesto(copia), `miniaturas[0].${chave}`).toBe(true)
    }
  })

  it('versão desconhecida é recusada; não-objeto também', () => {
    expect(validarManifesto({ ...manifesto(), versao: 2 })).toEqual({ porque: 'versão do manifesto desconhecida' })
    for (const x of [null, 'texto', 7, [], undefined]) expect('porque' in validarManifesto(x)).toBe(true)
  })

  it('caminho que sai da pasta do lote é recusado (manifesto adulterado)', () => {
    const a = manifesto()
    a.arquivos[0]!.caminho = '../fora.csv.gz'
    expect('porque' in validarManifesto(a)).toBe(true)
    const b = manifesto()
    b.miniaturas[0]!.caminho = 'miniaturas/../../etc/passwd'
    expect('porque' in validarManifesto(b)).toBe(true)
    const c = manifesto()
    c.miniaturas[0]!.caminho = '/etc/passwd'
    expect('porque' in validarManifesto(c)).toBe(true)
    const d = manifesto()
    d.arquivos[1]!.caminho = d.arquivos[2]!.caminho // dois arquivos no mesmo caminho
    expect('porque' in validarManifesto(d)).toBe(true)
  })

  it('arquivo de outro canal, sha256 que não é hex e miniatura ausente com caminho são recusados', () => {
    const a = manifesto()
    a.arquivos[0]!.canal = '0a1b2c3d-1111-4222-8333-000000000000'
    a.arquivos[0]!.caminho = caminhoDoArquivo('competitor_channels', a.arquivos[0]!.canal, 'unico')
    expect('porque' in validarManifesto(a)).toBe(true)
    const b = manifesto()
    b.arquivos[0]!.sha256 = 'xyz'
    expect('porque' in validarManifesto(b)).toBe(true)
    const c = manifesto()
    c.miniaturas[2]!.caminho = 'miniaturas/v3/capa.jpg'
    expect('porque' in validarManifesto(c)).toBe(true)
  })

  it('o motivo da recusa nunca ecoa o valor recebido', () => {
    const m = manifesto()
    m.arquivos[0]!.tabela = 'SEGREDO; drop table'
    const r = validarManifesto(m)
    expect('porque' in r && r.porque).not.toContain('SEGREDO')
  })

  it('textoDoSha256 lista todo arquivo, toda miniatura presente e o manifesto.json (formato do sha256sum -c)', () => {
    const m = manifesto()
    const texto = textoDoSha256(m, hex('e'))
    const linhas = texto.trimEnd().split('\n')
    expect(texto.endsWith('\n')).toBe(true)
    expect(linhas).toHaveLength(m.arquivos.length + 2 + 1) // 4 arquivos, 2 miniaturas presentes, o manifesto
    for (const a of m.arquivos) expect(linhas).toContain(`${a.sha256}  ${a.caminho}`)
    expect(linhas).toContain(`${hex('c')}  miniaturas/v1/capa.jpg`)
    expect(linhas).toContain(`${hex('d')}  miniaturas/v2/capa.jpg`)
    expect(linhas[linhas.length - 1]).toBe(`${hex('e')}  manifesto.json`)
    // dois espaços entre o hash e o caminho: é o formato que `sha256sum -c` lê
    for (const l of linhas) expect(l).toMatch(/^[0-9a-f]{64} {2}\S+$/)
  })

  it('miniatura ausente não entra no sha256 e entra na contagem de ausentes', () => {
    const m = manifesto()
    expect(textoDoSha256(m, hex('e'))).not.toContain('v3')
    expect(miniaturasAusentes(m)).toBe(1)
    expect(miniaturasAusentes({ ...m, miniaturas: [] })).toBe(0)
  })

  it('paraRegistro: blob_count, blob_bytes e blob_missing só nas linhas de competitor_video_versions, e nulo nas outras', () => {
    const linhas = paraRegistro(manifesto())
    expect(linhas).toHaveLength(4)
    const porTabela = (t: string) => linhas.filter(l => l.table_name === t)
    for (const l of [...porTabela('competitor_channels'), ...porTabela('competitor_video_daily')]) {
      expect([l.blob_count, l.blob_bytes, l.blob_missing]).toEqual([null, null, null])
    }
    const versoes = porTabela('competitor_video_versions')
    expect(versoes).toHaveLength(2)
    // o total vai no primeiro arquivo da tabela e zero nos outros: a soma da tabela é o total, nunca o dobro
    expect([versoes[0]!.blob_count, versoes[0]!.blob_bytes, versoes[0]!.blob_missing]).toEqual([2, 1500, 1])
    expect([versoes[1]!.blob_count, versoes[1]!.blob_bytes, versoes[1]!.blob_missing]).toEqual([0, 0, 0])
  })

  it('paraRegistro: os campos que a função do banco lê, com a soma como texto e o arquivo único em 1970-01-01', () => {
    const [unico, mensal] = [paraRegistro(manifesto())[0]!, paraRegistro(manifesto())[1]!]
    expect(unico).toMatchObject({ table_name: 'competitor_channels', period_start: '1970-01-01', period_end: '1970-01-01', row_count: 10, control_sum: null, file_sha256: hex('a'), csv_sha256: hex('b') })
    expect(mensal).toMatchObject({ table_name: 'competitor_video_versions', period_start: '2026-08-01', period_end: '2026-08-28', control_sum: '1234567890123456789' })
    expect(Object.keys(unico).sort()).toEqual(['blob_bytes', 'blob_count', 'blob_missing', 'control_sum', 'csv_sha256', 'file_sha256', 'period_end', 'period_start', 'row_count', 'table_name'])
  })

  it('o módulo só importa de node: e de caminho relativo (o tsx da raiz o importa)', () => {
    const src = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/arquivo/manifesto.ts'), 'utf8')
    for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) expect(m[1]!.startsWith('node:') || m[1]!.startsWith('.'), m[1]).toBe(true)
  })
})
