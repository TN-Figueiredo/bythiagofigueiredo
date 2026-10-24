// @vitest-environment node
// M10a, Tarefa 0 (Yannis Y3): retrato do conjunto de dados da semente do Observatório, com `now` fixo, ANTES da etapa.
// Gerar de novo só por decisão: GERAR_GOLDEN=1 (com o banco local de integração).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { seedSite } from '../../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { seedObservatory, clearObservatory, ORACLE_NOW } from '../../../e2e/fixtures/observatorio-seed'
import { apagarSitesDeTeste } from '../../helpers/limpa-cena'

export const GOLDEN_SEMENTE = path.resolve(__dirname, '__golden__/dataset-antes-semente.json')

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

/** Os ids da semente nascem do site de cada execução (uuid v5) e a cor do canal nasce do id: tira os dois e fica o resto, byte a byte. */
export function normalizar(ds: unknown): string {
  const limpo = (x: unknown): string => JSON.stringify(x, (k, v) => (k === 'color' ? undefined : v)).replace(UUID, '<UUID>')
  // a ordem das listas segue o id, que muda por site: compara como conjunto (cada lista ordenada pelo próprio texto)
  const canon = (x: unknown): unknown => Array.isArray(x)
    ? x.map(canon).map(e => [limpo(e), e] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(e => e[1])
    : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, canon(v)])) : x
  return limpo(canon(ds))
}

/** O arquivo guarda o hash (o texto passa de 5 MB) e a contagem de cada lista de topo. */
export function retrato(ds: Record<string, unknown>): { sha256: string; bytes: number; listas: Record<string, number> } {
  const texto = normalizar(ds)
  const listas: Record<string, number> = {}
  for (const [k, v] of Object.entries(ds)) if (Array.isArray(v)) listas[k] = v.length
  return { sha256: createHash('sha256').update(texto).digest('hex'), bytes: texto.length, listas }
}

// SKIP 23/10/2026 (envio E0): o ouro `__golden__/dataset-antes*.json` foi tirado no codigo de 14/10 (c46b0ff27); load.ts/competitor-sync mudaram no origin (yannis.md 3.6). Refazer a Tarefa 0 (retrato) da M10a no codigo atual antes de religar; NAO regravar o ouro sem isso.
describe.skip('retrato da semente do Observatório antes da M10a', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  beforeAll(async () => { sb = getSupabaseServiceClient(); siteId = (await seedSite(sb)).siteId }, 60_000)
  afterAll(async () => {
    if (!siteId) return
    await clearObservatory(siteId, sb)
    await apagarSitesDeTeste('id = $1', [siteId])
  }, 60_000)

  it('loadDataset(semente, ORACLE_NOW) é idêntico ao arquivo gravado', async () => {
    await seedObservatory(siteId, {}, sb)
    const ds = await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb })
    const atual = JSON.stringify(retrato(ds as unknown as Record<string, unknown>), null, 1) + '\n'
    if (process.env.GERAR_GOLDEN === '1') writeFileSync(process.env.GOLDEN_SAIDA ?? GOLDEN_SEMENTE, atual)
    expect(existsSync(GOLDEN_SEMENTE)).toBe(true)
    expect(atual).toBe(readFileSync(GOLDEN_SEMENTE, 'utf8'))
  }, 120_000)
})
