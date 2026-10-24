// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { serializarResumo, type LinhasDoResumo } from '@/lib/youtube/observatorio/arquivo-mensal/resumo'
import { montarManifesto, type LinhasDoManifesto } from '@/lib/youtube/observatorio/arquivo-mensal/manifesto-mensal'

const CANAL = '11111111-1111-4111-8111-111111111111'
const base: LinhasDoResumo = {
  versao: 1, vazio: false, unit_hashes: { 'u:a': 'h' },
  colunas_canal: ['canal', 'tabela', 'var_likes'], colunas_video: ['video', 'canal', 'likes_primeira'],
  canal: [[CANAL, 'competitor_video_daily', null]], video: [['v1', CANAL, null], ['v2', CANAL, '']],
}

describe('arquivo-mensal/resumo', () => {
  it('nulo nunca vira zero: campo vazio sem aspas; texto vazio sai entre aspas', () => {
    const r = serializarResumo(base)
    const csv = gunzipSync(r.arquivos[1]!.gz).toString('utf8').split('\n')
    expect(csv[1]).toBe(`v1,${CANAL},`)
    expect(csv[2]).toBe(`v2,${CANAL},""`)
    expect(r.arquivos[0]!.linhas).toBe(1)
    expect(r.arquivos[1]!.linhas).toBe(2)
    expect(r.arquivos[0]!.sha256).toBe(createHash('sha256').update(r.arquivos[0]!.gz).digest('hex'))
  })
  it('resumo vazio é terminal sem arquivo', () => {
    expect(serializarResumo({ ...base, vazio: true, canal: [], video: [] }).arquivos).toEqual([])
  })
  it('linha com número de campos errado falha alto', () => {
    expect(() => serializarResumo({ ...base, canal: [[CANAL]] })).toThrow(/campos/)
  })
})

describe('arquivo-mensal/manifesto-mensal', () => {
  const gz = Buffer.from('conteudo da unidade')
  const rows: LinhasDoManifesto = {
    classe: 'serie', mes: '2026-10', versao: 1, gerado_em: '2026-11-28T00:00:00-03:00',
    arquivos: [
      { arquivo_id: 'u:1', tipo: 'unidade', caminho: `serie/canais/${CANAL}/competitor_video_daily/2026-10.v1.csv.gz`, canal: CANAL, tabela: 'competitor_video_daily',
        linhas: 58, soma: '1000', sha256: createHash('sha256').update(gz).digest('hex'), csv_sha256: null, estado: 'normal' },
      { arquivo_id: 'u:2', tipo: 'unidade', caminho: null, canal: CANAL, tabela: 'competitor_video_early', linhas: 0, soma: '0', sha256: null, csv_sha256: null, estado: 'vazia' },
    ],
    contagens: { unidades_canal_removido: 0, unidades_perdidas: 0, unidades_expurgadas: 0 },
  }
  it('não traz nome de canal nem id do YouTube, e termina em \\n', () => {
    const m = montarManifesto(rows, 'site-x')
    const txt = m.json.toString('utf8')
    expect(txt.endsWith('}\n')).toBe(true)
    expect(txt).not.toMatch(/canal m3b|UC[0-9a-f]{22}/)
    expect(JSON.parse(txt)).toMatchObject({ formato: 1, classe: 'serie', mes: '2026-10', versao: 1, site: 'site-x', unidades_perdidas: 0 })
  })
  it('é igual em toda repetição', () => {
    expect(montarManifesto(rows, 's').json.equals(montarManifesto(rows, 's').json)).toBe(true)
  })
  it('o .sha256 passa em sha256sum -c numa pasta temporária', () => {
    const m = montarManifesto(rows, 's')
    const dir = mkdtempSync(join(tmpdir(), 'm3b-man-'))
    try {
      const grava = (rel: string, d: Buffer): void => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), d) }
      grava(rows.arquivos[0]!.caminho!, gz)
      grava(m.caminhoJson, m.json)
      grava('lista.sha256', m.lista)
      const r = spawnSync('sh', ['-c', 'if command -v sha256sum >/dev/null; then sha256sum -c lista.sha256; else shasum -a 256 -c lista.sha256; fi'], { cwd: dir, encoding: 'utf8' })
      expect(r.status, r.stdout + r.stderr).toBe(0)
      expect(m.lista.toString('utf8').trim().split('\n')).toHaveLength(2)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
