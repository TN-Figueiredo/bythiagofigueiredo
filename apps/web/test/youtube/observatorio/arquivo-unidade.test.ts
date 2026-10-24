// apps/web/test/youtube/observatorio/arquivo-unidade.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { exportarUnidade, serializarLinhas, ContagemDaFonteDifere } from '@/lib/youtube/observatorio/arquivo/exportar'
import { lerCsv } from '@/lib/youtube/observatorio/arquivo/csv'

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const fonte = (colunas: string[], linhas: Array<Array<string | null>>, soma: string | null = null, contagem = linhas.length) =>
  ({ ler: async () => ({ colunas, linhas, contagem, soma }) })
const O = { tabela: 'competitor_video_daily', canal: 'c', de: '2026-10-01', ate: '2026-10-31', rotulo: 'x/y.csv.gz', colunasDeOrdem: ['video_id', 'snap_date'] }

describe('exportarUnidade (pedido 2 da E10)', () => {
  it('nulo e texto vazio, vírgula, aspas e \\r voltam iguais', async () => {
    const linhas = [['v1', '2026-10-03', '10', null], ['v1', '2026-10-04', '11', ''], ['v2', '2026-10-03', '9007199254740993', 'a,"b"\r\nc']]
    const u = await exportarUnidade(fonte(['video_id', 'snap_date', 'views', 'nota'], linhas, '9007199254741014'), null, O)
    const volta = lerCsv(gunzipSync(u.gz).toString('utf8'))
    expect(volta.linhas).toEqual(linhas)
    expect(u.linhas).toBe(3)
    expect(u.csvSha256).toBe(sha(gunzipSync(u.gz)))
    expect(u.sha256).toBe(sha(u.gz))
    expect(u.menorChave).toBe('v1|2026-10-03')
    expect(u.maiorChave).toBe('v2|2026-10-03')
  })
  it('contagem da fonte diferente das linhas: lança e não grava', async () => {
    const gravados: string[] = []
    await expect(exportarUnidade(fonte(['a'], [['1']], null, 2), { gravar: async p => { gravados.push(p) } }, O)).rejects.toBeInstanceOf(ContagemDaFonteDifere)
    expect(gravados).toEqual([])
  })
  it('grava em `rotulo` quando há disco', async () => {
    const gravados: string[] = []
    await exportarUnidade(fonte(['a'], [['1']]), { gravar: async p => { gravados.push(p) } }, O)
    expect(gravados).toEqual(['x/y.csv.gz'])
  })
  it('os bytes são os do caminho antigo da E10 (cabeçalho, linha terminada em \\n)', () => {
    expect(serializarLinhas(['a', 'b'], [['1', null], ['', 'x']]).toString('utf8')).toBe('a,b\n1,\n"",x\n')
    expect(serializarLinhas(['a'], []).toString('utf8')).toBe('a\n')
  })
  it('fixtures de ouro: regeradas, dão o mesmo CSV e os valores do ouro.json (item 19)', async () => {
    const ouro = JSON.parse(readFileSync(new URL('../../fixtures/arquivo-mensal/ouro.json', import.meta.url), 'utf8')) as
      Array<{ arquivo: string; colunas: string[]; linhas: Array<Array<string | null>>; linhas_n: number; soma: string | null; sha256: string; csv_sha256: string }>
    for (const f of ouro) {
      const u = await exportarUnidade(fonte(f.colunas, f.linhas, f.soma), null, { ...O, rotulo: f.arquivo })
      // Nunca o sha256 do .gz: o zlib do Mac (Node 25) e o da CI (Node 22, .nvmrc) geram bytes diferentes (Yannis I2).
      // O ouro.json guarda `sha256` só para o leitor Python da forja (o arquivo dele é aquele .gz gravado).
      expect(u.csvSha256).toBe(f.csv_sha256)
      expect(gunzipSync(u.gz).equals(gunzipSync(readFileSync(new URL(`../../fixtures/arquivo-mensal/${f.arquivo}`, import.meta.url))))).toBe(true)
    }
  })
})
