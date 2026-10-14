// @vitest-environment node
// Este retrato é a prova do item 53 da A5 (a E7 não muda o pacote da forja). Outra etapa que mude o pacote de propósito
// regenera com `vitest -u` neste arquivo e diz no commit.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildSent } from '@/lib/youtube/observatorio/forja/sent'

const obs = createObservatory(datasetFromOracle(loadOracle()))
const RAIZ = process.cwd()
const RETRATO = join(RAIZ, 'test/youtube/observatorio/__retratos__/forja-sent.json')

/** Serializa com as chaves ordenadas, para a ordem de inserção nunca mudar o retrato. */
function ordenado(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenado)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, ordenado(x)]))
  return v
}

function pacotes(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const tipo of ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas'])
    for (const niche of [...obs.forja.niches].sort()) out[`${tipo}/${niche}`] = buildSent(obs, tipo, { niche })
  const cinco = obs.videos.filter(v => v.tracked).map(v => v.id).sort().slice(0, 5)
  for (const videoId of cinco) out[`leitura-video/${videoId}`] = buildSent(obs, 'leitura-video', { videoId })
  return ordenado(out) as Record<string, unknown>
}

const ORIGENS = ['src/lib/youtube/observatorio/forja', 'src/lib/youtube/observatorio/pack.ts']
const ARQUIVOS_DE_FORA = ['src/app/api/pipeline/youtube/competitors/readings/route.ts', 'src/lib/pipeline/services/forja-queue.ts']

function arquivosDe(caminho: string): string[] {
  const abs = join(RAIZ, caminho)
  if (!existsSync(abs)) return []
  if (!abs.endsWith('.ts')) return readdirSync(abs, { recursive: true, withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.ts')).map(e => join(e.parentPath, e.name))
  return [abs]
}
const textos = (caminhos: string[]) => caminhos.flatMap(arquivosDe).map(f => readFileSync(f, 'utf8'))

describe('o pacote da forja', () => {
  it('o pacote da forja é o do retrato', async () => {
    await expect(JSON.stringify(pacotes(), null, 2) + '\n').toMatchFileSnapshot(RETRATO)
  })

  it('o retrato não está vazio', () => {
    const r = JSON.parse(readFileSync(RETRATO, 'utf8')) as Record<string, { nVideos?: number }>
    const lista = Object.values(r)
    expect(lista.length).toBeGreaterThan(10)
    expect(lista.some(p => (p.nVideos ?? 0) > 0)).toBe(true)
  })

  it('as pastas varridas existem', () => {
    for (const c of [...ORIGENS, ...ARQUIVOS_DE_FORA]) expect(existsSync(join(RAIZ, c)), c).toBe(true)
    expect(arquivosDe(ORIGENS[0]!).length).toBeGreaterThan(3)
  })

  it('nada em observatorio/forja nem pack.ts importa de lib/pipeline/services/competitors', () => {
    for (const t of textos(ORIGENS)) expect(t).not.toContain('pipeline/services/competitors')
  })

  it('nada em observatorio/forja importa de observatorio/medidas', () => {
    for (const t of textos(ORIGENS)) expect(t).not.toMatch(/observatorio\/medidas/)
  })

  it('a rota readings não importa os módulos novos', () => {
    for (const t of textos(ARQUIVOS_DE_FORA))
      for (const m of ['competitors-medidas', 'competitors-campos', 'competitors-perfil', 'competitors-frases']) expect(t).not.toContain(m)
  })
})
